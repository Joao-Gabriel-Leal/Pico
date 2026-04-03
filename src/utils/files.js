import { uploadFile } from '../api'

const maxImageBytes = 8 * 1024 * 1024
const maxVideoBytes = 60 * 1024 * 1024

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nao foi possivel processar a imagem selecionada.'))
    image.src = src
  })
}

function readRawFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo selecionado.'))
    reader.readAsDataURL(file)
  })
}

function getResizedDimensions(width, height, maxSide) {
  const longestSide = Math.max(width, height)
  if (longestSide <= maxSide) {
    return { width, height }
  }

  const scale = maxSide / longestSide
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

async function optimizeImageFile(file, options = {}) {
  const { maxSide = 1800, quality = 0.84 } = options
  const sourceDataUrl = await readRawFileAsDataUrl(file)
  const image = await loadImage(sourceDataUrl)
  const { width, height } = getResizedDimensions(image.width, image.height, maxSide)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Nao foi possivel preparar a imagem para envio.')
  }

  context.drawImage(image, 0, 0, width, height)

  const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg'

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (!value) {
          reject(new Error('Nao foi possivel gerar a imagem otimizada.'))
          return
        }
        resolve(value)
      },
      outputType,
      quality,
    )
  })

  const extension = outputType === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'imagem'}.${extension}`, {
    type: outputType,
  })
}

export function createPreviewUrl(file) {
  return URL.createObjectURL(file)
}

export function revokePreviewUrl(url) {
  if (url) URL.revokeObjectURL(url)
}

export async function uploadSelectedFile(file, { token, kind }) {
  const normalizedKind = kind === 'video' ? 'video' : 'image'
  const maxBytes = normalizedKind === 'video' ? maxVideoBytes : maxImageBytes

  if (file.size > maxBytes) {
    throw new Error(
      normalizedKind === 'video'
        ? 'O video precisa ter no maximo 60 MB para subir na demo.'
        : 'A imagem precisa ter no maximo 8 MB antes da otimizacao.',
    )
  }

  const uploadableFile =
    normalizedKind === 'image' && file.type.startsWith('image/')
      ? await optimizeImageFile(file)
      : file

  try {
    const payload = await uploadFile(`/api/uploads/${normalizedKind}`, {
      file: uploadableFile,
      token,
    })

    return payload.url
  } catch (error) {
    if (/Invalid Signature/i.test(error.message)) {
      throw new Error(
        'Upload indisponivel no servidor agora. Revise CLOUDINARY_API_SECRET no Render.',
      )
    }

    throw error
  }
}
