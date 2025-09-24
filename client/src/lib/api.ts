import axios, { AxiosError } from "axios";
import { getToken, removeToken, removeUser } from "./auth";
import toast from "react-hot-toast";

// FIXED: Make sure this points to your backend port (5000)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

console.log('API Base URL:', API_BASE_URL);

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
    
    const fullUrl = (config.baseURL || '') + (config.url || '');
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

export default api;