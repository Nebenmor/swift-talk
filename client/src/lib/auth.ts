// src/lib/auth.ts
import type { User } from '../types';

export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('token');
};

export const getUser = (): User | null => {
  const user = localStorage.getItem('user');
  if (!user || user === 'undefined' || user === 'null') {
    return null;
  }
  
  try {
    return JSON.parse(user) as User;
  } catch (error) {
    console.error('Error parsing user data:', error);
    // Clear corrupted data
    removeUser();
    return null;
  }
};

export const setUser = (user: User): void => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const removeUser = (): void => {
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  const user = getUser();
  return !!(token && user);
};