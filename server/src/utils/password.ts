import bcrypt from 'bcryptjs';

export const hashPassword = async (password: string): Promise<string> => {
  try {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

export const comparePasswords = async (
  candidatePassword: string,
  hashedPassword: string
): Promise<boolean> => {
  try {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check maximum length
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long');
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for at least one digit
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Optional: Check for special characters
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push('Password must contain at least one special character');
  // }

  return {
    isValid: errors.length === 0,
    errors,
  };
};