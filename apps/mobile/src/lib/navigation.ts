import { type Href, router } from 'expo-router';

/**
 * Goes back when there is history, otherwise replaces with `fallback` — screens
 * opened from a deep link or notification have nothing to go back to.
 */
export function goBackOr(fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
