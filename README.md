# PicoHunter

PicoHunter e uma rede social geolocalizada para descobrir picos, explorar rotas e conectar pessoas atraves do esporte.

O projeto combina mapa interativo, feed com foto e video, rotas desenhadas no frontend, perfis, notificacoes, mensagens diretas, grupos e ferramentas de moderacao. O frontend foi construido com React + Vite, a API usa Express, os dados ficam em PostgreSQL e os uploads de midia sao enviados para o Cloudinary.

## Visao Geral

O fluxo principal do app hoje inclui:

- cadastro e login com localizacao exata e esportes favoritos
- exploracao de picos no mapa com filtro por esporte e distancia
- exploracao de rotas em linha com persistencia local no frontend
- criacao, edicao, aprovacao e acompanhamento de picos
- feed social com posts de foto e video por pico
- feed hibrido com posts do backend e rotas salvas no navegador
- eventos por comunidade, com fluxo de aprovacao quando necessario
- perfis de usuario com seguidores, posts, curtidas e picos visitados
- conversas diretas, grupos e reacoes em mensagens
- vaquinhas por pico e acompanhamento de contribuicoes
- roles e permissoes para administracao e moderacao

## Funcionalidades Principais

### Mapa e descoberta

- exibicao de picos em mapa com Leaflet e OpenStreetMap
- exibicao de rotas em linha com Polyline no mapa
- geolocalizacao do usuario para centralizar o mapa e calcular distancia
- criacao de novo pico a partir de um ponto clicado no mapa
- criacao de rota por desenho no mapa ou gravacao via GPS
- filtro por esporte

### Rede social da comunidade

- feed com publicacoes em foto ou video
- feed com cards de rota e preview de percurso
- curtidas e comentarios em posts
- curtidas, comentarios, save e compartilhamento local de rotas
- perfil do pico com galeria, top videos, seguidores e historico da comunidade
- compartilhamento de perfil e conteudo

### Eventos e organizacao

- criacao de eventos por pico
- sugestao de eventos por usuarios com aprovacao para perfis sem permissao direta
- tela de detalhe do evento
- vaquinha ativa por pico com registro de contribuicoes

### Pessoas, mensagens e moderacao

- seguir usuarios e receber notificacoes
- inbox com DMs e grupos
- reacoes em mensagens
- painel de moderacao para aprovar ou rejeitar picos e eventos
- sistema de roles com permissoes por tipo de usuario

## Stack

- Frontend: React 19, React Router, Vite
- Mapa: Leaflet e React Leaflet
- Backend: Node.js 20, Express 5, Multer
- Banco de dados: PostgreSQL
- Upload de midia: Cloudinary
- Infra sugerida no projeto: Vercel + Render + Neon

## Requisitos

- Node.js 20.x
- npm
- PostgreSQL acessivel pela `DATABASE_URL`
- conta no Cloudinary para upload de imagem e video

## Como Rodar Localmente

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo de ambiente:

```bash
Copy-Item .env.example .env
```

3. Ajuste as variaveis no `.env`:

```env
PORT=3001
APP_NAME=PicoHunter
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/picohunter
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

4. Aplique schema e seed do banco:

```bash
npm run db:setup
```

5. Suba frontend e backend em modo desenvolvimento:

```bash
npm run dev
```

6. Abra o frontend no navegador.

Em desenvolvimento, o Vite faz proxy de `/api` para `http://127.0.0.1:3001`, entao o fluxo local funciona com frontend e backend rodando juntos pelo comando `npm run dev`.

## Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `PORT` | nao | Porta da API Express. Padrao: `3001`. |
| `APP_NAME` | nao | Nome exibido na resposta de health check. |
| `DATABASE_URL` | sim | String de conexao com PostgreSQL. |
| `DATABASE_SSL` | nao | Usada no deploy para bancos gerenciados com SSL. |
| `CLOUDINARY_CLOUD_NAME` | sim | Nome da conta no Cloudinary. |
| `CLOUDINARY_API_KEY` | sim | Chave da API do Cloudinary. |
| `CLOUDINARY_API_SECRET` | sim | Segredo da API do Cloudinary. |
| `CLOUDINARY_UPLOAD_FOLDER` | nao | Pasta destino no Cloudinary. Padrao sugerido: `picohunter/demo`. |
| `VITE_API_BASE_URL` | depende | URL da API quando o frontend nao usar a mesma origem. |

