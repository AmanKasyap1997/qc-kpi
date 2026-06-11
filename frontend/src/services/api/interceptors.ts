import { apiClient } from './client';

// Setup request interceptor
export const setupRequestInterceptor = (): void => {
  apiClient.interceptors.request.use(
    (config) => {
      // Add token to every request if it exists
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log request in development
      if (import.meta.env.DEV) {
        console.log(`🌐 ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
      }

      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );
};

// Setup response interceptor
export const setupResponseInterceptor = (): void => {
  apiClient.interceptors.response.use(
    (response) => {
      // Log response in development
      if (import.meta.env.DEV) {
        console.log(`✅ ${response.status} ${response.config.url}`, response.data);
      }

      return response;
    },
    (error) => {
      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('unauthorized'));
      }

      // Log error in development
      if (import.meta.env.DEV) {
        console.error(`❌ ${error.response?.status} ${error.config?.url}`, error.response?.data);
      }

      return Promise.reject(error);
    }
  );
};

// Setup all interceptors
export const setupInterceptors = (): void => {
  setupRequestInterceptor();
  setupResponseInterceptor();
};