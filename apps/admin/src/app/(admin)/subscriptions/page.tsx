import { adminSubscriptionsSchema, formatXof } from '@vyra/shared';
import Link from 'next/link';
import { adminGet } from '@/lib/api';
import { formatDate, PLAN_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'active', label: 'Actives' },
  { value: 'canceling', label: 'Résiliées (fin de mois)' },
] as const;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const current = FILTERS.find((filter) => filter.value === status)?.value ?? 'all';
  const data = await adminGet(`/admin/subscriptions?status=${current}`, adminSubscriptionsSchema);

  return (
    <>
      <div className="title-row">
        <h1>Abonnements</h1>
        <span className="muted">Revenu mensuel récurrent : {formatXof(data.mrrXof)}</span>
      </div>
      <nav className="tabs">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/subscriptions?status=${filter.value}`}
            className={filter.value === current ? 'active' : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      <section className="card">
        {data.items.length === 0 ? (
          <p className="muted">Aucun abonnement payant.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Offre</th>
                <th className="num">Prix</th>
                <th>Fin de période</th>
                <th>État</th>
                <th>Paiement</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <Link href={`/users/${row.userId}`}>{row.email}</Link>
                  </td>
                  <td>
                    <span className={`plan plan-${row.plan.toLowerCase()}`}>
                      {PLAN_LABELS[row.plan]}
                    </span>
                  </td>
                  <td className="num">{formatXof(row.monthlyPriceXof)}</td>
                  <td>{formatDate(row.currentPeriodEnd)}</td>
                  <td>{row.cancelAtPeriodEnd ? 'Résilié' : 'Renouvelé'}</td>
                  <td>{row.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
