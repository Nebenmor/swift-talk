import axios from "axios";
import { getToken, removeToken, removeUser } from "./auth";
import toast from "react-hot-toast";

// FIXED: Make sure this points to your backend port (5000)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

console.log('API Base URL:', API_BASE_URL); // Debug log to verify

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug log to verify the full URL - with null checks
    const fullUrl = (config.baseURL || '') + (config.url || '');
    console.log('Making request to:', fullUrl);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Improved error typing
    const axiosError = error as {
      message?: string;
      response?: {
        status?: number;
        data?: unknown;
      };
      config?: {
        url?: string;
      };
    };

    console.error('API Error:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      url: axiosError.config?.url
    });

    if (axiosError.response?.status === 401) {
      removeToken();
      removeUser();
      window.location.href = "/login";
      toast.error("Session expired. Please login again.");
    }
    
    return Promise.reject(error);
  }
);

export default api;