import bcrypt from 'bcryptjs'
import { closeDatabase, query, withTransaction } from '../backend/db.js'
import { runSqlFile } from './run-sql-file.js'

const demoUserDefinitions = [
  {
    key: 'admin',
    email: 'admin@admin.com',
    username: 'admin',
    password: '123',
    displayName: 'Admin PicoHunter',
    bio: 'Cuidando do mapa, da crew e do caos organizado da plataforma.',
    avatarSeed: 'AdminPicoHunter',
    latitude: -23.55052,
    longitude: -46.633308,
    accuracy: 18,
    favoriteSports: ['skate', 'corrida'],
    roles: ['admin', 'usuario'],
  },
  {
    key: 'teste',
    email: 'teste@teste.com',
    username: 'teste',
    password: '123',
    displayName: 'Teste PicoHunter',
    bio: 'Cacando pico, rota e historia nova por Brasilia.',
    avatarSeed: 'TestePicoHunter',
    latitude: -15.817708,
    longitude: -47.980237,
    accuracy: 12,
    favoriteSports: ['skate', 'corrida', 'bike'],
    roles: ['usuario'],
  },
  {
    key: 'maya',
    email: 'maya@picohunter.demo',
    username: 'maya.street',
    password: '123456',
    displayName: 'Maya Street',
    bio: 'Skate no centro, foto granulada e sessao ate a madrugada.',
    avatarSeed: 'MayaStreet',
    latitude: -23.5489,
    longitude: -46.6397,
    accuracy: 12,
    favoriteSports: ['skate', 'bmx'],
    roles: ['moderador', 'usuario'],
  },
  {
    key: 'leo',
    email: 'leo@picohunter.demo',
    username: 'leo.bowl',
    password: '123456',
    displayName: 'Leo Bowl',
    bio: 'Patins, borda baixa e transicao lisa sao minha zona de conforto.',
    avatarSeed: 'LeoBowl',
    latitude: -23.5475,
    longitude: -46.7228,
    accuracy: 16,
    favoriteSports: ['patins', 'skate'],
    roles: ['colaborador', 'usuario'],
  },
  {
    key: 'bia',
    email: 'bia@picohunter.demo',
    username: 'bia.pace',
    password: '123456',
    displayName: 'Bia Pace',
    bio: 'Corrida urbana, longao cedinho e cafe forte depois do treino.',
    avatarSeed: 'BiaPace',
    latitude: -23.5874,
    longitude: -46.6576,
    accuracy: 10,
    favoriteSports: ['corrida', 'caminhada'],
    roles: ['usuario'],
  },
  {
    key: 'caio',
    email: 'caio@picohunter.demo',
    username: 'caio.bmx',
    password: '123456',
    displayName: 'Caio BMX',
    bio: 'Gap, coping e giro limpo. Quanto mais bruto, melhor.',
    avatarSeed: 'CaioBMX',
    latitude: -23.5275,
    longitude: -46.7066,
    accuracy: 14,
    favoriteSports: ['bmx', 'bike'],
    roles: ['colaborador', 'usuario'],
  },
  {
    key: 'nanda',
    email: 'nanda@picohunter.demo',
    username: 'nanda.court',
    password: '123456',
    displayName: 'Nanda Court',
    bio: 'Quadra cheia, som alto e ultimo arremesso valendo historia.',
    avatarSeed: 'NandaCourt',
    latitude: -23.5404,
    longitude: -46.4718,
    accuracy: 18,
    favoriteSports: ['basquete', 'skate'],
    roles: ['usuario'],
  },
  {
    key: 'gui',
    email: 'gui@picohunter.demo',
    username: 'gui.night',
    password: '123456',
    displayName: 'Gui Night',
    bio: 'Street no asfalto quente e role noturno sem pressa pra voltar.',
    avatarSeed: 'GuiNight',
    latitude: -23.5508,
    longitude: -46.6527,
    accuracy: 11,
    favoriteSports: ['skate', 'caminhada'],
    roles: ['usuario'],
  },
  {
    key: 'luna',
    email: 'luna@picohunter.demo',
    username: 'luna.loop',
    password: '123456',
    displayName: 'Luna Loop',
    bio: 'Bike e corrida misturadas em percursos longos pela cidade.',
    avatarSeed: 'LunaLoop',
    latitude: -23.5349,
    longitude: -46.657,
    accuracy: 13,
    favoriteSports: ['bike', 'corrida'],
    roles: ['usuario'],
  },
  {
    key: 'rafa',
    email: 'rafa@picohunter.demo',
    username: 'rafa.radar',
    password: '123456',
    displayName: 'Rafa Radar',
    bio: 'Tenis tecnico, olhar de scout e mania de descobrir ponto bom.',
    avatarSeed: 'RafaRadar',
    latitude: -23.6266,
    longitude: -46.6917,
    accuracy: 12,
    favoriteSports: ['tenis', 'corrida'],
    roles: ['usuario'],
  },
  {
    key: 'jess',
    email: 'jess@picohunter.demo',
    username: 'jess.signal',
    password: '123456',
    displayName: 'Jess Signal',
    bio: 'Basquete de rua, social media da crew e radar pra evento bom.',
    avatarSeed: 'JessSignal',
    latitude: -23.5418,
    longitude: -46.6505,
    accuracy: 17,
    favoriteSports: ['basquete', 'corrida'],
    roles: ['usuario'],
  },
  {
    key: 'pedro',
    email: 'pedro@picohunter.demo',
    username: 'pedro.drop',
    password: '123456',
    displayName: 'Pedro Drop',
    bio: 'BMX, filmagem vertical e linha de rua sem medo de repetir manobra.',
    avatarSeed: 'PedroDrop',
    latitude: -23.5617,
    longitude: -46.6559,
    accuracy: 12,
    favoriteSports: ['bmx', 'skate'],
    roles: ['usuario'],
  },
  {
    key: 'dora',
    email: 'dora@picohunter.demo',
    username: 'dora.wave',
    password: '123456',
    displayName: 'Dora Wave',
    bio: 'Agua aberta, caminhada longa e conteudo limpo de nascer do sol.',
    avatarSeed: 'DoraWave',
    latitude: -23.7424,
    longitude: -46.7022,
    accuracy: 20,
    favoriteSports: ['natacao', 'caminhada'],
    roles: ['usuario'],
  },
  {
    key: 'vic',
    email: 'vic@picohunter.demo',
    username: 'vic.line',
    password: '123456',
    displayName: 'Vic Line',
    bio: 'Street spot novo, cap ruim e vontade boa de descobrir pico escondido.',
    avatarSeed: 'VicLine',
    latitude: -23.5365,
    longitude: -46.6366,
    accuracy: 16,
    favoriteSports: ['skate', 'bike'],
    roles: ['usuario'],
  },
]

