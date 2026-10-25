import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    // host: true allows access from local network devices (e.g. mobile testing).
    // Enabled only in development — never in CI or production builds.
    host: mode === 'development',
    port: 5173,
  },
}));

