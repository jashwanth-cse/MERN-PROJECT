const path = require('path');
const fs = require('fs');
const ffmpeg = require('../utils/ffmpegConfig');

// STEP 1: Upload audio file for compression
const uploadAudioFile = async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No audio file uploaded'
            });
        }

        const uploadedFile = req.file;
        const inputFilePath = uploadedFile.path;
        const fileName = uploadedFile.filename;
        const fileSize = uploadedFile.size;
        const originalName = uploadedFile.originalname;

        // Extract original format
        const originalFormat = path.extname(originalName).toLowerCase().slice(1);

        console.log('📤 Audio file uploaded for compression:');
        console.log('   - Original Name:', originalName);
        console.log('   - Saved As:', fileName);
        console.log('   - Size:', (fileSize / (1024 * 1024)).toFixed(2), 'MB');
        console.log('   - Format:', originalFormat);
        console.log('   - Path:', inputFilePath);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Audio file uploaded successfully',
            inputFilePath: inputFilePath,
            originalFormat: originalFormat,
            data: {
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
            message: 'Audio file upload failed',
            error: error.message
        });
    }
};

// STEP 2: Analyze audio file metadata using FFprobe
const analyzeAudioForCompression = async (req, res) => {
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
                message: 'Audio file not found'
            });
        }

        console.log('🔍 Analyzing audio file:', inputFilePath);

        // Use FFprobe to get audio metadata
        ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
            if (err) {
                console.error('❌ FFprobe error:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Unable to analyze audio file',
                    error: err.message
                });
            }

            // Find the first audio stream
            const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

            if (!audioStream) {
                return res.status(400).json({
                    success: false,
                    message: 'No audio stream found in file'
                });
            }

            // Get file size
            const stats = fs.statSync(inputFilePath);
            const fileSizeBytes = stats.size;
            const fileSizeMB = parseFloat((fileSizeBytes / (1024 * 1024)).toFixed(2));

            // Extract metadata
            const audioMetadata = {
                codec: audioStream.codec_name || 'unknown',
                sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate) : null,
                bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : (metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : null),
                channels: audioStream.channels || null,
                channelLayout: audioStream.channel_layout || 'unknown',
                duration: audioStream.duration ? parseFloat(audioStream.duration) : (metadata.format.duration ? parseFloat(metadata.format.duration) : null),
                fileSizeBytes: fileSizeBytes,
                fileSizeMB: fileSizeMB
            };

            console.log('✅ Audio metadata analyzed:');
            console.log('   - Codec:', audioMetadata.codec);
            console.log('   - Sample Rate:', audioMetadata.sampleRate, 'Hz');
            console.log('   - Bitrate:', audioMetadata.bitrate, 'bps');
            console.log('   - Channels:', audioMetadata.channels);
            console.log('   - Duration:', audioMetadata.duration, 'seconds');
            console.log('   - File Size:', audioMetadata.fileSizeMB, 'MB');

            // Return metadata
            res.status(200).json({
                success: true,
                message: 'Audio metadata analyzed',
                metadata: audioMetadata
            });
        });

    } catch (error) {
        console.error('❌ Analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Audio analysis failed',
            error: error.message
        });
    }
};

