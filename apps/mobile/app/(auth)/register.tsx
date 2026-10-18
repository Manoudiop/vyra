import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type TextInput, View } from 'react-native';
import { authApi } from '@/features/auth/auth-api';
import { AuthHeader, FormBanner } from '@/features/auth/components';
import { makeAuthSchemas, type RegisterForm } from '@/features/auth/form-schemas';
import { useSession } from '@/features/auth/session-store';
import { errorMessage } from '@/lib/errors';
import { Button, haptics, Screen, spacing, Text, TextField } from '@/ui';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const signIn = useSession((state) => state.signIn);
  const schema = useMemo(() => makeAuthSchemas(t).register, [t]);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', email: '', password: '' },
  });

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (session) => {
      haptics.success();
      await signIn(session);
    },
    onError: () => haptics.error(),
  });

  const submit = handleSubmit((values) => register.mutate(values));

  return (
    <Screen keyboard edges={['top', 'bottom']} testID="register-screen">
      <AuthHeader title={t('auth.register.title')} subtitle={t('auth.register.subtitle')} />

      <View style={styles.form}>
        {register.isError && (
          <FormBanner
            tone="error"
            message={errorMessage(register.error, t, { CONFLICT: t('auth.register.emailTaken') })}
          />
        )}

        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <TextField
              testID="register-first-name"
              label={t('auth.fields.firstName')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              ref={emailRef}
              testID="register-email"
              label={t('auth.fields.email')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              ref={passwordRef}
              testID="register-password"
              label={t('auth.fields.password')}
              password
              hint={t('auth.register.passwordHint')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />

        <Button
          testID="register-submit"
          label={t('auth.register.submit')}
          loading={register.isPending}
          onPress={submit}
          style={styles.submit}
        />
        <Text variant="caption" color="secondary" align="center">
          {t('auth.register.terms')}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text variant="footnote" color="secondary">
          {t('auth.register.hasAccount')}
        </Text>
        <Link href="/login" replace>
          <Text variant="footnote" style={styles.link}>
            {t('auth.register.login')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },
  link: { textDecorationLine: 'underline' },
});
