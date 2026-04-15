import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSettings, UserSettingsDocument, WhisperConfig } from './user-settings.schema';

const RESERVED_NAMES = ['ve', 'vcat'];

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectModel(UserSettings.name)
    private readonly model: Model<UserSettingsDocument>,
  ) {}

  async getWhisperPresets(userId: string): Promise<Record<string, WhisperConfig>> {
    const doc = await this.model.findOne({ userId }).lean();
    return (doc?.whisperPresets as Record<string, WhisperConfig>) ?? {};
  }

  async saveWhisperPreset(
    userId: string,
    name: string,
    config: WhisperConfig,
  ): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('El nom del preset no pot ser buit');
    if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
      throw new BadRequestException(`"${trimmed}" és un nom reservat (preset de fàbrica)`);
    }
    await this.model.findOneAndUpdate(
      { userId },
      { $set: { [`whisperPresets.${trimmed}`]: config } },
      { upsert: true, new: true },
    );
  }

  async deleteWhisperPreset(userId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
      throw new BadRequestException(
        `"${trimmed}" és un preset de fàbrica i no es pot eliminar`,
      );
    }
    // Idempotent: no error if preset does not exist
    await this.model.updateOne(
      { userId },
      { $unset: { [`whisperPresets.${trimmed}`]: '' } },
    );
  }
}
