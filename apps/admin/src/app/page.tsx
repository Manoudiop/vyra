import { PLAN_DEFINITIONS, PLANS } from '@vyra/shared';
import { fetchHealth } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const health = await fetchHealth();

  return (
    <main>
      <h1>VYRA Admin</h1>
      <p className="muted">Outil interne — utilisateurs, abonnements, usage IA (à venir).</p>

      <section className="card">
        <span className="status">
          <span
            className="dot"
            style={{ background: health ? 'var(--success)' : 'var(--danger)' }}
          />
          {health ? `API connectée · v${health.version}` : 'API injoignable'}
        </span>
      </section>

      <h2>Plans</h2>
      <section className="card">
        <ul>
          {PLANS.map((plan) => (
            <li key={plan}>
              <strong>{plan}</strong> —{' '}
              {PLAN_DEFINITIONS[plan].monthlyPriceXof.toLocaleString('fr-FR')} FCFA / mois
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
