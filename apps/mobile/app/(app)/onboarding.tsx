import { PREFERENCE_LIMITS, STYLE_COLORS } from '@vyra/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, MapPin, Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSession } from '@/features/auth/session-store';
import { FormBanner } from '@/features/auth/components';
import {
  isStepComplete,
  ONBOARDING_STEPS,
  toOnboardingInput,
  useOnboarding,
} from '@/features/onboarding/onboarding-store';
import { ProgressBar } from '@/features/onboarding/ProgressBar';
import { CITY_SUGGESTIONS, findCitySuggestion } from '@/features/profile/cities';
import { ColorPicker, GenderPicker, OccasionPicker, StylePicker } from '@/features/profile/pickers';
import { profileApi, profileQueryKey } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/errors';
import {
  Button,
  Card,
  Chip,
  colors,
  haptics,
  IconButton,
  radii,
  Screen,
  shadows,
  spacing,
  Text,
  TextField,
} from '@/ui';

/** Question steps shown in the progress bar (welcome and finish are not questions). */
const QUESTION_COUNT = ONBOARDING_STEPS.length - 2;

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const { step, direction, draft, start, next, back, update, reset } = useOnboarding();
  const current = ONBOARDING_STEPS[step] ?? 'welcome';

  useEffect(() => {
    if (user) start(user.firstName);
  }, [start, user]);

  const submit = useMutation({
    mutationFn: profileApi.completeOnboarding,
    onSuccess: (profile) => {
      haptics.success();
      queryClient.setQueryData(profileQueryKey, profile);
      if (user) setUser({ ...user, firstName: profile.firstName, onboardingCompleted: true });
      // The router guard now opens the tabs; clear the draft for a future account.
      reset();
    },
    onError: () => haptics.error(),
  });

  const canContinue = isStepComplete(current, draft);
  const onPrimary = () => {
    if (current !== 'finish') {
      next();
      return;
    }
    const input = toOnboardingInput(draft);
    // The app's current language becomes the account's (AI texts follow it).
    if (input) submit.mutate({ ...input, locale: i18n.language === 'en' ? 'en' : 'fr' });
  };

  const primaryLabel =
    current === 'welcome'
      ? t('onboarding.start')
      : current === 'finish'
        ? t('onboarding.finishCta')
        : t('common.continue');

  const showChrome = current !== 'welcome';
  const entering = (direction > 0 ? FadeInRight : FadeInLeft).duration(320);

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      testID="onboarding-screen"
      footer={
        <Button
          testID="onboarding-primary"
          label={primaryLabel}
          onPress={onPrimary}
          disabled={!canContinue}
          loading={submit.isPending}
          variant={current === 'finish' ? 'accent' : 'primary'}
          icon={current === 'finish' ? Sparkles : undefined}
        />
      }
    >
      {showChrome && (
        <View style={styles.topBar}>
          <IconButton icon={ArrowLeft} accessibilityLabel={t('common.back')} onPress={back} />
          {current !== 'finish' && (
            <>
              <ProgressBar progress={step / QUESTION_COUNT} />
              <Text variant="caption" color="secondary" testID="onboarding-counter">
                {t('onboarding.stepCounter', { current: step, total: QUESTION_COUNT })}
              </Text>
            </>
          )}
        </View>
      )}

      <Animated.View key={current} entering={entering} style={styles.body}>
        {current === 'welcome' && <WelcomeStep />}

        {current === 'name' && (
          <Step title={t('onboarding.nameTitle')} body={t('onboarding.nameBody')}>
            <TextField
              testID="onboarding-first-name"
              label={t('auth.fields.firstName')}
              value={draft.firstName}
              onChangeText={(firstName) => update({ firstName })}
              autoFocus
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="next"
              onSubmitEditing={() => canContinue && next()}
              maxLength={60}
            />
          </Step>
        )}

        {current === 'gender' && (
          <Step title={t('onboarding.genderTitle')} body={t('onboarding.genderBody')}>
            <GenderPicker
              value={draft.genderPreference}
              onChange={(genderPreference) => update({ genderPreference })}
            />
          </Step>
        )}

        {current === 'styles' && (
          <Step
            title={t('onboarding.stylesTitle')}
            body={t('onboarding.stylesBody', { max: PREFERENCE_LIMITS.styles.max })}
            count={[draft.preferredStyles.length, PREFERENCE_LIMITS.styles.max]}
          >
            <StylePicker
              value={draft.preferredStyles}
              max={PREFERENCE_LIMITS.styles.max}
              onChange={(preferredStyles) => update({ preferredStyles })}
            />
          </Step>
        )}

        {current === 'colors' && (
          <Step
            title={t('onboarding.colorsTitle')}
            body={t('onboarding.colorsBody', { max: PREFERENCE_LIMITS.colors.max })}
            count={[draft.preferredColors.length, PREFERENCE_LIMITS.colors.max]}
          >
            <ColorPicker
              value={draft.preferredColors}
              max={PREFERENCE_LIMITS.colors.max}
              onChange={(preferredColors) => update({ preferredColors })}
            />
          </Step>
        )}

        {current === 'occasions' && (
          <Step
            title={t('onboarding.occasionsTitle')}
            body={t('onboarding.occasionsBody', { max: PREFERENCE_LIMITS.occasions.max })}
            count={[draft.preferredOccasions.length, PREFERENCE_LIMITS.occasions.max]}
          >
            <OccasionPicker
              value={draft.preferredOccasions}
              max={PREFERENCE_LIMITS.occasions.max}
              onChange={(preferredOccasions) => update({ preferredOccasions })}
            />
          </Step>
        )}

        {current === 'city' && (
          <Step title={t('onboarding.cityTitle')} body={t('onboarding.cityBody')}>
            <TextField
              testID="onboarding-city"
              label={t('onboarding.summaryCity')}
              placeholder={t('onboarding.cityPlaceholder')}
              value={draft.city}
              onChangeText={(city) => {
                const match = findCitySuggestion(city);
                update({
                  city,
                  countryCode: match?.countryCode ?? null,
                  ...(match ? { timezone: match.timezone } : {}),
                });
              }}
              autoCapitalize="words"
              autoComplete="postal-address-locality"
              textContentType="addressCity"
              returnKeyType="done"
              onSubmitEditing={() => canContinue && next()}
              maxLength={80}
            />
            <Text variant="overline" color="secondary" style={styles.suggestionsLabel}>
              {t('onboarding.suggestions')}
            </Text>
            <View style={styles.chips}>
              {CITY_SUGGESTIONS.map((city) => (
                <Chip
                  key={city.name}
                  testID={`city-${city.name}`}
                  icon={MapPin}
                  label={city.name}
                  selected={draft.city === city.name}
                  onPress={() =>
                    update({
                      city: city.name,
                      countryCode: city.countryCode,
                      timezone: city.timezone,
                    })
                  }
                />
              ))}
            </View>
          </Step>
        )}

        {current === 'finish' && (
          <FinishStep>
            {submit.isError && <FormBanner tone="error" message={errorMessage(submit.error, t)} />}
          </FinishStep>
        )}
      </Animated.View>
    </Screen>
  );
}

