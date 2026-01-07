const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Extract audio with real-time progress (SSE)
const extractAudioWithProgress = async (req, res) => {
    const { inputFilePath, trackIndex, format } = req.body;

    try {
        // Validate input
        if (!inputFilePath || trackIndex === undefined || !format) {
            return res.status(400).json({
                success: false,
                message: 'Input file path, track index, and format are required'
            });
        }

        // Check if file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Input video file not found'
            });
        }

        // Setup SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Create output directory
        const outputDir = path.join(__dirname, '../uploads/extracted');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate unique output filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const outputFileName = `audio-track-${trackIndex}-${uniqueSuffix}.${format}`;
        const outputFilePath = path.join(outputDir, outputFileName);

        console.log(`🔄 Extracting track ${trackIndex}`);

        // Get audio duration first
        ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
            if (err) {
                console.error(`❌ FFprobe error for track ${trackIndex}:`, err.message);
                res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to read video metadata' })}\n\n`);
                res.end();
                return;
            }

            console.log(`📊 Metadata for track ${trackIndex}:`, metadata.streams.length, 'streams found');

            // Find the specific audio stream by stream index
            const audioStream = metadata.streams.find(s => s.index === trackIndex);

            if (!audioStream) {
                console.error(`❌ Stream ${trackIndex} not found in metadata`);
                res.write(`data: ${JSON.stringify({ type: 'error', error: `Audio stream ${trackIndex} not found` })}\n\n`);
                res.end();
                return;
            }

            if (audioStream.codec_type !== 'audio') {
                console.error(`❌ Stream ${trackIndex} is not an audio stream:`, audioStream.codec_type);
                res.write(`data: ${JSON.stringify({ type: 'error', error: `Stream ${trackIndex} is not an audio stream` })}\n\n`);
                res.end();
                return;
            }

            // Get duration with multiple fallbacks
            let duration = audioStream.duration || audioStream.tags?.DURATION || metadata.format.duration;

            // Parse duration if it's a string (format: HH:MM:SS.MS)
            if (typeof duration === 'string') {
                const parts = duration.split(':');
                if (parts.length === 3) {
                    duration = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
                }
            }

            duration = parseFloat(duration);

            if (!duration || isNaN(duration) || duration <= 0) {
                console.warn(`⚠️ No valid duration found for track ${trackIndex}, using estimation`);
                duration = null; // Will skip progress percentage
            }

            console.log(`   Stream ${trackIndex} info:`, {
                codec: audioStream.codec_name,
                duration: duration ? `${duration.toFixed(2)}s` : 'unknown',
                channels: audioStream.channels,
                sample_rate: audioStream.sample_rate
            });

            // Determine audio codec based on format
            let audioCodec;
            if (format === 'mp3') {
                audioCodec = 'libmp3lame';
            } else if (format === 'wav') {
                audioCodec = 'pcm_s16le';
            } else if (format === 'm4a' || format === 'aac') {
                audioCodec = 'aac';
            } else {
                audioCodec = 'copy'; // Copy the original codec
            }

            console.log(`   Using codec: ${audioCodec} for format: ${format}`);

            // Start extraction
            const command = ffmpeg(inputFilePath);

            command
                .outputOptions([
                    `-map 0:${trackIndex}`, // Select specific audio stream by index
                    '-vn', // No video
                    '-acodec', audioCodec
                ])
                .output(outputFilePath)
                .on('start', (commandLine) => {
                    console.log('   FFmpeg command:', commandLine);
                    res.write(`data: ${JSON.stringify({ type: 'start', progress: 0 })}\n\n`);
                })
                .on('progress', (progress) => {
                    // Only send progress if we have duration
                    if (progress.timemark && duration) {
                        // Parse timemark (format: HH:MM:SS.MS)
                        const timeparts = progress.timemark.split(':');
                        const hours = parseInt(timeparts[0]) || 0;
                        const minutes = parseInt(timeparts[1]) || 0;
                        const seconds = parseFloat(timeparts[2]) || 0;
                        const currentTime = hours * 3600 + minutes * 60 + seconds;

                        // Calculate accurate percentage
                        const percent = Math.min(Math.round((currentTime / duration) * 100), 99);

                        console.log(`   Track ${trackIndex} Progress: ${percent}% (${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s)`);

                        // Send progress update via SSE
                        res.write(`data: ${JSON.stringify({
                            type: 'progress',
                            progress: percent,
                            currentTime: currentTime.toFixed(1),
                            totalTime: duration.toFixed(1),
                            trackIndex
                        })}\n\n`);
                    }
                })
                .on('end', () => {
                    console.log(`✅ Track ${trackIndex} extracted successfully`);

                    // Get file size
                    const stats = fs.statSync(outputFilePath);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                    // Generate download URL
                    const downloadUrl = `${req.protocol}://${req.get('host')}/api/extract-audio/download/${outputFileName}`;

                    const completeData = {
                        type: 'complete',
                        progress: 100,
                        trackIndex,
                        data: {
                            outputFile: outputFilePath,
                            fileName: outputFileName,
                            format: format,
                            fileSizeMB: parseFloat(fileSizeMB),
                            downloadUrl: downloadUrl
                        }
                    };

                    // Send completion
                    console.log(`📤 Sending completion event for track ${trackIndex}:`, completeData);
                    res.write(`data: ${JSON.stringify(completeData)}\n\n`);

                    // Ensure data is flushed before ending
                    if (res.flush) res.flush();

                    res.end();
                })
                .on('error', (err) => {
                    console.error(`❌ Track ${trackIndex} extraction error:`, err);

                    // Cleanup
                    if (fs.existsSync(outputFilePath)) {
                        fs.unlinkSync(outputFilePath);
                    }

                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        trackIndex,
                        error: err.message
                    })}\n\n`);
                    res.end();
                })
                .run();
        });

    } catch (error) {
        console.error('❌ Setup error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
};

module.exports = {
    extractAudioWithProgress
};
