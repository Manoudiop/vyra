import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type TextInput, View } from 'react-native';
import { authApi } from '@/features/auth/auth-api';
import { AuthHeader, FormBanner } from '@/features/auth/components';
import { makeAuthSchemas, type ResetForm } from '@/features/auth/form-schemas';
import { errorMessage } from '@/lib/errors';
import { Button, haptics, Screen, spacing, TextField } from '@/ui';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const schema = useMemo(() => makeAuthSchemas(t).reset, [t]);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', newPassword: '' },
  });

  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      haptics.success();
      // Every session was revoked server-side: start clean on the login screen.
      router.dismissTo({ pathname: '/login', params: { reset: '1' } });
    },
    onError: () => haptics.error(),
  });

  const resend = useMutation({ mutationFn: () => authApi.forgotPassword({ email }) });

  const submit = handleSubmit((values) => reset.mutate({ email, ...values }));

  return (
    <Screen keyboard edges={['top', 'bottom']} testID="reset-screen">
      <AuthHeader title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle', { email })} />
      <View style={styles.form}>
        {reset.isError && <FormBanner tone="error" message={errorMessage(reset.error, t)} />}
        {resend.isSuccess && !reset.isError && (
          <FormBanner tone="success" message={t('auth.reset.resent')} />
        )}
        <Controller
          control={control}
          name="code"
          render={({ field, fieldState }) => (
            <TextField
              testID="reset-code"
              label={t('auth.fields.code')}
              value={field.value}
              onChangeText={(text) => field.onChange(text.replace(/\D/g, '').slice(0, 6))}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="newPassword"
          render={({ field, fieldState }) => (
            <TextField
              ref={passwordRef}
              testID="reset-password"
              label={t('auth.fields.newPassword')}
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
          testID="reset-submit"
          label={t('auth.reset.submit')}
          loading={reset.isPending}
          onPress={submit}
        />
        <Button
          label={t('auth.reset.resend')}
          variant="ghost"
          size="md"
          loading={resend.isPending}
          onPress={() => resend.mutate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.lg } });
