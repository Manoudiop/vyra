import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, Screen } from '@/ui';
import { useSession } from './session-store';

/** Shown at launch when a saved session exists but the API cannot be reached. */
export function UnreachableScreen() {
  const { t } = useTranslation();
  const restore = useSession((state) => state.restore);
  const [retrying, setRetrying] = useState(false);

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'center' }} testID="unreachable-screen">
      <ErrorState
        message={t('errors.network')}
        onRetry={
          retrying
            ? undefined
            : () => {
                setRetrying(true);
                void restore().finally(() => setRetrying(false));
              }
        }
      />
    </Screen>
  );
}
