# AV Utility Platform - Complete Project Summary

## 1. Project Overview

### Purpose
The AV Utility Platform is a web-based audio/video processing application designed to provide users with professional-grade media manipulation tools through an intuitive interface. It enables users to extract audio from videos, convert audio formats, and perform other media processing tasks without requiring desktop software or technical expertise.

### Problem It Solves
- **Eliminates Software Installation**: Users can process media files directly in their browser without downloading heavy desktop applications
- **Centralized Media Processing**: Provides multiple audio/video tools in one unified platform
- **Professional Quality**: Leverages FFmpeg's industry-standard media processing capabilities
- **Secure Processing**: Automatically deletes uploaded and processed files to protect user privacy
- **Cross-Platform Access**: Works on any device with a modern web browser

### Target Users
- Content creators needing quick audio extraction from videos
- Audio engineers requiring format conversion
- Video editors working with separate audio tracks
- Casual users wanting to convert media files without technical knowledge
- Anyone requiring temporary, secure media processing

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  React Frontend (Vite + TailwindCSS)                │  │
│  │  - Authentication UI (Login/Signup)                  │  │
│  │  - Dashboard with Tool Selection                     │  │
│  │  - File Upload Interface                             │  │
│  │  - Real-time Progress Display (SSE)                  │  │
│  │  - Download Management                               │  │
│  └──────────────────┬──────────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────────┘
                      │ HTTP/HTTPS + SSE
                      │ (Axios API Calls)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Node.js Express Backend Server                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Routes → Controllers → FFmpeg Processing           │  │
│  │  - Authentication (JWT)                              │  │
│  │  - File Upload (Multer)                              │  │
│  │  - Media Processing (fluent-ffmpeg)                  │  │
│  │  - Progress Streaming (Server-Sent Events)           │  │
│  │  - File Cleanup (Scheduled Tasks)                    │  │
│  └──────────────────┬─────────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data Storage Layer                        │
│  ┌──────────────────┐         ┌──────────────────────┐    │
│  │   MongoDB        │         │  Local File System   │    │
│  │  (User Data)     │         │  (Temporary Media)   │    │
│  │  - Credentials   │         │  /uploads/temp       │    │
│  │  - Profiles      │         │  /uploads/audio      │    │
│  └──────────────────┘         │  /uploads/output     │    │
│                                │  /uploads/extracted  │    │
│                                └──────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Data Flow

### User Authentication Flow

**Step 1: User Registration**
1. User fills registration form (name, email, password) in `Signup.jsx`
2. Frontend validates input fields
3. `axios.post()` sends credentials to `/api/auth/register`
4. Backend `authController.registerUser()` receives request
5. Controller checks if email already exists in MongoDB
6. Password is hashed using bcrypt (12 salt rounds)
7. New user document created in MongoDB `users` collection
8. JWT token generated (7-day expiration) containing user ID and email
9. Response sent back with token and user object
10. Frontend stores token and user data in `localStorage`
11. User automatically redirected to `/dashboard`

**Step 2: User Login**
1. User enters email and password in `Login.jsx`
2. Frontend validates non-empty fields
3. Request sent to `/api/auth/login`
4. Backend `authController.loginUser()` finds user by email
5. Bcrypt compares provided password with stored hash
6. If valid, new JWT token generated
7. Token and user object returned to frontend
8. Data stored in localStorage via `setAuthData()`
9. User redirected to dashboard

**Step 3: Protected Route Access**
1. When accessing `/dashboard`, `ProtectedRoute.jsx` wrapper executes
2. Checks localStorage for valid token using `isAuthenticated()`
3. If no token found, user redirected to login page
4. If token exists, dashboard component renders
5. Dashboard retrieves user info from localStorage using `getUser()`
6. User profile displayed in sidebar

### Media Processing Flow (Extract Audio Example)

**Upload Phase:**
1. User selects "Extract Audio" tool from sidebar
2. Dashboard renders `ExtractAudio.jsx` component
3. User clicks "Select Video File" button
4. File input element `<input type="file">` triggered
5. User selects video file (MP4, MOV, AVI, MKV, WEBM)
6. Frontend validates file size and extension
7. FormData object created with selected file
8. `axios.post('/api/extract-audio/upload')` called with multipart/form-data
9. Backend receives request at `extractAudioRoutes.js`
10. Multer middleware processes file upload:
    - Validates file extension against `SUPPORTED_VIDEO_FORMATS`
    - Checks file size (max 500MB)
    - Generates unique filename: `originalName-timestamp-random.ext`
    - Saves to `server/uploads/temp/` directory
11. `uploadVideo()` controller returns file metadata (path, size, name)
12. Frontend stores `inputFilePath` in component state

**Analysis Phase:**
1. Frontend automatically sends `inputFilePath` to `/api/extract-audio/detect-tracks`
2. Backend `detectAudioTracks()` controller executes
3. `ffmpeg.ffprobe()` analyzes video file metadata:
    - Reads all streams (video, audio, subtitle)
    - Filters only audio streams
    - Extracts codec, channels, bitrate, language for each track
4. Audio track list returned to frontend as JSON array
5. Frontend renders track selection UI with radio buttons
6. User selects desired audio track and output format (MP3, WAV, M4A)

