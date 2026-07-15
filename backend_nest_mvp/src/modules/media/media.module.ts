import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module';
import { MediaController } from './media.controller';
import { MediaCacheService } from './media-cache.service';
import { ShotChangesService } from './shot-changes.service';

@Module({
  imports: [LibraryModule],
  controllers: [MediaController],
  providers: [MediaCacheService, ShotChangesService],
  exports: [MediaCacheService, ShotChangesService],
})
export class MediaModule {}
