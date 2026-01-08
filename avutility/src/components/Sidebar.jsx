import React from 'react';
import { logout } from '../utils/auth';
import { toast } from 'react-toastify';
import { trackLogout } from '../utils/analytics';

const Sidebar = ({ activeTab = 'extract-audio', onToolChange, user }) => {
    const audioTools = [
        { id: 'extract-audio', name: 'Extract Audio', icon: 'graphic_eq' },
        { id: 'convert-audio', name: 'Convert Audio', icon: 'transform' },
        { id: 'compress-audio', name: 'Compress Audio', icon: 'compress' }
    ];

    const videoTools = [
        { id: 'convert-video', name: 'Convert Video', icon: 'movie' },
        { id: 'compress-video', name: 'Compress Video', icon: 'video_settings' },
        { id: 'merge-av', name: 'Merge A/V', icon: 'call_merge' }
    ];

    const getUserInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleLogout = () => {
        toast.info('Logging out...');
        // Track logout event (also clears user ID)
        trackLogout();
        setTimeout(() => {
            logout();
        }, 500);
    };

    const handleToolClick = (toolId) => {
        if (onToolChange) {
            onToolChange(toolId);
        }
    };

    return (
        <aside className="w-64 h-full bg-surface-dark/95 md:bg-surface-dark backdrop-blur-xl border-r border-border-dark flex flex-col shrink-0 shadow-2xl">
            {/* Logo/Header */}
            <div className="h-20 flex items-center gap-3 px-6 border-b border-border-dark/50 shrink-0">
                <div className="size-8 rounded-full bg-[#1b3224] flex items-center justify-center border border-border-dark text-primary shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.8261 17.4264C16.7203 18.1174 20.2244 18.5217 24 18.5217C27.7756 18.5217 31.2797 18.1174 34.1739 17.4264C36.9144 16.7722 39.9967 15.2331 41.3563 14.1648L24.8486 40.6391C24.4571 41.267 23.5429 41.267 23.1514 40.6391L6.64374 14.1648C8.00331 15.2331 11.0856 16.7722 13.8261 17.4264Z" fill="currentColor" />
                        <path clipRule="evenodd" d="M39.998 12.236C39.9944 12.2537 39.9875 12.2845 39.9748 12.3294C39.9436 12.4399 39.8949 12.5741 39.8346 12.7175C39.8168 12.7597 39.7989 12.8007 39.7813 12.8398C38.5103 13.7113 35.9788 14.9393 33.7095 15.4811C30.9875 16.131 27.6413 16.5217 24 16.5217C20.3587 16.5217 17.0125 16.131 14.2905 15.4811C12.0012 14.9346 9.44505 13.6897 8.18538 12.8168C8.17384 12.7925 8.16216 12.767 8.15052 12.7408C8.09919 12.6249 8.05721 12.5114 8.02977 12.411C8.00356 12.3152 8.00039 12.2667 8.00004 12.2612C8.00004 12.261 8 12.2607 8.00004 12.2612C8.00004 12.2359 8.0104 11.9233 8.68485 11.3686C9.34546 10.8254 10.4222 10.2469 11.9291 9.72276C14.9242 8.68098 19.1919 8 24 8C28.8081 8 33.0758 8.68098 36.0709 9.72276C37.5778 10.2469 38.6545 10.8254 39.3151 11.3686C39.9006 11.8501 39.9857 12.1489 39.998 12.236ZM4.95178 15.2312L21.4543 41.6973C22.6288 43.5809 25.3712 43.5809 26.5457 41.6973L43.0534 15.223C43.0709 15.1948 43.0878 15.1662 43.104 15.1371L41.3563 14.1648C43.104 15.1371 43.1038 15.1374 43.104 15.1371L43.1051 15.135L43.1065 15.1325L43.1101 15.1261L43.1199 15.1082C43.1276 15.094 43.1377 15.0754 43.1497 15.0527C43.1738 15.0075 43.2062 14.9455 43.244 14.8701C43.319 14.7208 43.4196 14.511 43.5217 14.2683C43.6901 13.8679 44 13.0689 44 12.2609C44 10.5573 43.003 9.22254 41.8558 8.2791C40.6947 7.32427 39.1354 6.55361 37.385 5.94477C33.8654 4.72057 29.133 4 24 4C18.867 4 14.1346 4.72057 10.615 5.94478C8.86463 6.55361 7.30529 7.32428 6.14419 8.27911C4.99695 9.22255 3.99999 10.5573 3.99999 12.2609C3.99999 13.1275 4.29264 13.9078 4.49321 14.3607C4.60375 14.6102 4.71348 14.8196 4.79687 14.9689C4.83898 15.0444 4.87547 15.1065 4.9035 15.1529C4.91754 15.1762 4.92954 15.1957 4.93916 15.2111L4.94662 15.223L4.95178 15.2312ZM35.9868 18.996L24 38.22L12.0131 18.996C12.4661 19.1391 12.9179 19.2658 13.3617 19.3718C16.4281 20.1039 20.0901 20.5217 24 20.5217C27.9099 20.5217 31.5719 20.1039 34.6383 19.3718C35.082 19.2658 35.5339 19.1391 35.9868 18.996Z" fill="currentColor" fillRule="evenodd" />
                    </svg>
                </div>
                <span className="text-xl font-bold tracking-tight text-white">A/V Tools</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 md:py-8 px-3 md:px-4 space-y-6 md:space-y-8">
                {/* Audio Tools */}
                <div>
                    <h3 className="text-xs font-bold text-text-muted/60 uppercase tracking-widest mb-3 md:mb-4 px-3">
                        Audio Tools
                    </h3>
                    <ul className="space-y-1">
                        {audioTools.map((tool) => (
                            <li key={tool.id}>
                                <button
                                    onClick={() => handleToolClick(tool.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-3 rounded-lg border-l-2 transition-all group ${activeTab === tool.id
                                        ? 'bg-primary/10 text-primary border-primary shadow-[0_0_15px_rgba(54,226,123,0.08)]'
                                        : 'text-text-muted hover:text-white hover:bg-white/5 border-transparent'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${activeTab !== tool.id ? 'group-hover:text-primary' : ''} transition-colors`}>
                                        {tool.icon}
                                    </span>
                                    <span className="text-sm font-medium text-left">{tool.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Video Tools */}
                <div>
                    <h3 className="text-xs font-bold text-text-muted/60 uppercase tracking-widest mb-3 md:mb-4 px-3">
                        Video Tools
                    </h3>
                    <ul className="space-y-1">
                        {videoTools.map((tool) => (
                            <li key={tool.id}>
                                <button
                                    onClick={() => handleToolClick(tool.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-3 rounded-lg border-l-2 transition-all group ${activeTab === tool.id
                                        ? 'bg-primary/10 text-primary border-primary shadow-[0_0_15px_rgba(54,226,123,0.08)]'
                                        : 'text-text-muted hover:text-white hover:bg-white/5 border-transparent'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${activeTab !== tool.id ? 'group-hover:text-primary' : ''} transition-colors`}>
                                        {tool.icon}
                                    </span>
                                    <span className="text-sm font-medium text-left">{tool.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </nav>

            {/* User Profile, Donate & Logout */}
            <div className="p-3 md:p-4 bg-surface-dark border-t border-border-dark space-y-2 shrink-0">
                {/* Donate Button */}
                <button
                    onClick={() => handleToolClick('donate-us')}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-l-2 transition-all ${activeTab === 'donate-us'
                        ? 'bg-primary/10 text-primary border-primary shadow-[0_0_15px_rgba(54,226,123,0.08)]'
                        : 'bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary border-primary/20 hover:border-primary/30 border-transparent'
                        }`}
                >
                    <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                    <span className="text-sm font-medium">Donate Us</span>
                </button>

                {/* User Info */}
                <div className="flex items-center gap-3 px-2 py-1">
                    {/* Profile Picture or Initials */}
                    {user?.photoURL ? (
                        // Google user - show profile picture
                        <img
                            src={user.photoURL}
                            alt={user.displayName || user.name || 'User'}
                            className="size-9 rounded-full object-cover shadow-md shadow-primary/20 shrink-0 ring-2 ring-primary/30"
                        />
                    ) : (
                        // Email/password user - show initials
                        <div className="size-9 rounded-full bg-primary flex items-center justify-center text-background-dark font-bold text-xs shadow-md shadow-primary/20 shrink-0">
                            {getUserInitials(user?.displayName || user?.name)}
                        </div>
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-white truncate">
                            {user?.displayName || user?.name || 'User'}
                        </span>
                        <span className="text-xs text-text-muted truncate">{user?.email || ''}</span>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 transition-all group"
                >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
