import {
  type ClothingItemDetail,
  STYLE_COLOR_NAMES,
  STYLE_COLORS,
  type StyleColor,
} from '@vyra/shared';
import { useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FormBanner } from '@/features/auth/components';
import { useClothingItem, useUpdateItem } from '@/features/closet/hooks';
import {
  isItemFieldsComplete,
  ItemFields,
  type ItemFieldsValue,
} from '@/features/closet/ItemFields';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import { Button, ErrorState, IconButton, Screen, Skeleton, spacing, Text } from '@/ui';

export default function EditClothingItemScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useClothingItem(id);

  const header = (
    <View style={styles.header}>
      <Text variant="title2" accessibilityRole="header">
        {t('closet.editTitle')}
      </Text>
      <IconButton
        icon={X}
        accessibilityLabel={t('common.cancel')}
        onPress={() => goBackOr({ pathname: '/closet/[id]', params: { id } })}
      />
    </View>
  );

  if (item.data) return <EditForm item={item.data} header={header} />;

  return (
    <Screen edges={['top', 'bottom']} testID="edit-item-screen">
      {header}
      {item.isError ? (
        <ErrorState message={errorMessage(item.error, t)} onRetry={() => void item.refetch()} />
      ) : (
        <View style={styles.loading}>
          <Skeleton height={54} radius={14} />
          <Skeleton height={120} radius={20} />
        </View>
      )}
    </Screen>
  );
}

const isStyleColor = (value: string): value is StyleColor =>
  (STYLE_COLOR_NAMES as readonly string[]).includes(value);

/** Mounted once the item is loaded, so the form state is seeded at creation. */
function EditForm({ item, header }: { item: ClothingItemDetail; header: React.ReactNode }) {
  const { t } = useTranslation();
  const update = useUpdateItem(item.id);
  const [fields, setFields] = useState<ItemFieldsValue>(() => ({
    name: item.name,
    category: item.category,
    subcategory: item.subcategory ?? '',
    color: isStyleColor(item.color) ? item.color : null,
    style: item.style,
    season: item.season,
  }));

  const save = () => {
    const { color, category } = fields;
    if (!color || !category) return;
    update.mutate(
      {
        name: fields.name,
        category,
        subcategory: fields.subcategory.trim() ? fields.subcategory : null,
        color,
        // Keep the photo's precise shade only if the color family did not change.
        colorHex: color === item.color ? item.colorHex : STYLE_COLORS[color],
        style: fields.style,
        season: fields.season,
      },
      { onSuccess: () => goBackOr({ pathname: '/closet/[id]', params: { id: item.id } }) },
    );
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      testID="edit-item-screen"
      footer={
        <View style={styles.footer}>
          {update.isError && <FormBanner tone="error" message={errorMessage(update.error, t)} />}
          <Button
            testID="edit-item-save"
            label={t('closet.save')}
            onPress={save}
            loading={update.isPending}
            disabled={!isItemFieldsComplete(fields)}
          />
        </View>
      }
    >
      {header}
      <ItemFields
        value={fields}
        onChange={(patch) => setFields((current) => ({ ...current, ...patch }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  loading: { gap: spacing.xl },
  footer: { gap: spacing.md },
});
