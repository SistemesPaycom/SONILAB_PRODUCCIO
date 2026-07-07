import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GlobalSettingsDocument = HydratedDocument<GlobalSettings>;

@Schema({ timestamps: true })
export class GlobalSettings {
  @Prop({ required: true, unique: true, index: true })
  settingKey: string;

  @Prop({ type: Object, default: {} })
  userStyles: {
    scriptEditor?: any;
    subtitleEditor?: any;
    home?: any;
  };
}

export const GlobalSettingsSchema = SchemaFactory.createForClass(GlobalSettings);
