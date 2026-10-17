import { STYLE_COLORS } from '@vyra/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CalendarDays, Layers, Pencil, Repeat, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteButton } from '@/features/closet/components';
import { useClothingItem, useDeleteItem, useToggleFavorite } from '@/features/closet/hooks';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  ErrorState,
  IconButton,
  radii,
  Screen,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

function confirm(title: string, message: string, confirmLabel: string, cancelLabel: string) {
  if (Platform.OS === 'web')
    return Promise.resolve(globalThis.confirm?.(`${title}\n${message}`) ?? true);
  return new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function ClothingItemScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useClothingItem(id);
  const toggleFavorite = useToggleFavorite();
  const remove = useDeleteItem();

  const back = (
    <IconButton
      icon={ArrowLeft}
      accessibilityLabel={t('common.back')}
      onPress={() => goBackOr('/closet')}
    />
  );

  if (item.isPending || item.isError) {
    return (
      <Screen testID="item-screen">
        <View style={styles.plainHeader}>{back}</View>
        {item.isError ? (
          <ErrorState message={errorMessage(item.error, t)} onRetry={() => void item.refetch()} />
        ) : (
          <View style={styles.loading}>
            <Skeleton height={380} radius={radii.xl} />
            <Skeleton height={28} width="60%" />
            <Skeleton height={16} width="40%" />
          </View>
        )}
      </Screen>
    );
  }

  const data = item.data;
  const swatch =
    data.colorHex ?? STYLE_COLORS[data.color as keyof typeof STYLE_COLORS] ?? colors.muted;
  const colorLabel =
    data.color in STYLE_COLORS
      ? t(`colors.${data.color as keyof typeof STYLE_COLORS}`)
      : data.color;

  const onDelete = async () => {
    const confirmed = await confirm(
      t('closet.deleteConfirm', { name: data.name }),
      t('closet.deleteHint'),
      t('closet.delete'),
      t('common.cancel'),
    );
    if (!confirmed) return;
    remove.mutate(data.id, { onSuccess: () => goBackOr('/closet') });
  };

  return (
    <View style={styles.screen} testID="item-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
      >
        <View style={styles.hero}>
          <Image
            source={{ uri: data.imageUrl }}
            placeholder={{ uri: data.thumbnailUrl }}
            contentFit="cover"
            transition={250}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={data.name}
          />
          <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
            {back}
            <FavoriteButton
              testID="item-favorite"
              size="lg"
              active={data.isFavorite}
              onToggle={() => toggleFavorite.mutate({ id: data.id, isFavorite: !data.isFavorite })}
            />
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(320)} style={styles.body}>
          <View style={styles.titleBlock}>
            <Text variant="overline" color="secondary">
              {t(`categories.${data.category}`)}
              {data.subcategory ? ` · ${data.subcategory}` : ''}
            </Text>
            <Text variant="title1" accessibilityRole="header">
              {data.name}
            </Text>
          </View>

          <Card style={styles.details}>
            <DetailRow label={t('closet.color')}>
              <View style={styles.colorValue}>
                <View style={[styles.swatch, { backgroundColor: swatch }]} />
                <Text variant="callout">{colorLabel}</Text>
              </View>
            </DetailRow>
            <DetailRow label={t('closet.style')}>
              <Text variant="callout">
                {data.style ? t(`styles.${data.style}`) : t('closet.notSet')}
              </Text>
            </DetailRow>
            <DetailRow label={t('closet.season')} last>
              <Text variant="callout">{t(`seasons.${data.season}`)}</Text>
            </DetailRow>
          </Card>

          <Text variant="overline" color="secondary">
            {t('closet.stats')}
          </Text>
          <View style={styles.stats}>
            <Stat icon={Layers} label={t('closet.inOutfits', { count: data.stats.outfitCount })} />
            <Stat icon={Repeat} label={t('closet.worn', { count: data.stats.wearCount })} />
            <Stat
              icon={CalendarDays}
              label={
                data.stats.lastWornAt
                  ? t('closet.lastWorn', {
                      date: new Date(data.stats.lastWornAt).toLocaleDateString(i18n.language, {
                        day: 'numeric',
                        month: 'long',
                      }),
                    })
                  : t('closet.neverWorn')
              }
            />
          </View>

          {remove.isError && (
            <Text variant="footnote" color="danger" align="center">
              {errorMessage(remove.error, t)}
            </Text>
          )}

          <View style={styles.actions}>
            <Button
              testID="item-edit"
              label={t('closet.edit')}
              icon={Pencil}
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/closet/[id]/edit', params: { id: data.id } })
              }
            />
            <Button
              testID="item-delete"
              label={t('closet.delete')}
              icon={Trash2}
              variant="ghost"
              loading={remove.isPending}
              onPress={onDelete}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text variant="footnote" color="secondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Stat({ icon: Icon, label }: { icon: typeof Layers; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Icon size={16} color={colors.primary} strokeWidth={1.9} />
      </View>
      <Text variant="footnote" style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  plainHeader: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  loading: { gap: spacing.lg },
  hero: {
    aspectRatio: 4 / 5,
    maxHeight: 560,
    backgroundColor: colors.muted,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: 'hidden',
  },
  heroBar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.lg },
  titleBlock: { gap: spacing.xs },
  details: { paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  colorValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  stats: { gap: spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