// STEP 3: Compress audio file with quality settings
const compressAudioWithQuality = async (req, res) => {
    try {
        const { inputFilePath, targetBitrate, quality } = req.body;

        // Validate inputs
        if (!inputFilePath) {
            return res.status(400).json({
                success: false,
                message: 'Input file path is required'
            });
        }

        if (!quality) {
            return res.status(400).json({
                success: false,
                message: 'Quality mode is required'
            });
        }

        // Validate quality
        const validQualities = ['low', 'medium', 'high'];
        if (!validQualities.includes(quality)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid quality. Supported: low, medium, high'
            });
        }

        // Validate bitrate if provided
        const validBitrates = ['64k', '96k', '128k', '192k', '256k', '320k'];
        if (targetBitrate && !validBitrates.includes(targetBitrate)) {
            return res.status(400).json({
                success: false,
                message: `Invalid bitrate. Supported: ${validBitrates.join(', ')}`
            });
        }

        // Check if file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Input audio file not found'
            });
        }

        // Create output directory
        const outputDir = path.join(__dirname, '../uploads/audio-compress/output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate unique output filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const outputFileName = `compressed-${uniqueSuffix}.mp3`;
        const outputFilePath = path.join(outputDir, outputFileName);

        // Quality settings
        let compressionBitrate = targetBitrate || '128k';
        let channels = 2;
        let sampleRate = 44100;

        if (quality === 'low') {
            compressionBitrate = targetBitrate || '96k';
            channels = 1; // Mono for low quality
        } else if (quality === 'medium') {
            compressionBitrate = targetBitrate || '128k';
            channels = 2; // Stereo
        } else if (quality === 'high') {
            compressionBitrate = targetBitrate || '192k';
            channels = 2; // Stereo
        }

        console.log('🔄 Compressing audio:');
        console.log('   - Input:', inputFilePath);
        console.log('   - Quality:', quality);
        console.log('   - Target Bitrate:', compressionBitrate);
        console.log('   - Channels:', channels);

        // Get original metadata for comparison
        ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
            if (err) {
                console.error('❌ FFprobe error:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Unable to analyze input file'
                });
            }

            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
            const originalBitrate = audioStream?.bit_rate || metadata.format.bit_rate || null;

            // Set up SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            // Compress using FFmpeg
            ffmpeg(inputFilePath)
                .outputOptions([
                    '-vn',                          // No video
                    `-ac ${channels}`,              // Audio channels
                    `-ar ${sampleRate}`,            // Sample rate
                    `-b:a ${compressionBitrate}`    // Bitrate
                ])
                .toFormat('mp3')
                .on('start', (commandLine) => {
                    console.log('▶️  FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        const percent = Math.round(progress.percent);
                        console.log(`   Progress: ${percent}%`);

                        // Send SSE progress event
                        res.write(`data: ${JSON.stringify({
                            type: 'progress',
                            percent: percent
                        })}\n\n`);

                        if (res.flush) res.flush();
                    }
                })
                .on('end', () => {
                    console.log('✅ Compression complete!');

                    // Delete input file
                    fs.unlink(inputFilePath, (err) => {
                        if (err) {
                            console.error('⚠️  Failed to delete input file:', err.message);
                        } else {
                            console.log('🗑️  Deleted input file');
                        }
                    });

                    // Send SSE complete event
                    res.write(`data: ${JSON.stringify({
                        type: 'complete',
                        data: {
                            outputFile: outputFilePath,
                            fileName: outputFileName,
                            downloadUrl: `/api/audio-compress/download/${outputFileName}`,
                            originalBitrate: originalBitrate ? parseInt(originalBitrate) : null,
                            compressedBitrate: parseInt(compressionBitrate.replace('k', '000')),
                            quality: quality,
                            channels: channels
                        }
                    })}\n\n`);

                    if (res.flush) res.flush();
                    res.end();
                })
                .on('error', (err) => {
                    console.error('❌ FFmpeg compression error:', err.message);

                    // Send SSE error event
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        message: 'Audio compression failed',
                        error: err.message
                    })}\n\n`);

                    if (res.flush) res.flush();
                    res.end();
                })
                .save(outputFilePath);
        });

    } catch (error) {
        console.error('❌ Compression error:', error);
        res.status(500).json({
            success: false,
            message: 'Audio compression failed',
            error: error.message
        });
    }
};

// Download compressed audio file
const downloadCompressedAudio = async (req, res) => {
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
        const filePath = path.join(__dirname, '../uploads/audio-compress/output', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Compressed audio file not found'
            });
        }

        console.log('⬇️  Downloading compressed audio:', filename);

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
                    console.error('❌ Failed to delete compressed file:', err.message);
                } else {
                    console.log('🗑️  Deleted compressed file:', filename);
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
    uploadAudioFile,
    analyzeAudioForCompression,
    compressAudioWithQuality,
    downloadCompressedAudio
};
