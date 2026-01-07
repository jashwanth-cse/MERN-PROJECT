# 🎬 AV Utility Platform

A modern, cloud-native audio/video processing platform built with React and Node.js, featuring direct Cloudflare R2 integration for cost-effective, scalable media processing.

## ✨ Features

### Audio Processing
- 🎵 **Extract Audio Tracks** - Extract multiple audio tracks from videos with batch processing
- 🔄 **Audio Format Conversion** - Convert between MP3, WAV, M4A, AAC, OGG, FLAC
- 🗜️ **Audio Compression** - Reduce file sizes with configurable bitrate settings

### Video Processing
- 📹 **Video Compression** - Compress videos with H.264/H.265 codecs
- 🎯 **Resolution Scaling** - Downscale to 1080p, 720p, or 480p
- 🔔 **Push Notifications** - Get notified when processing completes

### Platform Features
- ☁️ **Cloud-Native Architecture** - Direct browser-to-R2 uploads/downloads
- 📊 **Real-Time Progress** - Live FFmpeg progress via Server-Sent Events (SSE)
- 🚦 **Job Queue System** - Automatic queueing with position tracking
- 🔄 **Batch Processing** - Process multiple tracks/files sequentially
- 💾 **Zero Disk Usage** - Fully R2-based, no local file storage
- 🎨 **Modern UI** - Beautiful, responsive React interface

## 🏗️ Architecture

### Old Architecture (Multer-based) ❌
```
Browser → Backend (Upload) → Disk → FFmpeg → Disk → Backend → Browser (Download)
Cost: ~$18/month for 1000 videos
Bottleneck: Backend bandwidth, disk I/O
```

### New Architecture (R2-based) ✅
```
Browser → R2 (Direct Upload)
Backend → R2 (Download) → FFmpeg → R2 (Upload)
R2 → Browser (Direct Download)

Cost: ~$32/month for 1000 videos (with backend processing egress)
Benefits: 3x capacity on free tier, better scalability
```

## 🛠️ Tech Stack

### Frontend
- ⚛️ React 18
- 🎨 TailwindCSS (custom design system)
- 🔔 Web Push API
- 📡 Server-Sent Events (SSE)
- 📦 Vite

### Backend
- 🟢 Node.js + Express
- 🎬 FFmpeg (static binaries)
- ☁️ Cloudflare R2 (AWS S3-compatible)
- 🗄️ MongoDB
- 🔔 Web Push (VAPID)

### Infrastructure
- 🔥 Firebase App Hosting (Backend)
- 🔥 Firebase Hosting (Frontend)
- ☁️ Cloudflare R2 (Object Storage)

## 📦 Installation

### Prerequisites
- Node.js 18+
- MongoDB instance
- Cloudflare R2 account
- Firebase account (for deployment)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/av-utility-platform.git
cd av-utility-platform
```

2. **Install dependencies**

Frontend:
```bash
cd avutility
npm install
```

Backend:
```bash
cd server
npm install
```

3. **Configure Environment Variables**

Create `server/.env`:
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/avutility

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=av-utility-media
R2_PUBLIC_URL=https://your-r2-bucket.r2.dev

# Job Configuration
MAX_CONCURRENT_JOBS=2
JOB_TIMEOUT_MINUTES=30
SIGNED_URL_EXPIRY=300

# Web Push (Optional)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your@email.com

# Server
PORT=3000
```

Create `avutility/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

4. **Configure Cloudflare R2**

Follow the detailed setup guide: [`server/R2_SETUP_GUIDE.md`](./server/R2_SETUP_GUIDE.md)

## 🚀 Running Locally

### Development Mode

Terminal 1 (Backend):
```bash
cd server
npm run dev
# or
nodemon server.js
```

Terminal 2 (Frontend):
```bash
cd avutility
npm run dev
```

Access the app at `http://localhost:5173`

### Production Build

Frontend:
```bash
cd avutility
npm run build
```

Backend:
```bash
cd server
npm start
```

## 🧪 Testing

The project includes comprehensive testing tools:

```bash
cd server

# Test R2 service integration
node tests/test-r2-service.js

# Test API endpoints
node tests/test-api-endpoints.js

# Open interactive web test client
# Then navigate to: http://localhost:3000/tests/test-client.html
```

See [`server/TESTING_GUIDE.md`](./server/TESTING_GUIDE.md) for detailed testing instructions.

## 📚 API Documentation

Complete API documentation: [`server/API_DOCUMENTATION.md`](./server/API_DOCUMENTATION.md)

### Key Endpoints

