import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';
import { CreateProjectFromExistingDto } from './dto/create-project-from-existing.dto';

@UseGuards(JwtAuthGuard)
@Controller('/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // ✅ NUEVO: listado
  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projects.listProjects(user.userId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projects.createProject(user.userId, dto.name, dto.mediaDocumentId, dto.settings ?? {});
  }

  @Post('/from-existing')
  createFromExisting(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectFromExistingDto) {
    return this.projects.createProjectFromExisting(
      user.userId,
      dto.name,
      dto.mediaDocumentId,
      dto.srtText,
      dto.settings ?? {},
    );
  }

  // ✅ IMPORTANTE: esta ruta debe ir ANTES que /:id
  @Get('/by-srt/:srtDocumentId')
  getBySrt(@CurrentUser() user: RequestUser, @Param('srtDocumentId') srtDocumentId: string) {
    return this.projects.getProjectBySrt(user.userId, srtDocumentId);
  }

  @Get('/:id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projects.getProject(user.userId, id);
  }
}