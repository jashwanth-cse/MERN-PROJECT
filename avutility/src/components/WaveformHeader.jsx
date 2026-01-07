import React, { useEffect, useState } from 'react';

const WaveformHeader = ({ title = 'Extract Audio', subtitle = 'Process your media files', onMenuClick }) => {
    const [bars, setBars] = useState([]);

    useEffect(() => {
        // Generate random heights for waveform bars
        const generateBars = () => {
            return Array.from({ length: 10 }, () => Math.random() * 60 + 20);
        };
        setBars(generateBars());

        // Animate bars every 2 seconds
        const interval = setInterval(() => {
            setBars(generateBars());
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    return (
        <header className="sticky top-0 z-10 h-20 flex items-center justify-between px-4 md:px-10 bg-surface-dark/80 backdrop-blur-lg border-b border-border-dark/50 shadow-xl">
            {/* Mobile Menu Button */}
            <button
                onClick={onMenuClick}
                className="md:hidden flex items-center justify-center size-10 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 text-text-muted hover:text-primary transition-all"
                aria-label="Toggle menu"
            >
                <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>

            {/* Title and Subtitle */}
            <div className="flex-1 md:flex-none">
                <h1 className="text-lg md:text-2xl font-bold text-white leading-tight">{title}</h1>
                <p className="text-xs md:text-sm text-text-muted hidden sm:block">{subtitle}</p>
            </div>

            {/* Waveform Visualization - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-1.5 h-12">
                {bars.map((height, index) => (
                    <div
                        key={index}
                        className="wave-bar"
                        style={{
                            height: `${height}%`,
                            animationDelay: `${index * 0.1}s`,
                            animation: 'pulse 2s ease-in-out infinite'
                        }}
                    ></div>
                ))}
            </div>
        </header>
    );
};

export default WaveformHeader;
