// import { login } from "@/store/auth";
import { AlertCircle, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-8 border border-gray-700">
        <div className="flex flex-col items-center gap-[10px] mb-[26px]">
          <div className="w-[46px] h-[46px] rounded-[11px] bg-[linear-gradient(135deg,#e8a020_0%,#f5bc50_60%,#fff3c0_100%)] flex items-center justify-center shrink-0 shadow-[0_6px_20px_rgba(232,160,32,0.32)]">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18 16H2L10 2Z" fill="#000" opacity="0.85"></path>
              <circle cx="10" cy="13" r="2.5" fill="#e8a020"></circle>
            </svg>
          </div>

          <div className="font-['Orbitron'] text-[22px] tracking-[0.04em] leading-none text-white font-bold">
            analytiq
          </div>

          <div className="text-[9px] text-[var(--gold)] tracking-[0.16em] uppercase font-semibold">
            City Financial
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all outline-none placeholder-gray-500"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all outline-none placeholder-gray-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="text-right mt-2">
            <a
              href="/forgot-password"
              className="text-sm text-yellow-400 hover:text-yellow-300 font-medium"
            >
              Forgot Password?
            </a>
          </div>
        </form>

      </div>
    </div>
  );
}