import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

   // nuevo (opcional)
  @Prop({ required: false, trim: true })
  name?: string;

  // nuevo (opcional): almacena preferencias libres
  @Prop({ type: Object, default: {} })
  preferences?: any;
}

export const UserSchema = SchemaFactory.createForClass(User);
