import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useR2Upload } from '../../hooks/useR2Upload';
import { useJobProcessing } from '../../hooks/useJobProcessing';
import { getDownloadUrl, downloadFromR2 } from '../../utils/r2ApiService';
import axios from 'axios';
import QueueStatus from '../../components/QueueStatus';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const ConvertAudio = () => {
    // File selection
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    // R2 Upload hook
    const { upload: uploadToR2, uploading, progress: uploadProgress, objectKey, reset: resetUpload } = useR2Upload({
        allowedTypes: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', 'audio/'],
        maxSize: 1 * 1024 * 1024 * 1024, // 1GB for audio
    });

    // Job Processing hook
    const {
        startProcessing,
        jobId,
        status: jobStatus,
        progress: processingProgress,
        timemark,
        queuePosition,
        isQueued,
        isProcessing,
        isCompleted,
        reset: resetJob
    } = useJobProcessing();

    // Audio metadata
    const [analyzing, setAnalyzing] = useState(false);
    const [metadata, setMetadata] = useState(null);

    // Conversion settings
    const [selectedFormat, setSelectedFormat] = useState('mp3');
    const [selectedBitrate, setSelectedBitrate] = useState('192k');

    // Download state
    const [downloadUrl, setDownloadUrl] = useState(null);

    // Watch for job completion and get download URL
    useEffect(() => {
        const fetchDownloadUrl = async () => {
            if (isCompleted && jobId && !downloadUrl) {
                try {
                    console.log('Job completed, fetching download URL for jobId:', jobId);
                    const downloadData = await getDownloadUrl(jobId);
                    setDownloadUrl(downloadData);
                    toast.success('Conversion completed! Ready to download.');
                } catch (error) {
                    console.error('Failed to get download URL:', error);
                    toast.error('Processing completed but failed to generate download link');
                }
            }
        };

        fetchDownloadUrl();
    }, [isCompleted, jobId, downloadUrl]);

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
            setMetadata(null);
            setDownloadUrl(null);
            toast.info(`Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        }
    };

    const analyzeAudio = async () => {
        if (!selectedFile) {
            toast.error('Please select an audio file first');
            return;
        }

        try {
            // Upload to R2
            const key = await uploadToR2(selectedFile);

            // Analyze the uploaded file
            setAnalyzing(true);
            const response = await axios.post(`${API_BASE_URL}/analyze`, {
                objectKey: key
            });

            if (!response.data.success) {
                throw new Error(response.data.message || 'Analysis failed');
            }

            const audioData = response.data.data.audio?.[0];
            if (!audioData) {
                throw new Error('No audio stream found');
            }

            setMetadata({
                codec: audioData.codec,
                sampleRate: audioData.sampleRate,
                bitrate: audioData.bitrate,
                channels: audioData.channels,
                duration: response.data.data.duration
            });

            toast.success('Audio analyzed successfully!');

        } catch (error) {
            console.error('Analysis error:', error);
            toast.error(error.message || 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const convertAudio = async () => {
        if (!objectKey) {
            toast.error('Please upload and analyze a file first');
            return;
        }

        try {
            await startProcessing(objectKey, 'audio-convert', {
                format: selectedFormat,
                bitrate: selectedBitrate,
                sampleRate: 44100
            });
        } catch (error) {
            console.error('Conversion error:', error);
            toast.error(error.message || 'Conversion failed');
        }
    };

    const downloadFile = async () => {
        if (!downloadUrl) return;

        try {
            // Regenerate fresh URL to avoid expiration
            const freshDownloadData = await getDownloadUrl(jobId);
            downloadFromR2(freshDownloadData.downloadUrl, freshDownloadData.fileName);
            toast.success(`Download started: ${freshDownloadData.fileName}`);
        } catch (error) {
            console.error('Failed to generate fresh download URL:', error);
            toast.error('Failed to generate download link. Please try again.');
        }
    };

    const resetForm = async () => {
        // Cleanup R2 files if job exists
        if (jobId) {
            try {
                await axios.post(`${API_BASE_URL}/cleanup/${jobId}`);
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }

        setSelectedFile(null);
        setMetadata(null);
        setDownloadUrl(null);
        setSelectedFormat('mp3');
        setSelectedBitrate('192k');
        resetJob();
        resetUpload();
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

    const isAnalyzing = uploading || analyzing;
    const canAnalyze = selectedFile && !isAnalyzing && !isProcessing && !isQueued && !downloadUrl;
    const canConvert = metadata && !isProcessing && !isQueued && !isAnalyzing && !downloadUrl;

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

                    {/* Selected File - Not Analyzed */}
                    {selectedFile && !metadata && !downloadUrl && (
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
                                        disabled={isAnalyzing}
                                    >
                                        <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
                                    </button>
                                </div>

                                {/* Upload Progress */}
                                {uploading && (
                                    <div className="mb-3 md:mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs md:text-sm text-white font-medium">Uploading to cloud...</span>
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

                                {/* Analyzing */}
                                {analyzing && (
                                    <div className="flex items-center justify-center gap-2 text-primary">
                                        <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                                        <span className="text-sm font-medium">Analyzing audio...</span>
                                    </div>
                                )}
                            </div>

                            {!isAnalyzing && (
                                <button
                                    onClick={analyzeAudio}
                                    disabled={!canAnalyze}
                                    className="flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-xs md:text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">analytics</span>
                                    Upload & Analyze
                                </button>
                            )}
                        </div>
                    )}

                    {/* Queue Status */}
                    {isQueued && queuePosition && (
                        <div className="mb-6">
                            <QueueStatus status={jobStatus} queuePosition={queuePosition} />
                        </div>
                    )}

                    {/* Processing Status */}
                    {isProcessing && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="mb-4 md:mb-6 p-4 md:p-5 lg:p-6 bg-primary/10 border border-primary/30 rounded-lg w-full max-w-md">
                                <div className="flex items-center gap-3 mb-3 md:mb-4">
                                    <span className="material-symbols-outlined text-primary animate-spin text-[24px]">sync</span>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">Converting Audio</h3>
                                        <p className="text-text-muted text-xs">Converting to {selectedFormat.toUpperCase()}</p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-muted">Progress</span>
                                        <span className="text-primary font-bold">{processingProgress}%</span>
                                    </div>
                                    <div className="w-full bg-surface-dark rounded-full h-3">
                                        <div
                                            className="bg-primary h-full transition-all duration-300 rounded-full"
                                            style={{ width: `${processingProgress}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-text-muted">
                                        <span>Time: {timemark}</span>
                                        <span>{jobStatus}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* File Analyzed - Ready to Convert */}
                    {metadata && !isProcessing && !isQueued && !downloadUrl && (
                        <div className="w-full max-w-4xl mx-auto">
                            <div className="p-3 md:p-4 lg:p-5 bg-primary/10 border border-primary/30 rounded-lg mb-3 md:mb-4">
                                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                                    <span className="material-symbols-outlined text-primary text-[24px] md:text-[28px] lg:text-[32px]">check_circle</span>
                                    <div>
                                        <h3 className="text-white font-bold text-xs md:text-sm">Analysis Complete!</h3>
                                        <p className="text-text-muted text-[10px] md:text-xs">Select format and quality to convert</p>
                                    </div>
                                </div>

                                {/* Metadata Grid */}
                                <div className="border-t border-border-dark/50 pt-3 md:pt-4 mb-3 md:mb-4">
                                    <h4 className="text-white font-bold text-xs md:text-sm mb-2 md:mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] md:text-[18px] text-primary">analytics</span>
                                        Audio Properties
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
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
                                    disabled={!canConvert}
                                    className="flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-xs md:text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">transform</span>
                                    Convert to {selectedFormat.toUpperCase()}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Conversion Complete */}
                    {downloadUrl && (
                        <div className="flex flex-col items-center justify-center h-full px-2">
                            <div className="mb-4 md:mb-6 p-4 md:p-5 lg:p-6 bg-primary/10 border border-primary/30 rounded-lg w-full max-w-md">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="material-symbols-outlined text-primary text-[32px]">check_circle</span>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">Conversion Complete!</h3>
                                        <p className="text-text-muted text-xs">Your file is ready to download</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between items-center p-2 bg-surface-dark/50 rounded-lg">
                                        <span className="text-text-muted text-xs">Format</span>
                                        <span className="text-white font-bold text-sm uppercase">{selectedFormat}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-2 bg-surface-dark/50 rounded-lg">
                                        <span className="text-text-muted text-xs">Size</span>
                                        <span className="text-white font-bold text-sm">{(downloadUrl.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                                    </div>
                                </div>

                                <button
                                    onClick={downloadFile}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 hover:border-primary/50 text-sm rounded-lg transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    Download
                                </button>

                                <button
                                    onClick={resetForm}
                                    className="w-full mt-3 px-6 py-2 bg-transparent border border-border-dark hover:border-text-muted text-white font-medium text-sm rounded-lg transition-all"
                                >
                                    Convert Another File
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
                        <span className="hidden sm:inline">R2 Cloud Storage</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px] md:text-[14px]">bolt</span>
                        <span className="hidden sm:inline">Fast Processing</span>
                    </span>
                </div>
                <div>v3.1.0</div>
            </div>
        </div>
    );
};

export default ConvertAudio;
