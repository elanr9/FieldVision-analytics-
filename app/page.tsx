import { loadUsers } from '@/lib/queries';
import { loadRevenueSnapshot } from '@/lib/stripe-revenue';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const users = await loadUsers();
  const excluded = new Set(users.filter(u => u.excludedFromMetrics).map(u => u.id));
  const revenue = await loadRevenueSnapshot(excluded);
  return <Dashboard users={users} revenue={revenue} />;
}
