# FieldVision Analytics

Internal analytics dashboard for FieldVision. Reads the production Supabase project (read only) and shows the real business numbers: signups, trials, and genuine paying customers, with comped, demo, ambassador, and admin accounts excluded from every revenue metric.

## Status labels

Every user gets exactly one label, computed in `lib/classify.ts`:

- **Paying** (monthly, annual, or lifetime): full plan backed by a real Stripe subscription, past the trial window, not flagged internal.
- **Comped**: has Pro access but never paid. Demo, ambassador, and admin accounts, plus full plans with no Stripe subscription and no recorded charge (manual grants and 100 percent off coupons).
- **Trialing**: inside the 7 day trial window, no charge yet.
- **Trial ended**: trial lapsed without converting.
- **Signed up**: account created, never trialed or paid.
- **Churned**: paid at some point, then canceled.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:3050
```

## Environment variables

| Name | Value |
|---|---|
| `SUPABASE_URL` | The FieldVision Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. Only used server side, never sent to the browser |
| `ANALYTICS_PASSWORD` | Shared password for the login gate |

## Deploy to Vercel

1. Go to vercel.com, click Add New, then Project.
2. Import the `FieldVision-analytics-` GitHub repo.
3. Framework preset: Next.js (detected automatically). Leave build settings as default.
4. Under Environment Variables, add the three variables above.
5. Click Deploy.

The site is protected by the password gate on every route. The service role key stays on the server because all Supabase queries run in a server component.
