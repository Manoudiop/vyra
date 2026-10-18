import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Outfit, type OutfitFeedbackInput } from '@vyra/shared';
import { calendarKeys } from '@/features/calendar/calendar-api';
import { closetKeys } from '@/features/closet/closet-api';
import { styleKeys } from '@/features/style/style-api';
import { haptics } from '@/ui';
import { outfitKeys, stylistApi } from './stylist-api';

type Action =
  | { type: 'save'; isSaved: boolean }
  | { type: 'wear'; worn: boolean }
  | { type: 'rate'; feedback: OutfitFeedbackInput | null };

function send(id: string, action: Action): Promise<Outfit> {
  switch (action.type) {
    case 'save':
      return stylistApi.setSaved(id, action.isSaved);
    case 'wear':
      return action.worn ? stylistApi.wear(id) : stylistApi.unwear(id);
    case 'rate':
      return action.feedback ? stylistApi.rate(id, action.feedback) : stylistApi.clearRating(id);
  }
}

function apply(outfit: Outfit, action: Action): Outfit {
  switch (action.type) {
    case 'save':
      return { ...outfit, isSaved: action.isSaved };
    case 'wear':
      return {
        ...outfit,
        wornToday: action.worn,
        ...(action.worn ? { lastWornAt: new Date().toISOString() } : {}),
      };
    case 'rate':
      return {
        ...outfit,
        feedback: action.feedback
          ? { rating: action.feedback.rating, reason: action.feedback.reason ?? null }
          : null,
      };
  }
}

/**
 * Save, wear today and rating, applied optimistically: the screen answers on
 * tap and rolls back (with an error haptic) if the API refuses.
 */
export function useOutfitAction(id: string) {
  const queryClient = useQueryClient();
  const key = outfitKeys.detail(id);
  return useMutation({
    // Successive taps on the same look apply in order.
    scope: { id: `outfit-${id}` },
    mutationFn: (action: Action) => send(id, action),
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Outfit>(key);
      if (previous) queryClient.setQueryData(key, apply(previous, action));
      return { previous };
    },
    onError: (_error, _action, context) => {
      haptics.error();
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (outfit, action) => {
      queryClient.setQueryData(key, outfit);
      // Every rating, wear and save teaches the style profile something.
      void queryClient.invalidateQueries({ queryKey: styleKeys.profile });
      if (action.type === 'save')
        void queryClient.invalidateQueries({ queryKey: outfitKeys.saved() });
      if (action.type === 'wear') {
        // Wear counts and "last worn" are shown on each piece, wears in the calendar.
        void queryClient.invalidateQueries({ queryKey: closetKeys.all });
        void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      }
    },
  });
}