const basePicoDefinitions = [
  {
    key: 'anhangabau',
    name: 'Vale Anhangabau Plaza',
    slug: 'ph-vale-anhangabau-plaza',
    sportSlug: 'skate',
    createdByKey: 'maya',
    admins: ['maya', 'admin', 'teste'],
    latitude: -23.5489,
    longitude: -46.6397,
    description:
      'Pico central com bordas, corrimao, escada curta e fluxo constante de gente filmando e treinando.',
    statusText: 'Concreto seco, borda lisa e movimento forte no fim da tarde.',
    conditionLabel: 'Street vivo',
    coverSeed: 'anhangabau-plaza',
    approvalStatus: 'approved',
    createdHoursAgo: 1480,
  },
  {
    key: 'roosevelt',
    name: 'Roosevelt After Hours',
    slug: 'ph-roosevelt-after-hours',
    sportSlug: 'skate',
    createdByKey: 'gui',
    admins: ['gui', 'maya', 'teste'],
    latitude: -23.5508,
    longitude: -46.6527,
    description:
      'Sessao noturna classica com escadaria, corrimao e ponto de encontro da cena de rua.',
    statusText: 'Piso rapido, luz boa a noite e crowd colando pesado.',
    conditionLabel: 'Noite acesa',
    coverSeed: 'roosevelt-after-hours',
    approvalStatus: 'approved',
    createdHoursAgo: 1420,
  },
  {
    key: 'villa-lobos',
    name: 'Villa Lobos Bowl Lab',
    slug: 'ph-villa-lobos-bowl-lab',
    sportSlug: 'bmx',
    createdByKey: 'caio',
    admins: ['caio', 'leo', 'admin'],
    latitude: -23.5475,
    longitude: -46.7228,
    description:
      'Transicao ampla para BMX, patins e skate com espaco bom pra treino tecnico e filmagem.',
    statusText: 'Coping limpo, bowl veloz e area boa pra aquecer.',
    conditionLabel: 'Transicao forte',
    coverSeed: 'villa-lobos-bowl',
    approvalStatus: 'approved',
    createdHoursAgo: 1360,
  },
  {
    key: 'ibirapuera',
    name: 'Ibirapuera Speed Loop',
    slug: 'ph-ibirapuera-speed-loop',
    sportSlug: 'corrida',
    createdByKey: 'bia',
    admins: ['bia', 'luna', 'teste'],
    latitude: -23.5874,
    longitude: -46.6576,
    description:
      'Circuito urbano para corrida com trechos planos, sombra parcial e muita gente treinando em grupo.',
    statusText: 'Percurso firme, fluxo alto e ritmo bom cedo.',
    conditionLabel: 'Treino classico',
    coverSeed: 'ibirapuera-speed-loop',
    approvalStatus: 'approved',
    createdHoursAgo: 1300,
  },
  {
    key: 'minhocao',
    name: 'Minhocao Night Run',
    slug: 'ph-minhocao-night-run',
    sportSlug: 'caminhada',
    createdByKey: 'luna',
    admins: ['luna', 'bia', 'teste'],
    latitude: -23.5349,
    longitude: -46.657,
    description:
      'Trecho aberto para caminhada e trote noturno, com cidade viva, boa reta e muita exploracao.',
    statusText: 'Trecho livre, visibilidade boa e clima de role urbano.',
    conditionLabel: 'Fluxo continuo',
    coverSeed: 'minhocao-night-run',
    approvalStatus: 'approved',
    createdHoursAgo: 1240,
  },
  {
    key: 'zona-leste',
    name: 'Zona Leste Court',
    slug: 'ph-zona-leste-court',
    sportSlug: 'basquete',
    createdByKey: 'nanda',
    admins: ['nanda', 'jess', 'admin'],
    latitude: -23.5404,
    longitude: -46.4718,
    description:
      'Quadra de rua com tabela forte, arquibancada improvisada e comunidade sempre puxando racha.',
    statusText: 'Tabela firme, piso seguro e bastante gente colando no fim do dia.',
    conditionLabel: 'Quadra quente',
    coverSeed: 'zona-leste-court',
    approvalStatus: 'approved',
    createdHoursAgo: 1180,
  },
  {
    key: 'brooklin',
    name: 'Brooklin Serve Club',
    slug: 'ph-brooklin-serve-club',
    sportSlug: 'tenis',
    createdByKey: 'rafa',
    admins: ['rafa', 'admin'],
    latitude: -23.6266,
    longitude: -46.6917,
    description:
      'Quadra com jogo tecnico, treino de saque e turma que mistura social com competencia.',
    statusText: 'Piso rapido, quadra marcada e jogo encaixando bem.',
    conditionLabel: 'Saque em dia',
    coverSeed: 'brooklin-serve-club',
    approvalStatus: 'approved',
    createdHoursAgo: 1120,
  },
  {
    key: 'carmo',
    name: 'Carmo Flow Park',
    slug: 'ph-carmo-flow-park',
    sportSlug: 'patins',
    createdByKey: 'leo',
    admins: ['leo', 'caio', 'teste'],
    latitude: -23.5725,
    longitude: -46.4715,
    description:
      'Role de patins com area aberta, piso liso e espaco bom para linhas de velocidade.',
    statusText: 'Piso limpo, curvas boas e treino rendendo.',
    conditionLabel: 'Flow liso',
    coverSeed: 'carmo-flow-park',
    approvalStatus: 'approved',
    createdHoursAgo: 1060,
  },
  {
    key: 'guarapiranga',
    name: 'Guarapiranga Open Water',
    slug: 'ph-guarapiranga-open-water',
    sportSlug: 'natacao',
    createdByKey: 'dora',
    admins: ['dora', 'luna', 'admin'],
    latitude: -23.7424,
    longitude: -46.7022,
    description:
      'Ponto de agua aberta para treino curto e medio, com entrada organizada pela comunidade.',
    statusText: 'Agua calma cedo, entrada segura e visual aberto.',
    conditionLabel: 'Agua lisa',
    coverSeed: 'guarapiranga-open-water',
    approvalStatus: 'approved',
    createdHoursAgo: 1000,
  },
  {
    key: 'paulista',
    name: 'Paulista Freestyle Pocket',
    slug: 'ph-paulista-freestyle-pocket',
    sportSlug: 'bmx',
    createdByKey: 'pedro',
    admins: ['pedro', 'maya', 'teste'],
    latitude: -23.5617,
    longitude: -46.6559,
    description:
      'Pocket de rua para manobra rapida, encontro de crews e conteudo curto com a cidade de fundo.',
    statusText: 'Asfalto seco, linha curta e vibe boa pra filmar.',
    conditionLabel: 'Pocket urbano',
    coverSeed: 'paulista-freestyle-pocket',
    approvalStatus: 'approved',
    createdHoursAgo: 940,
  },
  {
    key: 'lapa-bike',
    name: 'Lapa Bike Yard',
    slug: 'ph-lapa-bike-yard',
    sportSlug: 'bike',
    createdByKey: 'caio',
    admins: ['caio', 'luna', 'admin'],
    latitude: -23.5275,
    longitude: -46.7066,
    description:
      'Ponto de encontro para pedal forte, sprint curto e saida para percursos mais longos.',
    statusText: 'Entrada limpa, asfalto bom e grupo fechando giro direto.',
    conditionLabel: 'Giro pesado',
    coverSeed: 'lapa-bike-yard',
    approvalStatus: 'approved',
    createdHoursAgo: 880,
  },
  {
    key: 'luz',
    name: 'Luz Street Grid',
    slug: 'ph-luz-street-grid',
    sportSlug: 'skate',
    createdByKey: 'vic',
    admins: ['vic', 'maya'],
    latitude: -23.5365,
    longitude: -46.6366,
    description:
      'Spot novo ainda em observacao, com potencial de linha forte e sessao grande nos proximos meses.',
    statusText: 'Ajustando leitura do piso e validando pontos de entrada.',
    conditionLabel: 'Em descoberta',
    coverSeed: 'luz-street-grid',
    approvalStatus: 'pending',
    createdHoursAgo: 120,
  },
]

const brasiliaRegionDefinitions = [
  {
    slug: 'guara-1',
    name: 'Guara 1',
    latitude: -15.817708,
    longitude: -47.980237,
    sportSlugs: ['skate', 'bmx', 'skate', 'patins', 'skate'],
    creatorKeys: ['teste', 'pedro', 'vic', 'maya'],
  },
  {
    slug: 'guara-2',
    name: 'Guara 2',
    latitude: -15.838944,
    longitude: -47.985294,
    sportSlugs: ['skate', 'bmx', 'basquete', 'skate', 'patins'],
    creatorKeys: ['teste', 'caio', 'pedro', 'jess'],
  },
  {
    slug: 'asa-sul',
    name: 'Asa Sul',
    latitude: -15.812753,
    longitude: -47.900437,
    sportSlugs: ['skate', 'basquete', 'corrida', 'skate', 'bike'],
    creatorKeys: ['teste', 'maya', 'bia', 'luna'],
  },
  {
    slug: 'vicente-pires',
    name: 'Vicente Pires',
    latitude: -15.803433,
    longitude: -48.027542,
    sportSlugs: ['skate', 'bmx', 'bike', 'skate', 'basquete'],
    creatorKeys: ['teste', 'caio', 'vic', 'nanda'],
  },
]

const brasiliaSpotNames = [
  'Escadaria Central',
  'Corrimao Cru',
  'Street Plaza',
  'Ledge Bruto',
  'Gap de Concreto',
  'Manual Pad',
  'Pocket Urbano',
  'Bowl de Rua',
  'Set da Crew',
  'Linha Norte',
  'Grid Sul',
  'Piso Rapido',
  'Borda Baixa',
  'Drop da Quadra',
  'Fluxo Noturno',
  'Base da Session',
  'Rail da Avenida',
  'Praça de Concreto',
  'Banco Longo',
  'Hub do Role',
  'Ponto do Corrimao',
  'Street Block',
  'Escadaria Leste',
  'Escadaria Oeste',
  'Concreto Vivo',
]

