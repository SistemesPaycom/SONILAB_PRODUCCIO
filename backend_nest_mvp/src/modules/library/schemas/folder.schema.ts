import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FolderDocument = HydratedDocument<Folder>;

@Schema({ timestamps: true })
export class Folder {
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, trim: true })
  name: string;

  // ✅ FIX: especificar el type explícit per unions (string | null)
  @Prop({ type: String, default: null, index: true })
  parentId: string | null;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop({ type: String, default: 'files', index: true })
  category: 'files' | 'media';
}

export const FolderSchema = SchemaFactory.createForClass(Folder);
