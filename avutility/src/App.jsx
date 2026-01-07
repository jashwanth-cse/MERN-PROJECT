import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import PageViewTracker from './components/PageViewTracker';
import { isAuthenticated } from './utils/auth';

// Auth page wrapper to redirect if already logged in
const AuthPage = ({ children }) => {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <BrowserRouter>
      {/* Auto-track page views on route changes */}
      <PageViewTracker />
      <div className="relative font-display antialiased text-white selection:bg-primary selection:text-background-dark bg-background-dark min-h-screen overflow-x-hidden">
        <Routes>
          {/* Auth Routes */}
          <Route
            path="/"
            element={
              <AuthPage>
                <>
                  {/* Toggle between Login/Signup */}
                  <div className="fixed top-4 right-4 z-50 bg-surface-dark border border-border-dark rounded-full p-1 flex gap-1 shadow-xl">
                    <button
                      onClick={() => setShowLogin(true)}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${showLogin ? 'bg-primary text-background-dark font-bold' : 'text-text-muted hover:text-white'}`}
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setShowLogin(false)}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${!showLogin ? 'bg-primary text-background-dark font-bold' : 'text-text-muted hover:text-white'}`}
                    >
                      Signup
                    </button>
                  </div>
                  {showLogin ? <Login /> : <Signup />}
                </>
              </AuthPage>
            }
          />

          {/* Protected Dashboard Route */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
