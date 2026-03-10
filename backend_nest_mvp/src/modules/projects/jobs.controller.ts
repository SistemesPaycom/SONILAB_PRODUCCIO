import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { SkipThrottle } from '@nestjs/throttler';

@UseGuards(JwtAuthGuard)
@Controller('/jobs')
export class JobsController {
  constructor(private readonly projects: ProjectsService) {}

  /** Cualquier usuario autenticado puede ver el estado de cualquier job (cola compartida) */
  @SkipThrottle()
  @Get('/:id')
  get(@Param('id') id: string) {
    return this.projects.getJob(id);
  }
}
