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
      this.folderModel.find({ ownerId, isDeleted: false }).lean(),
      this.docModel.find({ ownerId, isDeleted: false }).lean(),
    ]);
    return {
      folders: folders.map((f) => ({ ...f, id: f._id.toString() })),
      documents: documents.map((d) => ({ ...d, id: d._id.toString() })),
    };
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
