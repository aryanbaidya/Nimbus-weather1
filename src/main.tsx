import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import {ErrorBoundary} from './components/ErrorBoundary';

window.addEventListener('error', (event) => {
  const msg = event.message?.toLowerCase() || '';
  if (
    msg.includes('script error') || 
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  ) {
    return;
  }

  const errorInfo = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    errorObj: event.error ? {
      message: event.error.message,
      stack: event.error.stack
    } : 'None'
  };
  console.error('Fatal Runtime Error:', JSON.stringify(errorInfo, null, 2));
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message?.toLowerCase() || String(event.reason).toLowerCase();
  
  // Silence cryptic promise rejections that are already handled by the UI
  if (
    reason.includes('script error') || 
    reason.includes('failed to fetch') || 
    reason.includes('abort') ||
    reason.includes('timeout')
  ) {
    event.preventDefault(); // Prevent browser from logging to console
    return;
  }
  
  console.error('Unhandled Promise Rejection:', event.reason);
});

// Improve scrolling performance in WebView
window.addEventListener('touchstart', () => {}, { passive: true });
window.addEventListener('touchmove', () => {}, { passive: true });

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } else {
    throw new Error('Root element #root not found in document');
  }
} catch (err: any) {
  console.error("Init failed:", err);
  document.body.innerHTML = `
    <div style="color:white;padding:24px;background:#0f172a;min-height:100vh;
      font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <h2 style="font-size:24px;margin-bottom:16px;">Something went wrong</h2>
      <p style="opacity:0.7;margin-bottom:32px;max-width:300px;line-height:1.5;">${err.message || 'The application failed to start'}</p>
      <button onclick="location.reload()" 
        style="padding:16px 32px;
        background:#ffffff;color:#000000;
        border:none;border-radius:100px;
        font-size:16px;font-weight:600;cursor:pointer;
        transition:transform 0.2s active:scale(0.95)">
        Retry
      </button>
    </div>
  `;
}
