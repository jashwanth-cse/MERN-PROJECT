const path = require('path');
const fs = require('fs');
const ffmpeg = require('../utils/ffmpegConfig');

// Upload video for audio extraction
const uploadVideo = async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No video file uploaded'
            });
        }

        const uploadedFile = req.file;
        const inputFilePath = uploadedFile.path;
        const fileName = uploadedFile.filename;
        const fileSize = uploadedFile.size;
        const originalName = uploadedFile.originalname;

        console.log('📹 Video uploaded successfully:');
        console.log('   - Original name:', originalName);
        console.log('   - Saved as:', fileName);
        console.log('   - Size:', (fileSize / (1024 * 1024)).toFixed(2), 'MB');
        console.log('   - Path:', inputFilePath);

        // Return success response with file information
        res.status(200).json({
            success: true,
            message: 'Video uploaded successfully',
            data: {
                inputFilePath: inputFilePath,
                fileName: fileName,
                originalName: originalName,
                fileSize: fileSize,
                fileSizeMB: parseFloat((fileSize / (1024 * 1024)).toFixed(2))
            }
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Video upload failed',
            error: error.message
        });
    }
};

// Detect audio tracks from uploaded video
const detectAudioTracks = async (req, res) => {
    try {
        const { inputFilePath } = req.body;

        // Validate input
        if (!inputFilePath) {
            return res.status(400).json({
                success: false,
                message: 'Input file path is required'
            });
        }

        // Check if file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Video file not found. Please upload the file first.'
            });
        }

        console.log('🔍 Detecting audio tracks in:', inputFilePath);

        // Use FFprobe to get stream information
        ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
            if (err) {
                console.error('❌ FFprobe error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to analyze video file',
                    error: err.message
                });
            }

            // Filter only audio streams
            const audioStreams = metadata.streams.filter(stream => stream.codec_type === 'audio');

            if (audioStreams.length === 0) {
                console.log('⚠️ No audio tracks found');
                return res.status(200).json({
                    success: false,
                    message: 'No audio tracks found in this file'
                });
            }

            // Extract relevant information from each audio stream
            const tracks = audioStreams.map((stream, idx) => {
                const track = {
                    index: stream.index,
                    streamIndex: idx,
                    codec: stream.codec_name || 'unknown',
                    language: stream.tags?.language || 'und',
                    channels: stream.channels || 0,
                    layout: stream.channel_layout || 'unknown',
                    sampleRate: stream.sample_rate || 'unknown',
                    bitrate: stream.bit_rate ? parseInt(stream.bit_rate) : null,
                    bitratekbps: stream.bit_rate ? Math.round(parseInt(stream.bit_rate) / 1000) : null,
                    duration: stream.duration ? parseFloat(stream.duration).toFixed(2) : null
                };

                return track;
            });

            console.log(`✅ Found ${tracks.length} audio track(s)`);
            tracks.forEach((track, idx) => {
                console.log(`   Track ${idx + 1}:`, {
                    codec: track.codec,
                    language: track.language,
                    channels: track.channels,
                    layout: track.layout
                });
            });

            // Return audio track information
            res.status(200).json({
                success: true,
                message: `${tracks.length} audio track(s) detected`,
                tracks: tracks,
                totalTracks: tracks.length
            });
        });

    } catch (error) {
        console.error('❌ Track detection error:', error);
        res.status(500).json({
            success: false,
            message: 'Audio track detection failed',
            error: error.message
        });
    }
};

