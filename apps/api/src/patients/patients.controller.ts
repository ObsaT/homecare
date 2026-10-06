import { Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from '@nestjs/common'
import { PatientsService, type CreatePatientInput } from './patients.service'
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'

@Controller('api/v1/patients')
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(@Inject(PatientsService) private readonly patients: PatientsService) {}

  @Get()
  async listPatients(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.patients.listPatients(user.id) }
  }

  @Post()
  async createPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePatientInput,
  ) {
    return { data: await this.patients.createPatient(user.id, body) }
  }

  @Get(':id')
  async getPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const patient = await this.patients.getPatient(user.id, id)
    if (!patient) {
      throw new NotFoundException('Patient not found')
    }
    return { data: patient }
  }
}
