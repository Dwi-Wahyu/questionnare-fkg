// PM2 Ecosystem Configuration
// Usage:  pm2 start ecosystem.config.js --env production
// Reload: pm2 reload scratch
// Stop:   pm2 stop scratch
// Logs:   pm2 logs scratch

module.exports = {
  apps: [
    {
      name: "scratch",

      // rsbuild preview is the production SSR server (bun run start)
      // We call it through bun so bun:sqlite stays available at runtime
      script: "bun",
      args: "run start",

      // Working directory (relative to this file)
      cwd: "./",

      // Single process — SQLite doesn't support concurrent writes from
      // multiple processes. Switch to "cluster" + a proper DB if needed.
      instances: 1,
      exec_mode: "fork",

      // Auto-restart settings
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000, // ms between restarts
      min_uptime: "5s", // must stay up at least 5 s to count as "started"

      // ── Environments ──────────────────────────────────────────────────────
      // pm2 start ecosystem.config.js --env production  (default)
      env_production: {
        NODE_ENV: "production",
        PORT: 2635,
      },
      // pm2 start ecosystem.config.js --env development
      env_development: {
        NODE_ENV: "development",
        PORT: 2635,
      },

      // ── Logging ───────────────────────────────────────────────────────────
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Graceful shutdown timeout (ms)
      kill_timeout: 5000,
    },
  ],
};
