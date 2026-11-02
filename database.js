const { DatabaseSync } = require('node:sqlite')
const path = require('path')
const { app } = require('electron')

const db = new DatabaseSync(path.join(app.getPath('userData'), 'segundo-cerebro.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL,
    tipo TEXT NOT NULL,
    criada_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// Pastas: lista de adjacência. pai_id = NULL significa pasta na raiz.
db.exec(`
  CREATE TABLE IF NOT EXISTS pastas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    pai_id INTEGER,
    aberta INTEGER NOT NULL DEFAULT 1,
    criada_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// Quadros (canvas): cada quadro tem cartões (nota existente ou post-it) e conexões entre cartões
db.exec(`
  CREATE TABLE IF NOT EXISTS quadros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    pasta_id INTEGER,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS cartoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quadro_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    nota_id INTEGER,
    texto TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL,
    y REAL NOT NULL,
    cor TEXT NOT NULL DEFAULT 'amarelo'
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS conexoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quadro_id INTEGER NOT NULL,
    de_id INTEGER NOT NULL,
    para_id INTEGER NOT NULL
  )
`)

// Migração: adiciona as colunas novas se o banco ainda não tiver
const colunas = db.prepare('PRAGMA table_info(notas)').all().map((c) => c.name)
if (!colunas.includes('concluida')) {
  db.exec('ALTER TABLE notas ADD COLUMN concluida INTEGER NOT NULL DEFAULT 0')
}
if (!colunas.includes('prazo')) {
  db.exec('ALTER TABLE notas ADD COLUMN prazo TEXT')
}
if (!colunas.includes('projeto')) {
  db.exec('ALTER TABLE notas ADD COLUMN projeto TEXT')
}
if (!colunas.includes('pasta_id')) {
  db.exec('ALTER TABLE notas ADD COLUMN pasta_id INTEGER') // NULL = sem pasta
}
// Migrações dos quadros: largura dos cartões, estilo das conexões e desenhos
db.exec(`
  CREATE TABLE IF NOT EXISTS tracos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quadro_id INTEGER NOT NULL,
    ferramenta TEXT NOT NULL,
    cor TEXT NOT NULL,
    espessura REAL NOT NULL,
    pontos TEXT NOT NULL
  )
`)
const colunasCartoes = db.prepare('PRAGMA table_info(cartoes)').all().map((c) => c.name)
if (!colunasCartoes.includes('largura')) {
  db.exec('ALTER TABLE cartoes ADD COLUMN largura REAL NOT NULL DEFAULT 220')
}
const colunasConexoes = db.prepare('PRAGMA table_info(conexoes)').all().map((c) => c.name)
for (const [nome, padrao] of [
  ['de_lado', 'auto'],
  ['para_lado', 'auto'],
  ['forma', 'curva'],
  ['estilo', 'solido'],
  ['seta', 'fim'],
  ['cor', 'cinza'],
]) {
  if (!colunasConexoes.includes(nome)) {
    db.exec(`ALTER TABLE conexoes ADD COLUMN ${nome} TEXT NOT NULL DEFAULT '${padrao}'`)
  }
}

function emTransacao(operacao) {
  db.exec('BEGIN')
  try {
    operacao()
    db.exec('COMMIT')
  } catch (erro) {
    db.exec('ROLLBACK')
    throw erro
  }
}

function normalizar(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// ---------- Notas ----------

function listarNotas() {
  return db.prepare('SELECT * FROM notas ORDER BY concluida ASC, id DESC').all()
}

function buscarNotas(termo) {
  const t = normalizar(termo.trim())
  const todas = listarNotas()
  if (!t) return todas
  return todas.filter((nota) => normalizar(nota.texto).includes(t))
}

function listarProjetos() {
  return db
    .prepare(
      'SELECT DISTINCT projeto FROM notas WHERE projeto IS NOT NULL ORDER BY projeto COLLATE NOCASE'
    )
    .all()
    .map((linha) => linha.projeto)
}

// Se já existe um projeto com o mesmo nome (ignorando maiúsculas e acentos), reaproveita a grafia
function resolverProjeto(projeto) {
  if (!projeto) return null
  const existente = listarProjetos().find((p) => normalizar(p) === normalizar(projeto))
  return existente || projeto
}

function criarNota(texto, tipo, prazo, projeto, pastaId) {
  const projetoFinal = resolverProjeto(projeto)
  const info = db
    .prepare('INSERT INTO notas (texto, tipo, prazo, projeto, pasta_id) VALUES (?, ?, ?, ?, ?)')
    .run(texto, tipo, prazo, projetoFinal, pastaId)
  return {
    id: Number(info.lastInsertRowid),
    texto,
    tipo,
    prazo,
    projeto: projetoFinal,
    pasta_id: pastaId,
  }
}

function atualizarNota(id, texto, tipo, prazo, projeto, pastaId) {
  const projetoFinal = resolverProjeto(projeto)
  db.prepare(
    `UPDATE notas
     SET texto = ?, tipo = ?, prazo = ?, projeto = ?, pasta_id = ?,
         concluida = CASE WHEN ? = 'tarefa' THEN concluida ELSE 0 END
     WHERE id = ?`
  ).run(texto, tipo, prazo, projetoFinal, pastaId, tipo, id)
}

function moverNota(id, pastaId) {
  db.prepare('UPDATE notas SET pasta_id = ? WHERE id = ?').run(pastaId, id)
}

function alternarConcluida(id) {
  db.prepare("UPDATE notas SET concluida = 1 - concluida WHERE id = ? AND tipo = 'tarefa'").run(id)
}

// Apagar uma nota também tira os cartões dela de todos os quadros (e as conexões desses cartões)
function removerNota(id) {
  emTransacao(() => {
    const cartoesDaNota = db.prepare('SELECT id FROM cartoes WHERE nota_id = ?').all(id)
    for (const c of cartoesDaNota) apagarCartaoSemTransacao(c.id)
    db.prepare('DELETE FROM notas WHERE id = ?').run(id)
  })
}

// ---------- Pastas ----------

function listarPastas() {
  return db
    .prepare('SELECT id, nome, pai_id, aberta FROM pastas ORDER BY nome COLLATE NOCASE')
    .all()
}

function pastaExiste(id) {
  return Boolean(db.prepare('SELECT 1 AS ok FROM pastas WHERE id = ?').get(id))
}

// Ids da pasta e de todas as suas descendentes (usado para impedir ciclos)
function idsDaSubarvore(id) {
  const todas = db.prepare('SELECT id, pai_id FROM pastas').all()
  const resultado = new Set([id])
  let cresceu = true
  while (cresceu) {
    cresceu = false
    for (const p of todas) {
      if (p.pai_id !== null && resultado.has(p.pai_id) && !resultado.has(p.id)) {
        resultado.add(p.id)
        cresceu = true
      }
    }
  }
  return resultado
}

function criarPasta(nome, paiId) {
  const info = db.prepare('INSERT INTO pastas (nome, pai_id) VALUES (?, ?)').run(nome, paiId)
  // Abre a pasta pai para a nova subpasta aparecer
  if (paiId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(paiId)
  return { id: Number(info.lastInsertRowid), nome, pai_id: paiId, aberta: 1 }
}

function renomearPasta(id, nome) {
  db.prepare('UPDATE pastas SET nome = ? WHERE id = ?').run(nome, id)
}

function alternarPasta(id) {
  db.prepare('UPDATE pastas SET aberta = 1 - aberta WHERE id = ?').run(id)
}

// Devolve false se o movimento for inválido (pasta inexistente ou ciclo)
function moverPasta(id, novoPaiId) {
  if (!pastaExiste(id)) return false
  if (novoPaiId !== null) {
    if (!pastaExiste(novoPaiId)) return false
    if (idsDaSubarvore(id).has(novoPaiId)) return false // mover para dentro de si mesma
  }
  db.prepare('UPDATE pastas SET pai_id = ? WHERE id = ?').run(novoPaiId, id)
  if (novoPaiId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(novoPaiId)
  return true
}

// Apagar uma pasta NÃO apaga o conteúdo: notas, quadros e subpastas sobem para a pasta pai
function removerPasta(id) {
  const pasta = db.prepare('SELECT pai_id FROM pastas WHERE id = ?').get(id)
  if (!pasta) return
  emTransacao(() => {
    db.prepare('UPDATE pastas SET pai_id = ? WHERE pai_id = ?').run(pasta.pai_id, id)
    db.prepare('UPDATE notas SET pasta_id = ? WHERE pasta_id = ?').run(pasta.pai_id, id)
    db.prepare('UPDATE quadros SET pasta_id = ? WHERE pasta_id = ?').run(pasta.pai_id, id)
    db.prepare('DELETE FROM pastas WHERE id = ?').run(id)
  })
}

// ---------- Quadros ----------

function listarQuadros() {
  return db.prepare('SELECT id, nome, pasta_id FROM quadros ORDER BY nome COLLATE NOCASE').all()
}

function quadroExiste(id) {
  return Boolean(db.prepare('SELECT 1 AS ok FROM quadros WHERE id = ?').get(id))
}

function criarQuadro(nome, pastaId) {
  const info = db.prepare('INSERT INTO quadros (nome, pasta_id) VALUES (?, ?)').run(nome, pastaId)
  if (pastaId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(pastaId)
  return { id: Number(info.lastInsertRowid), nome, pasta_id: pastaId }
}

function renomearQuadro(id, nome) {
  db.prepare('UPDATE quadros SET nome = ? WHERE id = ?').run(nome, id)
}

function moverQuadro(id, pastaId) {
  db.prepare('UPDATE quadros SET pasta_id = ? WHERE id = ?').run(pastaId, id)
  if (pastaId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(pastaId)
}

function removerQuadro(id) {
  emTransacao(() => {
    db.prepare('DELETE FROM tracos WHERE quadro_id = ?').run(id)
    db.prepare('DELETE FROM conexoes WHERE quadro_id = ?').run(id)
    db.prepare('DELETE FROM cartoes WHERE quadro_id = ?').run(id)
    db.prepare('DELETE FROM quadros WHERE id = ?').run(id)
  })
}

function carregarQuadro(id) {
  const quadro = db.prepare('SELECT id, nome, pasta_id FROM quadros WHERE id = ?').get(id)
  if (!quadro) return null
  const cartoes = db
    .prepare('SELECT id, quadro_id, tipo, nota_id, texto, x, y, cor, largura FROM cartoes WHERE quadro_id = ? ORDER BY id')
    .all(id)
  const conexoes = db
    .prepare(
      'SELECT id, quadro_id, de_id, para_id, de_lado, para_lado, forma, estilo, seta, cor FROM conexoes WHERE quadro_id = ? ORDER BY id'
    )
    .all(id)
  const tracos = db
    .prepare('SELECT id, ferramenta, cor, espessura, pontos FROM tracos WHERE quadro_id = ? ORDER BY id')
    .all(id)
  return { quadro, cartoes, conexoes, tracos }
}

// Devolve null se a nota já estiver no quadro (uma nota só aparece uma vez por quadro)
function criarCartao(quadroId, tipo, notaId, texto, x, y, cor, largura) {
  if (tipo === 'nota') {
    const jaExiste = db
      .prepare('SELECT 1 AS ok FROM cartoes WHERE quadro_id = ? AND nota_id = ?')
      .get(quadroId, notaId)
    if (jaExiste) return null
  }
  const info = db
    .prepare('INSERT INTO cartoes (quadro_id, tipo, nota_id, texto, x, y, cor, largura) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(quadroId, tipo, notaId, texto, x, y, cor, largura)
  return { id: Number(info.lastInsertRowid), quadro_id: quadroId, tipo, nota_id: notaId, texto, x, y, cor, largura }
}


function moverCartao(id, x, y) {
  db.prepare('UPDATE cartoes SET x = ?, y = ? WHERE id = ?').run(x, y, id)
}

function editarCartao(id, texto, cor) {
  db.prepare('UPDATE cartoes SET texto = ?, cor = ? WHERE id = ?').run(texto, cor, id)
}

function apagarCartaoSemTransacao(id) {
  db.prepare('DELETE FROM conexoes WHERE de_id = ? OR para_id = ?').run(id, id)
  db.prepare('DELETE FROM cartoes WHERE id = ?').run(id)
}

function removerCartao(id) {
  emTransacao(() => apagarCartaoSemTransacao(id))
}

// Devolve null para conexão repetida ou de um cartão para ele mesmo
function criarConexao(quadroId, deId, paraId, deLado, paraLado) {
  if (deId === paraId) return null
  const existe = db
    .prepare('SELECT 1 AS ok FROM conexoes WHERE quadro_id = ? AND de_id = ? AND para_id = ?')
    .get(quadroId, deId, paraId)
  if (existe) return null
  const info = db
    .prepare('INSERT INTO conexoes (quadro_id, de_id, para_id, de_lado, para_lado) VALUES (?, ?, ?, ?, ?)')
    .run(quadroId, deId, paraId, deLado, paraLado)
  return {
    id: Number(info.lastInsertRowid),
    quadro_id: quadroId,
    de_id: deId,
    para_id: paraId,
    de_lado: deLado,
    para_lado: paraLado,
    forma: 'curva',
    estilo: 'solido',
    seta: 'fim',
    cor: 'cinza',
  }
}

function removerConexao(id) {
  db.prepare('DELETE FROM conexoes WHERE id = ?').run(id)
}

function redimensionarCartao(id, x, y, largura) {
  db.prepare('UPDATE cartoes SET x = ?, y = ?, largura = ? WHERE id = ?').run(x, y, largura, id)
}

// Só muda os campos que vierem preenchidos (os null ficam como estavam)
function editarConexao(id, forma, estilo, seta, cor) {
  db.prepare(
    'UPDATE conexoes SET forma = COALESCE(?, forma), estilo = COALESCE(?, estilo), seta = COALESCE(?, seta), cor = COALESCE(?, cor) WHERE id = ?'
  ).run(forma, estilo, seta, cor, id)
}

function inverterConexao(id) {
  db.prepare(
    'UPDATE conexoes SET de_id = para_id, para_id = de_id, de_lado = para_lado, para_lado = de_lado WHERE id = ?'
  ).run(id)
}

function criarTraco(quadroId, ferramenta, cor, espessura, pontos) {
  const info = db
    .prepare('INSERT INTO tracos (quadro_id, ferramenta, cor, espessura, pontos) VALUES (?, ?, ?, ?, ?)')
    .run(quadroId, ferramenta, cor, espessura, pontos)
  return { id: Number(info.lastInsertRowid) }
}

function removerTraco(id) {
  db.prepare('DELETE FROM tracos WHERE id = ?').run(id)
}

module.exports = {
  listarNotas,
  buscarNotas,
  listarProjetos,
  criarNota,
  atualizarNota,
  moverNota,
  alternarConcluida,
  removerNota,
  listarPastas,
  pastaExiste,
  criarPasta,
  renomearPasta,
  alternarPasta,
  moverPasta,
  removerPasta,
  listarQuadros,
  quadroExiste,
  criarQuadro,
  renomearQuadro,
  moverQuadro,
  removerQuadro,
  carregarQuadro,
  criarCartao,
  moverCartao,
  editarCartao,
  removerCartao,
  criarConexao,
  removerConexao,
  redimensionarCartao,
  editarConexao,
  inverterConexao,
  criarTraco,
  removerTraco,
}