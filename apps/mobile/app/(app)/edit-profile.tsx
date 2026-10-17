import {
  type GenderPreference,
  type Occasion,
  PREFERENCE_LIMITS,
  type Profile,
  type Style,
  type StyleColor,
  STYLE_COLOR_NAMES,
  type UpdateProfileInput,
} from '@vyra/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FormBanner } from '@/features/auth/components';
import { useSession } from '@/features/auth/session-store';
import { CITY_SUGGESTIONS, findCitySuggestion } from '@/features/profile/cities';
import { ColorPicker, GenderPicker, OccasionPicker, StylePicker } from '@/features/profile/pickers';
import { profileApi, profileQueryKey } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/errors';
import {
  Button,
  Chip,
  ErrorState,
  haptics,
  IconButton,
  Screen,
  Skeleton,
  spacing,
  Text,
  TextField,
} from '@/ui';

interface FormState {
  firstName: string;
  lastName: string;
  genderPreference: GenderPreference | null;
  preferredStyles: Style[];
  preferredColors: StyleColor[];
  preferredOccasions: Exclude<Occasion, 'SURPRISE'>[];
  city: string;
  countryCode: string | null;
  timezone: string | null;
}

const isStyleColor = (value: string): value is StyleColor =>
  (STYLE_COLOR_NAMES as readonly string[]).includes(value);

function fromProfile(profile: Profile): FormState {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName ?? '',
    genderPreference: profile.genderPreference,
    preferredStyles: profile.preferredStyles,
    preferredColors: profile.preferredColors.filter(isStyleColor),
    preferredOccasions: profile.preferredOccasions.filter(
      (occasion): occasion is Exclude<Occasion, 'SURPRISE'> => occasion !== 'SURPRISE',
    ),
    city: profile.city ?? '',
    countryCode: profile.countryCode,
    timezone: profile.timezone,
  };
}

function toUpdate(form: FormState): UpdateProfileInput {
  return {
    firstName: form.firstName,
    lastName: form.lastName.trim() ? form.lastName : null,
    ...(form.genderPreference ? { genderPreference: form.genderPreference } : {}),
    preferredStyles: form.preferredStyles,
    preferredColors: form.preferredColors,
    preferredOccasions: form.preferredOccasions,
    city: form.city,
    countryCode: form.countryCode,
    ...(form.timezone ? { timezone: form.timezone } : {}),
  };
}

const isValid = (form: FormState) =>
  form.firstName.trim().length > 0 &&
  form.city.trim().length > 0 &&
  form.preferredStyles.length > 0 &&
  form.preferredColors.length > 0 &&
  form.preferredOccasions.length > 0;

function Header() {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <IconButton
        icon={ArrowLeft}
        accessibilityLabel={t('common.back')}
        onPress={() => router.back()}
      />
      <Text variant="title1" accessibilityRole="header">
        {t('editProfile.title')}
      </Text>
    </View>
  );
}

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const profile = useQuery({ queryKey: profileQueryKey, queryFn: profileApi.get });

  if (profile.data) return <EditProfileForm initial={profile.data} />;

  if (profile.isError) {
    return (
      <Screen testID="edit-profile-screen">
        <Header />
        <ErrorState
          message={errorMessage(profile.error, t)}
          onRetry={() => void profile.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="edit-profile-screen">
      <Header />
      <View style={styles.skeletons}>
        <Skeleton height={54} radius={14} />
        <Skeleton height={54} radius={14} />
        <Skeleton height={180} radius={20} />
        <Skeleton height={120} radius={20} />
      </View>
    </Screen>
  );
}

/** Mounted once the profile is loaded, so the form state is seeded at creation. */
function EditProfileForm({ initial }: { initial: Profile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const [form, setForm] = useState<FormState>(() => fromProfile(initial));

  const save = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (updated) => {
      haptics.success();
      queryClient.setQueryData(profileQueryKey, updated);
      setForm(fromProfile(updated));
      if (user) setUser({ ...user, firstName: updated.firstName, lastName: updated.lastName });
    },
    onError: () => haptics.error(),
  });

  const patch = (value: Partial<FormState>) => {
    save.reset();
    setForm((previous) => ({ ...previous, ...value }));
  };

  return (
    <Screen
      keyboard
      testID="edit-profile-screen"
      footer={
        // Feedback sits next to the button: the user is usually scrolled far from the top.
        <View style={styles.footer}>
          {save.isSuccess && <FormBanner tone="success" message={t('editProfile.saved')} />}
          {save.isError && <FormBanner tone="error" message={errorMessage(save.error, t)} />}
          <Button
            testID="edit-profile-save"
            label={t('editProfile.save')}
            onPress={() => save.mutate(toUpdate(form))}
            loading={save.isPending}
            disabled={!isValid(form)}
          />
        </View>
      }
    >
      <Header />

      <View style={styles.sections}>
        <Section title={t('editProfile.identity')}>
          <TextField
            testID="edit-first-name"
            label={t('auth.fields.firstName')}
            value={form.firstName}
            onChangeText={(firstName) => patch({ firstName })}
            autoCapitalize="words"
            maxLength={60}
          />
        </Section>

        <Section title={t('onboarding.genderTitle')}>
          <GenderPicker
            value={form.genderPreference}
            onChange={(genderPreference) => patch({ genderPreference })}
          />
        </Section>

        <Section title={t('onboarding.stylesTitle')}>
          <StylePicker
            value={form.preferredStyles}
            max={PREFERENCE_LIMITS.styles.max}
            onChange={(preferredStyles) => patch({ preferredStyles })}
          />
        </Section>

        <Section title={t('onboarding.colorsTitle')}>
          <ColorPicker
            value={form.preferredColors}
            max={PREFERENCE_LIMITS.colors.max}
            onChange={(preferredColors) => patch({ preferredColors })}
          />
        </Section>

        <Section title={t('onboarding.occasionsTitle')}>
          <OccasionPicker
            value={form.preferredOccasions}
            max={PREFERENCE_LIMITS.occasions.max}
            onChange={(preferredOccasions) => patch({ preferredOccasions })}
          />
        </Section>

        <Section title={t('onboarding.cityTitle')}>
          <TextField
            testID="edit-city"
            label={t('onboarding.summaryCity')}
            value={form.city}
            onChangeText={(city) => {
              const match = findCitySuggestion(city);
              patch({
                city,
                countryCode: match?.countryCode ?? null,
                ...(match ? { timezone: match.timezone } : {}),
              });
            }}
            autoCapitalize="words"
            maxLength={80}
          />
          <View style={styles.chips}>
            {CITY_SUGGESTIONS.map((city) => (
              <Chip
                key={city.name}
                icon={MapPin}
                label={city.name}
                selected={form.city === city.name}
                onPress={() =>
                  patch({ city: city.name, countryCode: city.countryCode, timezone: city.timezone })
                }
              />
            ))}
          </View>
        </Section>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title3">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  skeletons: { gap: spacing.lg },
  sections: { gap: spacing.xxl },
  section: { gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { gap: spacing.md },
});