## Scripts

| Comando | Descricao |
| --- | --- |
| `npm run dev` | Sobe backend com watch e frontend Vite em paralelo. |
| `npm run dev:client` | Sobe apenas o frontend. |
| `npm run dev:server` | Sobe apenas a API. |
| `npm run build` | Gera a build do frontend em `dist/`. |
| `npm run preview` | Serve a build do frontend localmente. |
| `npm run start` | Inicia a API em modo de producao. |
| `npm run db:migrate` | Aplica `database/schema.sql`. |
| `npm run db:seed` | Aplica `database/seed.sql`. |
| `npm run db:setup` | Executa migrate + seed. |
| `npm run db:clear-demo` | Limpa dados de demo. |

## Estrutura do Projeto

```text
.
|-- backend/      # API Express, integracao com banco e Cloudinary
|-- database/     # schema, seed e scripts de banco
|-- src/          # app React, paginas, componentes e utilitarios
|-- dist/         # build gerada do frontend
|-- tools/        # utilitarios auxiliares
|-- DEPLOY.md     # notas de deploy da demo
|-- render.yaml   # configuracao da API no Render
|-- vercel.json   # rewrites do frontend
```

## API e Modulos Relevantes

- `backend/server.js`: endpoints REST de auth, picos, feed, eventos, uploads, notificacoes, moderacao e DMs
- `backend/repository.js`: regras de negocio e acesso aos dados
- `database/schema.sql`: definicao das tabelas, indices e relacionamentos
- `src/pages/ExplorePage.jsx`: mapa principal com descoberta de picos e rotas
- `src/pages/PicoPage.jsx`: perfil do pico, feed local, eventos, admins e vaquinha
- `src/pages/FeedPage.jsx`: feed social com posts e rotas client-side
- `src/pages/NewRoutePage.jsx`: criacao de rota por desenho e GPS
- `src/pages/RouteDetailPage.jsx`: detalhe da rota com mapa, save e share
- `src/pages/ChatsPage.jsx`: inbox, DMs e grupos
- `src/pages/ProfilePage.jsx`: perfil do usuario e painel de moderacao
- `src/utils/routes.js`: store local, serializacao e interacoes de rotas

## Deploy

O repositorio ja inclui arquivos de deploy para API e frontend:

- `render.yaml` para subir a API no Render
- `vercel.json` para tratar SPA routes e reescritas do frontend
- `DEPLOY.md` com um passo a passo de demo usando Render, Vercel, Neon e Cloudinary

### Observacao importante sobre o frontend

No estado atual, o arquivo `vercel.json` reescreve `/api/*` para uma URL fixa externa. Isso pode ser util para demo temporaria, mas nao e o ideal para producao. Antes de publicar de forma definitiva, revise esse destino para apontar para a API real do projeto.

## Banco de Dados

O schema cobre os principais dominios do produto:

- usuarios, perfil, sessoes e esportes favoritos
- roles, permissoes e relacoes de acesso
- picos, administradores, curtidas, seguidores e visitas
- midia, curtidas e comentarios
- eventos com aprovacao
- vaquinhas e contribuicoes
- conversas diretas, grupos, mensagens e reacoes
- notificacoes da plataforma

## Rotas no Frontend

Nesta fase, as rotas funcionam sem alterar backend:

- sao persistidas no `localStorage`
- podem ser desenhadas no mapa ou gravadas via GPS
- aparecem no mapa, no feed e na tela de detalhe
- podem ser compartilhadas por link serializado
- likes, comentarios e saves de rotas sao locais por navegador

## Estado Atual e Observacoes

- o projeto nao possui scripts de teste automatizado configurados no `package.json`
- o upload de midia depende do Cloudinary mesmo em ambiente local
- o navegador precisa ter permissao de geolocalizacao para os fluxos de mapa e cadastro funcionarem melhor

## Licenca

Este projeto nao possui licenca definida neste repositorio.
