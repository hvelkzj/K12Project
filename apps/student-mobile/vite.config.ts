import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'

// The published CLI package is CommonJS. Normalize its ESM wrapper so the
// same config works with Node.js 22 on macOS and Windows.
const uni = (
  uniModule as typeof uniModule & { default?: typeof uniModule }
).default ?? uniModule

export default defineConfig({
  plugins: [uni()],
})
