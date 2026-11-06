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

db.exec(`
  CREATE TABLE IF NOT EXISTS pastas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    pai_id INTEGER,
    aberta INTEGER NOT NULL DEFAULT 1,
    criada_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

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
  db.exec('ALTER TABLE notas ADD COLUMN pasta_id INTEGER')
}
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

db.exec(`
  CREATE TABLE IF NOT EXISTS notinhas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    texto TEXT NOT NULL,
    cor TEXT NOT NULL DEFAULT 'amarelo',
    criada_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

function garantirColuna(tabela, coluna, definicao) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name)
  if (!colunas.includes(coluna)) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`)
}
garantirColuna('cartoes', 'estilo', "TEXT NOT NULL DEFAULT ''")
garantirColuna('tracos', 'cartao_id', 'INTEGER')
garantirColuna('notas', 'fixada', 'INTEGER NOT NULL DEFAULT 0')
garantirColuna('quadros', 'fixada', 'INTEGER NOT NULL DEFAULT 0')

db.exec(`
  CREATE TABLE IF NOT EXISTS arquivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    pasta_id INTEGER,
    ext TEXT NOT NULL DEFAULT '',
    tamanho INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS tracos_arquivo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arquivo_id INTEGER NOT NULL,
    pagina INTEGER NOT NULL,
    ferramenta TEXT NOT NULL,
    cor TEXT NOT NULL,
    espessura REAL NOT NULL,
    pontos TEXT NOT NULL
  )
