import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

/**
 * PageViewTracker Component
 * Automatically tracks page views on route changes for SPA
 * Place this component inside BrowserRouter
 */
const PageViewTracker = () => {
    const location = useLocation();

    useEffect(() => {
        // Track page view on route change
        trackPageView(location.pathname + location.search, document.title);
    }, [location]);

    return null; // This component doesn't render anything
};

export default PageViewTracker;
