import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { ReviewsService, type CreateReviewInput } from './reviews.service'
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('api/v1')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Post('appointments/:id/reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') appointmentId: string,
    @Body() body: CreateReviewInput,
  ) {
    const res = await this.reviews.createReview(user.id, appointmentId, body)
    return { data: res }
  }

  @Get('caregiver/ratings')
  @UseGuards(JwtAuthGuard)
  async getMyRatings(@CurrentUser() user: AuthenticatedUser) {
    const list = await this.reviews.getCaregiverRatings(user.id)
    return { data: list }
  }

  @Get('caregiver/:id/ratings')
  async getCaregiverRatingsPublic(@Param('id') caregiverId: string) {
    const list = await this.reviews.getCaregiverRatings(caregiverId)
    return { data: list }
  }
}
