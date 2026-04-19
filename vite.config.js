import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  root: __dirname,
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        viewer: './viewer.html',
        upload: './upload.html',
        select: './select.html',
      },
    },
  },
})
