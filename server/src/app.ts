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
    this.app.use(compression());

    // Logging middleware
    if (config.app.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api', limiter);

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
        'Server is healthy'
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
      ResponseUtil.notFound(res, `Route ${req.originalUrl} not found`);
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
            : 'Internal server error';

        ResponseUtil.error(res, message, statusCode);
      }
    );
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await database.connect();

      // Start server
      const port = config.app.port;
      this.app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);
        console.log(`📍 Environment: ${config.app.env}`);
        console.log(`🌍 Client URL: ${config.app.clientUrl}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

export default App;
