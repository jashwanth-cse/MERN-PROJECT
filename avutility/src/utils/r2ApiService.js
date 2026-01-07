import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * R2 API Service
 * Centralized service for all R2-based API interactions
 */

// ==================== Upload Workflow ====================

/**
 * Step 1: Generate a signed upload URL from the backend
 * @param {string} fileName - Name of the file
 * @param {string} fileType - MIME type of the file
 * @param {number} fileSize - Size of file in bytes
 * @returns {Promise<{uploadUrl: string, objectKey: string, expiresAt: string}>}
 */
export const generateUploadUrl = async (fileName, fileType, fileSize) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/upload-url`, {
            fileName,
            fileType,
            fileSize
        });

        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to generate upload URL');
        }

        return response.data.data; // { uploadUrl, objectKey, expiresAt }
    } catch (error) {
        console.error('Generate upload URL error:', error);
        throw new Error(
            error.response?.data?.message ||
            error.message ||
            'Failed to generate upload URL'
        );
    }
};

/**
 * Step 2: Upload file directly to R2 using the signed URL
 * @param {string} uploadUrl - Presigned upload URL from backend
 * @param {File} file - File object to upload
 * @param {Function} onProgress - Progress callback (percent: number) => void
 * @returns {Promise<void>}
 */
export const uploadToR2 = async (uploadUrl, file, onProgress) => {
    try {
        await axios.put(uploadUrl, file, {
            headers: {
                'Content-Type': file.type
            },
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                );
                if (onProgress) {
                    onProgress(percentCompleted);
                }
            }
        });
    } catch (error) {
        console.error('R2 upload error:', error);
        throw new Error('Failed to upload file to cloud storage');
    }
};

// ==================== Job Management ====================

/**
 * Step 3: Start a processing job
 * @param {string} objectKey - R2 object key from upload
 * @param {string} operationType - Type of operation (extract-audio, video-compress, etc.)
 * @param {object} options - Operation-specific options
 * @param {string} subscriptionId - Optional push notification subscription ID
 * @returns {Promise<{jobId: string, status: string, queuePosition?: number}>}
 */
export const startJob = async (objectKey, operationType, options, subscriptionId = null) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/start-job`, {
            objectKey,
            operationType,
            options,
            subscriptionId
        });

        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to start job');
        }

        return response.data.data; // { jobId, status, queuePosition }
    } catch (error) {
        console.error('Start job error:', error);
        throw new Error(
            error.response?.data?.message ||
            error.message ||
            'Failed to start processing job'
        );
    }
};

/**
 * Step 4: Connect to job status updates via Server-Sent Events (SSE)
 * With automatic reconnection and polling fallback
 * @param {string} jobId - Job ID from startJob
 * @param {object} callbacks - Event callbacks
 * @param {Function} callbacks.onProgress - (progressData) => void
 * @param {Function} callbacks.onComplete - (resultData) => void
 * @param {Function} callbacks.onError - (errorMessage) => void
 * @param {Function} callbacks.onQueueUpdate - (queueData) => void
 * @param {Function} callbacks.onConnectionLost - () => void (optional)
 * @returns {object} Connection object with { close, reconnect } methods
 */
export const connectToJobStatus = (jobId, callbacks) => {
    let eventSource = null;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 3;
    let pollingInterval = null;
    let isClosed = false;

    const connect = () => {
        if (isClosed) return;

        try {
            eventSource = new EventSource(`${API_BASE_URL}/job-status/${jobId}`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    reconnectAttempts = 0; // Reset on successful message

                    switch (data.type) {
                        case 'progress':
                            if (callbacks.onProgress) {
                                callbacks.onProgress({
                                    progress: data.progress || 0,
                                    timemark: data.timemark || '00:00:00',
                                    status: data.status,
                                    queuePosition: data.queuePosition
                                });
                            }
                            if (data.queuePosition !== undefined && callbacks.onQueueUpdate) {
                                callbacks.onQueueUpdate({
                                    queuePosition: data.queuePosition,
                                    status: data.status
                                });
                            }
                            break;

                        case 'complete':
                            if (callbacks.onComplete) {
                                callbacks.onComplete(data.result);
                            }
                            cleanup();
                            break;

                        case 'error':
                            if (callbacks.onError) {
                                callbacks.onError(data.message || 'Job failed');
                            }
                            cleanup();
                            break;

                        default:
                            console.warn('Unknown SSE event type:', data.type);
                    }
                } catch (error) {
                    console.error('Error parsing SSE data:', error);
                }
            };

            eventSource.onerror = (error) => {
                console.error('SSE connection error:', error);
                eventSource.close();

                // Notify UI of connection loss
                if (callbacks.onConnectionLost) {
                    callbacks.onConnectionLost();
                }

                // Try to reconnect or fall back to polling
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`);
                    setTimeout(connect, 2000); // Reconnect after 2 seconds
                } else {
                    console.log('Max reconnect attempts reached, switching to polling');
                    startPolling();
                }
            };
        } catch (error) {
            console.error('Error creating EventSource:', error);
            startPolling();
        }
    };

    const startPolling = () => {
        if (isClosed || pollingInterval) return;

        console.log('📊 Starting status polling (every 3 seconds)');

        pollingInterval = setInterval(async () => {
            try {
                const status = await checkJobStatus(jobId);

                if (callbacks.onProgress && status.status !== 'completed' && status.status !== 'failed') {
                    callbacks.onProgress({
                        progress: status.progress || 0,
                        timemark: status.timemark || '00:00:00',
                        status: status.status,
                        queuePosition: status.queuePosition
                    });
                }

                if (status.status === 'completed') {
                    if (callbacks.onComplete) {
                        callbacks.onComplete(status.result);
                    }
                    cleanup();
                } else if (status.status === 'failed') {
                    if (callbacks.onError) {
                        callbacks.onError(status.error || 'Job failed');
                    }
                    cleanup();
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 3000); // Poll every 3 seconds
    };

    const cleanup = () => {
        isClosed = true;
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    };

    // Start initial connection
    connect();

    // Return control object
    return {
        close: cleanup,
        reconnect: () => {
            reconnectAttempts = 0;
            connect();
        }
    };
};

/**
 * Check job status (used by polling fallback)
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Job status object
 */
export const checkJobStatus = async (jobId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/job-status-check/${jobId}`);
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to check job status');
        }
        return response.data.data;
    } catch (error) {
        console.error('Check job status error:', error);
        throw error;
    }
};

