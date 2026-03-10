import { ConflictException, Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(email: string, password: string, role: 'admin' | 'user' = 'user') {
    const exists = await this.userModel.findOne({ email: email.toLowerCase() }).lean();
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.userModel.create({ email: email.toLowerCase(), passwordHash, role });
    return { id: user._id.toString(), email: user.email, role: user.role };
  }

  async validate(email: string, password: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return { id: user._id.toString(), email: user.email, role: user.role };
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).lean();
    if (!user) return null;
    const { passwordHash, ...safe } = user as any;
    return { id: (user as any)._id.toString(), ...safe };
  }

  async findAll() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).lean();
    return users.map((u: any) => {
      const { passwordHash, ...safe } = u;
      return { id: u._id.toString(), ...safe };
    });
  }

  async createByAdmin(email: string, password: string, name?: string, role: 'admin' | 'user' = 'user') {
    const exists = await this.userModel.findOne({ email: email.toLowerCase() }).lean();
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.userModel.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
    });
    return { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
  }

  async update(id: string, updates: { name?: string; email?: string; preferences?: any }) {
    if (updates.email) {
      const exists = await this.userModel.findOne({ email: updates.email.toLowerCase(), _id: { $ne: id } }).lean();
      if (exists) throw new ConflictException('Email already registered');
    }
    const set: any = {};
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.email !== undefined) set.email = updates.email.toLowerCase();
    if (updates.preferences !== undefined) set.preferences = updates.preferences;

    const updated = await this.userModel.findByIdAndUpdate(id, set, { new: true }).lean();
    if (!updated) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = updated as any;
    return { id: (updated as any)._id.toString(), ...safe };
  }
}
