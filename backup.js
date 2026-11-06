const fs = require('fs')
const path = require('path')
const { EscritorZip, lerZip } = require('./zip')
const Links = require('./links')

const NOME_BANCO = 'segundo-cerebro.db'
const RE_BACKUP = /^backup-\d{4}-\d{2}-\d{2}_\d{4}\.zip$/

const pad = (n) => String(n).padStart(2, '0')
function carimbo(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

const nomeSeguro = (nome) =>
  String(nome || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 100) || 'sem título'

function caminhosDasPastas(pastas) {
  const porId = new Map(pastas.map((p) => [p.id, p]))
  const caminhos = new Map()
  for (const p of pastas) {
    const partes = []
    let atual = p
    let guarda = 0
    while (atual && guarda++ < 50) {
      partes.unshift(nomeSeguro(atual.nome))
      atual = atual.pai_id === null ? null : porId.get(atual.pai_id)
    }
    caminhos.set(p.id, partes)
  }
  return caminhos
}

function montarItens(db) {
  const pastas = db.listarPastas()
  const caminhos = caminhosDasPastas(pastas)
  const usados = new Map()
  const itens = []

  const reservar = (pastaId, base, ext) => {
    const chave = String(pastaId)
    if (!usados.has(chave)) usados.set(chave, new Set())
    const set = usados.get(chave)
    let nome = `${base}${ext}`
    for (let n = 2; set.has(nome.toLowerCase()); n++) nome = `${base} (${n})${ext}`
    set.add(nome.toLowerCase())
    return [...(caminhos.get(pastaId) || []), nome]
  }

  const notas = db.listarNotas()
  const tituloDe = new Map(notas.map((n) => [n.id, Links.titulo(n.texto) || 'sem título']))
  for (const n of notas) {
    const texto = n.texto || ''
    const i = texto.indexOf('\n')
    const titulo = i === -1 ? texto : texto.slice(0, i)
    const corpo = i === -1 ? '' : texto.slice(i + 1)
    const conteudo = `# ${titulo.trim() || 'Sem título'}\n\n${corpo}`.trimEnd() + '\n'
    itens.push({ caminho: reservar(n.pasta_id, nomeSeguro(tituloDe.get(n.id)), '.md'), conteudo })
  }

  for (const q of db.listarQuadros()) {
    const dados = db.carregarQuadro(q.id)
    const linhas = [`# ${q.nome}`, '', '_Quadro exportado do Segundo Cérebro (só o texto dos cartões)._', '']
    for (const c of dados ? dados.cartoes : []) {
      if (c.tipo === 'nota') linhas.push(`- [[${tituloDe.get(c.nota_id) || 'nota apagada'}]]`)
      else if (c.tipo === 'imagem') linhas.push('- (imagem)')
      else if (c.texto.trim()) linhas.push(`- ${c.texto.trim().replace(/\n/g, '\n  ')}`)
    }
    itens.push({ caminho: reservar(q.pasta_id, nomeSeguro(q.nome), ' (quadro).md'), conteudo: linhas.join('\n') + '\n' })
  }

  for (const a of db.listarArquivos()) {
    const m = /^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(nomeSeguro(a.nome))
    itens.push({ caminho: reservar(a.pasta_id, m[1] || 'arquivo', m[2] || ''), arquivo: a })
  }
  return itens
}

const caminhoDoArquivo = (dir, a) => path.join(dir, a.ext ? `${a.id}.${a.ext}` : String(a.id))

async function criarZip(destino, { db, userData }) {
  const dirArquivos = path.join(userData, 'arquivos')
  const temp = path.join(userData, `backup-temp-${Date.now()}.db`)
  const parcial = `${destino}.parcial`
  const zip = new EscritorZip(parcial)
  try {
    db.copiarBanco(temp)
    await zip.adicionar(NOME_BANCO, await fs.promises.readFile(temp))
    for (const a of [...db.listarArquivos(), ...db.listarLixeira().arquivos]) {
      const origem = caminhoDoArquivo(dirArquivos, a)
      if (!fs.existsSync(origem)) continue
      await zip.adicionar(`arquivos/${path.basename(origem)}`, await fs.promises.readFile(origem))
    }
    for (const item of montarItens(db)) {
      if (item.conteudo !== undefined) await zip.adicionar(['notas', ...item.caminho].join('/'), item.conteudo)
    }
    await zip.adicionar(
      'LEIA-ME.txt',
      'Backup do Segundo Cérebro\r\n\r\n' +
        'Para restaurar: abra o app > Configurações > Restaurar backup… e escolha este arquivo.\r\n' +
        'A pasta "notas" tem suas notas em Markdown (.md), para ler em qualquer editor de texto.\r\n'
    )
    zip.fechar()
    await fs.promises.rename(parcial, destino)
  } catch (erro) {
    zip.descartar()
    await fs.promises.rm(parcial, { force: true })
    throw erro
  } finally {
    await fs.promises.rm(temp, { force: true })
  }
  return destino
}

async function exportarMarkdown(pastaDestino, { db, userData }) {
  const dirArquivos = path.join(userData, 'arquivos')
  let raiz = path.join(pastaDestino, `Segundo Cérebro ${carimbo().slice(0, 10)}`)
  for (let n = 2; fs.existsSync(raiz); n++) raiz = path.join(pastaDestino, `Segundo Cérebro ${carimbo().slice(0, 10)} (${n})`)
  let total = 0
  for (const item of montarItens(db)) {
    const destino = path.join(raiz, ...item.caminho)
    await fs.promises.mkdir(path.dirname(destino), { recursive: true })
    if (item.arquivo) {
      const origem = caminhoDoArquivo(dirArquivos, item.arquivo)
      if (!fs.existsSync(origem)) continue
      await fs.promises.copyFile(origem, destino)
    } else {
      await fs.promises.writeFile(destino, item.conteudo, 'utf8')
    }
    total++
  }
  await fs.promises.mkdir(raiz, { recursive: true })
  return { pasta: raiz, total }
}

function pastaPadrao(userData) {
  return path.join(userData, 'backups')
}

async function fazerBackup(pasta, contexto, manter = 7) {
  await fs.promises.mkdir(pasta, { recursive: true })
  const destino = path.join(pasta, `backup-${carimbo()}.zip`)
  await criarZip(destino, contexto)
  const antigos = (await fs.promises.readdir(pasta)).filter((n) => RE_BACKUP.test(n)).sort().reverse().slice(manter)
  for (const nome of antigos) await fs.promises.rm(path.join(pasta, nome), { force: true })
  return destino
}

const DIR_PENDENTE = 'restauracao-pendente'

async function prepararRestauracao(arquivoZip, userData) {
  const entradas = lerZip(await fs.promises.readFile(arquivoZip))
  const banco = entradas.find((e) => e.nome === NOME_BANCO)
  if (!banco) throw new Error('Este .zip não é um backup do Segundo Cérebro (não tem o banco de dados).')
  const dados = banco.ler()
  if (dados.subarray(0, 16).toString('latin1') !== 'SQLite format 3\u0000') throw new Error('O banco dentro do backup está corrompido.')

  const pendente = path.join(userData, DIR_PENDENTE)
  await fs.promises.rm(pendente, { recursive: true, force: true })
  await fs.promises.mkdir(path.join(pendente, 'arquivos'), { recursive: true })
  for (const e of entradas) {
    if (!/^arquivos\/\d+(\.[A-Za-z0-9]{1,8})?$/.test(e.nome)) continue
    await fs.promises.writeFile(path.join(pendente, e.nome), e.ler())
  }
  await fs.promises.writeFile(path.join(pendente, NOME_BANCO), dados)
}

function aplicarRestauracaoPendente(userData) {
  const pendente = path.join(userData, DIR_PENDENTE)
  const novoBanco = path.join(pendente, NOME_BANCO)
  if (!fs.existsSync(novoBanco)) {
    fs.rmSync(pendente, { recursive: true, force: true })
    return false
  }
  const guarda = path.join(userData, `antes-da-restauracao-${carimbo()}`)
  fs.mkdirSync(guarda, { recursive: true })
  for (const nome of [NOME_BANCO, `${NOME_BANCO}-wal`, `${NOME_BANCO}-shm`, 'arquivos']) {
    const atual = path.join(userData, nome)
    if (fs.existsSync(atual)) fs.renameSync(atual, path.join(guarda, nome))
  }
  fs.renameSync(path.join(pendente, 'arquivos'), path.join(userData, 'arquivos'))
  fs.renameSync(novoBanco, path.join(userData, NOME_BANCO))
  fs.rmSync(pendente, { recursive: true, force: true })
  return true
}

module.exports = {
  criarZip,
  exportarMarkdown,
  fazerBackup,
  pastaPadrao,
  prepararRestauracao,
  aplicarRestauracaoPendente,
  carimbo,
}
