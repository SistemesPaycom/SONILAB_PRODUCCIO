import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { ProjectsService } from './projects.service';
import { SkipThrottle } from '@nestjs/throttler';

@UseGuards(JwtAuthGuard)
@Controller('/jobs')
export class JobsController {
  constructor(private readonly projects: ProjectsService) {}
  @SkipThrottle()
  @Get('/:id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projects.getJob(user.userId, id);
  }
}
