import { useState } from 'react';
import { generateUploadUrl, uploadToR2, validateFile } from '../utils/r2ApiService';
import { toast } from 'react-toastify';

/**
 * Custom hook for R2 file uploads
 * Handles the complete upload workflow: validation → generate URL → upload to R2
 * 
 * @param {object} options - Upload options
 * @param {string[]} options.allowedTypes - Allowed file types/extensions
 * @param {number} options.maxSize - Maximum file size in bytes
 * @returns {object} Upload state and functions
 */
export const useR2Upload = (options = {}) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [objectKey, setObjectKey] = useState(null);
    const [error, setError] = useState(null);

    const {
        allowedTypes = [],
        maxSize = 5 * 1024 * 1024 * 1024, // 5GB default
        onSuccess,
        onError
    } = options;

    /**
     * Upload a file to R2
     * @param {File} file - File to upload
     * @returns {Promise<string>} Object key on success
     */
    const upload = async (file) => {
        // Reset state
        setUploading(true);
        setProgress(0);
        setError(null);
        setObjectKey(null);

        try {
            // Validate file
            const validationResult = validateFile(file, { allowedTypes, maxSize });
            if (!validationResult.valid) {
                throw new Error(validationResult.error);
            }

            // Step 1: Generate upload URL
            toast.info('Preparing upload to cloud storage...');
            const { uploadUrl, objectKey: key } = await generateUploadUrl(
                file.name,
                file.type,
                file.size
            );

            // Step 2: Upload to R2
            toast.info('Uploading file to cloud storage...');
            await uploadToR2(uploadUrl, file, (percent) => {
                setProgress(percent);
            });

            // Success
            setObjectKey(key);
            setUploading(false);
            setProgress(100);
            toast.success('File uploaded to cloud storage successfully!');

            if (onSuccess) {
                onSuccess(key);
            }

            return key;

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message);
            setUploading(false);
            setProgress(0);
            toast.error(err.message || 'Upload failed');

            if (onError) {
                onError(err);
            }

            throw err;
        }
    };

    /**
     * Reset upload state
     */
    const reset = () => {
        setUploading(false);
        setProgress(0);
        setObjectKey(null);
        setError(null);
    };

    return {
        upload,
        uploading,
        progress,
        objectKey,
        error,
        reset
    };
};

export default useR2Upload;
