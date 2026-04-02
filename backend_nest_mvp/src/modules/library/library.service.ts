import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Folder, FolderDocument } from './schemas/folder.schema';
import { Document, DocumentDocument } from './schemas/document.schema';

@Injectable()
export class LibraryService {
  constructor(
    @InjectModel(Folder.name) private readonly folderModel: Model<FolderDocument>,
    @InjectModel(Document.name) private readonly docModel: Model<DocumentDocument>,
  ) {}

  async getTree(_ownerId: string) {
  // Workspace compartit: tots els usuaris autenticats veuen el mateix contingut.
  // El _ownerId es rep per compatibilitat però no s'usa com a filtre.
  const [folders, documents] = await Promise.all([
    this.folderModel.find({}).lean(),
    this.docModel.find({}).lean(),
  ]);

  return {
    folders: folders.map((f: any) => ({ ...f, id: f._id.toString() })),
    documents: documents.map((d: any) => ({ ...d, id: d._id.toString() })),
  };
}
  async findMediaBySha256(ownerId: string, sha256: string, size?: number) {
  const q: any = { ownerId, isDeleted: false, 'media.sha256': sha256 };
  if (typeof size === 'number') q['media.size'] = size;
  const doc = await this.docModel.findOne(q).lean();
  return doc ? { ...doc, id: doc._id.toString() } : null;
}
  /** Lightweight precheck: find a media document by original name + file size. */
  async findMediaByNameAndSize(name: string, size: number): Promise<any | null> {
    const doc = await this.docModel
      .findOne({ isDeleted: false, media: { $ne: null }, 'media.size': size, name })
      .collation({ locale: 'en', strength: 2 })
      .lean();
    return doc ? { ...doc, id: doc._id.toString() } : null;
  }

async softDeleteFolderTree(ownerId: string, rootFolderId: string, batchDocIds?: string[]) {
  const root = await this.folderModel.findOne({ _id: rootFolderId, ownerId }).lean();
  if (!root) throw new NotFoundException('Folder not found');

  const folders = await this.folderModel
    .find({ ownerId, isDeleted: false }, { _id: 1, parentId: 1 })
    .lean();

  const children = new Map<string, string[]>();
  for (const f of folders) {
    const pid = f.parentId ?? '__root__';
    const list = children.get(pid) ?? [];
    list.push(f._id.toString());
    children.set(pid, list);
  }

  const toDelete: string[] = [];
  const queue: string[] = [rootFolderId];

  while (queue.length) {
    const cur = queue.shift()!;
    toDelete.push(cur);
    const kids = children.get(cur) ?? [];
    for (const k of kids) queue.push(k);
  }

  // Guard: comprova si algun media canònic dins l'arbre té LNK actius EXTERNS.
  // LNK que estan dins el mateix arbre (parentId en toDelete) no bloquen — s'esborren amb la carpeta.
  // Només bloquen LNK actius cuyo parentId queda fora del conjunt a esborrar.
  const mediaInTree = await this.docModel
    .find(
      { parentId: { $in: toDelete }, isDeleted: { $ne: true }, media: { $ne: null }, refTargetId: null },
      { _id: 1, name: 1 },
    )
    .lean();

  if (mediaInTree.length > 0) {
    const mediaIds = mediaInTree.map((d: any) => d._id.toString());
    // Exclou LNK que estan dins l'arbre (parentId en toDelete)
    // i també LNK que formen part del lot total de borrat (batchDocIds).
    const exclude = batchDocIds?.length ? { _id: { $nin: batchDocIds } } : {};
    const externalLnkCount = await this.docModel.countDocuments({
      refTargetId: { $in: mediaIds },
      isDeleted: { $ne: true },
      parentId: { $nin: toDelete },
      ...exclude,
    });
    if (externalLnkCount > 0) {
      throw new BadRequestException(
        `No es pot esborrar la carpeta: ${externalLnkCount} referència(es) activa(es) externa(es) apunten a assets de media continguts. Esborra primer les referències.`,
      );
    }
  }

  await this.folderModel.updateMany({ ownerId, _id: { $in: toDelete } }, { $set: { isDeleted: true } });
  await this.docModel.updateMany({ ownerId, parentId: { $in: toDelete } }, { $set: { isDeleted: true } });

  return { deletedFolderIds: toDelete.length };
}
async restoreFolderTree(ownerId: string, rootFolderId: string) {
  const root = await this.folderModel.findOne({ _id: rootFolderId, ownerId }).lean();
  if (!root) throw new NotFoundException('Folder not found');

  // Si el padre fue purgado o no existe, restaurar en raíz
  if ((root as any).parentId) {
    const parentExists = await this.folderModel
      .findOne({ _id: (root as any).parentId, isDeleted: { $ne: true } })
      .lean();
    if (!parentExists) {
      await this.folderModel.updateOne({ _id: rootFolderId }, { $set: { parentId: null } });
    }
  }

  // Cogemos todas las folders (incluidas borradas) para reconstruir el árbol
  const folders = await this.folderModel
    .find({ ownerId }, { _id: 1, parentId: 1 })
    .lean();

  const children = new Map<string, string[]>();
  for (const f of folders) {
    const pid = f.parentId ?? '__root__';
    const list = children.get(pid) ?? [];
    list.push(f._id.toString());
    children.set(pid, list);
  }

  const toRestore: string[] = [];
  const queue: string[] = [rootFolderId];

  while (queue.length) {
    const cur = queue.shift()!;
    toRestore.push(cur);
    const kids = children.get(cur) ?? [];
    for (const k of kids) queue.push(k);
  }

  // Restauramos folders + docs dentro del árbol
  await this.folderModel.updateMany(
    { ownerId, _id: { $in: toRestore } },
    { $set: { isDeleted: false } },
  );

  await this.docModel.updateMany(
    { ownerId, parentId: { $in: toRestore } },
    { $set: { isDeleted: false } },
  );

  return { restoredFolderIds: toRestore.length };
}

async purgeFolderTree(ownerId: string, rootFolderId: string, batchDocIds?: string[]) {
  const root = await this.folderModel.findOne({ _id: rootFolderId, ownerId }).lean();
  if (!root) throw new NotFoundException('Folder not found');

  const folders = await this.folderModel
    .find({ ownerId }, { _id: 1, parentId: 1 })
    .lean();

  const children = new Map<string, string[]>();
  for (const f of folders) {
    const pid = f.parentId ?? '__root__';
    const list = children.get(pid) ?? [];
    list.push(f._id.toString());
    children.set(pid, list);
  }

  const toDelete: string[] = [];
  const queue: string[] = [rootFolderId];

  while (queue.length) {
    const cur = queue.shift()!;
    toDelete.push(cur);
    const kids = children.get(cur) ?? [];
    for (const k of kids) queue.push(k);
  }

  // Guard: comprova si algun media canònic dins l'arbre té LNK actius EXTERNS al lot.
  const mediaInTree = await this.docModel
    .find(
      { parentId: { $in: toDelete }, isDeleted: { $ne: true }, media: { $ne: null }, refTargetId: null },
      { _id: 1 },
    )
    .lean();

  if (mediaInTree.length > 0) {
    const mediaIds = mediaInTree.map((d: any) => d._id.toString());
    const exclude = batchDocIds?.length ? { _id: { $nin: batchDocIds } } : {};
    const externalLnkCount = await this.docModel.countDocuments({
      refTargetId: { $in: mediaIds },
      isDeleted: { $ne: true },
      parentId: { $nin: toDelete },
      ...exclude,
    });
    if (externalLnkCount > 0) {
      throw new BadRequestException(
        `No es pot eliminar permanentment la carpeta: ${externalLnkCount} referència(es) activa(es) externa(es) apunten a assets de media continguts. Esborra primer les referències.`,
      );
    }
  }

  // Borra docs del árbol y luego folders del árbol
  await this.docModel.deleteMany({ ownerId, parentId: { $in: toDelete } });
  const res = await this.folderModel.deleteMany({ ownerId, _id: { $in: toDelete } });

  return { purgedFolderIds: res.deletedCount ?? toDelete.length };
}

async restoreDocument(ownerId: string, id: string) {
  const doc = await this.docModel
    .findOneAndUpdate({ _id: id, ownerId }, { $set: { isDeleted: false } }, { new: true })
    .lean();

  if (!doc) throw new NotFoundException('Document not found');

  // Si el padre fue purgado o no existe, restaurar en raíz
  if ((doc as any).parentId) {
    const parentExists = await this.folderModel
      .findOne({ _id: (doc as any).parentId, isDeleted: { $ne: true } })
      .lean();
    if (!parentExists) {
      await this.docModel.updateOne({ _id: id }, { $set: { parentId: null } });
      return { ...doc, id: doc._id.toString(), parentId: null };
    }
  }

  return { ...doc, id: doc._id.toString() };
}

async purgeDocument(ownerId: string, id: string, batchDocIds?: string[]): Promise<any> {
  const doc = await this.docModel.findOne({ _id: id, ownerId }).lean();
  if (!doc) throw new NotFoundException('Document not found');

  const isCanonicalMedia = !!(doc as any).media && !(doc as any).refTargetId;
  if (isCanonicalMedia) {
    // Exclou del recompte els LNK que formen part del mateix lot de purge.
    const exclude = batchDocIds?.length ? { _id: { $nin: batchDocIds } } : {};
    const activeLnkCount = await this.docModel.countDocuments({
      refTargetId: id,
      isDeleted: { $ne: true },
      ...exclude,
    });
    if (activeLnkCount > 0) {
      throw new BadRequestException(
        `No es pot eliminar permanentment: ${activeLnkCount} referència(es) activa(es) apunten a aquest asset. Esborra primer les referències.`,
      );
    }
  }

  const res = await this.docModel.deleteOne({ _id: id, ownerId });
  if (!res.deletedCount) throw new NotFoundException('Document not found');
  return { ok: true };
}

async folderNameExists(ownerId: string, name: string, parentId: string | null) {
  const f = await this.folderModel
    .findOne({ ownerId, isDeleted: false, parentId, name })
    .collation({ locale: 'en', strength: 2 }) // case-insensitive
    .lean();
  return !!f;
}
  async createFolder(ownerId: string, name: string, parentId?: string) {
    const folder = await this.folderModel.create({
      ownerId,
      name,
      parentId: parentId ?? null,
      isDeleted: false,
    });
    return { ...folder.toObject(), id: folder._id.toString() };
  }

