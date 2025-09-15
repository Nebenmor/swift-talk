import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUserDocument } from '../types';

const userSchema = new Schema<IUserDocument>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [20, 'Username must be less than 20 characters'],
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain alphanumeric characters and underscores',
      ],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      validate: {
        validator: function (password: string): boolean {
          // At least 1 uppercase, 1 lowercase, 1 number
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(password);
        },
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      },
    },
    avatar: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for faster queries
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isOnline: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with salt rounds of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Static method to find user by username or email
userSchema.statics.findByCredentials = async function (
  identifier: string
): Promise<IUserDocument | null> {
  const user = await this.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  });
  return user;
};

// Update lastSeen when user comes online
userSchema.methods.updateLastSeen = function (): Promise<IUserDocument> {
  this.lastSeen = new Date();
  return this.save();
};

// Set user online/offline status
userSchema.methods.setOnlineStatus = function (
  isOnline: boolean
): Promise<IUserDocument> {
  this.isOnline = isOnline;
  if (!isOnline) {
    this.lastSeen = new Date();
  }
  return this.save();
};

export const User = mongoose.model<IUserDocument>('User', userSchema);