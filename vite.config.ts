import path from "path"
import { createRequire } from "module"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The title bar and footer both print the app version; reading it from
// package.json at build time keeps a single source of truth instead of a
// string that silently rots after the next release bump.
const { version } = createRequire(import.meta.url)("./package.json") as {
  version: string
}

// https://vite.dev/config/
// Tauri-recommended dev-server settings: fixed port matching tauri.conf.json's
// devUrl, no screen-clearing (so Rust build errors stay visible), and ignore
// src-tauri/ in the watcher since Cargo has its own rebuild loop.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
