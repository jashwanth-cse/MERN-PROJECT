import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useR2Upload } from '../../hooks/useR2Upload';
import { useJobProcessing } from '../../hooks/useJobProcessing';
import { getDownloadUrl, downloadFromR2 } from '../../utils/r2ApiService';
import axios from 'axios';
import QueueStatus from '../../components/QueueStatus';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const CompressAudio = () => {
    // File selection
    const [audioFile, setAudioFile] = useState(null);
    const fileInputRef = useRef(null);

    // R2 Upload hook
    const { upload: uploadToR2, uploading, progress: uploadProgress, objectKey, reset: resetUpload } = useR2Upload({
        allowedTypes: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', 'audio/'],
        maxSize: 500 * 1024 * 1024, // 500MB
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
    const [audioMetadata, setAudioMetadata] = useState(null);

    // Compression settings
    const [selectedQuality, setSelectedQuality] = useState('medium');
    const [selectedBitrate, setSelectedBitrate] = useState('128k');

    // Download state
    const [downloadUrl, setDownloadUrl] = useState(null);

    // Quality options
    const qualityOptions = [
        { value: 'low', label: 'Low Quality', bitrate: '96k', desc: 'Smaller size' },
        { value: 'medium', label: 'Medium Quality', bitrate: '128k', desc: 'Balanced' },
        { value: 'high', label: 'High Quality', bitrate: '192k', desc: 'Best quality' }
    ];

    // Bitrate options
    const bitrateOptions = ['64k', '96k', '128k', '192k', '256k', '320k'];

    // Watch for job completion and get download URL
    useEffect(() => {
        const fetchDownloadUrl = async () => {
            if (isCompleted && jobId && !downloadUrl) {
                try {
                    console.log('Job completed, fetching download URL for jobId:', jobId);
                    const downloadData = await getDownloadUrl(jobId);
                    setDownloadUrl(downloadData);
                    toast.success('Compression completed! Ready to download.');
                } catch (error) {
                    console.error('Failed to get download URL:', error);
                    toast.error('Processing completed but failed to generate download link');
                }
            }
        };

        fetchDownloadUrl();
    }, [isCompleted, jobId, downloadUrl]);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();
        const SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];

        if (!SUPPORTED_FORMATS.includes(fileExtension)) {
            toast.error(`Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
            return;
        }

        setAudioFile(file);
        setAudioMetadata(null);
        setDownloadUrl(null);
        toast.info(`Selected: ${file.name}`);
    };

    const handleUpload = async () => {
        if (!audioFile) {
            toast.error('Please select an audio file first');
            return;
        }

        try {
            // Upload to R2
            const key = await uploadToR2(audioFile);

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

            setAudioMetadata({
                codec: audioData.codec,
                bitrate: audioData.bitrate,
                channels: audioData.channels,
                duration: response.data.data.duration
            });

            toast.success('Audio analyzed successfully!');

        } catch (error) {
            console.error('Upload/Analysis error:', error);
            toast.error(error.message || 'Upload/Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCompress = async () => {
        if (!objectKey) {
            toast.error('Please upload a file first');
            return;
        }

        // Check for custom configuration
        const bitrateNum = parseInt(selectedBitrate.replace('k', ''));
        const isCustom = (selectedQuality === 'low' || selectedQuality === 'medium') && bitrateNum > 192;

        if (isCustom) {
            toast.warning('⚠️ High bitrate with low/medium quality may  result in larger file!', {
                autoClose: 5000
            });
        }

        try {
            await startProcessing(objectKey, 'audio-compress', {
                bitrate: selectedBitrate,
                sampleRate: 44100,
                channels: audioMetadata?.channels || 2
            });
        } catch (error) {
            console.error('Compression error:', error);
            toast.error(error.message || 'Compression failed');
        }
    };

    const handleDownload = async () => {
        if (!downloadUrl) return;

        try {
            // Regenerate fresh URL
            const freshDownloadData = await getDownloadUrl(jobId);
            downloadFromR2(freshDownloadData.downloadUrl, freshDownloadData.fileName);
            toast.success('Download started!');
        } catch (error) {
            console.error('Failed to generate fresh download URL:', error);
            toast.error('Failed to generate download link. Please try again.');
        }
    };

    const handleReset = async () => {
        // Cleanup R2 files if job exists
        if (jobId) {
            try {
                await axios.post(`${API_BASE_URL}/cleanup/${jobId}`);
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }

        setAudioFile(null);
        setAudioMetadata(null);
        setDownloadUrl(null);
        setSelectedQuality('medium');
        setSelectedBitrate('128k');
        resetJob();
        resetUpload();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'Unknown';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatBitrate = (bitrate) => {
        if (!bitrate) return 'Unknown';
        return `${Math.round(bitrate / 1000)} kbps`;
    };

    const isAnalyzing = uploading || analyzing;
    const canUpload = audioFile && !isAnalyzing && !isProcessing && !isQueued && !audioMetadata;
    const canCompress = audioMetadata && !isProcessing && !isQueued && !downloadUrl;

    // Check for custom configuration warning
    const bitrateNum = parseInt(selectedBitrate.replace('k', ''));
    const showCustomWarning = (selectedQuality === 'low' || selectedQuality === 'medium') && bitrateNum > 192 && audioMetadata;

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
                            {/* Queue Status */}
                            {isQueued && queuePosition && (
                                <div className="mb-4">
                                    <QueueStatus status={jobStatus} queuePosition={queuePosition} />
                                </div>
                            )}

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
                                    <button onClick={handleReset} className="text-text-muted hover:text-red-400 transition-colors" disabled={isProcessing}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Upload Button */}
                            {!audioMetadata && !downloadUrl && (
                                <div>
                                    {/* Upload Progress */}
                                    {uploading && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-white font-medium">Uploading to cloud...</span>
                                                <span className="text-sm text-primary font-bold">{uploadProgress}%</span>
                                            </div>
                                            <div className="w-full bg-surface-dark rounded-full h-2">
                                                <div
                                                    className="bg-primary h-full transition-all duration-300 rounded-full"
                                                    style={{ width: `${uploadProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Analyzing State */}
                                    {analyzing && (
                                        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                                                <span className="text-white">Analyzing audio metadata...</span>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleUpload}
                                        disabled={!canUpload}
                                        className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-[#2fd16e] disabled:bg-primary/50 disabled:cursor-not-allowed text-background-dark font-bold text-sm rounded-full transition-all"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <span className="material-symbols-outlined animate-spin">sync</span>
                                                {uploading ? 'Uploading...' : 'Analyzing...'}
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">cloud_upload</span>
                                                Upload & Analyze
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Processing Status */}
                            {isProcessing && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                                        <div>
                                            <h3 className="text-white font-bold text-sm">Compressing Audio</h3>
                                            <p className="text-text-muted text-xs">Target: {selectedBitrate}</p>
                                        </div>
                                    </div>

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
                            )}

                            {/* Analysis Results with Compression Settings */}
                            {audioMetadata && !downloadUrl && !isProcessing && (
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

                                        {/* Quality Selection */}
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

                                        {/* Bitrate Selection */}
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
                                        {showCustomWarning && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                                <div className="flex items-start gap-2">
                                                    <span className="material-symbols-outlined text-yellow-500 text-[18px]">warning</span>
                                                    <div>
                                                        <p className="text-yellow-500 text-xs font-bold">Custom Configuration</p>
                                                        <p className="text-yellow-500/80 text-[10px]">High bitrate may result in larger file size than original</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Compress Button */}
                                        <button
                                            onClick={handleCompress}
                                            disabled={!canCompress}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] disabled:bg-primary/50 text-background-dark font-bold text-sm rounded-full transition-all disabled:cursor-not-allowed"
                                        >
                                            <span className="material-symbols-outlined">compress</span>
                                            Compress Audio
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Compression Result */}
                            {downloadUrl && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-[24px]">check_circle</span>
                                        <h3 className="text-white font-bold">Compression Complete!</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Original</p>
                                            <p className="text-white text-sm font-medium">{formatBitrate(audioMetadata.bitrate)}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Compressed</p>
                                            <p className="text-primary text-sm font-medium">{selectedBitrate}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <button
                                            onClick={handleDownload}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full transition-all"
                                        >
                                            <span className="material-symbols-outlined">download</span>
                                            Download Compressed Audio
                                        </button>

                                        <button
                                            onClick={handleReset}
                                            className="w-full px-6 py-2 bg-transparent border border-border-dark hover:border-text-muted text-white font-medium text-sm rounded-lg transition-all"
                                        >
                                            Compress Another File
                                        </button>
                                    </div>
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
