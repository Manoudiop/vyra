import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type CheckoutResponse,
  checkoutRequestSchema,
  checkoutResponseSchema,
  type PlanOffer,
  planOfferSchema,
  type Subscription,
  subscriptionSchema,
} from '@vyra/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { type AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

class PlanOffersDto extends createZodDto(z.array(planOfferSchema)) {}
class SubscriptionDto extends createZodDto(subscriptionSchema) {}
class CheckoutRequestDto extends createZodDto(checkoutRequestSchema) {}
class CheckoutResponseDto extends createZodDto(checkoutResponseSchema) {}

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Plans, monthly prices in FCFA and what each unlocks' })
  @ApiOkResponse({ type: PlanOffersDto })
  plans(): PlanOffer[] {
    return this.subscriptions.offers();
  }

  @Get('me')
  @ApiOperation({ summary: 'Current subscription (effective plan, period, cancellation)' })
  @ApiOkResponse({ type: SubscriptionDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<Subscription> {
    return this.subscriptions.get(user.id);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Subscribe to PRO or PREMIUM (or switch between them)',
    description:
      'Mock billing (MVP): the payment is simulated and the plan is active at once. ' +
      'A real provider may answer PENDING with a paymentUrl.',
  })
  @ApiOkResponse({ type: CheckoutResponseDto })
  @ApiConflictResponse({ description: 'CONFLICT — ALREADY_SUBSCRIBED' })
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CheckoutRequestDto,
  ): Promise<CheckoutResponse> {
    const { email } = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true },
    });
    return this.subscriptions.checkout(user.id, email, body.plan);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop renewing; the plan stays until the end of the paid month' })
  @ApiOkResponse({ type: SubscriptionDto })
  @ApiConflictResponse({ description: 'CONFLICT — NOTHING_TO_CANCEL' })
  cancel(@CurrentUser() user: AuthenticatedUser): Promise<Subscription> {
    return this.subscriptions.cancel(user.id);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo a cancellation before the paid month ends' })
  @ApiOkResponse({ type: SubscriptionDto })
  @ApiConflictResponse({ description: 'CONFLICT — NOTHING_TO_RESUME' })
  resume(@CurrentUser() user: AuthenticatedUser): Promise<Subscription> {
    return this.subscriptions.resume(user.id);
  }
}