  async updateFolder(ownerId: string, id: string, patch: Partial<Folder>) {
    const folder = await this.folderModel
      .findOneAndUpdate({ _id: id, ownerId }, patch, { new: true })
      .lean();
    if (!folder) throw new NotFoundException('Folder not found');
    return { ...folder, id: folder._id.toString() };
  }

  async createDocument(ownerId: string, input: Partial<Document>) {
    const doc = await this.docModel.create({
      ownerId,
      name: input.name,
      parentId: input.parentId ?? null,
      sourceType: input.sourceType,
      contentByLang: input.contentByLang ?? {},
      csvContentByLang: input.csvContentByLang ?? {},
      sourceLang: input.sourceLang ?? null,
      isLocked: input.isLocked ?? false,
      isDeleted: false,
      media: input.media ?? null,
    });
    return { ...doc.toObject(), id: doc._id.toString() };
  }

  async getDocument(_ownerId: string, id: string) {
    // Workspace compartit: qualsevol usuari pot llegir qualsevol document.
    const doc = await this.docModel.findOne({ _id: id }).lean();
    if (!doc) throw new NotFoundException('Document not found');
    return { ...doc, id: doc._id.toString() };
  }

  // ── Lock management ───────────────────────────────────────────────────────
  private static readonly LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes (heartbeat cada 2 min)