function describeBrasiliaSpot(regionName, sportSlug) {
  if (sportSlug === 'basquete') {
    return `Quadra de rua em ${regionName} com tabela firme, lateral aberta e galera colando no fim do dia.`
  }

  if (sportSlug === 'corrida') {
    return `Ponto urbano em ${regionName} com circuito curto, piso regular e saida boa para treino de ritmo.`
  }

  if (sportSlug === 'bike') {
    return `Pico em ${regionName} com reta boa, curvas abertas e encontro frequente da crew do pedal.`
  }

  if (sportSlug === 'patins') {
    return `Spot em ${regionName} com piso liso, area aberta e linhas boas para role de patins.`
  }

  if (sportSlug === 'bmx') {
    return `Point em ${regionName} com gap, transicao curta e leitura boa para BMX street.`
  }

  return `Spot em ${regionName} com escadaria, corrimao e bordas prontas para sessao de skate street.`
}

function createBrasiliaPicoDefinitions() {
  const items = []
  let globalIndex = 0

  for (const region of brasiliaRegionDefinitions) {
    for (let index = 0; index < 25; index += 1) {
      const row = Math.floor(index / 5) - 2
      const column = (index % 5) - 2
      const latitude = Number(
        (region.latitude + row * 0.0038 + (index % 2 === 0 ? 0.0007 : -0.0006)).toFixed(6),
      )
      const longitude = Number(
        (region.longitude + column * 0.0046 + (index % 3 === 0 ? 0.0009 : -0.0005)).toFixed(6),
      )
      const spotName = brasiliaSpotNames[index % brasiliaSpotNames.length]
      const sportSlug = region.sportSlugs[index % region.sportSlugs.length]
      const key = `bsb-${region.slug}-${String(index + 1).padStart(2, '0')}`

      items.push({
        key,
        name: `${spotName} ${region.name}`,
        slug: `ph-${key}`,
        sportSlug,
        createdByKey: region.creatorKeys[index % region.creatorKeys.length],
        admins: unique(['teste', 'admin', region.creatorKeys[index % region.creatorKeys.length]]),
        latitude,
        longitude,
        description: describeBrasiliaSpot(region.name, sportSlug),
        statusText: 'Piso seco, sessao viva e point mapeado pela comunidade local.',
        conditionLabel: sportSlug === 'skate' || sportSlug === 'bmx' ? 'Street forte' : 'Pico ativo',
        coverSeed: key,
        approvalStatus: 'approved',
        createdHoursAgo: 760 - globalIndex * 2,
        seedMedia: globalIndex < 16,
      })
      globalIndex += 1
    }
  }

  return items
}

const picoDefinitions = [...basePicoDefinitions, ...createBrasiliaPicoDefinitions()]

const legacyPicoSlugs = ['jdjfj', 'teste']

const mediaTemplates = {
  skate: ['Linha no corrimao', 'Drop de fim de tarde', 'Session de rua pesada', 'Frame no concreto'],
  basquete: ['Racha quente', 'Ultimo lance na quadra', 'Treino de arremesso', 'Crowd na lateral'],
  futebol: ['Partida valendo tudo', 'Lance de area', 'Treino no campo', 'Gol saindo no fim'],
  tenis: ['Troca longa na quadra', 'Saque encaixado', 'Ponto tecnico', 'Treino fino'],
  patins: ['Flow no piso liso', 'Linha sem freio', 'Entrada limpa', 'Role esticado'],
  bmx: ['Gap acertado', 'Linha de transicao', 'Manobra no coping', 'Clip bruto'],
  corrida: ['Treino de ritmo', 'Tiro no asfalto', 'Pace encaixado', 'Longao urbano'],
  bike: ['Sprint saindo do grid', 'Curva limpa', 'Pedal de madrugada', 'Giro encaixado'],
  caminhada: ['Role explorando o bairro', 'Passo leve no fim do dia', 'Percurso aberto', 'Cidade acesa'],
  natacao: ['Entrada na agua lisa', 'Travessia curta', 'Respiracao encaixada', 'Nado cedo'],
}

const commentPool = [
  'essa sessao ficou absurda',
  'luz perfeita nesse horario',
  'esse pico ta muito vivo',
  'clip limpo demais',
  'vou colar ai no proximo role',
  'linha encaixou bonita',
  'essa borda ta pedindo repeticao',
  'conteudo forte demais',
  'esse lugar rende muito',
  'quero ver mais desse pico',
  'a crew tava pesada nesse dia',
  'angulo ficou animal',
  'essa manobra merecia mais uma camera',
  'ritmo bonito nesse trecho',
  'essa quadra sempre entrega',
  'essa agua ta convidativa demais',
  'filmagem simples e muito forte',
  'ja salvei esse point aqui',
]

const campaignDefinitions = [
  {
    picoKey: 'anhangabau',
    createdByKey: 'maya',
    title: 'Luz e limpeza para a sessao do Vale',
    purpose: 'Levantar grana para reforcar a iluminacao e organizar mutirao de limpeza no pico.',
    goalCents: 850000,
    status: 'active',
    createdHoursAgo: 220,
    contributions: [
      { userKey: 'teste', amountCents: 60000, hoursAgo: 180 },
      { userKey: 'admin', amountCents: 120000, hoursAgo: 176 },
      { userKey: 'gui', amountCents: 50000, hoursAgo: 172 },
      { userKey: 'pedro', amountCents: 85000, hoursAgo: 160 },
      { userKey: 'vic', amountCents: 70000, hoursAgo: 140 },
      { userKey: 'jess', amountCents: 30000, hoursAgo: 110 },
    ],
  },
  {
    picoKey: 'zona-leste',
    createdByKey: 'nanda',
    title: 'Rede nova e reforma da lateral da quadra',
    purpose: 'Fechar a reforma da rede, pintura e banco lateral para jogos e eventos.',
    goalCents: 300000,
    status: 'funded',
    createdHoursAgo: 360,
    contributions: [
      { userKey: 'admin', amountCents: 80000, hoursAgo: 320 },
      { userKey: 'teste', amountCents: 50000, hoursAgo: 300 },
      { userKey: 'jess', amountCents: 40000, hoursAgo: 296 },
      { userKey: 'nanda', amountCents: 30000, hoursAgo: 280 },
      { userKey: 'maya', amountCents: 45000, hoursAgo: 250 },
      { userKey: 'gui', amountCents: 30000, hoursAgo: 240 },
      { userKey: 'rafa', amountCents: 35000, hoursAgo: 210 },
    ],
  },
  {
    picoKey: 'guarapiranga',
    createdByKey: 'dora',
    title: 'Boias e apoio de seguranca',
    purpose: 'Montar estrutura minima para entrada organizada e apoio no treino de agua aberta.',
    goalCents: 260000,
    status: 'closed',
    createdHoursAgo: 460,
    contributions: [
      { userKey: 'dora', amountCents: 20000, hoursAgo: 430 },
      { userKey: 'luna', amountCents: 30000, hoursAgo: 410 },
      { userKey: 'teste', amountCents: 25000, hoursAgo: 390 },
      { userKey: 'bia', amountCents: 15000, hoursAgo: 370 },
      { userKey: 'admin', amountCents: 40000, hoursAgo: 350 },
    ],
  },
  {
    picoKey: 'villa-lobos',
    createdByKey: 'caio',
    title: 'Reforco de coping e mutirao no bowl',
    purpose: 'Juntar verba para pequenos reparos, tinta e material de manutencao.',
    goalCents: 500000,
    status: 'active',
    createdHoursAgo: 260,
    contributions: [
      { userKey: 'leo', amountCents: 45000, hoursAgo: 230 },
      { userKey: 'caio', amountCents: 60000, hoursAgo: 220 },
      { userKey: 'pedro', amountCents: 35000, hoursAgo: 205 },
      { userKey: 'maya', amountCents: 25000, hoursAgo: 180 },
      { userKey: 'teste', amountCents: 30000, hoursAgo: 170 },
    ],
  },
]

