import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  // ─── Guión ────────────────────────────────────────────────────────────────

  /** Obtiene el contenido del guión vinculado al proyecto */
  @Get('/:id/guion')
  getGuion(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projects.getGuionContent(user.userId, id);
  }

  /** Vincula/actualiza el guión pasando el texto en JSON */
  @Post('/:id/guion')
  setGuion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { text: string; name?: string },
  ) {
    if (!body?.text?.trim()) throw new BadRequestException('text is required');
    return this.projects.setGuionContent(user.userId, id, body.text, body.name);
  }

  /**
   * Sube un archivo DOCX / PDF / TXT y extrae el texto automáticamente.
   * Almacena el guión vinculado al proyecto.
   */
  @Post('/:id/guion/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGuion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = ['.docx', '.pdf', '.txt'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      throw new BadRequestException(`Formato no admitido. Usa: ${allowed.join(', ')}`);
    }

    const text = await this.projects.extractTextFromFile(file.buffer, file.originalname);
    if (!text?.trim()) throw new BadRequestException('No se pudo extraer texto del archivo');

    return this.projects.setGuionContent(user.userId, id, text, file.originalname);
  }
}
