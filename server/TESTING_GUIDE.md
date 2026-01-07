# Testing Guide for AV Utility Platform Backend

This guide provides step-by-step instructions for testing the new Cloudflare R2-based backend architecture.

---

## Prerequisites

### 1. Environment Setup

Ensure you have configured your `.env` file with R2 credentials:

```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=av-utility-media
```

If you haven't set up Cloudflare R2yet, see [API_DOCUMENTATION.md - R2 Setup](./API_DOCUMENTATION.md#cloudflare-r2-setup).

### 2. Install Dependencies

```bash
cd server
npm install
```

### 3. Start the Server

```bash
npm start
```

Expected output:
```
✅ R2 Service initialized
✅ Job Service initialized (max concurrent: 2)
✅ FFmpeg Service initialized
✅ Server is running on port 3000
🧹 Initialized automatic job cleanup (runs every 5 minutes)
```

---

## Test 1: R2 Service Integration Test

This test validates that your Cloudflare R2 credentials are correct and the R2 service is working.

### Run the Test

```bash
node tests/test-r2-service.js
```

### What It Tests

- ✅ R2 service initialization
- ✅ Generate signed upload URLs
- ✅ Upload files to R2
- ✅ Generate signed download URLs
- ✅ Download files from R2
- ✅ Get object metadata
- ✅ Delete objects
- ✅ Batch delete multiple objects

### Expected Output

```
🧪 Test 1: Service Initialization
✅ R2 Service initialized successfully

🧪 Test 2: Generate Upload URL
✅ Upload URL generated successfully
ℹ️ Object Key: input/uuid/test-file.mp4
✅ Upload URL is properly signed

🧪 Test 3: File Upload to R2
✅ File uploaded to R2 successfully

🧪 Test 4: Generate Download URL
✅ Download URL generated successfully

🧪 Test 5: Download File from R2
✅ File downloaded from R2 successfully
✅ Downloaded content matches uploaded content

🧪 Test 6: Get Object Metadata
✅ Object exists in R2

🧪 Test 7: Delete Object from R2
✅ Object deleted successfully
✅ Verified: Object no longer exists in R2

🧪 Test 8: Batch Delete
✅ Batch delete completed: 3 deleted, 0 failed

✅ All R2 service tests passed! ✨
```

### Troubleshooting

**Error: "Missing required R2 environment variables"**
- Make sure all R2 credentials are in `.env`
- Verify variable names are correct (R2_ACCOUNT_ID, etc.)

**Error: "403 Forbidden"**
- Check that your R2 API token has correct permissions (Object Read & Write)
- Verify the bucket name matches R2_BUCKET_NAME in .env

**Error: "NoSuchBucket"**
- Create the R2 bucket in Cloudflare dashboard
- Ensure bucket name matches exactly

---

## Test 2: API Endpoints Test

This test validates all new API endpoints without requiring actual file uploads.

### Run the Test

```bash
# In one terminal: npm start
# In another terminal:
node tests/test-api-endpoints.js
```

### What It Tests

- ✅ Server health check
- ✅ Upload URL generation
- ✅ Job creation for all operation types
- ✅ Job status endpoint availability
- ✅ Download URL behavior
- ✅ Cleanup endpoint
- ✅ Input validation
- ✅ Error handling

### Expected Output

```
🧪 Test 1: Server Health Check
✅ Server is running
ℹ️ API Version: 2.0.0
✅ New API version detected (2.0.0)

🧪 Test 2: Generate Upload URL
✅ Upload URL generated successfully
ℹ️ Object Key: input/uuid/test-video.mp4

🧪 Test 3: Start Job (Video Compress)
✅ Job created: job-uuid
ℹ️ Status: processing

🧪 Test 5: Get Download URL (should fail - job not complete)
✅ Job failed as expected (file does not exist in R2)

🧪 Test 6: Cleanup Job
✅ Job cleaned up successfully

🧪 Test 7: Input Validation Tests
✅ Correctly rejected request with missing fileName
✅ Correctly rejected file larger than 5GB
✅ Correctly rejected invalid operation type
✅ Correctly rejected invalid codec option

🧪 Test 8: All Operation Types Validation
✅ extract-audio: Job created
✅ audio-convert: Job created
✅ audio-compress: Job created
✅ video-compress: Job created

✅ All API endpoint tests completed! ✨
```

