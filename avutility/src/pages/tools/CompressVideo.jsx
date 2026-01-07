import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useR2Upload } from '../../hooks/useR2Upload';
import { useJobProcessing } from '../../hooks/useJobProcessing';
import { getDownloadUrl, downloadFromR2 } from '../../utils/r2ApiService';
import axios from 'axios';
import QueueStatus from '../../components/QueueStatus';
import {
    registerServiceWorker,
    subscribeToPush,
    isPushSupported,
    getNotificationPermission,
    playNotificationSound
} from '../../utils/pushNotifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const CompressVideo = () => {
    // File selection
    const [videoFile, setVideoFile] = useState(null);
    const fileInputRef = useRef(null);

    // R2 Upload hook
    const { upload: uploadToR2, uploading, progress: uploadProgress, objectKey, reset: resetUpload } = useR2Upload({
        allowedTypes: ['.mp4', '.mkv', '.mov', '.avi', '.webm', 'video/'],
        maxSize: 5 * 1024 * 1024 * 1024, // 5GB
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

    // Video metadata
    const [analyzing, setAnalyzing] = useState(false);
    const [videoMetadata, setVideoMetadata] = useState(null);

    // Compression options
    const [codec, setCodec] = useState('h264');
    const [resolution, setResolution] = useState('original');
    const [videoBitrate, setVideoBitrate] = useState('auto');
    const [preset, setPreset] = useState('medium');
    const [audioOption, setAudioOption] = useState('compress');

    // Download state
    const [downloadUrl, setDownloadUrl] = useState(null);

    // Push notification state
    const [pushSubscriptionId, setPushSubscriptionId] = useState(null);
    const [pushSupported, setPushSupported] = useState(false);

    const SUPPORTED_FORMATS = ['mp4', 'mkv', 'mov', 'avi', 'webm'];

    const codecOptions = [
        { value: 'h264', label: 'H.264', desc: 'Fast, compatible' },
        { value: 'h265', label: 'H.265/HEVC', desc: 'Smaller file' }
    ];

    const resolutionOptions = [
        { value: 'original', label: 'Original', desc: 'No scaling' },
        { value: '1080p', label: '1080p', desc: 'Full HD' },
        { value: '720p', label: '720p', desc: 'HD' },
        { value: '480p', label: '480p', desc: 'SD' }
    ];

    const bitrateOptions = [
        { value: 'auto', label: 'Auto', desc: 'FFmpeg' },
        { value: '800k', label: '800k', desc: 'Low' },
        { value: '1200k', label: '1.2M', desc: 'Medium' },
        { value: '2000k', label: '2M', desc: 'High' },
        { value: '4000k', label: '4M', desc: 'Very High' }
    ];

    const presetOptions = [
        { value: 'ultrafast', label: 'Ultra Fast' },
        { value: 'fast', label: 'Fast' },
        { value: 'medium', label: 'Medium' },
        { value: 'slow', label: 'Slow (Best)' }
    ];

    const audioOptions = [
        { value: 'keep', label: 'Keep Original', desc: 'Copy' },
        { value: 'compress', label: 'Compress', desc: 'AAC 128k' },
        { value: 'remove', label: 'Remove', desc: 'No audio' }
    ];

    // Initialize service worker and check push support
    useEffect(() => {
        const initPushNotifications = async () => {
            const supported = isPushSupported();
            setPushSupported(supported);

            if (supported) {
                try {
                    await registerServiceWorker();
                    console.log('✅ Service worker registered');
                } catch (error) {
                    console.error('Service worker registration failed:', error);
                }
            }
        };

        initPushNotifications();
    }, []);

    // Watch for job completion and send push notification
    useEffect(() => {
        const handleCompletion = async () => {
            if (isCompleted && jobId && !downloadUrl) {
                try {
                    console.log('Job completed, fetching download URL for jobId:', jobId);
                    const downloadData = await getDownloadUrl(jobId);
                    setDownloadUrl(downloadData);

                    // Play notification sound
                    playNotificationSound();

                    toast.success('Compression completed! Ready to download.');
                } catch (error) {
                    console.error('Failed to get download URL:', error);
                    toast.error('Processing completed but failed to generate download link');
                }
            }
        };

        handleCompletion();
    }, [isCompleted, jobId, downloadUrl]);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!SUPPORTED_FORMATS.includes(fileExtension)) {
            toast.error(`Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
            return;
        }

        setVideoFile(file);
        setVideoMetadata(null);
        setDownloadUrl(null);
        toast.info(`Selected: ${file.name} (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
    };

    const handleUpload = async () => {
        if (!videoFile) {
            toast.error('Please select a video file first');
            return;
        }

        try {
            // Upload to R2
            const key = await uploadToR2(videoFile);

            // Analyze the uploaded file
            setAnalyzing(true);
            const response = await axios.post(`${API_BASE_URL}/analyze`, {
                objectKey: key
            });

            if (!response.data.success) {
                throw new Error(response.data.message || 'Analysis failed');
            }

            const data = response.data.data;
            setVideoMetadata({
                duration: data.duration,
                width: data.video?.[0]?.width,
                height: data.video?.[0]?.height,
                codec: data.video?.[0]?.codec,
                fileSize: data.size
            });

            toast.success('Video analyzed successfully!');

        } catch (error) {
            console.error('Upload/Analysis error:', error);
            toast.error(error.message || 'Upload/Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const handlePushSubscribe = async () => {
        try {
            const permission = await getNotificationPermission();
            if (permission !== 'granted') {
                toast.error('Notification permission denied');
                return;
            }

            // subscribeToPush returns {subscription, subscriptionId}
            const result = await subscribeToPush();
            if (result && result.subscriptionId) {
                setPushSubscriptionId(result.subscriptionId);
                toast.success('Push notifications enabled!');
            }
        } catch (error) {
            console.error('Push subscription error:', error);
            toast.error('Failed to enable push notifications');
        }
    };

    const handleCompress = async () => {
        if (!objectKey) {
            toast.error('Please upload a file first');
            return;
        }

        try {
            // Pass subscriptionId as 4th parameter (separate from options)
            await startProcessing(
                objectKey,
                'video-compress',
                {
                    codec,
                    resolution,
                    videoBitrate,
                    preset,
                    audioOption
                },
                pushSubscriptionId // 4th parameter: subscriptionId
            );

            // Show helpful toast about background processing
            if (pushSubscriptionId) {
                toast.info('You can minimize this tab. We\'ll notify you when done!', {
                    autoClose: 5000
                });
            }
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

        setVideoFile(null);
        setVideoMetadata(null);
        setDownloadUrl(null);
        setCodec('h264');
        setResolution('original');
        setVideoBitrate('auto');
        setPreset('medium');
        setAudioOption('compress');
        setPushSubscriptionId(null);
        resetJob();
        resetUpload();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'Unknown';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isAnalyzing = uploading || analyzing;
    const canUpload = videoFile && !isAnalyzing && !isProcessing && !isQueued && !videoMetadata;
    const canCompress = videoMetadata && !isProcessing && !isQueued && !downloadUrl;

    return (
        <div className="flex-1 p-6 md:p-10 flex flex-col overflow-auto">
            <div className="flex-shrink-0 border-2 border-dashed border-border-dark rounded-3xl bg-surface-dark/20 hover:bg-surface-dark/30 transition-all duration-300">
                <div className="p-6 w-full max-w-3xl mx-auto">
                    {/* Upload Icon */}
                    <div className="size-24 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-6 shadow-2xl mx-auto">
                        <span className="material-symbols-outlined text-[40px] text-primary">video_file</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3 text-center">Compress Video</h2>
                    <p className="text-text-muted text-sm max-w-md mb-8 text-center mx-auto">
                        Reduce video file size with H.264/H.265 codecs
                    </p>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp4,.mkv,.mov,.avi,.webm,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {!videoFile ? (
                        <div className="flex justify-center">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                Select Video File
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
                                        <span className="material-symbols-outlined text-primary text-[24px]">video_file</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-medium truncate">{videoFile.name}</h3>
                                        <p className="text-text-muted text-sm">
                                            {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • {videoFile.name.split('.').pop().toUpperCase()}
                                        </p>
                                    </div>
                                    <button onClick={handleReset} className="text-text-muted hover:text-red-400 transition-colors" disabled={isProcessing}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Upload & Analysis */}
                            {!videoMetadata && !downloadUrl && (
                                <div>
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

                                    {analyzing && (
                                        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                                                <span className="text-white">Analyzing video...</span>
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
                                            <h3 className="text-white font-bold text-sm">Compressing Video</h3>
                                            <p className="text-text-muted text-xs">{codec.toUpperCase()} • {resolution} • {preset}</p>
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

                                    {pushSubscriptionId && (
                                        <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                                            <span className="material-symbols-outlined text-[14px]">notifications</span>
                                            <span>We'll notify you when done!</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Video Metadata & Compression Settings */}
                            {videoMetadata && !downloadUrl && !isProcessing && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-[24px]">analytics</span>
                                        <h3 className="text-white font-bold">Video Analysis Complete!</h3>
                                    </div>

                                    {/* Metadata */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Resolution</p>
                                            <p className="text-white text-sm font-medium">{videoMetadata.width}x{videoMetadata.height}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Duration</p>
                                            <p className="text-white text-sm font-medium">{formatDuration(videoMetadata.duration)}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Codec</p>
                                            <p className="text-white text-sm font-medium uppercase">{videoMetadata.codec}</p>
                                        </div>
                                        <div className="bg-background-dark/50 rounded p-2">
                                            <p className="text-text-muted text-xs">Size</p>
                                            <p className="text-white text-sm font-medium">{(videoMetadata.fileSize / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    </div>

                                    {/* Compression Settings */}
                                    <div className="border-t border-border-dark pt-4 space-y-4">
                                        <h4 className="text-white font-medium text-sm">Compression Settings</h4>

                                        {/* Codec */}
                                        <div>
                                            <label className="text-xs text-text-muted mb-2 block">Codec</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {codecOptions.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setCodec(opt.value)}
                                                        className={codec === opt.value ? 'p-3 rounded-lg border-2 border-primary bg-primary/20 text-primary text-center transition-all' : 'p-3 rounded-lg border border-border-dark bg-background-dark/50 text-text-muted hover:border-primary/50 text-center transition-all'}
                                                    >
                                                        <p className="text-xs font-bold">{opt.label}</p>
                                                        <p className="text-[10px] opacity-70">{opt.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Resolution & Bitrate */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-text-muted mb-2 block">Resolution</label>
                                                <select
                                                    value={resolution}
                                                    onChange={(e) => setResolution(e.target.value)}
                                                    className="w-full bg-[#1a1f2e] border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                                                >
                                                    {resolutionOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted mb-2 block">Video Bitrate</label>
                                                <select
                                                    value={videoBitrate}
                                                    onChange={(e) => setVideoBitrate(e.target.value)}
                                                    className="w-full bg-[#1a1f2e] border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                                                >
                                                    {bitrateOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Preset & Audio */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-text-muted mb-2 block">Encoding Preset</label>
                                                <select
                                                    value={preset}
                                                    onChange={(e) => setPreset(e.target.value)}
                                                    className="w-full bg-[#1a1f2e] border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                                                >
                                                    {presetOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted mb-2 block">Audio</label>
                                                <select
                                                    value={audioOption}
                                                    onChange={(e) => setAudioOption(e.target.value)}
                                                    className="w-full bg-[#1a1f2e] border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                                                >
                                                    {audioOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Push Notifications */}
                                        {pushSupported && !pushSubscriptionId && (
                                            <button
                                                onClick={handlePushSubscribe}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 text-xs rounded-lg transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">notifications</span>
                                                Enable Push Notifications (optional)
                                            </button>
                                        )}

                                        {pushSubscriptionId && (
                                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                                                    <p className="text-green-500 text-xs font-bold">Push notifications enabled! You can minimize this tab.</p>
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
                                            Compress Video
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

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center p-2 bg-background-dark/50 rounded-lg">
                                            <span className="text-text-muted text-xs">Output Size</span>
                                            <span className="text-primary text-sm font-medium">{(downloadUrl.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <button
                                            onClick={handleDownload}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full transition-all"
                                        >
                                            <span className="material-symbols-outlined">download</span>
                                            Download Compressed Video
                                        </button>

                                        <button
                                            onClick={handleReset}
                                            className="w-full px-6 py-2 bg-transparent border border-border-dark hover:border-text-muted text-white font-medium text-sm rounded-lg transition-all"
                                        >
                                            Compress Another Video
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-6 text-xs text-text-muted text-center">
                        Supported: MP4, MKV, MOV, AVI, WebM • Max 5GB
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompressVideo;
