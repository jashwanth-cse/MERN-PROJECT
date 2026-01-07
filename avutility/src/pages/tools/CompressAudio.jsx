import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = 'http://localhost:3000/api/audio-compress';

const CompressAudio = () => {
    const [audioFile, setAudioFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [compressionProgress, setCompressionProgress] = useState(0);
    const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
    const [audioMetadata, setAudioMetadata] = useState(null);
    const [compressionResult, setCompressionResult] = useState(null);
    const [selectedQuality, setSelectedQuality] = useState('medium');
    const [selectedBitrate, setSelectedBitrate] = useState('128k');
    const fileInputRef = useRef(null);

    // Supported formats
    const SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];

    // Quality options
    const qualityOptions = [
        { value: 'low', label: 'Low Quality', bitrate: '96k', desc: 'Smaller size' },
        { value: 'medium', label: 'Medium Quality', bitrate: '128k', desc: 'Balanced' },
        { value: 'high', label: 'High Quality', bitrate: '192k', desc: 'Best quality' }
    ];

    // Bitrate options
    const bitrateOptions = ['64k', '96k', '128k', '192k', '256k', '320k'];

    // Handle file selection
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!SUPPORTED_FORMATS.includes(fileExtension)) {
            toast.error(`Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
            return;
        }

        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('File too large. Maximum size: 500MB');
            return;
        }

        setAudioFile(file);
        toast.info(`Selected: ${file.name}`);
    };

    // Upload file to backend
    const handleUpload = async () => {
        if (!audioFile) {
            toast.error('Please select an audio file first');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', audioFile);

        try {
            const uploadResponse = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (uploadResponse.data.success) {
                setUploadedFileInfo(uploadResponse.data);
                toast.success('Audio file uploaded successfully!');
                await analyzeAudio(uploadResponse.data.inputFilePath);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    // Analyze audio metadata
    const analyzeAudio = async (inputFilePath) => {
        setAnalyzing(true);
        try {
            const analyzeResponse = await axios.post(`${API_URL}/analyze`, {
                inputFilePath: inputFilePath
            });

            if (analyzeResponse.data.success) {
                setAudioMetadata(analyzeResponse.data.metadata);
                toast.success('Audio analyzed successfully!');
            }
        } catch (error) {
            console.error('Analyze error:', error);
            toast.error(error.response?.data?.message || 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    // Compress audio with SSE
    const handleCompress = async () => {
        if (!uploadedFileInfo) {
            toast.error('Please upload a file first');
            return;
        }

        // Check for custom configuration (high bitrate with low/medium quality)
        const bitrateNum = parseInt(selectedBitrate.replace('k', ''));
        const isCustom = (selectedQuality === 'low' || selectedQuality === 'medium') && bitrateNum > 192;

        if (isCustom) {
            toast.warning('⚠️ Custom Configuration: High bitrate with low/medium quality. Output file may be larger than original!', {
                autoClose: 5000
            });
        }

        setCompressing(true);
        setCompressionProgress(0);

        console.log('Compressing with settings:', {
            quality: selectedQuality,
            bitrate: selectedBitrate
        });

        try {
            const response = await fetch(`${API_URL}/compress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputFilePath: uploadedFileInfo.inputFilePath,
                    targetBitrate: selectedBitrate,
                    quality: selectedQuality
                })
            });

            if (!response.ok) {
                throw new Error('Compression request failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        try {
                            const data = JSON.parse(jsonStr);

                            if (data.type === 'progress') {
                                setCompressionProgress(data.percent);
                                console.log(`Compression progress: ${data.percent}%`);
                            } else if (data.type === 'complete') {
                                setCompressionResult(data.data);
                                setCompressionProgress(100);
                                toast.success('Audio compressed successfully!');
                                console.log('Compression complete:', data.data);
                            } else if (data.type === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (parseError) {
                            console.error('Parse error:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Compression error:', error);
            toast.error(error.message || 'Compression failed');
        } finally {
            setCompressing(false);
        }
    };

    // Download compressed file
    const handleDownload = () => {
        if (!compressionResult) return;

        const downloadUrl = `http://localhost:3000${compressionResult.downloadUrl}`;
        window.open(downloadUrl, '_blank');
        toast.success('Download started!');
    };

    // Reset everything
    const handleReset = () => {
        setAudioFile(null);
        setUploadedFileInfo(null);
        setAudioMetadata(null);
        setCompressionResult(null);
        setCompressionProgress(0);
        setSelectedQuality('medium');
        setSelectedBitrate('128k');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Format duration
    const formatDuration = (seconds) => {
        if (!seconds) return 'Unknown';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format bitrate
    const formatBitrate = (bitrate) => {
        if (!bitrate) return 'Unknown';
        return `${Math.round(bitrate / 1000)} kbps`;
    };

    return (
        <div className="flex-1 p-6 md:p-10 flex flex-col overflow-auto">
            <div className="flex-shrink-0 border-2 border-dashed border-border-dark rounded-3xl bg-surface-dark/20 hover:bg-surface-dark/30 transition-all duration-300">
                <div className="p-6 w-full max-w-2xl mx-auto">
                    {/* Upload Icon */}
                    <div className="size-24 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-6 shadow-2xl mx-auto">
                        <span className="material-symbols-outlined text-[40px] text-primary">compress</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3 text-center">Compress Audio File</h2>
                    <p className="text-text-muted text-sm max-w-md mb-8 text-center mx-auto">
                        Reduce audio file size while maintaining quality
                    </p>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp3,.wav,.flac,.aac,.ogg,.m4a"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {!audioFile ? (
                        <div className="flex justify-center">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                Select Audio File
                            </button>
                        </div>
                    ) : (
                        <div className="w-full space-y-4">
                            {/* File Info Card */}
                            <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
                                <div className="flex items-start gap-4">
                                    <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-primary text-[24px]">audio_file</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-medium truncate">{audioFile.name}</h3>
                                        <p className="text-text-muted text-sm">
                                            {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {audioFile.name.split('.').pop().toUpperCase()}
                                        </p>
                                    </div>
                                    <button onClick={handleReset} className="text-text-muted hover:text-red-400 transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Upload Button */}
                            {!uploadedFileInfo && (
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-[#2fd16e] disabled:bg-primary/50 disabled:cursor-not-allowed text-background-dark font-bold text-sm rounded-full transition-all"
                                >
                                    {uploading ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin">sync</span>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">cloud_upload</span>
                                            Upload & Analyze
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Analyzing State */}
                            {uploadedFileInfo && analyzing && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                                        <span className="text-white">Analyzing audio metadata...</span>
                                    </div>
                                </div>
                            )}

                            {/* Analysis Results with Compression Settings */}
                            {uploadedFileInfo && audioMetadata && !analyzing && !compressionResult && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-[24px]">analytics</span>
                                        <h3 className="text-white font-bold">Audio Analysis Complete!</h3>
                                    </div>

                                    {/* Metadata Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Codec</p>
                                            <p className="text-white text-sm font-medium">{audioMetadata.codec.toUpperCase()}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Bitrate</p>
                                            <p className="text-white text-sm font-medium">{formatBitrate(audioMetadata.bitrate)}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Duration</p>
                                            <p className="text-white text-sm font-medium">{formatDuration(audioMetadata.duration)}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Channels</p>
                                            <p className="text-white text-sm font-medium">{audioMetadata.channels}</p>
                                        </div>
                                    </div>

                                    {/* Compression Settings */}
                                    <div className="border-t border-border-dark pt-4 space-y-3">
                                        <h4 className="text-white font-medium text-sm">Compression Settings</h4>

                                        {/* Quality Selection - Fixed Selection Visual */}
                                        <div className="grid grid-cols-3 gap-2">
                                            {qualityOptions.map(option => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => {
                                                        setSelectedQuality(option.value);
                                                        setSelectedBitrate(option.bitrate);
                                                    }}
                                                    className={selectedQuality === option.value ? 'p-3 rounded-lg border-2 border-primary bg-primary/20 text-primary font-bold text-center transition-all' : 'p-3 rounded-lg border border-border-dark bg-background-dark/50 text-text-muted hover:border-primary/50 text-center transition-all'}
                                                >
                                                    <p className="text-xs font-bold">{option.label.split(' ')[0]}</p>
                                                    <p className="text-[10px] opacity-70">{option.desc}</p>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Bitrate Selection - Fixed Text Visibility */}
                                        <div>
                                            <label className="text-xs text-text-muted mb-2 block">Target Bitrate</label>
                                            <select
                                                value={selectedBitrate}
                                                onChange={(e) => setSelectedBitrate(e.target.value)}
                                                className="w-full bg-[#1a1f2e] border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none appearance-none cursor-pointer"
                                                style={{ color: 'white', backgroundColor: '#1a1f2e' }}
                                            >
                                                {bitrateOptions.map(br => (
                                                    <option key={br} value={br} style={{ color: 'white', backgroundColor: '#1a1f2e' }}>
                                                        {br}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Custom Configuration Warning */}
                                        {(() => {
                                            const bitrateNum = parseInt(selectedBitrate.replace('k', ''));
                                            const isCustom = (selectedQuality === 'low' || selectedQuality === 'medium') && bitrateNum > 192;

                                            if (isCustom) {
                                                return (
                                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                                        <div className="flex items-start gap-2">
                                                            <span className="material-symbols-outlined text-yellow-500 text-[18px]">warning</span>
                                                            <div>
                                                                <p className="text-yellow-500 text-xs font-bold">Custom Configuration</p>
                                                                <p className="text-yellow-500/80 text-[10px]">High bitrate may result in larger file size than original</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        {/* Compress Button */}
                                        <button
                                            onClick={handleCompress}
                                            disabled={compressing}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] disabled:bg-primary/50 text-background-dark font-bold text-sm rounded-full transition-all"
                                        >
                                            {compressing ? (
                                                <>
                                                    <span className="material-symbols-outlined animate-spin">sync</span>
                                                    Compressing... {compressionProgress}%
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined">compress</span>
                                                    Compress Audio
                                                </>
                                            )}
                                        </button>

                                        {/* Progress Bar */}
                                        {compressing && (
                                            <div className="w-full bg-background-dark rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-primary h-full transition-all duration-300"
                                                    style={{ width: `${compressionProgress}%` }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Compression Result */}
                            {compressionResult && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-[24px]">check_circle</span>
                                        <h3 className="text-white font-bold">Compression Complete!</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Original</p>
                                            <p className="text-white text-sm font-medium">{formatBitrate(compressionResult.originalBitrate)}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Compressed</p>
                                            <p className="text-primary text-sm font-medium">{formatBitrate(compressionResult.compressedBitrate)}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleDownload}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full transition-all"
                                    >
                                        <span className="material-symbols-outlined">download</span>
                                        Download Compressed Audio
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-6 text-xs text-text-muted text-center">
                        Supported: MP3, WAV, FLAC, AAC, OGG, M4A
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompressAudio;
