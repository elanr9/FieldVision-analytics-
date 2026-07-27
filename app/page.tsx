import { loadUsers } from '@/lib/queries';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const users = await loadUsers();
  return <Dashboard users={users} />;
}
