import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { AuthService } from '../services/authService';
import { socketService } from '../services/socketService';
import { apiService } from '../services/api';
import { STORAGE_KEYS, SUCCESS_MESSAGES } from '../utils/constants';
import {
  AuthState,
  User,
  LoginCredentials,
  RegisterCredentials,
  ChangePasswordFormData,
} from '../types';

interface AuthStore extends AuthState {
  initializeAuth: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      initializeAuth: async () => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const userStr = localStorage.getItem(STORAGE_KEYS.USER);
        
        if (token && userStr) {
          try {
            set({ isLoading: true });
            
            // Set API token
            apiService.setAuthToken(token);
            
            // Verify token with server
            const currentUser = await AuthService.getCurrentUser();
            
            set({
              user: currentUser,
              token,
              isAuthenticated: true,
              isLoading: false,
            });

            // Connect socket
            try {
              await socketService.connect(token);
            } catch (socketError) {
              console.warn('Socket connection failed:', socketError);
              // Continue with auth even if socket fails
            }
            
          } catch (error) {
            console.error('Auth initialization failed:', error);
            get().clearAuth();
            set({ isLoading: false });
          }
        } else {
          set({ isLoading: false });
        }
      },

      login: async (credentials: LoginCredentials) => {
        try {
          set({ isLoading: true });
          
          const authResponse = await AuthService.login(credentials);
          
          // Store auth data
          localStorage.setItem(STORAGE_KEYS.TOKEN, authResponse.token);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(authResponse.user));
          
          // Set API token
          apiService.setAuthToken(authResponse.token);
          
          set({
            user: authResponse.user,
            token: authResponse.token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Connect socket
          try {
            await socketService.connect(authResponse.token);
          } catch (socketError) {
            console.warn('Socket connection failed:', socketError);
          }
          
          toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
          
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (credentials: RegisterCredentials) => {
        try {
          set({ isLoading: true });
          
          const authResponse = await AuthService.register(credentials);
          
          // Store auth data
          localStorage.setItem(STORAGE_KEYS.TOKEN, authResponse.token);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(authResponse.user));
          
          // Set API token
          apiService.setAuthToken(authResponse.token);
          
          set({
            user: authResponse.user,
            token: authResponse.token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Connect socket
          try {
            await socketService.connect(authResponse.token);
          } catch (socketError) {
            console.warn('Socket connection failed:', socketError);
          }
          
          toast.success(SUCCESS_MESSAGES.REGISTER_SUCCESS);
          
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        const { clearAuth } = get();
        
        // Call logout API (fire and forget)
        AuthService.logout().catch(console.warn);
        
        // Disconnect socket
        socketService.disconnect();
        
        // Clear auth state
        clearAuth();
        
        toast.success('Logged out successfully');
      },

      updateProfile: async (data: Partial<User>) => {
        try {
          set({ isLoading: true });
          
          const updatedUser = await AuthService.updateProfile(data);
          
          // Update stored user data
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
          
          set({
            user: updatedUser,
            isLoading: false,
          });
          
          toast.success(SUCCESS_MESSAGES.PROFILE_UPDATED);
          
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      changePassword: async (data: ChangePasswordFormData) => {
        try {
          set({ isLoading: true });
          
          await AuthService.changePassword(data);
          
          set({ isLoading: false });
          
          toast.success(SUCCESS_MESSAGES.PASSWORD_CHANGED);
          
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      clearAuth: () => {
        // Clear localStorage
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        
        // Remove API token
        apiService.removeAuthToken();
        
        // Clear state
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);