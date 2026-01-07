import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    registerServiceWorker,
    subscribeToPush,
    isPushSupported,
    getNotificationPermission,
    playNotificationSound
} from '../../utils/pushNotifications';

const API_URL = 'http://localhost:3000/api/video-compress';

const CompressVideo = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
    const [videoMetadata, setVideoMetadata] = useState(null);
    const [compressionResult, setCompressionResult] = useState(null);

    // SSE Progress tracking
    const [jobId, setJobId] = useState(null);
    const [progress, setProgress] = useState(0);
    const [timemark, setTimemark] = useState('00:00:00');
    const [compressionStatus, setCompressionStatus] = useState('idle');

    // Push notification state
    const [pushSubscriptionId, setPushSubscriptionId] = useState(null);
    const [pushSupported, setPushSupported] = useState(false);

    const fileInputRef = useRef(null);
    const eventSourceRef = useRef(null);

    // Compression options
    const [codec, setCodec] = useState('h264');
    const [resolution, setResolution] = useState('original');
    const [videoBitrate, setVideoBitrate] = useState('auto');
    const [preset, setPreset] = useState('medium');
    const [quality, setQuality] = useState('balanced');
    const [audioOption, setAudioOption] = useState('compress');

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
        { value: 'auto', label: 'Auto', desc: 'FFmpeg decides' },
        { value: '800k', label: '800k', desc: 'Low' },
        { value: '1200k', label: '1.2M', desc: 'Medium' },
        { value: '2000k', label: '2M', desc: 'High' },
        { value: '4000k', label: '4M', desc: 'Very High' }
    ];

    const presetOptions = [
        { value: 'ultrafast', label: 'Ultra Fast' },
        { value: 'fast', label: 'Fast' },
        { value: 'medium', label: 'Medium' },
        { value: 'slow', label: 'Slow' }
    ];

    const qualityOptions = [
        { value: 'low', label: 'Low' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'high', label: 'High' }
    ];

    const audioOptions = [
        { value: 'keep', label: 'Keep Original', desc: 'Copy audio' },
        { value: 'compress', label: 'Compress', desc: 'AAC 128k' },
        { value: 'remove', label: 'Remove', desc: 'No audio' }
    ];

    // Connect to SSE for progress updates
    const connectToProgress = (jid) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const eventSource = new EventSource(`${API_URL}/progress/${jid}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'progress') {
                    setProgress(data.progress || 0);
                    setTimemark(data.timemark || '00:00:00');
                    setCompressionStatus('processing');
                } else if (data.type === 'complete') {
                    setProgress(100);
                    setCompressionStatus('completed');
                    setCompressionResult(data.result);
                    setCompressing(false);
                    toast.success('Video compressed successfully!');
                    eventSource.close();
                } else if (data.type === 'error') {
                    setCompressionStatus('failed');
                    setCompressing(false);
                    toast.error(`Compression failed: ${data.message}`);
                    eventSource.close();
                }
            } catch (err) {
                console.error('Error parsing SSE data:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE error:', err);
            eventSource.close();
        };
    };

    // Initialize service worker and check push support
    useEffect(() => {
        const initPushNotifications = async () => {
            // Check if push is supported
            const supported = isPushSupported();
            setPushSupported(supported);

            if (supported) {
                try {
                    // Register service worker
                    await registerServiceWorker();
                    console.log('✅ Service worker registered');
                } catch (error) {
                    console.error('Service worker registration failed:', error);
                }
            }
        };

        initPushNotifications();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!SUPPORTED_FORMATS.includes(fileExtension)) {
            toast.error(`Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ').toUpperCase()}`);
            return;
        }

        const maxSize = 5 * 1024 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('File too large. Maximum size: 5GB');
            return;
        }

        setVideoFile(file);
        toast.info(`Selected: ${file.name}`);
    };

    const handleUpload = async () => {
        if (!videoFile) {
            toast.error('Please select a video file first');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', videoFile);

        try {
            const uploadResponse = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (uploadResponse.data.success) {
                setUploadedFileInfo(uploadResponse.data);
                toast.success('Video file uploaded successfully!');
                await analyzeVideo(uploadResponse.data.inputFilePath);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const analyzeVideo = async (inputFilePath) => {
        setAnalyzing(true);
        try {
            const analyzeResponse = await axios.post(`${API_URL}/analyze`, {
                inputFilePath: inputFilePath
            });

            if (analyzeResponse.data.success) {
                setVideoMetadata(analyzeResponse.data.metadata);
                toast.success('Video analyzed successfully!');
            }
        } catch (error) {
            console.error('Analyze error:', error);
            toast.error(error.response?.data?.message || 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCompress = async () => {
        if (!uploadedFileInfo) {
            toast.error('Please upload a file first');
            return;
        }

        setCompressing(true);
        setProgress(0);
        setCompressionStatus('starting');
        toast.info(`Starting compression with ${codec.toUpperCase()}...`);

        try {
            //  Try to subscribe to push notifications if supported and not already subscribed
            let currentSubscriptionId = pushSubscriptionId;

            if (pushSupported && !currentSubscriptionId) {
                try {
                    const permission = getNotificationPermission();

                    if (permission === 'default' || permission === 'granted') {
                        const { subscriptionId } = await subscribeToPush();
                        setPushSubscriptionId(subscriptionId);
                        currentSubscriptionId = subscriptionId;
                        toast.success('Push notifications enabled!');
                    }
                } catch (error) {
                    console.warn('Push subscription failed, continuing without notifications:', error);
                    // Continue without push notifications
                }
            }

            const compressResponse = await axios.post(`${API_URL}/compress`, {
                inputFilePath: uploadedFileInfo.inputFilePath,
                codec,
                resolution,
                videoBitrate,
                preset,
                quality,
                audioOption,
                subscriptionId: currentSubscriptionId // Include subscription ID if available
            });

            if (compressResponse.data.success && compressResponse.data.jobId) {
                const jid = compressResponse.data.jobId;
                setJobId(jid);

                // Connect to SSE for progress
                connectToProgress(jid);

                toast.info('Compression started! You can leave this page - we\'ll update progress in real-time.');
            }
        } catch (error) {
            console.error('Compression error:', error);
            toast.error(error.response?.data?.message || 'Compression failed');
            setCompressing(false);
        }
    };

    const handleDownload = () => {
        if (!compressionResult) return;

        const downloadUrl = `http://localhost:3000${compressionResult.downloadUrl}`;
        window.open(downloadUrl, '_blank');
        toast.success('Download started!');
    };

    const handleReset = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setVideoFile(null);
        setUploadedFileInfo(null);
        setVideoMetadata(null);
        setCompressionResult(null);
        setJobId(null);
        setProgress(0);
        setTimemark('00:00:00');
        setCompressionStatus('idle');
        setCodec('h264');
        setResolution('original');
        setVideoBitrate('auto');
        setPreset('medium');
        setQuality('balanced');
        setAudioOption('compress');

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
        if (bitrate >= 1000000) {
            return `${(bitrate / 1000000).toFixed(2)} Mbps`;
        }
        return `${Math.round(bitrate / 1000)} kbps`;
    };

    return (
        <div className="flex-1 p-6 md:p-10 flex flex-col overflow-auto">
            <div className="flex-shrink-0 border-2 border-dashed border-border-dark rounded-3xl bg-surface-dark/20 hover:bg-surface-dark/30 transition-all duration-300">
                <div className="p-6 w-full max-w-3xl mx-auto">
                    <div className="size-24 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-6 shadow-2xl mx-auto">
                        <span className="material-symbols-outlined text-[40px] text-primary">video_settings</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3 text-center">Compress Video File</h2>
                    <p className="text-text-muted text-sm max-w-md mb-8 text-center mx-auto">
                        Reduce video file size with advanced compression options
                    </p>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp4,.mkv,.mov,.avi,.webm"
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
                            {/* File Info Card */}
                            <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
                                <div className="flex items-start gap-4">
                                    <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-primary text-[24px]">movie</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-medium truncate">{videoFile.name}</h3>
                                        <p className="text-text-muted text-sm">
                                            {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • {videoFile.name.split('.').pop().toUpperCase()}
                                        </p>
                                    </div>
                                    <button onClick={handleReset} className="text-text-muted hover:text-red-400 transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>

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

                            {uploadedFileInfo && analyzing && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                                        <span className="text-white">Analyzing video metadata...</span>
                                    </div>
                                </div>
                            )}

                            {/* Metadata & Compression Options */}
                            {uploadedFileInfo && videoMetadata && !analyzing && !compressionResult && !compressing && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-[24px]">analytics</span>
                                        <h3 className="text-white font-bold">Video Analysis Complete!</h3>
                                    </div>

                                    <div>
                                        <h4 className="text-white text-sm font-medium mb-2">📹 Video Stream</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-background-dark/50 rounded p-2">
                                                <p className="text-text-muted text-xs">Resolution</p>
                                                <p className="text-white text-sm font-medium">{videoMetadata.video.resolution}</p>
                                            </div>
                                            <div className="bg-background-dark/50 rounded p-2">
                                                <p className="text-text-muted text-xs">Codec</p>
                                                <p className="text-white text-sm font-medium">{videoMetadata.video.codec.toUpperCase()}</p>
                                            </div>
                                            <div className="bg-background-dark/50 rounded p-2">
                                                <p className="text-text-muted text-xs">Duration</p>
                                                <p className="text-white text-sm font-medium">{formatDuration(videoMetadata.video.duration)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Compression Options */}
                                    <div className="border-t border-border-dark pt-4 space-y-4">
                                        <h4 className="text-white font-medium text-sm">⚙️ Compression Settings</h4>

                                        {/* Codec Selection */}
                                        <div>
                                            <label className="text-xs text-text-muted mb-2 block">Video Codec</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {codecOptions.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setCodec(opt.value)}
                                                        className={codec === opt.value ? 'p-3 rounded-lg border-2 border-primary bg-primary/20 text-primary font-bold text-center transition-all' : 'p-3 rounded-lg border border-border-dark bg-background-dark/50 text-text-muted hover:border-primary/50 text-center transition-all'}
                                                    >
                                                        <p className="text-xs font-bold">{opt.label}</p>
                                                        <p className="text-[10px] opacity-70">{opt.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Resolution */}
                                        <div>
                                            <label className="text-xs text-text-muted mb-2 block">Resolution</label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {resolutionOptions.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setResolution(opt.value)}
                                                        className={resolution === opt.value ? 'p-2 rounded-lg border-2 border-primary bg-primary/20 text-primary font-bold text-center transition-all' : 'p-2 rounded-lg border border-border-dark bg-background-dark/50 text-text-muted hover:border-primary/50 text-center transition-all'}
                                                    >
                                                        <p className="text-xs font-bold">{opt.label}</p>
                                                        <p className="text-[9px] opacity-70">{opt.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Video Bitrate */}
                                        <div>
                                            <label className="text-xs text-text-muted mb-2 block">Video Bitrate</label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {bitrateOptions.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setVideoBitrate(opt.value)}
                                                        className={videoBitrate === opt.value ? 'p-2 rounded-lg border-2 border-primary bg-primary/20 text-primary font-bold text-center transition-all' : 'p-2 rounded-lg border border-border-dark bg-background-dark/50 text-text-muted hover:border-primary/50 text-center transition-all'}
                                                    >
                                                        <p className="text-xs font-bold">{opt.label}</p>
                                                        <p className="text-[9px] opacity-70">{opt.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Preset & Quality */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-text-muted mb-2 block">Speed Preset</label>
                                                <select
                                                    value={preset}
                                                    onChange={(e) => setPreset(e.target.value)}
                                                    className="w-full bg-[#1a1f2e] border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                                                    style={{ color: 'white', backgroundColor: '#1a1f2e' }}
                                                >
                                                    {presetOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value} style={{ color: 'white', backgroundColor: '#1a1f2e' }}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted mb-2 block">Quality Mode</label>
                                                <select
                                                    value={quality}
                                                    onChange={(e) => setQuality(e.target.value)}
                                                    className="w-full bg-[#1a1f2e] border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                                                    style={{ color: 'white', backgroundColor: '#1a1f2e' }}
                                                >
                                                    {qualityOptions.map(opt => (
                                                        <option key={opt.value} value={opt.value} style={{ color: 'white', backgroundColor: '#1a1f2e' }}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Audio Options */}
                                        <div>
                                            <label className="text-xs text-text-muted mb-2 block">Audio Handling</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {audioOptions.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setAudioOption(opt.value)}
                                                        className={audioOption === opt.value ? 'p-2 rounded-lg border-2 border-primary bg-primary/20 text-primary font-bold text-center transition-all' : 'p-2 rounded-lg border border-border-dark bg-background-dark/50 text-text-muted hover:border-primary/50 text-center transition-all'}
                                                    >
                                                        <p className="text-xs font-bold">{opt.label}</p>
                                                        <p className="text-[9px] opacity-70">{opt.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Compress Button */}
                                        <button
                                            onClick={handleCompress}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full transition-all mt-4"
                                        >
                                            <span className="material-symbols-outlined">compress</span>
                                            Compress Video
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Compression Progress */}
                            {compressing && compressionStatus !== 'completed' && (
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                                        <h3 className="text-white font-bold">Compressing Video...</h3>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-text-muted">Progress</span>
                                            <span className="text-primary font-bold">{progress}%</span>
                                        </div>
                                        <div className="w-full bg-background-dark/50 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-300 rounded-full"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-text-muted">
                                            <span>Time: {timemark}</span>
                                            <span>{compressionStatus}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-background-dark/50 rounded-lg">
                                        <p className="text-xs text-primary">
                                            💡 This may take a while. You can leave this page - we'll update progress in real-time!
                                        </p>
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

                                    <div className="bg-background-dark/50 rounded-lg p-3 space-y-2 text-sm">
                                        <p className="text-text-muted">
                                            <span className="text-white font-medium">Codec:</span> {compressionResult.settingsApplied.codec.toUpperCase()}
                                        </p>
                                        <p className="text-text-muted">
                                            <span className="text-white font-medium">Resolution:</span> {compressionResult.settingsApplied.resolution}
                                        </p>
                                        <p className="text-text-muted">
                                            <span className="text-white font-medium">Bitrate:</span> {compressionResult.settingsApplied.videoBitrate}
                                        </p>
                                        <p className="text-text-muted">
                                            <span className="text-white font-medium">Audio:</span> {compressionResult.settingsApplied.audio}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleDownload}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full transition-all"
                                    >
                                        <span className="material-symbols-outlined">download</span>
                                        Download Compressed Video
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-6 text-xs text-text-muted text-center">
                        Supported: MP4, MKV, MOV, AVI, WebM (Max: 5GB)
                    </div>
                </div>
            </div>

            {/* Status Footer */}
            <div className="mt-6 flex justify-between items-center text-xs text-text-muted px-2 opacity-60">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        System Operational
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                        {compressionResult ? 'Compression Complete' : compressing ? `Processing ${progress}%` : videoMetadata ? 'Ready to Compress' : 'Upload Ready'}
                    </span>
                </div>
                <div>v2.5.0</div>
            </div>
        </div>
    );
};

export default CompressVideo;
