const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// In-memory storage for active conversions
const activeConversions = new Map();

// Convert audio with real-time progress (SSE)
const convertAudioWithProgress = async (req, res) => {
    const { inputFilePath, outputFormat, bitrate } = req.body;

    try {
        // Validate input
        if (!inputFilePath || !outputFormat) {
            return res.status(400).json({
                success: false,
                message: 'Input file path and output format are required'
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

        // Check if file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Input audio file not found'
            });
        }

        // Setup SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Create output directory
        const outputDir = path.join(__dirname, '../uploads/audio/output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate unique output filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const outputFileName = `audio-${uniqueSuffix}.${outputFormat}`;
        const outputFilePath = path.join(outputDir, outputFileName);
        const conversionId = uniqueSuffix.toString();

        console.log('🔄 Starting conversion:', conversionId);

        // Get audio duration first
        ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
            if (err) {
                res.write(`data: ${JSON.stringify({ error: 'Failed to read audio duration' })}\n\n`);
                res.end();
                return;
            }

            const duration = metadata.format.duration;
            console.log('   Total Duration:', duration, 'seconds');

            // Start conversion
            const command = ffmpeg(inputFilePath);

            // Format-specific settings
            if (outputFormat === 'mp3' || outputFormat === 'aac' || outputFormat === 'ogg' || outputFormat === 'm4a') {
                command.outputOptions([
                    '-vn',
                    '-ar 44100',
                    '-ac 2',
                    `-b:a ${bitrate || '192k'}`
                ]);
            } else {
                command.outputOptions(['-vn']);
            }

            command
                .output(outputFilePath)
                .on('start', (commandLine) => {
                    console.log('   FFmpeg command:', commandLine);
                    res.write(`data: ${JSON.stringify({ type: 'start', progress: 0 })}\n\n`);
                })
                .on('progress', (progress) => {
                    if (progress.timemark && duration) {
                        // Parse timemark (format: HH:MM:SS.MS)
                        const timeparts = progress.timemark.split(':');
                        const hours = parseInt(timeparts[0]) || 0;
                        const minutes = parseInt(timeparts[1]) || 0;
                        const seconds = parseFloat(timeparts[2]) || 0;
                        const currentTime = hours * 3600 + minutes * 60 + seconds;

                        // Calculate accurate percentage
                        const percent = Math.min(Math.round((currentTime / duration) * 100), 99);

                        console.log(`   Progress: ${percent}% (${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s)`);

                        // Send progress update via SSE
                        res.write(`data: ${JSON.stringify({
                            type: 'progress',
                            progress: percent,
                            currentTime: currentTime.toFixed(1),
                            totalTime: duration.toFixed(1)
                        })}\n\n`);
                    }
                })
                .on('end', () => {
                    console.log('✅ Conversion completed:', conversionId);

                    // Get file size
                    const stats = fs.statSync(outputFilePath);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                    // Generate download URL
                    const downloadUrl = `${req.protocol}://${req.get('host')}/api/audio-convert/download/${outputFileName}`;

                    // Delete input file
                    fs.unlink(inputFilePath, (err) => {
                        if (err) console.error('⚠️ Failed to delete input:', err.message);
                        else console.log('🗑️ Deleted input file');
                    });

                    // Send completion
                    res.write(`data: ${JSON.stringify({
                        type: 'complete',
                        progress: 100,
                        data: {
                            outputFile: outputFilePath,
                            fileName: outputFileName,
                            format: outputFormat,
                            fileSizeMB: parseFloat(fileSizeMB),
                            downloadUrl: downloadUrl
                        }
                    })}\n\n`);
                    res.end();
                })
                .on('error', (err) => {
                    console.error('❌ Conversion error:', err);

                    // Cleanup
                    if (fs.existsSync(outputFilePath)) {
                        fs.unlinkSync(outputFilePath);
                    }
                    fs.unlink(inputFilePath, () => { });

                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: err.message
                    })}\n\n`);
                    res.end();
                })
                .run();

            // Store active conversion
            activeConversions.set(conversionId, command);
        });

    } catch (error) {
        console.error('❌ Setup error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
};

module.exports = {
    convertAudioWithProgress
};
