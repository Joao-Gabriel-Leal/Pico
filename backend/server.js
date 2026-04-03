import { randomUUID } from 'node:crypto'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import { uploadToCloudinary } from './cloudinary.js'
import {
  createRepository,
  validatePicoPayload,
  validateProfilePayload,
  validateRegistrationPayload,
} from './repository.js'

dotenv.config({ quiet: true })

const app = express()
const port = Number(process.env.PORT || 3001)
const repository = await createRepository()

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])
const videoMimeTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

app.use(cors())
app.use(express.json({ limit: '1mb' }))

function getToken(request) {
  const authorization = request.headers.authorization || ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : null
}

async function getAuthenticatedUser(request) {
  const token = getToken(request)
  if (!token) return null
  return repository.getUserByToken(token)
}

async function requireAuth(request, response, next) {
  const user = await getAuthenticatedUser(request)

  if (!user) {
    response.status(401).json({ error: 'Voce precisa entrar para continuar.' })
    return
  }

  request.currentUser = user
  next()
}

function uploadSingleFile(kind, request, response) {
  const allowVideo = kind === 'video'
  const allowedTypes = allowVideo ? videoMimeTypes : imageMimeTypes
  const maxFileSize = allowVideo ? 60 * 1024 * 1024 : 8 * 1024 * 1024

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
    },
    fileFilter: (_, file, callback) => {
      if (!allowedTypes.has(file.mimetype)) {
        callback(new Error(allowVideo ? 'Envie um arquivo de video valido.' : 'Envie uma imagem valida.'))
        return
      }

      callback(null, true)
    },
  }).single('file')

  return new Promise((resolve, reject) => {
    upload(request, response, (error) => {
      if (error) {
        reject(error)
        return
      }

      if (!request.file) {
        reject(new Error('Selecione um arquivo para enviar.'))
        return
      }

      resolve(request.file)
    })
  })
}

