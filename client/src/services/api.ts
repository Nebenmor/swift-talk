import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL, STORAGE_KEYS, ERROR_MESSAGES } from '../utils/constants';
import { ApiResponse, NetworkError } from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - Add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError) => {
        return this.handleError(error);
      }
    );
  }

  private handleError(error: AxiosError): Promise<never> {
    const networkError: NetworkError = new Error();
    
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      networkError.status = status;
      networkError.response = { data };

      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          this.clearAuthData();
          networkError.message = ERROR_MESSAGES.UNAUTHORIZED;
          // Redirect to login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
        case 403:
          networkError.message = 'Access forbidden';
          break;
        case 404:
          networkError.message = 'Resource not found';
          break;
        case 422:
          networkError.message = (data as any)?.message || ERROR_MESSAGES.VALIDATION_ERROR;
          break;
        case 429:
          networkError.message = 'Too many requests. Please try again later.';
          break;
        case 500:
          networkError.message = ERROR_MESSAGES.SERVER_ERROR;
          break;
        default:
          networkError.message = (data as any)?.message || `Error ${status}`;
      }
    } else if (error.request) {
      // Network error
      networkError.message = ERROR_MESSAGES.NETWORK_ERROR;
    } else {
      // Other error
      networkError.message = error.message || 'Something went wrong';
    }

    // Show toast for non-401 errors (401 handled by auth redirect)
    if (error.response?.status !== 401) {
      toast.error(networkError.message);
    }

    return Promise.reject(networkError);
  }

  private clearAuthData(): void {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  // GET request
  public async get<T = any>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.api.get(url, { params });
    return response.data;
  }

  // POST request
  public async post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.post(url, data);
    return response.data;
  }

  // PUT request
  public async put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.put(url, data);
    return response.data;
  }

  // PATCH request
  public async patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.api.patch(url, data);
    return response.data;
  }

  // DELETE request
  public async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    const response = await this.api.delete(url);
    return response.data;
  }

  // File upload
  public async uploadFile<T = any>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    const response = await this.api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  }

  // Update authorization header
  public setAuthToken(token: string): void {
    this.api.defaults.headers.Authorization = `Bearer ${token}`;
  }

  // Remove authorization header
  public removeAuthToken(): void {
    delete this.api.defaults.headers.Authorization;
  }

  // Get current base URL
  public getBaseURL(): string {
    return this.api.defaults.baseURL || '';
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      await this.api.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;