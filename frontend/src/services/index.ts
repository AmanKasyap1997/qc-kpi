// API Configuration
export { apiClient } from './api/client';
export { API_ENDPOINTS } from './api/endpoints';
export { setupInterceptors } from './api/interceptors';

// Domain Services
export { AuthService } from './auth';

// Default exports for convenience
export { default as authService } from './auth';

// Re-export types
export type { 
  User, 
  LoginCredentials, 
  LoginResponse,
  ApiResponse 
} from './auth/types';