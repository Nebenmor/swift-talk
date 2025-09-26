import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Import compression properly
const compression = require('compression');

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
    this.configureProduction();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private configureProduction(): void {
    // Trust proxy for Render deployment
    if (config.app.env === 'production') {
      this.app.set('trust proxy', 1);
    }
  }

  private initializeMiddlewares(): void {
    // Enhanced security middleware for production
    this.app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        hsts: config.app.env === 'production' ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        } : false,
      })
    );

    // Production-optimized CORS configuration
    const allowedOrigins = config.app.env === 'production' 
      ? [config.app.clientUrl, 'https://your-vercel-domain.vercel.app'] // Replace with your actual Vercel domain
      : [config.app.clientUrl, 'http://localhost:3000'];

    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, etc.)
          if (!origin) return callback(null, true);
          
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          
          console.warn(`CORS blocked origin: ${origin}`);
          return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['X-Total-Count'],
        maxAge: 86400, // 24 hours
      })
    );

    // Proper compression middleware
    this.app.use(compression({
      filter: (req: Request, res: Response) => {
        // Don't compress responses if this request explicitly asks for no compression
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Use compression filter function
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses larger than 1KB
      level: 6, // Compression level (1-9, 6 is default)
    }));

    // Production logging
    if (config.app.env === 'production') {
      this.app.use(morgan('combined'));
    } else {
      this.app.use(morgan('dev'));
    }

    // Production-optimized rate limiting
    const generalLimiter = rateLimit({
      windowMs: config.app.env === 'production' ? 15 * 60 * 1000 : 1 * 60 * 1000, // 15 min in prod, 1 min in dev
      max: config.app.env === 'production' ? 500 : 200, // Higher limit for production
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks and socket.io
        return req.path === '/health' || req.path.includes('socket.io');
      },
    });

    // Stricter rate limiting for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: config.app.env === 'production' ? 10 : 20, // Stricter in production
      message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.',
      },
      skipSuccessfulRequests: true,
    });

    // Apply rate limiting
    this.app.use('/api', generalLimiter);
    this.app.use('/api/auth/login', authLimiter);
    this.app.use('/api/auth/register', authLimiter);

    // Body parsing middleware with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Add request body validation if needed
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 1000
    }));

    // Static files middleware with caching
    this.app.use(
      '/uploads',
      express.static(path.join(process.cwd(), 'uploads'), {
        maxAge: config.app.env === 'production' ? '7d' : '0',
        etag: true,
        lastModified: true,
        setHeaders: (res, path) => {
          // Set security headers for uploaded files
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'DENY');
        }
      })
    );

    // Health check endpoint (before other routes)
    this.app.get('/health', (req: Request, res: Response) => {
      ResponseUtil.success(
        res,
        {
          status: 'OK',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.app.env,
          database: database.getConnectionStatus()
            ? 'connected'
            : 'disconnected',
          version: process.env.npm_package_version || '1.0.0',
          memory: process.memoryUsage(),
        },
        'SwiftTalk server is healthy'
      );
    });

    // Readiness probe for container orchestration
    this.app.get('/ready', (req: Request, res: Response) => {
      if (database.getConnectionStatus()) {
        res.status(200).json({ status: 'ready' });
      } else {
        res.status(503).json({ status: 'not ready', reason: 'database not connected' });
      }
    });
  }

  private initializeRoutes(): void {
    // API routes with versioning
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/chat', chatRoutes);

    // Backward compatibility (remove in future versions)
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/chat', chatRoutes);

    // API documentation route
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'SwiftTalk API',
        version: '1.0.0',
        environment: config.app.env,
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          chat: '/api/chat',
          health: '/health',
          docs: '/api/docs' // If you add API docs later
        }
      });
    });

    // Catch all for undefined API routes
    this.app.all('/api/*', (req: Request, res: Response) => {
      ResponseUtil.notFound(res, `API endpoint ${req.originalUrl} not found`);
    });

    // Catch all for undefined routes
    this.app.all('*', (req: Request, res: Response) => {
      ResponseUtil.notFound(res, `Route ${req.originalUrl} not found on SwiftTalk server`);
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler with production considerations
    this.app.use(
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        // Log error details (in production, use proper logging service)
        console.error('Global error handler:', {
          error: error.message,
          stack: config.app.env === 'development' ? error.stack : undefined,
          url: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });

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

        // File upload errors
        if (error.message?.includes('File too large')) {
          return ResponseUtil.error(res, 'File size exceeds limit', 413);
        }

        // Network timeout errors
        if (error.name === 'TimeoutError') {
          return ResponseUtil.error(res, 'Request timeout', 408);
        }

        // Default error response
        const statusCode = (error as any).statusCode || 500;
        const message = config.app.env === 'production'
          ? 'Internal server error'
          : error.message;

        ResponseUtil.error(res, message, statusCode);
      }
    );

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      // Graceful shutdown in production
      if (config.app.env === 'production') {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Graceful shutdown in production
      if (config.app.env === 'production') {
        process.exit(1);
      }
    });
  }

  public async start(): Promise<void> {
    try {
      await database.connect();
      console.log(`✅ SwiftTalk connected to MongoDB in ${config.app.env} mode`);
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }
}

export default App;