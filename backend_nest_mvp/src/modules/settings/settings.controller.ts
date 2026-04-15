import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';

@Controller('/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('/global-styles')
  async getGlobalStyles() {
    return this.settingsService.getGlobalStyles();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('/global-styles')
  async updateGlobalStyles(
    @Body() body: { scope: 'scriptEditor' | 'subtitleEditor' | 'home'; styles: any },
  ) {
    await this.settingsService.updateGlobalStylesScope(body.scope, body.styles);
    return { ok: true };
  }

  // ── Whisper presets (per-user) ──────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('/whisper-presets')
  async getWhisperPresets(@CurrentUser() user: RequestUser) {
    return this.userSettingsService.getWhisperPresets(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('/whisper-presets')
  async saveWhisperPreset(
    @CurrentUser() user: RequestUser,
    @Body() body: { name: string; config: any },
  ) {
    await this.userSettingsService.saveWhisperPreset(user.userId, body.name, body.config);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/whisper-presets/:name')
  async deleteWhisperPreset(
    @CurrentUser() user: RequestUser,
    @Param('name') name: string,
  ) {
    await this.userSettingsService.deleteWhisperPreset(user.userId, name);
    return { ok: true };
  }
}
