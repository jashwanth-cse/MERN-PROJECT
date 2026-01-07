# AV Utility Platform - Backend API Documentation

## Overview

The AV Utility Platform backend has been refactored to use a **Cloudflare R2 signed URL architecture** instead of multer-based disk storage. This makes it suitable for Firebase App Hosting deployment with zero outgoing bandwidth costs.

## Architecture

### Data Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Browser   │  ────▶  │  Backend API │  ────▶  │  Cloudflare R2  │
│  (Frontend) │  ◀────  │ (Control     │  ◀────  │  (Storage)      │
└─────────────┘         │  Plane)      │         └─────────────────┘
                        └──────────────┘
                              │
                              │
                              ▼
                        ┌──────────────┐
                        │    FFmpeg    │
                        │  Processing  │
                        └──────────────┘
```

### Key Components

1. **R2 Service** (`services/r2Service.js`)
   - Generates signed URLs for uploads and downloads
   - Manages R2 object uploads/downloads
   - Handles object deletion

2. **Job Service** (`services/jobService.js`)
   - Manages job lifecycle and state
   - Handles job queueing (max 2 concurrent jobs)
   - SSE progress broadcasting
   - Automatic cleanup

3. **FFmpeg Service** (`services/ffmpegService.js`)
   - Downloads media from R2 to isolated temp directories
   - Processes with FFmpeg
   - Uploads results back to R2
   - Cleans up temp files

4. **Media Controller** (`controllers/mediaController.js`)
   - Unified API for all media operations
   - Handles upload URL generation
   - Job creation and status tracking
   - Download URL generation

## API Endpoints

### 1. Generate Upload URL

**POST** `/api/upload-url`

Generates a presigned URL for the client to upload a file directly to R2.

**Request Body:**
```json
{
  "fileName": "my-video.mp4",
  "fileType": "video/mp4",
  "fileSize": 52428800
}
```

**Response:**
```json
{
  "success": true,
  "message": "Upload URL generated",
  "data": {
    "uploadUrl": "https://...signed-url...",
    "objectKey": "input/uuid/my-video.mp4",
    "expiresAt": "2024-01-01T12:05:00.000Z"
  }
}
```

**Usage:**
1. Call this endpoint to get an upload URL
2. Use the `uploadUrl` to upload the file directly from the browser using a PUT request
3. Save the `objectKey` to use in the next step

---

### 2. Start Processing Job

**POST** `/api/start-job`

Creates a processing job for a file that has been uploaded to R2.

**Request Body:**
```json
{
  "objectKey": "input/uuid/my-video.mp4",
  "operationType": "video-compress",
  "options": {
    "codec": "h264",
    "resolution": "720p",
    "preset": "medium",
    "audioOption": "compress"
  },
  "subscriptionId": "optional-push-notification-id"
}
```

**Operation Types:**
- `extract-audio` - Extract audio from video
- `audio-convert` - Convert audio format
- `audio-compress` - Compress audio file
- `video-compress` - Compress video file

**Response (Job Started):**
```json
{
  "success": true,
  "message": "Job started",
  "data": {
    "jobId": "job-uuid",
    "status": "processing"
  }
}
```

**Response (Job Queued):**
```json
{
  "success": true,
  "message": "Job queued",
  "data": {
    "jobId": "job-uuid",
    "status": "queued",
    "queuePosition": 2
  }
}
```

---

### 3. Get Job Status (SSE)

**GET** `/api/job-status/:jobId`

Server-Sent Events endpoint for real-time job progress updates.

**Response Stream:**
```
data: {"type":"progress","progress":25,"timemark":"00:00:15","status":"processing"}

data: {"type":"progress","progress":50,"timemark":"00:00:30","status":"processing"}

