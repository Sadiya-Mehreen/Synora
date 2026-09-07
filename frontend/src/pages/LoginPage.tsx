import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";

import { api, ApiError } from "../lib/api";

type LoginUser = {
  id: number;
  name: string;
  email: string;
};

type LoginPageProps = {
  onLoginSuccess: (user: LoginUser, token: string) => void;
  onNavigateSignup: () => void;
  initialEmail?: string;
  initialMessage?: string;
};

export default function LoginPage({
  onLoginSuccess,
  onNavigateSignup,
  initialEmail = "",
  initialMessage = "",
}: LoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const data = await api.login({ email, password });
      onLoginSuccess(data.user, data.token);
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof ApiError
          ? error.message
          : "Could not connect to Synora. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="signup-page">
      <div className="signup-glow signup-glow-one" />
      <div className="signup-glow signup-glow-two" />

      <div className="signup-container">
        <div className="signup-brand">
          <img
            src="/synora-logo.png"
            alt="Synora"
            className="signup-logo"
          />
        </div>

        <div className="signup-card">
          <div className="signup-eyebrow">
            <Sparkles size={14} />
            <span>Welcome back</span>
          </div>

          <h1>
            Welcome
            <br />
            <span>back.</span>
          </h1>

          <p>
            Your memory map is waiting.
            Continue where you left off.
          </p>

          <form
            className="signup-form"
            onSubmit={handleLogin}
          >
            <label>
              Email

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />
            </label>

            <label>
              Password

              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="signup-submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Logging in..."
                  : "Log in to Synora"}
              </span>

              {!loading && (
                <ArrowRight size={18} />
              )}
            </button>
          </form>

          {message && (
            <p className="signup-message">
              {message}
            </p>
          )}

          <p className="login-text">
            Don't have an account?

            <button type="button" onClick={onNavigateSignup}>
              Sign up
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}