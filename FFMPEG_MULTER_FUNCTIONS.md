# FFmpeg & Multer Functions - Complete Reference Guide

## Complete List of Functions Used in AV Utility Platform

---

## 🎬 FLUENT-FFMPEG PACKAGE FUNCTIONS

### Configuration & Setup Functions

#### 1. `setFfmpegPath(path)`
**Location**: `server/utils/ffmpegConfig.js:6`

**Purpose**: Configure the absolute path to the FFmpeg binary executable

**Usage**:
```javascript
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
```

**Input Parameters**:
- `path` (string): Absolute file system path to ffmpeg binary

**What It Does**:
- Tells fluent-ffmpeg where to find the ffmpeg executable
- Required before any FFmpeg operations
- Without this, commands would fail with "ffmpeg not found"

**Used In**: 
- `utils/ffmpegConfig.js`
- `controllers/extractAudioProgressController.js`
- `controllers/audioConvertProgressController.js`

---

#### 2. `setFfprobePath(path)`
**Location**: `server/utils/ffmpegConfig.js:7`

**Purpose**: Configure the absolute path to the FFprobe binary executable

**Usage**:
```javascript
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfprobePath(ffprobePath);
```

**Input Parameters**:
- `path` (string): Absolute file system path to ffprobe binary

**What It Does**:
- Tells fluent-ffmpeg where to find the ffprobe executable
- FFprobe is used for media file analysis and metadata extraction
- Required for `ffprobe()` function to work

**Used In**:
- `utils/ffmpegConfig.js`
- `controllers/extractAudioProgressController.js`
- `controllers/audioConvertProgressController.js`

---

### Media Analysis Functions

#### 3. `ffprobe(filePath, callback)`
**Location**: Used in multiple controllers

**Purpose**: Analyze media file and extract comprehensive metadata

**Usage**:
```javascript
ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
    if (err) {
        console.error('FFprobe error:', err);
        return;
    }
    
    // metadata object contains:
    // - streams: array of audio/video/subtitle streams
    // - format: container format information
    // - chapters: chapter markers (if any)
});
```

**Input Parameters**:
- `filePath` (string): Path to media file to analyze
- `callback` (function): `(error, metadata) => {}`

**Output Data Structure** (`metadata` object):
```javascript
{
    streams: [
        {
            index: 0,                    // Stream index in file
            codec_name: 'h264',          // Codec name
            codec_type: 'video',         // 'video', 'audio', 'subtitle'
            width: 1920,                 // Video width (video streams)
            height: 1080,                // Video height (video streams)
            channels: 2,                 // Audio channels (audio streams)
            channel_layout: 'stereo',    // Channel layout
            sample_rate: 48000,          // Sample rate in Hz
            bit_rate: 192000,            // Bitrate in bits/second
            duration: 125.5,             // Duration in seconds
            tags: {
                language: 'eng',         // Language tag
                title: 'Main Audio',     // Track title
                DURATION: '00:02:05.500' // Alternative duration format
            }
        }
        // ... more streams
    ],
    format: {
        filename: '/path/to/file.mp4',
        format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
        duration: 125.5,                 // Total file duration
        size: 52428800,                  // File size in bytes
        bit_rate: 3145728               // Overall bitrate
    }
}
```

**Used For**:
1. **Detecting audio tracks** in videos (`detectAudioTracks()`)
2. **Getting file duration** for progress calculation
3. **Analyzing audio metadata** before conversion
4. **Validating stream existence** before extraction

**Used In**:
- `controllers/extractAudioController.js:75` - Detect audio tracks
- `controllers/extractAudioProgressController.js:52` - Get duration for progress
- `controllers/audioConvertController.js:78` - Analyze audio metadata
- `controllers/audioConvertProgressController.js:65` - Get duration for progress

---

### Media Processing Functions

#### 4. `ffmpeg(inputPath)`
**Location**: All processing controllers

**Purpose**: Create a new FFmpeg command instance for processing media

**Usage**:
```javascript
const command = ffmpeg(inputFilePath);
```

**Input Parameters**:
- `inputPath` (string): Path to input media file

**Returns**: 
- FfmpegCommand object (chainable)

