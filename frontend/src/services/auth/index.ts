import { apiClient } from "../api/client";
import { API_ENDPOINTS } from "../api/endpoints";
import {
  ApiResponse,
  LoginCredentials,
  LoginResponse,
  ResetPasswordRequest,
  User,
} from "./types";

export const AuthService = {
  // Login user
  login: async (
    credentials: LoginCredentials
  ): Promise<ApiResponse<LoginResponse>> => {
    try {
      const response = await apiClient.post<LoginResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Login failed",
      };
    }
  },

  // Get current user
  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    try {
      const response = await apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
      localStorage.setItem("userData", JSON.stringify(response.data));
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to fetch user",
      };
    }
  },

  // Logout user
  logout: async (): Promise<ApiResponse> => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
      return {
        success: true,
      };
    } catch (error: any) {
      // Still return success for logout even if API fails
      return {
        success: true,
        error: error.response?.data?.error,
      };
    }
  },

  // Request password reset
  requestPasswordReset: async (email: string): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
        { email }
      );

      return {
        success: true,
        message: response.data?.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to send reset link",
      };
    }
  },

  // Reset password with token
  resetPassword: async (data: ResetPasswordRequest): Promise<ApiResponse> => {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        data
      );

      return {
        success: true,
        message: response.data?.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Password reset failed",
      };
    }
  },

  currentUserData: async () =>
    await JSON.parse(localStorage.getItem("userData") || ""),
};

export default AuthService;
