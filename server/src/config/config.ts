import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface Config {
  app: {
    port: number;
    env: string;
    clientUrl: string;
  };
  database: {
    uri: string;
    name: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    uploadDir: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

const validateEnv = (): void => {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
  }
};

// Validate environment variables on startup
validateEnv();

export const config: Config = {
  app: {
    port: parseInt(process.env.PORT || '5000', 10),
    env: process.env.NODE_ENV || 'development',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp',
    name: process.env.DB_NAME || 'chatapp',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
    ],
    uploadDir: path.join(process.cwd(), 'uploads'),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};