**What It Does**:
- Initializes a new FFmpeg processing pipeline
- Sets the input file to be processed
- Returns object for chaining configuration methods

**Used In**:
- `controllers/extractAudioController.js:206`
- `controllers/extractAudioProgressController.js:119`
- `controllers/audioConvertController.js:194`
- `controllers/audioConvertProgressController.js:76`

---

#### 5. `.outputOptions(optionsArray)`
**Location**: All processing controllers

**Purpose**: Specify FFmpeg command-line options for output configuration

**Usage**:
```javascript
command.outputOptions([
    '-map 0:a:1',        // Select specific stream
    '-vn',               // No video in output
    '-ar 44100',         // Audio sample rate: 44.1kHz
    '-ac 2',             // Audio channels: stereo
    '-b:a 192k',         // Audio bitrate: 192kbps
    '-acodec libmp3lame' // Audio codec: MP3
]);
```

**Input Parameters**:
- `optionsArray` (array of strings): FFmpeg CLI options

**Common Options Used**:

**Stream Selection**:
- `-map 0:a:0` - Select first audio stream
- `-map 0:a:1` - Select second audio stream
- `-map 0:1` - Select stream with index 1
- `-vn` - No video output (audio extraction)
- `-an` - No audio output (video processing)

**Audio Quality**:
- `-ar 44100` - Sample rate: 44.1kHz (CD quality)
- `-ar 48000` - Sample rate: 48kHz (professional)
- `-ac 1` - Mono audio (1 channel)
- `-ac 2` - Stereo audio (2 channels)
- `-b:a 128k` - Bitrate: 128kbps (low quality)
- `-b:a 192k` - Bitrate: 192kbps (standard quality)
- `-b:a 320k` - Bitrate: 320kbps (high quality)

**Codec Selection**:
- `-acodec libmp3lame` - MP3 encoder
- `-acodec pcm_s16le` - WAV encoder (uncompressed)
- `-acodec aac` - AAC encoder
- `-acodec copy` - Copy without re-encoding

**Format-Specific Configurations in Code**:

**MP3**:
```javascript
command.outputOptions([
    '-vn',
    '-ar 44100',
    '-ac 2',
    '-b:a 192k'
]);
```

**WAV**:
```javascript
command.outputOptions(['-vn']);
// WAV uses default PCM encoding
```

**FLAC**:
```javascript
command.outputOptions(['-vn']);
// FLAC is lossless, no bitrate needed
```

**AAC/OGG/M4A**:
```javascript
command.outputOptions([
    '-vn',
    '-ar 44100',
    '-ac 2',
    '-b:a 192k'
]);
```

**Used In**:
- `controllers/extractAudioController.js:207-213`
- `controllers/extractAudioProgressController.js:122-126`
- `controllers/audioConvertController.js:199-233`
- `controllers/audioConvertProgressController.js:80-88`

---

#### 6. `.output(outputPath)`
**Location**: All processing controllers

**Purpose**: Specify the output file path for processed media

**Usage**:
```javascript
command.output('/path/to/output/audio.mp3');
```

**Input Parameters**:
- `outputPath` (string): Absolute path where output file will be saved

**What It Does**:
- Sets destination file path
- Creates parent directories if needed (depends on FFmpeg version)
- File extension determines container format if not explicitly set

**Path Generation Pattern**:
```javascript
const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
const outputFileName = `audio-${uniqueSuffix}.${format}`;
const outputFilePath = path.join(outputDir, outputFileName);
```

**Used In**:
- `controllers/extractAudioController.js:214`
- `controllers/extractAudioProgressController.js:127`
- `controllers/audioConvertController.js:236`
- `controllers/audioConvertProgressController.js:91`

---

### Event Handler Functions

#### 7. `.on('start', callback)`
**Location**: All processing controllers

**Purpose**: Execute callback when FFmpeg command starts

**Usage**:
```javascript
command.on('start', (commandLine) => {
    console.log('FFmpeg command:', commandLine);
    // Send SSE start event
    res.write(`data: ${JSON.stringify({ type: 'start', progress: 0 })}\n\n`);
});
```

**Callback Parameters**:
- `commandLine` (string): The actual FFmpeg CLI command being executed

