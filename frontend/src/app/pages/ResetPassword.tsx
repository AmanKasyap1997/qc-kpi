import { resetPassword } from "@/store/auth";
import { AlertTriangle, CheckCircle, Loader2, Lock } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  const validatePassword = (password: string): string => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/(?=.*\d)/.test(password)) {
      return "Password must contain at least one number";
    }
    return "";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("Invalid reset token. Please request a new password reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(token, password);

      if (result.success) {
        setMessage(result.message || "Password reset successfully!");

        setTimeout(() => {
          navigate("/");
        }, 3000);
      } else {
        setError(result.error || "Failed to reset password. Please try again.");
      }
    } catch (err: any) {
      console.error("Reset password error:", err);

      // Note: The original code had err.response logic but our AuthContext
      // returns a structured response, so we don't need try/catch for fetch errors
      // Our resetPassword function already handles API errors
      if (err?.response?.status === 400) {
        if (err?.response?.data?.error?.includes("expired")) {
          setError("Reset link has expired. Please request a new password reset link.");
        } else if (err?.response?.data?.error?.includes("Invalid")) {
          setError("Invalid reset link. Please request a new password reset link.");
        } else {
          setError(err?.response?.data?.error || "Invalid request");
        }
      } else if (err?.response?.status === 500) {
        setError("Server error. Please try again later.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear error when user starts typing
    if (error && error.includes("Password must")) {
      setError("");
    }
  };

  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    // Clear error when user starts typing
    if (error && error.includes("Passwords do not match")) {
      setError("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-full">
            <Lock className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your new password below
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10">
          {!token ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-sm text-red-600">
                {error || "Invalid password reset link."}
              </p>
              <Link
                to="/forgot-password"
                className="mt-6 inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
              >
                Request New Reset Link
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-4 border border-red-200">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className="mb-4 rounded-lg bg-green-50 p-4 border border-green-200">
                  <div className="flex">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Success!</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>{message}</p>
                        <p className="mt-1 text-xs opacity-75">
                          Redirecting to login page...
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={handlePasswordChange}
                      disabled={loading || !!message}
                      className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Enter new password"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      disabled={loading || !!message}
                      className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      At least 8 characters long
                    </li>
                    <li className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${/(?=.*[a-z])/.test(password) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      One lowercase letter
                    </li>
                    <li className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${/(?=.*[A-Z])/.test(password) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      One uppercase letter
                    </li>
                    <li className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${/(?=.*\d)/.test(password) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      One number
                    </li>
                  </ul>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading || !!message}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                        Resetting Password...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/"
                  className="font-medium text-blue-600 hover:text-blue-500 text-sm"
                >
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}