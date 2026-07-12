import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Published on GitHub Pages under the repository path.
export default defineConfig({
  base: '/dev-digest-ai-marketplace/',
  plugins: [react()],
});
