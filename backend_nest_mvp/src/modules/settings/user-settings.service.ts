import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSettings, UserSettingsDocument, WhisperConfig } from './user-settings.schema';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectModel(UserSettings.name)
    private readonly userSettingsModel: Model<UserSettingsDocument>,
  ) {}

  async getWhisperPresets(userId: string): Promise<Record<string, WhisperConfig>> {
    const doc = await this.userSettingsModel
      .findOne({ userId })
      .lean();
    return doc?.whisperPresets ?? {};
  }

  async saveWhisperPreset(
    userId: string,
    name: string,
    config: WhisperConfig,
  ): Promise<void> {
    await this.userSettingsModel.findOneAndUpdate(
      { userId },
      { $set: { [`whisperPresets.${name}`]: config } },
      { upsert: true, new: true },
    );
  }

  async deleteWhisperPreset(userId: string, name: string): Promise<void> {
    await this.userSettingsModel.findOneAndUpdate(
      { userId },
      { $unset: { [`whisperPresets.${name}`]: 1 } },
    );
  }
}
