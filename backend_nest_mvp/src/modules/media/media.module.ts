import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module';
import { MediaController } from './media.controller';
import { MediaCacheService } from './media-cache.service';

@Module({
  imports: [LibraryModule],
  controllers: [MediaController],
  providers: [MediaCacheService],
  exports: [MediaCacheService],
})
export class MediaModule {}
