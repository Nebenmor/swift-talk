import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import App from './app';
import { config } from './config/config';
import { database } from './config/database';
import SocketManager from './socket/socketHandlers';

// Initialize Express app
const app = new App();

// Create HTTP server
const httpServer = createServer(app.app);

// Production-optimized Socket.IO configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests from your production frontend domain
      const allowedOrigins = config.app.env === 'production' 
        ? [
            config.app.clientUrl,
            // Add your actual Vercel domains here when you get them
            /^https:\/\/.*\.vercel\.app$/,
            /^https:\/\/.*\.onrender\.com$/
          ] 
        : [config.app.clientUrl, 'http://localhost:3000', 'http://localhost:5173'];

      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Check if origin matches any allowed pattern
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return allowedOrigin === origin;
        } else if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`Socket.IO blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  
  // Production transport configuration
  transports: ['websocket', 'polling'],
  
  // Connection settings optimized for production
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  
  // Upgrade timeout for production
  upgradeTimeout: 10000, // 10 seconds
  
  // Maximum HTTP buffer size (1MB)
  maxHttpBufferSize: 1e6,
  
  // Disable EIO3 for better performance
  allowEIO3: false,
  
  // Production-specific settings
  ...(config.app.env === 'production' && {
    // Enable compression in production
    compression: true,
    
    // Connection state recovery for better reliability
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
    
    // Close inactive connections
    connectTimeout: 45000, // 45 seconds
  }),
  
  // Development-specific settings
  ...(config.app.env === 'development' && {
    // More verbose logging in development
    serveClient: false,
  }),
});

// Initialize Socket Manager
const socketManager = new SocketManager(io);

// Enhanced graceful shutdown handler
const gracefulShutdown = (signal: string): void => {
  console.log(`\n🔄 ${signal} received. Initiating graceful shutdown...`);

  // Set a timeout for forced shutdown
  const forceShutdownTimer = setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000); // 30 seconds timeout

  // Close new connections
  httpServer.close((err) => {
    if (err) {
      console.error('❌ Error closing HTTP server:', err);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
    
    console.log('✅ HTTP server closed');

    // Close Socket.IO server
    io.close((err) => {
      if (err) {
        console.error('❌ Error closing Socket.IO server:', err);
      } else {
        console.log('✅ Socket.IO server closed');
      }

      // Close database connection
      database.disconnect()
        .then(() => {
          console.log('✅ Database connection closed');
          console.log('🏁 Graceful shutdown completed');
          clearTimeout(forceShutdownTimer);
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Error closing database connection:', error);
          clearTimeout(forceShutdownTimer);
          process.exit(1);
        });
    });
  });
};

// Server startup function
const startServer = async (): Promise<void> => {
  try {
    // Initialize database connection first
    console.log('🔄 Connecting to database...');
    await app.start();

    // Configure server host and port
    const port = config.app.port;
    const host = config.app.env === 'production' ? '0.0.0.0' : 'localhost';
    
    // Start HTTP server with Socket.IO
    httpServer.listen(port, host, () => {
      console.log('\n🚀 SwiftTalk Server Started Successfully!');
      console.log('================================================');
      console.log(`📍 Server: http://${host}:${port}`);
      console.log(`🌍 Environment: ${config.app.env.toUpperCase()}`);
      console.log(`🎯 Client URL: ${config.app.clientUrl}`);
      console.log(`💾 Database: ${database.getConnectionStatus() ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`⚡ Socket.IO: ${io.engine.clientsCount} clients connected`);
      
      if (config.app.env === 'production') {
        console.log('🔒 Security: Enhanced production mode active');
        console.log('🚄 Performance: Production optimizations enabled');
        console.log('📊 Monitoring: Health checks available at /health');
      } else {
        console.log('🔧 Development: Debug mode active');
      }
      console.log('================================================\n');
    });

    // Register signal handlers for graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

    // Enhanced error handling for server
    httpServer.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

      switch (error.code) {
        case 'EACCES':
          console.error(`❌ ${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`❌ ${bind} is already in use`);
          process.exit(1);
          break;
        case 'ENOTFOUND':
          console.error(`❌ Host not found`);
          process.exit(1);
          break;
        default:
          console.error('❌ Server error:', error);
          throw error;
      }
    });

    // Socket.IO connection monitoring
    io.on('connection', (socket) => {
      if (config.app.env === 'development') {
        console.log(`🔌 Socket connected: ${socket.id} (${io.engine.clientsCount} total)`);
      }
    });

    // Socket.IO error handling
    io.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });

    io.engine.on('connection_error', (err) => {
      console.error('❌ Socket.IO engine error:', {
        code: err.code,
        message: err.message,
        context: err.context,
      });
    });

    // Periodic health monitoring (production only)
    if (config.app.env === 'production') {
      setInterval(() => {
        const stats = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          connections: io.engine.clientsCount,
          database: database.getConnectionStatus(),
        };
        
        // Log health stats every 5 minutes
        if (Math.floor(stats.uptime) % 300 === 0) {
          console.log('📊 Health check:', stats);
        }
      }, 60000); // Check every minute
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    // Attempt to close any open connections
    if (httpServer.listening) {
      httpServer.close();
    }
    
    if (database.getConnectionStatus()) {
      await database.disconnect();
    }
    
    process.exit(1);
  }
};

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Process event handlers for better debugging
process.on('warning', (warning) => {
  console.warn('⚠️ Process warning:', warning.name, warning.message);
});

// Memory usage monitoring with cleanup
if (config.app.env === 'development') {
  let memoryCheckCount = 0;
  
  setInterval(() => {
    const usage = process.memoryUsage();
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024 * 100) / 100;
    
    // Trigger garbage collection every 10 checks if memory is high
    memoryCheckCount++;
    if (memoryCheckCount >= 10 && usage.heapUsed > 200 * 1024 * 1024) {
      if (global.gc) {
        global.gc();
        console.log('🧹 Garbage collection triggered');
      }
      memoryCheckCount = 0;
    }
    
    if (usage.heapUsed > 150 * 1024 * 1024) { // Alert if > 150MB (reduced from 100MB)
      console.warn('⚠️ Memory usage:', {
        rss: `${mb(usage.rss)} MB`,
        heapTotal: `${mb(usage.heapTotal)} MB`,
        heapUsed: `${mb(usage.heapUsed)} MB`,
        external: `${mb(usage.external)} MB`,
      });
    }
  }, 30000); // Check every 30 seconds
}

// Start the server
console.log('🎯 Starting SwiftTalk Server...');
startServer();

// Export server instances for testing
export { io, socketManager, httpServer };
export default app;