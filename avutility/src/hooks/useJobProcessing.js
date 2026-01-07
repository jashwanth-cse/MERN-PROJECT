import { useState, useRef, useEffect } from 'react';
import { startJob, connectToJobStatus, disconnectJobStatus } from '../utils/r2ApiService';
import { toast } from 'react-toastify';

/**
 * Custom hook for job processing with R2 API
 * Handles job creation, SSE progress monitoring, and queue status
 * 
 * @param {object} options - Processing options
 * @returns {object} Job state and functions
 */
export const useJobProcessing = (options = {}) => {
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, starting, queued, processing, completed, failed
    const [progress, setProgress] = useState(0);
    const [timemark, setTimemark] = useState('00:00:00');
    const [queuePosition, setQueuePosition] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const eventSourceRef = useRef(null);

    const {
        onProgress,
        onComplete,
        onError: onErrorCallback,
        onQueueUpdate
    } = options;

    /**
     * Start a processing job
     * @param {string} objectKey - R2 object key from upload
     * @param {string} operationType - Type of operation
     * @param {object} jobOptions - Job-specific options
     * @param {string} subscriptionId - Optional push subscription ID
     * @returns {Promise<string>} Job ID
     */
    const startProcessing = async (objectKey, operationType, jobOptions = {}, subscriptionId = null) => {
        try {
            // Reset state
            setStatus('starting');
            setProgress(0);
            setQueuePosition(null);
            setResult(null);
            setError(null);

            toast.info(`Starting ${operationType}...`);

            // Start the job
            const jobData = await startJob(objectKey, operationType, jobOptions, subscriptionId);
            const { jobId: jid, status: jobStatus, queuePosition: qPos } = jobData;

            setJobId(jid);
            setStatus(jobStatus);

            // Handle queue status
            if (jobStatus === 'queued' && qPos) {
                setQueuePosition(qPos);
                toast.warning(`You're in queue at position #${qPos}`);

                if (onQueueUpdate) {
                    onQueueUpdate({ queuePosition: qPos, status: jobStatus });
                }
            } else if (jobStatus === 'processing') {
                toast.info('Processing started!');
            }

            // Connect to SSE for progress updates
            connectToProgress(jid);

            return jid;

        } catch (err) {
            console.error('Start job error:', err);
            setError(err.message);
            setStatus('failed');
            toast.error(err.message || 'Failed to start job');

            if (onErrorCallback) {
                onErrorCallback(err);
            }

            throw err;
        }
    };

    /**
     * Connect to SSE stream for progress updates
     * @param {string} jid - Job ID
     */
    const connectToProgress = (jid) => {
        // Close existing connection
        if (eventSourceRef.current) {
            disconnectJobStatus(eventSourceRef.current);
        }

        const eventSource = connectToJobStatus(jid, {
            onProgress: (progressData) => {
                setProgress(progressData.progress);
                setTimemark(progressData.timemark || '00:00:00');
                setStatus(progressData.status);

                // Handle queue position updates
                if (progressData.queuePosition !== undefined) {
                    setQueuePosition(progressData.queuePosition);

                    if (onQueueUpdate) {
                        onQueueUpdate({
                            queuePosition: progressData.queuePosition,
                            status: progressData.status
                        });
                    }

                    // Transition from queued to processing
                    if (progressData.status === 'processing' && status === 'queued') {
                        toast.success('🎉 Your turn! Processing starting...');
                    }
                } else {
                    setQueuePosition(null);
                }

                if (onProgress) {
                    onProgress(progressData);
                }
            },

            onComplete: (resultData) => {
                setStatus('completed');
                setProgress(100);
                setResult(resultData);
                setQueuePosition(null);
                toast.success('Processing completed successfully!');

                if (onComplete) {
                    onComplete(resultData);
                }
            },

            onError: (errorMessage) => {
                setStatus('failed');
                setError(errorMessage);
                setQueuePosition(null);
                toast.error(errorMessage || 'Processing failed');

                if (onErrorCallback) {
                    onErrorCallback(new Error(errorMessage));
                }
            },

            onQueueUpdate: (queueData) => {
                setQueuePosition(queueData.queuePosition);
                setStatus(queueData.status);

                if (onQueueUpdate) {
                    onQueueUpdate(queueData);
                }
            }
        });

        eventSourceRef.current = eventSource;
    };

    /**
     * Reset job state
     */
    const reset = () => {
        // Disconnect SSE
        if (eventSourceRef.current) {
            disconnectJobStatus(eventSourceRef.current);
            eventSourceRef.current = null;
        }

        setJobId(null);
        setStatus('idle');
        setProgress(0);
        setTimemark('00:00:00');
        setQueuePosition(null);
        setResult(null);
        setError(null);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                disconnectJobStatus(eventSourceRef.current);
            }
        };
    }, []);

    return {
        startProcessing,
        jobId,
        status,
        progress,
        timemark,
        queuePosition,
        result,
        error,
        isQueued: status === 'queued',
        isProcessing: status === 'processing',
        isCompleted: status === 'completed',
        isFailed: status === 'failed',
        reset
    };
};

export default useJobProcessing;