**Extraction Phase:**
1. User clicks "Extract Audio" button
2. Frontend sends POST to `/api/extract-audio/extract` with:
    - `inputFilePath`: Path to uploaded video
    - `trackIndex`: Selected audio stream index
    - `format`: Desired output format
3. Backend `extractAudioWithProgress()` initiates Server-Sent Events (SSE)
4. Response headers set for SSE streaming:
    ```
    Content-Type: text/event-stream
    Cache-Control: no-cache
    Connection: keep-alive
    ```
5. FFprobe analyzes video to get duration for progress calculation
6. FFmpeg command constructed:
    ```
    ffmpeg -i inputFile.mp4 -map 0:trackIndex -vn -acodec libmp3lame output.mp3
    ```
7. FFmpeg processing begins with event handlers:
    - **'start'**: Sends progress: 0%
    - **'progress'**: Parses timemark, calculates percentage, sends update every frame
    - **'end'**: Generates download URL, sends completion event
    - **'error'**: Cleans up partial files, sends error event
8. Frontend EventSource listener receives real-time updates
9. Progress bar and status text updated in real-time
10. When complete, download button appears

**Download Phase:**
1. User clicks "Download" button
2. Frontend opens `/api/extract-audio/download/:filename` in new window
3. Backend `downloadExtractedAudio()` controller:
    - Verifies file exists in `/uploads/output/`
    - Sets headers: `Content-Type: audio/mpeg`, `Content-Disposition: attachment`
    - Creates read stream from file
    - Pipes stream to HTTP response
4. Browser receives file stream and triggers download
5. After stream completes, backend deletes file with `fs.unlink()`
6. Original uploaded video also deleted

**Cleanup Phase:**
1. `cleanupUtil.js` runs scheduled cleanup every 30 minutes
2. Scans all upload directories:
    - `/uploads/temp` (30-minute retention)
    - `/uploads/audio` (60-minute retention)
    - `/uploads/output` (60-minute retention)
    - `/uploads/extracted` (60-minute retention)
3. For each file, checks `stats.mtimeMs` (last modified time)
4. If file age exceeds retention period, `fs.unlink()` deletes it
5. Skips directories using `stats.isDirectory()` check
6. Logs all deletions to console

### Audio Conversion Flow (Similar Pattern)

**Upload → Analyze → Convert → Download → Cleanup**

1. User uploads audio file via `/api/audio-convert/upload`
2. Multer saves to `/uploads/audio/temp/`
3. FFprobe analyzes audio metadata (codec, sample rate, bitrate)
4. User selects target format and bitrate settings
5. SSE-based conversion initiated via `/api/audio-convert/convert`
6. FFmpeg transcodes audio with real-time progress
7. Converted file saved to `/uploads/audio/output/`
8. User downloads file, backend deletes both input and output files
9. Scheduled cleanup removes any orphaned files

---

## 3. Frontend (React)

### Folder Structure

```
avutility/src/
├── components/          # Reusable UI components
│   ├── Login.jsx            # Login form with animated waveform background
│   ├── Signup.jsx           # Registration form
│   ├── ProtectedRoute.jsx   # Route guard for authentication
│   ├── Sidebar.jsx          # Navigation sidebar with tool categories
│   ├── MainPanel.jsx        # Default upload area (unused in current flow)
│   ├── WaveformHeader.jsx   # Animated header with tool title
│   └── AnimatedWaveform.jsx # SVG waveform animation using requestAnimationFrame
│
├── pages/              # Page-level components
│   ├── Dashboard.jsx        # Main dashboard container, routes to tools
│   ├── DonateUs.jsx         # Donation/support information page
│   └── tools/               # Individual tool components
│       ├── ExtractAudio.jsx     # Full implementation: upload, detect, extract, download
│       ├── ConvertAudio.jsx     # Full implementation: upload, analyze, convert, download
│       ├── CompressAudio.jsx    # Placeholder UI only
│       ├── AudioPresets.jsx     # Placeholder UI only
│       ├── ConvertVideo.jsx     # Placeholder UI only
│       ├── CompressVideo.jsx    # Placeholder UI only
│       └── MergeAV.jsx          # Placeholder UI only
│
├── utils/              # Helper functions
│   └── auth.js              # Authentication utilities (localStorage management)
│
├── App.jsx             # Root component, routing configuration
├── main.jsx            # React entry point, ToastContainer setup
└── index.css           # Global styles, Tailwind directives
```

### Key Pages and Components

**`App.jsx`** - Application Router
- Configures React Router with 3 routes: `/` (landing), `/dashboard`, `*` (404 redirect)
- Implements `<AuthPage>` wrapper that redirects authenticated users to dashboard
- Toggle button to switch between Login/Signup forms
- Catch-all route redirects unknown paths to home

**`Login.jsx`** - Authentication Form
- State management for email, password, loading, and animation
- Focus/blur handlers trigger waveform animation intensity changes
- Typing speed detection adjusts animation responsiveness
- Axios POST to `/api/auth/login`
- On success: saves token + user to localStorage, shows toast, navigates to dashboard
- On error: displays toast with error message
- Tailwind classes for responsive design and focus states

