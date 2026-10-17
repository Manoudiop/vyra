import { describe, expect, it } from 'vitest';
import { loginSchema, passwordSchema, registerSchema, resetPasswordSchema } from './auth';

describe('auth schemas', () => {
  it('normalizes emails to lower case without surrounding spaces', () => {
    const parsed = registerSchema.parse({
      email: '  Amina@VYRA.dev ',
      password: 'secret123',
      firstName: ' Amina ',
    });
    expect(parsed.email).toBe('amina@vyra.dev');
    expect(parsed.firstName).toBe('Amina');
  });

  it('enforces the password policy on registration only', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('letters123').success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('requires a 6-digit reset code', () => {
    const base = { email: 'a@b.co', newPassword: 'letters123' };
    expect(resetPasswordSchema.safeParse({ ...base, code: '12345' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, code: '12a456' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, code: '012345' }).success).toBe(true);
  });
});