  async acquireLock(docId: string, userId: string, userName: string): Promise<any> {
    const doc = await this.docModel.findOne({ _id: docId }).lean();
    if (!doc) throw new NotFoundException('Document not found');

    const now = new Date();
    const lockedAt: Date | null = (doc as any).lockedAt;
    const lockedByUserId: string | null = (doc as any).lockedByUserId;

    // If locked by another user and lock is still valid → 423 Locked
    if (
      lockedByUserId &&
      lockedByUserId !== userId &&
      lockedAt &&
      now.getTime() - lockedAt.getTime() < LibraryService.LOCK_TTL_MS
    ) {
      throw new ForbiddenException({
        message: 'Document locked',
        lockedByUserId,
        lockedByUserName: (doc as any).lockedByUserName,
        lockedAt,
      });
    }

    // Acquire / refresh lock
    const updated = await this.docModel
      .findByIdAndUpdate(
        docId,
        { $set: { lockedByUserId: userId, lockedByUserName: userName, lockedAt: now } },
        { new: true },
      )
      .lean();

    return { ...updated, id: (updated as any)._id.toString() };
  }

  async releaseLock(docId: string, userId: string): Promise<any> {
    const doc = await this.docModel.findOne({ _id: docId }).lean();
    if (!doc) throw new NotFoundException('Document not found');

    const lockedByUserId: string | null = (doc as any).lockedByUserId;
    // Only the lock owner can release (or if already unlocked)
    if (lockedByUserId && lockedByUserId !== userId) {
      throw new ForbiddenException('Only the lock owner can release this lock');
    }

    const updated = await this.docModel
      .findByIdAndUpdate(
        docId,
        { $set: { lockedByUserId: null, lockedByUserName: null, lockedAt: null } },
        { new: true },
      )
      .lean();

    return { ...updated, id: (updated as any)._id.toString() };
  }

