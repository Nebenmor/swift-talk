import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { config } from './config/config';
import { database } from './config/database';
import { ResponseUtil } from './utils/response';

// Import routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import chatRoutes from './routes/chatRoutes';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: config.app.clientUrl,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    // Compression middleware
    this.app.use(compression() as unknown as express.RequestHandler);

    // Logging middleware
    if (config.app.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // More generous rate limiting to prevent the 429 errors
    const generalLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 200, // Increased from 100 to 200 requests per minute
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for socket.io requests
        return req.path.includes('socket.io');
      }
    });

    // Separate, more generous rate limiter for friend-related endpoints
    const friendsLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 50, // 50 requests per minute for friends endpoints
      message: {
        success: false,
        message: 'Too many friend requests from this IP, please slow down.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Apply general rate limiting to API routes
    this.app.use('/api', generalLimiter);
    
    // Apply specific rate limiting to friends endpoints
    this.app.use('/api/users/friends', friendsLimiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files middleware
    this.app.use(
      '/uploads',
      express.static(path.join(process.cwd(), 'uploads'))
    );

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      ResponseUtil.success(
        res,
        {
          status: 'OK',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          database: database.getConnectionStatus()
            ? 'connected'
            : 'disconnected',
        },
        'SwiftTalk server is healthy'
      );
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/chat', chatRoutes);

    // Catch all for undefined routes
    this.app.all('*', (req: Request, res: Response) => {
      ResponseUtil.notFound(res, `Route ${req.originalUrl} not found on SwiftTalk server`);
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use(
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('Global error handler:', error);

        // Mongoose validation error
        if (error.name === 'ValidationError') {
          const validationErrors = Object.values((error as any).errors).map(
            (err: any) => err.message
          );
          return ResponseUtil.validationError(res, validationErrors);
        }

        // Mongoose duplicate key error
        if (
          error.name === 'MongoServerError' &&
          (error as any).code === 11000
        ) {
          const field = Object.keys((error as any).keyValue)[0];
          return ResponseUtil.conflict(res, `${field} already exists`);
        }

        // Mongoose cast error (invalid ObjectId)
        if (error.name === 'CastError') {
          return ResponseUtil.error(res, 'Invalid ID format', 400);
        }

        // JWT errors
        if (error.name === 'JsonWebTokenError') {
          return ResponseUtil.unauthorized(res, 'Invalid token');
        }

        if (error.name === 'TokenExpiredError') {
          return ResponseUtil.unauthorized(res, 'Token expired');
        }

        // Default error
        const statusCode = (error as any).statusCode || 500;
        const message =
          config.app.env === 'development'
            ? error.message
            : 'Internal server error in SwiftTalk';

        ResponseUtil.error(res, message, statusCode);
      }
    );
  }

  public async start(): Promise<void> {
    try {
      await database.connect();
      console.log('✅ SwiftTalk connected to MongoDB:', database.getConnectionStatus());
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }
}

export default App;