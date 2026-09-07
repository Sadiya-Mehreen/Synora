import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";

import { api, ApiError } from "../lib/api";

type SignupPageProps = {
  onSignupSuccess: (email: string) => void;
  onNavigateLogin: () => void;
};

export default function SignupPage({
  onSignupSuccess,
  onNavigateLogin,
}: SignupPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [callConsent, setCallConsent] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      await api.signup({
        name,
        email,
        phoneNumber: phoneNumber || undefined,
        password,
        callConsent,
      });

      // The account is created (and the backend did return a session
      // token), but we deliberately send the learner to Login rather
      // than auto-authenticating them into the dashboard -- a clear,
      // predictable "create account, then log in" flow.
      onSignupSuccess(email);
    } catch (error) {
      console.error("Signup error:", error);

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
            <span>Start remembering</span>
          </div>

          <h1>
            Build a better
            <br />
            <span>memory.</span>
          </h1>

          <p>
            Create your Synora account and start turning
            forgotten knowledge into lasting memory.
          </p>

          <form className="signup-form" onSubmit={handleSignup}>
            <label>
              Name
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Phone number
              <input
                type="tel"
                placeholder="+919876543210"
                value={phoneNumber}
                onChange={(event) =>
                  setPhoneNumber(event.target.value)
                }
              />
            </label>

            <label>
              Password

              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  minLength={6}
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

            <label className="consent-row">
              <input
                type="checkbox"
                checked={callConsent}
                onChange={(event) =>
                  setCallConsent(event.target.checked)
                }
              />

              <span>
                I agree to receive AI-powered recall calls
                from Synora.
              </span>
            </label>

            <button
              type="submit"
              className="signup-submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Creating account..."
                  : "Create my account"}
              </span>

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {message && (
            <p className="signup-message">
              {message}
            </p>
          )}

          <p className="login-text">
            Already have an account?
            <button type="button" onClick={onNavigateLogin}>Log in</button>
          </p>
        </div>
      </div>
    </main>
  );
}

