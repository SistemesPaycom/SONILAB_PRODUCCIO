import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FolderDocument = HydratedDocument<Folder>;

@Schema({ timestamps: true })
export class Folder {
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, trim: true })
  name: string;

  // ✅ FIX: especificar el type explícito para unions (string | null)
  @Prop({ type: String, default: null, index: true })
  parentId: string | null;

  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const FolderSchema = SchemaFactory.createForClass(Folder);

