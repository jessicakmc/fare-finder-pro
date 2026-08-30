import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function Auth() {
  useDocumentTitle("Sign in · Flight Price Notifier");

  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/app", { replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        navigate("/app", { replace: true });
        return;
      }
      setMessage("Check your email to confirm your account．請至信箱確認註冊。");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate("/app", { replace: true });
  }

  return (
    <div className="hero-glow flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Link to="/" className="text-sm font-semibold tracking-tight text-muted-foreground">
          ← Flight Price Notifier
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-20">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Welcome back．登入" : "Create account．註冊"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your fare alerts.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-primary">{message}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_var(--color-violet-glow)] transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "…" : mode === "signin" ? "Sign in / 登入" : "Create account / 註冊"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 transition hover:text-primary hover:underline"
          >
            {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </main>
    </div>
  );
}
