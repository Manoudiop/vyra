import {
  CLOTHING_CATEGORIES,
  type ClothingCategory,
  type ClothingItemDetail,
  type Season,
  SEASONS,
  type Style,
  STYLE_COLOR_NAMES,
  STYLE_COLORS,
  type StyleColor,
  STYLES,
} from '@vyra/shared';
import { useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FormBanner } from '@/features/auth/components';
import { useClothingItem, useUpdateItem } from '@/features/closet/hooks';
import { ColorPicker } from '@/features/profile/pickers';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Chip,
  ErrorState,
  IconButton,
  Screen,
  Skeleton,
  spacing,
  Text,
  TextField,
} from '@/ui';

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
        <View style={styles.sections}>
          <Skeleton height={54} radius={14} />
          <Skeleton height={120} radius={20} />
        </View>
      )}
    </Screen>
  );
}

const isStyleColor = (value: string): value is StyleColor =>
  (STYLE_COLOR_NAMES as readonly string[]).includes(value);

function EditForm({ item, header }: { item: ClothingItemDetail; header: React.ReactNode }) {
  const { t } = useTranslation();
  const update = useUpdateItem(item.id);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<ClothingCategory>(item.category);
  const [subcategory, setSubcategory] = useState(item.subcategory ?? '');
  const [color, setColor] = useState<StyleColor | null>(
    isStyleColor(item.color) ? item.color : null,
  );
  const [style, setStyle] = useState<Style | null>(item.style);
  const [season, setSeason] = useState<Season>(item.season);

  const valid = name.trim().length > 0 && color !== null;

  const save = () => {
    if (!color) return;
    update.mutate(
      {
        name,
        category,
        subcategory: subcategory.trim() ? subcategory : null,
        color,
        // Keep a precise hex only if the color family did not change.
        colorHex: color === item.color ? item.colorHex : STYLE_COLORS[color],
        style,
        season,
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
            disabled={!valid}
          />
        </View>
      }
    >
      {header}
      <View style={styles.sections}>
        <TextField
          testID="edit-item-name"
          label={t('closet.name')}
          value={name}
          onChangeText={setName}
          error={name.trim() ? undefined : t('validation.required')}
          maxLength={80}
        />
        <TextField
          testID="edit-item-subcategory"
          label={t('closet.subcategory')}
          value={subcategory}
          onChangeText={setSubcategory}
          maxLength={60}
        />

        <Section title={t('closet.category')}>
          {CLOTHING_CATEGORIES.map((value) => (
            <Chip
              key={value}
              testID={`edit-category-${value}`}
              label={t(`categories.${value}`)}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </Section>

        <View style={styles.section}>
          <Text variant="title3">{t('closet.color')}</Text>
          <ColorPicker
            single
            max={1}
            value={color ? [color] : []}
            onChange={(values) => setColor(values[0] ?? null)}
          />
        </View>

        <Section title={t('closet.style')}>
          {STYLES.map((value) => (
            <Chip
              key={value}
              label={t(`styles.${value}`)}
              selected={style === value}
              onPress={() => setStyle(style === value ? null : value)}
            />
          ))}
        </Section>

        <Section title={t('closet.season')}>
          {SEASONS.map((value) => (
            <Chip
              key={value}
              label={t(`seasons.${value}`)}
              selected={season === value}
              onPress={() => setSeason(value)}
            />
          ))}
        </Section>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title3">{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
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
  sections: { gap: spacing.xl },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { gap: spacing.md },
});
