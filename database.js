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

function normalizar(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

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

function criarNota(texto, tipo, prazo, projeto) {
  const projetoFinal = resolverProjeto(projeto)
  const info = db
    .prepare('INSERT INTO notas (texto, tipo, prazo, projeto) VALUES (?, ?, ?, ?)')
    .run(texto, tipo, prazo, projetoFinal)
  return { id: Number(info.lastInsertRowid), texto, tipo, prazo, projeto: projetoFinal }
}

function atualizarNota(id, texto, tipo, prazo, projeto) {
  const projetoFinal = resolverProjeto(projeto)
  db.prepare(
    `UPDATE notas
     SET texto = ?, tipo = ?, prazo = ?, projeto = ?,
         concluida = CASE WHEN ? = 'tarefa' THEN concluida ELSE 0 END
     WHERE id = ?`
  ).run(texto, tipo, prazo, projetoFinal, tipo, id)
}

function alternarConcluida(id) {
  db.prepare("UPDATE notas SET concluida = 1 - concluida WHERE id = ? AND tipo = 'tarefa'").run(id)
}

function removerNota(id) {
  db.prepare('DELETE FROM notas WHERE id = ?').run(id)
}

module.exports = {
  listarNotas,
  buscarNotas,
  listarProjetos,
  criarNota,
  atualizarNota,
  alternarConcluida,
  removerNota,
}