---

## Test 3: Interactive Web Client Test

This test allows you to test the complete workflow with real files using a web interface.

### Run the Test

1. Start the server:
   ```bash
   npm start
   ```

2. Open the test client in your browser:
   ```
   file:///e:/Projects/AV%20Utility%20Platform/server/tests/test-client.html
   ```
   Or open it directly in your file explorer.

### How to Use

1. **Select a media file** (video or audio)
2. **Choose an operation type**:
   - Video Compression
   - Extract Audio
   - Audio Convert
   - Audio Compress
3. **Click "Start Processing"**
4. **Watch the progress** in real-time via SSE
5. **Download the result** when complete

### What to Observe

- ✅ File uploads directly to R2 (not through backend)
- ✅ Progress updates in real-time
- ✅ Status changes: pending → processing → completed
- ✅ Download URL generated after completion
- ✅ File downloads directly from R2
- ✅ Activity log shows all operations

### Expected Workflow

```
1. Requesting upload URL from API...
2. Upload URL generated: input/uuid/filename.mp4
3. Uploading file directly to Cloudflare R2...
4. File uploaded successfully to R2
5. Starting video-compress job...
6. Job created: job-uuid
7. Connecting to progress stream...
8. Progress: 0% - 00:00:00
9. Progress: 25% - 00:00:15
10. Progress: 50% - 00:00:30
11. Progress: 75% - 00:00:45
12. Progress: 100% - 00:01:00
13. Processing completed successfully!
14. Generating download URL...
15. Download URL generated
16. Download initiated!
17. Cleaning up job files...
18. Job cleaned up successfully
```

---

## Test 4: Concurrent Job Limiting Test

This test validates that the system correctly limits concurrent jobs and queues excess requests.

### Manual Test Steps

1. Start the server with `npm start`

2. Open three browser tabs with the test client

3. In rapid succession:
   - Tab 1: Upload and start a job
   - Tab 2: Upload and start a job
   - Tab 3: Upload and start a job

### Expected Behavior

- **Jobs 1 & 2**: Start processing immediately
- **Job 3**: Gets queued
  - Status: "queued"
  - Queue position: 1

- When Job 1 completes:
  - Job 3 automatically starts processing

### Observe

```bash
# In server logs:
📋 Job created: job-1 (video-compress)
▶️  Job started: job-1

📋 Job created: job-2 (video-compress)
▶️  Job started: job-2

📋 Job queued: job-3 (position: 1)

✅ Job completed: job-1
📤 Job dequeued: job-3
▶️ Job started: job-3
```

---

## Test 5: Automatic Cleanup Test

This test validates that jobs are automatically cleaned up after timeout.

### Test Steps

1. Create a job but don't process it (file doesn't exist)
   ```bash
   curl -X POST http://localhost:3000/api/upload-url \
     -H "Content-Type: application/json" \
     -d '{"fileName":"test.mp4","fileType":"video/mp4","fileSize":1000000}'
   
   # Save the objectKey
   
   curl -X POST http://localhost:3000/api/start-job \
     -H "Content-Type: application/json" \
     -d '{"objectKey":"<objectKey>","operationType":"video-compress","options":{}}'
   ```

2. Wait for cleanup (runs every 5 minutes)

3. Check server logs after 5 minutes:
   ```
   🧹 Cleaned up 1 expired job(s)
   ```

---

## Test 6: Zero Disk Usage Verification

This test confirms that no media files are stored on the backend server disk.

### Test Steps

1. Run a complete workflow with the test client

2. Check the temp directory:
   ```bash
   ls server/temp
   ```

   **Expected**: Empty or only contains job-specific subdirectories during processing

3. After job completion:
   ```bash
   ls server/temp
   ```

   **Expected**: All job subdirectories should be deleted

4. Check uploads directory (should not exist or be empty):
   ```bash
   ls server/uploads
   ```

   **Expected**: Directory doesn't exist or is empty

