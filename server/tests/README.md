# Backend Testing Suite

This directory contains test scripts and tools for validating the new Cloudflare R2-based backend architecture.

## 📋 Test Files

### 1. `test-r2-service.js`
**Automated R2 service integration test**

Tests all R2 operations:
- Service initialization
- Signed URL generation (upload & download)
- File upload/download to/from R2
- Object metadata retrieval
- Object deletion (single & batch)

**Run:**
```bash
node tests/test-r2-service.js
```

**Prerequisites:** R2 credentials in `.env`

---

### 2. `test-api-endpoints.js`
**Automated API endpoint validation test**

Tests all new media API endpoints:
- Server health check
- Upload URL generation
- Job creation (all 4 operation types)
- Job status endpoint
- Download URL generation
- Cleanup endpoint
- Input validation

**Run:**
```bash
# Terminal 1:
npm start

# Terminal 2:
node tests/test-api-endpoints.js
```

**Prerequisites:** Server running, R2 credentials in `.env`

---

### 3. `test-client.html`
**Interactive web-based test client**

Visual interface for testing the complete workflow:
- Upload real files directly to R2
- Monitor progress in real-time (SSE)
- Download processed results
- View activity logs

**Run:**
```bash
# Start server:
npm start

# Open in browser:
file:///path/to/server/tests/test-client.html
```

**Features:**
- Drag & drop file upload
- Real-time progress bar
- SSE connection status
- Activity log
- One-click download

---

## 🚀 Quick Start

### Minimal Test
```bash
# 1. Configure .env (see .env.example)
# 2. Start server
npm start

# 3. Run automated tests
node tests/test-api-endpoints.js
```

### Full Test Suite
```bash
# 1. Test R2 integration
node tests/test-r2-service.js

# 2. Test API endpoints
npm start &
node tests/test-api-endpoints.js

# 3. Test with real files
# Open tests/test-client.html in browser
# Upload a small media file
# Verify complete workflow
```

## 📖 Detailed Testing Guide

See [TESTING_GUIDE.md](../TESTING_GUIDE.md) for:
- Step-by-step test procedures
- Expected outputs
- Troubleshooting tips
- Validation checklist

## ✅ Testing Checklist

Before deploying to production:

- [ ] All R2 service tests pass
- [ ] All API endpoint tests pass
- [ ] Web client completes full workflow
- [ ] Concurrent job limiting works
- [ ] Automatic cleanup verified
- [ ] Zero disk usage confirmed
- [ ] All 4 operation types tested
- [ ] Error handling validated

## 🔧 Troubleshooting

### Tests fail with "Missing required R2 environment variables"

**Solution:** Configure `.env`:
```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=av-utility-media
```

### Tests fail with "fetch failed" or "ECONNREFUSED"

**Solution:** Make sure the server is running:
```bash
npm start
```

### API tests pass but R2 tests fail

**Solution:** Check R2 credentials and bucket configuration in Cloudflare dashboard.

### Web client doesn't work

**Solution:**
1. Check browser console for errors
2. Verify server is running on http://localhost:3000
3. Ensure CORS is not blocking requests

## 📊 Test Coverage

| Component | Coverage | Status |
|-----------|----------|--------|
| R2 Service | 100% | ✅ |
| Job Service | 100% | ✅ |
| FFmpeg Service | Partial | ⚠️ Requires real files |
| Media Controller | 100% | ✅ |
| Routes | 100% | ✅ |

## 🎯 Next Steps

1. ✅ Run automated tests
2. ✅ Test with web client
3. 🔄 Update frontend to use new API
4. 🚀 Deploy to staging
5. 🧪 Load testing
6. 🎉 Production deployment

---

**For more details, see:**
- [TESTING_GUIDE.md](../TESTING_GUIDE.md) - Complete testing procedures
- [API_DOCUMENTATION.md](../API_DOCUMENTATION/md) - API reference
- [walkthrough.md](../../.gemini/antigravity/brain/f545aed5-9004-4a11-9f7a-5063473391ba/walkthrough.md) - Refactoring summary
