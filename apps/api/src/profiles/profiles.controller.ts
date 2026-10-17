import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  completeOnboardingSchema,
  type Profile,
  profileSchema,
  updateProfileSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { ProfilesService } from './profiles.service';

class ProfileDto extends createZodDto(profileSchema) {}
class CompleteOnboardingDto extends createZodDto(completeOnboardingSchema) {}
class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

@ApiTags('profile')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'AUTH_REQUIRED' })
@Controller('profile')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Profile and declared style preferences of the signed-in user' })
  @ApiOkResponse({ type: ProfileDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<Profile> {
    return this.profiles.get(user.id);
  }

  @Put('onboarding')
  @ApiOperation({
    summary: 'Submit the onboarding answers and mark onboarding complete',
    description:
      'Atomic and idempotent: re-submitting overwrites answers, keeps the completion date.',
  })
  @ApiOkResponse({ type: ProfileDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR' })
  completeOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CompleteOnboardingDto,
  ): Promise<Profile> {
    return this.profiles.completeOnboarding(user.id, body);
  }

  @Patch()
  @ApiOperation({ summary: 'Edit any subset of the profile and style preferences' })
  @ApiOkResponse({ type: ProfileDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateProfileDto): Promise<Profile> {
    return this.profiles.update(user.id, body);
  }
}
