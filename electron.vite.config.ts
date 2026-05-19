import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

function copySchemaPlugin() {
  return {
    name: 'copy-schema-sql',
    closeBundle() {
      mkdirSync(resolve(__dirname, 'out/main'), { recursive: true })
      copyFileSync(
        resolve(__dirname, 'src/main/db/schema.sql'),
        resolve(__dirname, 'out/main/schema.sql')
      )
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySchemaPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    }
  }
})
