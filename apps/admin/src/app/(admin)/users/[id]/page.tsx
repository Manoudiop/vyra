import { adminUserDetailSchema, formatXof, PLAN_DEFINITIONS } from '@vyra/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminApiError, adminGet } from '@/lib/api';
import { formatDate, METRIC_LABELS, PLAN_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await adminGet(
    `/admin/users/${encodeURIComponent(id)}`,
    adminUserDetailSchema,
  ).catch((error: unknown) => {
    if (error instanceof AdminApiError && error.status === 404) notFound();
    throw error;
  });

  return (
    <>
      <p>
        <Link href="/users">← Utilisateurs</Link>
      </p>
      <div className="title-row">
        <h1>{user.firstName || user.email}</h1>
        <span className={`plan plan-${user.plan.toLowerCase()}`}>{PLAN_LABELS[user.plan]}</span>
      </div>
      <p className="muted">
        {user.email} · inscrit le {formatDate(user.createdAt)} · {user.city ?? 'ville inconnue'} ·{' '}
        {user.timezone} · {user.locale.toUpperCase()}
        {!user.analyticsEnabled && ' · statistiques désactivées'}
      </p>

      <section className="columns">
        <div className="card">
          <h2>Abonnement</h2>
          <dl>
            <dt>Offre</dt>
            <dd>
              {PLAN_LABELS[user.plan]}
              {user.plan !== 'FREE' &&
                ` · ${formatXof(PLAN_DEFINITIONS[user.plan].monthlyPriceXof)} / mois`}
            </dd>
            <dt>Statut</dt>
            <dd>
              {user.subscription.status}
              {user.subscription.cancelAtPeriodEnd && ' · résilié'}
            </dd>
            <dt>Fin de période</dt>
            <dd>{formatDate(user.subscription.currentPeriodEnd)}</dd>
            <dt>Paiement</dt>
            <dd>{user.subscription.provider}</dd>
          </dl>
        </div>
        <div className="card">
          <h2>Usage IA (période en cours)</h2>
          <dl>
            {user.usage.map((meter) => (
              <div key={meter.metric}>
                <dt>{METRIC_LABELS[meter.metric]}</dt>
                <dd>
                  {meter.used} / {meter.limit ?? '∞'}
                  <span className="muted small block">
                    renouvellement {formatDate(meter.resetsAt)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="card">
          <h2>Activité</h2>
          <dl>
            <dt>Pièces</dt>
            <dd>
              {user.counts.items} (+ {user.counts.archivedItems} archivées)
            </dd>
            <dt>Looks</dt>
            <dd>
              {user.counts.outfits} · {user.counts.savedOutfits} enregistrés
            </dd>
            <dt>Ports</dt>
            <dd>{user.counts.wears}</dd>
            <dt>Avis</dt>
            <dd>
              {user.counts.loves} aimés · {user.counts.dislikes} refusés
            </dd>
            <dt>Jours planifiés</dt>
            <dd>{user.counts.plannedDays}</dd>
          </dl>
        </div>
      </section>

      <h2>Dernières pièces</h2>
      {user.recentItems.length === 0 ? (
        <p className="muted">Dressing vide.</p>
      ) : (
        <section className="thumbs">
          {user.recentItems.map((item) => (
            <figure key={item.id} className="card thumb">
              {/* Signed, short-lived URLs from the API's storage. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnailUrl} alt={item.name} loading="lazy" />
              <figcaption>
                {item.name}
                <span className="muted small">{item.category}</span>
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      <h2>Derniers looks</h2>
      <section className="card">
        {user.recentOutfits.length === 0 ? (
          <p className="muted">Aucun look généré.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Occasion</th>
                <th>Style</th>
                <th className="num">Pièces</th>
                <th>Créé</th>
              </tr>
            </thead>
            <tbody>
              {user.recentOutfits.map((outfit) => (
                <tr key={outfit.id}>
                  <td>
                    {outfit.name}
                    {outfit.isSaved && <span className="badge">enregistré</span>}
                  </td>
                  <td>{outfit.occasion}</td>
                  <td>{outfit.style}</td>
                  <td className="num">{outfit.pieces}</td>
                  <td>{formatDate(outfit.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