// Extract audio track from video
const extractAudioTrack = async (req, res) => {
    try {
        const { inputFilePath, trackIndex, format } = req.body;

        // Validate input
        if (!inputFilePath) {
            return res.status(400).json({
                success: false,
                message: 'Input file path is required'
            });
        }

        if (trackIndex === undefined || trackIndex === null) {
            return res.status(400).json({
                success: false,
                message: 'Track index is required'
            });
        }

        if (!format) {
            return res.status(400).json({
                success: false,
                message: 'Output format is required'
            });
        }

        // Validate format
        const supportedFormats = ['mp3', 'wav', 'm4a'];
        if (!supportedFormats.includes(format.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Unsupported format. Supported formats: ${supportedFormats.join(', ')}`
            });
        }

        // Check if input file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Input video file not found'
            });
        }

        // Create output directory if it doesn't exist
        const outputDir = path.join(__dirname, '../uploads/output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('✅ Created output directory:', outputDir);
        }

        // Generate unique output filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const outputFileName = `audio-${uniqueSuffix}.${format}`;
        const outputFilePath = path.join(outputDir, outputFileName);

        console.log('🎵 Extracting audio track:');
        console.log('   - Input:', inputFilePath);
        console.log('   - Track index:', trackIndex);
        console.log('   - Format:', format);
        console.log('   - Output:', outputFilePath);

        // Extract audio using FFmpeg
        ffmpeg(inputFilePath)
            .outputOptions([
                `-map 0:a:${trackIndex}`, // Select specific audio track
                '-vn', // No video
                '-ar 44100', // Audio sample rate
                '-ac 2', // Audio channels (stereo)
                '-b:a 192k' // Audio bitrate
            ])
            .output(outputFilePath)
            .on('start', (commandLine) => {
                console.log('   FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`   Progress: ${Math.round(progress.percent)}%`);
                }
            })
            .on('end', () => {
                console.log('✅ Audio extraction completed');

                // Get file size
                const stats = fs.statSync(outputFilePath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                // Generate download URL
                const downloadUrl = `${req.protocol}://${req.get('host')}/api/extract-audio/download/${outputFileName}`;

                // Delete the uploaded video file to save space
                fs.unlink(inputFilePath, (err) => {
                    if (err) {
                        console.error('⚠️ Failed to delete uploaded video:', err.message);
                    } else {
                        console.log('🗑️ Deleted uploaded video file');
                    }
                });

                res.status(200).json({
                    success: true,
                    message: 'Audio extracted successfully',
                    data: {
                        outputFile: outputFilePath,
                        fileName: outputFileName,
                        format: format,
                        fileSizeMB: parseFloat(fileSizeMB),
                        downloadUrl: downloadUrl
                    }
                });
            })
            .on('error', (err) => {
                console.error('❌ FFmpeg extraction error:', err);

                // Clean up partial output file if exists
                if (fs.existsSync(outputFilePath)) {
                    fs.unlinkSync(outputFilePath);
                }

                // Delete the uploaded video file to save space
                fs.unlink(inputFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('⚠️ Failed to delete uploaded video:', unlinkErr.message);
                    } else {
                        console.log('🗑️ Deleted uploaded video file');
                    }
                });

                res.status(500).json({
                    success: false,
                    message: 'Audio extraction failed',
                    error: err.message
                });
            })
            .run();

    } catch (error) {
        console.error('❌ Extraction error:', error);
        res.status(500).json({
            success: false,
            message: 'Audio extraction failed',
            error: error.message
        });
    }
};

// Download extracted audio file
const downloadExtractedAudio = async (req, res) => {
    try {
        const { filename } = req.params;

        // Validate filename
        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required'
            });
        }

        // Construct file path
        const filePath = path.join(__dirname, '../uploads/output', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Audio file not found'
            });
        }

        console.log('⬇️ Downloading:', filename);

        // Set headers for download
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream file to client
        const fileStream = fs.createReadStream(filePath);

        fileStream.pipe(res);

        // Delete file after download completes
        fileStream.on('end', () => {
            console.log('✅ Download completed');

            // Delete the file
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('❌ Failed to delete file:', err.message);
                } else {
                    console.log('🗑️ Deleted extracted file:', filename);
                }
            });
        });

        fileStream.on('error', (err) => {
            console.error('❌ Download error:', err);
            res.status(500).json({
                success: false,
                message: 'Download failed',
                error: err.message
            });
        });

    } catch (error) {
        console.error('❌ Download error:', error);
        res.status(500).json({
            success: false,
            message: 'Download failed',
            error: error.message
        });
    }
};

module.exports = {
    uploadVideo,
    detectAudioTracks,
    extractAudioTrack,
    downloadExtractedAudio
};
