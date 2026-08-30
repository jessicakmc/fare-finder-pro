import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { AuthedOutletContext } from "@/components/require-auth";

// M1 — flight-api (API Gateway → Lambda). Not secret: the browser holds no
// AWS credentials, this endpoint is the public front door (POST /subscribe,
// GET /subscriptions). Security note: GET /subscriptions?email= trusts a
// client-supplied email with no auth — fine for this no-guard course.
const FLIGHT_API_URL = "https://j8a03awu97.execute-api.us-east-1.amazonaws.com";

type PlanName = "tokyo" | "seoul" | "london";

type SubscriptionRow = {
  route: string;
  plan_name: PlanName;
  target_price: number;
  currency: string;
};

const PLANS: { name: PlanName; label: string; hint: string }[] = [
  { name: "tokyo", label: "台北 ✈ 東京", hint: "目前約 NT$9,325" },
  { name: "seoul", label: "台北 ✈ 首爾", hint: "目前約 NT$5,989" },
  { name: "london", label: "台北 ✈ 倫敦", hint: "目前無即時報價，仍可設定目標價" },
];

export default function Dashboard() {
  useDocumentTitle("Dashboard · Flight Price Notifier");

  const { user } = useOutletContext<AuthedOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [targets, setTargets] = useState<Record<PlanName, string>>({ tokyo: "", seoul: "", london: "" });
  const [status, setStatus] = useState<Record<PlanName, "idle" | "saving" | "saved" | "error">>({
    tokyo: "idle",
    seoul: "idle",
    london: "idle",
  });
  const [subscriptions, setSubscriptions] = useState<Record<PlanName, SubscriptionRow | null>>({
    tokyo: null,
    seoul: null,
    london: null,
  });
  const [loadingSubs, setLoadingSubs] = useState(true);

  async function loadSubscriptions() {
    if (!user.email) return;
    setLoadingSubs(true);
    try {
      const res = await fetch(
        `${FLIGHT_API_URL}/subscriptions?email=${encodeURIComponent(user.email)}`,
      );
      if (!res.ok) throw new Error(`list failed: ${res.status}`);
      const data = (await res.json()) as { items: SubscriptionRow[] };
      const byPlan: Record<PlanName, SubscriptionRow | null> = { tokyo: null, seoul: null, london: null };
      for (const item of data.items) {
        if (item.plan_name === "tokyo" || item.plan_name === "seoul" || item.plan_name === "london") {
          byPlan[item.plan_name] = item;
        }
      }
      setSubscriptions(byPlan);
    } catch {
      // Non-fatal — the subscribe cards still work without the badge.
    } finally {
      setLoadingSubs(false);
    }
  }

  useEffect(() => {
    void loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  async function handleSubscribe(plan: PlanName) {
    const targetPrice = Number(targets[plan]);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setStatus((s) => ({ ...s, [plan]: "error" }));
      return;
    }
    setStatus((s) => ({ ...s, [plan]: "saving" }));
    try {
      const res = await fetch(`${FLIGHT_API_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, plan_name: plan, target_price: targetPrice }),
      });
      if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);
      setStatus((s) => ({ ...s, [plan]: "saved" }));
      setTargets((t) => ({ ...t, [plan]: "" }));
      await loadSubscriptions();
    } catch {
      setStatus((s) => ({ ...s, [plan]: "error" }));
    }
  }

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

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const sub = subscriptions[plan.name];
            const isSubscribed = !loadingSubs && sub !== null;
            return (
              <div key={plan.name} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">{plan.label}</p>
                  {isSubscribed && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      已訂閱
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.hint}</p>

                {isSubscribed && sub && (
                  <p className="mt-3 text-sm text-foreground">
                    目前目標價：<span className="font-semibold">NT${sub.target_price.toLocaleString()}</span>
                  </p>
                )}

                <label className="mt-4 block text-sm font-medium" htmlFor={`target-${plan.name}`}>
                  {isSubscribed ? "更新目標價（TWD）" : "目標價（TWD）"}
                </label>
                <input
                  id={`target-${plan.name}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="例如 10000"
                  value={targets[plan.name]}
                  onChange={(e) => setTargets((t) => ({ ...t, [plan.name]: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.name)}
                  disabled={status[plan.name] === "saving"}
                  className="mt-4 w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {status[plan.name] === "saving"
                    ? "追蹤中…"
                    : isSubscribed
                      ? "更新目標價"
                      : "開始追蹤"}
                </button>

                {status[plan.name] === "saved" && (
                  <p className="mt-3 text-sm text-primary">已更新這條航線的追蹤設定！</p>
                )}
                {status[plan.name] === "error" && (
                  <p className="mt-3 text-sm text-destructive">請輸入有效的目標價格，或稍後再試一次。</p>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