**Example Output**:
```
ffmpeg -i /path/input.mp4 -map 0:a:0 -vn -ar 44100 -ac 2 -b:a 192k /path/output.mp3
```

**Used For**:
- Logging commands for debugging
- Sending initial progress update (0%) to frontend
- Verifying correct command construction

**Used In**:
- `controllers/extractAudioController.js:215`
- `controllers/extractAudioProgressController.js:128`
- `controllers/audioConvertController.js:237`
- `controllers/audioConvertProgressController.js:92`

---

#### 8. `.on('progress', callback)`
**Location**: All processing controllers

**Purpose**: Receive real-time progress updates during processing

**Usage**:
```javascript
command.on('progress', (progress) => {
    console.log(`Progress: ${Math.round(progress.percent)}%`);
    
    // Calculate accurate percentage from timemark
    const timeparts = progress.timemark.split(':');
    const currentSeconds = parseInt(timeparts[0]) * 3600 
                         + parseInt(timeparts[1]) * 60 
                         + parseFloat(timeparts[2]);
    const percent = Math.round((currentSeconds / totalDuration) * 100);
});
```

**Callback Parameters** (`progress` object):
```javascript
{
    frames: 1234,              // Frames processed (video)
    currentFps: 29.97,         // Current FPS (video)
    currentKbps: 192.5,        // Current bitrate
    targetSize: 2456,          // Target file size (KB)
    timemark: '00:02:15.50',   // Current position (HH:MM:SS.MS)
    percent: 45.2              // Estimated percentage (unreliable)
}
```

**Timemark Parsing Logic**:
```javascript
// Parse "00:02:15.50" format
const timeparts = progress.timemark.split(':');
const hours = parseInt(timeparts[0]) || 0;
const minutes = parseInt(timeparts[1]) || 0;
const seconds = parseFloat(timeparts[2]) || 0;
const currentTime = hours * 3600 + minutes * 60 + seconds;
```

**Percentage Calculation**:
```javascript
// More accurate than progress.percent
const percent = Math.min(Math.round((currentTime / duration) * 100), 99);
```

**Why We Don't Use `progress.percent`**:
- Often inaccurate or missing
- Doesn't account for multi-pass encoding
- Can jump around unpredictably

**SSE Update Pattern**:
```javascript
res.write(`data: ${JSON.stringify({
    type: 'progress',
    progress: percent,
    currentTime: currentTime.toFixed(1),
    totalTime: duration.toFixed(1)
})}\n\n`);
```

**Used In**:
- `controllers/extractAudioController.js:218`
- `controllers/extractAudioProgressController.js:132`
- `controllers/audioConvertController.js:240`
- `controllers/audioConvertProgressController.js:96`

---

#### 9. `.on('end', callback)`
**Location**: All processing controllers

**Purpose**: Execute callback when processing completes successfully

**Usage**:
```javascript
command.on('end', () => {
    console.log('Processing completed');
    
    // Get output file size
    const stats = fs.statSync(outputFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    // Generate download URL
    const downloadUrl = `${req.protocol}://${req.get('host')}/api/download/${filename}`;
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
        type: 'complete',
        progress: 100,
        downloadUrl: downloadUrl
    })}\n\n`);
    
    // Delete input file
    fs.unlink(inputFilePath, (err) => {
        if (err) console.error('Cleanup failed:', err);
    });
});
```

**Callback Parameters**: None

**Tasks Performed**:
1. Get output file size using `fs.statSync()`
2. Generate download URL
3. Send SSE completion event (for progress routes)
4. Delete input file to free disk space
5. Close SSE connection with `res.end()`

**Used In**:
- `controllers/extractAudioController.js:223`
- `controllers/extractAudioProgressController.js:157`
- `controllers/audioConvertController.js:245`
- `controllers/audioConvertProgressController.js:119`

---

#### 10. `.on('error', callback)`
**Location**: All processing controllers

**Purpose**: Handle errors during FFmpeg processing

