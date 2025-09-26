// server.ts - Updated Socket.IO configuration for production deployment

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

// FIXED: Production-optimized Socket.IO configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      console.log('Socket.IO CORS check for origin:', origin);
      
      // CRITICAL FIX: Include all possible origins
      const allowedOrigins = [
        config.app.clientUrl, // Your Vercel frontend
        'https://swifttalk-chat.vercel.app', // Explicit Vercel domain
        'http://localhost:3000', // Local development
        'http://localhost:5173', // Vite dev server
        'https://swift-talk-i1ov.onrender.com', // Your Render backend (for testing)
        // Add regex patterns for any Vercel preview deployments
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.onrender\.com$/
      ];

      // Allow requests with no origin (Postman, mobile apps, etc.)
      if (!origin) {
        console.log('No origin - allowing request');
        return callback(null, true);
      }

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
        console.log('Origin allowed:', origin);
        callback(null, true);
      } else {
        console.warn(`Socket.IO blocked origin: ${origin}`);
        console.log('Allowed origins:', allowedOrigins.filter(o => typeof o === 'string'));
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  
  // FIXED: Transport configuration optimized for Render
  transports: config.app.env === 'production' 
    ? ['polling', 'websocket'] // Start with polling in production, then upgrade
    : ['websocket', 'polling'], // WebSocket first in development
  
  // FIXED: Connection settings optimized for cloud deployment
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  
  // FIXED: Upgrade timeout for cloud deployment
  upgradeTimeout: 30000, // Increased to 30 seconds for slower connections
  
  // Maximum HTTP buffer size (5MB for file uploads)
  maxHttpBufferSize: 5e6,
  
  // Disable EIO3 for better performance
  allowEIO3: false,
  
  // FIXED: Production-specific settings
  ...(config.app.env === 'production' && {
    // Enable compression in production
    compression: true,
    
    // FIXED: Connection state recovery for better reliability
    connectionStateRecovery: {
      maxDisconnectionDuration: 5 * 60 * 1000, // 5 minutes
      skipMiddlewares: true,
    },
    
    // FIXED: Longer timeouts for cloud deployment
    connectTimeout: 60000, // 60 seconds
    
    // FIXED: Force new connections to avoid stale connections
    forceNew: true,
  }),
  
  // Development-specific settings
  ...(config.app.env === 'development' && {
    serveClient: false,
  }),
});

// Initialize Socket Manager
const socketManager = new SocketManager(io);

// FIXED: Enhanced server startup function
const startServer = async (): Promise<void> => {
  try {
    // Initialize database connection first
    console.log('Connecting to database...');
    await app.start();

    // FIXED: Configure server host and port for Render
    const port = config.app.port;
    const host = '0.0.0.0'; // Always bind to 0.0.0.0 for cloud deployments
    
    // Start HTTP server with Socket.IO
    httpServer.listen(port, host, () => {
      console.log('\nSwiftTalk Server Started Successfully!');
      console.log('================================================');
      console.log(`Server: http://${host}:${port}`);
      console.log(`Environment: ${config.app.env.toUpperCase()}`);
      console.log(`Client URL: ${config.app.clientUrl}`);
      console.log(`Database: ${database.getConnectionStatus() ? 'Connected' : 'Disconnected'}`);
      console.log(`Socket.IO: ${io.engine.clientsCount} clients connected`);
      console.log(`Socket Transports: ${JSON.stringify(io.engine.opts.transports)}`);
      console.log('================================================\n');
    });

    // FIXED: Enhanced Socket.IO connection logging
    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id} (${io.engine.clientsCount} total)`);
      console.log(`Transport: ${socket.conn.transport.name}`);
      console.log(`Origin: ${socket.handshake.headers.origin}`);
    });

    // FIXED: Better Socket.IO error handling
    io.engine.on('connection_error', (err) => {
      console.error('Socket.IO engine error:', {
        code: err.code,
        message: err.message,
        context: err.context,
        req: err.req ? {
          url: err.req.url,
          headers: err.req.headers,
          method: err.req.method
        } : undefined
      });
    });

    // Register signal handlers for graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = (signal: string): void => {
  console.log(`\n${signal} received. Initiating graceful shutdown...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);

  httpServer.close((err) => {
    if (err) {
      console.error('Error closing HTTP server:', err);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
    
    console.log('HTTP server closed');

    io.close((err) => {
      if (err) {
        console.error('Error closing Socket.IO server:', err);
      } else {
        console.log('Socket.IO server closed');
      }

      database.disconnect()
        .then(() => {
          console.log('Database connection closed');
          console.log('Graceful shutdown completed');
          clearTimeout(forceShutdownTimer);
          process.exit(0);
        })
        .catch((error) => {
          console.error('Error closing database connection:', error);
          clearTimeout(forceShutdownTimer);
          process.exit(1);
        });
    });
  });
};

console.log('Starting SwiftTalk Server...');
startServer();

export { io, socketManager, httpServer };
export default app;