### Validation

- ✅ No input files stored on server
- ✅ No output files stored on server
- ✅ Temp files cleaned up after processing
- ✅ All media in R2 only

---

## Test 7: End-to-End Integration Test

Complete workflow simulation from upload to download.

### Prerequisites

- Small test video file (< 50MB recommended for quick testing)
- R2 credentials configured

### Steps

1. Generate upload URL:
   ```bash
   curl -X POST http://localhost:3000/api/upload-url \
     -H "Content-Type: application/json" \
     -d '{
       "fileName": "test.mp4",
       "fileType": "video/mp4",
       "fileSize": 10485760
     }'
   ```

2. Upload file to R2:
   ```bash
   curl -X PUT "<uploadUrl-from-step-1>" \
     --upload-file /path/to/test.mp4 \
     -H "Content-Type: video/mp4"
   ```

3. Start job:
   ```bash
   curl -X POST http://localhost:3000/api/start-job \
     -H "Content-Type: application/json" \
     -d '{
       "objectKey": "<objectKey-from-step-1>",
       "operationType": "video-compress",
       "options": {
         "codec": "h264",
         "resolution": "720p",
         "preset": "fast"
       }
     }'
   ```

4. Monitor progress:
   ```bash
   curl -N http://localhost:3000/api/job-status/<jobId-from-step-3>
   ```

5. Get download URL (after completion):
   ```bash
   curl http://localhost:3000/api/download-url/<jobId>
   ```

6. Download file:
   ```bash
   curl -o output.mp4 "<downloadUrl-from-step-5>"
   ```

7. Verify output file:
   ```bash
   ffprobe output.mp4
   ```

---

## Common Issues & Solutions

### Issue: "R2 Service initialization failed"

**Solution:**
- Check `.env` has all R2 variables
- Restart server after updating `.env`
- Verify R2 credentials are correct in Cloudflare dashboard

### Issue: "Job stays in 'pending' status"

**Solution:**
- Check server logs for errors
- Verify FFmpeg is installed and accessible
- Check that R2 file exists (if testing with real files)

### Issue: "Download URL returns 403 Forbidden"

**Solution:**
- URL might have expired (5 minute limit)
- Request a new download URL
- Check R2 bucket permissions

### Issue: "SSE connection fails"

**Solution:**
- Check browser console for CORS errors
- Ensure server is running on http://localhost:3000
- Try different browser (Chrome/Firefox recommended)

---

## Testing Checklist

Before deploying to production, ensure all these tests pass:

- [ ] **R2 Service Test** - All 8 tests pass
- [ ] **API Endpoints Test** - All validation tests pass
- [ ] **Web Client Test** - Complete workflow succeeds
- [ ] **Concurrent Jobs Test** - Queueing works correctly
- [ ] **Cleanup Test** - Old jobs are auto-deleted
- [ ] **Disk Usage Test** - No files remain after jobs
- [ ] **End-to-End Test** - Full workflow with real file
- [ ] **Error Handling** - Invalid inputs rejected properly
- [ ] **Multiple Operation Types** - All 4 types work
- [ ] **Progress Tracking** - SSE updates correctly

---

## Next Steps After Testing

Once all tests pass:

1. **Update Frontend** - Integrate new API into React app
2. **Deploy to Staging** - Test on Firebase App Hosting staging
3. **Load Testing** - Test with multiple concurrent users
4. **Monitor Costs** - Check R2 usage in Cloudflare dashboard
5. **Production Deploy** - Deploy to Firebase App Hosting production

---

## Getting Help

- 📖 API Documentation: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- 📋 Implementation Plan: See artifacts in `.gemini/antigravity/brain/`
- ✅ Task Checklist: [task.md](../.gemini/antigravity/brain/f545aed5-9004-4a11-9f7a-5063473391ba/task.md)
- 🚀 Walkthrough: [walkthrough.md](../.gemini/antigravity/brain/f545aed5-9004-4a11-9f7a-5063473391ba/walkthrough.md)

---

**Happy Testing! 🎉**
