import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DocumentDocument = HydratedDocument<Document>;

export class MediaInfo {
  @Prop({ required: true })
  storage: 'local' | 'share';

  @Prop({ required: true })
  path: string;

  @Prop()
  mimeType?: string;

  @Prop()
  size?: number;

  @Prop()
  sha256?: string;
}

@Schema({ timestamps: true })
export class Document {
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, trim: true })
  name: string;

 @Prop({ type: String, default: null, index: true })
parentId: string | null;

  @Prop({ required: true, index: true })
  sourceType: string;

  @Prop({ type: Object, default: {} })
  contentByLang: Record<string, string>;

  @Prop({ type: Object, default: {} })
  csvContentByLang: Record<string, string>;

 @Prop({ type: String, default: null })
sourceLang: string | null;

  @Prop({ default: false })
  isLocked: boolean;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  
@Prop({ type: Object, default: null })
media: MediaInfo | null;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);
