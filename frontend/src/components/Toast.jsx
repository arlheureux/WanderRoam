import { Toaster } from 'react-hot-toast';

export const ToastContainer = () => (
  <Toaster
    position="top-right"
    toastOptions={{
      duration: 4000,
      style: {
        background: '#2D3436',
        color: '#fff',
        borderRadius: '8px',
        padding: '12px 16px',
      },
      success: {
        iconTheme: {
          primary: '#00B894',
          secondary: '#fff',
        },
      },
      error: {
        iconTheme: {
          primary: '#FF6B6B',
          secondary: '#fff',
        },
        duration: 5000,
      },
    }}
  />
);

export default ToastContainer;
