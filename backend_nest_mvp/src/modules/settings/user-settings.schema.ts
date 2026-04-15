import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export interface WhisperConfig {
  engine: string;
  model: string;
  language: string;
  batchSize: number;
  device: 'cpu' | 'cuda';
  timingFix: boolean;
  diarization: boolean;
  minSubGapMs: number;
  enforceMinSubGap: boolean;
}

@Schema({ timestamps: true })
export class UserSettings {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: Object, default: {} })
  whisperPresets: Record<string, WhisperConfig>;
}

export type UserSettingsDocument = HydratedDocument<UserSettings>;
export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);
