Sonilab Backend (NestJS) — API + WhisperX Worker

Backend construido con NestJS, MongoDB y Redis (Bull Queue) para gestionar:

✔ Autenticación JWT
✔ Librería de proyectos (carpetas + documentos)
✔ Subida y streaming de media (Range compatible)
✔ Transcripción asíncrona (WhisperX)
✔ Edición posterior de subtítulos (SRT editable)

⚠ WhisperX NO se ejecuta dentro de Node.js. El backend lanza un runner Python externo.

🚀 Stack Tecnológico

Framework → NestJS

Database → MongoDB

Queue → Redis + Bull

Transcripción → WhisperX

Media → FFmpeg

🧠 Arquitectura Mental

El sistema se divide en:

Client → NestJS API → Bull Queue → WhisperX Runner (Python)

1️⃣ Usuario crea proyecto
2️⃣ Backend encola job
3️⃣ Worker ejecuta WhisperX
4️⃣ Resultado → MongoDB + Storage

⚡ Quick Start
cp .env.example .env
npm install
docker compose up -d
npm run start:dev
🧩 Componentes Principales
API — NestJS

Gestiona:

✔ Auth
✔ Library
✔ Media
✔ Projects
✔ Documents
✔ Jobs

Database — MongoDB

Persistencia de:

Users

Folders

Documents

Projects

Jobs

Queue — Redis + Bull

Cola principal:

transcription → transcribe
Storage — MEDIA_ROOT

Estructura recomendada:

MEDIA_ROOT/
 ├── media/
 └── projects/<projectId>/whisperx/

💡 Usa rutas ABSOLUTAS en producción

WhisperX Runner (Python)

El backend:

✔ Lanza proceso Python
✔ Lee stdout
✔ Parsea JSON final

⚙ Configuración (.env)
API

PORT → default 8000

CORS_ORIGINS

Mongo + Redis

MONGO_URI

REDIS_HOST

REDIS_PORT

Storage

MEDIA_ROOT

⚠ Recomendado ABSOLUTO

Auth

JWT_SECRET

JWT_EXPIRES_IN

WhisperX

WHISPERX_PYTHON

WHISPERX_RUNNER

WHISPERX_MODEL

WHISPERX_LANGUAGE

WHISPERX_DEVICE

Opcionales / Avanzado

HUGGINGFACE_HUB_TOKEN

FFMPEG_BIN

HF_HOME

🛠 Instalación
1️⃣ Dependencias
npm install
2️⃣ Infraestructura

Docker

docker compose up -d

Local

Mongo → 27017

Redis → 6379

3️⃣ Backend
npm run start:dev
🔐 Autenticación

Todo excepto /auth/* requiere:

Authorization: Bearer <token>
📡 Endpoints Principales
Auth

POST /auth/register

{
  "email": "test@test.com",
  "password": "12345678"
}

POST /auth/login

{
  "email": "test@test.com",
  "password": "12345678"
}
Media

POST /media/upload → form-data:file

✔ Devuelve → mediaDocumentId

GET /media/list

GET /media/:docId/stream

Compatible con:

<video src="...">
Projects + Jobs

POST /projects

{
  "name": "Proyecto 1",
  "mediaDocumentId": "MEDIA_DOC_ID",
  "settings": {
    "model": "small",
    "language": "ca",
    "device": "cpu",
    "batchSize": 8,
    "diarization": false,
    "offline": false
  }
}

✔ Devuelve:

jobId

srtDocId

GET /jobs/:id

Estados:

queued → processing → done

GET /documents/:id

✔ SRT final:

contentByLang._unassigned

GET /projects/by-srt/:srtDocumentId

✔ Encuentra media asociada

Library

GET /library/tree

POST /folders

PATCH /folders/:id

POST /documents

GET /documents/:id

PATCH /documents/:id

✅ Flujo Completo (Postman)

1️⃣ /auth/login → token
2️⃣ /media/upload → mediaDocId
3️⃣ /projects → jobId + srtDocId
4️⃣ /jobs/:jobId → done
5️⃣ /documents/:srtDocId → SRT

🧯 Troubleshooting
Job atascado en progress 50

✔ Normal en CPU + vídeos largos

✔ Posibles causas:

Diarización en CPU = lenta

Audio pesado

✔ Solución:

diarization: false
WhisperX exit 1

✔ Verifica:

WHISPERX_PYTHON

WHISPERX_RUNNER

MEDIA_ROOT

✔ Debug recomendado:

Ejecutar runner manualmente.

Media file not found

✔ Revisa:

MEDIA_ROOT

Rutas relativas

🗺 Roadmap

Progreso real desde stdout

Artefactos extra (CSV / words / speakers)

Defaults por usuario

Multiworkspace + permisos

📦 Producción (Buenas prácticas)

✔ MEDIA_ROOT absoluto
✔ Logs persistentes
✔ Redis protegido
✔ Mongo con auth
✔ PM2 / Docker / Systemd

Si quieres, ahora podemos hacer:

✔ README con badges reales
✔ Diagrama visual de arquitectura
✔ Dockerización completa
✔ Guía Dev vs Prod
✔ Scripts de deploy