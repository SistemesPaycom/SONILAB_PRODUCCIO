import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module';
import { MediaController } from './media.controller';


@Module({
  imports: [LibraryModule],
  controllers: [MediaController],
})
export class MediaModule {}
