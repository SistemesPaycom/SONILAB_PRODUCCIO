import { Body, Controller, Get, Patch, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { LibraryService } from './library.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Delete } from '@nestjs/common';
import { UpdateSrtDto } from './dto/update-srt.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('/library/tree')
  getTree(@CurrentUser() user: RequestUser) {
    return this.library.getTree(user.userId);
  }

  @Post('/folders')
  createFolder(@CurrentUser() user: RequestUser, @Body() dto: CreateFolderDto) {
    return this.library.createFolder(user.userId, dto.name, dto.parentId);
  }

  @Patch('/folders/:id')
  updateFolder(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateFolderDto) {
    return this.library.updateFolder(user.userId, id, dto as any);
  }

  @Post('/documents')
  createDocument(@CurrentUser() user: RequestUser, @Body() dto: CreateDocumentDto) {
    return this.library.createDocument(user.userId, dto as any);
  }

  /** Creates a reference/shortcut document pointing to an existing media document. */
  @Post('/documents/:id/ref')
  createMediaRef(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('parentId') parentId?: string,
  ) {
    return this.library.createMediaRef(user.userId, id, parentId ?? null);
  }

  @Get('/documents/:id')
  getDocument(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.library.getDocument(user.userId, id);
  }

  @Patch('/documents/:id')
  updateDocument(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.library.updateDocument(user.userId, id, dto as any);
  }

  @Get('/media/list')
  listMedia(@CurrentUser() user: RequestUser, @Query('types') types?: string) {
    const sourceTypes = types ? types.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    return this.library.listMedia(user.userId, sourceTypes);
  }

    @Delete('/documents/:id')
  deleteDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('batchDocIds') batchDocIds?: string[],
  ) {
    return this.library.softDeleteDocument(user.userId, id, batchDocIds);
  }

  @Delete('/folders/:id')
  deleteFolder(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('batchDocIds') batchDocIds?: string[],
  ) {
    return this.library.softDeleteFolderTree(id, batchDocIds);
  }
  @Patch('/folders/:id/restore')
restoreFolder(@CurrentUser() _user: RequestUser, @Param('id') id: string) {
  return this.library.restoreFolderTree(id);
}

@Patch('/documents/:id/restore')
restoreDocument(@CurrentUser() user: RequestUser, @Param('id') id: string) {
  return this.library.restoreDocument(user.userId, id);
}

@Delete('/folders/:id/purge')
purgeFolder(
  @CurrentUser() user: RequestUser,
  @Param('id') id: string,
  @Body('batchDocIds') batchDocIds?: string[],
) {
  return this.library.purgeFolderTree(id, batchDocIds);
}

@Delete('/documents/:id/purge')
purgeDocument(
  @CurrentUser() user: RequestUser,
  @Param('id') id: string,
  @Body('batchDocIds') batchDocIds?: string[],
) {
  return this.library.purgeDocument(user.userId, id, batchDocIds);
}

  @Patch('/documents/:id/srt')
updateSrt(
  @CurrentUser() user: RequestUser,
  @Param('id') id: string,
  @Body() dto: UpdateSrtDto,
) {
  return this.library.updateDocument(user.userId, id, {
    contentByLang: { _unassigned: dto.srtText },
  } as any);
}

  // ── Edit lock endpoints ─────────────────────────────────────────────────

  @Post('/documents/:id/lock')
  acquireLock(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { userName?: string },
  ) {
    return this.library.acquireLock(id, user.userId, body?.userName || user.userId);
  }

  @Delete('/documents/:id/lock')
  releaseLock(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.library.releaseLock(id, user.userId);
  }

  @Get('/documents/:id/lock')
  getLockStatus(@Param('id') id: string) {
    return this.library.getLockStatus(id);
  }
}
