import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the built app runs from any static path (or file://).
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
