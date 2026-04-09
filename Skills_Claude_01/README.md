# Sonilab Producció (Monorepo)

Repositorio monorepo amb:

- `frontend/`: aplicació React (Vite + TypeScript) — biblioteca, editors, subtítols, guion, timeline, waveform, traducció, revisió, projectes.
- `backend_nest_mvp/`: API en NestJS (MongoDB + Redis) — gestió d'usuaris, biblioteca (carpetes/documents), media (vídeos/àudio) i projectes.
- `WhisperX_Sonilab_01-main/`: pipeline WhisperX (Python) per transcripció i alineament de subtítols.
- `subtitleedit-main/`: referència local del projecte SubtitleEdit.
- `Skills_Claude/`: documentació de context, historial i dominis per a Claude.

## Requisits generals

- Node.js (recomanat LTS)
- Python 3.10+ (per WhisperX)
- FFmpeg
- MongoDB
- Redis

## Arranc ràpid

1) Arranca Mongo i Redis (Docker o local)
2) Configura `backend_nest_mvp/.env` (copiant `backend_nest_mvp/.env.example`)
3) Instal·la i arranca el backend (`cd backend_nest_mvp && npm install && npm run start:dev`)
4) Instal·la i arranca el frontend (`cd frontend && npm install && npm run dev`)
5) Verifica l'endpoint de health del backend

Cada carpeta conté el seu propi README amb instruccions detallades.
