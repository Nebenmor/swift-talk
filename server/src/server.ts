// server.ts - FIXED Socket.IO configuration for Render deployment
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

// CRITICAL FIX: Production-optimized Socket.IO configuration for Render
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      console.log('Socket.IO CORS check for origin:', origin);
      
      // CRITICAL FIX: Comprehensive origin whitelist for Vercel + Render
      const allowedOrigins = [
        config.app.clientUrl, // https://swifttalk-chat.vercel.app
        'https://swifttalk-chat.vercel.app', // Explicit frontend URL
        'http://localhost:3000', // Local development
        'http://localhost:5173', // Vite dev server  
        'http://localhost:5174', // Alternative Vite port
        // Vercel preview deployments (dynamic)
        /^https:\/\/swifttalk-chat-.*\.vercel\.app$/,
        /^https:\/\/.*\.vercel\.app$/,
        // Render domains
        /^https:\/\/.*\.onrender\.com$/
      ];

      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        console.log('No origin header - allowing request');
        return callback(null, true);
      }

      // Check string matches first
      const stringMatch = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return allowedOrigin === origin;
        }
        return false;
      });

      if (stringMatch) {
        console.log('Origin allowed (string match):', origin);
        return callback(null, true);
      }

      // Check regex patterns
      const regexMatch = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (regexMatch) {
        console.log('Origin allowed (regex match):', origin);
        return callback(null, true);
      }

      console.warn(`Socket.IO CORS blocked origin: ${origin}`);
      console.log('Allowed string origins:', allowedOrigins.filter(o => typeof o === 'string'));
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin'],
  },
  
  // CRITICAL FIX: Transport configuration optimized for Render
  transports: ['polling', 'websocket'], // Always start with polling for stability
  
  // CRITICAL FIX: Allow transport upgrades but with conservative settings  
  allowUpgrades: true,
  
  // CRITICAL FIX: Connection timeouts optimized for Render cold starts
  pingTimeout: 60000, // 60 seconds (generous for cold starts)
  pingInterval: 25000, // 25 seconds
  
  // CRITICAL FIX: Upgrade timeout for Render deployment
  upgradeTimeout: 30000, // 30 seconds for slow connections
  
  // CRITICAL FIX: HTTP buffer size for file uploads
  maxHttpBufferSize: 10e6, // 10MB to match your backend config
  
  // CRITICAL FIX: Disable legacy EIO3
  allowEIO3: false,
  
  // CRITICAL FIX: Production-specific optimizations
  ...(config.app.env === 'production' && {
    // Enable compression for better performance
    compression: true,
    
    // CRITICAL FIX: Connection state recovery for reliability
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes (reduced from 5)
      skipMiddlewares: true,
    },
    
    // CRITICAL FIX: Connect timeout matching frontend
    connectTimeout: 30000, // 30 seconds
  }),
  
  // Development-specific settings
  ...(config.app.env === 'development' && {
    serveClient: false,
    connectTimeout: 20000, // Shorter in dev
  }),
});

// Initialize Socket Manager
const socketManager = new SocketManager(io);

// CRITICAL FIX: Enhanced server startup for Render
const startServer = async (): Promise<void> => {
  try {
    console.log('\n=== SwiftTalk Server Startup ===');
    console.log('Environment:', config.app.env.toUpperCase());
    console.log('Port:', config.app.port);
    console.log('Client URL:', config.app.clientUrl);
    
    // Initialize database connection first
    console.log('Connecting to database...');
    await app.start();

    // CRITICAL FIX: Bind to all interfaces for Render
    const port = config.app.port;
    const host = '0.0.0.0'; // Essential for Render deployment
    
    // Start HTTP server with Socket.IO
    httpServer.listen(port, host, () => {
      console.log('\n🚀 SwiftTalk Server Started Successfully!');
      console.log('================================================');
      console.log(`🌐 Server: http://${host}:${port}`);
      console.log(`📱 Environment: ${config.app.env.toUpperCase()}`);
      console.log(`🔗 Client URL: ${config.app.clientUrl}`);
      console.log(`🗄️  Database: ${database.getConnectionStatus() ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`⚡ Socket.IO: Ready (${io.engine.clientsCount} clients)`);
      console.log(`🚛 Transports: ${JSON.stringify(['polling', 'websocket'])}`);
      
      // CRITICAL FIX: Render health check endpoint
      console.log(`❤️  Health Check: http://${host}:${port}/health`);
      console.log('================================================\n');
    });

    // CRITICAL FIX: Enhanced connection logging for debugging
    io.on('connection', (socket) => {
      const clientInfo = {
        id: socket.id,
        transport: socket.conn.transport.name,
        origin: socket.handshake.headers.origin,
        userAgent: socket.handshake.headers['user-agent']?.substring(0, 50) + '...',
        address: socket.handshake.address,
        time: new Date().toISOString()
      };
      
      console.log('📱 Socket Connected:', clientInfo);
      console.log(`👥 Total Clients: ${io.engine.clientsCount}`);
      
      // Log transport upgrades
      socket.conn.on('upgrade', () => {
        console.log(`📈 Transport upgraded to: ${socket.conn.transport.name} (${socket.id})`);
      });
    });

    // CRITICAL FIX: Comprehensive error handling for Render
    io.engine.on('connection_error', (err) => {
      console.error('🚨 Socket.IO Connection Error:', {
        code: err.code,
        message: err.message,
        context: err.context,
        timestamp: new Date().toISOString(),
        req: err.req ? {
          url: err.req.url,
          method: err.req.method,
          origin: err.req.headers?.origin,
          userAgent: err.req.headers?.['user-agent']?.substring(0, 50)
        } : undefined
      });
    });

    // CRITICAL FIX: Monitor server health
    setInterval(() => {
      const stats = {
        connections: io.engine.clientsCount,
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        timestamp: new Date().toISOString()
      };
      
      if (stats.connections > 0) {
        console.log('📊 Server Stats:', stats);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Register graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// CRITICAL FIX: Graceful shutdown for Render deployments
const gracefulShutdown = (signal: string): void => {
  console.log(`\n🛑 ${signal} received. Initiating graceful shutdown...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error('⏰ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);

  // Close HTTP server first
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

console.log('🚀 Starting SwiftTalk Server...');
startServer();

export { io, socketManager, httpServer };
export default app;