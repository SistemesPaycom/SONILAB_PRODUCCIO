import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}