**Usage**:
```javascript
command.on('error', (err) => {
    console.error('FFmpeg error:', err);
    
    // Clean up partial output file
    if (fs.existsSync(outputFilePath)) {
        fs.unlinkSync(outputFilePath);
    }
    
    // Delete input file
    fs.unlink(inputFilePath, (unlinkErr) => {
        if (unlinkErr) console.error('Input cleanup failed:', unlinkErr);
    });
    
    // Send error response
    res.status(500).json({
        success: false,
        message: 'Processing failed',
        error: err.message
    });
});
```

**Callback Parameters**:
- `err` (Error object): Contains error message and stack trace

**Common Error Types**:
1. **Invalid stream index**: "Stream specifier '0:a:5' does not match any stream"
2. **Unsupported codec**: "Encoder 'xyz' not found"
3. **Corrupted file**: "Invalid data found when processing input"
4. **Permission errors**: "Permission denied" (file locked)
5. **Disk full**: "No space left on device"

**Error Handling Steps**:
1. Log error details to console
2. Delete partial output file (incomplete/corrupted)
3. Delete input file (cleanup)
4. Send error response to client (SSE or JSON)
5. Close connection

**Used In**:
- `controllers/extractAudioController.js:254`
- `controllers/extractAudioProgressController.js:189`
- `controllers/audioConvertController.js:276`
- `controllers/audioConvertProgressController.js:149`

---

#### 11. `.run()`
**Location**: All processing controllers

**Purpose**: Execute the configured FFmpeg command

**Usage**:
```javascript
command
    .outputOptions(['-vn', '-ar 44100'])
    .output('/path/output.mp3')
    .on('start', startHandler)
    .on('progress', progressHandler)
    .on('end', endHandler)
    .on('error', errorHandler)
    .run();  // Starts execution
```

**Input Parameters**: None

**What It Does**:
- Spawns FFmpeg process as child process
- Starts media processing
- Triggers 'start' event immediately
- Returns nothing (events handle async results)

**Alternative Methods** (not used in project):
- `.exec()` - Run command and get callback when done
- `.save(path)` - Shorthand for `.output(path).run()`

**Used In**:
- `controllers/extractAudioController.js:277`
- `controllers/extractAudioProgressController.js:204`
- `controllers/audioConvertController.js:299`
- `controllers/audioConvertProgressController.js:164`

---

## 📦 MULTER PACKAGE FUNCTIONS

### Configuration Functions

#### 12. `multer.diskStorage(options)`
**Location**: 
- `server/utils/multerConfig.js:16`
- `server/utils/audioMulterConfig.js:16`

**Purpose**: Configure disk-based file storage for uploads

