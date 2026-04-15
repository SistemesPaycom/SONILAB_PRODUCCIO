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
  HttpCode,
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

  /** Lista TODOS los proyectos (todos los usuarios comparten el espacio) */
  @Get()
  list() {
    return this.projects.listProjects();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projects.createProject(user.userId, dto.name, dto.mediaDocumentId, dto.settings ?? {});
  }

  @Post('/from-existing')
  createFromExisting(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectFromExistingDto) {
    return this.projects.createProjectFromExisting(user.userId, dto);
  }

  // ✅ IMPORTANTE: estas rutas deben ir ANTES que /:id

  /** Opcions per al corrector de transcripció (LLM models, modes, defaults) */
  @Get('/correction/options')
  getCorrectionOptions() {
    return {
      llmModes: [
        { value: 'off', label: 'Només fuzzy matching (ràpid, sense LLM)' },
        { value: 'fast', label: 'LLM per casos ambigus (equilibrat)' },
        { value: 'smart', label: 'LLM complet — màxima qualitat (lent)' },
      ],
      llmModels: [
        { value: 'llama3.1', label: 'Llama 3.1 8B (recomanat)' },
        { value: 'qwen2.5', label: 'Qwen 2.5 7B' },
        { value: 'mistral', label: 'Mistral 7B' },
      ],
      defaults: {
        llmMode: 'off',
        llmModel: 'llama3.1',
        threshold: 0.45,
        window: 8,
      },
    };
  }

  @Get('/by-srt/:srtDocumentId')
  getBySrt(@Param('srtDocumentId') srtDocumentId: string) {
    return this.projects.getProjectBySrt(srtDocumentId);
  }

  @Get('/:id')
  get(@Param('id') id: string) {
    return this.projects.getProject(id);
  }

  // ─── Guión ────────────────────────────────────────────────────────────────

  @Get('/:id/guion')
  getGuion(@Param('id') id: string) {
    return this.projects.getGuionContent(id);
  }

  @Post('/:id/guion')
  setGuion(
    @Param('id') id: string,
    @Body() body: { text: string; name?: string },
  ) {
    if (!body?.text?.trim()) throw new BadRequestException('text is required');
    return this.projects.setGuionContent(id, body.text, body.name);
  }

  @Post('/:id/guion/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGuion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = ['.docx', '.rtf', '.pdf', '.txt'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      throw new BadRequestException(`Format no admès. Usa: ${allowed.join(', ')}`);
    }

    const text = await this.projects.extractTextFromFile(file.buffer, file.originalname);
    if (!text?.trim()) throw new BadRequestException('No se pudo extraer texto del archivo');

    return this.projects.setGuionContent(id, text, file.originalname);
  }

  // ─── Correcció de transcripció ─────────────────────────────────────────────

  /**
   * Corregeix el text de la transcripció SRT usant el guió vinculat.
   * Retorna SRT corregit + llista de canvis (JSON). No modifica el projecte.
   */
  @Post('/:id/correct-transcript')
  @HttpCode(200)
  async correctTranscript(
    @Param('id') id: string,
    @Body() body: { threshold?: number; window?: number; llmMode?: string; llmModel?: string; allowSplit?: boolean; method?: string } = {},
  ) {
    return this.projects.correctTranscript(id, {
      threshold: body.threshold,
      window: body.window,
      llmMode: body.llmMode,
      llmModel: body.llmModel,
      allowSplit: body.allowSplit,
      method: body.method,
    });
  }

  /**
   * Aplica un SRT corregit al projecte (sobreescriu el document SRT actual).
   * Cridar NOMÉS si l'usuari ha revisat i confirmat els canvis.
   */
  @Post('/:id/apply-correction')
  @HttpCode(200)
  async applyCorrection(
    @Param('id') id: string,
    @Body() body: { correctedSrt: string },
  ) {
    if (!body?.correctedSrt?.trim()) {
      throw new BadRequestException('correctedSrt is required');
    }
    await this.projects.applyCorrectedSrt(id, body.correctedSrt);
    return { ok: true };
  }
}
