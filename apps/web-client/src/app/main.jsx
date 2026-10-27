import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import App from './App.jsx';
import { AuthProvider } from '../features/auth/context/AuthContext.jsx';
import { Toaster } from '../components/ui/sonner.jsx';
import { applyStoredTheme } from '../hooks/use-theme.js';
import { installSingleAudio } from '../lib/audio.js';
import '../styles/index.css';

applyStoredTheme();
installSingleAudio();

const queryClient = new QueryClient();
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </AuthProvider>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