**Usage**:
```javascript
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/path/to/upload/directory');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random()}.mp4`;
        cb(null, uniqueName);
    }
});
```

**Options Object**:

**`destination` Function**:
- **Parameters**: `(req, file, callback)`
- **Purpose**: Determine upload directory
- **Implementation**:
  ```javascript
  destination: (req, file, cb) => {
      cb(null, uploadDir);  // uploadDir is predefined constant
  }
  ```
- **Callback**: `cb(error, path)`
  - `error`: Error object or null
  - `path`: Absolute directory path

**`filename` Function**:
- **Parameters**: `(req, file, callback)`
- **Purpose**: Generate unique filename for uploaded file
- **Implementation**:
  ```javascript
  filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      const nameWithoutExt = path.basename(file.originalname, ext);
      cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
  ```
- **Callback**: `cb(error, filename)`
  - `error`: Error object or null
  - `filename`: Generated filename (without path)

**File Object Properties** (available in functions):
```javascript
file = {
    fieldname: 'video',           // Field name from HTML form
    originalname: 'myvideo.mp4',  // Original filename from user
    encoding: '7bit',             // File encoding
    mimetype: 'video/mp4',        // MIME type
    size: 52428800,               // File size in bytes (available after upload)
    destination: '/uploads/temp', // Upload directory
    filename: 'myvideo-123.mp4',  // Generated filename
    path: '/uploads/temp/myvideo-123.mp4'  // Full path
}
```

**Storage Alternatives** (not used in project):
- `multer.memoryStorage()` - Store files in memory (RAM)

**Used In**:
- `utils/multerConfig.js:16` - Video uploads
- `utils/audioMulterConfig.js:16` - Audio uploads

---

#### 13. `multer(options)`
**Location**: 
- `server/utils/multerConfig.js:41`
- `server/utils/audioMulterConfig.js:41`

**Purpose**: Create configured Multer middleware instance

**Usage**:
```javascript
const upload = multer({
    storage: storage,           // Storage engine
    fileFilter: fileFilter,     // Validation function
    limits: {
        fileSize: 500 * 1024 * 1024  // 500MB in bytes
    }
});
```

**Options Object**:

**`storage`** (object):
- Storage engine from `multer.diskStorage()`
- Defines where and how to save files

**`fileFilter`** (function):
- Custom validation function
- Executed BEFORE file is saved
- Can reject uploads based on criteria

**`limits`** (object):
- **`fileSize`**: Maximum file size in bytes
  - Video uploads: `500 * 1024 * 1024` = 500MB
  - Audio uploads: `500 * 1024 * 1024` = 500MB
- **`files`**: Maximum number of files (not used, default: infinity)
- **`fields`**: Maximum number of fields (not used, default: infinity)
- **`parts`**: Maximum number of multipart parts (not used)

**Other Options** (not used in project):
- `dest`: Shorthand for destination (instead of storage)
- `preservePath`: Keep full path of original filename

**Returns**: Multer middleware function

**Used In**:
- `utils/multerConfig.js:41` - Creates `upload` for videos
- `utils/audioMulterConfig.js:41` - Creates `audioUpload` for audio

---

### File Validation Functions

#### 14. Custom `fileFilter` Function
**Location**: 
- `server/utils/multerConfig.js:30`
- `server/utils/audioMulterConfig.js:30`

**Purpose**: Validate file type before accepting upload

**Signature**:
```javascript
const fileFilter = (req, file, cb) => {
    // Validation logic
    cb(error, acceptFile);
};
```

**Parameters**:
- `req`: Express request object
- `file`: Multer file object (with originalname, mimetype)
- `cb`: Callback function

**Video File Filter Implementation**:
```javascript
const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (SUPPORTED_VIDEO_FORMATS.includes(ext)) {
        cb(null, true);  // Accept file
    } else {
        cb(new Error(`Unsupported video format. Supported: ${SUPPORTED_VIDEO_FORMATS.join(', ')}`), false);
    }
};
```

**Audio File Filter Implementation**:
```javascript
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];

const audioFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (SUPPORTED_AUDIO_FORMATS.includes(ext)) {
        cb(null, true);  // Accept file
    } else {
        cb(new Error(`Unsupported audio format. Supported: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`), false);
    }
};
```

**Callback Usage**:
- **Accept file**: `cb(null, true)`
- **Reject file**: `cb(new Error('Reason'), false)`
- **Error + reject**: `cb(error, false)`

**Validation Checks**:
1. Extract file extension using `path.extname()`
2. Convert to lowercase for case-insensitive comparison
3. Check if extension exists in supported formats array
4. Call callback with acceptance/rejection

**Error Handling**:
- Errors thrown here are caught by Multer error middleware in `server.js:70-90`
- Error message displayed to user via API response

**Used In**:
- `utils/multerConfig.js:30` - Video validation
- `utils/audioMulterConfig.js:30` - Audio validation

---

### Multer Middleware Methods

#### 15. `.single(fieldname)`
**Location**: All route files where Multer is used

**Purpose**: Accept single file upload from specified form field

**Usage**:
```javascript
router.post('/upload', upload.single('video'), uploadController);
```

**Parameters**:
- `fieldname` (string): Name of the file input field in HTML form

**Frontend HTML Example**:
```html
<input type="file" name="video" />
<!-- fieldname must match -->
```

**Frontend FormData Example**:
```javascript
const formData = new FormData();
formData.append('video', selectedFile);
// fieldname must match
```

**What It Does**:
1. Intercepts multipart/form-data request
2. Looks for field named `fieldname`
3. Calls `fileFilter` to validate
4. Calls `storage.destination` to get upload directory
5. Calls `storage.filename` to generate filename
6. Writes file to disk in chunks
7. Populates `req.file` object with metadata
8. Calls next middleware (controller)

**Request Object After Middleware**:
```javascript
req.file = {
    fieldname: 'video',
    originalname: 'myvideo.mp4',
    encoding: '7bit',
    mimetype: 'video/mp4',
    destination: '/uploads/temp',
    filename: 'myvideo-1703174523-847362910.mp4',
    path: '/uploads/temp/myvideo-1703174523-847362910.mp4',
    size: 52428800
};
```

**Alternative Methods** (not used in project):
- `.array(fieldname, maxCount)` - Accept array of files
- `.fields([{name, maxCount}])` - Accept multiple fields
- `.any()` - Accept all files (not recommended)
- `.none()` - Accept no files (text fields only)

**Error Cases**:
1. **No file uploaded**: `req.file` is `undefined`
2. **Wrong field name**: File ignored, `req.file` is `undefined`
3. **File too large**: "File too large" MulterError
4. **Invalid format**: Custom error from `fileFilter`

**Used In**:
- `routes/extractAudioRoutes.js:14` - `upload.single('video')`
- `routes/audioConvertRoutes.js:14` - `audioUpload.single('file')`

---

## 🔍 VALIDATION SUMMARY

### File Extension Validation

**Video Files** (`utils/multerConfig.js`):
```javascript
const SUPPORTED_VIDEO_FORMATS = [
    '.mp4',   // MPEG-4 Video
    '.mov',   // QuickTime Movie
    '.mkv',   // Matroska Video
    '.avi',   // Audio Video Interleave
    '.webm'   // WebM Video
];
```

**Audio Files** (`utils/audioMulterConfig.js`):
```javascript
const SUPPORTED_AUDIO_FORMATS = [
    '.mp3',   // MPEG Audio Layer 3
    '.wav',   // Waveform Audio
    '.flac',  // Free Lossless Audio Codec
    '.aac',   // Advanced Audio Coding
    '.ogg',   // Ogg Vorbis
    '.m4a'    // MPEG-4 Audio
];
```

**Validation Method**:
```javascript
const ext = path.extname(file.originalname).toLowerCase();
if (SUPPORTED_FORMATS.includes(ext)) {
    cb(null, true);  // Accept
} else {
    cb(new Error('Unsupported format'), false);  // Reject
}
```

---

### File Size Validation

**Maximum Size**: 500MB (524,288,000 bytes)

**Configuration**:
```javascript
limits: {
    fileSize: 500 * 1024 * 1024  // 500 MB
}
```

**When Exceeded**:
- Multer throws `MulterError` with code `LIMIT_FILE_SIZE`
- Upload immediately rejected (file not saved)
- Caught by error middleware in `server.js:70`
- Returns 400 Bad Request to client

**Error Response**:
```json
{
    "success": false,
    "message": "Upload error: File too large",
    "error": "LIMIT_FILE_SIZE"
}
```

---

### Filename Generation

**Pattern**: `[nameWithoutExt]-[timestamp]-[random].[ext]`

**Components**:
1. **Original name** (without extension): `path.basename(file.originalname, ext)`
2. **Timestamp**: `Date.now()` (milliseconds since epoch)
3. **Random number**: `Math.round(Math.random() * 1E9)` (0-999,999,999)
4. **Extension**: `path.extname(file.originalname).toLowerCase()`

**Example**:
- Input: `My Video.MP4`
- Output: `My Video-1703174523-847362910.mp4`

**Uniqueness**:
- Timestamp ensures chronological ordering
- Random prevents collisions in same millisecond
- Combined probability of collision: ~1 in 1 billion per millisecond

---

### Directory Validation

**Upload Directories**:
```javascript
// Video uploads
const uploadDir = path.join(__dirname, '../uploads/temp');

// Audio uploads
const uploadDir = path.join(__dirname, '../uploads/audio/temp');
```

**Auto-Creation**:
```javascript
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Created upload directory:', uploadDir);
}
```

**Directory Permissions**:
- Created with default Node.js permissions
- Typically: `755` (rwxr-xr-x) for directories
- Typically: `644` (rw-r--r--) for files

---

### Metadata Extraction

**FFprobe Metadata Validation**:

**Stream Type Check** (`detectAudioTracks`):
```javascript
const audioStreams = metadata.streams.filter(
    stream => stream.codec_type === 'audio'
);

