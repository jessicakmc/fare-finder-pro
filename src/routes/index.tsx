import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useReveal } from "@/hooks/use-reveal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flight Price Notifier — 機票降價通知" },
      {
        name: "description",
        content:
          "Set a route and a target price — we email you when the cheapest fare from Taipei drops to your budget.",
      },
      { property: "og:title", content: "Flight Price Notifier — 機票降價通知" },
      {
        property: "og:description",
        content: "設定航線與目標價，機票降價就通知你。Fare alerts for budget-driven travelers.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: "✈️",
    title: "盯緊熱門航線",
    subtitle: "Always-on route watching",
    body: "持續監控台北出發的熱門航線（東京、首爾），自動抓最低票價。",
  },
  {
    icon: "🔔",
    title: "達標自動通知",
    subtitle: "Target-price email alerts",
    body: "低於你設定的目標價，就寄 email 提醒你，附上立即訂購連結。",
  },
  {
    icon: "🚫",
    title: "隨時取消",
    subtitle: "Cancel anytime",
    body: "月訂閱制，不想用隨時停，沒有綁約。",
  },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    void supabase.auth.getSession().then(({ data: d }) => setSignedIn(Boolean(d.session)));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <span className="text-sm font-semibold tracking-tight sm:text-base">
          <span aria-hidden="true" className="mr-2">
            ✈️
          </span>
          Flight Price Notifier
        </span>
        {signedIn ? (
          <Link
            to="/dashboard"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition hover:brightness-110"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            to="/auth"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition hover:brightness-110"
          >
            Sign in / 登入
          </Link>
        )}
      </header>

      <main>
        <section className="hero-glow relative overflow-hidden border-b border-border">
          <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:py-32">
            <p className="mb-6 inline-flex items-center rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              台北出發 · 東京 · 首爾
            </p>
            <h1 className="text-gradient-violet text-4xl font-bold tracking-tight sm:text-6xl">
              Flight Price Notifier
            </h1>
            <p className="mt-6 text-xl font-medium sm:text-2xl">
              設定航線與目標價，機票降價就通知你
            </p>
            <p className="mt-3 text-base text-muted-foreground">
              Set a route and a target price — we email you when the fare drops.
            </p>
            <div className="mt-10 flex justify-center">
              <Link
                to="/auth"
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_40px_var(--color-violet-glow)] transition hover:brightness-110"
              >
                Sign in / 登入
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} delay={i * 120} />
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground">
          © 2026 Flight Price Notifier
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  feature,
  delay,
}: {
  feature: (typeof features)[number];
  delay: number;
}) {
  const ref = useReveal<HTMLElement>();

  return (
    <article
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className="reveal rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
    >
      <div aria-hidden="true" className="text-3xl">
        {feature.icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold">{feature.title}</h2>
      <p className="text-sm text-primary">{feature.subtitle}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
    </article>
  );
}
