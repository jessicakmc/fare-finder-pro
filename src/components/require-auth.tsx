import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type AuthedOutletContext = { user: User };

/**
 * Client-side auth gate for protected routes, replacing the `beforeLoad` redirect
 * that used to run in TanStack Router's `_authenticated` layout route.
 * Renders nothing while the session check is in flight, then either redirects
 * anonymous visitors to /auth or renders the protected route with the user
 * available via `useOutletContext<AuthedOutletContext>()`.
 */
export function RequireAuth() {
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        setStatus("anon");
        return;
      }
      setUser(data.user);
      setStatus("authed");
    });
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") return null;
  if (status === "anon" || !user) return <Navigate to="/auth" replace />;

  return <Outlet context={{ user } satisfies AuthedOutletContext} />;
}
