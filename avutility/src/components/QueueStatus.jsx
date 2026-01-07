import React from 'react';

/**
 * QueueStatus Component
 * Displays queue position and status for users waiting in the processing queue
 * 
 * @param {Object} props
 * @param {string} props.status - Current status ('queued', 'processing', 'completed', 'failed')
 * @param {number} props.queuePosition - Position in queue (1-indexed)
 * @param {string} props.className - Additional CSS classes
 */
const QueueStatus = ({ status, queuePosition, className = '' }) => {
    // Don't show if not queued or no queue position
    if (status !== 'queued' || !queuePosition) {
        return null;
    }

    const isNext = queuePosition === 1;
    const estimatedWaitMinutes = queuePosition * 2; // Rough estimate: 2 min per position

    return (
        <div className={`bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-yellow-500 animate-pulse text-[24px]">
                    hourglass_top
                </span>
                <div className="flex-1">
                    <h3 className="text-white font-bold text-sm">
                        {isNext ? "You're Next!" : "You're in Queue"}
                    </h3>
                    <p className="text-text-muted text-xs">
                        {isNext
                            ? 'Starting processing very soon...'
                            : 'Other users are being processed'
                        }
                    </p>
                </div>
            </div>

            {/* Queue Position Card */}
            <div className="bg-background-dark/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-text-muted text-sm">Queue Position</span>
                    <span className={`font-bold text-2xl ${isNext ? 'text-primary animate-bounce' : 'text-yellow-500'}`}>
                        #{queuePosition}
                    </span>
                </div>

                {/* Next in Line Message */}
                {isNext && (
                    <div className="flex items-center gap-2 text-primary text-sm pt-2 border-t border-border-dark">
                        <span className="material-symbols-outlined text-[16px] animate-bounce">
                            celebration
                        </span>
                        <span className="font-medium">Starting soon...</span>
                    </div>
                )}

                {/* Estimated Wait Time */}
                {!isNext && queuePosition > 1 && (
                    <p className="text-text-muted text-xs pt-2 border-t border-border-dark">
                        ⏱️ Estimated wait: ~{estimatedWaitMinutes} minutes
                    </p>
                )}
            </div>

            {/* Info Banner */}
            <div className="mt-3 flex items-center gap-2 text-xs text-yellow-500/80 bg-yellow-500/5 rounded-lg p-2">
                <span className="material-symbols-outlined text-[14px]">info</span>
                <span>Maximum 2 jobs can process simultaneously</span>
            </div>

            {/* Progress Dots Animation (optional visual flourish) */}
            {!isNext && (
                <div className="mt-3 flex justify-center items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-yellow-500/40 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-yellow-500/40 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-yellow-500/40 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                </div>
            )}
        </div>
    );
};

export default QueueStatus;