const eventDefinitions = [
  {
    picoKey: 'roosevelt',
    createdByKey: 'gui',
    title: 'Jam de sexta na Roosevelt',
    description: 'Sessao aberta com filmagem livre e premios simples para melhor linha.',
    sportSlug: 'skate',
    startsHoursFromNow: 48,
    entryFeeCents: 2000,
    prizePoolCents: 15000,
    approvalStatus: 'approved',
  },
  {
    picoKey: 'ibirapuera',
    createdByKey: 'bia',
    title: 'Treino 10K ritmo progressivo',
    description: 'Encontro para aquecimento, tiros curtos e fechamento em pace firme.',
    sportSlug: 'corrida',
    startsHoursFromNow: 72,
    entryFeeCents: 0,
    prizePoolCents: 0,
    approvalStatus: 'approved',
  },
  {
    picoKey: 'minhocao',
    createdByKey: 'luna',
    title: 'Role guiado no Minhocao',
    description: 'Caminhada longa de exploracao urbana com parada para conteudo no fim.',
    sportSlug: 'caminhada',
    startsHoursFromNow: 96,
    entryFeeCents: 0,
    prizePoolCents: 0,
    approvalStatus: 'approved',
  },
  {
    picoKey: 'villa-lobos',
    createdByKey: 'caio',
    title: 'BMX jam de domingo',
    description: 'Bateria aberta no bowl com juiz da comunidade e premio de loja parceira.',
    sportSlug: 'bmx',
    startsHoursFromNow: 132,
    entryFeeCents: 3500,
    prizePoolCents: 25000,
    approvalStatus: 'approved',
  },
  {
    picoKey: 'zona-leste',
    createdByKey: 'nanda',
    title: 'Racha 3x3 Zona Leste',
    description: 'Times montados na hora, DJ local e arrecadacao para a quadra.',
    sportSlug: 'basquete',
    startsHoursFromNow: 160,
    entryFeeCents: 1500,
    prizePoolCents: 12000,
    approvalStatus: 'approved',
  },
  {
    picoKey: 'brooklin',
    createdByKey: 'rafa',
    title: 'Clinica de saque e devolucao',
    description: 'Treino tecnico curto com rotacao por duplas e analise em video.',
    sportSlug: 'tenis',
    startsHoursFromNow: 196,
    entryFeeCents: 5000,
    prizePoolCents: 0,
    approvalStatus: 'approved',
  },
  {
    picoKey: 'guarapiranga',
    createdByKey: 'dora',
    title: 'Travessia curta de sabado',
    description: 'Treino orientado com aquecimento em terra e volta curta na agua.',
    sportSlug: 'natacao',
    startsHoursFromNow: 240,
    entryFeeCents: 0,
    prizePoolCents: 0,
    approvalStatus: 'approved',
  },
  {
    picoKey: 'paulista',
    createdByKey: 'pedro',
    title: 'Pocket clip session',
    description: 'Sessao de gravacao para clips curtos e premiere interna da crew.',
    sportSlug: 'bmx',
    startsHoursFromNow: 288,
    entryFeeCents: 1000,
    prizePoolCents: 8000,
    approvalStatus: 'pending',
  },
]

const conversationDefinitions = [
  {
    key: 'teste-maya',
    isGroup: false,
    createdByKey: 'teste',
    participants: ['teste', 'maya'],
    startHoursAgo: 42,
    stepMinutes: 34,
    lastReadMessageIndexByUser: { teste: 5, maya: 7 },
    messages: [
      { senderKey: 'maya', text: 'Anhangabau ta encaixando bonito hoje. Vai colar?' },
      { senderKey: 'teste', text: 'Saio em 40 min. Como esta a borda central?' },
      { senderKey: 'maya', text: 'Seca e rapida. Crowd grande mas girando bem.' },
      {
        senderKey: 'maya',
        type: 'shared_media',
        mediaKey: 'anhangabau-feed-1',
        note: 'Olha a linha de ontem pra animar',
      },
      { senderKey: 'teste', text: 'Essa ficou muito forte. Vou levar a camera pequena.' },
      { senderKey: 'maya', text: 'Fechou. A galera vai subir clip depois.' },
      { senderKey: 'maya', text: 'Se colar cedo pega a luz melhor na escada.' },
      { senderKey: 'teste', text: 'To indo. Guarda um canto ali no corrimao.' },
    ],
  },
  {
    key: 'teste-bia',
    isGroup: false,
    createdByKey: 'bia',
    participants: ['teste', 'bia'],
    startHoursAgo: 38,
    stepMinutes: 28,
    lastReadMessageIndexByUser: { teste: 6, bia: 6 },
    messages: [
      { senderKey: 'bia', text: 'Tem longao leve no Ibirapuera cedo amanha.' },
      { senderKey: 'teste', text: 'Quantos km e qual pace de saida?' },
      { senderKey: 'bia', text: 'Uns 12 km, inicio controlado e final soltando.' },
      { senderKey: 'teste', text: 'Curti. Se eu nao virar na sessao eu vou.' },
      { senderKey: 'bia', text: 'Vai render conteudo bonito com essa luz limpa.' },
      {
        senderKey: 'bia',
        type: 'shared_media',
        mediaKey: 'ibirapuera-feed-1',
        note: 'Esse foi o ritmo de hoje cedo',
      },
      { senderKey: 'teste', text: 'Boa. Vou tentar colar no primeiro bloco.' },
    ],
  },
  {
    key: 'teste-gui',
    isGroup: false,
    createdByKey: 'gui',
    participants: ['teste', 'gui'],
    startHoursAgo: 30,
    stepMinutes: 22,
    lastReadMessageIndexByUser: { teste: 4, gui: 5 },
    messages: [
      { senderKey: 'gui', text: 'Roosevelt vai ficar cheia hoje. Quer subir mais cedo?' },
      { senderKey: 'teste', text: 'Quero. To tentando pegar o pico antes do caos.' },
      {
        senderKey: 'gui',
        type: 'shared_media',
        mediaKey: 'roosevelt-feed-2',
        note: 'Clip de ontem no corrimao',
      },
      { senderKey: 'teste', text: 'Esse angulo ficou muito bom.' },
      { senderKey: 'gui', text: 'Se chegar 20h da pra filmar sem aperto ainda.' },
      { senderKey: 'gui', text: 'Maya e Vic tambem disseram que colam.' },
    ],
  },
  {
    key: 'admin-maya',
    isGroup: false,
    createdByKey: 'admin',
    participants: ['admin', 'maya'],
    startHoursAgo: 70,
    stepMinutes: 31,
    lastReadMessageIndexByUser: { admin: 4, maya: 4 },
    messages: [
      { senderKey: 'admin', text: 'Aprovacao do Vale entrou bem e os dados estao redondos.' },
      { senderKey: 'maya', text: 'Boa. Queria deixar o feed desse pico forte logo de cara.' },
      { senderKey: 'admin', text: 'Ja subi campanha e varios perfis engajando por la.' },
      { senderKey: 'maya', text: 'Perfeito, isso vai puxar a comunidade do centro.' },
      { senderKey: 'admin', text: 'Qualquer ajuste me chama e eu destravo rapido.' },
    ],
  },
  {
    key: 'caio-pedro',
    isGroup: false,
    createdByKey: 'caio',
    participants: ['caio', 'pedro'],
    startHoursAgo: 55,
    stepMinutes: 26,
    lastReadMessageIndexByUser: { caio: 5, pedro: 5 },
    messages: [
      { senderKey: 'caio', text: 'Villa Lobos ta com transicao muito boa essa semana.' },
      { senderKey: 'pedro', text: 'Quero filmar gap e pocket no mesmo dia.' },
      { senderKey: 'caio', text: 'Da pra fechar os dois se comecar cedo.' },
      {
        senderKey: 'pedro',
        type: 'shared_media',
        mediaKey: 'paulista-feed-1',
        note: 'Pocket que subi agora pouco',
      },
      { senderKey: 'caio', text: 'Esse clip pediu segunda camera.' },
      { senderKey: 'pedro', text: 'Fechou. Domingo a gente faz isso direito.' },
    ],
  },
  {
    key: 'crew-roosevelt',
    isGroup: true,
    title: 'Crew Roosevelt',
    avatarSeed: 'CrewRoosevelt',
    createdByKey: 'gui',
    participants: ['gui', 'maya', 'teste', 'pedro', 'vic'],
    startHoursAgo: 24,
    stepMinutes: 18,
    lastReadMessageIndexByUser: { teste: 6, maya: 8, gui: 8, pedro: 7, vic: 8 },
    messages: [
      { senderKey: 'gui', text: 'Hoje a Roosevelt ta valendo clip.' },
      { senderKey: 'pedro', text: 'Levo iluminador pequeno e lente curta.' },
      { senderKey: 'maya', text: 'Quero abrir na escada antes de encher.' },
      { senderKey: 'vic', text: 'Colei mais cedo e o piso ta seco.' },
      { senderKey: 'teste', text: 'To saindo agora do trabalho.' },
      {
        senderKey: 'gui',
        type: 'shared_media',
        mediaKey: 'roosevelt-feed-1',
        note: 'Pra entrar no clima',
      },
      { senderKey: 'maya', text: 'Essa sessao ja virou capa.' },
      { senderKey: 'pedro', text: 'Depois bora pocket na Paulista?' },
      { senderKey: 'gui', text: 'Se sobrar perna eu vou.' },
    ],
  },
  {
    key: 'longao-sabado',
    isGroup: true,
    title: 'Longao de Sabado',
    avatarSeed: 'LongaoSabado',
    createdByKey: 'bia',
    participants: ['bia', 'luna', 'dora', 'teste'],
    startHoursAgo: 20,
    stepMinutes: 20,
    lastReadMessageIndexByUser: { teste: 5, bia: 6, luna: 6, dora: 6 },
    messages: [
      { senderKey: 'bia', text: 'Fechei percurso novo saindo do parque.' },
      { senderKey: 'luna', text: 'Se quiser eu puxo aquecimento de bike antes.' },
      { senderKey: 'dora', text: 'Posso levar agua e gel pra galera.' },
      { senderKey: 'teste', text: 'Esse grupo ta profissional demais.' },
      {
        senderKey: 'bia',
        type: 'shared_media',
        mediaKey: 'ibirapuera-feed-2',
        note: 'Ultimo treino antes do longao',
      },
      { senderKey: 'luna', text: 'Fechou sair 6h20?' },
      { senderKey: 'bia', text: '6h20 cravado na entrada principal.' },
    ],
  },
  {
    key: 'quadra-projeto',
    isGroup: true,
    title: 'Projeto da Quadra',
    avatarSeed: 'ProjetoQuadra',
    createdByKey: 'nanda',
    participants: ['nanda', 'jess', 'admin', 'teste'],
    startHoursAgo: 18,
    stepMinutes: 21,
    lastReadMessageIndexByUser: { teste: 6, admin: 6, nanda: 7, jess: 7 },
    messages: [
      { senderKey: 'nanda', text: 'Campanha da quadra bateu muito bem hoje.' },
      { senderKey: 'jess', text: 'Postei mais um carrossel e o alcance subiu.' },
      { senderKey: 'admin', text: 'O pico ja esta aparecendo como referencia na home.' },
      { senderKey: 'teste', text: 'Posso puxar mais comentarios e saves no feed.' },
      {
        senderKey: 'jess',
        type: 'shared_media',
        mediaKey: 'zona-leste-feed-1',
        note: 'Esse post esta trazendo gente',
      },
      { senderKey: 'nanda', text: 'Boa, quero lotar o evento do 3x3.' },
      { senderKey: 'admin', text: 'Se precisar, eu aprovo mais rapido o material.' },
      { senderKey: 'jess', text: 'Amanha cedo subo mais um teaser.' },
    ],
  },
]

