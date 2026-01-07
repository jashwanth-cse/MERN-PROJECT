import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import AnimatedWaveform from './AnimatedWaveform';
import { setAuthData } from '../utils/auth';

// Auth API endpoint
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
const API_URL = `${API_BASE}/auth`;

const Signup = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isInputActive, setIsInputActive] = useState(false);
    const [typingIntensity, setTypingIntensity] = useState(1);
    const [lastTypingTime, setLastTypingTime] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const handleInputFocus = useCallback(() => {
        setIsInputActive(true);
    }, []);

    const handleInputBlur = useCallback(() => {
        setIsInputActive(false);
        setTypingIntensity(1);
    }, []);

    const handleInputChange = useCallback((setter) => (e) => {
        setter(e.target.value);

        const now = Date.now();
        const timeSinceLastType = now - lastTypingTime;

        if (timeSinceLastType < 100) {
            setTypingIntensity(prev => Math.min(prev + 0.3, 2.5));
        } else {
            setTypingIntensity(1.5);
        }

        setLastTypingTime(now);

        setTimeout(() => {
            setTypingIntensity(prev => Math.max(prev - 0.2, 1));
        }, 150);
    }, [lastTypingTime]);

    const handleSignup = async (e) => {
        e.preventDefault();

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/register`, {
                name,
                email,
                password
            });

            if (response.data.success) {
                // Store auth data using utility
                setAuthData(response.data.token, response.data.user);

                // Show success toast
                toast.success(response.data.message || 'Account created successfully!');

                // Navigate to dashboard
                setTimeout(() => {
                    navigate('/dashboard');
                }, 500);
            }
        } catch (error) {
            console.error('Signup error:', error);
            const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Background Visuals */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                <div className="absolute w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                <AnimatedWaveform isActive={isInputActive} intensity={typingIntensity} />
            </div>

            {/* Main Content Container */}
            <div className="relative z-10 w-full max-w-[440px] flex flex-col gap-6">
                {/* Header */}
                <div className="text-center mb-2">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <span
                            className="material-symbols-outlined text-primary"
                            style={{ fontSize: '36px', fontVariationSettings: "'FILL' 1" }}
                        >
                            graphic_eq
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Start Processing
                    </h1>
                    <p className="text-text-muted text-sm">
                        Create your secure AV Utility workspace
                    </p>
                </div>

                {/* Signup Card */}
                <form onSubmit={handleSignup} className="flex flex-col gap-5 p-6 sm:p-8 rounded-[2rem] bg-[#16211b] border border-border-dark shadow-2xl">
                    {/* Name Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-white ml-1" htmlFor="name">
                            Name
                        </label>
                        <input
                            className="w-full bg-input-bg text-white border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_15px_rgba(54,226,123,0.2)] rounded-xl px-4 h-12 sm:h-14 placeholder:text-input-placeholder text-base transition-all outline-none"
                            id="name"
                            placeholder="Enter your full name"
                            type="text"
                            value={name}
                            onChange={handleInputChange(setName)}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            disabled={isLoading}
                        />
                    </div>

                    {/* Email Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-white ml-1" htmlFor="email">
                            Email address
                        </label>
                        <input
                            className="w-full bg-input-bg text-white border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_15px_rgba(54,226,123,0.2)] rounded-xl px-4 h-12 sm:h-14 placeholder:text-input-placeholder text-base transition-all outline-none"
                            id="email"
                            placeholder="name@example.com"
                            type="email"
                            value={email}
                            onChange={handleInputChange(setEmail)}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            disabled={isLoading}
                        />
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-white ml-1" htmlFor="password">
                            Password
                        </label>
                        <div className="relative flex items-center">
                            <input
                                className="w-full bg-input-bg text-white border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_15px_rgba(54,226,123,0.2)] rounded-xl pl-4 pr-12 h-12 sm:h-14 placeholder:text-input-placeholder text-base transition-all outline-none"
                                id="password"
                                placeholder="Create a password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={handleInputChange(setPassword)}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                disabled={isLoading}
                            />
                            <button
                                className="absolute right-4 flex items-center justify-center text-input-placeholder hover:text-primary transition-colors cursor-pointer p-1"
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: '20px' }}
                                >
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-white ml-1" htmlFor="confirm_password">
                            Confirm Password
                        </label>
                        <div className="relative flex items-center">
                            <input
                                className="w-full bg-input-bg text-white border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_15px_rgba(54,226,123,0.2)] rounded-xl pl-4 pr-12 h-12 sm:h-14 placeholder:text-input-placeholder text-base transition-all outline-none"
                                id="confirm_password"
                                placeholder="Repeat your password"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={handleInputChange(setConfirmPassword)}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                disabled={isLoading}
                            />
                            <button
                                className="absolute right-4 flex items-center justify-center text-input-placeholder hover:text-primary transition-colors cursor-pointer p-1"
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: '20px' }}
                                >
                                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-4 w-full bg-primary hover:bg-[#2ecc71] text-background-dark font-bold text-lg rounded-full h-14 transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '20px' }}>
                                    refresh
                                </span>
                                <span>Creating Workspace...</span>
                            </>
                        ) : (
                            <span>Create Workspace</span>
                        )}
                    </button>

                    {/* Security Microcopy */}
                    <div className="flex items-center justify-center gap-2 mt-2 opacity-60">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>
                            lock
                        </span>
                        <p className="text-xs text-center text-text-muted">
                            Your media files are processed securely and auto-deleted.
                        </p>
                    </div>
                </form>

                {/* Footer Login */}
                <div className="text-center">
                    <p className="text-sm text-text-muted">
                        Already have an account?{' '}
                        <a className="text-primary hover:text-white transition-colors font-medium ml-1" href="#">
                            Log in
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
