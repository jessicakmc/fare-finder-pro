import { useNavigate, useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { AuthedOutletContext } from "@/components/require-auth";

export default function Dashboard() {
  useDocumentTitle("Dashboard · Flight Price Notifier");

  const { user } = useOutletContext<AuthedOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  return (
    <div className="hero-glow min-h-screen bg-background font-sans text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <span className="text-sm font-semibold tracking-tight">
          <span aria-hidden="true" className="mr-2">
            ✈️
          </span>
          Flight Price Notifier
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary/60 hover:text-primary"
        >
          Sign out / 登出
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as {user.email}</p>

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold">尚未有航線通知</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Route watching and target-price alerts are coming in the next milestone.
          </p>
        </div>
      </main>
    </div>
  );
}
