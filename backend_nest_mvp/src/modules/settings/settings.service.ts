import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GlobalSettings, GlobalSettingsDocument } from './settings.schema';

const SETTING_KEY = 'global';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(GlobalSettings.name)
    private readonly settingsModel: Model<GlobalSettingsDocument>,
  ) {}

  async getGlobalStyles(): Promise<{
    scriptEditor?: any;
    subtitleEditor?: any;
    home?: any;
  } | null> {
    const doc = await this.settingsModel
      .findOne({ settingKey: SETTING_KEY })
      .lean();
    const styles = (doc as any)?.userStyles;
    if (!styles || Object.keys(styles).length === 0) return null;
    return styles;
  }

  async updateGlobalStylesScope(
    scope: 'scriptEditor' | 'subtitleEditor' | 'home',
    styles: any,
  ): Promise<void> {
    await this.settingsModel.findOneAndUpdate(
      { settingKey: SETTING_KEY },
      { $set: { [`userStyles.${scope}`]: styles } },
      { upsert: true, new: true },
    );
  }
}
