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

// Fixed monthly price from the flight/ecpay secret's "amount" field — the
// checkout amount ECPay actually charges. Shown on the pay button so the
// user isn't guessing what "完成付款" commits them to.
const MONTHLY_PRICE_TWD = 300;

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
  { name: "tokyo", label: "台北 ✈ 東京", hint: "目前最低約 NT$9,325（參考）" },
  { name: "seoul", label: "台北 ✈ 首爾", hint: "目前最低約 NT$5,989（參考）" },
  { name: "london", label: "台北 ✈ 倫敦", hint: "目前無即時報價，仍可設定目標價" },
];

// Small status icons, drawn inline (no icon package) so they inherit the
// badge's text color via currentColor and stay crisp at 14px.
function IconCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
function IconBan() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m6.5 6.5 11 11" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function resolveStatus(sub: SubscriptionRow | null): ResolvedStatus | null {
  if (!sub) return null;
  return sub.subscription_status ?? "legacy";
}

// Coastal-theme badge colors: primary (sky blue) for a genuinely active sub,
// the warm accent (peach/terracotta) for "still needs payment", muted grey
// for a wound-down cancellation, destructive red for a lapsed one.
function statusMeta(status: ResolvedStatus) {
  switch (status) {
    case "active":
      return {
        badge: "已訂閱（有效） Active",
        badgeClass: "bg-primary/10 text-primary",
        Icon: IconCheck,
      };
    case "pending_payment":
      return {
        badge: "未完成付款 Pending payment",
        badgeClass: "bg-accent text-accent-foreground",
        Icon: IconClock,
      };
    case "legacy":
      return {
        badge: "未完成付款 Pending payment",
        badgeClass: "bg-accent text-accent-foreground",
        Icon: IconClock,
      };
    case "cancelled":
      return {
        badge: "已取消 Cancelled",
        badgeClass: "bg-muted text-muted-foreground",
        Icon: IconBan,
      };
    case "expired":
      return {
        badge: "已結束 Expired",
        badgeClass: "bg-destructive/10 text-destructive",
        Icon: IconAlert,
      };
  }
}

