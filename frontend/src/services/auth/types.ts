export interface User {
  id: string | number;
  email: string;
  name: string;
  firstname?: string;
  lastname?: string;
  roles?: Array<{
    id: string | number;
    name: string;
  }>;
  tenant?: {
    id: string | number;
    name: string;
  };
  role: {
    id: number;
    name: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
