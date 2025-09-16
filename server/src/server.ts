import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import App from './app';
import { config } from './config/config';
import SocketManager from './socket/socketHandlers';

// Initialize Express app
const app = new App();

// Create HTTP server
const httpServer = createServer(app.app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.app.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Initialize Socket Manager
const socketManager = new SocketManager(io);

// Start the server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database first
    await app.start();

    // Start HTTP server with Socket.IO
    const port = config.app.port;
    httpServer.listen(port, () => {
      console.log(`🚀 Server with Socket.IO running on port ${port}`);
      console.log(`📍 Environment: ${config.app.env}`);
      console.log(`🌍 Client URL: ${config.app.clientUrl}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string): void => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      httpServer.close(async () => {
        console.log('HTTP server closed');

        // Close Socket.IO server
        io.close(() => {
          console.log('Socket.IO server closed');
        });

        // Close database connection
        const { database } = await import('./config/database');
        await database.disconnect();

        console.log('Graceful shutdown completed');
        process.exit(0);
      });
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export { io, socketManager };