function Step({
  title,
  body,
  count,
  children,
}: {
  title: string;
  body: string;
  count?: [number, number];
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.stepBodyRow}>
          <Text variant="body" color="secondary" style={styles.flex}>
            {body}
          </Text>
          {count && (
            <Text variant="caption" color={count[0] > 0 ? 'primary' : 'secondary'}>
              {t('onboarding.selectedCount', { count: count[0], max: count[1] })}
            </Text>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

function WelcomeStep() {
  const { t } = useTranslation();
  return (
    <View style={styles.welcome}>
      <Animated.View entering={ZoomIn.duration(500)} style={styles.welcomeHalo}>
        <LinearGradient
          colors={['#C8AE86', colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeBadge}
        >
          <Sparkles size={34} color={colors.onPrimary} strokeWidth={1.8} />
        </LinearGradient>
      </Animated.View>
      <View style={styles.welcomeCopy}>
        <Text variant="overline" color="secondary" align="center">
          {t('onboarding.welcomeOverline')}
        </Text>
        <Text variant="display" align="center">
          {t('onboarding.welcomeTitle')}
        </Text>
        <Text variant="callout" color="secondary" align="center">
          {t('onboarding.welcomeBody')}
        </Text>
      </View>
    </View>
  );
}

function FinishStep({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const draft = useOnboarding((state) => state.draft);

  return (
    <View style={styles.step}>
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.doneBadge}>
        <Check size={30} color={colors.onPrimary} strokeWidth={2.6} />
      </Animated.View>
      <View style={styles.stepHeader}>
        <Text variant="title1" accessibilityRole="header">
          {t('onboarding.finishTitle', { name: draft.firstName.trim() })}
        </Text>
        <Text variant="body" color="secondary">
          {t('onboarding.finishBody')}
        </Text>
      </View>

      {children}

      <Animated.View entering={FadeIn.delay(200).duration(400)}>
        <Card style={styles.summary}>
          <SummaryRow label={t('onboarding.summaryStyles')}>
            <Text variant="callout">
              {draft.preferredStyles.map((style) => t(`styles.${style}`)).join(' · ')}
            </Text>
          </SummaryRow>
          <SummaryRow label={t('onboarding.summaryColors')}>
            <View style={styles.dots}>
              {draft.preferredColors.map((color) => (
                <View
                  key={color}
                  accessibilityLabel={t(`colors.${color}`)}
                  style={[styles.dot, { backgroundColor: STYLE_COLORS[color] }]}
                />
              ))}
            </View>
          </SummaryRow>
          <SummaryRow label={t('onboarding.summaryOccasions')}>
            <Text variant="callout">
              {draft.preferredOccasions.map((occasion) => t(`occasions.${occasion}`)).join(' · ')}
            </Text>
          </SummaryRow>
          <SummaryRow label={t('onboarding.summaryCity')} last>
            <Text variant="callout">{draft.city.trim()}</Text>
          </SummaryRow>
        </Card>
      </Animated.View>
    </View>
  );
}

function SummaryRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryDivider]}>
      <Text variant="overline" color="secondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  body: { flex: 1 },
  flex: { flex: 1 },
  step: { gap: spacing.xl },
  stepHeader: { gap: spacing.sm },
  stepBodyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  suggestionsLabel: { marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    minHeight: 480,
  },
  welcomeHalo: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(183, 155, 114, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
  welcomeCopy: { gap: spacing.md, paddingHorizontal: spacing.sm },
  doneBadge: {
    marginTop: spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { gap: 0, paddingVertical: spacing.sm },
  summaryRow: { gap: spacing.xs, paddingVertical: spacing.md },
  summaryDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dots: { flexDirection: 'row', gap: spacing.xs + 2 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
});
