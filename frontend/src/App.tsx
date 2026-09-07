import { useEffect, useState } from "react";
import "./App.css";

import LandingPage from "./pages/LandingPage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import { api } from "./lib/api";

const SESSION_KEY = "synora_session";

type Session = {
  token: string;
  userId: number;
  userName: string;
};

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.userId && parsed.userName) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function App() {
  // Restoring the session synchronously on first render (rather than
  // in an effect) is what makes a browser refresh land the learner
  // back on their dashboard instead of the landing page.
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const [page, setPage] = useState<
    "landing" | "signup" | "login" | "dashboard"
  >(() => (loadSession() ? "dashboard" : "landing"));

  // Carries the just-created email (and a success message) from
  // Signup over to Login, so the learner doesn't have to retype it.
  const [pendingLoginEmail, setPendingLoginEmail] = useState("");
  const [pendingLoginMessage, setPendingLoginMessage] = useState("");

  // If the stored token has expired or was revoked, the dashboard's
  // first request will 401 -- fall back to the landing page rather
  // than getting stuck on a broken dashboard.
  useEffect(() => {
    if (!session) return;

    api.getMe(session.token).catch(() => {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setPage("landing");
    });
    // Only needs to run once per restored session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAuthenticated(
    user: { id: number; name: string; email: string },
    token: string
  ) {
    const next: Session = {
      token,
      userId: user.id,
      userName: user.name,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
    setPage("dashboard");
  }

  function handleSignupComplete(email: string) {
    setPendingLoginEmail(email);
    setPendingLoginMessage("Account created! Log in to continue. 🎉");
    setPage("login");
  }

  function handleLogout() {
    if (session) {
      api.logout(session.token).catch(() => {
        // Best-effort -- clearing local state matters more than the
        // server-side revocation succeeding.
      });
    }

    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setPage("landing");
  }

  function goToLogin() {
    setPendingLoginEmail("");
    setPendingLoginMessage("");
    setPage("login");
  }

  if (page === "signup") {
    return (
      <SignupPage
        onSignupSuccess={handleSignupComplete}
        onNavigateLogin={goToLogin}
      />
    );
  }

  if (page === "login") {
    return (
      <LoginPage
        onLoginSuccess={handleAuthenticated}
        onNavigateSignup={() => setPage("signup")}
        initialEmail={pendingLoginEmail}
        initialMessage={pendingLoginMessage}
      />
    );
  }

  if (page === "dashboard" && session) {
    return (
      <DashboardPage
        token={session.token}
        userId={session.userId}
        userName={session.userName}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <LandingPage
      onSignup={() => setPage("signup")}
      onLogin={goToLogin}
    />
  );
}

export default App;