**`Dashboard.jsx`** - Main Application Container
- Retrieves user from localStorage on mount
- Manages `selectedTool` state to switch between tool components
- Renders `<Sidebar>` with active tool highlighting
- Renders `<WaveformHeader>` with dynamic title/subtitle
- Switch statement renders appropriate tool component
- Mobile menu overlay for responsive sidebar
- Background blur effects for visual depth

**`Sidebar.jsx`** - Navigation Panel
- Tool categorization: Audio Tools (4), Video Tools (3)
- Active tool highlighting with border, background, and glow effect
- User profile display with initials avatar
- Logout button triggers `clearAuthData()` and redirects
- Donate button navigates to support page
- Responsive: fixed overlay on mobile, always visible on desktop

**`ExtractAudio.jsx`** - Fully Implemented Tool (933 lines)
- **State Variables**: 11 different states including file, tracks, progress, errors
- **Upload Section**: File input, drag-drop, validation, FormData upload
- **Track Detection**: Automatic after upload, displays all audio streams
- **Track Selection**: Radio buttons for each track, format dropdown
- **Extraction**: SSE connection for real-time progress, abort controller
- **Progress Display**: Circular progress ring, percentage, current/total time
- **Download**: Triggers after completion, cleanup after download
- **Error Handling**: Toast notifications for all error states
- **UI States**: Idle → Uploading → Detecting → Extracting → Complete

**`ConvertAudio.jsx`** - Fully Implemented Tool (854 lines)
- Similar architecture to ExtractAudio
- Adds metadata analysis step showing codec, bitrate, channels
- Bitrate selection slider (128k - 320k)
- Format options: MP3, WAV, FLAC, AAC, OGG, M4A
- SSE-based real-time conversion progress
- Same upload → analyze → convert → download flow

**Placeholder Tools** (CompressAudio, AudioPresets, ConvertVideo, CompressVideo, MergeAV)
- Static UI showing feature description
- "Select File" and "Import URL" buttons (non-functional)
- Brand-consistent styling with hover effects
- Status footer showing system operational status

### State Management Approach

**No Global State Library**
- Uses React's built-in `useState` and `useEffect` hooks
- Local component state for file data, progress, UI states
- localStorage for persistent authentication (token, user object)
- Props passed down from Dashboard to child components
- Event handlers lifted up via callback props

**Authentication State:**
```javascript
// Stored in localStorage
{
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user: {
    id: "67891234abcd5678",
    name: "John Doe",
    email: "john@example.com"
  }
}
```

**Component State Example (ExtractAudio):**
```javascript
const [selectedFile, setSelectedFile] = useState(null);
const [inputFilePath, setInputFilePath] = useState('');
const [audioTracks, setAudioTracks] = useState([]);
const [selectedTrack, setSelectedTrack] = useState(null);
const [outputFormat, setOutputFormat] = useState('mp3');
const [isUploading, setIsUploading] = useState(false);
const [isDetecting, setIsDetecting] = useState(false);
const [isExtracting, setIsExtracting] = useState(false);
const [progress, setProgress] = useState(0);
const [downloadUrl, setDownloadUrl] = useState('');
const [extractionComplete, setExtractionComplete] = useState(false);
const [error, setError] = useState('');
```

### API Call Flow

**Pattern: Axios with Async/Await**

```javascript
// Example from ExtractAudio.jsx
const handleUpload = async () => {
    const formData = new FormData();
    formData.append('video', selectedFile);
    
    try {
        const response = await axios.post(
            'http://localhost:3000/api/extract-audio/upload',
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        
        if (response.data.success) {
            setInputFilePath(response.data.data.inputFilePath);
            // Proceed to detect tracks
        }
    } catch (error) {
        toast.error(error.response?.data?.message || 'Upload failed');
    }
    
};
```

**SSE (Server-Sent Events) Pattern:**

