import { CLOTHING_CATEGORIES, type ClothingCategory, type ClothingItem } from '@vyra/shared';
import { Image } from 'expo-image';
import { Heart, Search, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import {
  Chip,
  colors,
  fontFamily,
  fontSize,
  hitSlop,
  PressableScale,
  radii,
  shadows,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

/** Warm neutral placeholder shown while a photo streams in. */
const IMAGE_PLACEHOLDER = { blurhash: 'L7Q]+w-;~qof%MfQj[fQ~qWBRjj[' };

export function FavoriteButton({
  active,
  onToggle,
  size = 'sm',
  testID,
}: {
  active: boolean;
  onToggle: () => void;
  size?: 'sm' | 'lg';
  testID?: string;
}) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const dimension = size === 'lg' ? 44 : 34;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={active ? t('closet.unfavorite') : t('closet.favorite')}
      accessibilityState={{ selected: active }}
      hitSlop={hitSlop}
      onPress={() => {
        // A little "pop" confirms the tap before the network answers.
        scale.set(withSequence(withSpring(1.25, { damping: 6 }), withSpring(1, { damping: 10 })));
        onToggle();
      }}
      style={[
        styles.favorite,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
      ]}
    >
      <Animated.View style={style}>
        <Heart
          size={size === 'lg' ? 22 : 17}
          color={active ? colors.danger : colors.primary}
          fill={active ? colors.danger : 'transparent'}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  );
}

export function ClothingCard({
  item,
  onPress,
  onToggleFavorite,
}: {
  item: ClothingItem;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.cardWrap}>
      {/* Shadow lives on the outer view: iOS clips shadows of views with overflow hidden. */}
      <View style={styles.cardShadow}>
        <PressableScale
          testID={`closet-item-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${t(`categories.${item.category}`)}`}
          onPress={onPress}
          pressedScale={0.97}
          style={styles.card}
        >
          <View style={styles.imageFrame}>
            <Image
              source={{ uri: item.thumbnailUrl }}
              placeholder={IMAGE_PLACEHOLDER}
              contentFit="cover"
              transition={200}
              recyclingKey={item.id}
              style={styles.image}
              accessibilityIgnoresInvertColors
            />
          </View>
          <View style={styles.cardCopy}>
            <Text variant="callout" numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {t(`categories.${item.category}`)}
            </Text>
          </View>
        </PressableScale>
        {/* A sibling, not a child, of the card button: no nested interactive elements. */}
        <View style={styles.favoriteSlot}>
          <FavoriteButton
            testID={`favorite-${item.id}`}
            active={item.isFavorite}
            onToggle={onToggleFavorite}
          />
        </View>
      </View>
    </Animated.View>
  );
}

export function ClosetGridSkeleton() {
  return (
    <View style={styles.skeletonGrid} testID="closet-skeleton">
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.cardWrap}>
          <Skeleton height={220} radius={radii.lg} />
          <Skeleton height={14} width="70%" style={styles.skeletonLine} />
          <Skeleton height={10} width="40%" style={styles.skeletonLine} />
        </View>
      ))}
    </View>
  );
}

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.search}>
      <Search size={18} color={colors.secondary} />
      <TextInput
        testID="closet-search"
        value={value}
        onChangeText={onChange}
        placeholder={t('closet.searchPlaceholder')}
        placeholderTextColor={colors.secondary}
        accessibilityLabel={t('closet.searchPlaceholder')}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
        maxLength={60}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('closet.clearSearch')}
          hitSlop={hitSlop}
          onPress={() => onChange('')}
        >
          <X size={18} color={colors.secondary} />
        </Pressable>
      )}
    </View>
  );
}

export function CategoryFilters({
  category,
  favorite,
  counts,
  total,
  favorites,
  onCategory,
  onFavorite,
}: {
  category: ClothingCategory | null;
  favorite: boolean;
  counts: Partial<Record<ClothingCategory, number>>;
  total: number | undefined;
  favorites: number | undefined;
  onCategory: (category: ClothingCategory | null) => void;
  onFavorite: (favorite: boolean) => void;
}) {
  const { t } = useTranslation();
  const withCount = (label: string, count: number | undefined) =>
    count === undefined ? label : `${label} · ${count}`;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
      style={styles.filtersScroll}
    >
      <Chip
        testID="filter-all"
        label={withCount(t('closet.all'), total)}
        selected={category === null && !favorite}
        onPress={() => {
          onCategory(null);
          onFavorite(false);
        }}
      />
      <Chip
        testID="filter-favorites"
        icon={Heart}
        label={withCount(t('closet.favorites'), favorites)}
        selected={favorite}
        onPress={() => onFavorite(!favorite)}
      />
      {CLOTHING_CATEGORIES.filter((value) => (counts[value] ?? 0) > 0 || category === value).map(
        (value) => (
          <Chip
            key={value}
            testID={`filter-${value}`}
            label={withCount(t(`categories.${value}`), counts[value])}
            selected={category === value}
            onPress={() => onCategory(category === value ? null : value)}
          />
        ),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardWrap: { flex: 1, padding: spacing.xs + 2 },
  cardShadow: { borderRadius: radii.lg, backgroundColor: colors.surface, ...shadows.card },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden' },
  imageFrame: { aspectRatio: 4 / 5, backgroundColor: colors.muted },
  image: { flex: 1 },
  favoriteSlot: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  favorite: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  cardCopy: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 2 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -(spacing.xs + 2) },
  skeletonLine: { marginTop: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.primary,
    paddingVertical: spacing.sm,
  },
  filtersScroll: { marginHorizontal: -spacing.xl, marginTop: spacing.md },
  filters: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
});
