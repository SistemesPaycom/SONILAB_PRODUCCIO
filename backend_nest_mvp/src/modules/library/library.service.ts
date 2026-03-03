import { Injectable, NotFoundException } from '@nestjs/common';
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

  async getTree(ownerId: string) {
  const [folders, documents] = await Promise.all([
    this.folderModel.find({ ownerId }).lean(),
    this.docModel.find({ ownerId }).lean(),
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
async softDeleteFolderTree(ownerId: string, rootFolderId: string) {
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

  await this.folderModel.updateMany({ ownerId, _id: { $in: toDelete } }, { $set: { isDeleted: true } });
  await this.docModel.updateMany({ ownerId, parentId: { $in: toDelete } }, { $set: { isDeleted: true } });

  return { deletedFolderIds: toDelete.length };
}
async restoreFolderTree(ownerId: string, rootFolderId: string) {
  const root = await this.folderModel.findOne({ _id: rootFolderId, ownerId }).lean();
  if (!root) throw new NotFoundException('Folder not found');

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

async purgeFolderTree(ownerId: string, rootFolderId: string) {
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
  return { ...doc, id: doc._id.toString() };
}

async purgeDocument(ownerId: string, id: string) {
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

  async getDocument(ownerId: string, id: string) {
    const doc = await this.docModel.findOne({ _id: id, ownerId }).lean();
    if (!doc) throw new NotFoundException('Document not found');
    return { ...doc, id: doc._id.toString() };
  }

  async updateDocument(ownerId: string, id: string, patch: Partial<Document>) {
    const doc = await this.docModel
      .findOneAndUpdate({ _id: id, ownerId }, patch, { new: true })
      .lean();
    if (!doc) throw new NotFoundException('Document not found');
    return { ...doc, id: doc._id.toString() };
  }

  async listMedia(ownerId: string, sourceTypes?: string[]) {
    const filter: any = { ownerId, isDeleted: false, media: { $ne: null } };
    if (sourceTypes?.length) filter.sourceType = { $in: sourceTypes };
    const docs = await this.docModel.find(filter).sort({ createdAt: -1 }).lean();
    return docs.map((d) => ({ ...d, id: d._id.toString() }));
  }
}
