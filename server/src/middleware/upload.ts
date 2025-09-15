import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { config } from '../config/config';

// Ensure upload directory exists
const ensureUploadDir = (): void => {
  if (!fs.existsSync(config.upload.uploadDir)) {
    fs.mkdirSync(config.upload.uploadDir, { recursive: true });
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    ensureUploadDir();
    cb(null, config.upload.uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    
    // Sanitize filename
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '');
    const filename = `${sanitizedBaseName}-${uniqueSuffix}${ext}`;
    
    cb(null, filename);
  },
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  // Check if file type is allowed
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`));
  }
};

// Multer configuration
const uploadConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1, // Only allow one file at a time
  },
});

// Single file upload middleware
export const uploadSingle = uploadConfig.single('file');

// Error handling middleware for multer
export const handleUploadError = (
  error: any,
  req: Request,
  res: any,
  next: any
): void => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size is ${config.upload.maxFileSize / (1024 * 1024)}MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Only one file allowed';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = error.message;
    }
    
    return res.status(400).json({
      success: false,
      message,
      error: error.code,
    });
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  
  // Pass other errors to the next error handler
  next(error);
};

// Utility function to get file URL
export const getFileUrl = (filename: string): string => {
  return `/uploads/${filename}`;
};

// Utility function to delete file
export const deleteFile = (filename: string): void => {
  const filePath = path.join(config.upload.uploadDir, filename);
  
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Error deleting file:', err);
    }
  });
};