if (audioStreams.length === 0) {
    return res.status(200).json({
        success: false,
        message: 'No audio tracks found'
    });
}
```

**Duration Validation** (`extractAudioWithProgress`):
```javascript
let duration = audioStream.duration 
            || audioStream.tags?.DURATION 
            || metadata.format.duration;

// Parse if string format "HH:MM:SS.MS"
if (typeof duration === 'string') {
    const parts = duration.split(':');
    duration = parseInt(parts[0]) * 3600 
             + parseInt(parts[1]) * 60 
             + parseFloat(parts[2]);
}

duration = parseFloat(duration);

if (!duration || isNaN(duration) || duration <= 0) {
    console.warn('Invalid duration, using estimation');
    duration = null;  // Progress percentage will be skipped
}
```

**Stream Index Validation**:
```javascript
const audioStream = metadata.streams.find(s => s.index === trackIndex);

if (!audioStream) {
    return res.write(`data: ${JSON.stringify({
        type: 'error',
        error: `Audio stream ${trackIndex} not found`
    })}\n\n`);
}

if (audioStream.codec_type !== 'audio') {
    return res.write(`data: ${JSON.stringify({
        type: 'error',
        error: `Stream ${trackIndex} is not an audio stream`
    })}\n\n`);
}
```

---

## 📊 COMPLETE FUNCTION USAGE MAP

### FFmpeg Functions by Controller

**`extractAudioController.js`**:
- `ffmpeg.ffprobe()` - Line 75 (detect tracks)
- `ffmpeg()` - Line 206 (create command)
- `.outputOptions()` - Line 207 (configure output)
- `.output()` - Line 214 (set output path)
- `.on('start')` - Line 215 (log command)
- `.on('progress')` - Line 218 (show progress)
- `.on('end')` - Line 223 (handle completion)
- `.on('error')` - Line 254 (handle errors)
- `.run()` - Line 277 (execute)

**`extractAudioProgressController.js`**:
- `ffmpeg.setFfmpegPath()` - Line 8
- `ffmpeg.setFfprobePath()` - Line 9
- `ffmpeg.ffprobe()` - Line 52 (get duration)
- `ffmpeg()` - Line 119 (create command)
- `.outputOptions()` - Line 122 (configure output)
- `.output()` - Line 127 (set output path)
- `.on('start')` - Line 128 (SSE start event)
- `.on('progress')` - Line 132 (SSE progress events)
- `.on('end')` - Line 157 (SSE completion)
- `.on('error')` - Line 189 (SSE error)
- `.run()` - Line 204 (execute)

**`audioConvertController.js`**:
- `ffmpeg.ffprobe()` - Line 78 (analyze metadata)
- `ffmpeg()` - Line 194 (create command)
- `.outputOptions()` - Lines 199, 206, 208, 210, 218, 226 (format-specific)
- `.output()` - Line 236 (set output path)
- `.on('start')` - Line 237 (log command)
- `.on('progress')` - Line 240 (show progress)
- `.on('end')` - Line 245 (handle completion)
- `.on('error')` - Line 276 (handle errors)
- `.run()` - Line 299 (execute)

**`audioConvertProgressController.js`**:
- `ffmpeg.setFfmpegPath()` - Line 8
- `ffmpeg.setFfprobePath()` - Line 9
- `ffmpeg.ffprobe()` - Line 65 (get duration)
- `ffmpeg()` - Line 76 (create command)
- `.outputOptions()` - Lines 80, 87 (format-specific)
- `.output()` - Line 91 (set output path)
- `.on('start')` - Line 92 (SSE start event)
- `.on('progress')` - Line 96 (SSE progress events)
- `.on('end')` - Line 119 (SSE completion)
- `.on('error')` - Line 149 (SSE error)
- `.run()` - Line 164 (execute)

---

### Multer Functions by Module

**`multerConfig.js`** (Video Uploads):
- `multer.diskStorage()` - Line 16 (create storage)
  - `.destination` - Line 17 (set upload dir)
  - `.filename` - Line 20 (generate filename)
- `multer()` - Line 41 (create middleware)
  - `storage` option - Line 42
  - `fileFilter` option - Line 43
  - `limits.fileSize` option - Line 45
- `.single()` - Used in routes (not in this file)

**`audioMulterConfig.js`** (Audio Uploads):
- `multer.diskStorage()` - Line 16 (create storage)
  - `.destination` - Line 17 (set upload dir)
  - `.filename` - Line 20 (generate filename)
- `multer()` - Line 41 (create middleware)
  - `storage` option - Line 42
  - `fileFilter` option - Line 43
  - `limits.fileSize` option - Line 45
- `.single()` - Used in routes (not in this file)

**Route Files**:
- `extractAudioRoutes.js:14` - `upload.single('video')`
- `audioConvertRoutes.js:14` - `audioUpload.single('file')`

---

## 🎯 INPUT VALIDATION CHECKLIST

### Upload Phase Validation

✅ **File Extension** (Multer `fileFilter`):
- Videos: MP4, MOV, MKV, AVI, WEBM only
- Audio: MP3, WAV, FLAC, AAC, OGG, M4A only
- Case-insensitive check
- Rejected if unsupported

✅ **File Size** (Multer `limits`):
- Maximum: 500MB (524,288,000 bytes)
- Checked during upload
- Upload terminated if exceeded

✅ **File Existence** (Controller):
```javascript
if (!req.file) {
    return res.status(400).json({
        success: false,
        message: 'No file uploaded'
    });
}
```

✅ **Directory Existence**:
- Auto-created if missing
- Uses `fs.mkdirSync(dir, { recursive: true })`

---

### Processing Phase Validation

✅ **Input File Path** (Controller):
```javascript
if (!inputFilePath) {
    return res.status(400).json({
        success: false,
        message: 'Input file path is required'
    });
}