const baseTimestamp = new Date('2026-04-03T20:00:00-03:00').getTime()
const oneMinute = 60 * 1000
const oneHour = 60 * oneMinute
const skatePhotoUrls = [
  'https://images.pexels.com/photos/20607513/pexels-photo-20607513.jpeg?cs=srgb&dl=pexels-harry-silva-105653502-20607513.jpg&fm=jpg',
  'https://images.pexels.com/photos/17971323/pexels-photo-17971323.jpeg?cs=srgb&dl=pexels-detrasdelfotografo-17971323.jpg&fm=jpg',
  'https://images.pexels.com/photos/5370366/pexels-photo-5370366.jpeg?cs=srgb&dl=pexels-allan-mas-5370366.jpg&fm=jpg',
  'https://images.pexels.com/photos/5368972/pexels-photo-5368972.jpeg?cs=srgb&dl=pexels-allan-mas-5368972.jpg&fm=jpg',
  'https://images.pexels.com/photos/18235760/pexels-photo-18235760.jpeg?cs=srgb&dl=pexels-elkady-18235760.jpg&fm=jpg',
  'https://images.pexels.com/photos/12185059/pexels-photo-12185059.jpeg?cs=srgb&dl=pexels-yuraforrat-12185059.jpg&fm=jpg',
  'https://images.pexels.com/photos/5369408/pexels-photo-5369408.jpeg?cs=srgb&dl=pexels-allan-mas-5369408.jpg&fm=jpg',
  'https://images.unsplash.com/photo-1639676074853-46a562a0ef11?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&dl=sasha-cures-rWADSL-EoUE-unsplash.jpg',
  'https://images.unsplash.com/photo-1661916124103-231e84249221?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&dl=thom-bradley-4bbcd1Y_2xw-unsplash.jpg',
]
const skateVideoUrls = [
  'https://videos.pexels.com/video-files/35540335/15056467_1080_1920_30fps.mp4',
  'https://videos.pexels.com/video-files/33489923/14245060_1080_1920_30fps.mp4',
  'https://cdn.pixabay.com/video/2020/09/12/49791-459802177_large.mp4',
  'https://cdn.pixabay.com/video/2020/05/02/37845-415200790_large.mp4',
]

