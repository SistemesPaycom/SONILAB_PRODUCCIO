import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { SkipThrottle } from '@nestjs/throttler';

@UseGuards(JwtAuthGuard)
@Controller('/jobs')
export class JobsController {
  constructor(private readonly projects: ProjectsService) {}

  /**
   * Llista tots els jobs (amb info del projecte).
   * Query params opcionals: ?limit=50&status=active|queued|processing|done|error
   */
  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.projects.listJobs({
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status || undefined,
    });
  }

  /** Obtenir un job individual per ID */
  @SkipThrottle()
  @Get('/:id')
  get(@Param('id') id: string) {
    return this.projects.getJob(id);
  }
}