  async getLockStatus(docId: string): Promise<{ lockedByUserId: string | null; lockedByUserName: string | null; lockedAt: Date | null; isExpired: boolean }> {
    const doc = await this.docModel.findOne({ _id: docId }, { lockedByUserId: 1, lockedByUserName: 1, lockedAt: 1 }).lean();
    if (!doc) throw new NotFoundException('Document not found');

    const lockedAt: Date | null = (doc as any).lockedAt;
    const lockedByUserId: string | null = (doc as any).lockedByUserId;
    const now = new Date();
    const isExpired = !!(lockedAt && now.getTime() - lockedAt.getTime() >= LibraryService.LOCK_TTL_MS);

    return {
      lockedByUserId: isExpired ? null : lockedByUserId,
      lockedByUserName: isExpired ? null : (doc as any).lockedByUserName,
      lockedAt: isExpired ? null : lockedAt,
      isExpired,
    };
  }

  async updateDocument(_ownerId: string, id: string, patch: Partial<Document>) {
    // Workspace compartit: qualsevol usuari autenticat pot modificar documents.
    const doc = await this.docModel
      .findOneAndUpdate({ _id: id }, patch, { new: true })
      .lean();
    if (!doc) throw new NotFoundException('Document not found');
    return { ...doc, id: doc._id.toString() };
  }

  /**
   * Soft-deletes a document.
   * Guard: si el document és media canònica (media poblat, sense refTargetId),
   * comprova si hi ha LNK actius (no esborrats) apuntant-hi.
   * Si n'hi ha, llança BadRequestException — no es permet deixar referències actives orfes.
   * El borrat de LNK individuals i documents clàssics no queda afectat.
   */
  async softDeleteDocument(_ownerId: string, id: string, batchDocIds?: string[]): Promise<any> {
    const doc = await this.docModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Document not found');

    const isCanonicalMedia = !!(doc as any).media && !(doc as any).refTargetId;
    if (isCanonicalMedia) {
      // Exclou del recompte els LNK que formen part del mateix lot de borrat.
      const exclude = batchDocIds?.length ? { _id: { $nin: batchDocIds } } : {};
      const activeLnkCount = await this.docModel.countDocuments({
        refTargetId: id,
        isDeleted: { $ne: true },
        ...exclude,
      });
      if (activeLnkCount > 0) {
        throw new BadRequestException(
          `No es pot esborrar: ${activeLnkCount} referència(es) activa(es) apunten a aquest asset. Esborra primer les referències.`,
        );
      }
    }

    const updated = await this.docModel
      .findOneAndUpdate({ _id: id }, { $set: { isDeleted: true } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Document not found');
    return { ...updated, id: (updated as any)._id.toString() };
  }

  /** Checks name uniqueness across ALL non-deleted media documents (workspace-wide). */
  async findMediaByName(name: string): Promise<any | null> {
    const doc = await this.docModel
      .findOne({ isDeleted: false, media: { $ne: null }, name })
      .collation({ locale: 'en', strength: 2 })
      .lean();
    return doc ? { ...doc, id: doc._id.toString() } : null;
  }

  /** Creates a reference document pointing to an existing media document. */
  async createMediaRef(ownerId: string, targetDocId: string, parentId: string | null): Promise<any> {
    const target = await this.docModel.findById(targetDocId).lean();
    if (!target) throw new NotFoundException('Target document not found');
    // Només es permet crear referències cap a documents de media canònica.
    // Documents de text, srt, pdf o docx no accepten ref.
    if (!(target as any).media) {
      throw new BadRequestException('Only media assets can be referenced. Target document has no media.');
    }
    const doc = await this.docModel.create({
      ownerId,
      name: (target as any).name,
      parentId,
      sourceType: (target as any).sourceType,
      refTargetId: targetDocId,
      contentByLang: {},
      csvContentByLang: {},
      sourceLang: null,
      isLocked: false,
      isDeleted: false,
      media: null,
    });
    return { ...doc.toObject(), id: doc._id.toString() };
  }

  async listMedia(_ownerId: string, sourceTypes?: string[]) {
    // Workspace compartit: mostra media de tots els usuaris
    const filter: any = { isDeleted: false, media: { $ne: null } };
    if (sourceTypes?.length) filter.sourceType = { $in: sourceTypes };
    const docs = await this.docModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id.toString() }));
  }
}
