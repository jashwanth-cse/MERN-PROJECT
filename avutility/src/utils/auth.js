// Authentication utility functions

export const isAuthenticated = () => {
    const token = localStorage.getItem('token');
    return !!token;
};

export const getToken = () => {
    return localStorage.getItem('token');
};

export const getUser = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
};

export const setAuthData = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const logout = () => {
    clearAuthData();
    window.location.href = '/';
};

/**
 * Sign in with Google using Firebase Authentication
 * @returns {Promise<{user: object, token: string}>} User data and Firebase ID token
 */
export const signInWithGoogle = async () => {
    try {
        // Dynamically import Firebase to avoid initialization before env vars are set
        const { signInWithPopup } = await import('firebase/auth');
        const { auth, googleProvider } = await import('../config/firebase');

        // Open Google sign-in popup
        const result = await signInWithPopup(auth, googleProvider);

        // Extract user information
        const user = result.user;
        const token = await user.getIdToken();

        // Format user data to match existing auth structure
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            provider: 'google',
        };

        // Store auth data using existing utility
        setAuthData(token, userData);

        return { user: userData, token };
    } catch (error) {
        // Handle specific Firebase errors
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Sign-in cancelled');
        } else if (error.code === 'auth/popup-blocked') {
            throw new Error('Please allow popups for this site');
        } else if (error.code === 'auth/network-request-failed') {
            throw new Error('Network error. Please check your connection');
        } else {
            throw new Error(error.message || 'Google sign-in failed');
        }
    }
};

