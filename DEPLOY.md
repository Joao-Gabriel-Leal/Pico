# Deploy de Demo do PicoHunter

## Stack recomendada
- Frontend: Vercel Hobby
- API: Render Free Web Service
- Banco: Neon PostgreSQL
- Midia: Cloudinary

## Backend no Render
- Build command: `npm install`
- Start command: `npm run start`
- Health check: `/api/health`
- Runtime: `Node 20`

## Variaveis do backend
- `DATABASE_URL`
- `DATABASE_SSL=true`
- `APP_NAME=PicoHunter`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- Opcional: `CLOUDINARY_UPLOAD_FOLDER=picohunter/demo`

## Variaveis do frontend na Vercel
- `VITE_API_BASE_URL=https://seu-app.onrender.com`

## Ordem recomendada
1. Crie o banco no Neon e copie a `DATABASE_URL`.
2. Rode `npm install`.
3. Rode `npm run db:setup` apontando para o banco do Neon.
4. Crie a conta no Cloudinary e copie as 3 chaves.
5. Suba a API no Render com este repositório.
6. Configure no Render as variaveis do backend.
7. Suba o frontend no Vercel com `npm run build`.
8. Configure no Vercel `VITE_API_BASE_URL` com a URL da API do Render.
9. Abra a URL `.vercel.app`, aqueça feed, perfil e DM alguns minutos antes da apresentacao.

## Observacao sobre o plano gratis
- O Render gratis pode dormir depois de um tempo sem uso.
- O primeiro acesso depois disso pode levar alguns segundos.
- Para a demo, abra o app alguns minutos antes e navegue em feed, perfil e conversas.

## Checklist rapido
- `GET /api/health` responde `ok: true`
- cadastro salva localizacao e esportes
- upload de foto e video devolve URL `https://res.cloudinary.com/...`
- feed, eventos, DM, grupos e votos persistem apos refresh
