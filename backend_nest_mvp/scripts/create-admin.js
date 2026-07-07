/**
 * create-admin.js
 * ---------------
 * Crea el primer usuari administrador directament a MongoDB.
 * Executa: node scripts/create-admin.js
 *
 * Requereix que MONGODB_URI estigui al .env o com a variable d'entorn.
 * Opcionalment: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sonilab';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sonilab.cat';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    preferences: { type: Object, default: {} },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
  },
  { timestamps: true },
);

const User = mongoose.model('User', UserSchema);

async function main() {
  console.log('Connectant a MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connectat!');

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`✅ Usuari "${ADMIN_EMAIL}" actualitzat a rol admin.`);
    } else {
      console.log(`ℹ️  Usuari admin "${ADMIN_EMAIL}" ja existeix.`);
    }
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await User.create({
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      name: ADMIN_NAME,
      role: 'admin',
    });
    console.log(`✅ Usuari admin creat: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log('   ⚠️  Canvia la contrasenya en el teu primer inici de sessió!');
  }

  await mongoose.disconnect();
  console.log('Desconnectat.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
