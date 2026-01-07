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
 * @param {string} jobId - Job ID from startJob
 * @param {object} callbacks - Event callbacks
 * @param {Function} callbacks.onProgress - (progressData) => void
 * @param {Function} callbacks.onComplete - (resultData) => void
 * @param {Function} callbacks.onError - (errorMessage) => void
 * @param {Function} callbacks.onQueueUpdate - (queueData) => void
 * @returns {EventSource} EventSource instance (call .close() to disconnect)
 */
export const connectToJobStatus = (jobId, callbacks) => {
    const eventSource = new EventSource(`${API_BASE_URL}/job-status/${jobId}`);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

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
                    // Also handle queue updates
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
                    eventSource.close();
                    break;

                case 'error':
                    if (callbacks.onError) {
                        callbacks.onError(data.message || 'Job failed');
                    }
                    eventSource.close();
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
        if (callbacks.onError) {
            callbacks.onError('Connection lost. Please refresh the page.');
        }
        eventSource.close();
    };

    return eventSource;
};

/**
 * Disconnect from SSE stream
 * @param {EventSource} eventSource - EventSource instance to close
 */
export const disconnectJobStatus = (eventSource) => {
    if (eventSource) {
        eventSource.close();
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
    disconnectJobStatus,
    getDownloadUrl,
    downloadFromR2,
    cleanupJob,
    analyzeMedia,
    validateFile,
    formatFileSize
};
