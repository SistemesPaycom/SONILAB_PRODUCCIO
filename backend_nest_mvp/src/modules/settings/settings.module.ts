import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalSettings, GlobalSettingsSchema } from './settings.schema';
import { UserSettings, UserSettingsSchema } from './user-settings.schema';
import { SettingsService } from './settings.service';
import { UserSettingsService } from './user-settings.service';
import { SettingsController } from './settings.controller';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GlobalSettings.name, schema: GlobalSettingsSchema },
      { name: UserSettings.name, schema: UserSettingsSchema },
    ]),
  ],
  providers: [SettingsService, UserSettingsService, RolesGuard],
  controllers: [SettingsController],
  exports: [SettingsService, UserSettingsService],
})
export class SettingsModule {}
