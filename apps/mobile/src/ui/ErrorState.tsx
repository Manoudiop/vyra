import { CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <EmptyState
      testID="error-state"
      icon={CloudOff}
      title={message ?? t('errors.generic')}
      actionLabel={onRetry ? t('common.retry') : undefined}
      onAction={onRetry}
    />
  );
}
