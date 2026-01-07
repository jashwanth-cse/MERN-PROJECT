import React from 'react';

const DonateUs = () => {
    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
            <div className="max-w-4xl mx-auto">
                {/* Hero Section */}
                <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-8 md:p-12 text-center mb-8">
                    <span className="material-symbols-outlined text-primary text-6xl mb-4 inline-block animate-pulse">
                        volunteer_activism
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        Support This Project
                    </h1>
                    <p className="text-lg text-text-muted max-w-2xl mx-auto">
                        Help us keep this open-source project free and accessible to everyone
                    </p>
                </div>

                {/* Main Content Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Open Source Card */}
                    <div className="bg-surface-dark border border-border-dark rounded-xl p-6 hover:border-primary/30 transition-all duration-300 group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <span className="material-symbols-outlined text-primary text-2xl">code</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white">Open Source</h2>
                        </div>
                        <p className="text-text-muted leading-relaxed">
                            This project is completely open source and free to use. Built with modern web technologies and best practices to serve the community.
                        </p>
                        <div className="mt-4 pt-4 border-t border-border-dark">
                            <span className="text-sm text-primary font-medium">MIT Licensed</span>
                        </div>
                    </div>

                    {/* Community Card */}
                    <div className="bg-surface-dark border border-border-dark rounded-xl p-6 hover:border-primary/30 transition-all duration-300 group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <span className="material-symbols-outlined text-primary text-2xl">groups</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white">Community Driven</h2>
                        </div>
                        <p className="text-text-muted leading-relaxed">
                            Join our growing community of developers and contributors. Your feedback and contributions help improve the platform for everyone.
                        </p>
                        <div className="mt-4 pt-4 border-t border-border-dark">
                            <span className="text-sm text-primary font-medium">Free Forever</span>
                        </div>
                    </div>
                </div>

                {/* Developer Section */}
                <div className="bg-surface-dark border border-border-dark rounded-xl p-8 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary text-3xl">person</span>
                        <h2 className="text-3xl font-bold text-white">Meet the Developer</h2>
                    </div>

                    <div className="bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 rounded-xl p-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                            {/* Avatar */}
                            <div className="size-24 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-background-dark text-3xl font-bold shadow-lg shadow-primary/20 shrink-0">
                                JJ
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-white mb-2">Jashwanth J</h3>
                                <p className="text-text-muted mb-1">
                                    <span className="material-symbols-outlined text-primary text-sm align-middle mr-1">school</span>
                                    Computer Science & Engineering Student
                                </p>
                                <p className="text-primary font-medium">
                                    <span className="material-symbols-outlined text-primary text-sm align-middle mr-1">location_on</span>
                                    Sri Eshwar College of Engineering
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-border-dark">
                            <p className="text-text-muted leading-relaxed">
                                Passionate about creating useful tools and contributing to the open-source community.
                                This project was built to help people easily work with audio and video files without complicated software.
                            </p>
                        </div>
                    </div>
                </div>

                {/* How to Support Section */}
                <div className="bg-surface-dark border border-border-dark rounded-xl p-8">
                    <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">favorite</span>
                        Ways to Support
                    </h2>

                    <div className="grid md:grid-cols-3 gap-4">
                        {/* Star the Repo */}
                        <div className="bg-white/5 border border-border-dark rounded-lg p-5 text-center hover:bg-white/10 transition-all">
                            <span className="material-symbols-outlined text-primary text-4xl mb-3 inline-block">star</span>
                            <h3 className="text-white font-bold mb-2">Star the Repository</h3>
                            <p className="text-sm text-text-muted">Show your support by starring the GitHub repository</p>
                        </div>

                        {/* Contribute Code */}
                        <div className="bg-white/5 border border-border-dark rounded-lg p-5 text-center hover:bg-white/10 transition-all">
                            <span className="material-symbols-outlined text-primary text-4xl mb-3 inline-block">code_blocks</span>
                            <h3 className="text-white font-bold mb-2">Contribute Code</h3>
                            <p className="text-sm text-text-muted">Help improve the codebase with your contributions</p>
                        </div>

                        {/* Share */}
                        <div className="bg-white/5 border border-border-dark rounded-lg p-5 text-center hover:bg-white/10 transition-all">
                            <span className="material-symbols-outlined text-primary text-4xl mb-3 inline-block">share</span>
                            <h3 className="text-white font-bold mb-2">Share with Others</h3>
                            <p className="text-sm text-text-muted">Spread the word and help others discover this tool</p>
                        </div>
                    </div>
                </div>

                {/* Tech Stack */}
                <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-xl p-8 mt-8">
                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">build</span>
                        Built With
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        <span className="px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/30">React</span>
                        <span className="px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/30">Node.js</span>
                        <span className="px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/30">Express</span>
                        <span className="px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/30">FFmpeg</span>
                        <span className="px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/30">MongoDB</span>
                        <span className="px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-medium border border-primary/30">Tailwind CSS</span>
                    </div>
                </div>

                {/* Footer Message */}
                <div className="text-center mt-8 p-6 bg-surface-dark border border-border-dark rounded-xl">
                    <p className="text-white text-lg mb-2">
                        Thank you for using A/V Tools! ❤️
                    </p>
                    <p className="text-text-muted text-sm">
                        Your support and feedback mean the world to us and help make this project better every day.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DonateUs;
