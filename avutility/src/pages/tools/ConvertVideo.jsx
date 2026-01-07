import React from 'react';

const ConvertVideo = () => {
    return (
        <div className="flex-1 p-6 md:p-10 flex flex-col overflow-hidden">
            {/* Upload Area */}
            <div className="flex-1 border-2 border-dashed border-border-dark rounded-3xl bg-surface-dark/20 hover:bg-surface-dark/30 transition-all duration-300 flex flex-col items-center justify-center relative group overflow-hidden">
                {/* Gradient Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                {/* Content */}
                <div className="z-10 flex flex-col items-center justify-center text-center p-6">
                    {/* Upload Icon */}
                    <div className="size-24 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 group-hover:border-primary/50 transition-all duration-300">
                        <span className="material-symbols-outlined text-[40px] text-text-muted group-hover:text-primary transition-colors">
                            movie
                        </span>
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-2xl font-bold text-white mb-3">
                        Convert Video Format
                    </h2>
                    <p className="text-text-muted text-sm max-w-md mb-8">
                        Convert videos between different formats. Supports MP4, MOV, AVI, MKV, WebM, and more. Maintain quality while ensuring compatibility across platforms and devices.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <button className="flex items-center justify-center px-8 py-3 bg-primary hover:bg-[#2fd16e] text-background-dark font-bold text-sm rounded-full shadow-[0_0_20px_rgba(54,226,123,0.3)] hover:shadow-[0_0_30px_rgba(54,226,123,0.5)] transition-all transform hover:-translate-y-1">
                            Select Video File
                        </button>
                        <button className="flex items-center justify-center px-8 py-3 bg-transparent border border-border-dark hover:border-text-muted text-white font-medium text-sm rounded-full transition-all">
                            Import URL
                        </button>
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
                        Fast Processing
                    </span>
                </div>
                <div>v2.4.0</div>
            </div>
        </div>
    );
};

export default ConvertVideo;
