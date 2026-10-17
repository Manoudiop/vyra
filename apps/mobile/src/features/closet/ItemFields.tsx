import {
  CLOTHING_CATEGORIES,
  type ClothingCategory,
  type Season,
  SEASONS,
  type Style,
  type StyleColor,
  STYLES,
} from '@vyra/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ColorPicker } from '@/features/profile/pickers';
import { Chip, spacing, Text, TextField } from '@/ui';

export interface ItemFieldsValue {
  name: string;
  category: ClothingCategory | null;
  subcategory: string;
  color: StyleColor | null;
  style: Style | null;
  season: Season;
}

export const isItemFieldsComplete = (value: ItemFieldsValue) =>
  value.name.trim().length > 0 && value.category !== null && value.color !== null;

/** Shared editor for a clothing item's descriptive fields (add and edit screens). */
export function ItemFields({
  value,
  onChange,
}: {
  value: ItemFieldsValue;
  onChange: (patch: Partial<ItemFieldsValue>) => void;
}) {
  const { t } = useTranslation();
  // Only flag the empty name once the user has interacted with it.
  const [nameTouched, setNameTouched] = useState(false);
  return (
    <View style={styles.sections}>
      <TextField
        testID="item-name"
        label={t('closet.name')}
        value={value.name}
        onChangeText={(name) => {
          setNameTouched(true);
          onChange({ name });
        }}
        onBlur={() => setNameTouched(true)}
        error={nameTouched && !value.name.trim() ? t('validation.required') : undefined}
        maxLength={80}
      />
      <TextField
        testID="item-subcategory"
        label={t('closet.subcategory')}
        value={value.subcategory}
        onChangeText={(subcategory) => onChange({ subcategory })}
        maxLength={60}
      />

      <Section title={t('closet.category')}>
        {CLOTHING_CATEGORIES.map((category) => (
          <Chip
            key={category}
            testID={`item-category-${category}`}
            label={t(`categories.${category}`)}
            selected={value.category === category}
            onPress={() => onChange({ category })}
          />
        ))}
      </Section>

      <View style={styles.section}>
        <Text variant="title3">{t('closet.color')}</Text>
        <ColorPicker
          single
          max={1}
          value={value.color ? [value.color] : []}
          onChange={(colors) => onChange({ color: colors[0] ?? null })}
        />
      </View>

      <Section title={t('closet.style')}>
        {STYLES.map((style) => (
          <Chip
            key={style}
            label={t(`styles.${style}`)}
            selected={value.style === style}
            onPress={() => onChange({ style: value.style === style ? null : style })}
          />
        ))}
      </Section>

      <Section title={t('closet.season')}>
        {SEASONS.map((season) => (
          <Chip
            key={season}
            label={t(`seasons.${season}`)}
            selected={value.season === season}
            onPress={() => onChange({ season })}
          />
        ))}
      </Section>
    </View>
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
  sections: { gap: spacing.xl },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
