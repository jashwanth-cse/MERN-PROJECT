import React, { useEffect, useState } from 'react';
import { getUser } from '../utils/auth';
import Sidebar from '../components/Sidebar';
import WaveformHeader from '../components/WaveformHeader';

// Import all tool components
import ExtractAudio from './tools/ExtractAudio';
import ConvertAudio from './tools/ConvertAudio';
import CompressAudio from './tools/CompressAudio';
import AudioPresets from './tools/AudioPresets';

import ConvertVideo from './tools/ConvertVideo';
import CompressVideo from './tools/CompressVideo';
import MergeAV from './tools/MergeAV';
import DonateUs from './DonateUs';

// Tool configuration with titles and subtitles
const toolConfig = {
    'extract-audio': {
        title: 'Extract Audio',
        subtitle: 'Extract high-quality audio tracks from video files'
    },
    'convert-audio': {
        title: 'Convert Audio',
        subtitle: 'Convert audio files between different formats'
    },
    'compress-audio': {
        title: 'Compress Audio',
        subtitle: 'Reduce audio file size while maintaining quality'
    },
    'audio-presets': {
        title: 'Audio Presets',
        subtitle: 'Apply professional audio processing presets'
    },

    'convert-video': {
        title: 'Convert Video',
        subtitle: 'Convert videos between different formats'
    },
    'compress-video': {
        title: 'Compress Video',
        subtitle: 'Reduce video file size without quality loss'
    },
    'merge-av': {
        title: 'Merge A/V',
        subtitle: 'Combine separate audio and video files'
    },
    'donate-us': {
        title: 'Support Us',
        subtitle: 'Help keep this open-source project alive and free'
    }
};

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [selectedTool, setSelectedTool] = useState(() => {
        // Initialize from localStorage or default to 'extract-audio'
        return localStorage.getItem('selectedTool') || 'extract-audio';
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Get user from localStorage
        const storedUser = getUser();
        if (storedUser) {
            setUser(storedUser);
        }
    }, []);

    const handleToolChange = (toolId) => {
        setSelectedTool(toolId);
        localStorage.setItem('selectedTool', toolId); // Persist to localStorage
        setMobileMenuOpen(false); // Close mobile menu when tool is selected
    };

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    // Get current tool config
    const currentTool = toolConfig[selectedTool] || toolConfig['extract-audio'];

    // Render the appropriate tool component
    const renderToolComponent = () => {
        switch (selectedTool) {
            case 'extract-audio':
                return <ExtractAudio />;
            case 'convert-audio':
                return <ConvertAudio />;
            case 'compress-audio':
                return <CompressAudio />;
            case 'audio-presets':
                return <AudioPresets />;

            case 'convert-video':
                return <ConvertVideo />;
            case 'compress-video':
                return <CompressVideo />;
            case 'merge-av':
                return <MergeAV />;
            case 'donate-us':
                return <DonateUs />;
            default:
                return <ExtractAudio />;
        }
    };

    return (
        <div className="bg-background-dark font-display text-white overflow-hidden h-screen flex">
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                ></div>
            )}

            {/* Sidebar - Desktop always visible, Mobile slide-in */}
            <div className={`
        fixed md:relative inset-y-0 left-0 z-40
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
                <Sidebar
                    activeTab={selectedTool}
                    onToolChange={handleToolChange}
                    user={user}
                />
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative z-0 bg-background-dark min-w-0">
                {/* Background Blur Effects */}
                <div className="absolute top-[-10%] left-1/4 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>
                <div className="absolute bottom-[-10%] right-1/4 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>

                {/* Header with Waveform */}
                <WaveformHeader
                    title={currentTool.title}
                    subtitle={currentTool.subtitle}
                    onMenuClick={toggleMobileMenu}
                />

                {/* Dynamic Tool Component */}
                {renderToolComponent()}
            </main>
        </div>
    );
};

export default Dashboard;