data: {"type":"complete","progress":100,"status":"completed","result":{"outputKey":"output/...","fileName":"compressed-uuid.mp4","fileSize":10485760}}
```

**Event Types:**
- `progress` - Processing progress update
- `complete` - Job completed successfully
- `error` - Job failed

**Example (JavaScript):**
```javascript
const eventSource = new EventSource(`/api/job-status/${jobId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'progress') {
    console.log(`Progress: ${data.progress}%`);
  } else if (data.type === 'complete') {
    console.log('Job completed!', data.result);
    eventSource.close();
  } else if (data.type === 'error') {
    console.error('Job failed:', data.message);
    eventSource.close();
  }
};
```

---

### 4. Get Download URL

**GET** `/api/download-url/:jobId`

Generates a presigned download URL for a completed job.

**Response:**
```json
{
  "success": true,
  "message": "Download URL generated",
  "data": {
    "downloadUrl": "https://...signed-url...",
    "fileName": "compressed-uuid.mp4",
    "fileSize": 10485760,
    "expiresAt": "2024-01-01T12:05:00.000Z"
  }
}
```

**Usage:**
1. Once job is completed, call this endpoint
2. Use the `downloadUrl` to download the file directly from R2
3. Files are automatically cleaned up after 1 minute

---

### 5. Cleanup Job

**POST** `/api/cleanup/:jobId`

Manually cleanup job files from R2 and remove job from memory.

**Response:**
```json
{
  "success": true,
  "message": "Job cleaned up successfully",
  "data": {
    "jobId": "job-uuid",
    "deletedKeys": ["input/...", "output/..."]
  }
}
```

---

### 6. Analyze Media (Optional)

**POST** `/api/analyze`

Analyze media file metadata without processing.

**Request Body:**
```json
{
  "objectKey": "input/uuid/my-video.mp4"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Media analyzed",
  "data": {
    "duration": 120.5,
    "size": 52428800,
    "bitrate": 3500000,
    "video": {
      "codec": "h264",
      "resolution": "1920x1080",
      "frameRate": "30/1"
    },
    "audio": [
      {
        "index": 0,
        "codec": "aac",
        "channels": 2,
        "sampleRate": "48000",
        "bitrate": 128000
      }
    ]
  }
}
```

---

## Operation Options

### Extract Audio

**operationType:** `extract-audio`

```json
{
  "trackIndex": 0,
  "format": "mp3"
}
```

**Supported formats:** `mp3`, `wav`, `m4a`

---

### Audio Convert

**operationType:** `audio-convert`

```json
{
  "format": "mp3",
  "bitrate": "192k",
  "sampleRate": 44100
}
```

**Supported formats:** `mp3`, `wav`, `m4a`, `aac`, `ogg`, `flac`

---

### Audio Compress

**operationType:** `audio-compress`

```json
{
  "bitrate": "128k",
  "sampleRate": 44100,
  "channels": 2
}
```

**Supported bitrates:** `64k`, `96k`, `128k`, `192k`, `256k`, `320k`

---

### Video Compress

**operationType:** `video-compress`

```json
{
  "codec": "h264",
  "resolution": "720p",
  "videoBitrate": "2000k",
  "preset": "medium",
  "audioOption": "compress"
}
```

**Options:**
- **codec:** `h264`, `h265`
- **resolution:** `original`, `1080p`, `720p`, `480p`
- **videoBitrate:** `auto`, `800k`, `1200k`, `2000k`, `4000k`
- **preset:** `ultrafast`, `fast`, `medium`, `slow`
- **audioOption:** `keep`, `compress`, `remove`

---

## Complete Workflow Example

```javascript
// Step 1: Request upload URL
const uploadResponse = await fetch('/api/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'my-video.mp4',
    fileType: 'video/mp4',
    fileSize: file.size
  })
});
const { uploadUrl, objectKey } = (await uploadResponse.json()).data;

// Step 2: Upload file directly to R2
await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'video/mp4' },
  body: file
});

// Step 3: Start processing job
const jobResponse = await fetch('/api/start-job', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objectKey: objectKey,
    operationType: 'video-compress',
    options: {
      codec: 'h264',
      resolution: '720p'
    }
  })
});
const { jobId } = (await jobResponse.json()).data;

// Step 4: Monitor progress
const eventSource = new EventSource(`/api/job-status/${jobId}`);
eventSource.onmessage = async (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'complete') {
    eventSource.close();
    
    // Step 5: Get download URL
    const downloadResponse = await fetch(`/api/download-url/${jobId}`);
    const { downloadUrl } = (await downloadResponse.json()).data;
    
    // Step 6: Download file
    window.location.href = downloadUrl;
  }
};
```

---

## Environment Configuration

Required environment variables (`.env`):

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/av-utility

# JWT
JWT_SECRET=your-jwt-secret

# Cloudflare R2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=av-utility-media

# Job Configuration
MAX_CONCURRENT_JOBS=2
JOB_TIMEOUT_MINUTES=30

# Web Push (Optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## Cloudflare R2 Setup

### 1. Create R2 Bucket

```bash
# Via Cloudflare Dashboard:
# 1. Go to R2 Object Storage
# 2. Create bucket named: av-utility-media
# 3. Keep it private (no public access)
```

### 2. Create API Token

```bash
# Via Cloudflare Dashboard:
# 1. Go to R2 > Manage R2 API Tokens
# 2. Create API Token with:
#    - Permission: Object Read & Write
#    - Bucket: av-utility-media
# 3. Save Access Key ID and Secret Access Key
```

### 3. Configure CORS

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### 4. Configure Lifecycle Rules (Optional)

```json
{
  "Rules": [
    {
      "Expiration": { "Days": 1 },
      "ID": "DeleteOldUploads",
      "Prefix": "input/"
    },
    {
      "Expiration": { "Days": 1 },
      "ID": "DeleteOldOutputs",
      "Prefix": "output/"
    }
  ]
}
```

---

## Deployment to Firebase App Hosting

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 2. Initialize Firebase

```bash
firebase init hosting
```

### 3. Configure `firebase.json`

```json
{
  "hosting": {
    "source": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      }
    ]
  }
}
```

### 4. Deploy

```bash
# Set environment variables
firebase functions:config:set \
  r2.account_id="your-account-id" \
  r2.access_key="your-access-key" \
  r2.secret_key="your-secret-key" \
  r2.bucket="av-utility-media"

# Deploy
firebase deploy
```

---

## Cost Analysis

### Before (Multer-based)
- Firebase App Hosting bandwidth: **$0.15/GB**
- 100 users × 500MB = **$7.50/day** = **$225/month**

### After (R2-based)
- Cloudflare R2 bandwidth: **$0.00** (free egress)
- R2 storage: **$0.015/GB/month**
- R2 operations: **$4.50/million**
- **Total: ~$0.50/month** (99% cost reduction!)

---

## Troubleshooting

### Error: "Missing required R2 environment variables"

Make sure all R2 environment variables are set in `.env`:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

### Error: "Job queued" with long wait time

The system limits concurrent jobs to 2 by default. Increase `MAX_CONCURRENT_JOBS` if needed, but be careful with resource usage.

### Files not being cleaned up

Check that the cleanup utility is running:
- Logs should show "🧹 Initialized automatic job cleanup"
- Jobs auto-expire after 30 minutes (configurable via `JOB_TIMEOUT_MINUTES`)

---

## Migration from Old API

Old endpoints are deprecated but still available for backward compatibility:

| Old Endpoint | New Equivalent |
|--------------|----------------|
| `POST /api/video-compress/upload` | `POST /api/upload-url` + R2 upload |
| `POST /api/video-compress/compress` | `POST /api/start-job` |
| `GET /api/video-compress/download/:filename` | `GET /api/download-url/:jobId` |

Update your frontend to use the new workflow for zero bandwidth costs!

---

## Support

For issues or questions, check:
- Implementation plan: `implementation_plan.md`
- Task list: `task.md`
- Environment example: `.env.example`