`)

for (const tabela of ['notas', 'quadros', 'arquivos']) garantirColuna(tabela, 'apagado_em', 'TEXT')

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

function listarNotas() {
  return db.prepare('SELECT * FROM notas WHERE apagado_em IS NULL ORDER BY concluida ASC, id DESC').all()
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
  emTransacao(() => {
    const cartoesDaNota = db.prepare('SELECT id FROM cartoes WHERE nota_id = ?').all(id)
    for (const c of cartoesDaNota) apagarCartaoSemTransacao(c.id)
    db.prepare('DELETE FROM notas WHERE id = ?').run(id)
  })
}

function listarPastas() {
  return db
    .prepare('SELECT id, nome, pai_id, aberta FROM pastas ORDER BY nome COLLATE NOCASE')
    .all()
}

function pastaExiste(id) {
  return Boolean(db.prepare('SELECT 1 AS ok FROM pastas WHERE id = ?').get(id))
}

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
  if (paiId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(paiId)
  return { id: Number(info.lastInsertRowid), nome, pai_id: paiId, aberta: 1 }
}

function renomearPasta(id, nome) {
  db.prepare('UPDATE pastas SET nome = ? WHERE id = ?').run(nome, id)
}

function alternarPasta(id) {
  db.prepare('UPDATE pastas SET aberta = 1 - aberta WHERE id = ?').run(id)
}

function moverPasta(id, novoPaiId) {
  if (!pastaExiste(id)) return false
  if (novoPaiId !== null) {
    if (!pastaExiste(novoPaiId)) return false
    if (idsDaSubarvore(id).has(novoPaiId)) return false
  }
  db.prepare('UPDATE pastas SET pai_id = ? WHERE id = ?').run(novoPaiId, id)
  if (novoPaiId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(novoPaiId)
  return true
}

function removerPasta(id) {
  const pasta = db.prepare('SELECT pai_id FROM pastas WHERE id = ?').get(id)
  if (!pasta) return
  emTransacao(() => {
    db.prepare('UPDATE pastas SET pai_id = ? WHERE pai_id = ?').run(pasta.pai_id, id)
    db.prepare('UPDATE notas SET pasta_id = ? WHERE pasta_id = ?').run(pasta.pai_id, id)
    db.prepare('UPDATE quadros SET pasta_id = ? WHERE pasta_id = ?').run(pasta.pai_id, id)
    db.prepare('UPDATE arquivos SET pasta_id = ? WHERE pasta_id = ?').run(pasta.pai_id, id)
    db.prepare('DELETE FROM pastas WHERE id = ?').run(id)
  })
}

function listarQuadros() {
  return db
    .prepare('SELECT id, nome, pasta_id, fixada FROM quadros WHERE apagado_em IS NULL ORDER BY nome COLLATE NOCASE')
    .all()
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
    .prepare(
      'SELECT id, quadro_id, tipo, nota_id, texto, x, y, cor, largura, estilo FROM cartoes WHERE quadro_id = ? ORDER BY id'
    )
    .all(id)
  const conexoes = db
    .prepare(
      'SELECT id, quadro_id, de_id, para_id, de_lado, para_lado, forma, estilo, seta, cor FROM conexoes WHERE quadro_id = ? ORDER BY id'
    )
    .all(id)
  const tracos = db
    .prepare('SELECT id, ferramenta, cor, espessura, pontos, cartao_id FROM tracos WHERE quadro_id = ? ORDER BY id')
    .all(id)
  return { quadro, cartoes, conexoes, tracos }
}

function criarCartao(quadroId, tipo, notaId, texto, x, y, cor, largura, estilo) {
  if (tipo === 'nota') {
    const jaExiste = db
      .prepare('SELECT 1 AS ok FROM cartoes WHERE quadro_id = ? AND nota_id = ?')
      .get(quadroId, notaId)
    if (jaExiste) return null
  }
  const info = db
    .prepare(
      'INSERT INTO cartoes (quadro_id, tipo, nota_id, texto, x, y, cor, largura, estilo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(quadroId, tipo, notaId, texto, x, y, cor, largura, estilo)
  return {
    id: Number(info.lastInsertRowid),
    quadro_id: quadroId,
    tipo,
    nota_id: notaId,
    texto,
    x,
    y,
    cor,
    largura,
    estilo,
  }
}

function moverCartao(id, x, y) {
  db.prepare('UPDATE cartoes SET x = ?, y = ? WHERE id = ?').run(x, y, id)
}

function editarCartao(id, texto, cor, estilo) {
  db.prepare('UPDATE cartoes SET texto = ?, cor = ?, estilo = ? WHERE id = ?').run(texto, cor, estilo, id)
}

function apagarCartaoSemTransacao(id) {
  db.prepare('DELETE FROM conexoes WHERE de_id = ? OR para_id = ?').run(id, id)
  db.prepare('DELETE FROM tracos WHERE cartao_id = ?').run(id)
  db.prepare('DELETE FROM cartoes WHERE id = ?').run(id)
}

function removerCartao(id) {
  emTransacao(() => apagarCartaoSemTransacao(id))
}

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

function criarTraco(quadroId, ferramenta, cor, espessura, pontos, cartaoId) {
  const info = db
    .prepare('INSERT INTO tracos (quadro_id, ferramenta, cor, espessura, pontos, cartao_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(quadroId, ferramenta, cor, espessura, pontos, cartaoId)
  return { id: Number(info.lastInsertRowid) }
}

function removerTraco(id) {
  db.prepare('DELETE FROM tracos WHERE id = ?').run(id)
}

function listarNotinhas() {
  return db.prepare('SELECT id, data, texto, cor FROM notinhas ORDER BY data, id').all()
}

function criarNotinha(data, texto, cor) {
  const info = db.prepare('INSERT INTO notinhas (data, texto, cor) VALUES (?, ?, ?)').run(data, texto, cor)
  return { id: Number(info.lastInsertRowid), data, texto, cor }
}

function editarNotinha(id, texto, cor) {
  db.prepare('UPDATE notinhas SET texto = ?, cor = ? WHERE id = ?').run(texto, cor, id)
}

function removerNotinha(id) {
  db.prepare('DELETE FROM notinhas WHERE id = ?').run(id)
}

function listarArquivos() {
  return db
    .prepare('SELECT id, nome, pasta_id, ext, tamanho FROM arquivos WHERE apagado_em IS NULL ORDER BY nome COLLATE NOCASE')
    .all()
}

function obterArquivo(id) {
  return db.prepare('SELECT id, nome, pasta_id, ext, tamanho FROM arquivos WHERE id = ?').get(id)
}

function criarArquivo(nome, pastaId, ext, tamanho) {
  const info = db
    .prepare('INSERT INTO arquivos (nome, pasta_id, ext, tamanho) VALUES (?, ?, ?, ?)')
    .run(nome, pastaId, ext, tamanho)
  if (pastaId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(pastaId)
  return { id: Number(info.lastInsertRowid), nome, pasta_id: pastaId, ext, tamanho }
}

function renomearArquivo(id, nome) {
  db.prepare('UPDATE arquivos SET nome = ? WHERE id = ?').run(nome, id)
}

function moverArquivo(id, pastaId) {
  db.prepare('UPDATE arquivos SET pasta_id = ? WHERE id = ?').run(pastaId, id)
  if (pastaId !== null) db.prepare('UPDATE pastas SET aberta = 1 WHERE id = ?').run(pastaId)
}

function removerArquivo(id) {
  emTransacao(() => {
    db.prepare('DELETE FROM tracos_arquivo WHERE arquivo_id = ?').run(id)
    db.prepare('DELETE FROM arquivos WHERE id = ?').run(id)
  })
}

function listarTracosArquivo(arquivoId) {
  return db
    .prepare('SELECT id, pagina, ferramenta, cor, espessura, pontos FROM tracos_arquivo WHERE arquivo_id = ? ORDER BY id')
    .all(arquivoId)
}

function criarTracoArquivo(arquivoId, pagina, ferramenta, cor, espessura, pontos) {
  const info = db
    .prepare('INSERT INTO tracos_arquivo (arquivo_id, pagina, ferramenta, cor, espessura, pontos) VALUES (?, ?, ?, ?, ?, ?)')
    .run(arquivoId, pagina, ferramenta, cor, espessura, pontos)
  return { id: Number(info.lastInsertRowid) }
}

function removerTracoArquivo(id) {
  db.prepare('DELETE FROM tracos_arquivo WHERE id = ?').run(id)
}

function fixarNota(id, fixada) {
  db.prepare('UPDATE notas SET fixada = ? WHERE id = ?').run(fixada ? 1 : 0, id)
}

function fixarQuadro(id, fixada) {
  db.prepare('UPDATE quadros SET fixada = ? WHERE id = ?').run(fixada ? 1 : 0, id)
}

const TABELAS_LIXEIRA = { nota: 'notas', quadro: 'quadros', arquivo: 'arquivos' }

function tabelaDaLixeira(tipo) {
  const tabela = TABELAS_LIXEIRA[tipo]
  if (!tabela) throw new Error('Tipo inválido')
  return tabela
}

function moverParaLixeira(tipo, id) {
  db.prepare(
    `UPDATE ${tabelaDaLixeira(tipo)} SET apagado_em = datetime('now', 'localtime') WHERE id = ? AND apagado_em IS NULL`
  ).run(id)
}

function restaurarDaLixeira(tipo, id) {
  const tabela = tabelaDaLixeira(tipo)
  const item = db.prepare(`SELECT pasta_id FROM ${tabela} WHERE id = ?`).get(id)
  if (!item) return
  const pastaId = item.pasta_id !== null && pastaExiste(item.pasta_id) ? item.pasta_id : null
  db.prepare(`UPDATE ${tabela} SET apagado_em = NULL, pasta_id = ? WHERE id = ?`).run(pastaId, id)
}

function itemDaLixeira(tipo, id) {
  return db.prepare(`SELECT * FROM ${tabelaDaLixeira(tipo)} WHERE id = ? AND apagado_em IS NOT NULL`).get(id) || null
}

function listarLixeira() {
  const notas = db
    .prepare('SELECT id, texto, tipo, pasta_id, apagado_em FROM notas WHERE apagado_em IS NOT NULL ORDER BY apagado_em DESC')
    .all()
  const quadros = db
    .prepare('SELECT id, nome, pasta_id, apagado_em FROM quadros WHERE apagado_em IS NOT NULL ORDER BY apagado_em DESC')
    .all()
  const arquivos = db
    .prepare(
      'SELECT id, nome, pasta_id, ext, tamanho, apagado_em FROM arquivos WHERE apagado_em IS NOT NULL ORDER BY apagado_em DESC'
    )
    .all()
  return { notas, quadros, arquivos }
}

function vencidosDaLixeira(dias) {
  const limite = `-${Math.max(0, Math.floor(dias))} days`
  const itens = []
  for (const [tipo, tabela] of Object.entries(TABELAS_LIXEIRA)) {
    const linhas = db
      .prepare(`SELECT id FROM ${tabela} WHERE apagado_em IS NOT NULL AND apagado_em < datetime('now', 'localtime', ?)`)
      .all(limite)
    for (const l of linhas) itens.push({ tipo, id: l.id })
  }
  return itens
}

function copiarBanco(destino) {
  db.prepare('VACUUM INTO ?').run(destino)
}

module.exports = {
  moverParaLixeira,
  restaurarDaLixeira,
  itemDaLixeira,
  listarLixeira,
  vencidosDaLixeira,
  fixarNota,
  fixarQuadro,
  copiarBanco,
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
  listarNotinhas,
  criarNotinha,
  editarNotinha,
  removerNotinha,
  listarArquivos,
  obterArquivo,
  criarArquivo,
  renomearArquivo,
  moverArquivo,
  removerArquivo,
  listarTracosArquivo,
  criarTracoArquivo,
  removerTracoArquivo
}