function primaryButtonLabel(status: ResolvedStatus | null, saving: boolean) {
  if (saving) return "處理中… Processing…";
  switch (status) {
    case "active":
      return "更新目標價 Update price";
    // A cancelled row's recurring charge already stopped -- there's no
    // live subscription left to just adjust the price on, so this is a
    // real resubscribe (new ECPay checkout), same as "expired".
    case "cancelled":
    case "expired":
      return "重新訂閱 Resubscribe";
    case "pending_payment":
    case "legacy":
      return `完成付款 Pay NT$${MONTHLY_PRICE_TWD}`;
    default:
      return "開始追蹤 Start tracking";
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
    // The input is cleared back to "" after every successful save and only
    // shows the existing target price as a greyed-out placeholder — so if
    // the user doesn't retype it (easy to assume it's already filled in,
    // since it's right there on screen), targets[plan] is empty and this
    // used to fail validation immediately with a generic error and no
    // redirect at all. Empty now falls back to the row's current target
    // price, matching what the placeholder already tells the user.
    const existingTarget = subscriptions[plan]?.target_price;
    const rawTarget = targets[plan] || (existingTarget != null ? String(existingTarget) : "");
    const targetPrice = Number(rawTarget);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setStatus((s) => ({ ...s, [plan]: "error" }));
      return;
    }
    setStatus((s) => ({ ...s, [plan]: "saving" }));

    // Only a genuinely active row is a plain in-place price update with
    // no checkout (see primaryButtonLabel: "更新目標價") — its recurring
    // charge is still live, nothing new to pay for. Every other case (no
    // row, pending_payment/legacy/expired, and now cancelled too — its
    // charge already stopped, so "更新目標價" isn't real without a fresh
    // payment) actually redirects to ECPay, so open the tab for those.
    // Opening a blank tab for the active case just to close it again a
    // moment later is the flicker Jessica saw, hence checking first. The
    // tab still has to open synchronously here, in the click handler
    // itself, so the browser's popup blocker treats it as a direct result
    // of the user's click — by the time the checkout HTML comes back from
    // the fetch below it's async and a window.open() there would get
    // blocked.
    const resolved = resolveStatus(subscriptions[plan]);
    const needsCheckout = resolved !== "active";
    const checkoutTab = needsCheckout ? window.open("", "_blank") : null;

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
        // hand the NEW tab to ECPay's cashier so this dashboard tab stays
        // put behind it; no need to hit "back" to get back to it.
        const html = await res.text();
        if (checkoutTab) {
          checkoutTab.document.open();
          checkoutTab.document.write(html);
          checkoutTab.document.close();
        } else {
          // Either the popup was blocked, or the backend decided a
          // checkout was needed when we didn't expect one — either way,
          // fall back to navigating this tab so checkout still works even
          // without the new-tab convenience.
          document.open();
          document.write(html);
          document.close();
          return;
        }
        setStatus((s) => ({ ...s, [plan]: "idle" }));
        return;
      }

      // application/json — in-place target-price update, no re-payment
      // needed, so there's nothing for the blank tab to show.
      checkoutTab?.close();
      setStatus((s) => ({ ...s, [plan]: "saved" }));
      setTargets((t) => ({ ...t, [plan]: "" }));
      await loadSubscriptions();
    } catch {
      checkoutTab?.close();
      setStatus((s) => ({ ...s, [plan]: "error" }));
    }
  }

  // One endpoint, two very different outcomes depending on what the row
  // actually is server-side:
  //   - active     → ECPay's CreditCardPeriodAction stops the recurring
  //                  charge; the row becomes "cancelled" with a grace period
  //                  (still alerts through current_period_end).
  //   - pending_payment / expired / legacy (no subscription_status) → there
  //                  was never a real charge to cancel, so the backend just
  //                  deletes the row outright and the card goes back to
  //                  "not tracked" — the user can start over with a new
  //                  target price.
  // The front end doesn't need to know which branch fires; it just reloads.
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
            const Icon = meta?.Icon;
            const isPendingLike =
              resolved === "pending_payment" || resolved === "legacy" || resolved === "expired";
            const showCancelActive = resolved === "active";
            const showRemovePending = isPendingLike && !!sub;

            return (
              <div
                key={plan.name}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold">{plan.label}</p>
                  {meta && (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${meta.badgeClass}`}
                    >
                      {Icon && <Icon />}
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
                    （仍會通知到該日）。點「重新訂閱」會立即開始新的付款週期。 Notifications
                    continue until this date. "Resubscribe" starts a new paid period right away.
                  </p>
                )}
                {(resolved === "pending_payment" || resolved === "legacy") && (
                  <p className="mt-3 text-sm text-accent-foreground">
                    尚未完成付款，點「完成付款」前往綠界結帳。 Not tracking yet — tap Pay to check
                    out with ECPay.
                  </p>
                )}
                {resolved === "expired" && (
                  <p className="mt-3 text-sm text-destructive">
                    訂閱已結束，重新訂閱即可恢復通知。 Subscription ended — resubscribe to resume
                    notifications.
                  </p>
                )}

                {sub && (resolved === "active" || resolved === "cancelled") && (
                  <p className="mt-3 text-sm text-foreground">
                    目前目標價：
                    <span className="font-semibold">NT${sub.target_price.toLocaleString()}</span>
                  </p>
                )}

                <label className="mt-4 block text-sm font-medium" htmlFor={`target-${plan.name}`}>
                  目標價 Target price (NT$)
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
                  className="mt-4 w-full rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {primaryButtonLabel(resolved, status[plan.name] === "saving")}
                </button>

                {(showCancelActive || showRemovePending) && sub && (
                  <button
                    type="button"
                    onClick={() => handleCancel(plan.name, sub.route)}
                    disabled={status[plan.name] === "saving"}
                    className="mt-3 block text-sm text-muted-foreground underline decoration-dotted underline-offset-4 transition hover:text-destructive disabled:opacity-60"
                  >
                    {showCancelActive ? "取消訂閱 Cancel subscription" : "取消追蹤 Remove"}
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
