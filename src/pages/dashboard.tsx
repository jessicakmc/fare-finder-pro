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

// M2 — ECPay 定期定額 lifecycle: pending_payment → active ⇄ cancelled (grace) → expired.
// A row with no subscription_status at all is a pre-M2 (M1) row — treat it like
// pending_payment: it needs to go through checkout before it counts as paid.
type SubscriptionStatus = "pending_payment" | "active" | "cancelled" | "expired";
type ResolvedStatus = SubscriptionStatus | "legacy";

type SubscriptionRow = {
  route: string;
  plan_name: PlanName;
  target_price: number;
  currency: string;
  subscription_status?: SubscriptionStatus;
  current_period_end_date?: string;
};

const PLANS: { name: PlanName; label: string; hint: string }[] = [
  { name: "tokyo", label: "台北 ✈ 東京", hint: "目前約 NT$9,325" },
  { name: "seoul", label: "台北 ✈ 首爾", hint: "目前約 NT$5,989" },
  { name: "london", label: "台北 ✈ 倫敦", hint: "目前無即時報價，仍可設定目標價" },
];

function resolveStatus(sub: SubscriptionRow | null): ResolvedStatus | null {
  if (!sub) return null;
  return sub.subscription_status ?? "legacy";
}

function statusMeta(status: ResolvedStatus) {
  switch (status) {
    case "active":
      return { badge: "已訂閱（有效）", badgeClass: "bg-primary/10 text-primary" };
    case "pending_payment":
      return { badge: "未完成付款", badgeClass: "bg-amber-500/10 text-amber-700" };
    case "legacy":
      return { badge: "未完成付款", badgeClass: "bg-amber-500/10 text-amber-700" };
    case "cancelled":
      return { badge: "已取消", badgeClass: "bg-muted text-muted-foreground" };
    case "expired":
      return { badge: "已結束", badgeClass: "bg-destructive/10 text-destructive" };
  }
}

function primaryButtonLabel(status: ResolvedStatus | null, saving: boolean) {
  if (saving) return "處理中…";
  switch (status) {
    case "active":
    case "cancelled":
      return "更新目標價";
    case "pending_payment":
    case "legacy":
      return "完成付款";
    case "expired":
      return "重新訂閱";
    default:
      return "開始追蹤";
  }
}

export default function Dashboard() {
  useDocumentTitle("Dashboard · Flight Price Notifier");

  const { user } = useOutletContext<AuthedOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [targets, setTargets] = useState<Record<PlanName, string>>({
    tokyo: "",
    seoul: "",
    london: "",
  });
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
      const byPlan: Record<PlanName, SubscriptionRow | null> = {
        tokyo: null,
        seoul: null,
        london: null,
      };
      for (const item of data.items) {
        if (
          item.plan_name === "tokyo" ||
          item.plan_name === "seoul" ||
          item.plan_name === "london"
        ) {
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

  // M2 contract: /subscribe returns EITHER
  //   - text/html  → an ECPay AIO auto-submit checkout form (new payment needed:
  //                  no row yet, or the row is pending_payment/expired/legacy).
  //                  Hand the whole document to the browser so its inline
  //                  <script>…submit()</script> auto-POSTs to ECPay's cashier.
  //   - application/json → an in-place update (row is already active/cancelled;
  //                  no re-payment). Just refresh the card.
  // Blindly calling res.json() here (the old M1 behaviour) throws on the HTML
  // response and silently breaks the subscribe button — this is that fix.
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

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        // New checkout (or resuming a pending_payment/expired/legacy row) —
        // hand the browser to ECPay's cashier. The page navigates away, so
        // there's nothing left to update in React state.
        const html = await res.text();
        document.open();
        document.write(html);
        document.close();
        return;
      }

      // application/json — in-place target-price update, no re-payment.
      setStatus((s) => ({ ...s, [plan]: "saved" }));
      setTargets((t) => ({ ...t, [plan]: "" }));
      await loadSubscriptions();
    } catch {
      setStatus((s) => ({ ...s, [plan]: "error" }));
    }
  }

  // M2 Step 6 — cancel calls ECPay's CreditCardPeriodAction (server-side) and
  // grants a grace period: the row goes to "cancelled", not "expired", and
  // keeps alerting through current_period_end.
  async function handleCancel(plan: PlanName, route: string) {
    setStatus((s) => ({ ...s, [plan]: "saving" }));
    try {
      const res = await fetch(`${FLIGHT_API_URL}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, route }),
      });
      if (!res.ok) throw new Error(`cancel failed: ${res.status}`);
      setStatus((s) => ({ ...s, [plan]: "idle" }));
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
            const resolved = loadingSubs ? null : resolveStatus(sub);
            const meta = resolved ? statusMeta(resolved) : null;
            const showCancel = resolved === "active";

            return (
              <div key={plan.name} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">{plan.label}</p>
                  {meta && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${meta.badgeClass}`}
                    >
                      {meta.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.hint}</p>

                {resolved === "cancelled" && sub?.current_period_end_date && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    有效至{" "}
                    <span className="font-medium text-foreground">
                      {sub.current_period_end_date}
                    </span>
                    （仍會通知到該日）
                  </p>
                )}
                {(resolved === "pending_payment" || resolved === "legacy") && (
                  <p className="mt-3 text-sm text-amber-700">
                    尚未完成付款，完成付款後才會開始收到通知。
                  </p>
                )}
                {resolved === "expired" && (
                  <p className="mt-3 text-sm text-destructive">
                    訂閱已結束，重新訂閱即可恢復通知。
                  </p>
                )}

                {sub && (resolved === "active" || resolved === "cancelled") && (
                  <p className="mt-3 text-sm text-foreground">
                    目前目標價：
                    <span className="font-semibold">NT${sub.target_price.toLocaleString()}</span>
                  </p>
                )}

                <label className="mt-4 block text-sm font-medium" htmlFor={`target-${plan.name}`}>
                  {sub ? "更新目標價（TWD）" : "目標價（TWD）"}
                </label>
                <input
                  id={`target-${plan.name}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder={sub ? String(sub.target_price) : "例如 10000"}
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
                  {primaryButtonLabel(resolved, status[plan.name] === "saving")}
                </button>

                {showCancel && sub && (
                  <button
                    type="button"
                    onClick={() => handleCancel(plan.name, sub.route)}
                    disabled={status[plan.name] === "saving"}
                    className="mt-2 w-full rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-destructive/60 hover:text-destructive disabled:opacity-60"
                  >
                    取消訂閱
                  </button>
                )}

                {status[plan.name] === "saved" && (
                  <p className="mt-3 text-sm text-primary">已更新這條航線的追蹤設定！</p>
                )}
                {status[plan.name] === "error" && (
                  <p className="mt-3 text-sm text-destructive">
                    請輸入有效的目標價格，或稍後再試一次。
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
