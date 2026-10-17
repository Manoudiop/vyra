import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { authApi } from '@/features/auth/auth-api';
import { AuthHeader, FormBanner } from '@/features/auth/components';
import { type ForgotForm, makeAuthSchemas } from '@/features/auth/form-schemas';
import { errorMessage } from '@/lib/errors';
import { Button, Screen, spacing, TextField } from '@/ui';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const schema = useMemo(() => makeAuthSchemas(t).forgot, [t]);

  const { control, handleSubmit } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.email ?? '' },
  });

  const request = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (_data, { email }) =>
      router.push({ pathname: '/reset-password', params: { email } }),
  });

  const submit = handleSubmit((values) => request.mutate({ email: values.email.toLowerCase() }));

  return (
    <Screen keyboard edges={['top', 'bottom']} testID="forgot-screen">
      <AuthHeader title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} />
      <View style={styles.form}>
        {request.isError && <FormBanner tone="error" message={errorMessage(request.error, t)} />}
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              testID="forgot-email"
              label={t('auth.fields.email')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={submit}
            />
          )}
        />
        <Button
          testID="forgot-submit"
          label={t('auth.forgot.submit')}
          loading={request.isPending}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.lg } });