function avatarUrl(seed) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(
    seed,
  )}&backgroundColor=1a1328,312e81,581c87`
}

function hashString(value) {
  let hash = 0
  const input = String(value || '')

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }

  return hash
}

function pickSeededAsset(seed, assets) {
  if (!assets.length) return ''
  return assets[hashString(seed) % assets.length]
}

function photoUrl(seed) {
  return pickSeededAsset(seed, skatePhotoUrls)
}

function isoFromTimestamp(timestamp) {
  return new Date(timestamp).toISOString()
}

function hoursAgo(hours) {
  return isoFromTimestamp(baseTimestamp - hours * oneHour)
}

function hoursFromNow(hours) {
  return isoFromTimestamp(baseTimestamp + hours * oneHour)
}

function addMinutes(isoString, minutes) {
  return isoFromTimestamp(new Date(isoString).getTime() + minutes * oneMinute)
}

function rotate(items, offset) {
  if (!items.length) return []
  const normalized = ((offset % items.length) + items.length) % items.length
  return [...items.slice(normalized), ...items.slice(0, normalized)]
}

function unique(items) {
  return [...new Set(items)]
}

function pickUserKeys(userKeys, offset, count, excludedKeys = []) {
  return rotate(userKeys, offset)
    .filter((userKey) => !excludedKeys.includes(userKey))
    .slice(0, count)
}

function getMediaTitles(sportSlug) {
  return mediaTemplates[sportSlug] || mediaTemplates.skate
}

async function getReferenceMaps(client) {
  const [sportResult, roleResult] = await Promise.all([
    client.query('select id, slug from sport'),
    client.query('select id, slug from role'),
  ])

  return {
    sportIdBySlug: new Map(sportResult.rows.map((row) => [row.slug, Number(row.id)])),
    roleIdBySlug: new Map(roleResult.rows.map((row) => [row.slug, Number(row.id)])),
  }
}

async function upsertDemoUsers(client) {
  const userIdByKey = new Map()

  for (const definition of demoUserDefinitions) {
    const passwordHash = await bcrypt.hash(definition.password, 10)
    const { rows } = await client.query(
      `
        insert into app_user (
          email,
          username,
          password_hash,
          latitude,
          longitude,
          location_accuracy
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (email) do update
        set
          username = excluded.username,
          password_hash = excluded.password_hash,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          location_accuracy = excluded.location_accuracy
        returning id
      `,
      [
        definition.email,
        definition.username,
        passwordHash,
        definition.latitude,
        definition.longitude,
        definition.accuracy,
      ],
    )

    userIdByKey.set(definition.key, rows[0].id)
  }

  return userIdByKey
}

async function cleanupDemoData(client, demoUserIds, picoSlugs) {
  const { rows: picoRows } = await client.query('select id from pico where slug = any($1::text[])', [picoSlugs])
  const picoIds = picoRows.map((row) => row.id)

  const { rows: conversationRows } = await client.query(
    `
      select direct_conversation.id
      from direct_conversation
      join direct_conversation_participant
        on direct_conversation_participant.conversation_id = direct_conversation.id
      group by direct_conversation.id
      having bool_and(direct_conversation_participant.user_id = any($1::uuid[]))
    `,
    [demoUserIds],
  )
  const conversationIds = conversationRows.map((row) => row.id)

  await client.query('delete from auth_session where user_id = any($1::uuid[])', [demoUserIds])
  await client.query('delete from app_notification where user_id = any($1::uuid[])', [demoUserIds])

  if (conversationIds.length) {
    await client.query(
      `
        delete from direct_message_reaction
        where message_id in (
          select id
          from direct_message
          where conversation_id = any($1::uuid[])
        )
      `,
      [conversationIds],
    )
    await client.query('delete from direct_message where conversation_id = any($1::uuid[])', [conversationIds])
    await client.query('delete from direct_conversation_participant where conversation_id = any($1::uuid[])', [
      conversationIds,
    ])
    await client.query('delete from direct_conversation where id = any($1::uuid[])', [conversationIds])
  }

  if (picoIds.length) {
    const { rows: mediaRows } = await client.query('select id from pico_media where pico_id = any($1::uuid[])', [picoIds])
    const mediaIds = mediaRows.map((row) => row.id)

    if (mediaIds.length) {
      await client.query('delete from pico_media_comment where media_id = any($1::uuid[])', [mediaIds])
      await client.query('delete from pico_media_like where media_id = any($1::uuid[])', [mediaIds])
    }

    const { rows: campaignRows } = await client.query(
      'select id from crowdfunding_campaign where pico_id = any($1::uuid[])',
      [picoIds],
    )
    const campaignIds = campaignRows.map((row) => row.id)

    if (campaignIds.length) {
      await client.query('delete from crowdfunding_contribution where campaign_id = any($1::uuid[])', [campaignIds])
    }

    await client.query('delete from crowdfunding_campaign where pico_id = any($1::uuid[])', [picoIds])
    await client.query('delete from pico_event where pico_id = any($1::uuid[])', [picoIds])
    await client.query('delete from pico_media where pico_id = any($1::uuid[])', [picoIds])
    await client.query('delete from pico_visit where pico_id = any($1::uuid[])', [picoIds])
    await client.query('delete from pico_follow where pico_id = any($1::uuid[])', [picoIds])
    await client.query('delete from pico_vote where pico_id = any($1::uuid[])', [picoIds])
    await client.query('delete from pico_admin where pico_id = any($1::uuid[])', [picoIds])
    await client.query('delete from pico where id = any($1::uuid[])', [picoIds])
  }

  await client.query('delete from user_follow where follower_id = any($1::uuid[])', [demoUserIds])
  await client.query('delete from user_role where user_id = any($1::uuid[])', [demoUserIds])
  await client.query('delete from user_favorite_sport where user_id = any($1::uuid[])', [demoUserIds])
}

async function seedUserMetadata(client, userIdByKey, referenceMaps) {
  const adminId = userIdByKey.get('admin')

  for (const definition of demoUserDefinitions) {
    const userId = userIdByKey.get(definition.key)
    await client.query(
      `
        insert into profile (user_id, display_name, bio, avatar_url)
        values ($1, $2, $3, $4)
        on conflict (user_id) do update
        set
          display_name = excluded.display_name,
          bio = excluded.bio,
          avatar_url = excluded.avatar_url,
          updated_at = now()
      `,
      [userId, definition.displayName, definition.bio, avatarUrl(definition.avatarSeed)],
    )

    for (const roleSlug of definition.roles) {
      const roleId = referenceMaps.roleIdBySlug.get(roleSlug)
      if (!roleId) throw new Error(`Role nao encontrada: ${roleSlug}`)
      await client.query(
        `
          insert into user_role (user_id, role_id, granted_by)
          values ($1, $2, $3)
          on conflict do nothing
        `,
        [userId, roleId, adminId],
      )
    }

    for (const sportSlug of definition.favoriteSports) {
      const sportId = referenceMaps.sportIdBySlug.get(sportSlug)
      if (!sportId) throw new Error(`Esporte favorito nao encontrado: ${sportSlug}`)
      await client.query(
        `
          insert into user_favorite_sport (user_id, sport_id)
          values ($1, $2)
          on conflict do nothing
        `,
        [userId, sportId],
      )
    }
  }
}

async function seedFollowGraph(client, userIdByKey, notifications) {
  const userKeys = demoUserDefinitions.map((item) => item.key)
  const pairs = []

  for (const key of userKeys) {
    if (key !== 'teste') {
      pairs.push([key, 'teste'])
      pairs.push(['teste', key])
    }

    if (key !== 'admin' && key !== 'teste') {
      pairs.push([key, 'admin'])
      pairs.push(['admin', key])
    }
  }

  const crews = [
    ['maya', 'gui', 'pedro', 'vic', 'caio', 'leo'],
    ['bia', 'luna', 'dora', 'teste', 'rafa'],
    ['nanda', 'jess', 'teste', 'admin'],
  ]

  for (const crew of crews) {
    for (let index = 0; index < crew.length; index += 1) {
      const current = crew[index]
      const next = crew[(index + 1) % crew.length]
      pairs.push([current, next], [next, current])
    }
  }

  const seen = new Set()
  const uniquePairs = []
  for (const [followerKey, followingKey] of pairs) {
    if (!followerKey || !followingKey || followerKey === followingKey) continue
    const token = `${followerKey}:${followingKey}`
    if (seen.has(token)) continue
    seen.add(token)
    uniquePairs.push([followerKey, followingKey])
  }

  for (let index = 0; index < uniquePairs.length; index += 1) {
    const [followerKey, followingKey] = uniquePairs[index]
    const createdAt = hoursAgo(420 - index * 4)
    await client.query(
      `
        insert into user_follow (follower_id, following_id, created_at)
        values ($1, $2, $3)
        on conflict do nothing
      `,
      [userIdByKey.get(followerKey), userIdByKey.get(followingKey), createdAt],
    )

    if (index < 24) {
      notifications.push({
        userId: userIdByKey.get(followingKey),
        actorUserId: userIdByKey.get(followerKey),
        kind: 'follow',
        entityId: null,
        textPreview: '',
        createdAt,
        readAt: index < 8 ? addMinutes(createdAt, 90) : null,
      })
    }
  }
}

async function seedPicos(client, userIdByKey, referenceMaps) {
  const picoIdByKey = new Map()
  const approvedById = userIdByKey.get('admin')

  for (const definition of picoDefinitions) {
    const createdAt = hoursAgo(definition.createdHoursAgo)
    const updatedAt = addMinutes(createdAt, 90)
    const approvedAt = definition.approvalStatus === 'approved' ? addMinutes(createdAt, 45) : null
    const { rows } = await client.query(
      `
        insert into pico (
          created_by,
          primary_sport_id,
          name,
          slug,
          description,
          latitude,
          longitude,
          status_text,
          condition_label,
          cover_image_url,
          approval_status,
          approved_by,
          approved_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        on conflict (slug) do update
        set
          created_by = excluded.created_by,
          primary_sport_id = excluded.primary_sport_id,
          name = excluded.name,
          description = excluded.description,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          status_text = excluded.status_text,
          condition_label = excluded.condition_label,
          cover_image_url = excluded.cover_image_url,
          approval_status = excluded.approval_status,
          approved_by = excluded.approved_by,
          approved_at = excluded.approved_at,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
        returning id
      `,
      [
        userIdByKey.get(definition.createdByKey),
        referenceMaps.sportIdBySlug.get(definition.sportSlug),
        definition.name,
        definition.slug,
        definition.description,
        definition.latitude,
        definition.longitude,
        definition.statusText,
        definition.conditionLabel,
        photoUrl(definition.coverSeed, 1600, 900),
        definition.approvalStatus,
        definition.approvalStatus === 'approved' ? approvedById : null,
        approvedAt,
        createdAt,
        updatedAt,
      ],
    )

    picoIdByKey.set(definition.key, rows[0].id)
  }

  for (const definition of picoDefinitions) {
    for (const adminKey of unique(definition.admins)) {
      await client.query(
        `
          insert into pico_admin (pico_id, user_id, granted_by, created_at)
          values ($1, $2, $3, $4)
          on conflict do nothing
        `,
        [
          picoIdByKey.get(definition.key),
          userIdByKey.get(adminKey),
          userIdByKey.get('admin'),
          hoursAgo(definition.createdHoursAgo - 2),
        ],
      )
    }
  }

  return picoIdByKey
}

async function seedPicoEngagement(client, userIdByKey, picoIdByKey) {
  const userKeys = demoUserDefinitions.map((item) => item.key)
  const approvedPicos = picoDefinitions.filter((item) => item.approvalStatus === 'approved')

  for (let index = 0; index < approvedPicos.length; index += 1) {
    const pico = approvedPicos[index]
    const picoId = picoIdByKey.get(pico.key)
    const followKeys = pickUserKeys(userKeys, index + 1, 9)
    const voteKeys = pickUserKeys(userKeys, index + 3, 7)
    const visitKeys = pickUserKeys(userKeys, index + 5, 6)

    for (let inner = 0; inner < followKeys.length; inner += 1) {
      await client.query(
        `
          insert into pico_follow (pico_id, user_id, created_at)
          values ($1, $2, $3)
          on conflict do nothing
        `,
        [picoId, userIdByKey.get(followKeys[inner]), hoursAgo(260 - index * 10 - inner * 2)],
      )
    }

    for (let inner = 0; inner < voteKeys.length; inner += 1) {
      await client.query(
        `
          insert into pico_vote (pico_id, user_id, created_at)
          values ($1, $2, $3)
          on conflict do nothing
        `,
        [picoId, userIdByKey.get(voteKeys[inner]), hoursAgo(230 - index * 8 - inner * 3)],
      )
    }

    for (let inner = 0; inner < visitKeys.length; inner += 1) {
      await client.query(
        `
          insert into pico_visit (pico_id, user_id, created_at)
          values ($1, $2, $3)
          on conflict do nothing
        `,
        [picoId, userIdByKey.get(visitKeys[inner]), hoursAgo(180 - index * 7 - inner * 2)],
      )
    }
  }
}

function buildMediaBlueprints() {
  const approvedPicos = picoDefinitions.filter(
    (item) => item.approvalStatus === 'approved' && item.seedMedia !== false,
  )
  const userKeys = demoUserDefinitions.map((item) => item.key)
  const blueprints = []
  let mediaCounter = 0

  for (let index = 0; index < approvedPicos.length; index += 1) {
    const pico = approvedPicos[index]
    const titles = getMediaTitles(pico.sportSlug)
    const authors = pickUserKeys(userKeys, index + 2, 3)

    blueprints.push({
      key: `${pico.key}-feed-1`,
      picoKey: pico.key,
      userKey: authors[0],
      mediaScope: 'feed',
      mediaType: 'photo',
      title: `${titles[0]} em ${pico.name}`,
      fileUrl: photoUrl(`${pico.key}-feed-1`),
      viewsCount: 140 + mediaCounter * 17,
      createdAt: hoursAgo(210 - mediaCounter * 5),
    })
    mediaCounter += 1

    blueprints.push({
      key: `${pico.key}-feed-2`,
      picoKey: pico.key,
      userKey: authors[1],
      mediaScope: 'feed',
      mediaType: index % 2 === 0 ? 'video' : 'photo',
      title: `${titles[1]} em ${pico.name}`,
      fileUrl:
        index % 2 === 0
          ? skateVideoUrls[index % skateVideoUrls.length]
          : photoUrl(`${pico.key}-feed-2`),
      viewsCount: 190 + mediaCounter * 19,
      createdAt: hoursAgo(208 - mediaCounter * 5),
    })
    mediaCounter += 1

    blueprints.push({
      key: `${pico.key}-gallery-1`,
      picoKey: pico.key,
      userKey: authors[2],
      mediaScope: 'gallery',
      mediaType: 'photo',
      title: `${titles[2]} em ${pico.name}`,
      fileUrl: photoUrl(`${pico.key}-gallery-1`),
      viewsCount: 90 + mediaCounter * 13,
      createdAt: hoursAgo(206 - mediaCounter * 5),
    })
    mediaCounter += 1
  }

  return blueprints
}

async function seedMedia(client, userIdByKey, picoIdByKey, notifications) {
  const blueprints = buildMediaBlueprints()
  const mediaIdByKey = new Map()
  const userKeys = demoUserDefinitions.map((item) => item.key)

  for (const blueprint of blueprints) {
    const { rows } = await client.query(
      `
        insert into pico_media (
          pico_id,
          user_id,
          media_scope,
          media_type,
          title,
          file_url,
          likes_count,
          comments_count,
          views_count,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, 0, 0, $7, $8, $9)
        returning id
      `,
      [
        picoIdByKey.get(blueprint.picoKey),
        userIdByKey.get(blueprint.userKey),
        blueprint.mediaScope,
        blueprint.mediaType,
        blueprint.title,
        blueprint.fileUrl,
        blueprint.viewsCount,
        blueprint.createdAt,
        addMinutes(blueprint.createdAt, 8),
      ],
    )
    mediaIdByKey.set(blueprint.key, rows[0].id)
  }

  for (let index = 0; index < blueprints.length; index += 1) {
    const blueprint = blueprints[index]
    const mediaId = mediaIdByKey.get(blueprint.key)
    const likeKeys = pickUserKeys(userKeys, index + 1, 4 + (index % 4), [blueprint.userKey])
    const commentKeys = pickUserKeys(userKeys, index + 3, 1 + (index % 3), [blueprint.userKey])

    for (let likeIndex = 0; likeIndex < likeKeys.length; likeIndex += 1) {
      const createdAt = addMinutes(blueprint.createdAt, 20 + likeIndex * 9)
      const likerKey = likeKeys[likeIndex]
      await client.query(
        `
          insert into pico_media_like (media_id, user_id, created_at)
          values ($1, $2, $3)
          on conflict do nothing
        `,
        [mediaId, userIdByKey.get(likerKey), createdAt],
      )

      if (likeIndex === 0 && blueprint.userKey !== likerKey) {
        notifications.push({
          userId: userIdByKey.get(blueprint.userKey),
          actorUserId: userIdByKey.get(likerKey),
          kind: 'media_like',
          entityId: mediaId,
          textPreview: blueprint.title,
          createdAt,
          readAt: index % 3 === 0 ? addMinutes(createdAt, 120) : null,
        })
      }
    }

    for (let commentIndex = 0; commentIndex < commentKeys.length; commentIndex += 1) {
      const createdAt = addMinutes(blueprint.createdAt, 55 + commentIndex * 14)
      const commenterKey = commentKeys[commentIndex]
      const textContent = commentPool[(index + commentIndex) % commentPool.length]
      await client.query(
        `
          insert into pico_media_comment (media_id, user_id, text_content, created_at)
          values ($1, $2, $3, $4)
        `,
        [mediaId, userIdByKey.get(commenterKey), textContent, createdAt],
      )

      if (blueprint.userKey !== commenterKey) {
        notifications.push({
          userId: userIdByKey.get(blueprint.userKey),
          actorUserId: userIdByKey.get(commenterKey),
          kind: 'media_comment',
          entityId: mediaId,
          textPreview: textContent,
          createdAt,
          readAt: commentIndex === 0 && index % 4 === 0 ? addMinutes(createdAt, 60) : null,
        })
      }
    }
  }

  await client.query(
    `
      update pico_media
      set likes_count = coalesce(summary.likes_count, 0),
          comments_count = coalesce(summary.comments_count, 0),
          updated_at = greatest(pico_media.updated_at, coalesce(summary.last_activity_at, pico_media.updated_at))
      from (
        select
          pico_media.id,
          coalesce(likes.total, 0)::int as likes_count,
          coalesce(comments.total, 0)::int as comments_count,
          greatest(
            pico_media.created_at,
            coalesce(likes.last_created_at, pico_media.created_at),
            coalesce(comments.last_created_at, pico_media.created_at)
          ) as last_activity_at
        from pico_media
        left join lateral (
          select count(*)::int as total, max(created_at) as last_created_at
          from pico_media_like
          where pico_media_like.media_id = pico_media.id
        ) likes on true
        left join lateral (
          select count(*)::int as total, max(created_at) as last_created_at
          from pico_media_comment
          where pico_media_comment.media_id = pico_media.id
        ) comments on true
      ) summary
      where summary.id = pico_media.id
    `,
  )

  return mediaIdByKey
}

async function seedCampaigns(client, userIdByKey, picoIdByKey) {
  for (const definition of campaignDefinitions) {
    const { rows } = await client.query(
      `
        insert into crowdfunding_campaign (
          pico_id,
          created_by,
          title,
          purpose,
          goal_cents,
          amount_raised_cents,
          status,
          created_at
        )
        values ($1, $2, $3, $4, $5, 0, $6, $7)
        returning id
      `,
      [
        picoIdByKey.get(definition.picoKey),
        userIdByKey.get(definition.createdByKey),
        definition.title,
        definition.purpose,
        definition.goalCents,
        definition.status,
        hoursAgo(definition.createdHoursAgo),
      ],
    )

    const campaignId = rows[0].id
    let total = 0

    for (const contribution of definition.contributions) {
      total += contribution.amountCents
      await client.query(
        `
          insert into crowdfunding_contribution (campaign_id, user_id, amount_cents, created_at)
          values ($1, $2, $3, $4)
        `,
        [campaignId, userIdByKey.get(contribution.userKey), contribution.amountCents, hoursAgo(contribution.hoursAgo)],
      )
    }

    await client.query('update crowdfunding_campaign set amount_raised_cents = $2 where id = $1', [
      campaignId,
      total,
    ])
  }
}

async function seedEvents(client, userIdByKey, picoIdByKey, referenceMaps) {
  for (const definition of eventDefinitions) {
    const createdAt = hoursAgo(36 + definition.startsHoursFromNow)
    await client.query(
      `
        insert into pico_event (
          pico_id,
          created_by,
          title,
          description,
          sport_id,
          starts_at,
          entry_fee_cents,
          prize_pool_cents,
          approval_status,
          approved_by,
          approved_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        picoIdByKey.get(definition.picoKey),
        userIdByKey.get(definition.createdByKey),
        definition.title,
        definition.description,
        referenceMaps.sportIdBySlug.get(definition.sportSlug),
        hoursFromNow(definition.startsHoursFromNow),
        definition.entryFeeCents,
        definition.prizePoolCents,
        definition.approvalStatus,
        definition.approvalStatus === 'approved' ? userIdByKey.get('admin') : null,
        definition.approvalStatus === 'approved' ? addMinutes(createdAt, 40) : null,
        createdAt,
        addMinutes(createdAt, 40),
      ],
    )
  }
}