```javascript
const eventSource = new EventSource(
    `http://localhost:3000/api/extract-audio/extract?inputFilePath=${path}&...`
);

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'progress') {
        setProgress(data.progress);
    } else if (data.type === 'complete') {
        setDownloadUrl(data.data.downloadUrl);
        eventSource.close();
    } else if (data.type === 'error') {
        toast.error(data.error);
        eventSource.close();
    }
};
```

### User Input Handling and Validation

**File Input Validation:**
- Frontend checks file extension against allowed list
- File size validated (client-side warning, server enforces 500MB limit)
- MIME type verification
- Empty file rejection

**Form Validation (Login/Signup):**
- Email regex validation: `/^\S+@\S+\.\S+$/`
- Password minimum length: 6 characters
- Required field checks before submission
- Real-time validation on blur events

**Track Selection:**
- Radio button ensures only one track selected
- Format dropdown restricted to supported formats
- Extraction button disabled until valid selection made

### Loading States and UI Feedback

**Loading Indicators:**
- Button text changes: "Upload" → "Uploading..."
- Spinner icons during processing
- Disabled buttons prevent duplicate submissions
- Skeleton loaders during data fetching

**Progress Visualization:**
- Circular progress ring with animated SVG stroke
- Percentage display (0-100%)
- Time indicators (current/total seconds)
- Status text changes: "Processing..." → "Extracting..." → "Complete!"

**Toast Notifications:**
- Success: Green toast with checkmark
- Error: Red toast with error icon
- Info: Blue toast for informational messages
- Auto-dismiss after 3 seconds
- Positioned top-right, stacking enabled

### Error Handling

**Network Errors:**
- Axios interceptors catch connection failures
- Toast notification with user-friendly message
- Retry button for failed uploads
- Timeout handling (30s default)

**Validation Errors:**
- Backend error messages displayed in toasts
- Form field highlighting for invalid inputs
- Inline error text below inputs

**Processing Errors:**
- SSE error events caught and displayed
- Partial file cleanup on backend
- Reset button to start over
- Error logs preserved in console for debugging

---

## 4. Backend (Node.js/Express)

### Server Entry Point

**`server.js`** - Main Application File (110 lines)
- Loads environment variables from `.env` file (MongoDB URI, JWT secret, port)
- Initializes Express app instance
- Connects to MongoDB via `connectDB()` from `config/db.js`
- Configures middleware:
  - CORS: Allows `localhost:5173` and `localhost:5174` (Vite dev servers)
  - `express.json()`: Parses JSON request bodies
  - `express.urlencoded()`: Parses URL-encoded bodies
  - Request logger: Logs method and URL for every request
- Mounts route modules:
  - `/api/auth` → authRoutes
  - `/api/extract-audio` → extractAudioRoutes
  - `/api/audio-convert` → audioConvertRoutes
- Error handling middleware:
  - Multer-specific errors (file size, format validation)
  - General error handler with stack trace in development mode
- Starts server on port 3000 (or env PORT)
- Initializes automated file cleanup on server start

### Architecture Pattern: MVC (Model-View-Controller)

**Models:** Define data schemas (MongoDB/Mongoose)
**Routes:** Define API endpoints and map to controllers
**Controllers:** Contain business logic and process requests
**Middlewares:** Handle authentication, validation, file uploads
**Utils:** Reusable helper functions (FFmpeg config, Multer setup, cleanup)

### Routes

**`routes/auth.js`** - Authentication Routes
- `POST /api/auth/register` → `registerUser()` controller
- `POST /api/auth/login` → `loginUser()` controller
- No authentication middleware required (public endpoints)

**`routes/extractAudioRoutes.js`** - Audio Extraction Routes
- `POST /api/extract-audio/upload` → Multer middleware → `uploadVideo()` controller
- `POST /api/extract-audio/detect-tracks` → `detectAudioTracks()` controller
- `POST /api/extract-audio/extract` → `extractAudioWithProgress()` controller (SSE)
- `GET /api/extract-audio/download/:filename` → `downloadExtractedAudio()` controller

**`routes/audioConvertRoutes.js`** - Audio Conversion Routes
- `POST /api/audio-convert/upload` → Multer middleware → `uploadAudioFile()` controller
- `POST /api/audio-convert/analyze` → `analyzeAudioMetadata()` controller
- `POST /api/audio-convert/convert` → `convertAudioWithProgress()` controller (SSE)
- `GET /api/audio-convert/download/:filename` → `downloadConvertedAudio()` controller

### Controllers

**`controllers/authController.js`** - User Authentication (131 lines)

**`registerUser()` Function:**
1. Extracts name, email, password from request body
2. Validates all fields are present (400 if missing)
3. Queries MongoDB for existing user with same email
4. Returns 409 Conflict if email already registered
5. Hashes password with bcrypt (salt rounds: 12)
6. Creates new user document in MongoDB
7. Generates JWT token with 7-day expiration
8. Returns token and user object (without password)

**`loginUser()` Function:**
1. Extracts email and password from request body
2. Validates both fields present
3. Finds user by email in MongoDB
4. Returns 404 if user not found
5. Compares provided password with stored hash using `bcrypt.compare()`
6. Returns 401 if password invalid
7. Generates new JWT token
8. Returns token and user object

**`controllers/extractAudioController.js`** - Video Processing (363 lines)

**`uploadVideo()` Function:**
- Multer has already saved file to disk
- Retrieves file metadata from `req.file` object
- Logs file details (name, size, path)
- Returns JSON with `inputFilePath` for next step

**`detectAudioTracks()` Function:**
- Receives `inputFilePath` from request body
- Verifies file exists using `fs.existsSync()`
- Calls `ffmpeg.ffprobe()` to read media metadata
- Filters `metadata.streams` array for `codec_type === 'audio'`
- Extracts for each audio stream:
  - Stream index
  - Codec name
  - Language tag
  - Channel count and layout
  - Sample rate
  - Bitrate
  - Duration
- Returns array of audio track objects

**`extractAudioTrack()` Function (Non-SSE version, 143 lines):**
- Validates `inputFilePath`, `trackIndex`, `format` parameters
- Checks format against supported list (mp3, wav, m4a)
- Verifies input file exists
- Creates output directory if needed
- Generates unique output filename
- Constructs FFmpeg command:
  ```javascript
  ffmpeg(inputFilePath)
      .outputOptions([
          `-map 0:a:${trackIndex}`,  // Select audio track
          '-vn',                      // No video
          '-ar 44100',                // Sample rate
          '-ac 2',                    // Stereo channels
          '-b:a 192k'                 // Bitrate
      ])
      .output(outputFilePath)
      .on('end', () => { /* Success handler */ })
      .on('error', (err) => { /* Error handler */ })
      .run();
  ```
- On completion: generates download URL, deletes input video
- On error: cleans up partial output, deletes input video

**`downloadExtractedAudio()` Function:**
- Extracts filename from URL parameters
- Constructs full file path
- Validates file exists
- Sets response headers for download:
  - `Content-Type: audio/mpeg`
  - `Content-Disposition: attachment; filename="..."`
- Creates read stream from file
- Pipes stream to response
- Deletes file after stream ends

**`controllers/extractAudioProgressController.js`** - SSE-Based Extraction (217 lines)

**`extractAudioWithProgress()` Function:**
- Sets SSE headers on response object
- Calls `ffmpeg.ffprobe()` to get audio duration
- Finds selected audio stream in metadata
- Handles multiple duration fallbacks (stream duration, tags, format duration)
- Parses duration if in HH:MM:SS format
- Selects appropriate audio codec based on output format:
  - MP3 → libmp3lame
  - WAV → pcm_s16le
  - M4A/AAC → aac
- Constructs FFmpeg command with specific stream mapping
- Attaches event handlers:
  - **'start'**: Sends `data: {"type":"start","progress":0}` via SSE
  - **'progress'**: Parses timemark, calculates percentage, sends update
  - **'end'**: Sends complete event with download URL
  - **'error'**: Sends error event, cleans up files
- All SSE messages formatted as `data: JSON\n\n`
- Response kept open until processing completes

**`controllers/audioConvertController.js`** - Audio Format Conversion (385 lines)

Similar structure to extractAudioController with these differences:
- Accepts audio files instead of videos
- Uses `audioMulterConfig` for file validation
- Analyzes audio metadata (codec, bitrate, channels)
- Supports more output formats (MP3, WAV, FLAC, AAC, OGG, M4A)
- Allows custom bitrate selection
- Format-specific FFmpeg options for each codec

**`controllers/audioConvertProgressController.js`** - SSE Audio Conversion (180 lines)
- Identical SSE pattern to extractAudioProgressController
- Tailored for audio-to-audio conversion
- In-memory map tracking active conversions

### Media/File Handling Workflow

**Upload Process (Multer):**
1. Client sends multipart/form-data request
2. Multer middleware intercepts request
3. `fileFilter` function validates file extension
4. `storage` engine generates unique filename
5. File written to disk in chunks
6. File size checked against 500MB limit
7. On success: `req.file` object populated with metadata
8. On failure: Error thrown before controller executes

**Processing Pipeline:**
```
Upload → Detect/Analyze → User Selection → Process (SSE) → Download → Cleanup
```

**FFmpeg Command Construction:**
- Input file validated for existence
- Output directory created if missing
- Unique output filename generated (timestamp + random)
- Command options built as array:
  ```javascript
  ['-map 0:a:1', '-vn', '-ar 44100', '-ac 2', '-b:a 192k']
  ```
- Output path specified
- Event listeners attached
- `.run()` executes command

**Stream Processing:**
- FFmpeg runs as child process
- stdout/stderr captured for progress parsing
- Progress events emitted multiple times per second
- Timemark converted to seconds for percentage calculation
- SSE messages sent immediately to frontend

### Temporary Storage and Cleanup Logic

**Storage Structure:**
```
server/uploads/
├── temp/              # Uploaded videos (30-min retention)
├── audio/
│   ├── temp/          # Uploaded audio files (30-min retention)
│   └── output/        # Converted audio files (60-min retention)
├── output/            # Extracted audio from videos (60-min retention)
└── extracted/         # Alternative extraction output (60-min retention)
```

**`utils/cleanupUtil.js`** - Automated File Cleanup (110 lines)

**`deleteFile()` Function:**
- Checks if file exists
- Calls `fs.unlink()` asynchronously
- Logs success/failure

**`cleanOldFiles()` Function:**
- Accepts directory path and max age in minutes
- Reads directory contents with `fs.readdir()`
- For each item:
  - Checks if it's a directory (skips if true)
  - Gets file stats with `fs.stat()`
  - Calculates age: `now - stats.mtimeMs`
  - Deletes if age exceeds threshold
- Handles errors gracefully with logging

**`cleanAllUploadDirectories()` Function:**
- Defines array of directories with retention policies
- Calls `cleanOldFiles()` for each directory
- Executed every 30 minutes via `setInterval()`

**`initializeCleanup()` Function:**
- Called on server startup
- Runs cleanup immediately
- Schedules recurring cleanup every 30 minutes

**Cleanup Triggers:**
1. **Immediate**: After successful download (manual deletion)
2. **Immediate**: On processing error (cleanup partial files)
3. **Scheduled**: Every 30 minutes (catches orphaned files)

### Authentication and Authorization

**JWT Token Structure:**
```javascript
{
  header: { alg: "HS256", typ: "JWT" },
  payload: {
    id: "user_mongodb_id",
    email: "user@example.com",
    iat: 1703174400,  // Issued at timestamp
    exp: 1703779200   // Expiration (7 days later)
  },
  signature: "..."
}
```

**Token Generation:**
```javascript
jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
);
```

**`middlewares/authMiddleware.js`** - Token Validation (32 lines)
- Extracts `Authorization` header from request
- Returns 401 if header missing
- Strips "Bearer " prefix if present
- Calls `jwt.verify()` with secret
- On success: attaches `req.user` object with decoded payload
- On failure: returns 400 with "Invalid or expired token" message

**Current Implementation:**
- Authentication middleware defined but **NOT CURRENTLY USED**
- All processing endpoints are public (no auth required)
- Only login/register endpoints implemented with JWT
- Future implementation would add `authMiddleware` to route definitions:
  ```javascript
  router.post('/upload', authMiddleware, upload.single('video'), uploadVideo);
  ```

### Error Handling Strategy

**Layered Error Handling:**

1. **Validation Layer (Controller Level):**
   - Check required parameters
   - Validate file existence
   - Verify format support
   - Return 400 Bad Request with descriptive message

2. **Processing Layer (FFmpeg Events):**
   - Catch FFmpeg errors in `.on('error')` handler
   - Clean up partial files
   - Send error via SSE or JSON response
   - Return 500 Internal Server Error

3. **Middleware Layer:**
   - Multer error handler catches upload failures
   - General error handler catches uncaught exceptions
   - Stack trace included in development mode only

4. **Database Layer:**
   - Try/catch blocks around Mongoose operations
   - Specific handling for duplicate key errors (409)
   - Connection failures logged to console

**Error Response Format:**
```javascript
{
    success: false,
    message: "User-friendly error description",
    error: "Technical error details"  // Only in development
}
```

**Async Error Handling Pattern:**
```javascript
try {
    const result = await someAsyncOperation();
    res.json({ success: true, data: result });
} catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({
        success: false,
        message: 'Operation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
}
```

---

## 5. Packages & Dependencies

### Frontend Dependencies (`avutility/package.json`)

**Core Framework:**
- **`react@19.2.0`**: UI library for building component-based interface
- **`react-dom@19.2.0`**: React renderer for web browsers
- **`vite@7.2.4`**: Build tool and development server (fast hot module replacement)

**HTTP & Routing:**
- **`axios@1.13.2`**: HTTP client for API requests (used in all tool components)
- **`react-router-dom@7.11.0`**: Client-side routing (App.jsx route definitions)

**Styling:**
- **`tailwindcss@4.1.18`**: Utility-first CSS framework (all component styling)
- **`@tailwindcss/vite@4.1.18`**: Vite plugin for Tailwind integration
- **`@tailwindcss/postcss@4.1.18`**: PostCSS plugin for Tailwind processing
- **`autoprefixer@10.4.23`**: Adds vendor prefixes to CSS
- **`postcss@8.5.6`**: CSS transformation tool

**UI Feedback:**
- **`react-toastify@11.0.5`**: Toast notification system (all user feedback)
  - Used in: Login, Signup, ExtractAudio, ConvertAudio, Sidebar

**Development Tools:**
- **`eslint@9.39.2`**: JavaScript linter
- **`@eslint/js@9.39.2`**: ESLint core rules
- **`eslint-plugin-react@7.37.5`**: React-specific linting rules
- **`eslint-plugin-react-hooks@7.0.1`**: Hooks rules enforcement
- **`eslint-plugin-react-refresh@0.4.24`**: Fast refresh compatibility
- **`@vitejs/plugin-react@5.1.1`**: Vite plugin for React support
- **`@types/react@19.2.5`**: TypeScript type definitions for React
- **`@types/react-dom@19.2.3`**: TypeScript type definitions for ReactDOM
- **`globals@16.5.0`**: Global variable definitions for linting

### Backend Dependencies (`server/package.json`)

**Core Framework:**
- **`express@5.2.1`**: Web application framework
  - Used in: server.js (main app), all route files

**Database:**
- **`mongoose@9.0.2`**: MongoDB object modeling library
  - Used in: config/db.js, models/User.js, authController.js

**Authentication:**
- **`bcrypt@6.0.0`**: Password hashing library (12 salt rounds)
  - Used in: authController.js (registerUser, loginUser)
- **`jsonwebtoken@9.0.3`**: JWT token generation and verification
  - Used in: authController.js, middlewares/authMiddleware.js

**Media Processing:**
- **`fluent-ffmpeg@2.1.3`**: Node.js FFmpeg wrapper library
  - Used in: All processing controllers, utils/ffmpegConfig.js
- **`@ffmpeg-installer/ffmpeg@1.1.0`**: FFmpeg binary installer
  - Used in: utils/ffmpegConfig.js (provides binary path)
- **`@ffprobe-installer/ffprobe@2.1.2`**: FFprobe binary installer
  - Used in: utils/ffmpegConfig.js (provides binary path)

**File Handling:**
- **`multer@2.0.2`**: Multipart/form-data file upload middleware
  - Used in: utils/multerConfig.js, utils/audioMulterConfig.js

**Utilities:**
- **`dotenv@17.2.3`**: Environment variable loader
  - Used in: server.js (loads .env file contents)
- **`cors@2.8.5`**: Cross-Origin Resource Sharing middleware
  - Used in: server.js (allows frontend requests)

**Dependencies Summary:**
- Total Frontend: 29 packages (7 runtime, 22 dev dependencies)
- Total Backend: 10 packages (all runtime)
- No shared dependencies (separate package management)

---

## 6. Data Storage & Security

### Temporary File Storage Mechanism

**Storage Model: Ephemeral Disk Storage**
- Files stored on server's local filesystem (not cloud)
- Organized in predefined directory structure
- Automatic cleanup based on file age
- No permanent storage—all files are temporary

**File Lifecycle:**
```
Upload (0 min) → Processing (0-5 min) → Download (immediate) → Deletion (0-60 min)
```

**Directory Permissions:**
- Created with `recursive: true` flag to ensure parent directories exist
- Default Node.js file permissions (typically 644 for files, 755 for directories)
- No special access controls—relies on server security

**File Naming Convention:**
```
[originalNameWithoutExt]-[timestamp]-[random9digits].[extension]
Example: myvideo-1703174523-847362910.mp4
```

**Uniqueness Guarantee:**
- Timestamp ensures chronological ordering
- Random number prevents collisions
- Combined probability of collision: effectively zero

### Database Usage

**MongoDB Collections:**

**`users` Collection:**
```javascript
{
    _id: ObjectId("..."),
    name: "John Doe",
    email: "john@example.com",  // Unique index
    password: "$2b$12$hashed_password_string",
    createdAt: ISODate("2024-01-01T00:00:00.000Z"),
    updatedAt: ISODate("2024-01-01T00:00:00.000Z")
}
```

**Schema Validation:**
- `name`: Required, trimmed string
- `email`: Required, unique, lowercase, regex validated
- `password`: Required, minimum 6 characters (stored as bcrypt hash)
- Automatic timestamps via Mongoose `{ timestamps: true }`

**Indexes:**
- Unique index on `email` field (enforced by MongoDB)
- Default `_id` index for primary key lookups

**No Media Metadata Storage:**
- File paths not stored in database
- No processing history tracked
- No user-file relationships persisted
- Completely stateless media processing

### Data Write, Read, and Delete Flow

**User Data (MongoDB):**

**Write:**
1. Client sends registration/login request
2. Controller validates input
3. For registration: password hashed, new document inserted
4. For login: existing document queried by email
5. Mongoose validates schema before writing
6. MongoDB returns inserted document with `_id`

**Read:**
1. Frontend requests only during authentication
2. Query by email: `User.findOne({ email })`
3. No pagination needed (single document)
4. Password hash included in query, compared with bcrypt

**Delete:**
- Currently no user deletion implemented
- Would require: `User.findByIdAndDelete(userId)`

**File Data (Filesystem):**

**Write:**
1. Multer receives multipart upload stream
2. Writes file to disk in chunks (stream-based)
3. File handle closed when upload complete
4. Metadata stored in `req.file` object (in-memory only)

**Read:**
1. FFmpeg reads input file path for processing
2. Download endpoint creates read stream: `fs.createReadStream(filePath)`
3. Stream piped directly to HTTP response
4. No buffering in memory (efficient for large files)

**Delete:**
1. **Immediate deletion** after download:
   ```javascript
   fs.unlink(filePath, (err) => {
       if (err) console.error('Delete failed:', err);
   });
   ```
2. **Scheduled deletion** via cleanup utility:
   - Scans directories every 30 minutes
   - Checks file modification time
   - Deletes files exceeding retention period
3. **Error cleanup**:
   - On FFmpeg failure, partial output files deleted
   - Input files deleted after processing (success or failure)

### Security and Access Considerations

**Authentication Security:**
- Passwords hashed with bcrypt (salt rounds: 12)
- JWT tokens signed with secret from environment variable
- 7-day token expiration enforces re-authentication
- Token stored in localStorage (vulnerable to XSS, but acceptable for this use case)

**Current Vulnerabilities:**
1. **No HTTPS enforcement** (development only, OK for localhost)
2. **No rate limiting** (vulnerable to brute force and upload spam)
3. **No CSRF protection** (SameSite cookies not used)
4. **Authentication not enforced on processing endpoints** (anyone can upload/process)
5. **No file virus scanning** (trusts user uploads)
6. **Directory traversal risk** (filename validation needed)
7. **No input sanitization** for FFmpeg commands (potential command injection)

**Data Privacy Measures:**
- Automatic file deletion ensures user data not retained
- No logging of file contents or metadata
- Console logs could expose file paths (should be removed in production)
- No analytics or tracking of user uploads

**File Access Control:**
- Download endpoints validate filename parameter
- File existence checked before serving
- No directory listing allowed
- Files only accessible via specific endpoints, not static serving

**Recommended Security Improvements:**
1. Add authentication middleware to all processing routes
2. Implement rate limiting (e.g., express-rate-limit)
3. Sanitize all user inputs before passing to FFmpeg
4. Add virus scanning for uploaded files
5. Use HTTPS in production with Let's Encrypt
6. Move JWT secret to environment variable (already done)
7. Implement CSRF tokens for state-changing operations
8. Add request logging with sanitized data only

---

## 7. Current Limitations

### Known Constraints

**Functional Limitations:**
1. **Only 2 tools fully implemented**: ExtractAudio and ConvertAudio
   - Other 5 tools are placeholder UIs only
   - No video conversion, compression, or merging functionality
2. **No batch processing**: Users must process files one at a time
3. **No SSE fallback**: If SSE fails, no progress updates shown
4. **No resume capability**: If extraction fails mid-way, must restart from beginning
5. **No file preview**: Cannot preview video/audio before processing
6. **No quality selection**: Fixed quality settings for extraction
7. **No custom codec selection**: Limited to predefined codec mappings
8. **No output format preview**: Cannot estimate output file size beforehand

**Technical Limitations:**
1. **File size limit**: 500MB maximum (enforced by Multer)
2. **Single server**: No horizontal scaling, single point of failure
3. **Sync file operations**: Blocking I/O for file cleanup
4. **In-memory progress tracking**: Lost if server restarts mid-processing
5. **No database connection pooling**: Single MongoDB connection
6. **No CDN**: Static assets served from same server
7. **No queue system**: Concurrent uploads processed simultaneously (CPU-bound)

**Security Limitations:**
1. **Public processing endpoints**: No authentication required for upload/processing
2. **No rate limiting**: Vulnerable to abuse and DoS attacks
3. **No user quotas**: Unlimited uploads per user
4. **Weak session management**: localStorage tokens never refreshed
5. **No HTTPS in development**: Credentials transmitted in plaintext
6. **No audit logging**: No record of who uploaded what

**UX Limitations:**
1. **No upload progress**: Only shows spinner, not actual upload percentage
2. **No error recovery**: Errors require full page refresh
3. **No download history**: Cannot re-download previously processed files
4. **Mobile UI issues**: Sidebar overlay may not work perfectly on all devices
5. **No dark/light mode toggle**: Fixed dark theme only
6. **No keyboard shortcuts**: All interactions mouse-only

### Assumptions Made

**Infrastructure Assumptions:**
1. **Server has FFmpeg installed**: Relies on @ffmpeg-installer package
2. **Sufficient disk space**: No quota management or space checks
3. **Single timezone**: Server time used for all timestamps
4. **Stable MongoDB connection**: No reconnection logic implemented
5. **Local filesystem**: Assumes POSIX-compatible filesystem

**User Behavior Assumptions:**
1. **Users download immediately**: Cleanup assumes quick download after processing
2. **Valid file uploads**: Trusts file extensions match actual content
3. **No malicious intent**: No validation of FFmpeg commands or file contents
4. **English language**: No internationalization or localization
5. **Modern browsers**: Assumes EventSource API support

**Business Logic Assumptions:**
1. **Free service**: No payment processing or subscription logic
2. **No user collaboration**: Files not shareable between users
3. **No content moderation**: Trusts users upload legal content
4. **No copyright checking**: No validation of media ownership

**Data Assumptions:**
1. **Immediate deletion acceptable**: Users OK with files being deleted quick
2. **No backup needed**: Processed files not worth preserving
3. **No analytics required**: No tracking of popular formats or tools
4. **No user preferences**: Settings not saved between sessions

### Scalability Limitations

**Current Bottlenecks:**
1. **CPU-bound processing**: FFmpeg uses 100% CPU during conversion
   - No worker queue system
   - Concurrent uploads compete for CPU
   - Could overwhelm server with 10+ simultaneous conversions

2. **Disk I/O contention**:
   - Multiple writes to same disk
   - No SSD optimization
   - Cleanup scans entire directories synchronously

3. **Single server architecture**:
   - Cannot scale horizontally
   - No load balancing
   - Downtime during deployments

4. **Memory usage**:
   - SSE connections held open consume memory
   - No limit on concurrent connections
   - Potential memory leak if connections not closed

**Scaling Strategies Needed:**
1. Implement job queue (e.g., Bull/BullMQ with Redis)
2. Separate processing workers from API servers
3. Use cloud storage (S3) instead of local filesystem
4. Add load balancer and multiple processing nodes
5. Implement connection pooling for database
6. Add caching layer (Redis) for user sessions
7. Monitor memory usage and implement limits

**Estimated Capacity:**
- **Current**: ~5-10 concurrent users
- **With queue**: ~50-100 concurrent users (single server)
- **With worker pool**: ~500+ concurrent users (distributed)

**Performance Metrics (Estimated):**
- Video upload (100MB): ~30 seconds (depends on network)
- Audio extraction (5min video): ~45 seconds (depends on CPU)
- Audio conversion (5min audio): ~30 seconds
- Download (50MB): ~10 seconds (depends on network)

---

## Conclusion

The AV Utility Platform is a functional media processing web application with a modern React frontend and Node.js backend. It successfully demonstrates core concepts including:

- JWT-based authentication
- File upload handling with Multer
- FFmpeg integration for media processing
- Real-time progress updates via Server-Sent Events
- Automated file cleanup for privacy and storage management
- Responsive UI with premium design aesthetics

The platform is currently in a **proof-of-concept stage** with 2 fully implemented tools (ExtractAudio, ConvertAudio) and 5 placeholder tools. It is suitable for personal use or small-scale deployments but would require significant enhancements for production use, including:

- Security hardening (authentication on all routes, rate limiting, input sanitization)
- Scalability improvements (job queue, worker processes, cloud storage)
- Feature completion (implement remaining 5 tools)
- Error resilience (retry logic, graceful degradation)
- Monitoring and logging (track usage, errors, performance)

The codebase is well-structured following MVC patterns, making it straightforward to add new features and tools. The separation of concerns between frontend and backend allows independent development and deployment.
