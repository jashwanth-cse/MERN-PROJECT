import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = 'http://localhost:3000/api/audio-convert';

const ConvertAudio = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFileData, setUploadedFileData] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [metadata, setMetadata] = useState(null);
    const [selectedFormat, setSelectedFormat] = useState('mp3');
    const [selectedBitrate, setSelectedBitrate] = useState('192k');
    const [converting, setConverting] = useState(false);
    const [conversionProgress, setConversionProgress] = useState(0);
    const [convertedFile, setConvertedFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const validExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
            const fileExtension = `.${file.name.split('.').pop().toLowerCase()}`;

            if (!validExtensions.includes(fileExtension)) {
                toast.error('Unsupported audio format. Please select MP3, WAV, FLAC, AAC, OGG, or M4A.');
                return;
            }

            setSelectedFile(file);
            setUploadedFileData(null);
            setMetadata(null);
            setConvertedFile(null);
            setConversionProgress(0);
            toast.info(`Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        }
    };

    const uploadAudioFile = async () => {
        if (!selectedFile) {
            toast.error('Please select an audio file first');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            // Step 1: Upload file
            const formData = new FormData();
            formData.append('file', selectedFile);

            const uploadResponse = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });

            if (!uploadResponse.data.success) {
                throw new Error(uploadResponse.data.message);
            }

            setUploadedFileData(uploadResponse.data);
            toast.success('Audio file uploaded successfully!');
            setUploading(false);

            // Step 2: Analyze metadata
            setAnalyzing(true);
            const analyzeResponse = await axios.post(`${API_URL}/analyze`, {
                inputFilePath: uploadResponse.data.inputFilePath
            });

            if (!analyzeResponse.data.success) {
                throw new Error(analyzeResponse.data.message);
            }

            setMetadata(analyzeResponse.data.metadata);
            toast.success('Audio metadata analyzed successfully!');

        } catch (error) {
            console.error('Error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Operation failed';
            toast.error(errorMessage);
        } finally {
            setUploading(false);
            setAnalyzing(false);
        }
    };

    const convertAudio = async () => {
        if (!uploadedFileData) {
            toast.error('Please upload an audio file first');
            return;
        }

        setConverting(true);
        setConversionProgress(0);

        try {
            // Create request body
            const requestBody = {
                inputFilePath: uploadedFileData.inputFilePath,
                outputFormat: selectedFormat,
                bitrate: selectedBitrate
            };

            // Use EventSource for SSE (Server-Sent Events)
            const eventSource = new EventSource(
                `${API_URL}/convert-stream?` + new URLSearchParams({
                    inputFilePath: requestBody.inputFilePath,
                    outputFormat: requestBody.outputFormat,
                    bitrate: requestBody.bitrate
                })
            );

            // For POST with SSE, we need to use fetch with streaming
            const response = await fetch(`${API_URL}/convert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Failed to start conversion');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                // Append new chunk to buffer
                buffer += decoder.decode(value, { stream: true });

                // Split by lines
                const lines = buffer.split('\n');

                // Keep the last line in the buffer as it might be incomplete
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim().startsWith('data: ')) {
                        try {
                            const jsonStr = line.trim().slice(6).trim();
                            if (!jsonStr) continue;

                            const data = JSON.parse(jsonStr);

                            if (data.type === 'start') {
                                setConversionProgress(0);
                                console.log('🔄 Conversion started');
                            } else if (data.type === 'progress') {
                                setConversionProgress(data.progress);
                                console.log(`📊 Progress: ${data.progress}% (${data.currentTime}s / ${data.totalTime}s)`);
                            } else if (data.type === 'complete') {
                                setConversionProgress(100);
                                setConvertedFile(data.data);
                                toast.success(`Audio converted to ${selectedFormat.toUpperCase()} successfully!`);
                                console.log('✅ Conversion complete!');
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (parseError) {
                            console.warn('⚠️ JSON parse error:', parseError.message);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Conversion error:', error);
            const errorMessage = error.message || 'Conversion failed';
            toast.error(errorMessage);
        } finally {
            setConverting(false);
        }
    };

    const resetForm = () => {
        setSelectedFile(null);
        setUploadedFileData(null);
        setMetadata(null);
        setConvertedFile(null);
        setUploadProgress(0);
        setConversionProgress(0);
        setSelectedFormat('mp3');
        setSelectedBitrate('192k');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const downloadFile = (url) => {
        window.open(url, '_blank');
        toast.success('Download started!');

        // Reset form after initiating download
        setTimeout(() => {
            resetForm();
            toast.info('Ready for next conversion!');
        }, 2000);
    };

    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.flac,.aac,.ogg,.m4a,audio/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Main Content Area */}
            <div className="flex-1 border-2 border-dashed border-border-dark rounded-2xl md:rounded-3xl bg-surface-dark/20 transition-all duration-300 flex flex-col overflow-hidden">

                {/* Header Section */}
                <div className="p-3 md:p-4 lg:p-5 border-b border-border-dark/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-white mb-1">Convert Audio Format</h2>
                            <p className="text-text-muted text-xs md:text-sm">Upload, analyze, and convert audio files between formats</p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">

                    {/* No File Selected */}
                    {!selectedFile && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="size-16 md:size-20 lg:size-24 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-4 md:mb-6 shadow-2xl">
                                <span className="material-symbols-outlined text-[32px] md:text-[40px] text-primary">audio_file</span>
                            </div>
                            <h3 className="text-base md:text-lg lg:text-xl font-bold text-white mb-2">No Audio File Selected</h3>
                            <p className="text-text-muted text-xs md:text-sm mb-4 md:mb-6 text-center px-4">Choose an audio file to convert between formats</p>
                            <button
                                onClick={triggerFileSelect}
                                className="flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-xs md:text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1"
                            >
                                <span className="material-symbols-outlined text-[16px] md:text-[18px]">folder_open</span>
                                Select Audio File
                            </button>
                        </div>
                    )}

                    {/* Selected File - Not Uploaded */}
                    {selectedFile && !uploadedFileData && (
                        <div className="flex flex-col items-center justify-center h-full px-2">
                            <div className="mb-4 md:mb-6 p-4 md:p-5 lg:p-6 bg-primary/10 border border-primary/30 rounded-lg w-full max-w-md">
                                <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                                    <span className="material-symbols-outlined text-primary text-[28px] md:text-[32px]">audio_file</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium text-xs md:text-sm mb-1 truncate">{selectedFile.name}</p>
                                        <p className="text-text-muted text-[10px] md:text-xs">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                    <button
                                        onClick={resetForm}
                                        className="text-red-400 hover:text-red-300 flex-shrink-0"
                                        disabled={uploading}
                                    >
                                        <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
                                    </button>
                                </div>

                                {/* Upload Progress */}
                                {uploading && (
                                    <div className="mb-3 md:mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs md:text-sm text-white font-medium">Uploading...</span>
                                            <span className="text-xs md:text-sm text-primary font-bold">{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full bg-surface-dark rounded-full h-2">
                                            <div
                                                className="bg-primary h-full transition-all duration-300 rounded-full"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!uploading && (
                                <button
                                    onClick={uploadAudioFile}
                                    className="flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-xs md:text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1"
                                >
                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">upload</span>
                                    Upload & Analyze
                                </button>
                            )}
                        </div>
                    )}

                    {/* File Uploaded - Analyzing */}
                    {uploadedFileData && analyzing && (
                        <div className="flex flex-col items-center justify-center h-full px-2">
                            <div className="mb-4 md:mb-6 p-4 md:p-5 lg:p-6 bg-primary/10 border border-primary/30 rounded-lg w-full max-w-md">
                                <div className="flex items-center justify-center gap-3 mb-3 md:mb-4">
                                    <span className="material-symbols-outlined text-primary animate-spin text-[28px] md:text-[32px]">refresh</span>
                                    <div>
                                        <h3 className="text-white font-bold text-xs md:text-sm">Analyzing Audio...</h3>
                                        <p className="text-text-muted text-[10px] md:text-xs">Extracting metadata using FFprobe</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* File Analyzed Successfully - Ready to Convert */}
                    {uploadedFileData && metadata && !analyzing && !converting && !convertedFile && (
                        <div className="w-full max-w-4xl mx-auto">
                            <div className="p-3 md:p-4 lg:p-5 bg-primary/10 border border-primary/30 rounded-lg mb-3 md:mb-4">
                                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                                    <span className="material-symbols-outlined text-primary text-[24px] md:text-[28px] lg:text-[32px]">check_circle</span>
                                    <div>
                                        <h3 className="text-white font-bold text-xs md:text-sm">Analysis Complete!</h3>
                                        <p className="text-text-muted text-[10px] md:text-xs">Select format and quality to convert</p>
                                    </div>
                                </div>

                                {/* File Info */}
                                <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4">
                                    <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                        <span className="text-text-muted text-[10px] md:text-xs block mb-1">Original Format</span>
                                        <span className="text-white font-bold text-xs md:text-sm uppercase">{uploadedFileData.originalFormat}</span>
                                    </div>
                                    <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                        <span className="text-text-muted text-[10px] md:text-xs block mb-1">File Size</span>
                                        <span className="text-white font-bold text-xs md:text-sm">{uploadedFileData.data.fileSizeMB} MB</span>
                                    </div>
                                </div>

                                {/* Metadata Grid */}
                                <div className="border-t border-border-dark/50 pt-3 md:pt-4 mb-3 md:mb-4">
                                    <h4 className="text-white font-bold text-xs md:text-sm mb-2 md:mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] md:text-[18px] text-primary">analytics</span>
                                        Audio Properties
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
                                        <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                            <span className="text-text-muted text-[10px] md:text-xs block mb-1">Codec</span>
                                            <span className="text-white font-bold text-xs md:text-sm uppercase break-all">{metadata.codec}</span>
                                        </div>
                                        <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                            <span className="text-text-muted text-[10px] md:text-xs block mb-1">Sample Rate</span>
                                            <span className="text-white font-bold text-xs md:text-sm">{metadata.sampleRate ? `${(metadata.sampleRate / 1000).toFixed(1)} kHz` : 'N/A'}</span>
                                        </div>
                                        <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                            <span className="text-text-muted text-[10px] md:text-xs block mb-1">Bitrate</span>
                                            <span className="text-white font-bold text-xs md:text-sm">{metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps` : 'N/A'}</span>
                                        </div>
                                        <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                            <span className="text-text-muted text-[10px] md:text-xs block mb-1">Channels</span>
                                            <span className="text-white font-bold text-xs md:text-sm">{metadata.channels || 'N/A'}</span>
                                        </div>
                                        <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                            <span className="text-text-muted text-[10px] md:text-xs block mb-1">Layout</span>
                                            <span className="text-white font-bold text-xs md:text-sm capitalize">{metadata.channelLayout}</span>
                                        </div>
                                        <div className="p-2 md:p-3 bg-surface-dark/50 rounded-lg">
                                            <span className="text-text-muted text-[10px] md:text-xs block mb-1">Duration</span>
                                            <span className="text-white font-bold text-xs md:text-sm">{formatDuration(metadata.duration)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversion Settings */}
                                <div className="border-t border-border-dark/50 pt-3 md:pt-4">
                                    <h4 className="text-white font-bold text-xs md:text-sm mb-2 md:mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] md:text-[18px] text-primary">settings</span>
                                        Conversion Settings
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                                        <div>
                                            <label className="text-text-muted text-[10px] md:text-xs block mb-1">Output Format</label>
                                            <select
                                                value={selectedFormat}
                                                onChange={(e) => setSelectedFormat(e.target.value)}
                                                className="w-full px-3 py-2 bg-[#1a1a1a] border border-border-dark rounded-lg text-white text-xs md:text-sm focus:border-primary focus:outline-none appearance-none cursor-pointer"
                                                style={{
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                                    backgroundPosition: 'right 0.5rem center',
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundSize: '1.5em 1.5em',
                                                    paddingRight: '2.5rem'
                                                }}
                                            >
                                                <option value="mp3" className="bg-[#1a1a1a] text-white">MP3</option>
                                                <option value="wav" className="bg-[#1a1a1a] text-white">WAV</option>
                                                <option value="flac" className="bg-[#1a1a1a] text-white">FLAC</option>
                                                <option value="aac" className="bg-[#1a1a1a] text-white">AAC</option>
                                                <option value="ogg" className="bg-[#1a1a1a] text-white">OGG</option>
                                                <option value="m4a" className="bg-[#1a1a1a] text-white">M4A</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-text-muted text-[10px] md:text-xs block mb-1">Bitrate (for lossy formats)</label>
                                            <select
                                                value={selectedBitrate}
                                                onChange={(e) => setSelectedBitrate(e.target.value)}
                                                className="w-full px-3 py-2 bg-[#1a1a1a] border border-border-dark rounded-lg text-white text-xs md:text-sm focus:border-primary focus:outline-none appearance-none cursor-pointer"
                                                style={{
                                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                                    backgroundPosition: 'right 0.5rem center',
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundSize: '1.5em 1.5em',
                                                    paddingRight: '2.5rem'
                                                }}
                                                disabled={selectedFormat === 'wav' || selectedFormat === 'flac'}
                                            >
                                                <option value="128k" className="bg-[#1a1a1a] text-white">128 kbps</option>
                                                <option value="192k" className="bg-[#1a1a1a] text-white">192 kbps</option>
                                                <option value="256k" className="bg-[#1a1a1a] text-white">256 kbps</option>
                                                <option value="320k" className="bg-[#1a1a1a] text-white">320 kbps</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={resetForm}
                                    className="flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-transparent border border-border-dark hover:border-text-muted text-white font-medium text-xs md:text-sm rounded-lg transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">refresh</span>
                                    Start Over
                                </button>
                                <button
                                    onClick={convertAudio}
                                    className="flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-xs md:text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1"
                                >
                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">transform</span>
                                    Convert to {selectedFormat.toUpperCase()}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Converting */}
                    {converting && (
                        <div className="flex flex-col items-center justify-center h-full px-2">
                            <div className="mb-4 md:mb-6 p-4 md:p-5 lg:p-6 bg-primary/10 border border-primary/30 rounded-lg w-full max-w-md">
                                <div className="flex items-center justify-center gap-3 mb-3 md:mb-4">
                                    <span className="material-symbols-outlined text-primary animate-spin text-[28px] md:text-[32px]">refresh</span>
                                    <div>
                                        <h3 className="text-white font-bold text-xs md:text-sm">Converting Audio...</h3>
                                        <p className="text-text-muted text-[10px] md:text-xs">Converting to {selectedFormat.toUpperCase()}</p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs md:text-sm text-white font-medium">Progress</span>
                                        <span className="text-xs md:text-sm text-primary font-bold">{conversionProgress}%</span>
                                    </div>
                                    <div className="w-full bg-surface-dark rounded-full h-2">
                                        <div
                                            className="bg-primary h-full transition-all duration-300 rounded-full"
                                            style={{ width: `${conversionProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Conversion Complete */}
                    {convertedFile && !converting && (
                        <div className="flex flex-col items-center justify-center h-full px-2">
                            <div className="mb-4 md:mb-6 p-4 md:p-5 lg:p-6 bg-primary/10 border border-primary/30 rounded-lg w-full max-w-md">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="material-symbols-outlined text-primary text-[32px]">check_circle</span>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">Conversion Complete!</h3>
                                        <p className="text-text-muted text-xs">Download will start automatically</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between items-center p-2 bg-surface-dark/50 rounded-lg">
                                        <span className="text-text-muted text-xs">Format</span>
                                        <span className="text-white font-bold text-sm uppercase">{convertedFile.format}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 bg-surface-dark/50 rounded-lg">
                                        <span className="text-text-muted text-xs">Size</span>
                                        <span className="text-white font-bold text-sm">{convertedFile.fileSizeMB} MB</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => downloadFile(convertedFile.downloadUrl)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 hover:border-primary/50 text-sm rounded-lg transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    Download 
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Footer */}
            <div className="mt-3 md:mt-4 lg:mt-6 flex justify-between items-center text-[10px] md:text-xs text-text-muted px-2 opacity-60">
                <div className="flex gap-2 md:gap-4">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px] md:text-[14px]">check_circle</span>
                        <span className="hidden sm:inline">System Operational</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px] md:text-[14px]">bolt</span>
                        <span className="hidden sm:inline">Fast Processing</span>
                    </span>
                </div>
                <div>v3.0.0</div>
            </div>
        </div>
    );
};

export default ConvertAudio;
