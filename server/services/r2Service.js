const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

/**
 * Cloudflare R2 Service
 * Manages all R2 operations including signed URL generation, uploads, downloads, and deletions
 */
class R2Service {
    constructor() {
        // Validate required environment variables
        this.validateConfig();

        // Initialize S3 client with R2 endpoint
        this.client = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });

        this.bucketName = process.env.R2_BUCKET_NAME;
        console.log('✅ R2 Service initialized');
    }

    /**
     * Validate R2 configuration
     */
    validateConfig() {
        const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
        const missing = required.filter(key => !process.env[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required R2 environment variables: ${missing.join(', ')}`);
        }
    }

    /**
     * Generate presigned upload URL
     * @param {string} fileName - Original filename
     * @param {string} fileType - MIME type
     * @param {number} expiresIn - URL expiry in seconds (default: 300 = 5 minutes)
     * @returns {Promise<{uploadUrl: string, objectKey: string, expiresAt: Date}>}
     */
    async generateUploadUrl(fileName, fileType, expiresIn = 300) {
        try {
            // Generate unique object key: input/<uuid>/<sanitized-filename>
            const { v4: uuidv4 } = require('uuid');
            const uuid = uuidv4();
            const sanitizedFileName = this.sanitizeFileName(fileName);
            const objectKey = `input/${uuid}/${sanitizedFileName}`;

            // Create presigned PUT URL
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: objectKey,
                ContentType: fileType,
            });

            const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
            const expiresAt = new Date(Date.now() + expiresIn * 1000);

            console.log(`🔗 Generated upload URL for: ${objectKey}`);

            return {
                uploadUrl,
                objectKey,
                expiresAt,
            };
        } catch (error) {
            console.error('❌ Failed to generate upload URL:', error);
            throw new Error(`Upload URL generation failed: ${error.message}`);
        }
    }

    /**
     * Generate presigned download URL
     * @param {string} objectKey - R2 object key
     * @param {number} expiresIn - URL expiry in seconds (default: 300 = 5 minutes)
     * @returns {Promise<{downloadUrl: string, expiresAt: Date}>}
     */
    async generateDownloadUrl(objectKey, expiresIn = 300) {
        try {
            // Create presigned GET URL
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: objectKey,
            });

            const downloadUrl = await getSignedUrl(this.client, command, { expiresIn });
            const expiresAt = new Date(Date.now() + expiresIn * 1000);

            console.log(`🔗 Generated download URL for: ${objectKey}`);

            return {
                downloadUrl,
                expiresAt,
            };
        } catch (error) {
            console.error('❌ Failed to generate download URL:', error);
            throw new Error(`Download URL generation failed: ${error.message}`);
        }
    }

    /**
     * Upload a local file to R2
     * @param {string} filePath - Local file path
     * @param {string} objectKey - Destination R2 object key
     * @param {string} contentType - MIME type
     * @returns {Promise<{objectKey: string, size: number}>}
     */
    async uploadFile(filePath, objectKey, contentType = 'application/octet-stream') {
        try {
            // Read file content
            const fileContent = fs.readFileSync(filePath);
            const fileSize = fs.statSync(filePath).size;

            // Upload to R2
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: objectKey,
                Body: fileContent,
                ContentType: contentType,
            });

            await this.client.send(command);

            console.log(`⬆️  Uploaded to R2: ${objectKey} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

            return {
                objectKey,
                size: fileSize,
            };
        } catch (error) {
            console.error('❌ Failed to upload file to R2:', error);
            throw new Error(`R2 upload failed: ${error.message}`);
        }
    }

    /**
     * Download a file from R2 to local filesystem
     * @param {string} objectKey - R2 object key
     * @param {string} localPath - Destination local file path
     * @returns {Promise<{localPath: string, size: number}>}
     */
    async downloadFile(objectKey, localPath) {
        try {
            // Get object from R2
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: objectKey,
            });

            const response = await this.client.send(command);

            // Ensure directory exists
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write to local file
            const writeStream = fs.createWriteStream(localPath);

            // Convert response body to buffer and write
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(localPath, buffer);

            const fileSize = fs.statSync(localPath).size;

            console.log(`⬇️  Downloaded from R2: ${objectKey} → ${localPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

            return {
                localPath,
                size: fileSize,
            };
        } catch (error) {
            console.error('❌ Failed to download file from R2:', error);
            throw new Error(`R2 download failed: ${error.message}`);
        }
    }

    /**
     * Delete an object from R2
     * @param {string} objectKey - R2 object key
     * @returns {Promise<{deleted: boolean, objectKey: string}>}
     */
    async deleteObject(objectKey) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: objectKey,
            });

            await this.client.send(command);

            console.log(`🗑️  Deleted from R2: ${objectKey}`);

            return {
                deleted: true,
                objectKey,
            };
        } catch (error) {
            console.error('❌ Failed to delete object from R2:', error);
            throw new Error(`R2 deletion failed: ${error.message}`);
        }
    }

    /**
     * Delete multiple objects from R2
     * @param {string[]} objectKeys - Array of R2 object keys
     * @returns {Promise<{deleted: number, failed: number}>}
     */
    async deleteObjects(objectKeys) {
        let deleted = 0;
        let failed = 0;

        for (const objectKey of objectKeys) {
            try {
                await this.deleteObject(objectKey);
                deleted++;
            } catch (error) {
                console.error(`Failed to delete ${objectKey}:`, error.message);
                failed++;
            }
        }

        console.log(`🗑️  Batch deletion: ${deleted} deleted, ${failed} failed`);

        return { deleted, failed };
    }

    /**
     * Sanitize filename for R2 storage
     * @param {string} fileName - Original filename
     * @returns {string} Sanitized filename
     */
    sanitizeFileName(fileName) {
        // Remove unsafe characters and normalize
        return fileName
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_')
            .toLowerCase();
    }

    /**
     * Get object metadata without downloading
     * @param {string} objectKey - R2 object key
     * @returns {Promise<{exists: boolean, size?: number, lastModified?: Date}>}
     */
    async getObjectMetadata(objectKey) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: objectKey,
            });

            const response = await this.client.send(command);

            return {
                exists: true,
                size: response.ContentLength,
                lastModified: response.LastModified,
            };
        } catch (error) {
            if (error.name === 'NoSuchKey') {
                return { exists: false };
            }
            throw error;
        }
    }
}

// Singleton instance
let r2ServiceInstance = null;

/**
 * Get R2 service instance
 * @returns {R2Service}
 */
function getR2Service() {
    if (!r2ServiceInstance) {
        r2ServiceInstance = new R2Service();
    }
    return r2ServiceInstance;
}

module.exports = {
    R2Service,
    getR2Service,
};
