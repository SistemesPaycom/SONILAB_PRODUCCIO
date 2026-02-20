# Script Editor Backend (NestJS + MongoDB + storage local)

## Requisitos
- Node.js 18+ (recomendado 20)
- Docker + Docker Compose

## Arranque

1) Crear `.env`
```bash
cp .env.example .env
```

2) Levantar MongoDB + Redis
```bash
docker compose up -d
```

3) Instalar dependencias
```bash
npm install
```

4) Ejecutar en desarrollo
```bash
npm run start:dev
```

API: http://localhost:8000

> Nota: este MVP no trae Swagger. Si queréis, lo añadimos en el siguiente paso con `@nestjs/swagger`.
