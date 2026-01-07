import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';

const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated()) {
        // Redirect to login if not authenticated
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
