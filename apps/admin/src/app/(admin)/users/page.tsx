import { adminUsersPageSchema, PLANS, planSchema } from '@vyra/shared';
import Link from 'next/link';
import { adminGet } from '@/lib/api';
import { formatDate, PLAN_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; plan?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const plan = planSchema.safeParse(params.plan).data;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search.slice(0, 80));
  if (plan) query.set('plan', plan);
  if (params.cursor) query.set('cursor', params.cursor);
  const page = await adminGet(`/admin/users?${query.toString()}`, adminUsersPageSchema);
  const next = new URLSearchParams(query);
  if (page.nextCursor) next.set('cursor', page.nextCursor);

  return (
    <>
      <h1>Utilisateurs</h1>
      <form className="filters" method="get">
        <input
          name="search"
          placeholder="Email ou prénom"
          defaultValue={params.search ?? ''}
          aria-label="Rechercher"
        />
        <select name="plan" defaultValue={plan ?? ''} aria-label="Offre">
          <option value="">Toutes les offres</option>
          {PLANS.map((value) => (
            <option key={value} value={value}>
              {PLAN_LABELS[value]}
            </option>
          ))}
        </select>
        <button type="submit">Filtrer</button>
      </form>

      <section className="card">
        {page.items.length === 0 ? (
          <p className="muted">Aucun utilisateur ne correspond.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Prénom</th>
                <th>Offre</th>
                <th className="num">Pièces</th>
                <th className="num">Looks</th>
                <th>Inscription</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link href={`/users/${user.id}`}>{user.email}</Link>
                    {user.role === 'ADMIN' && <span className="badge">admin</span>}
                    {!user.onboarded && <span className="badge muted">onboarding</span>}
                  </td>
                  <td>{user.firstName}</td>
                  <td>
                    <span className={`plan plan-${user.plan.toLowerCase()}`}>
                      {PLAN_LABELS[user.plan]}
                    </span>
                  </td>
                  <td className="num">{user.items}</td>
                  <td className="num">{user.outfits}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <nav className="pager">
        {params.cursor && <Link href="/users">← Début</Link>}
        {page.nextCursor && <Link href={`/users?${next.toString()}`}>Suivants →</Link>}
      </nav>
    </>
  );
}