if (!fs.existsSync(inputFilePath)) {
    return res.status(404).json({
        success: false,
        message: 'Input file not found'
    });
}
```

✅ **Track Index** (Extract Audio):
```javascript
if (trackIndex === undefined || trackIndex === null) {
    return res.status(400).json({
        success: false,
        message: 'Track index is required'
    });
}
```

✅ **Output Format**:
```javascript
const supportedFormats = ['mp3', 'wav', 'm4a'];
if (!supportedFormats.includes(format.toLowerCase())) {
    return res.status(400).json({
        success: false,
        message: `Unsupported format. Supported: ${supportedFormats.join(', ')}`
    });
}
```

✅ **Stream Type** (FFprobe):
```javascript
if (audioStream.codec_type !== 'audio') {
    return res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Selected stream is not audio'
    })}\n\n`);
}
```

✅ **Duration Validity**:
```javascript
if (!duration || isNaN(duration) || duration <= 0) {
    console.warn('Invalid duration detected');
    duration = null;  // Skip percentage calculation
}
```

---

### Download Phase Validation

✅ **Filename Parameter**:
```javascript
if (!filename) {
    return res.status(400).json({
        success: false,
        message: 'Filename is required'
    });
}
```

✅ **File Existence**:
```javascript
const filePath = path.join(outputDir, filename);
if (!fs.existsSync(filePath)) {
    return res.status(404).json({
        success: false,
        message: 'File not found'
    });
}
```

---

## Summary

This document covers **all 15 functions** from FFmpeg and Multer packages used in your project:

**FFmpeg (11 functions)**:
1. `setFfmpegPath()` - Configure binary path
2. `setFfprobePath()` - Configure probe binary path
3. `ffprobe()` - Extract metadata
4. `ffmpeg()` - Create command
5. `.outputOptions()` - Set processing options
6. `.output()` - Set output file
7. `.on('start')` - Start event handler
8. `.on('progress')` - Progress event handler
9. `.on('end')` - Completion event handler
10. `.on('error')` - Error event handler
11. `.run()` - Execute command

**Multer (4 main functions + configuration)**:
12. `multer.diskStorage()` - Configure storage
13. `multer()` - Create middleware
14. Custom `fileFilter` - Validate file types
15. `.single()` - Accept single file upload

Each function is documented with:
- Purpose and usage
- Input parameters and output data
- Code examples from your project
- Validation logic
- Error handling
- Line numbers where used
