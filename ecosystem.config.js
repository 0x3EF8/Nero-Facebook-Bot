/**
 * PM2 Ecosystem Configuration for Nero Bot
 * 
 * This file configures PM2 process manager for:
 * - Auto-restart on crash
 * - Auto-restart on file changes (watch mode)
 * - Log management
 * - Memory limit monitoring
 * 
 * Usage:
 *   pm2 start ecosystem.config.js     # Start the bot
 *   pm2 stop nero                     # Stop the bot
 *   pm2 restart nero                  # Restart the bot
 *   pm2 logs nero                     # View logs
 *   pm2 monit                         # Monitor dashboard
 *   pm2 save                          # Save process list
 *   pm2 startup                       # Enable auto-start on system boot
 */

module.exports = {
  apps: [
    {
      name: "nero",
      script: "index.js",
      
      // Working directory
      cwd: __dirname,
      
      // Instances (1 for single process, or 'max' for cluster mode)
      instances: 1,
      exec_mode: "fork",  // Use fork mode for colored output
      
      // Auto-restart settings
      autorestart: true,
      watch: false,  // Set to true for auto-restart on file changes
      max_memory_restart: "500M",  // Restart if memory exceeds 500MB
      
      // Restart delay
      restart_delay: 3000,  // 3 second delay between restarts
      
      // Max restarts within time window
      max_restarts: 10,
      min_uptime: "10s",  // Consider started after 10 seconds
      
      // Environment variables - FORCE_COLOR enables colored output in PM2
      env: {
        NODE_ENV: "production",
        FORCE_COLOR: "1",
      },
      env_development: {
        NODE_ENV: "development",
        FORCE_COLOR: "1",
      },
      
      // Logging - disable log files to see colors in pm2 logs
      log_file: "./logs/pm2-combined.log",
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      log_date_format: false,  // Disable timestamp in logs (set to "YYYY-MM-DD HH:mm:ss Z" to enable)
      merge_logs: false,
      
      // Graceful shutdown
      kill_timeout: 5000,  // 5 seconds to gracefully shutdown
      listen_timeout: 3000,
      
      // Ignore watch patterns (if watch is enabled)
      ignore_watch: [
        "node_modules",
        "logs",
        "*.log",
        ".git",
        "accounts_backup",
        "data/temp"
      ],
      
      // Source map support for better error traces
      source_map_support: true,
    }
  ]
};
