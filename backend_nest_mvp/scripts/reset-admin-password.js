/**
 * reset-admin-password.js
 * -----------------------
 * Reinicia la contrasenya d'un usuari existent a MongoDB (o el crea com a
 * admin si no existeix). Usa el mateix hash bcrypt (cost 12) que el backend.
 *
 * Executa des de backend_nest_mvp/:
 *   node scripts/reset-admin-password.js
 *
 * Variables d'entorn opcionals (o edita els defaults de sota):
 *   MONGODB_URI     — es llegeix del .env
 *   ADMIN_EMAIL     — default: admin@sonilab.cat
 *   ADMIN_PASSWORD  — default: Admin1234
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/script_editor';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@sonilab.cat').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234';
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
  console.log('Connectat!\n');

  // Diagnòstic: llista tots els usuaris (sense exposar el hash)
  const all = await User.find().lean();
  console.log(`Usuaris trobats: ${all.length}`);
  for (const u of all) {
    console.log(`  - ${u.email}  (role: ${u.role})`);
  }
  console.log('');

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (existing) {
    existing.passwordHash = passwordHash;
    if (existing.role !== 'admin') existing.role = 'admin';
    await existing.save();
    console.log(`✅ Contrasenya reiniciada per "${ADMIN_EMAIL}".`);
  } else {
    await User.create({
      email: ADMIN_EMAIL,
      passwordHash,
      name: ADMIN_NAME,
      role: 'admin',
    });
    console.log(`✅ Usuari admin creat: "${ADMIN_EMAIL}".`);
  }

  // Verificació: comprova que la nova contrasenya valida correctament
  const check = await User.findOne({ email: ADMIN_EMAIL });
  const ok = await bcrypt.compare(ADMIN_PASSWORD, check.passwordHash);
  console.log(`Verificació bcrypt.compare("${ADMIN_PASSWORD}"): ${ok ? 'OK ✅' : 'FALLA ❌'}`);

  await mongoose.disconnect();
  console.log('\nDesconnectat.');
  if (!ok) process.exit(2);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
