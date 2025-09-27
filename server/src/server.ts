// server.ts - FINAL FIX with proper Socket.IO initialization and debugging
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

console.log('🔧 Initializing Socket.IO server...');

// CRITICAL FIX: Socket.IO configuration with comprehensive debugging
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      console.log('🌐 Socket.IO CORS check for origin:', origin);
      
      const allowedOrigins = [
        config.app.clientUrl,
        'https://swifttalk-chat.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        /^https:\/\/swifttalk-chat-.*\.vercel\.app$/,
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.onrender\.com$/
      ];

      if (!origin) {
        console.log('✅ No origin header - allowing request');
        return callback(null, true);
      }

      const stringMatch = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return allowedOrigin === origin;
        }
        return false;
      });

      if (stringMatch) {
        console.log('✅ Origin allowed (string match):', origin);
        return callback(null, true);
      }

      const regexMatch = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (regexMatch) {
        console.log('✅ Origin allowed (regex match):', origin);
        return callback(null, true);
      }

      console.warn('❌ Socket.IO CORS blocked origin:', origin);
      console.log('📋 Allowed string origins:', allowedOrigins.filter(o => typeof o === 'string'));
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin'],
  },
  
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 10e6,
  allowEIO3: false,
  
  ...(config.app.env === 'production' && {
    compression: true,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    connectTimeout: 30000,
  }),
});

console.log('✅ Socket.IO server initialized');

// Add debug endpoints to Express app after Socket.IO initialization
app.app.get('/socket-debug', (req, res) => {
  res.json({
    socketIO: {
      status: 'initialized',
      clientsCount: io.engine.clientsCount,
      transports: ['polling', 'websocket'],
      engineReady: !!io.engine,
    },
    cors: {
      clientUrl: config.app.clientUrl,
      credentials: true
    },
    server: {
      environment: config.app.env,
      port: config.app.port,
      uptime: Math.floor(process.uptime()),
    },
    timestamp: new Date().toISOString(),
    debug: {
      socketIOPath: '/socket.io/',
      testUrl: `${req.protocol}://${req.get('host')}/socket.io/?EIO=4&transport=polling`
    }
  });
});

// Initialize Socket Manager
console.log('🔧 Initializing Socket Manager...');
const socketManager = new SocketManager(io);
console.log('✅ Socket Manager initialized');

// Enhanced server startup
const startServer = async (): Promise<void> => {
  try {
    console.log('\n🚀 === SwiftTalk Server Startup ===');
    console.log('📊 Environment:', config.app.env.toUpperCase());
    console.log('🔌 Port:', config.app.port);
    console.log('🌐 Client URL:', config.app.clientUrl);
    
    // Initialize database connection
    console.log('🗄️  Connecting to database...');
    await app.start();

    const port = config.app.port;
    const host = '0.0.0.0';
    
    // Start server
    httpServer.listen(port, host, () => {
      console.log('\n🎉 SwiftTalk Server Started Successfully!');
      console.log('================================================');
      console.log(`🌍 Server: http://${host}:${port}`);
      console.log(`📱 Environment: ${config.app.env.toUpperCase()}`);
      console.log(`🔗 Client URL: ${config.app.clientUrl}`);
      console.log(`🗄️  Database: ${database.getConnectionStatus() ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`⚡ Socket.IO: ✅ Ready (${io.engine.clientsCount} clients)`);
      console.log(`🚛 Transports: ["polling", "websocket"]`);
      console.log(`🔍 Debug: http://${host}:${port}/socket-debug`);
      console.log(`🧪 Socket.IO Test: http://${host}:${port}/socket.io/?EIO=4&transport=polling`);
      console.log(`❤️  Health: http://${host}:${port}/health`);
      console.log('================================================\n');
    });

    // Socket.IO connection handler with enhanced logging
    io.on('connection', (socket) => {
      const clientInfo = {
        id: socket.id,
        transport: socket.conn.transport.name,
        origin: socket.handshake.headers.origin,
        userAgent: socket.handshake.headers['user-agent']?.substring(0, 50) + '...',
        address: socket.handshake.address,
        time: new Date().toISOString()
      };
      
      console.log('📱 Socket Connected:', JSON.stringify(clientInfo, null, 2));
      console.log(`👥 Total Clients: ${io.engine.clientsCount}`);
      
      socket.conn.on('upgrade', () => {
        console.log(`📈 Transport upgraded: ${socket.conn.transport.name} (${socket.id})`);
      });

      socket.on('disconnect', (reason) => {
        console.log(`📱 Socket Disconnected: ${socket.id} (${reason})`);
        console.log(`👥 Remaining Clients: ${io.engine.clientsCount}`);
      });
    });

    // Enhanced error handling
    io.engine.on('connection_error', (err) => {
      console.error('🚨 Socket.IO Connection Error:');
      console.error('├─ Code:', err.code);
      console.error('├─ Message:', err.message);
      console.error('├─ Context:', err.context);
      console.error('├─ Timestamp:', new Date().toISOString());
      if (err.req) {
        console.error('├─ Request URL:', err.req.url);
        console.error('├─ Request Method:', err.req.method);
        console.error('├─ Request Origin:', err.req.headers?.origin);
        console.error('└─ User Agent:', err.req.headers?.['user-agent']?.substring(0, 50));
      }
    });

    // Health monitoring
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
    }, 5 * 60 * 1000);

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal: string): void => {
  console.log(`\n🛑 ${signal} received. Initiating graceful shutdown...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error('⏰ Forced shutdown after 30 seconds');
    process.exit(1);
  }, 30000);

  httpServer.close((err) => {
    if (err) {
      console.error('❌ Error closing HTTP server:', err);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
    
    console.log('✅ HTTP server closed');

    io.close((err) => {
      if (err) {
        console.error('❌ Error closing Socket.IO:', err);
      } else {
        console.log('✅ Socket.IO closed');
      }

      database.disconnect()
        .then(() => {
          console.log('✅ Database disconnected');
          console.log('🏁 Graceful shutdown completed');
          clearTimeout(forceShutdownTimer);
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Database disconnect error:', error);
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