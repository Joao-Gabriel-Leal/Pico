# Deploy de Demo do PicoLiga

## Stack
- Frontend: Vercel
- API: Koyeb
- Banco: Neon PostgreSQL
- Midia: Cloudinary

## Variaveis do backend
- `DATABASE_URL`
- `APP_NAME`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- Opcional: `DATABASE_SSL=true`
- Opcional: `CLOUDINARY_UPLOAD_FOLDER=picoliga/demo`

## Variaveis do frontend
- Opcional: `KOYEB_API_ORIGIN=https://seu-app.koyeb.app`
- Opcional: `VITE_API_BASE_URL=https://seu-app.koyeb.app`

## Ordem recomendada
1. Crie o banco no Neon e copie a `DATABASE_URL`.
2. Rode `npm install`.
3. Rode `npm run db:setup` apontando para o banco do Neon.
4. Crie a conta no Cloudinary e copie as 3 chaves.
5. Suba a API no Koyeb com `npm run start`.
6. Configure no Koyeb as variaveis do backend.
7. Suba o frontend no Vercel com `npm run build`.
8. Configure no Vercel `KOYEB_API_ORIGIN` com a URL da API do Koyeb.
9. Abra a URL `.vercel.app`, crie contas reais e publique os primeiros picos antes da entrevista.

## Checklist rapido
- `GET /api/health` responde `ok: true`
- cadastro salva localizacao e esportes
- upload de foto e video devolve URL `https://res.cloudinary.com/...`
- feed, eventos, DM e votos persistem apos refresh
