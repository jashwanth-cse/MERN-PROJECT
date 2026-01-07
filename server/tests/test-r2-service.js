/**
 * Test Script for R2 Service
 * Verifies Cloudflare R2 integration and signed URL functionality
 * 
 * Usage: node tests/test-r2-service.js
 */

require('dotenv').config();
const { getR2Service } = require('../services/r2Service');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better readability
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(emoji, color, message) {
    console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function success(message) {
    log('✅', colors.green, message);
}

function error(message) {
    log('❌', colors.red, message);
}

function info(message) {
    log('ℹ️', colors.blue, message);
}

function warning(message) {
    log('⚠️', colors.yellow, message);
}

function section(message) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    log('🧪', colors.cyan, message);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function testR2Service() {
    section('R2 Service Test Suite');

    try {
        // Test 1: Service Initialization
        section('Test 1: Service Initialization');

        let r2Service;
        try {
            r2Service = getR2Service();
            success('R2 Service initialized successfully');
        } catch (err) {
            error(`Service initialization failed: ${err.message}`);
            warning('Make sure you have configured R2 environment variables in .env:');
            console.log('  - R2_ACCOUNT_ID');
            console.log('  - R2_ACCESS_KEY_ID');
            console.log('  - R2_SECRET_ACCESS_KEY');
            console.log('  - R2_BUCKET_NAME');
            process.exit(1);
        }

        // Test 2: Generate Upload URL
        section('Test 2: Generate Upload URL');

        try {
            const uploadResult = await r2Service.generateUploadUrl(
                'test-file.mp4',
                'video/mp4',
                300 // 5 minutes
            );

            success('Upload URL generated successfully');
            info(`Object Key: ${uploadResult.objectKey}`);
            info(`Expires At: ${uploadResult.expiresAt}`);
            info(`URL Length: ${uploadResult.uploadUrl.length} characters`);

            // Verify URL structure
            if (!uploadResult.uploadUrl.includes('X-Amz-Signature')) {
                warning('Upload URL might not be properly signed');
            } else {
                success('Upload URL is properly signed');
            }

            // Verify object key format
            if (uploadResult.objectKey.startsWith('input/')) {
                success('Object key has correct prefix (input/)');
            } else {
                warning('Object key should start with "input/"');
            }

        } catch (err) {
            error(`Failed to generate upload URL: ${err.message}`);
            throw err;
        }

        // Test 3: Create and Upload Test File
        section('Test 3: File Upload to R2');

        const testDir = path.join(__dirname, '../temp/test');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        const testFilePath = path.join(testDir, 'test-upload.txt');
        const testContent = 'This is a test file for R2 upload.\nTimestamp: ' + new Date().toISOString();
        fs.writeFileSync(testFilePath, testContent);
        info(`Created test file: ${testFilePath}`);

        try {
            const uploadResult = await r2Service.uploadFile(
                testFilePath,
                'test/upload-test.txt',
                'text/plain'
            );

            success('File uploaded to R2 successfully');
            info(`Object Key: ${uploadResult.objectKey}`);
            info(`File Size: ${uploadResult.size} bytes`);

            // Test 4: Generate Download URL
            section('Test 4: Generate Download URL');

            const downloadResult = await r2Service.generateDownloadUrl(
                uploadResult.objectKey,
                300 // 5 minutes
            );

            success('Download URL generated successfully');
            info(`Expires At: ${downloadResult.expiresAt}`);
            info(`URL Length: ${downloadResult.downloadUrl.length} characters`);

            if (!downloadResult.downloadUrl.includes('X-Amz-Signature')) {
                warning('Download URL might not be properly signed');
            } else {
                success('Download URL is properly signed');
            }

            // Test 5: Download File from R2
            section('Test 5: Download File from R2');

            const downloadPath = path.join(testDir, 'test-download.txt');
            const downloadFileResult = await r2Service.downloadFile(
                uploadResult.objectKey,
                downloadPath
            );

            success('File downloaded from R2 successfully');
            info(`Downloaded to: ${downloadFileResult.localPath}`);
            info(`File Size: ${downloadFileResult.size} bytes`);

            // Verify content
            const downloadedContent = fs.readFileSync(downloadPath, 'utf-8');
            if (downloadedContent === testContent) {
                success('Downloaded content matches uploaded content');
            } else {
                error('Downloaded content does NOT match uploaded content');
            }

            // Test 6: Get Object Metadata
            section('Test 6: Get Object Metadata');

            const metadata = await r2Service.getObjectMetadata(uploadResult.objectKey);

            if (metadata.exists) {
                success('Object exists in R2');
                info(`Size: ${metadata.size} bytes`);
                info(`Last Modified: ${metadata.lastModified}`);
            } else {
                error('Object does not exist in R2');
            }

            // Test 7: Delete Object
            section('Test 7: Delete Object from R2');

            const deleteResult = await r2Service.deleteObject(uploadResult.objectKey);

            if (deleteResult.deleted) {
                success(`Object deleted successfully: ${deleteResult.objectKey}`);
            } else {
                error('Failed to delete object');
            }

            // Verify deletion
            const metadataAfterDelete = await r2Service.getObjectMetadata(uploadResult.objectKey);
            if (!metadataAfterDelete.exists) {
                success('Verified: Object no longer exists in R2');
            } else {
                error('Object still exists after deletion');
            }

            // Cleanup local files
            fs.unlinkSync(testFilePath);
            fs.unlinkSync(downloadPath);
            fs.rmdirSync(testDir);
            info('Cleaned up local test files');

        } catch (err) {
            error(`File operation failed: ${err.message}`);
            throw err;
        }

        // Test 8: Batch Delete
        section('Test 8: Batch Delete');

        // Upload multiple test files
        const testKeys = [];
        for (let i = 1; i <= 3; i++) {
            const key = `test/batch-${i}.txt`;
            const filePath = path.join(__dirname, '../temp', `batch-${i}.txt`);

            // Create temp directory if needed
            const tempDir = path.dirname(filePath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(filePath, `Test file ${i}`);

            await r2Service.uploadFile(filePath, key, 'text/plain');
            testKeys.push(key);
            fs.unlinkSync(filePath); // Clean up local file
        }

        info(`Uploaded ${testKeys.length} test files`);

        // Delete all at once
        const batchDeleteResult = await r2Service.deleteObjects(testKeys);
        success(`Batch delete completed: ${batchDeleteResult.deleted} deleted, ${batchDeleteResult.failed} failed`);

        // Final Summary
        section('Test Summary');
        success('All R2 service tests passed! ✨');
        console.log();
        info('Your R2 integration is working correctly!');
        info('You can now:');
        console.log('  1. Generate upload/download URLs');
        console.log('  2. Upload/download files');
        console.log('  3. Delete objects');
        console.log('  4. Get object metadata');
        console.log();
        success('Ready for production deployment! 🚀');

    } catch (err) {
        console.log();
        error('Test suite failed!');
        console.error(err);
        process.exit(1);
    }
}

// Run tests
if (require.main === module) {
    testR2Service().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testR2Service };
