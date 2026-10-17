import { router } from 'expo-router';
import { ArrowLeft, CircleAlert, CircleCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, colorsAlpha, IconButton, radii, spacing, Text } from '@/ui';

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      {router.canGoBack() && (
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
        />
      )}
      <Animated.View entering={FadeInDown.duration(380)} style={styles.headerCopy}>
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
        {subtitle && (
          <Text variant="body" color="secondary">
            {subtitle}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

export function FormBanner({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.banner, tone === 'error' ? styles.bannerError : styles.bannerSuccess]}
      testID={`form-banner-${tone}`}
    >
      <Icon size={18} color={tone === 'error' ? colors.danger : colors.success} />
      <Text
        variant="footnote"
        color={tone === 'error' ? 'danger' : 'success'}
        style={styles.bannerText}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  headerCopy: { gap: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  bannerError: { backgroundColor: colorsAlpha.dangerSoft },
  bannerSuccess: { backgroundColor: colorsAlpha.successSoft },
  bannerText: { flex: 1 },
});
