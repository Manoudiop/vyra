import { Injectable } from '@nestjs/common';
import { type CompleteOnboardingInput, type Profile, type UpdateProfileInput } from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

const PROFILE_SELECT = {
  firstName: true,
  lastName: true,
  profile: true,
  stylePreference: {
    select: { preferredStyles: true, preferredColors: true, preferredOccasions: true },
  },
} as const;

/**
 * Profile + declared style preferences. Always scoped to the caller's own id;
 * there is no way to address another user's profile.
 */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async get(userId: string): Promise<Profile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new AppException('AUTH_REQUIRED', 'Authentication required');

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      genderPreference: user.profile?.genderPreference ?? null,
      city: user.profile?.city ?? null,
      countryCode: user.profile?.countryCode ?? null,
      timezone: user.profile?.timezone ?? 'UTC',
      locale: user.profile?.locale ?? 'fr',
      notificationsEnabled: user.profile?.notificationsEnabled ?? true,
      analyticsEnabled: user.profile?.analyticsEnabled ?? true,
      onboardingCompleted: user.profile?.onboardingCompletedAt != null,
      preferredStyles: user.stylePreference?.preferredStyles ?? [],
      preferredColors: user.stylePreference?.preferredColors ?? [],
      preferredOccasions: user.stylePreference?.preferredOccasions ?? [],
    };
  }

  /** Saves the whole onboarding atomically and marks it complete (idempotent). */
  async completeOnboarding(userId: string, input: CompleteOnboardingInput): Promise<Profile> {
    const profile = {
      genderPreference: input.genderPreference,
      city: input.city,
      countryCode: input.countryCode ?? null,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    };
    const preferences = {
      preferredStyles: input.preferredStyles,
      preferredColors: input.preferredColors,
      preferredOccasions: input.preferredOccasions,
    };

    let firstCompletion = false;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { firstName: input.firstName } });
      const existing = await tx.profile.findUnique({
        where: { userId },
        select: { onboardingCompletedAt: true },
      });
      firstCompletion = !existing?.onboardingCompletedAt;
      await tx.profile.upsert({
        where: { userId },
        create: { userId, ...profile, onboardingCompletedAt: new Date() },
        // Re-submitting keeps the original completion date.
        update: {
          ...profile,
          onboardingCompletedAt: existing?.onboardingCompletedAt ?? new Date(),
        },
      });
      await tx.stylePreference.upsert({
        where: { userId },
        create: { userId, ...preferences },
        update: preferences,
      });
    });

    if (firstCompletion) {
      this.analytics.track(userId, 'onboarding_completed', {
        styles: input.preferredStyles.length,
        colors: input.preferredColors.length,
        occasions: input.preferredOccasions.length,
      });
    }
    return this.get(userId);
  }

  async update(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const { firstName, lastName, preferredStyles, preferredColors, preferredOccasions, ...rest } =
      input;
    const profile = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );
    const preferences = Object.fromEntries(
      Object.entries({ preferredStyles, preferredColors, preferredOccasions }).filter(
        ([, value]) => value !== undefined,
      ),
    );

    await this.prisma.$transaction(async (tx) => {
      if (firstName !== undefined || lastName !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(firstName !== undefined ? { firstName } : {}),
            ...(lastName !== undefined ? { lastName } : {}),
          },
        });
      }
      if (Object.keys(profile).length > 0) {
        await tx.profile.upsert({
          where: { userId },
          create: { userId, ...profile },
          update: profile,
        });
      }
      if (Object.keys(preferences).length > 0) {
        await tx.stylePreference.upsert({
          where: { userId },
          create: { userId, ...preferences },
          update: preferences,
        });
      }
    });

    return this.get(userId);
  }
}