async function seedConversations(client, userIdByKey, mediaIdByKey, notifications) {
  let messageCount = 0

  for (const definition of conversationDefinitions) {
    const createdAt = hoursAgo(definition.startHoursAgo)
    const { rows } = await client.query(
      `
        insert into direct_conversation (
          is_group,
          title,
          avatar_url,
          created_by,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6)
        returning id
      `,
      [
        definition.isGroup,
        definition.title || '',
        definition.isGroup ? photoUrl(definition.avatarSeed || definition.key, 480, 480) : '',
        userIdByKey.get(definition.createdByKey),
        createdAt,
        createdAt,
      ],
    )
    const conversationId = rows[0].id

    for (const participantKey of definition.participants) {
      await client.query(
        `
          insert into direct_conversation_participant (conversation_id, user_id, last_read_at)
          values ($1, $2, $3)
        `,
        [conversationId, userIdByKey.get(participantKey), createdAt],
      )
    }

    const insertedMessageIds = []

    for (let index = 0; index < definition.messages.length; index += 1) {
      const item = definition.messages[index]
      const createdMessageAt = addMinutes(createdAt, index * definition.stepMinutes + 10)
      const messageType = item.type === 'shared_media' ? 'shared_media' : 'text'
      const sharedMediaId = item.mediaKey ? mediaIdByKey.get(item.mediaKey) : null
      const previewText = messageType === 'shared_media' ? item.note || '' : ''
      const textContent = messageType === 'text' ? item.text || '' : ''
      const { rows: messageRows } = await client.query(
        `
          insert into direct_message (
            conversation_id,
            sender_id,
            text_content,
            message_type,
            shared_media_id,
            preview_text,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          returning id
        `,
        [
          conversationId,
          userIdByKey.get(item.senderKey),
          textContent,
          messageType,
          sharedMediaId,
          previewText,
          createdMessageAt,
        ],
      )
      insertedMessageIds.push(messageRows[0].id)
      messageCount += 1
    }

    const lastMessageAt = addMinutes(createdAt, (definition.messages.length - 1) * definition.stepMinutes + 10)
    await client.query('update direct_conversation set updated_at = $2 where id = $1', [conversationId, lastMessageAt])

    for (const participantKey of definition.participants) {
      const readMessageIndex = definition.lastReadMessageIndexByUser?.[participantKey]
      const readAt =
        typeof readMessageIndex === 'number'
          ? addMinutes(createdAt, readMessageIndex * definition.stepMinutes + 10)
          : lastMessageAt

      await client.query(
        `
          update direct_conversation_participant
          set last_read_at = $3
          where conversation_id = $1
            and user_id = $2
        `,
        [conversationId, userIdByKey.get(participantKey), readAt],
      )
    }

    if (insertedMessageIds.length >= 2) {
      const reactedMessageId = insertedMessageIds[Math.max(1, insertedMessageIds.length - 2)]
      for (const participantKey of definition.participants.slice(0, 2)) {
        await client.query(
          `
            insert into direct_message_reaction (message_id, user_id, reaction, created_at)
            values ($1, $2, 'heart', $3)
            on conflict do nothing
          `,
          [reactedMessageId, userIdByKey.get(participantKey), addMinutes(lastMessageAt, 2)],
        )
      }
    }

    const lastMessage = definition.messages[definition.messages.length - 1]
    for (const participantKey of definition.participants) {
      const readMessageIndex = definition.lastReadMessageIndexByUser?.[participantKey]
      const unread = typeof readMessageIndex === 'number' && readMessageIndex < definition.messages.length - 1
      if (!unread || participantKey === lastMessage.senderKey) continue

      notifications.push({
        userId: userIdByKey.get(participantKey),
        actorUserId: userIdByKey.get(lastMessage.senderKey),
        kind: 'dm_message',
        entityId: conversationId,
        textPreview: lastMessage.type === 'shared_media' ? lastMessage.note || 'Compartilhou um post' : lastMessage.text,
        createdAt: lastMessageAt,
        readAt: null,
      })
    }
  }

  return messageCount
}

