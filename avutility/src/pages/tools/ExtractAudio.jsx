import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useR2Upload } from '../../hooks/useR2Upload';
import { useJobProcessing } from '../../hooks/useJobProcessing';
import { getDownloadUrl, downloadFromR2 } from '../../utils/r2ApiService';
import axios from 'axios';
import QueueStatus from '../../components/QueueStatus';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const ExtractAudio = () => {
    // File selection
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    // R2 Upload hook
    const { upload: uploadToR2, uploading, progress: uploadProgress, objectKey, reset: resetUpload } = useR2Upload({
        allowedTypes: ['.mp4', '.mov', '.mkv', '.avi', '.webm', 'video/'],
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

    // Audio track analysis
    const [analyzing, setAnalyzing] = useState(false);
    const [audioTracks, setAudioTracks] = useState([]);
    const [selectedFormat, setSelectedFormat] = useState('mp3');

    // Multi-track selection
    const [selectedTracks, setSelectedTracks] = useState([]);

    // Batch extraction state
    const [extractionQueue, setExtractionQueue] = useState([]); // Tracks to extract
    const [currentTrackIndex, setCurrentTrackIndex] = useState(null); // Current track being extracted
    const [completedExtractions, setCompletedExtractions] = useState([]); // { trackIndex, downloadData, track }
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    // Watch for job completion and get download URL
    useEffect(() => {
        const fetchDownloadUrl = async () => {
            if (isCompleted && jobId && isBatchProcessing) {
                try {
                    console.log('Job completed, fetching download URL for jobId:', jobId);
                    const downloadData = await getDownloadUrl(jobId);

                    // Add to completed extractions
                    const currentTrack = audioTracks[currentTrackIndex];
                    setCompletedExtractions(prev => [
                        ...prev,
                        {
                            jobId, // Store jobId for cleanup
                            trackIndex: currentTrackIndex,
                            trackName: `Track ${currentTrackIndex + 1} (${currentTrack.codec})`,
                            downloadData,
                            track: currentTrack
                        }
                    ]);

                    // Reset job for next extraction
                    resetJob();

                    // Move to next track
                    setCurrentTrackIndex(null);

                } catch (error) {
                    console.error('Failed to get download URL:', error);
                    toast.error(`Track ${currentTrackIndex + 1}: Failed to generate download link`);

                    // Continue with next track even if this failed
                    resetJob();
                    setCurrentTrackIndex(null);
                }
            }
        };

        fetchDownloadUrl();
    }, [isCompleted, jobId]);

    // Auto-process next track in queue
    useEffect(() => {
        if (isBatchProcessing && currentTrackIndex === null && extractionQueue.length > 0) {
            // Get next track from queue
            const nextTrackIndex = extractionQueue[0];
            const remainingQueue = extractionQueue.slice(1);

            setExtractionQueue(remainingQueue);
            setCurrentTrackIndex(nextTrackIndex);

            // Start extraction
            const track = audioTracks[nextTrackIndex];
            extractSingleTrack(nextTrackIndex, track);
        } else if (isBatchProcessing && currentTrackIndex === null && extractionQueue.length === 0) {
            // All tracks processed
            setIsBatchProcessing(false);
            toast.success(`All ${completedExtractions.length} tracks extracted successfully!`);
        }
    }, [isBatchProcessing, currentTrackIndex, extractionQueue]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const validExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
            const fileExtension = `.${file.name.split('.').pop().toLowerCase()}`;

            if (!validExtensions.includes(fileExtension)) {
                toast.error('Unsupported file format. Please select MP4, MOV, MKV, AVI, or WebM.');
                return;
            }

            setSelectedFile(file);
            setAudioTracks([]);
            setSelectedTracks([]);
            setCompletedExtractions([]);
            setExtractionQueue([]);
            setCurrentTrackIndex(null);
            setIsBatchProcessing(false);
            toast.info(`Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        }
    };

    const analyzeVideo = async () => {
        if (!selectedFile) {
            toast.error('Please select a video file first');
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

            const metadata = response.data.data;

            // Extract audio tracks from metadata
            const tracks = metadata.audio || [];

            if (tracks.length === 0) {
                toast.error('No audio tracks found in this video');
                setAudioTracks([]);
            } else {
                setAudioTracks(tracks.map((track, index) => ({
                    streamIndex: track.index ?? index,
                    codec: track.codec || 'unknown',
                    channels: track.channels || 2,
                    sampleRate: track.sampleRate || 44100,
                    bitrate: track.bitrate || 0
                })));
                toast.success(`Found ${tracks.length} audio track(s). Select tracks to extract.`);
            }

        } catch (error) {
            console.error('Analysis error:', error);
            toast.error(error.message || 'Analysis failed');
            setAudioTracks([]);
        } finally {
            setAnalyzing(false);
        }
    };

    const toggleTrackSelection = (trackIndex) => {
        setSelectedTracks(prev => {
            if (prev.includes(trackIndex)) {
                return prev.filter(i => i !== trackIndex);
            } else {
                return [...prev, trackIndex];
            }
        });
    };

    const selectAllTracks = () => {
        if (selectedTracks.length === audioTracks.length) {
            setSelectedTracks([]);
        } else {
            setSelectedTracks(audioTracks.map((_, index) => index));
        }
    };

    const extractSingleTrack = async (trackIndex, track) => {
        if (!objectKey) {
            toast.error('Please upload and analyze a file first');
            return;
        }

        try {
            console.log(`Starting extraction for track ${trackIndex + 1}`);
            await startProcessing(objectKey, 'extract-audio', {
                trackIndex: track.streamIndex,
                format: selectedFormat
            });
        } catch (error) {
            console.error('Extraction error:', error);
            toast.error(`Track ${trackIndex + 1}: ${error.message || 'Extraction failed'}`);
        }
    };

    const startBatchExtraction = () => {
        if (selectedTracks.length === 0) {
            toast.error('Please select at least one track');
            return;
        }

        if (!objectKey) {
            toast.error('Please upload and analyze a file first');
            return;
        }

        // Initialize batch processing
        setIsBatchProcessing(true);
        setExtractionQueue([...selectedTracks]);
        setCompletedExtractions([]);
        setCurrentTrackIndex(null);

        toast.info(`Starting batch extraction of ${selectedTracks.length} track(s)...`);
    };

    const downloadSingleFile = async (extraction) => {
        try {
            // Regenerate download URL to avoid expiration (URLs expire after 5 min)
            toast.info('Generating download link...');
            const freshDownloadData = await getDownloadUrl(extraction.jobId);

            // Trigger download with fresh URL
            downloadFromR2(freshDownloadData.downloadUrl, freshDownloadData.fileName);
            toast.success(`Downloading: ${extraction.trackName}`);
        } catch (error) {
            console.error('Failed to generate fresh download URL:', error);
            toast.error('Failed to generate download link. Please try again.');
        }
    };

    const downloadAllFiles = async () => {
        if (completedExtractions.length === 0) return;

        toast.info(`Preparing ${completedExtractions.length} download(s)...`);

        try {
            // Regenerate URLs and download sequentially to avoid overwhelming the system
            for (let i = 0; i < completedExtractions.length; i++) {
                const extraction = completedExtractions[i];

                try {
                    // Get fresh download URL
                    const freshDownloadData = await getDownloadUrl(extraction.jobId);

                    // Trigger download
                    downloadFromR2(freshDownloadData.downloadUrl, freshDownloadData.fileName);

                    // Brief delay between downloads
                    if (i < completedExtractions.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.error(`Failed to download ${extraction.trackName}:`, error);
                    toast.error(`Failed: ${extraction.trackName}`);
                }
            }

            toast.success(`Started downloading ${completedExtractions.length} file(s)!`);
        } catch (error) {
            console.error('Batch download error:', error);
            toast.error('Some downloads failed. Please try individual downloads.');
        }
    };

    const cleanupAllFiles = async () => {
        if (completedExtractions.length === 0) return;

        try {
            // Cleanup all completed jobs (this will delete their output files and the shared input file)
            const cleanupPromises = completedExtractions.map(async (extraction) => {
                try {
                    await axios.post(`${API_BASE_URL}/cleanup/${extraction.jobId}`);
                    console.log(`Cleaned up job: ${extraction.jobId}`);
                } catch (error) {
                    console.error('Cleanup error for extraction:', error);
                }
            });

            await Promise.all(cleanupPromises);
            toast.info('Cleaned up all files from cloud storage');
            console.log('All files cleaned up from R2');
        } catch (error) {
            console.error('Failed to cleanup files:', error);
        }
    };

    const resetForm = async () => {
        // Cleanup files from R2 before resetting
        await cleanupAllFiles();

        setSelectedFile(null);
        setAudioTracks([]);
        setSelectedTracks([]);
        setCompletedExtractions([]);
        setExtractionQueue([]);
        setCurrentTrackIndex(null);
        setIsBatchProcessing(false);
        resetJob();
        resetUpload();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    const isAnalyzing = uploading || analyzing;
    const canAnalyze = selectedFile && !isAnalyzing && !isBatchProcessing;
    const canExtract = selectedTracks.length > 0 && !isBatchProcessing && !isAnalyzing;
    const hasCompletedExtractions = completedExtractions.length > 0;

    // Calculate progress
    const totalTracks = selectedTracks.length;
    const processedTracks = completedExtractions.length + (currentTrackIndex !== null ? 1 : 0);
    const overallProgress = totalTracks > 0 ? Math.round((completedExtractions.length / totalTracks) * 100) : 0;

    return (
        <div className="flex-1 p-6 md:p-10 flex flex-col overflow-hidden">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mov,.mkv,.avi,.webm,video/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Main Content Area */}
            <div className="flex-1 border-2 border-dashed border-border-dark rounded-3xl bg-surface-dark/20 transition-all duration-300 flex flex-col overflow-hidden">

                {/* Header Section */}
                <div className="p-6 border-b border-border-dark/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Extract Audio Tracks</h2>
                            <p className="text-text-muted text-sm">Multi-track batch extraction with queue support</p>
                        </div>

                        {/* Format Selector */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-text-muted">Output Format:</label>
                            <select
                                value={selectedFormat}
                                onChange={(e) => setSelectedFormat(e.target.value)}
                                className="px-4 py-2 bg-[#1a1a1a] border border-border-dark rounded-lg text-white focus:border-primary focus:outline-none appearance-none cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '1.5em 1.5em',
                                    paddingRight: '2.5rem'
                                }}
                                disabled={isBatchProcessing}
                            >
                                <option value="mp3" className="bg-[#1a1a1a] text-white">MP3</option>
                                <option value="wav" className="bg-[#1a1a1a] text-white">WAV</option>
                                <option value="m4a" className="bg-[#1a1a1a] text-white">M4A</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* File Selection */}
                    {!selectedFile && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="size-24 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-6 shadow-2xl">
                                <span className="material-symbols-outlined text-[40px] text-primary">video_file</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No Video Selected</h3>
                            <p className="text-text-muted text-sm mb-6">Choose a video file to analyze and extract audio tracks</p>
                            <button
                                onClick={triggerFileSelect}
                                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1"
                            >
                                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                                Select Video File
                            </button>
                        </div>
                    )}

                    {/* Selected File Info & Analyze */}
                    {selectedFile && audioTracks.length === 0 && !hasCompletedExtractions && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="mb-6 p-6 bg-primary/10 border border-primary/30 rounded-lg max-w-md w-full">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="material-symbols-outlined text-primary text-[32px]">video_file</span>
                                    <div className="flex-1">
                                        <p className="text-white font-medium text-sm mb-1">{selectedFile.name}</p>
                                        <p className="text-text-muted text-xs">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                    <button
                                        onClick={resetForm}
                                        className="text-red-400 hover:text-red-300"
                                        disabled={isAnalyzing}
                                    >
                                        <span className="material-symbols-outlined text-[24px]">close</span>
                                    </button>
                                </div>

                                {/* Upload Progress to R2 */}
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

                                {/* Analyzing */}
                                {analyzing && (
                                    <div className="flex items-center justify-center gap-2 text-primary">
                                        <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                                        <span className="text-sm font-medium">Analyzing audio tracks...</span>
                                    </div>
                                )}
                            </div>

                            {!isAnalyzing && (
                                <button
                                    onClick={analyzeVideo}
                                    disabled={!canAnalyze}
                                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-[18px]">analytics</span>
                                    Analyze Audio Tracks
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

                    {/* Batch Processing Status */}
                    {isBatchProcessing && (
                        <div className="mb-6 p-6 bg-primary/10 border border-primary/30 rounded-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="material-symbols-outlined text-primary animate-pulse text-[24px]">queue_music</span>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-sm">Batch Extraction in Progress</h3>
                                    <p className="text-text-muted text-xs">
                                        Processing track {processedTracks} of {totalTracks}
                                    </p>
                                </div>
                                <span className="text-primary font-bold text-2xl">{overallProgress}%</span>
                            </div>

                            {/* Overall Progress */}
                            <div className="w-full bg-surface-dark rounded-full h-3 mb-3">
                                <div
                                    className="bg-primary h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${overallProgress}%` }}
                                ></div>
                            </div>

                            {/* Current Track Progress */}
                            {currentTrackIndex !== null && isProcessing && (
                                <div className="bg-surface-dark/50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-white">
                                            Track #{currentTrackIndex + 1} - {audioTracks[currentTrackIndex]?.codec.toUpperCase()}
                                        </span>
                                        <span className="text-sm text-primary font-bold">{processingProgress}%</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                        <span>Time: {timemark}</span>
                                    </div>
                                </div>
                            )}

                            {/* Queue Info */}
                            {extractionQueue.length > 0 && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                    <span>{extractionQueue.length} track(s) waiting in queue</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Audio Tracks List */}
                    {audioTracks.length > 0 && !isBatchProcessing && !hasCompletedExtractions && (
                        <div className="space-y-4">
                            {/* Tracks Header */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-border-dark">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary text-[24px]">audio_file</span>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">Detected Audio Tracks</h3>
                                        <p className="text-text-muted text-xs">{audioTracks.length} track(s) found • {selectedTracks.length} selected</p>
                                    </div>
                                </div>
                                <button
                                    onClick={selectAllTracks}
                                    className="px-4 py-2 bg-surface-dark hover:bg-white/5 border border-border-dark hover:border-primary/50 text-white text-xs rounded-lg transition-all"
                                >
                                    {selectedTracks.length === audioTracks.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>

                            {/* Track Cards */}
                            <div className="grid gap-3">
                                {audioTracks.map((track, index) => (
                                    <div
                                        key={index}
                                        onClick={() => toggleTrackSelection(index)}
                                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${selectedTracks.includes(index)
                                            ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(54,226,123,0.2)]'
                                            : 'bg-surface-dark/50 border-border-dark hover:border-border-dark/80'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Checkbox */}
                                            <div className={`size-5 rounded border-2 flex items-center justify-center transition-all ${selectedTracks.includes(index)
                                                ? 'bg-primary border-primary'
                                                : 'border-border-dark'
                                                }`}>
                                                {selectedTracks.includes(index) && (
                                                    <span className="material-symbols-outlined text-background-dark text-[16px]">check</span>
                                                )}
                                            </div>

                                            {/* Track Info */}
                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-text-muted mb-1">Track</p>
                                                    <p className="text-white font-medium text-sm">#{index + 1}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted mb-1">Codec</p>
                                                    <p className="text-white font-medium text-sm uppercase">{track.codec}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted mb-1">Sample Rate</p>
                                                    <p className="text-white font-medium text-sm">{track.sampleRate} Hz</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-text-muted mb-1">Channels</p>
                                                    <p className="text-white font-medium text-sm">{track.channels}ch</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed Extractions */}
                    {hasCompletedExtractions && !isBatchProcessing && (
                        <div className="space-y-4">
                            {/* Downloads Header */}
                            <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary text-[24px]">download_done</span>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">Extraction Complete!</h3>
                                        <p className="text-text-muted text-xs">{completedExtractions.length} file(s) ready for download</p>
                                    </div>
                                </div>
                                {completedExtractions.length > 1 && (
                                    <button
                                        onClick={downloadAllFiles}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-xs rounded-lg transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">download</span>
                                        Download All ({completedExtractions.length})
                                    </button>
                                )}
                            </div>

                            {/* Download Cards */}
                            <div className="grid gap-3">
                                {completedExtractions.map((extraction, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 bg-surface-dark rounded-lg border border-border-dark">
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-primary text-[24px]">audio_file</span>
                                            <div>
                                                <p className="text-white font-medium text-sm">{extraction.trackName}</p>
                                                <p className="text-text-muted text-xs">
                                                    {(extraction.downloadData.fileSize / (1024 * 1024)).toFixed(2)} MB • {selectedFormat.toUpperCase()}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => downloadSingleFile(extraction)}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 hover:border-primary/50 text-xs rounded-lg transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">download</span>
                                            Download
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 justify-center pt-4">
                                <button
                                    onClick={resetForm}
                                    className="px-6 py-3 bg-transparent border border-border-dark hover:border-text-muted text-white font-medium text-sm rounded-lg transition-all"
                                >
                                    Process Another Video
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Footer */}
                {audioTracks.length > 0 && !isBatchProcessing && !hasCompletedExtractions && (
                    <div className="p-6 border-t border-border-dark/50 flex items-center justify-between">
                        <button
                            onClick={resetForm}
                            className="px-6 py-3 bg-transparent border border-border-dark hover:border-text-muted text-white font-medium text-sm rounded-lg transition-all"
                        >
                            Start Over
                        </button>

                        <button
                            onClick={startBatchExtraction}
                            disabled={!canExtract}
                            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                            Extract {selectedTracks.length} Selected Track{selectedTracks.length !== 1 ? 's' : ''}
                        </button>
                    </div>
                )}
            </div>

            {/* Status Footer */}
            <div className="mt-6 flex justify-between items-center text-xs text-text-muted px-2 opacity-60">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Batch Extraction
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">cloud</span>
                        R2 Cloud Storage
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">queue</span>
                        Auto Queue
                    </span>
                </div>
                <div>v3.1.0</div>
            </div>
        </div>
    );
};

export default ExtractAudio;
