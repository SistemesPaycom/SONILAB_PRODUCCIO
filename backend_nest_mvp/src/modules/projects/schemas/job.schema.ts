import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type JobDocument = HydratedDocument<Job>;

@Schema({ timestamps: true })
export class Job {
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, index: true })
  projectId: string;

  @Prop({ required: true, index: true })
  type: 'transcription';

  @Prop({ default: 'queued', index: true })
  status: 'queued' | 'processing' | 'done' | 'error';

  @Prop({ default: 0 })
  progress: number;

 @Prop({ type: String, default: null })
error: string | null;

}

export const JobSchema = SchemaFactory.createForClass(Job);
