# Inkbound Analytics

Internal analytics dashboard for Inkbound. Reads the production Supabase project (read only) and shows the real business numbers: signups, trials, and genuine paying customers, with comped, demo, ambassador, and admin accounts excluded from every revenue metric.

## Status labels

Every user gets exactly one label, computed in `lib/classify.ts`:

- **Paying** (monthly, annual, or lifetime): full plan whose Stripe subscription is active or past due, not flagged internal. A row still marked full after Stripe ended the subscription is not paying.
- **Comped**: has Pro access but never paid. Demo, ambassador, and admin accounts, plus full plans with no Stripe subscription and no recorded charge (manual grants and 100 percent off coupons).
- **Trialing**: Stripe says the subscription is trialing (3 days on the $299 annual plan). Without a Stripe subscription, inside the profile's trial window with no charge yet.
- **Trial ended**: trial lapsed without converting.
- **Signed up**: account created, never trialed or paid.
- **Churned**: paid at some point, then canceled.

## Keeping up with the athlete app

- **Plans and prices** live in one file, `lib/plans.ts`, keyed by `user_subscriptions.payment_type`. A label read from the live Stripe price wins over it, so a price change shows up without an edit; update the file when a plan is added.
- **Onboarding screens** are mirrored into `lib/onboarding-flow.generated.ts` by `npm run sync:flow`, which reads `../inkbound-web` at `origin/main` (what is deployed; override with `INKBOUND_WEB_REF`) and `../inkbound-mobile` from disk. Two flows are tracked, the short intake (`n00` … `n11`, `p01`, `p02`) and the full flow (`s01` … `s36b`), both ending on `s37_paywall`. The Onboarding tab leads with whichever flow most people started in the last 30 days. Run the sync after the app's flow changes; `npm test` fails when the mirror is stale.
- **Usage** combines `product_events` with rows from the product's own tables (videos, video sends, campaign batches, Ask AI, game film), because the redesigned athlete dashboard writes no page events.
- Visitors who leave onboarding before creating an account (the verify phone screen) write nothing to the database, so every funnel here starts at accounts created.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:3050
```

## Environment variables

| Name | Value |
|---|---|
| `SUPABASE_URL` | The Inkbound Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. Only used server side, never sent to the browser |
| `STRIPE_SECRET_KEY` | Stripe secret key (same as Supabase). Powers gross revenue, MRR, and the revenue chart |
| `ANALYTICS_PASSWORD` | Shared password for the login gate |

## Deploy to Vercel

1. Go to vercel.com, click Add New, then Project.
2. Import the `FieldVision-analytics-` GitHub repo.
3. Framework preset: Next.js (detected automatically). Leave build settings as default.
4. Under Environment Variables, add the three variables above.
5. Click Deploy.

The site is protected by the password gate on every route. The service role key stays on the server because all Supabase queries run in a server component.
