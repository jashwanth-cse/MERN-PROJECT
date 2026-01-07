const path = require('path');
const fs = require('fs');
const ffmpeg = require('../utils/ffmpegConfig');

// Upload audio file for format conversion
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
        const originalFormat = path.extname(originalName).toLowerCase().replace('.', '');

        console.log('🎵 Audio file uploaded successfully:');
        console.log('   - Original name:', originalName);
        console.log('   - Saved as:', fileName);
        console.log('   - Format:', originalFormat);
        console.log('   - Size:', (fileSize / (1024 * 1024)).toFixed(2), 'MB');
        console.log('   - Path:', inputFilePath);

        // Return success response with file information
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

// Analyze audio file metadata using FFprobe
const analyzeAudioMetadata = async (req, res) => {
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
                message: 'Audio file not found. Please upload the file first.'
            });
        }

        console.log('🔍 Analyzing audio metadata:', inputFilePath);

        // Use FFprobe to get audio stream information
        ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
            if (err) {
                console.error('❌ FFprobe error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Unable to analyze audio file',
                    error: err.message
                });
            }

            // Filter audio streams
            const audioStreams = metadata.streams.filter(stream => stream.codec_type === 'audio');

            if (audioStreams.length === 0) {
                console.log('⚠️ No audio streams found');
                return res.status(400).json({
                    success: false,
                    message: 'No audio streams found in this file'
                });
            }

            // Get the first audio stream
            const audioStream = audioStreams[0];

            // Extract metadata
            const audioMetadata = {
                codec: audioStream.codec_name || 'unknown',
                sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate) : null,
                bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : null,
                channels: audioStream.channels || null,
                channelLayout: audioStream.channel_layout || 'unknown',
                duration: audioStream.duration ? parseFloat(audioStream.duration) : null
            };

            console.log('✅ Audio metadata extracted:');
            console.log('   - Codec:', audioMetadata.codec);
            console.log('   - Sample Rate:', audioMetadata.sampleRate, 'Hz');
            console.log('   - Bitrate:', audioMetadata.bitrate ? Math.round(audioMetadata.bitrate / 1000) : 'N/A', 'kbps');
            console.log('   - Channels:', audioMetadata.channels);
            console.log('   - Layout:', audioMetadata.channelLayout);
            console.log('   - Duration:', audioMetadata.duration, 'seconds');

            // Return metadata
            res.status(200).json({
                success: true,
                message: 'Audio metadata extracted',
                metadata: audioMetadata
            });
        });

    } catch (error) {
        console.error('❌ Metadata analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Audio metadata analysis failed',
            error: error.message
        });
    }
};

// Convert audio file to selected format
const convertAudioFormat = async (req, res) => {
    try {
        const { inputFilePath, outputFormat, bitrate } = req.body;

        // Validate input
        if (!inputFilePath) {
            return res.status(400).json({
                success: false,
                message: 'Input file path is required'
            });
        }

        if (!outputFormat) {
            return res.status(400).json({
                success: false,
                message: 'Output format is required'
            });
        }

        // Validate format
        const supportedFormats = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
        if (!supportedFormats.includes(outputFormat.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Unsupported format. Supported formats: ${supportedFormats.join(', ')}`
            });
        }

        // Check if input file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Input audio file not found'
            });
        }

        // Create output directory if it doesn't exist
        const outputDir = path.join(__dirname, '../uploads/audio/output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('✅ Created output directory:', outputDir);
        }

        // Generate unique output filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const outputFileName = `audio-${uniqueSuffix}.${outputFormat}`;
        const outputFilePath = path.join(outputDir, outputFileName);

        console.log('🔄 Converting audio file:');
        console.log('   - Input:', inputFilePath);
        console.log('   - Output Format:', outputFormat);
        console.log('   - Bitrate:', bitrate || 'default');
        console.log('   - Output:', outputFilePath);

        // Convert audio using FFmpeg
        const command = ffmpeg(inputFilePath);

        // Format-specific FFmpeg settings
        if (outputFormat === 'mp3') {
            command
                .outputOptions([
                    '-vn', // No video
                    '-ar 44100', // Audio sample rate
                    '-ac 2', // Audio channels (stereo)
                    `-b:a ${bitrate || '192k'}` // Audio bitrate
                ]);
        } else if (outputFormat === 'wav') {
            command.outputOptions(['-vn']);
        } else if (outputFormat === 'flac') {
            command.outputOptions(['-vn']);
        } else if (outputFormat === 'aac') {
            command
                .outputOptions([
                    '-vn',
                    '-ar 44100',
                    '-ac 2',
                    `-b:a ${bitrate || '192k'}`
                ]);
        } else if (outputFormat === 'ogg') {
            command
                .outputOptions([
                    '-vn',
                    '-ar 44100',
                    '-ac 2',
                    `-b:a ${bitrate || '192k'}`
                ]);
        } else if (outputFormat === 'm4a') {
            command
                .outputOptions([
                    '-vn',
                    '-ar 44100',
                    '-ac 2',
                    `-b:a ${bitrate || '192k'}`
                ]);
        }

        command
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
                console.log('✅ Audio conversion completed');

                // Get file size
                const stats = fs.statSync(outputFilePath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                // Generate download URL
                const downloadUrl = `${req.protocol}://${req.get('host')}/api/audio-convert/download/${outputFileName}`;

                // Delete the uploaded audio file to save space
                fs.unlink(inputFilePath, (err) => {
                    if (err) {
                        console.error('⚠️ Failed to delete uploaded audio:', err.message);
                    } else {
                        console.log('🗑️ Deleted uploaded audio file');
                    }
                });

                res.status(200).json({
                    success: true,
                    message: 'Audio converted successfully',
                    data: {
                        outputFile: outputFilePath,
                        fileName: outputFileName,
                        format: outputFormat,
                        fileSizeMB: parseFloat(fileSizeMB),
                        downloadUrl: downloadUrl
                    }
                });
            })
            .on('error', (err) => {
                console.error('❌ FFmpeg conversion error:', err);

                // Clean up partial output file if exists
                if (fs.existsSync(outputFilePath)) {
                    fs.unlinkSync(outputFilePath);
                }

                // Delete the uploaded audio file
                fs.unlink(inputFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('⚠️ Failed to delete uploaded audio:', unlinkErr.message);
                    } else {
                        console.log('🗑️ Deleted uploaded audio file');
                    }
                });

                res.status(500).json({
                    success: false,
                    message: 'Audio conversion failed',
                    error: err.message
                });
            })
            .run();

    } catch (error) {
        console.error('❌ Conversion error:', error);
        res.status(500).json({
            success: false,
            message: 'Audio conversion failed',
            error: error.message
        });
    }
};

// Download converted audio file
const downloadConvertedAudio = async (req, res) => {
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
        const filePath = path.join(__dirname, '../uploads/audio/output', filename);

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
                    console.log('🗑️ Deleted converted file:', filename);
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
    analyzeAudioMetadata,
    convertAudioFormat,
    downloadConvertedAudio
};
