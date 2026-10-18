import { type Plan, type UsageMetric } from '@vyra/shared';

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: 'Gratuit',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

export const METRIC_LABELS: Record<UsageMetric, string> = {
  OUTFIT_GENERATION: 'Looks générés',
  CLOTHING_ANALYSIS: 'Analyses de vêtements',
};

export const EVENT_LABELS: Record<string, string> = {
  signup: 'Inscriptions',
  onboarding_completed: 'Onboardings terminés',
  item_added: 'Pièces ajoutées',
  outfit_generated: 'Looks générés',
  outfit_saved: 'Looks enregistrés',
  outfit_worn: 'Looks portés',
  outfit_liked: 'Looks aimés',
  outfit_disliked: '« Pas pour moi »',
  paywall_viewed: 'Paywall affiché',
  subscription_started: 'Abonnements démarrés',
  subscription_cancelled: 'Résiliations',
};

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatPercent(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)} %`;
}
