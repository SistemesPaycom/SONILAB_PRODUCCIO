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

// WORKER_ENABLED=false → VM mode: API creates jobs but does NOT consume them.
// WORKER_ENABLED=true (default) → local dev or laptop worker: processes jobs.
const workerEnabled = process.env.WORKER_ENABLED !== 'false';

@Module({
  imports: [
    LibraryModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Job.name, schema: JobSchema },
    ]),
    // Queue always registered so the API can enqueue jobs even without a local worker.
    BullModule.registerQueue({ name: TRANSCRIPTION_QUEUE }),
  ],
  providers: [
    ProjectsService,
    // TranscriptionProcessor only registered when this instance should process jobs.
    ...(workerEnabled ? [TranscriptionProcessor] : []),
  ],
  controllers: [
    ProjectsController,
    JobsController,
    TranscriptionOptionsController,
  ],
  // exports: [ProjectsService], // opcional (solo si otro módulo lo necesita)
})
export class ProjectsModule {}
