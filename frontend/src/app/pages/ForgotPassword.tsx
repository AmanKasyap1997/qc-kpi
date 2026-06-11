import { requestResetPassword } from "@/store/auth";
import { ChangeEvent, FormEvent, useState } from "react";

function ForgotPassword() {
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await requestResetPassword(email);
      if (res.success) {
        setMessage(res.message || "Password reset link sent to your email"); // Show backend message
      } else {
        setMessage(res.error || "Failed to send reset link");
      }
    } catch (error) {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          Forgot Password
        </h2>
        <p className="text-gray-600 text-center mb-6">
          Enter your email to receive a password reset link
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              required
              onChange={handleEmailChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-yellow-500 focus:border-transparent 
                         transition-all outline-none"
              placeholder="Enter your email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 
                       text-white font-semibold rounded-lg transition-colors 
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-lg text-center ${message.includes("sent") || message.includes("success")
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
            }`}>
            <p className="font-medium">{message}</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <a
            href="/"
            className="text-yellow-600 hover:text-yellow-700 font-medium text-sm"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;