/**
 * Disconnect from SSE stream or stop polling
 * @param {object} connection - Connection object from connectToJobStatus
 */
export const disconnectJobStatus = (connection) => {
    if (connection && connection.close) {
        connection.close();
    }
};

// ==================== Download Workflow ====================

/**
 * Step 5: Get a signed download URL for completed job
 * @param {string} jobId - Job ID
 * @returns {Promise<{downloadUrl: string, fileName: string, fileSize: number, expiresAt: string}>}
 */
export const getDownloadUrl = async (jobId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/download-url/${jobId}`);

        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to get download URL');
        }

        return response.data.data; // { downloadUrl, fileName, fileSize, expiresAt }
    } catch (error) {
        console.error('Get download URL error:', error);
        throw new Error(
            error.response?.data?.message ||
            error.message ||
            'Failed to generate download link'
        );
    }
};

/**
 * Step 6: Trigger download from R2
 * @param {string} downloadUrl - Presigned download URL
 * @param {string} fileName - Name for downloaded file
 */
export const downloadFromR2 = (downloadUrl, fileName) => {
    // Open in new tab (browser will prompt download)
    window.open(downloadUrl, '_blank');

    // Alternative: Force download with anchor tag
    // const link = document.createElement('a');
    // link.href = downloadUrl;
    // link.download = fileName || 'download';
    // document.body.appendChild(link);
    // link.click();
    // document.body.removeChild(link);
};

// ==================== Cleanup ====================

/**
 * Manually cleanup job files from R2
 * @param {string} jobId - Job ID to cleanup
 * @returns {Promise<void>}
 */
export const cleanupJob = async (jobId) => {
    try {
        await axios.post(`${API_BASE_URL}/cleanup/${jobId}`);
    } catch (error) {
        console.error('Cleanup error:', error);
        // Don't throw - cleanup is not critical
    }
};

// ==================== Media Analysis (Optional) ====================

/**
 * Analyze media file metadata
 * @param {string} objectKey - R2 object key
 * @returns {Promise<object>} Media metadata
 */
export const analyzeMedia = async (objectKey) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/analyze`, {
            objectKey
        });

        if (!response.data.success) {
            throw new Error(response.data.message || 'Analysis failed');
        }

        return response.data.data;
    } catch (error) {
        console.error('Analyze error:', error);
        throw new Error(
            error.response?.data?.message ||
            error.message ||
            'Failed to analyze media file'
        );
    }
};

// ==================== Helpers ====================

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @param {object} options - Validation options
 * @param {string[]} options.allowedTypes - Allowed MIME types
 * @param {number} options.maxSize - Max size in bytes
 * @returns {{valid: boolean, error?: string}}
 */
export const validateFile = (file, options = {}) => {
    const {
        allowedTypes = [],
        maxSize = 5 * 1024 * 1024 * 1024 // 5GB default
    } = options;

    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    // Check file size
    if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
        return { valid: false, error: `File too large. Maximum size: ${maxSizeMB}MB` };
    }

    // Check file type
    if (allowedTypes.length > 0) {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const isAllowed = allowedTypes.some(type => {
            if (type.startsWith('.')) {
                return fileExtension === type.slice(1);
            }
            return file.type.includes(type);
        });

        if (!isAllowed) {
            return {
                valid: false,
                error: `Unsupported file type. Allowed: ${allowedTypes.join(', ')}`
            };
        }
    }

    return { valid: true };
};

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "45.23 MB")
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export default {
    generateUploadUrl,
    uploadToR2,
    startJob,
    connectToJobStatus,
    checkJobStatus,
    disconnectJobStatus,
    getDownloadUrl,
    downloadFromR2,
    cleanupJob,
    analyzeMedia,
    validateFile,
    formatFileSize
};
