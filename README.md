# Fare Finder Pro

Build a SaaS landing page + authenticated app shell for Flight Price Notifier
(機票降價通知), a product that watches popular flight routes from Taipei and
emails the user when the cheapest fare drops to or below their target price —
targeted at budget-driven travelers who don't care exactly when they fly,
they just want a ticket under their budget.

The site must include:

A public landing page (/) with:

Hero section: product name "Flight Price Notifier" prominently displayed,
value prop 「設定航線與目標價，機票降價就通知你」(English subtitle: "Set a
route and a target price — we email you when the fare drops."), and a
primary CTA button labeled "Sign in / 登入" in the top-right header.

Three feature cards below the hero, each with an icon, a Chinese title, an
English subtitle, and a one-line Chinese description:

Card 1: ✈️ icon — "盯緊熱門航線" / "Always-on route watching" —
"持續監控台北出發的熱門航線（東京、首爾），自動抓最低票價。"

Card 2: 🔔 icon — "達標自動通知" / "Target-price email alerts" —
"低於你設定的目標價，就寄 email 提醒你，附上立即訂購連結。"

Card 3: 🚫 icon — "隨時取消" / "Cancel anytime" —
"月訂閱制，不想用隨時停，沒有綁約。"

A simple footer with "© 2026 Flight Price Notifier".

An authenticated area with a /auth page (Supabase email/password auth):

Heading "Welcome back．登入", subtitle "Sign in to manage your fare alerts.",
Email field (placeholder "you@example.com") and Password field, a primary
button "Sign in / 登入", and a toggle link "No account yet? Create one" to
switch to sign-up mode.

After signing in, redirect to a placeholder dashboard page.

Style requirements:

Modern, professional dark theme (purple/violet accent on a near-black
background)

Use Inter or a similar sans-serif font

Mobile responsive

Tasteful subtle animations (fade-in on scroll is fine; don't overdo it)

Out of scope for this v1: route-subscription form, target-price input, fare
display, payment, custom database tables (do NOT create a subscriptions or
profiles table — only use Supabase's default auth.users). Those come in
later milestones. Stick to landing page + auth + placeholder dashboard.

## Stack

A plain Vite + React single-page app, using React Router for client-side
routing and Supabase for email/password auth. No SSR, no server runtime —
it builds to a static `dist/` bundle and deploys to Vercel.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/jessicakmc/fare-finder-pro.git
cd fare-finder-pro
npm i
npm run dev
```

## Environment variables

Copy `.env.example` to `.env` and fill in your Supabase project's URL and
publishable key (Project Settings → API in the Supabase dashboard):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

A committed `.env` with real values is already present for this project's own
Supabase instance — the publishable key is safe to expose client-side (it's
constrained by Row Level Security), never put a service-role/secret key here.

## Deploy

The repo ships with a `vercel.json` (build command, `dist/` output, and a SPA
rewrite so deep links like `/dashboard` resolve client-side). Import the repo
into Vercel and it will build automatically. The committed `.env` already
supplies `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, but you can
also set them under Project Settings → Environment Variables in Vercel if you
prefer to manage them there instead — a dashboard value takes precedence.
