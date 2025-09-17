import { apiService } from './api';
import { API_ENDPOINTS } from '../utils/constants';
import {
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  User,
  ChangePasswordFormData,
} from '../types';

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiService.post<AuthResponse>(
      API_ENDPOINTS.LOGIN,
      credentials
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Login failed');
  }

  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await apiService.post<AuthResponse>(
      API_ENDPOINTS.REGISTER,
      credentials
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Registration failed');
  }

  static async logout(): Promise<void> {
    try {
      await apiService.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    }
  }

  static async getCurrentUser(): Promise<User> {
    const response = await apiService.get<User>(API_ENDPOINTS.ME);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get user info');
  }

  static async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiService.put<User>(
      API_ENDPOINTS.UPDATE_PROFILE,
      data
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to update profile');
  }

  static async changePassword(data: ChangePasswordFormData): Promise<void> {
    const response = await apiService.put(API_ENDPOINTS.CHANGE_PASSWORD, {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to change password');
    }
  }

  static async refreshToken(): Promise<string> {
    const response = await apiService.post<{ token: string }>(
      API_ENDPOINTS.REFRESH_TOKEN
    );
    
    if (response.success && response.data?.token) {
      return response.data.token;
    }
    
    throw new Error(response.message || 'Failed to refresh token');
  }

  static async verifyToken(): Promise<{ valid: boolean; user: User }> {
    const response = await apiService.get<{ valid: boolean; user: User }>(
      API_ENDPOINTS.REFRESH_TOKEN
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Token verification failed');
  }
}