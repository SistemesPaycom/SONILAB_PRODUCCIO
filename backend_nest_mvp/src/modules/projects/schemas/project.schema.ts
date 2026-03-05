import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, index: true })
  folderId: string;

  @Prop({ required: true, index: true })
  mediaDocumentId: string;

  @Prop({ required: true, index: true })
  srtDocumentId: string;

  @Prop({ default: 'created', index: true })
  status: 'created' | 'processing' | 'ready' | 'error';

  @Prop({ type: Object, default: {} })
  settings: Record<string, any>;

  @Prop({ type: String, default: null })
lastError: string | null;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
