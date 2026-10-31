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

function removerNota(id) {
  db.prepare('DELETE FROM notas WHERE id = ?').run(id)
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

// Apagar uma pasta NÃO apaga o conteúdo: notas e subpastas sobem para a pasta pai
function removerPasta(id) {
  const pasta = db.prepare('SELECT pai_id FROM pastas WHERE id = ?').get(id)
  if (!pasta) return
  emTransacao(() => {
    db.prepare('UPDATE pastas SET pai_id = ? WHERE pai_id = ?').run(pasta.pai_id, id)
    db.prepare('UPDATE notas SET pasta_id = ? WHERE pasta_id = ?').run(pasta.pai_id, id)
    db.prepare('DELETE FROM pastas WHERE id = ?').run(id)
  })
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
}