import { Plus, Shirt } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState, IconButton, Screen, ScreenHeader } from '@/ui';

// Phase 6 replaces this with the closet grid, search and filters.
export default function ClosetScreen() {
  const { t } = useTranslation();
  return (
    <Screen testID="closet-screen">
      <ScreenHeader
        title={t('closet.title')}
        right={
          <IconButton icon={Plus} accessibilityLabel={t('closet.emptyCta')} onPress={() => {}} />
        }
      />
      <EmptyState icon={Shirt} title={t('closet.emptyTitle')} body={t('closet.emptyBody')} />
    </Screen>
  );
}