- `POST /api/upload-url` - Generate signed upload URL
- `POST /api/start-job` - Start processing job
- `GET /api/job-status/:jobId` - SSE progress stream
- `GET /api/download-url/:jobId` - Generate signed download URL
- `POST /api/cleanup/:jobId` - Cleanup job files

## 🎯 Features in Detail

### Multi-Track Batch Extraction

Extract multiple audio tracks from a single video automatically:

1. Upload video → Analyze
2. Select multiple tracks (e.g., Track 1, 3, 5)
3. Click "Extract X Selected Tracks"
4. Watch automatic sequential processing
5. Download all files individually or batch download

### Queue System

When concurrent job limit is reached:
- Shows queue position (e.g., "Position #3")
- Displays estimated wait time
- Auto-starts when slot available
- Smooth transition from queued → processing

### On-Demand Download URLs

Download URLs are generated fresh on-click to prevent expiration:
- 5-minute expiry on signed URLs
- Regenerated when user clicks download
- No expiration possible
- Can wait hours between extraction and download

## 💰 Cost Analysis

### Firebase Free Tier Limits
- **Bandwidth**: 10 GiB/month
- **Capacity**: ~196 videos/month (100MB videos → 50MB outputs)

### R2 Free Tier
- **Storage**: 10 GB
- **Operations**: 1M Class A, 10M Class B per month
- **Egress**: 10 GB/month to internet (free within Cloudflare)

### Monthly Costs (Beyond Free Tier)
- R2 egress: $0.36/GB (backend processing)
- Firebase egress: $0.12/GB (output to R2)
- Total: ~$0.048 per 100MB video

### vs Old Architecture
- **Old**: 67 videos/month max (exceeded bandwidth at 10GB)
- **New**: 196 videos/month (3x capacity improvement)

## 🚀 Deployment

### Firebase Deployment

1. **Install Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
```

2. **Initialize Firebase**
```bash
firebase init
# Select: Hosting, App Hosting
```

3. **Deploy**
```bash
# Deploy frontend
cd avutility
npm run build
firebase deploy --only hosting

# Deploy backend
cd server
firebase deploy --only apphosting
```

See [`server/API_DOCUMENTATION.md#deployment`](./server/API_DOCUMENTATION.md#deployment) for detailed deployment guide.

## 🗂️ Project Structure

```
av-utility-platform/
├── avutility/              # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components (QueueStatus, etc.)
│   │   ├── hooks/          # Custom hooks (useR2Upload, useJobProcessing)
│   │   ├── pages/          # Page components
│   │   │   └── tools/      # Processing tools (ExtractAudio, CompressVideo, etc.)
│   │   └── utils/          # Utilities (r2ApiService, etc.)
│   └── public/
│
├── server/                 # Node.js backend
│   ├── controllers/        # Route handlers (mediaController, etc.)
│   ├── services/           # Business logic (r2Service, ffmpegService, jobService)
│   ├── routes/             # API routes
│   ├── utils/              # Utilities (pushService, cleanupUtil)
│   ├── tests/              # Test scripts and client
│   └── temp/               # Temporary FFmpeg processing (auto-cleaned)
│
├── .env.example            # Environment template
├── API_DOCUMENTATION.md    # Complete API docs
├── R2_SETUP_GUIDE.md       # R2 configuration guide
└── TESTING_GUIDE.md        # Testing instructions
```

## 🔒 Security

- ✅ Private R2 bucket (no public access)
- ✅ Short-lived signed URLs (5 min expiry)
- ✅ CORS configured for specific origins
- ✅ Input validation on all endpoints
- ✅ Job timeout limits (30 min default)
- ✅ Automatic cleanup of processed files

## 🛣️ Roadmap

- [ ] Cloudflare Workers migration (zero egress costs)
- [ ] User authentication and accounts
- [ ] File history and management
- [ ] Additional video formats (AVI, MKV, WebM)
- [ ] Thumbnail generation
- [ ] Video trimming/splitting
- [ ] Subtitle extraction
- [ ] Mobile app (React Native)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - Video/audio processing
- [Cloudflare R2](https://www.cloudflare.com/products/r2/) - Object storage
- [Firebase](https://firebase.google.com/) - Hosting and backend
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) - FFmpeg wrapper

## 📞 Support

For issues, questions, or feature requests:
- 🐛 [Open an issue](https://github.com/yourusername/av-utility-platform/issues)
- 💬 [Discussions](https://github.com/yourusername/av-utility-platform/discussions)

---

**Made with ❤️ using React, Node.js, and Cloudflare R2**
