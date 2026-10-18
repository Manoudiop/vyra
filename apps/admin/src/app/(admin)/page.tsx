import { adminMetricsSchema, formatXof, PLANS, USAGE_METRICS } from '@vyra/shared';
import { adminSubscriptionsSchema } from '@vyra/shared';
import { adminGet, fetchHealth } from '@/lib/api';
import { EVENT_LABELS, formatDate, formatPercent, METRIC_LABELS, PLAN_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [metrics, subscriptions, health] = await Promise.all([
    adminGet('/admin/metrics', adminMetricsSchema),
    adminGet('/admin/subscriptions', adminSubscriptionsSchema),
    fetchHealth(),
  ]);

  return (
    <>
      <div className="title-row">
        <h1>Tableau de bord</h1>
        <span className="status muted">
          <span
            className="dot"
            style={{ background: health ? 'var(--success)' : 'var(--danger)' }}
          />
          {health ? `API v${health.version}` : 'API injoignable'} ·{' '}
          {formatDate(metrics.generatedAt, true)}
        </span>
      </div>

      <section className="grid">
        <Stat
          label="Utilisateurs"
          value={metrics.users.total}
          hint={`${metrics.users.onboarded} onboardés`}
        />
        <Stat label="Nouveaux (7 j)" value={metrics.users.newLast7Days} />
        <Stat label="Actifs (7 j)" value={metrics.users.activeLast7Days} />
        <Stat
          label="Revenu mensuel"
          value={formatXof(subscriptions.mrrXof)}
          hint="offres payantes actives"
        />
      </section>

      <h2>Offres</h2>
      <section className="grid">
        {PLANS.map((plan) => (
          <Stat key={plan} label={PLAN_LABELS[plan]} value={metrics.plans[plan] ?? 0} />
        ))}
        <Stat
          label="Conversion paywall (30 j)"
          value={formatPercent(metrics.rates.paywallConversion)}
        />
      </section>

      <h2>Contenu et usage IA</h2>
      <section className="grid">
        <Stat label="Pièces dans les dressings" value={metrics.content.clothingItems} />
        <Stat label="Looks" value={metrics.content.outfits} />
        <Stat label="Ports enregistrés" value={metrics.content.wears} />
        {USAGE_METRICS.map((metric) => (
          <Stat
            key={metric}
            label={`${METRIC_LABELS[metric]} (30 j)`}
            value={metrics.aiUsage[metric]}
          />
        ))}
        <Stat label="Looks approuvés (30 j)" value={formatPercent(metrics.rates.outfitApproval)} />
      </section>

      <h2>Événements (30 derniers jours)</h2>
      <section className="card">
        <table>
          <tbody>
            {Object.entries(metrics.events).map(([name, count]) => (
              <tr key={name}>
                <td>{EVENT_LABELS[name] ?? name}</td>
                <td className="num">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Seulement les utilisateurs qui n’ont pas désactivé les statistiques d’usage.
        </p>
      </section>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card stat">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}
