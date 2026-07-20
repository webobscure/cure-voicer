import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {
    // Sandboxed Electron preload scripts cannot use ESM. Keep this bundle in
    // CommonJS even though the main process uses native ESM.
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: ['src/renderer/index.html', 'src/renderer/overlay.html']
      }
    }
  }
})