async function seedNotifications(client, notifications) {
  const sorted = [...notifications]
    .filter((item) => item.userId && item.actorUserId && item.userId !== item.actorUserId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 120)

  for (const item of sorted) {
    await client.query(
      `
        insert into app_notification (
          user_id,
          actor_user_id,
          kind,
          entity_id,
          text_preview,
          created_at,
          read_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [item.userId, item.actorUserId, item.kind, item.entityId, item.textPreview || '', item.createdAt, item.readAt],
    )
  }
}

async function getSummary(client = { query }) {
  const { rows } = await client.query(
    `
      select 'app_user' as table_name, count(*)::int as total from app_user
      union all select 'profile', count(*)::int from profile
      union all select 'pico', count(*)::int from pico
      union all select 'pico_media', count(*)::int from pico_media
      union all select 'pico_event', count(*)::int from pico_event
      union all select 'crowdfunding_campaign', count(*)::int from crowdfunding_campaign
      union all select 'user_follow', count(*)::int from user_follow
      union all select 'direct_conversation', count(*)::int from direct_conversation
      union all select 'direct_message', count(*)::int from direct_message
      union all select 'app_notification', count(*)::int from app_notification
      order by table_name
    `,
  )

  return Object.fromEntries(rows.map((row) => [row.table_name, row.total]))
}

async function main() {
  await runSqlFile('seed.sql')
  const notifications = []

  await withTransaction(async (client) => {
    const referenceMaps = await getReferenceMaps(client)
    const userIdByKey = await upsertDemoUsers(client)
    const demoUserIds = [...userIdByKey.values()]

    await cleanupDemoData(
      client,
      demoUserIds,
      [...picoDefinitions.map((item) => item.slug), ...legacyPicoSlugs],
    )

    await seedUserMetadata(client, userIdByKey, referenceMaps)
    await seedFollowGraph(client, userIdByKey, notifications)

    const picoIdByKey = await seedPicos(client, userIdByKey, referenceMaps)
    await seedPicoEngagement(client, userIdByKey, picoIdByKey)
    const mediaIdByKey = await seedMedia(client, userIdByKey, picoIdByKey, notifications)
    await seedCampaigns(client, userIdByKey, picoIdByKey)
    await seedEvents(client, userIdByKey, picoIdByKey, referenceMaps)
    const directMessageCount = await seedConversations(client, userIdByKey, mediaIdByKey, notifications)
    await seedNotifications(client, notifications)

    const summary = await getSummary(client)
    console.log(
      JSON.stringify(
        {
          ok: true,
          usersSeeded: demoUserDefinitions.length,
          picosSeeded: picoDefinitions.length,
          mediaSeeded: mediaIdByKey.size,
          campaignsSeeded: campaignDefinitions.length,
          eventsSeeded: eventDefinitions.length,
          directMessagesSeeded: directMessageCount,
          demoCredentials: {
            main: { email: 'teste@teste.com', password: '123' },
            admin: { email: 'admin@admin.com', password: '123' },
            demoPassword: '123456',
          },
          totals: summary,
        },
        null,
        2,
      ),
    )
  })
}

try {
  await main()
} finally {
  await closeDatabase()
}
