import { User } from '../models/User';
import { generateToken } from '../utils/jwt';
import { validatePasswordStrength } from '../utils/password';
import { LoginCredentials, RegisterCredentials, AuthResponse, IUser } from '../types';

export class AuthService {
  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { username, email, password } = credentials;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new Error('Username already exists');
      }
      if (existingUser.email === email) {
        throw new Error('Email already exists');
      }
    }

    // Validate password strength (additional check)
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Create user
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user.toObject());

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      user: userResponse,
      token,
    };
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() },
      ],
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update user status
    await user.setOnlineStatus(true);

    // Generate JWT token
    const token = generateToken(user.toObject());

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      user: userResponse,
      token,
    };
  }

  static async logout(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (user) {
      await user.setOnlineStatus(false);
    }
  }

  static async getCurrentUser(userId: string): Promise<IUser> {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }

    return user.toObject();
  }

  static async updateProfile(
    userId: string,
    updateData: Partial<Pick<IUser, 'email' | 'avatar'>>
  ): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if email is being updated and if it's already taken
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      if (existingUser) {
        throw new Error('Email already exists');
      }
    }

    // Update user
    Object.assign(user, updateData);
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    return updatedUser;
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Update password
    user.password = newPassword;
    await user.save();
  }

  static async refreshToken(userId: string): Promise<string> {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }

    return generateToken(user.toObject());
  }
}