import { loadUsers } from '@/lib/queries';
import { loadRevenueSnapshot, type RevenueSnapshot } from '@/lib/stripe-revenue';
import type { UserRecord } from '@/lib/types';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let users: UserRecord[] = [];
  let loadError: string | null = null;

  try {
    users = await loadUsers();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  if (loadError) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-5">
          <h1 className="text-base font-bold text-red-800">Could not load data from Supabase</h1>
          <p className="mt-2 break-words text-sm text-red-700">{loadError}</p>
          <p className="mt-3 text-xs text-red-600">
            Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables,
            then redeploy. The URL should look like https://xxxx.supabase.co and the key is the
            long service role JWT.
          </p>
        </div>
      </main>
    );
  }

  let revenue: RevenueSnapshot;
  try {
    const excluded = new Set(users.filter(u => u.excludedFromMetrics).map(u => u.id));
    revenue = await loadRevenueSnapshot(excluded);
  } catch (e) {
    revenue = {
      configured: true,
      mrrCents: 0,
      activeSubscriptionCount: 0,
      events: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return <Dashboard users={users} revenue={revenue} />;
}
