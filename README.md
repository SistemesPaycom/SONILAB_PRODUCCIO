# Sonilab Transcripcions (Monorepo)

Repositorio monorepo con:

- `backend/`: API en NestJS (MongoDB + Redis) para gestión de usuarios, librería (carpetas/documentos), media (vídeos/audio) y proyectos de transcripción.
- `whisperx_worker/`: pipeline WhisperX (Python) + runner CLI (`runner_cli.py`) ejecutado por el backend.

## Requisitos generales

- Node.js (recomendado LTS)
- Python 3.10+ (para WhisperX)
- FFmpeg
- MongoDB
- Redis

## Arranque rápido

1) Arranca Mongo y Redis (Docker o local)
2) Configura `backend/.env` (copiando `backend/.env.example`)
3) Instala y arranca el backend
4) Verifica endpoint de health y crea un proyecto

Cada carpeta contiene su README con instrucciones detalladas.