app.get('/api/health', async (_, response) => {
  try {
    await repository.healthCheck()
    response.json({
      ok: true,
      appName: process.env.APP_NAME || 'PicoLiga',
      database: 'ok',
      storage: 'cloudinary',
    })
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.get('/api/bootstrap', async (request, response) => {
  response.json(await repository.getBootstrap(getToken(request)))
})

app.get('/api/auth/options', async (_, response) => {
  response.json(await repository.getReferenceData())
})

app.post('/api/auth/register', async (request, response) => {
  try {
    validateRegistrationPayload(request.body)
    response.status(201).json(await repository.registerUser(request.body))
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/auth/login', async (request, response) => {
  try {
    response.json(await repository.loginUser(request.body))
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.get('/api/me', requireAuth, async (request, response) => {
  response.json({ user: request.currentUser })
})

app.put('/api/me', requireAuth, async (request, response) => {
  try {
    validateProfilePayload(request.body)
    const user = await repository.updateUser(request.currentUser.id, request.body)
    response.json({ user })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/uploads/:kind', requireAuth, async (request, response) => {
  try {
    const kind = request.params.kind === 'video' ? 'video' : 'image'
    const file = await uploadSingleFile(kind, request, response)
    const uploaded = await uploadToCloudinary({
      buffer: file.buffer,
      filename: file.originalname || `${kind}-${randomUUID()}`,
      mimetype: file.mimetype,
      kind,
    })

    response.status(201).json({
      url: uploaded.url,
      filename: uploaded.publicId,
      mimetype: file.mimetype,
      size: file.size,
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.get('/api/picos', async (request, response) => {
  const currentUser = await getAuthenticatedUser(request)
  response.json({
    items: await repository.listPicos(
      {
        sportSlug: request.query.sportSlug,
      },
      currentUser?.id,
    ),
  })
})

app.get('/api/events', async (request, response) => {
  const currentUser = await getAuthenticatedUser(request)
  response.json({
    items: await repository.listEvents(currentUser?.id),
  })
})

app.get('/api/feed', async (request, response) => {
  const currentUser = await getAuthenticatedUser(request)
  const authorId =
    request.query.authorId === 'me' ? currentUser?.id || null : request.query.authorId || null

  response.json({
    items: await repository.listFeed(
      {
        authorId,
      },
      currentUser?.id,
    ),
  })
})

app.get('/api/people', requireAuth, async (request, response) => {
  response.json({
    items: await repository.listPeople(request.currentUser.id),
  })
})

app.post('/api/people/:userId/follow', requireAuth, async (request, response) => {
  try {
    response.status(201).json({
      item: await repository.toggleFollow(request.currentUser.id, request.params.userId),
      user: await repository.getUserByToken(getToken(request)),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.get('/api/picos/:slug', async (request, response) => {
  const currentUser = await getAuthenticatedUser(request)
  const item = await repository.getPicoBySlug(request.params.slug, currentUser?.id)

  if (!item) {
    response.status(404).json({ error: 'Pico nao encontrado.' })
    return
  }

  response.json({ item })
})

app.post('/api/picos', requireAuth, async (request, response) => {
  try {
    validatePicoPayload(request.body)
    response.status(201).json({
      item: await repository.createPico(request.currentUser.id, request.body),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/picos/:slug/campaigns', requireAuth, async (request, response) => {
  try {
    if (!request.body.title || !request.body.purpose || !Number(request.body.goalCents)) {
      throw new Error('Preencha titulo, objetivo e meta da vaquinha.')
    }
    response.status(201).json({
      item: await repository.openCampaign(request.currentUser.id, request.params.slug, request.body),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/picos/:slug/contributions', requireAuth, async (request, response) => {
  try {
    const amountCents = Number(request.body.amountCents)
    if (!amountCents || amountCents < 100) throw new Error('A contribuicao minima e de R$ 1.')
    response.status(201).json({
      item: await repository.addContribution(request.currentUser.id, request.params.slug, {
        amountCents,
      }),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/picos/:slug/events', requireAuth, async (request, response) => {
  try {
    if (!request.body.title || !request.body.startsAt || !request.body.sportId) {
      throw new Error('Preencha titulo, data e esporte do evento.')
    }
    response.status(201).json({
      item: await repository.addEvent(request.currentUser.id, request.params.slug, request.body),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/picos/:slug/media', requireAuth, async (request, response) => {
  try {
    if (!request.body.title || !request.body.fileUrl || !request.body.mediaType) {
      throw new Error('Preencha titulo, arquivo e tipo da midia.')
    }
    response.status(201).json({
      item: await repository.addMedia(request.currentUser.id, request.params.slug, request.body),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.post('/api/picos/:slug/vote', requireAuth, async (request, response) => {
  try {
    response.status(201).json({
      item: await repository.toggleVote(request.currentUser.id, request.params.slug),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.get('/api/dms', requireAuth, async (request, response) => {
  response.json({
    following: await repository.listFollowingPeople(request.currentUser.id),
    conversations: await repository.listDirectConversations(request.currentUser.id),
  })
})

app.post('/api/dms', requireAuth, async (request, response) => {
  try {
    if (!request.body.recipientUserId) {
      throw new Error('Escolha um perfil para abrir a conversa.')
    }
    response.status(201).json({
      conversation: await repository.openDirectConversation(
        request.currentUser.id,
        request.body.recipientUserId,
      ),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.get('/api/dms/:conversationId', requireAuth, async (request, response) => {
  const conversation = await repository.getDirectConversation(
    request.currentUser.id,
    request.params.conversationId,
  )

  if (!conversation) {
    response.status(404).json({ error: 'Conversa nao encontrada.' })
    return
  }

  response.json({ conversation })
})

app.post('/api/dms/:conversationId/messages', requireAuth, async (request, response) => {
  try {
    response.status(201).json({
      conversation: await repository.sendDirectMessage(
        request.currentUser.id,
        request.params.conversationId,
        request.body.text,
      ),
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

app.listen(port, () => {
  console.log(`PicoLiga API rodando em http://127.0.0.1:${port}`)
})
