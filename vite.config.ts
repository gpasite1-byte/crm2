import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Ensure public/videos exist and sync videos from root /videos directory
const rootVideosDir = path.resolve(__dirname, 'videos');
const publicVideosDir = path.resolve(__dirname, 'public', 'videos');
if (!fs.existsSync(publicVideosDir)) {
  fs.mkdirSync(publicVideosDir, { recursive: true });
}
if (fs.existsSync(rootVideosDir)) {
  try {
    const files = fs.readdirSync(rootVideosDir);
    for (const file of files) {
      const srcFile = path.join(rootVideosDir, file);
      const destFile = path.join(publicVideosDir, file);
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  } catch (err) {
    console.warn('Could not sync videos directory:', err);
  }
}

// Automatically synchronize all GPA reports from RELATORIO CRM GPA & Ducumentos up to 24–28 Ago 2026
try {
  const syncScript = path.resolve(__dirname, 'scripts', 'sync_to_db_and_data.cjs');
  if (fs.existsSync(syncScript)) {
    require(syncScript);
  }
} catch (syncErr) {
  console.warn('Auto-sync report notice:', syncErr);
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://cwojfqzmcjraxdxodbdg.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_-09xQP6TNwAOV0dD55K7Rg_GxHzH_rf'),
      'import.meta.env.VITE_PUSHER_KEY': JSON.stringify('a550429481c13c39f9a6'),
      'import.meta.env.VITE_PUSHER_CLUSTER': JSON.stringify('sa1'),
      'import.meta.env.VITE_ABLY_API_KEY': JSON.stringify('m2MFEg.B7JOLQ:u_MtYkbldvUScXPtRmsnN7MglKkVGlxJquINjmlVsOo')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Disable HMR auto-reloads to prevent page flickering and auto-refreshes while user is typing
      hmr: false,
      strictPort: false,
      watch: {
        ignored: ['**/dist/**', '**/videos/**', '**/Ducumentos/**', '**/RELATORIO CRM GPA/**', '**/*.xlsx', '**/*.htm']
      }
    },
  };
});

