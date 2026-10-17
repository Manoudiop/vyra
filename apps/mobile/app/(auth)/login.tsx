import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type TextInput, View } from 'react-native';
import { authApi } from '@/features/auth/auth-api';
import { AuthHeader, FormBanner } from '@/features/auth/components';
import { type LoginForm, makeAuthSchemas } from '@/features/auth/form-schemas';
import { useSession } from '@/features/auth/session-store';
import { errorMessage } from '@/lib/errors';
import { Button, haptics, Screen, spacing, Text, TextField } from '@/ui';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const signIn = useSession((state) => state.signIn);
  const schema = useMemo(() => makeAuthSchemas(t).login, [t]);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit, getValues } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (session) => {
      haptics.success();
      await signIn(session);
    },
    onError: () => haptics.error(),
  });

  const submit = handleSubmit((values) => login.mutate(values));

  return (
    <Screen keyboard edges={['top', 'bottom']} testID="login-screen">
      <AuthHeader title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />

      <View style={styles.form}>
        {reset === '1' && !login.isError && (
          <FormBanner tone="success" message={t('auth.reset.success')} />
        )}
        {login.isError && (
          <FormBanner
            tone="error"
            message={errorMessage(login.error, t, {
              AUTH_REQUIRED: t('auth.login.invalidCredentials'),
            })}
          />
        )}

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              testID="login-email"
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
              testID="login-password"
              label={t('auth.fields.password')}
              password
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />

        <Button
          label={t('auth.login.forgot')}
          variant="ghost"
          size="md"
          fullWidth={false}
          style={styles.forgot}
          onPress={() =>
            router.push({ pathname: '/forgot-password', params: { email: getValues('email') } })
          }
        />

        <Button
          testID="login-submit"
          label={t('auth.login.submit')}
          loading={login.isPending}
          onPress={submit}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="footnote" color="secondary">
          {t('auth.login.noAccount')}
        </Text>
        <Link href="/register" replace>
          <Text variant="footnote" style={styles.link}>
            {t('auth.login.register')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.sm, paddingHorizontal: spacing.xs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },
  link: { textDecorationLine: 'underline' },
});
