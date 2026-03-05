import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { LibraryModule } from '../library/library.module';
import { Project, ProjectSchema } from './schemas/project.schema';
import { Job, JobSchema } from './schemas/job.schema';
import { ProjectsService, TRANSCRIPTION_QUEUE } from './projects.service';
import { ProjectsController } from './projects.controller';
import { JobsController } from './jobs.controller';
import { TranscriptionProcessor } from './transcription.processor';
import { TranscriptionOptionsController } from './transcription-options.controller';

@Module({
  imports: [
    LibraryModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Job.name, schema: JobSchema },
    ]),
    BullModule.registerQueue({ name: TRANSCRIPTION_QUEUE }),
  ],
  providers: [ProjectsService, TranscriptionProcessor],
  controllers: [
    ProjectsController,
    JobsController,
    TranscriptionOptionsController, // ✅ AÑADIR AQUÍ
  ],
  // exports: [ProjectsService], // opcional (solo si otro módulo lo necesita)
})
export class ProjectsModule {}
