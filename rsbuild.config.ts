import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  server: {
    // Reads PORT env var set by PM2 (ecosystem.config.cjs), falls back to 3438.
    port: Number(process.env.PORT) || 3438,
    // Bind to all interfaces so Docker (and PM2) can expose the port externally.
    // Without this, rsbuild preview only listens on 127.0.0.1 inside the container.
    host: '0.0.0.0',
  },
  plugins: [pluginReact(), tanstackStart()],
  tools: {
    rspack: {
      externals: ['bun:sqlite', 'better-sqlite3'],
    },
  },
})
