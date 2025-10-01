import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { getToken, removeToken, removeUser } from "./auth";
import toast from "react-hot-toast";

// FIXED: Make sure this points to your backend port (5000)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const fullUrl = (config.baseURL ?? '') + (config.url ?? '');
    console.log('Making request to:', fullUrl);
    
    return config;
  },
  (error: Error) => {
    return Promise.reject(error);
  }
);

// Handle response errors with proper typing
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });

    if (error.response?.status === 401) {
      removeToken();
      removeUser();
      window.location.href = "/login";
      toast.error("Session expired. Please login again.");
    }
    
    return Promise.reject(error);
  }
);

// ==================== RETRY LOGIC ====================

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void;
}

/**
 * Check if error is likely due to backend sleeping (Render cold start)
 */
function isBackendSleepError(error: AxiosError): boolean {
  // Network errors, timeouts, or 503 Service Unavailable
  return (
    !error.response ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    error.code === 'ETIMEDOUT' ||
    error.response?.status === 503 ||
    error.response?.status === 502 ||
    error.response?.status === 504
  );
}

/**
 * Enhanced request with retry logic for handling sleeping backend
 */
async function requestWithRetry<T>(
  requestFn: () => Promise<AxiosResponse<T>>,
  config: RetryConfig = {}
): Promise<AxiosResponse<T>> {
  const {
    maxRetries = 5,
    retryDelay = 2000,
    onRetry,
  } = config;

  let lastError: AxiosError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      const axiosError = error as AxiosError;
      lastError = axiosError;

      // Don't retry on authentication errors or client errors (4xx except 408)
      if (
        axiosError.response?.status === 401 ||
        axiosError.response?.status === 400 ||
        axiosError.response?.status === 404 ||
        axiosError.response?.status === 422 ||
        axiosError.response?.status === 403
      ) {
        console.log('Not retrying - client error:', axiosError.response?.status);
        throw error;
      }

      // Check if this looks like a backend sleep error
      if (isBackendSleepError(axiosError) && attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        const delay = retryDelay * Math.pow(2, attempt);
        
        console.log(`Backend appears to be sleeping. Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, delay);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // If not a sleep error or we've exhausted retries, throw
      console.log('Not retrying - exhausted retries or non-sleep error');
      throw error;
    }
  }

  throw lastError;
}

// ==================== ENHANCED API METHODS ====================

/**
 * POST request with automatic retry logic
 */
function postWithRetry<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig & RetryConfig
): Promise<AxiosResponse<T>> {
  const { maxRetries, retryDelay, onRetry, ...axiosConfig } = config ?? {};
  
  return requestWithRetry(
    () => api.post<T>(url, data, axiosConfig),
    { maxRetries, retryDelay, onRetry }
  );
}

/**
 * GET request with automatic retry logic
 */
function getWithRetry<T = unknown>(
  url: string,
  config?: AxiosRequestConfig & RetryConfig
): Promise<AxiosResponse<T>> {
  const { maxRetries, retryDelay, onRetry, ...axiosConfig } = config ?? {};
  
  return requestWithRetry(
    () => api.get<T>(url, axiosConfig),
    { maxRetries, retryDelay, onRetry }
  );
}

/**
 * PUT request with automatic retry logic
 */
function putWithRetry<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig & RetryConfig
): Promise<AxiosResponse<T>> {
  const { maxRetries, retryDelay, onRetry, ...axiosConfig } = config ?? {};
  
  return requestWithRetry(
    () => api.put<T>(url, data, axiosConfig),
    { maxRetries, retryDelay, onRetry }
  );
}

/**
 * DELETE request with automatic retry logic
 */
function deleteWithRetry<T = unknown>(
  url: string,
  config?: AxiosRequestConfig & RetryConfig
): Promise<AxiosResponse<T>> {
  const { maxRetries, retryDelay, onRetry, ...axiosConfig } = config ?? {};
  
  return requestWithRetry(
    () => api.delete<T>(url, axiosConfig),
    { maxRetries, retryDelay, onRetry }
  );
}

// Attach retry methods to api instance
interface ApiWithRetry {
  postWithRetry: typeof postWithRetry;
  getWithRetry: typeof getWithRetry;
  putWithRetry: typeof putWithRetry;
  deleteWithRetry: typeof deleteWithRetry;
}

(api as typeof api & ApiWithRetry).postWithRetry = postWithRetry;
(api as typeof api & ApiWithRetry).getWithRetry = getWithRetry;
(api as typeof api & ApiWithRetry).putWithRetry = putWithRetry;
(api as typeof api & ApiWithRetry).deleteWithRetry = deleteWithRetry;

// TypeScript declaration merging for better type support
declare module 'axios' {
  export interface AxiosInstance {
    postWithRetry<T = unknown>(
      url: string,
      data?: unknown,
      config?: AxiosRequestConfig & RetryConfig
    ): Promise<AxiosResponse<T>>;
    
    getWithRetry<T = unknown>(
      url: string,
      config?: AxiosRequestConfig & RetryConfig
    ): Promise<AxiosResponse<T>>;
    
    putWithRetry<T = unknown>(
      url: string,
      data?: unknown,
      config?: AxiosRequestConfig & RetryConfig
    ): Promise<AxiosResponse<T>>;
    
    deleteWithRetry<T = unknown>(
      url: string,
      config?: AxiosRequestConfig & RetryConfig
    ): Promise<AxiosResponse<T>>;
  }
}

export default api;