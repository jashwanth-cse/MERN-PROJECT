import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { registerServiceWorker } from './utils/pushNotifications'

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  registerServiceWorker().catch(err => {
    console.warn('Service worker registration failed:', err);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
      toastStyle={{
        backgroundColor: '#1a2b22',
        color: '#ffffff',
        border: '1px solid #2a4535',
        borderRadius: '1rem'
      }}
    />
  </StrictMode>,
)
