import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the build works on GitHub Pages
// (https://<user>.github.io/<repo>/) and on a custom domain without changes.
export default defineConfig({
  plugins: [react()],
  base: './',
});
