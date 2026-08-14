import Link from 'next/link';
import { notFound } from 'next/navigation';
import UserDetail from '@/components/UserDetail';
import { loadUserById } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await loadUserById(id);
  if (!user) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+4rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <Link
        href="/"
        className="inline-block text-sm font-semibold text-neutral-500 hover:text-neutral-900"
      >
        ← Dashboard
      </Link>
      <UserDetail user={user} />
    </main>
  );
}
