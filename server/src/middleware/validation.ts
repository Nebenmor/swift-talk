import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ResponseUtil } from '../utils/response';
import { validatePasswordStrength } from '../utils/password';

// Middleware to handle validation errors
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    ResponseUtil.validationError(res, errorMessages);
    return;
  }
  
  next();
};

// User validation rules
export const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .toLowerCase(),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('password')
    .custom((value) => {
      const validation = validatePasswordStrength(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),
    
  handleValidationErrors,
];

export const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
    
  handleValidationErrors,
];

// Message validation rules
export const validateSendMessage = [
  body('recipient')
    .trim()
    .notEmpty()
    .withMessage('Recipient is required')
    .isMongoId()
    .withMessage('Invalid recipient ID'),
    
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters'),
    
  body('messageType')
    .optional()
    .isIn(['text', 'file'])
    .withMessage('Message type must be text or file'),
    
  handleValidationErrors,
];

// Friend request validation rules
export const validateFriendRequest = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
    
  handleValidationErrors,
];

// Pagination validation rules
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
    
  handleValidationErrors,
];

// MongoDB ObjectId validation
export const validateObjectId = (paramName: string) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`),
    
  handleValidationErrors,
];

// Chat room validation
export const validateChatParams = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),
    
  handleValidationErrors,
];

// File upload validation (used with multer)
export const validateFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.file) {
    ResponseUtil.error(res, 'No file provided', 400);
    return;
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
  ];

  if (!allowedTypes.includes(req.file.mimetype)) {
    ResponseUtil.error(res, 'Invalid file type', 400);
    return;
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxSize) {
    ResponseUtil.error(res, 'File too large. Maximum size is 5MB', 400);
    return;
  }

  next();
};