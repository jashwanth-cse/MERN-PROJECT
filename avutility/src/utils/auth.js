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
