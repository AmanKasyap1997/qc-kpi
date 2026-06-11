import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { AuthService } from "../services";
import type { LoginCredentials, User } from "../services/auth/types";

// Define the shape of the auth context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  requestResetPassword: (email: string) => Promise<ResetPasswordResponse>;
  resetPassword: (token: string, newPassword: string) => Promise<ResetPasswordResponse>;
}

// Response types for better type safety
interface LoginResponse {
  success: boolean;
  error?: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Create context with proper typing
const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (): Promise<void> => {
    try {
      const result = await AuthService.getCurrentUser();

      if (result.success && result.data) {
        setUser(result.data);
      } else {
        localStorage.removeItem("token");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const credentials: LoginCredentials = { email, password };
      const result = await AuthService.login(credentials);

      if (result.success && result.data) {
        localStorage.setItem("token", result.data.token);
        setUser(result.data.user);
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || "Login failed"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed"
      };
    }
  };

  const requestResetPassword = async (email: string): Promise<ResetPasswordResponse> => {
    try {
      const result = await AuthService.requestPasswordReset(email);

      if (result.success) {
        return {
          success: true,
          message: result.message || "Reset link sent successfully"
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to send reset link"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to request password reset"
      };
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
    try {
      const result = await AuthService.resetPassword({ token, newPassword });

      if (result.success) {
        return {
          success: true,
          message: result.message || "Password reset successfully"
        };
      } else {
        return {
          success: false,
          error: result.error || "Password reset failed"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Password reset failed"
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    requestResetPassword,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

// Need to remove authContext
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const credentials: LoginCredentials = { email, password };
    const result = await AuthService.login(credentials);

    if (result.success && result.data) {
      localStorage.setItem("token", result.data.token);
      return { success: true };
    } else {
      return {
        success: false,
        error: result.error || "Login failed"
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Login failed"
    };
  }
};

export const requestResetPassword = async (email: string): Promise<ResetPasswordResponse> => {
  try {
    const result = await AuthService.requestPasswordReset(email);

    if (result.success) {
      return {
        success: true,
        message: result.message || "Reset link sent successfully"
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to send reset link"
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to request password reset"
    };
  }
};

export const resetPassword = async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
  try {
    const result = await AuthService.resetPassword({ token, newPassword });

    if (result.success) {
      return {
        success: true,
        message: result.message || "Password reset successfully"
      };
    } else {
      return {
        success: false,
        error: result.error || "Password reset failed"
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Password reset failed"
    };
  }
};
