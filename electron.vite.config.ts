import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: 'src/main/index.ts',
          'llm-worker': 'src/main/llm-worker.ts',
          'windows-asr-worker': 'src/main/windows-asr-worker.ts'
        }
      }
    }
  },
  preload: {
    // Sandboxed Electron preload scripts cannot use ESM. Keep this bundle in
    // CommonJS even though the main process uses native ESM.
    build: {
      rollupOptions: {
        input: {
          index: 'src/preload/index.ts',
          overlay: 'src/preload/overlay.ts'
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: ['src/renderer/index.html', 'src/renderer/overlay.html']
      }
    }
  }
})
