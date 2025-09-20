import axios from "axios";
import { getToken, removeToken, removeUser } from "./auth";
import toast from "react-hot-toast";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      removeToken();
      removeUser();
      window.location.href = "/login";
      toast.error("Session expired. Please login again.");
    }
    // Ensure we always reject with an Error instance
    const errorInstance =
      error instanceof Error ? error : new Error(String(error));
    return Promise.reject(errorInstance);
  }
);

export default api;
