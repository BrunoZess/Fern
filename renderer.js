const arvore = document.getElementById('arvore')
const painelTags = document.getElementById('painel-tags')
const lateral = document.getElementById('lateral')
const divisor = document.getElementById('lateral-divisor')
const guiasEl = document.getElementById('guias')
const btnArquivos = document.getElementById('btn-arquivos')
const btnTags = document.getElementById('btn-tags')
const btnNovo = document.getElementById('btn-novo')
const btnBusca = document.getElementById('btn-busca')
const btnGrafo = document.getElementById('btn-grafo')
const btnCalendario = document.getElementById('btn-calendario')
const btnTarefas = document.getElementById('btn-tarefas')
const btnLixeira = document.getElementById('btn-lixeira')
const btnEstatisticas = document.getElementById('btn-estatisticas')
const btnLateral = document.getElementById('btn-lateral')
const btnNovaGuia = document.getElementById('guia-nova')
const btnAjuda = document.getElementById('btn-ajuda')
const btnAjustes = document.getElementById('btn-ajustes')
const grafoEscopo = document.getElementById('grafo-escopo')
const grafoTudo = document.getElementById('grafo-tudo')
const paleta = document.getElementById('paleta')
const paletaBusca = document.getElementById('paleta-busca')
const paletaLista = document.getElementById('paleta-lista')

const vistas = {
  vazia: document.getElementById('vista-vazia'),
  editor: document.getElementById('vista-editor'),
  grafo: document.getElementById('vista-grafo'),
  calendario: document.getElementById('vista-calendario'),
  quadro: document.getElementById('vista-quadro'),
  arquivo: document.getElementById('vista-arquivo'),
  tarefas: document.getElementById('vista-tarefas'),
  lixeira: document.getElementById('vista-lixeira'),
  estatisticas: document.getElementById('vista-estatisticas'),
  atalhos: document.getElementById('vista-atalhos'),
}
const VISTAS_UNICAS = ['inicio', 'grafo', 'calendario', 'tarefas', 'lixeira', 'estatisticas', 'atalhos']

let vistaAtual = 'vazia'
let dados = { pastas: [], notas: [], quadros: [], notinhas: [], arquivos: [] }
let notaAtual = null
let quadroAtual = null
let arquivoAtual = null
let escopoGrafo = null
let pastaParaRenomear = null
let quadroParaRenomear = null

let abas = []
let abaAtiva = null
let proximoIdAba = 1
const fechadas = []
let assinaturaAbas = ''

let modoLateral = 'arquivos'
let lateralRecolhida = false
let larguraLateral = 260
const renomeadores = new Map()

const MIME = 'application/x-segundo-cerebro'
const MIME_GUIA = 'application/x-guia'
const EXT_IMAGEM = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']

const guardar = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
  }
}
const ler = (chave, padrao) => {
  try {
    const v = localStorage.getItem(chave)
    return v === null ? padrao : JSON.parse(v)
  } catch {
    return padrao
  }
}

function caminhoDaPasta(pastas, id) {
  const mapa = new Map(pastas.map((p) => [p.id, p]))
  const caminho = []
  let atual = mapa.get(id)
  let guarda = 0
  while (atual && guarda++ < 50) {
    caminho.unshift(atual)
    atual = atual.pai_id === null ? undefined : mapa.get(atual.pai_id)
  }
  return caminho
}

function rotuloDaPasta(pastas, id) {
  return caminhoDaPasta(pastas, id).map((p) => p.nome).join(' / ')
}

function subarvore(pastas, id) {
  const resultado = new Set([id])
  let cresceu = true
  while (cresceu) {
    cresceu = false
    for (const p of pastas) {
      if (p.pai_id !== null && resultado.has(p.pai_id) && !resultado.has(p.id)) {
        resultado.add(p.id)
        cresceu = true
      }
    }
  }
  return resultado
}

function extrairTags(texto) {
  return texto.match(/(?<![^\s])#[\p{L}\p{N}_-]+/gu) || []
}

function criarSpan(classe, conteudo) {
  const span = document.createElement('span')
  if (classe) span.className = classe
  span.textContent = conteudo
  return span
}

const visualizavel = (a) => a.ext === 'pdf' || EXT_IMAGEM.includes(a.ext)
const iconeDoArquivo = (a) => (a.ext === 'pdf' ? 'pdf' : EXT_IMAGEM.includes(a.ext) ? 'imagem' : 'arquivo')

function avisoGlobal(texto) {
  const el = document.getElementById('toast')
  el.textContent = texto
  el.hidden = false
  clearTimeout(avisoGlobal.timer)
  avisoGlobal.timer = setTimeout(() => {
    el.hidden = true
  }, 2600)
}

function podarAbas() {
  const antes = abas.length
  abas = abas.filter((a) => {
    if (a.tipo === 'nota') return dados.notas.some((n) => n.id === a.alvo)
    if (a.tipo === 'quadro') return dados.quadros.some((q) => q.id === a.alvo)
    if (a.tipo === 'arquivo') return dados.arquivos.some((x) => x.id === a.alvo)
    return true
  })
  if (abas.length === antes) return false
  salvarAbas()
  return true
}

async function buscarDados() {
  const [notas, pastas, quadros, notinhas, arquivos] = await Promise.all([
    window.api.listarNotas(),
    window.api.listarPastas(),
    window.api.listarQuadros(),
    window.api.listarNotinhas(),
    window.api.listarArquivos(),
  ])
  dados = { notas, pastas, quadros, notinhas, arquivos }
  Links.definirPastas(pastas)
  if (typeof escopoGrafo === 'number' && !pastas.some((p) => p.id === escopoGrafo)) escopoGrafo = null

  const editorOk = vistaAtual !== 'editor' || Editor.definirDados(notas, pastas)
  if (!editorOk) {
    Editor.esquecer()
    notaAtual = null
  }

  if (podarAbas() || !editorOk) {
    if (!abas.some((a) => a.id === abaAtiva)) abaAtiva = null
    if (abaAtiva === null) {
      if (abas.length > 0) await ativarAba(abas[abas.length - 1].id)
      else await mostrarVista('vazia')
    }
  }
  if (vistaAtual === 'vazia') montarInicio()
  renderizarAbas()
}

async function mostrarVista(nome) {
  if (!vistas[nome]) return
  if (vistaAtual === 'editor' && nome !== 'editor') await Editor.fechar()
  vistaAtual = nome
  if (nome !== 'editor') notaAtual = null

  for (const [chave, secao] of Object.entries(vistas)) secao.hidden = chave !== nome
  btnGrafo.classList.toggle('ativo', nome === 'grafo')
  btnCalendario.classList.toggle('ativo', nome === 'calendario')
  btnTarefas.classList.toggle('ativo', nome === 'tarefas')
  btnLixeira.classList.toggle('ativo', nome === 'lixeira')
  btnEstatisticas.classList.toggle('ativo', nome === 'estatisticas')
  if (nome === 'vazia') montarInicio()
  document.getElementById('btn-inicio')?.classList.toggle('ativa', nome === 'vazia')
  btnAjuda.classList.toggle('ativo', nome === 'atalhos')

  Grafo.definirVisivel(nome === 'grafo')
  Quadro.definirVisivel(nome === 'quadro')
  Calendario.definirVisivel(nome === 'calendario')
  Arquivo.definirVisivel(nome === 'arquivo')
  if (nome === 'grafo') {
    await buscarDados()
    desenharGrafo()
  }
  if (nome === 'calendario') {
    await buscarDados()
    Calendario.atualizar(dados.notas, dados.notinhas)
  }
  if (nome === 'tarefas') {
    await buscarDados()
    Tarefas.atualizar(dados.notas, dados.pastas)
  }
  if (nome === 'lixeira') await Lixeira.atualizar()
  if (nome === 'estatisticas') {
    await buscarDados()
    Estatisticas.atualizar(dados)
  }
  renderizarArvore()
}

function desenharGrafo() {
  const ids = typeof escopoGrafo === 'number' ? subarvore(dados.pastas, escopoGrafo) : null
  grafoEscopo.textContent = ids ? rotuloDaPasta(dados.pastas, escopoGrafo) : 'Todas as notas'
  grafoTudo.hidden = ids === null
  Grafo.atualizar(ids ? dados.notas.filter((n) => ids.has(n.pasta_id)) : dados.notas)
}

async function atualizarArvore() {
  await buscarDados()
  renderizarArvore()
}

async function atualizarTela() {
  await buscarDados()
  renderizarArvore()
  if (vistaAtual === 'grafo') desenharGrafo()
  if (vistaAtual === 'calendario') Calendario.atualizar(dados.notas, dados.notinhas)
  if (vistaAtual === 'quadro') await Quadro.recarregar()
  if (vistaAtual === 'tarefas') Tarefas.atualizar(dados.notas, dados.pastas)
  if (vistaAtual === 'lixeira') await Lixeira.atualizar()
  if (vistaAtual === 'estatisticas') Estatisticas.atualizar(dados)
}

function infoDaAba(aba) {
  if (aba.tipo === 'nota') {
    const n = dados.notas.find((x) => x.id === aba.alvo)
    return { titulo: n ? Links.titulo(n.texto) || 'Sem título' : 'Nota', icone: n && n.tipo === 'lista' ? 'lista' : 'nota' }
  }
  if (aba.tipo === 'quadro') {
    const q = dados.quadros.find((x) => x.id === aba.alvo)
    return { titulo: q ? q.nome : 'Quadro', icone: 'quadro' }
  }
  if (aba.tipo === 'arquivo') {
    const a = dados.arquivos.find((x) => x.id === aba.alvo)
    return { titulo: a ? a.nome : 'Arquivo', icone: a ? iconeDoArquivo(a) : 'arquivo' }
  }
  if (aba.tipo === 'grafo') return { titulo: 'Grafo', icone: 'grafo' }
  if (aba.tipo === 'tarefas') return { titulo: 'Tarefas', icone: 'feita' }
  if (aba.tipo === 'lixeira') return { titulo: 'Lixeira', icone: 'lixo' }
  if (aba.tipo === 'estatisticas') return { titulo: 'Estatísticas', icone: 'grafico' }
  if (aba.tipo === 'atalhos') return { titulo: 'Atalhos', icone: 'teclado' }
  if (aba.tipo === 'inicio') return { titulo: 'Início', icone: 'casa' }
  return { titulo: 'Calendário', icone: 'calendario' }
}

function salvarAbas() {
  guardar('abas', {
    itens: abas.map(({ tipo, alvo, fixada }) => (fixada ? { tipo, alvo, fixada: true } : { tipo, alvo })),
    ativa: abas.findIndex((a) => a.id === abaAtiva),
  })
}

async function restaurarAbas() {
  const salvo = ler('abas', null)
  if (!salvo || !Array.isArray(salvo.itens)) return
  for (const item of salvo.itens) {
    if (item.tipo === 'nota' && !dados.notas.some((n) => n.id === item.alvo)) continue
    if (item.tipo === 'quadro' && !dados.quadros.some((q) => q.id === item.alvo)) continue
    if (item.tipo === 'arquivo' && !dados.arquivos.some((a) => a.id === item.alvo)) continue
    if (!['nota', 'quadro', 'arquivo', ...VISTAS_UNICAS].includes(item.tipo)) continue
    abas.push({ id: proximoIdAba++, tipo: item.tipo, alvo: item.alvo ?? null, fixada: Boolean(item.fixada) })
  }
  const alvo = abas[Math.max(0, Math.min(Number(salvo.ativa), abas.length - 1))]
  if (alvo) await ativarAba(alvo.id)
}

function abaJaVisivel(aba) {
  if (aba.tipo === 'nota') return vistaAtual === 'editor' && Editor.idAtual() === aba.alvo
  if (aba.tipo === 'quadro') return vistaAtual === 'quadro' && quadroAtual === aba.alvo
  if (aba.tipo === 'arquivo') return vistaAtual === 'arquivo' && arquivoAtual === aba.alvo
  if (aba.tipo === 'inicio') return vistaAtual === 'vazia'
  return vistaAtual === aba.tipo
}

const historicoAbas = []
let voltandoHistorico = false

function registrarHistorico(id) {
  if (id === null || voltandoHistorico) return
  if (historicoAbas[historicoAbas.length - 1] === id) return
  historicoAbas.push(id)
  if (historicoAbas.length > 50) historicoAbas.shift()
}

async function voltarAba() {
  while (historicoAbas.length) {
    const id = historicoAbas.pop()
    const aba = abas.find((a) => a.id === id)
    if (!aba || id === abaAtiva) continue
    voltandoHistorico = true
    try {
      await ativarAba(id)
    } finally {
      voltandoHistorico = false
    }
    return
  }
}

async function ativarAba(id, opcoes = {}) {
  const aba = abas.find((a) => a.id === id)
  if (!aba) return
  registrarHistorico(abaAtiva)
  abaAtiva = id

  if (!opcoes.forcar && abaJaVisivel(aba)) {
    if (aba.tipo === 'nota') Editor.aoMostrar(opcoes)
    renderizarAbas()
    salvarAbas()
    return
  }

  if (aba.tipo === 'nota') {
    const ok = await Editor.abrir(aba.alvo)
    if (!ok) {
      await fecharAba(id)
      return
    }
    if (vistaAtual !== 'editor') await mostrarVista('editor')
    notaAtual = aba.alvo
    renderizarArvore()
    Editor.aoMostrar(opcoes)
  } else if (aba.tipo === 'quadro') {
    quadroAtual = aba.alvo
    await mostrarVista('quadro')
    await Quadro.abrir(aba.alvo)
  } else if (aba.tipo === 'arquivo') {
    arquivoAtual = aba.alvo
    await mostrarVista('arquivo')
    await Arquivo.abrir(aba.alvo)
  } else if (aba.tipo === 'inicio') {
    await mostrarVista('vazia')
  } else {
    await mostrarVista(aba.tipo)
  }
  renderizarAbas()
  salvarAbas()
}

async function abrirNaAba(tipo, alvo, opcoes = {}) {
  const existente = abas.find((a) => a.tipo === tipo && a.alvo === alvo)
  if (existente) {
    await ativarAba(existente.id, opcoes)
    return
  }
  const ativa = abas.find((a) => a.id === abaAtiva)
  registrarRecente(tipo, alvo)
  const unica = VISTAS_UNICAS.includes(tipo)
  if (!ativa || opcoes.novaAba || unica) {
    const nova = { id: proximoIdAba++, tipo, alvo }
    abas.splice(ativa ? abas.indexOf(ativa) + 1 : abas.length, 0, nova)
    await ativarAba(nova.id, opcoes)
  } else {
    ativa.tipo = tipo
    ativa.alvo = alvo
    await ativarAba(ativa.id, { ...opcoes, forcar: true })
  }
}

const abrirNota = (id, opcoes = {}) => abrirNaAba('nota', id, opcoes)
const abrirQuadro = (id, opcoes = {}) => abrirNaAba('quadro', id, opcoes)
const abrirNotaEmNovaAba = (id) => abrirNota(id, { novaAba: true })

async function abrirArquivo(id, opcoes = {}) {
  const a = dados.arquivos.find((x) => x.id === id)
  if (!a) return

  if (visualizavel(a)) {
    arquivoAtual = id
    await mostrarVista('arquivo')
    await Arquivo.abrir(id)
    return
  }
  await abrirArquivoFora(id)
}
async function abrirArquivoFora(id) {
  const r = await window.api.abrirArquivoExterno(id)
  if (!r.ok) avisoGlobal(r.motivo || 'Não consegui abrir este arquivo')
}

async function fecharAba(id, opcoes = {}) {
  const i = abas.findIndex((a) => a.id === id)
  if (i < 0) return
  if (abas[i].fixada && !opcoes.forcar) {
    avisoGlobal('Esta aba está fixada — desafixe pelo menu da aba para fechar')
    return
  }
  const [removida] = abas.splice(i, 1)
  if (['nota', 'quadro', 'arquivo'].includes(removida.tipo)) {
    fechadas.push({ tipo: removida.tipo, alvo: removida.alvo })
    if (fechadas.length > 15) fechadas.shift()
  }
  if (id === abaAtiva) {
    const vizinha = abas[Math.min(i, abas.length - 1)]
    try {
      if (vizinha) await ativarAba(vizinha.id)
      else {
        abaAtiva = null
        await mostrarVista('vazia')
      }
    } catch (err) {
      console.error(err)
      abaAtiva = vizinha ? vizinha.id : null
      try {
        await mostrarVista('vazia')
      } catch {}
    }
  }
  renderizarAbas()
  salvarAbas()
}

async function fecharVarias(lista) {
  const ids = new Set(lista.map((a) => a.id))
  for (const a of lista) if (a.id !== abaAtiva) await fecharAba(a.id)
  if (ids.has(abaAtiva)) await fecharAba(abaAtiva)
}

function fixarAba(id) {
  const aba = abas.find((a) => a.id === id)
  if (!aba) return
  aba.fixada = !aba.fixada
  renderizarAbas()
  salvarAbas()
}

const ladoEl = document.getElementById('lado')
let ladoNotaId = null

async function abrirLadoNota(notaId) {
  const nota = dados.notas.find((n) => n.id === notaId)
  if (!nota) return
  ladoNotaId = notaId
  document.getElementById('lado-titulo').textContent = Links.titulo(nota.texto) || '(sem título)'
  const conteudo = document.getElementById('lado-conteudo')
  conteudo.innerHTML = Markdown.renderizar(nota.texto)
  Rico.processar(conteudo)
  ladoEl.hidden = false
}

function fecharLado() {
  ladoNotaId = null
  ladoEl.hidden = true
}

function itemInicio(icone, corpo, detalhe, aoClicar) {
  const el = document.createElement('button')
  el.className = 'vazia-item'
  el.append(Icones.criar(icone, 15), criarSpan('corpo', corpo))
  const det = document.createElement('small')
  det.textContent = detalhe || ''
  el.appendChild(det)
  el.addEventListener('click', aoClicar)
  return el
}

function secaoInicio(titulo) {
  const secao = document.createElement('div')
  secao.className = 'vazia-secao'
  const h = document.createElement('h4')
  h.textContent = titulo
  const itens = document.createElement('div')
  itens.className = 'vazia-itens'
  secao.append(h, itens)
  return { secao, itens }
}

function montarInicio() {
  const menu = document.getElementById('vazia-menu')
  menu.replaceChildren()

  const marca = document.createElement('div')
  marca.className = 'vazia-marca'
  const img = document.createElement('img')
  img.src = 'icon.png'
  img.width = 76
  img.height = 76
  img.alt = ''
  const forte = document.createElement('strong')
  forte.textContent = 'Fern'
  const legenda = document.createElement('span')
  legenda.textContent = 'seu segundo cérebro'
  marca.append(img, forte, legenda)
  menu.appendChild(marca)

  const vazioDeTudo =
    dados.notas.length === 0 && dados.quadros.length === 0 &&
    dados.arquivos.length === 0 && dados.pastas.length === 0

  if (vazioDeTudo) {
    const { secao, itens } = secaoInicio('Começar')
    itens.append(
      itemInicio('nota', 'Criar sua primeira nota', 'Ctrl+N', () => criarNotaNova(null)),
      itemInicio('pasta', 'Criar uma pasta para organizar', '', () => criarPastaNova(null)),
      itemInicio('quadro', 'Criar um quadro de ideias', '', () => criarQuadroNovo(null)),
      itemInicio('teclado', 'Ver todos os atalhos', 'F1', alternarAtalhos)
    )
    menu.appendChild(secao)
    return
  }

  const grade = document.createElement('div')
  grade.className = 'vazia-grade'
  menu.appendChild(grade)

  const { secao: secAcoes, itens: itensAcoes } = secaoInicio('Ações rápidas')
  const acoes = document.createElement('div')
  acoes.className = 'vazia-acoes'
  const botao = (rotulo, fn) => {
    const b = document.createElement('button')
    b.textContent = rotulo
    b.addEventListener('click', fn)
    return b
  }
  acoes.append(
    botao('+ Nota', () => criarNotaNova(pastaDoItemAtual())),
    botao('+ Quadro', () => criarQuadroNovo(pastaDoItemAtual())),
    botao('Buscar (Ctrl+K)', () => abrirPaleta()),
    botao('Tarefas', alternarTarefas),
    botao('Atalhos (F1)', alternarAtalhos)
  )
  itensAcoes.appendChild(acoes)
  grade.appendChild(secAcoes)

  const agora = new Date()
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  const pendentes = Afazeres.extrair(dados.notas, dados.pastas)
    .filter((t) => !t.feita && t.data && t.data <= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 8)
  if (pendentes.length > 0) {
    const { secao, itens } = secaoInicio('Lembretes de hoje e vencidos')
    for (const t of pendentes) {
      const vencida = t.data < hoje
      const item = itemInicio('tarefa', t.texto, vencida ? `venceu ${t.data}` : 'hoje', () =>
        abrirNota(t.notaId)
      )
      if (vencida) item.classList.add('vencida')
      itens.appendChild(item)
    }
    grade.appendChild(secao)
  }

  const vistos = recentes
    .map((r) => ({ r, nota: r.tipo === 'nota' ? dados.notas.find((n) => n.id === r.alvo) : null }))
    .filter((x) => x.nota)
    .slice(0, 8)
  const outros = recentes
    .filter((r) => r.tipo !== 'nota')
    .slice(0, 6)
  if (vistos.length > 0 || outros.length > 0) {
    const { secao, itens } = secaoInicio('Recentes')
    for (const { nota } of vistos) {
      itens.appendChild(
        itemInicio('nota', Links.titulo(nota.texto) || '(sem título)', 'nota', () => abrirNota(nota.id))
      )
    }
    for (const r of outros) {
      if (r.tipo === 'quadro') {
        const q = dados.quadros.find((x) => x.id === r.alvo)
        if (q) itens.appendChild(itemInicio('quadro', q.nome, 'quadro', () => abrirQuadro(q.id)))
      } else if (r.tipo === 'arquivo') {
        const a = dados.arquivos.find((x) => x.id === r.alvo)
        if (a) itens.appendChild(itemInicio('arquivo', a.nome, 'arquivo', () => abrirArquivo(a.id)))
      }
    }
    grade.appendChild(secao)
  }

  const { secao: secEst, itens: itensEst } = secaoInicio('Estatísticas')
  secEst.classList.add('ampla')
  secEst.style.width = 'min(1400px, 96%)'
  const alvoEst = document.createElement('div')
  itensEst.appendChild(alvoEst)
  Estatisticas.atualizar(dados, alvoEst)
  const verTudo = document.createElement('button')
  verTudo.className = 'vazia-item'
  verTudo.append(Icones.criar('grafico', 15), criarSpan('corpo', 'Abrir página de estatísticas'), criarSpan('', '→'))
  verTudo.addEventListener('click', () => alternarVistaUnica('estatisticas'))
  itensEst.appendChild(verTudo)
  menu.appendChild(secEst)
}

async function reabrirFechada() {
  while (fechadas.length > 0) {
    const { tipo, alvo } = fechadas.pop()
    const existe =
      tipo === 'nota'
        ? dados.notas.some((n) => n.id === alvo)
        : tipo === 'quadro'
          ? dados.quadros.some((q) => q.id === alvo)
          : dados.arquivos.some((a) => a.id === alvo)
    if (existe) {
      await abrirNaAba(tipo, alvo, { novaAba: true })
      return
    }
  }
}

function moverAba(origemId, destinoId) {
  if (origemId === destinoId) return
  const de = abas.findIndex((a) => a.id === origemId)
  const para = abas.findIndex((a) => a.id === destinoId)
  if (de < 0 || para < 0) return
  const [aba] = abas.splice(de, 1)
  abas.splice(para, 0, aba)
  renderizarAbas()
  salvarAbas()
}

async function irParaAba(delta) {
  if (abas.length < 2) return
  const i = abas.findIndex((a) => a.id === abaAtiva)
  await ativarAba(abas[(i + delta + abas.length) % abas.length].id)
}

async function irParaAbaNumero(n) {
  if (abas.length === 0) return
  const aba = n === 9 ? abas[abas.length - 1] : abas[n - 1]
  if (aba) await ativarAba(aba.id)
}

function itensDaGuia(aba) {
  const i = abas.findIndex((a) => a.id === aba.id)
  const itens = [
    { rotulo: aba.fixada ? 'Desafixar aba' : 'Fixar aba', aoClicar: () => fixarAba(aba.id) },
    { rotulo: 'Fechar', atalho: 'Ctrl+W', aoClicar: () => fecharAba(aba.id) },
    {
      rotulo: 'Fechar outras',
      desativado: abas.length < 2,
      aoClicar: () => fecharVarias(abas.filter((a) => a.id !== aba.id)),
    },
    {
      rotulo: 'Fechar à direita',
      desativado: i >= abas.length - 1,
      aoClicar: () => fecharVarias(abas.slice(i + 1)),
    },
    { rotulo: 'Fechar todas', aoClicar: () => fecharVarias([...abas]) },
  ]
  if (aba.tipo === 'nota') {
    itens.push(
      { separador: true },
      { rotulo: 'Visualizar ao lado', aoClicar: () => abrirLadoNota(aba.alvo) }
    )
  }
  if (['nota', 'quadro', 'arquivo'].includes(aba.tipo)) {
    itens.push(
      ...(aba.tipo !== 'nota' ? [{ separador: true }] : []),
      { rotulo: 'Mostrar na árvore', aoClicar: () => revelarNaArvore(aba.tipo, aba.alvo) }
    )
  }
  return itens
}

function renderizarAbas() {
  const infos = abas.map((aba) => ({ aba, ...infoDaAba(aba) }))
  const assinatura = infos.map((i) => `${i.aba.id}|${i.titulo}|${i.icone}|${i.aba.id === abaAtiva}|${Boolean(i.aba.fixada)}`).join('||')
  if (assinatura === assinaturaAbas) return
  assinaturaAbas = assinatura

  guiasEl.replaceChildren()
  for (const { aba, titulo, icone } of infos) {
    const el = document.createElement('div')
    el.className = 'guia' + (aba.id === abaAtiva ? ' ativa' : '')
    el.title = titulo
    el.draggable = true

    const fechar = document.createElement('button')
    fechar.className = 'guia-fechar'
    fechar.title = 'Fechar (Ctrl+W)'
    fechar.appendChild(Icones.criar('fechar', 12))
    fechar.addEventListener('mousedown', (e) => {
      e.stopPropagation()
      if (e.button !== 0) return
      e.preventDefault()
      fecharAba(aba.id)
    })
    fechar.addEventListener('pointerdown', (e) => e.stopPropagation())
    fechar.addEventListener('auxclick', (e) => e.stopPropagation())
    fechar.addEventListener('click', (e) => {
      e.stopPropagation()
      fecharAba(aba.id)
    })

    if (aba.fixada) {
      el.classList.add('fixada')
      const pin = document.createElement('span')
      pin.className = 'guia-pin'
      pin.appendChild(Icones.criar('fixar', 11))
      el.append(Icones.criar(icone, 14), pin, criarSpan('guia-titulo', titulo), fechar)
    } else {
      el.append(Icones.criar(icone, 14), criarSpan('guia-titulo', titulo), fechar)
    }
    el.addEventListener('click', () => {
      ativarAba(aba.id).catch((err) => console.error(err))
    })
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault()
    })
    el.addEventListener('auxclick', (e) => {
      if (e.button !== 1) return
      e.preventDefault()
      fecharAba(aba.id)
    })
    el.addEventListener('contextmenu', (e) => abrirMenuNoClique(e, itensDaGuia(aba)))

    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData(MIME_GUIA, String(aba.id))
      e.dataTransfer.effectAllowed = 'move'
      el.classList.add('arrastando')
    })
    el.addEventListener('dragend', () => el.classList.remove('arrastando'))
    el.addEventListener('dragover', (e) => {
      if (!Array.from(e.dataTransfer.types).includes(MIME_GUIA)) return
      e.preventDefault()
      el.classList.add('alvo-soltar')
    })
    el.addEventListener('dragleave', () => el.classList.remove('alvo-soltar'))
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      el.classList.remove('alvo-soltar')
      moverAba(Number(e.dataTransfer.getData(MIME_GUIA)), aba.id)
    })
    guiasEl.appendChild(el)
  }
  guiasEl.querySelector('.ativa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

async function revelarNaArvore(tipo, id) {
  if (modoLateral !== 'arquivos') definirModoLateral('arquivos')
  if (lateralRecolhida) alternarLateral()
  const lista = tipo === 'nota' ? dados.notas : tipo === 'quadro' ? dados.quadros : dados.arquivos
  const item = lista.find((x) => x.id === id)
  if (!item) return
  await revelarPasta(item.pasta_id)
}

async function revelarPasta(pastaId) {
  let id = pastaId
  let guarda = 0
  while (id !== null && guarda++ < 50) {
    const pasta = dados.pastas.find((p) => p.id === id)
    if (!pasta) break
    if (!pasta.aberta) await window.api.alternarPasta(pasta.id)
    id = pasta.pai_id
  }
  await atualizarArvore()
  arvore.querySelector('.selecionado')?.scrollIntoView({ block: 'center' })
}

async function renomearAtual() {
  const aba = abas.find((a) => a.id === abaAtiva)
  if (!aba) return
  if (aba.tipo === 'nota') {
    Editor.aoMostrar({ focarTitulo: true })
  } else if (aba.tipo === 'quadro' || aba.tipo === 'arquivo') {
    await revelarNaArvore(aba.tipo, aba.alvo)
    const renomear = renomeadores.get(`${aba.tipo}:${aba.alvo}`)
    if (renomear) renomear()
  }
}

function primeiroDaPasta(pastaId) {
  const notas = dados.notas
    .filter((n) => n.pasta_id === pastaId)
    .map((n) => ({ n, titulo: Links.titulo(n.texto) || '(sem título)' }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
  if (notas.length > 0) return { tipo: 'nota', id: notas[0].n.id, pastaId }

  const quadros = dados.quadros
    .filter((q) => q.pasta_id === pastaId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  if (quadros.length > 0) return { tipo: 'quadro', id: quadros[0].id, pastaId }

  const arquivos = dados.arquivos
    .filter((a) => a.pasta_id === pastaId && visualizavel(a))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  if (arquivos.length > 0) return { tipo: 'arquivo', id: arquivos[0].id, pastaId }

  const subpastas = dados.pastas
    .filter((p) => p.pai_id === pastaId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  for (const sub of subpastas) {
    const achado = primeiroDaPasta(sub.id)
    if (achado) return achado
  }
  return null
}

async function abrirPasta(pastaId, opcoes = {}) {
  await buscarDados()
  const item = primeiroDaPasta(pastaId)
  if (!item) {
    await revelarPasta(pastaId)
    avisoGlobal('Esta pasta está vazia')
    return
  }
  if (item.tipo === 'nota') await abrirNota(item.id, opcoes)
  else if (item.tipo === 'quadro') await abrirQuadro(item.id, opcoes)
  else await abrirArquivo(item.id, opcoes)
  await revelarPasta(item.pastaId)
}

function aplicarLateral() {
  document.body.classList.toggle('lateral-recolhida', lateralRecolhida)
  lateral.style.width = `${larguraLateral}px`
}

function alternarLateral() {
  lateralRecolhida = !lateralRecolhida
  guardar('lateralRecolhida', lateralRecolhida)
  aplicarLateral()
}

function definirModoLateral(modo) {
  modoLateral = modo
  arvore.hidden = modo !== 'arquivos'
  painelTags.hidden = modo !== 'tags'
  btnArquivos.classList.toggle('ativo', modo === 'arquivos')
  btnTags.classList.toggle('ativo', modo === 'tags')
  if (modo === 'tags') renderizarTags()
  guardar('modoLateral', modo)
}

function renderizarTags() {
  painelTags.replaceChildren()
  const contagem = new Map()
  for (const nota of dados.notas) {
    for (const tag of new Set(extrairTags(nota.texto).map((t) => t.toLowerCase()))) {
      const atual = contagem.get(tag) || { tag, total: 0 }
      atual.total++
      contagem.set(tag, atual)
    }
  }
  const lista = [...contagem.values()].sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag, 'pt-BR'))

  if (lista.length === 0) {
    const vazio = document.createElement('div')
    vazio.className = 'tags-vazio'
    vazio.textContent = 'Nenhuma tag ainda. Escreva #tag em uma nota.'
    painelTags.appendChild(vazio)
    return
  }
  for (const { tag, total } of lista) {
    const linha = document.createElement('div')
    linha.className = 'tag-linha'
    linha.append(criarSpan('', tag), criarSpan('contagem', total))
    linha.addEventListener('click', () => abrirPaleta(tag))
    painelTags.appendChild(linha)
  }
}

divisor.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  divisor.classList.add('arrastando')
  const mover = (ev) => {
    larguraLateral = Math.max(180, Math.min(520, ev.clientX))
    aplicarLateral()
  }
  const soltar = () => {
    divisor.classList.remove('arrastando')
    window.removeEventListener('pointermove', mover)
    window.removeEventListener('pointerup', soltar)
    guardar('larguraLateral', larguraLateral)
  }
  window.addEventListener('pointermove', mover)
  window.addEventListener('pointerup', soltar)
})

async function garantirPastaAberta(pastaId) {
  const pasta = dados.pastas.find((p) => p.id === pastaId)
  if (pasta && !pasta.aberta) await window.api.alternarPasta(pastaId)
}

function pastaDoItemAtual() {
  const aba = abas.find((a) => a.id === abaAtiva)
  if (!aba) return null
  const lista =
    aba.tipo === 'nota' ? dados.notas : aba.tipo === 'quadro' ? dados.quadros : aba.tipo === 'arquivo' ? dados.arquivos : []
  const item = lista.find((x) => x.id === aba.alvo)
  return item ? item.pasta_id : null
}

async function criarNotaNova(pastaId) {
  if (pastaId !== null) await garantirPastaAberta(pastaId)
  const nota = await window.api.criarNota('', 'ideia', null, '', pastaId)
  await atualizarTela()
  await abrirNota(nota.id, { focarTitulo: true, novaAba: true })
}

async function criarPastaNova(paiId) {
  const pasta = await window.api.criarPasta('Nova pasta', paiId)
  pastaParaRenomear = pasta.id
  await atualizarTela()
}

async function criarQuadroNovo(pastaId) {
  const quadro = await window.api.criarQuadro('Novo quadro', pastaId)
  await abrirQuadro(quadro.id, { novaAba: true })
  quadroParaRenomear = quadro.id
  await atualizarTela()
}

async function duplicarNota(nota) {
  const linhas = nota.texto.split('\n')
  linhas[0] = (linhas[0] || 'Sem título') + ' (cópia)'
  const nova = await window.api.criarNota(linhas.join('\n'), nota.tipo, nota.prazo, nota.projeto || '', nota.pasta_id)
  await atualizarTela()
  await abrirNota(nova.id, { novaAba: true })
}

async function criarListaNova(pastaId) {
  if (pastaId !== null) await garantirPastaAberta(pastaId)
  const nota = await window.api.criarNota('Lista de compras', 'lista', null, '', pastaId)
  await atualizarTela()
  await abrirNota(nota.id, { focarTitulo: true, novaAba: true })
}

async function fixarNota(nota) {
  await window.api.fixarNota(nota.id, !nota.fixada)
  await atualizarTela()
}

async function fixarQuadro(quadro) {
  await window.api.fixarQuadro(quadro.id, !quadro.fixada)
  await atualizarTela()
}

async function trocarTipoNota(nota, tipo) {
  if (Editor.idAtual() === nota.id) {
    await Editor.definirTipo(tipo)
  } else {
    await window.api.atualizarNota(nota.id, nota.texto, tipo, nota.prazo, nota.projeto, nota.pasta_id)
  }
  await atualizarTela()
  renderizarAbas()
}

const MODELOS_PADRAO = [
  ['ideia', 'Reunião {{data}}\n**Participantes:** \n\n## Pauta\n- \n\n## Anotações\n\n\n## Decisões\n- \n\n## Próximos passos\n- [ ] '],
  ['ideia', 'Diário {{data}}\n{{dia_semana}}, {{hora}}\n\n## Como estou\n\n\n## O que aconteceu hoje\n\n\n## Sou grato por\n- '],
  ['ideia', 'Projeto: \n#projeto\n\n## Objetivo\n\n\n## Tarefas\n- [ ] \n\n## Links e referências\n- '],
  ['lista', 'Lista de compras\n## Mercearia\n- [ ] Arroz\n- [ ] Feijão\n- [ ] Café\n- [ ] Açúcar\n## Hortifrúti\n- [ ] Banana\n- [ ] Tomate\n- [ ] Cebola\n## Frios e laticínios\n- [ ] Leite\n- [ ] Ovos\n- [ ] Queijo\n## Limpeza\n- [ ] Detergente'],
]

function pastaDeModelos() {
  return dados.pastas.find((p) => p.pai_id === null && Links.normalizar(p.nome) === 'modelos') || null
}

async function garantirModelos() {
  const existente = pastaDeModelos()
  if (existente) return existente.id
  const pasta = await window.api.criarPasta('Modelos', null)
  for (const [tipo, texto] of MODELOS_PADRAO) await window.api.criarNota(texto, tipo, null, '', pasta.id)
  await window.api.alternarPasta(pasta.id)
  await buscarDados()
  return pasta.id
}

function preencherModelo(texto) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  return texto
    .replace(/\{\{\s*data\s*\}\}/gi, `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`)
    .replace(/\{\{\s*hora\s*\}\}/gi, `${p(d.getHours())}:${p(d.getMinutes())}`)
    .replace(/\{\{\s*dia_semana\s*\}\}/gi, dias[d.getDay()])
}

async function criarDeModelo(pastaId) {
  const idModelos = await garantirModelos()
  const ids = subarvore(dados.pastas, idModelos)
  const modelos = dados.notas
    .filter((n) => ids.has(n.pasta_id))
    .map((n) => ({
      titulo: Links.titulo(n.texto) || '(sem título)',
      detalhe: n.tipo === 'lista' ? 'Lista' : Links.titulo(n.texto.split('\n').slice(1).join('\n')) || 'Nota',
      valor: n,
    }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
  if (modelos.length === 0) {
    avisoGlobal('A pasta "Modelos" está vazia: crie notas nela para usar como modelo')
    await revelarPasta(idModelos)
    return
  }
  const modelo = await escolherItem('Escolha um modelo (as notas da pasta "Modelos")', modelos)
  if (!modelo) return
  const destino = pastaId !== null && !ids.has(pastaId) ? pastaId : null
  if (destino !== null) await garantirPastaAberta(destino)
  const tipo = modelo.tipo === 'lista' ? 'lista' : 'ideia'
  const nota = await window.api.criarNota(preencherModelo(modelo.texto), tipo, null, '', destino)
  await atualizarTela()
  await abrirNota(nota.id, { novaAba: true, focarTitulo: tipo !== 'lista', focarLista: tipo === 'lista' })
}

async function salvarComoModelo(nota) {
  const texto = (Editor.idAtual() === nota.id && Editor.textoAtual()) || nota.texto
  const idModelos = await garantirModelos()
  await window.api.criarNota(texto, nota.tipo === 'lista' ? 'lista' : 'ideia', null, '', idModelos)
  await atualizarTela()
  avisoGlobal('Modelo salvo na pasta "Modelos" (use Ctrl+Shift+N para criar notas a partir dele)')
}

let seletorAtual = null
function escolherItem(placeholder, itens) {
  const caixa = document.getElementById('seletor')
  const busca = document.getElementById('seletor-busca')
  const lista = document.getElementById('seletor-lista')
  if (seletorAtual) seletorAtual(null)
  return new Promise((resolver) => {
    let filtrados = itens
    let indice = 0
    const terminar = (valor) => {
      caixa.hidden = true
      busca.oninput = busca.onkeydown = caixa.onpointerdown = null
      seletorAtual = null
      resolver(valor)
    }
    seletorAtual = terminar
    const desenhar = () => {
      lista.replaceChildren()
      filtrados.forEach((item, i) => {
        const li = document.createElement('li')
        if (i === indice) li.className = 'ativo'
        li.append(criarSpan('', item.titulo))
        const small = document.createElement('small')
        small.textContent = item.detalhe
        li.appendChild(small)
        li.addEventListener('mousedown', (e) => {
          e.preventDefault()
          terminar(item.valor)
        })
        lista.appendChild(li)
      })
      lista.querySelector('.ativo')?.scrollIntoView({ block: 'nearest' })
    }
    busca.placeholder = placeholder
    busca.value = ''
    busca.oninput = () => {
      const q = Links.normalizar(busca.value)
      filtrados = itens.filter((x) => Links.normalizar(x.titulo).includes(q))
      indice = 0
      desenhar()
    }
    busca.onkeydown = (e) => {
      e.stopPropagation()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (filtrados.length) indice = (indice + (e.key === 'ArrowDown' ? 1 : -1) + filtrados.length) % filtrados.length
        desenhar()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtrados[indice]) terminar(filtrados[indice].valor)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        terminar(null)
      }
    }
    caixa.onpointerdown = (e) => {
      if (e.target === caixa) terminar(null)
    }
    caixa.hidden = false
    desenhar()
    busca.focus()
  })
}

async function apagarNota(nota) {
  const titulo = Links.titulo(nota.texto) || 'Sem título'
  if (!confirm(`Apagar "${titulo}"? Ela vai para a lixeira.`)) return
  if (notaAtual === nota.id) Editor.esquecer()
  await window.api.moverParaLixeira('nota', nota.id)
  await atualizarTela()
  avisoGlobal(`"${titulo}" foi para a lixeira`)
}

async function apagarPasta(pasta) {
  const temConteudo =
    dados.notas.some((n) => n.pasta_id === pasta.id) ||
    dados.pastas.some((p) => p.pai_id === pasta.id) ||
    dados.quadros.some((q) => q.pasta_id === pasta.id) ||
    dados.arquivos.some((a) => a.pasta_id === pasta.id)
  if (temConteudo) {
    const ok = confirm(
      `A pasta "${pasta.nome}" tem conteúdo. Ao apagar, tudo o que está dentro sobe para a pasta de cima. Continuar?`
    )
    if (!ok) return
  }
  await window.api.removerPasta(pasta.id)
  await atualizarTela()
}

async function apagarQuadro(quadro) {
  if (!confirm(`Apagar o quadro "${quadro.nome}"? Ele vai para a lixeira.`)) return
  await window.api.moverParaLixeira('quadro', quadro.id)
  await atualizarTela()
  avisoGlobal(`"${quadro.nome}" foi para a lixeira`)
}

async function apagarArquivo(arq) {
  if (!confirm(`Apagar o arquivo "${arq.nome}"? Ele vai para a lixeira.`)) return
  await window.api.moverParaLixeira('arquivo', arq.id)
  await atualizarTela()
  avisoGlobal(`"${arq.nome}" foi para a lixeira`)
}

async function concluirAdicao(adicionados, ignorados, pastaId) {
  if (pastaId !== null) await garantirPastaAberta(pastaId)
  await atualizarTela()
  const n = adicionados.length
  if (n > 0) avisoGlobal(n === 1 ? 'Arquivo adicionado' : `${n} arquivos adicionados`)
  if (ignorados > 0) avisoGlobal(`${ignorados} arquivo(s) não puderam ser adicionados (limite de 300 MB)`)
  if (n === 1 && visualizavel(adicionados[0])) await abrirArquivo(adicionados[0].id, { novaAba: true })
}

async function adicionarArquivos(pastaId) {
  const r = await window.api.escolherArquivos(pastaId)
  if (r.adicionados.length === 0 && r.ignorados === 0) return
  await concluirAdicao(r.adicionados, r.ignorados, pastaId)
}

async function adicionarArquivosSoltos(arquivos, pastaId) {
  const adicionados = []
  let ignorados = 0
  for (const arquivo of arquivos) {
    if (arquivo.size > 300 * 1024 * 1024) {
      ignorados++
      continue
    }
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      adicionados.push(await window.api.adicionarArquivo(arquivo.name, pastaId, bytes))
    } catch {
      ignorados++
    }
  }
  await concluirAdicao(adicionados, ignorados, pastaId)
}

async function verNoGrafo(pastaId) {
  escopoGrafo = pastaId
  await abrirNaAba('grafo', null, { forcar: true })
}

async function verNoCalendario(data) {
  await abrirNaAba('calendario', null, { forcar: true })
  Calendario.irPara(data)
}

async function alternarGrafo() {
  const aba = abas.find((a) => a.id === abaAtiva)
  if (aba && aba.tipo === 'grafo') await fecharAba(aba.id)
  else await abrirNaAba('grafo', null)
}

async function alternarTarefas() {
  const aba = abas.find((a) => a.id === abaAtiva)
  if (aba && aba.tipo === 'tarefas') await fecharAba(aba.id)
  else {
    await abrirNaAba('tarefas', null)
    Tarefas.focar()
  }
}

async function alternarVistaUnica(tipo) {
  const aba = abas.find((a) => a.id === abaAtiva)
  if (aba && aba.tipo === tipo) await fecharAba(aba.id)
  else await abrirNaAba(tipo, null)
}

async function alternarAtalhos() {
  await alternarVistaUnica('atalhos')
  if (vistaAtual === 'atalhos') Atalhos.focar()
}

async function alternarCalendario() {
  const aba = abas.find((a) => a.id === abaAtiva)
  if (aba && aba.tipo === 'calendario') await fecharAba(aba.id)
  else await abrirNaAba('calendario', null)
}

const itensDeCriacao = (paiId) => [
  { rotulo: 'Nova nota', atalho: 'Ctrl+N', aoClicar: () => criarNotaNova(paiId) },
  { rotulo: 'Nova lista (compras…)', atalho: 'Ctrl+Shift+L', aoClicar: () => criarListaNova(paiId) },
  { rotulo: 'Nova nota de um modelo…', atalho: 'Ctrl+Shift+N', aoClicar: () => criarDeModelo(paiId) },
  { rotulo: 'Novo quadro', aoClicar: () => criarQuadroNovo(paiId) },
  { rotulo: 'Nova pasta', aoClicar: () => criarPastaNova(paiId) },
  { separador: true },
  { rotulo: 'Adicionar arquivos…', aoClicar: () => adicionarArquivos(paiId) },
]

function itensDaPasta(pasta, renomear) {
  return [
    { rotulo: 'Nova nota', aoClicar: () => criarNotaNova(pasta.id) },
    { rotulo: 'Nova lista', aoClicar: () => criarListaNova(pasta.id) },
    { rotulo: 'Nova nota de um modelo…', aoClicar: () => criarDeModelo(pasta.id) },
    { rotulo: 'Novo quadro', aoClicar: () => criarQuadroNovo(pasta.id) },
    { rotulo: 'Nova subpasta', aoClicar: () => criarPastaNova(pasta.id) },
    { rotulo: 'Adicionar arquivos…', aoClicar: () => adicionarArquivos(pasta.id) },
    { separador: true },
    { rotulo: 'Renomear', aoClicar: renomear },
    { rotulo: 'Ver no grafo', aoClicar: () => verNoGrafo(pasta.id) },
    { separador: true },
    { rotulo: 'Apagar pasta', perigo: true, aoClicar: () => apagarPasta(pasta) },
  ]
}

function itensDaNota(nota, aberta) {
  const titulo = aberta ? Editor.tituloAtual() : Links.titulo(nota.texto)
  const itens = []
  if (!aberta) {
    itens.push(
      { rotulo: 'Abrir', aoClicar: () => abrirNota(nota.id) },
      { rotulo: 'Abrir em nova aba', aoClicar: () => abrirNota(nota.id, { novaAba: true }) }
    )
  }
  itens.push(
    { rotulo: 'Renomear', atalho: 'F2', aoClicar: () => abrirNota(nota.id, { focarTitulo: true }) },
    {
      rotulo: 'Copiar link',
      atalho: '[[ ]]',
      desativado: !titulo,
      aoClicar: () => window.api.copiarTexto(`[[${titulo}]]`),
    },
    { rotulo: 'Visualizar ao lado', aoClicar: () => abrirLadoNota(nota.id) },
    { rotulo: 'Duplicar', aoClicar: () => duplicarNota(nota) },
    { rotulo: nota.fixada ? 'Desafixar' : 'Fixar no topo', aoClicar: () => fixarNota(nota) },
    {
      rotulo: nota.tipo === 'lista' ? 'Transformar em nota comum' : 'Transformar em lista',
      aoClicar: () => trocarTipoNota(nota, nota.tipo === 'lista' ? 'ideia' : 'lista'),
    },
    { rotulo: 'Salvar como modelo', aoClicar: () => salvarComoModelo(nota) },
    { separador: true },
    { rotulo: 'Mover para a lixeira', perigo: true, aoClicar: () => apagarNota(nota) }
  )
  return itens
}

function itensDoQuadro(quadro, renomear) {
  return [
    { rotulo: 'Abrir', aoClicar: () => abrirQuadro(quadro.id) },
    { rotulo: 'Abrir em nova aba', aoClicar: () => abrirQuadro(quadro.id, { novaAba: true }) },
    { rotulo: 'Renomear', atalho: 'F2', aoClicar: renomear },
    { rotulo: quadro.fixada ? 'Desafixar' : 'Fixar no topo', aoClicar: () => fixarQuadro(quadro) },
    { separador: true },
    { rotulo: 'Mover para a lixeira', perigo: true, aoClicar: () => apagarQuadro(quadro) },
  ]
}

function itensDoArquivo(arq, renomear) {
  return [
    { rotulo: 'Abrir', aoClicar: () => abrirArquivo(arq.id) },
    {
      rotulo: 'Abrir em nova aba',
      desativado: !visualizavel(arq),
      aoClicar: () => abrirArquivo(arq.id, { novaAba: true }),
    },
    { rotulo: 'Abrir no programa padrão', aoClicar: () => abrirArquivoFora(arq.id) },
    { rotulo: 'Mostrar no Explorer', aoClicar: () => window.api.mostrarArquivoNaPasta(arq.id) },
    { rotulo: 'Salvar uma cópia…', aoClicar: () => window.api.salvarCopiaArquivo(arq.id) },
    { separador: true },
    { rotulo: 'Renomear', atalho: 'F2', aoClicar: renomear },
    { rotulo: 'Mover para a lixeira', perigo: true, aoClicar: () => apagarArquivo(arq) },
  ]
}

function abrirMenuNoClique(e, itens) {
  e.preventDefault()
  e.stopPropagation()
  MenuContexto.abrir({ x: e.clientX, y: e.clientY }, itens)
}

function lerArrasto(e) {
  try {
    return JSON.parse(e.dataTransfer.getData(MIME))
  } catch {
    return null
  }
}

function tornarArrastavel(el, item) {
  el.draggable = true
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData(MIME, JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'move'
  })
}

function tornarAlvoDeSoltar(el, aoSoltar, aoSoltarArquivos) {
  el.addEventListener('dragover', (e) => {
    const tipos = Array.from(e.dataTransfer.types)
    const deFora = tipos.includes('Files') && Boolean(aoSoltarArquivos)
    if (!tipos.includes(MIME) && !deFora) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = deFora ? 'copy' : 'move'
    el.classList.add('alvo-soltar')
  })
  el.addEventListener('dragleave', () => el.classList.remove('alvo-soltar'))
  el.addEventListener('drop', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    el.classList.remove('alvo-soltar')
    if (aoSoltarArquivos && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await aoSoltarArquivos(Array.from(e.dataTransfer.files))
      return
    }
    const item = lerArrasto(e)
    if (item) await aoSoltar(item)
  })
}

async function soltarEm(item, pastaId) {
  if (item.tipo === 'nota') await window.api.moverNota(item.id, pastaId)
  else if (item.tipo === 'pasta') await window.api.moverPasta(item.id, pastaId)
  else if (item.tipo === 'quadro') await window.api.moverQuadro(item.id, pastaId)
  else if (item.tipo === 'arquivo') await window.api.moverArquivo(item.id, pastaId)
  await atualizarTela()
}

function criarSeta(visivel, aberta) {
  const seta = document.createElement('span')
  seta.className = 'seta' + (aberta ? ' aberta' : '')
  if (visivel) seta.appendChild(Icones.criar('seta', 12))
  return seta
}

function criarBotaoAcao(icone, dica, aoClicar) {
  const botao = document.createElement('button')
  botao.title = dica
  botao.appendChild(Icones.criar(icone, 14))
  botao.addEventListener('click', (e) => {
    e.stopPropagation()
    aoClicar(botao)
  })
  return botao
}

function iniciarRenomear(linha, nomeAtual, aoSalvar) {
  const nomeEl = linha.querySelector('.nome')
  if (!nomeEl) return
  linha.draggable = false

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'input-renomear'
  input.maxLength = 120
  input.value = nomeAtual
  nomeEl.replaceWith(input)
  input.focus()
  input.select()

  let encerrado = false
  const encerrar = async (confirmar) => {
    if (encerrado) return
    encerrado = true
    const novo = input.value.trim()
    if (confirmar && novo && novo !== nomeAtual) await aoSalvar(novo)
    await atualizarTela()
  }

  input.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') encerrar(true)
    else if (e.key === 'Escape') encerrar(false)
  })
  input.addEventListener('blur', () => encerrar(true))
  input.addEventListener('click', (e) => e.stopPropagation())
}

function ligarAberturaNaArvore(linha, abrir) {
  linha.addEventListener('click', (e) => abrir(e.ctrlKey || e.metaKey))
  linha.addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault()
  })
  linha.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return
    e.preventDefault()
    abrir(true)
  })
}

function criarLinhaPasta(pasta, nivel, temFilhos) {
  const linha = document.createElement('div')
  linha.className = 'arvore-item'
  linha.style.paddingLeft = `${8 + nivel * 14}px`

  const alternar = async () => {
    await window.api.alternarPasta(pasta.id)
    await atualizarTela()
  }

  const seta = criarSeta(temFilhos, Boolean(pasta.aberta))
  if (temFilhos) {
    seta.addEventListener('click', (e) => {
      e.stopPropagation()
      alternar()
    })
  }

  const nome = criarSpan('nome', pasta.nome)
  nome.title = pasta.nome

  const renomear = () => iniciarRenomear(linha, pasta.nome, (novo) => window.api.renomearPasta(pasta.id, novo))

  const acoes = document.createElement('span')
  acoes.className = 'acoes'
  acoes.append(
    criarBotaoAcao('mais', 'Novo dentro desta pasta', (botao) =>
      MenuContexto.abrirEm(botao, itensDeCriacao(pasta.id))
    )
  )

  linha.append(seta, Icones.criar('pasta'), nome, acoes)
  linha.addEventListener('click', alternar)
  linha.addEventListener('contextmenu', (e) => abrirMenuNoClique(e, itensDaPasta(pasta, renomear)))
  tornarArrastavel(linha, { tipo: 'pasta', id: pasta.id })
  tornarAlvoDeSoltar(
    linha,
    (item) => soltarEm(item, pasta.id),
    (arquivos) => adicionarArquivosSoltos(arquivos, pasta.id)
  )

  if (pastaParaRenomear === pasta.id) {
    pastaParaRenomear = null
    setTimeout(renomear, 0)
  }
  return linha
}

function criarFolhaQuadro(quadro, nivel) {
  const ativa = vistaAtual === 'quadro' && quadroAtual === quadro.id
  const linha = document.createElement('div')
  linha.className = 'arvore-item folha' + (ativa ? ' selecionado' : '')
  linha.style.paddingLeft = `${8 + nivel * 14}px`

  const nome = criarSpan('nome', quadro.nome)
  nome.title = quadro.nome

  const renomear = () =>
    iniciarRenomear(linha, quadro.nome, (novo) => window.api.renomearQuadro(quadro.id, novo))
  renomeadores.set(`quadro:${quadro.id}`, renomear)

  linha.append(criarSeta(false, false), Icones.criar('quadro'), nome)
  ligarAberturaNaArvore(linha, (novaAba) => abrirQuadro(quadro.id, { novaAba }))
  linha.addEventListener('contextmenu', (e) => abrirMenuNoClique(e, itensDoQuadro(quadro, renomear)))
  tornarArrastavel(linha, { tipo: 'quadro', id: quadro.id })

  if (quadroParaRenomear === quadro.id) {
    quadroParaRenomear = null
    setTimeout(renomear, 0)
  }
  return linha
}

function criarFolhaNota(nota, titulo, nivel) {
  const ativa = vistaAtual === 'editor' && notaAtual === nota.id
  const linha = document.createElement('div')
  linha.className = 'arvore-item folha' + (ativa ? ' selecionado' : '')
  linha.style.paddingLeft = `${8 + nivel * 14}px`

  const nome = criarSpan('nome', titulo)
  nome.title = titulo

  linha.append(criarSeta(false, false), Icones.criar(nota.tipo === 'lista' ? 'lista' : 'nota'), nome)
  ligarAberturaNaArvore(linha, (novaAba) => abrirNota(nota.id, { novaAba }))
  linha.addEventListener('contextmenu', (e) =>
    abrirMenuNoClique(e, itensDaNota(nota, vistaAtual === 'editor' && notaAtual === nota.id))
  )
  tornarArrastavel(linha, { tipo: 'nota', id: nota.id })
  return linha
}

function criarFolhaArquivo(arq, nivel) {
  const ativa = vistaAtual === 'arquivo' && arquivoAtual === arq.id
  const linha = document.createElement('div')
  linha.className = 'arvore-item folha' + (ativa ? ' selecionado' : '')
  linha.style.paddingLeft = `${8 + nivel * 14}px`

  const nome = criarSpan('nome', arq.nome)
  nome.title = arq.nome

  const renomear = () =>
    iniciarRenomear(linha, arq.nome, (novo) => window.api.renomearArquivo(arq.id, novo))
  renomeadores.set(`arquivo:${arq.id}`, renomear)

  linha.append(criarSeta(false, false), Icones.criar(iconeDoArquivo(arq)), nome)
  ligarAberturaNaArvore(linha, (novaAba) => abrirArquivo(arq.id, { novaAba }))
  linha.addEventListener('contextmenu', (e) => abrirMenuNoClique(e, itensDoArquivo(arq, renomear)))
  tornarArrastavel(linha, { tipo: 'arquivo', id: arq.id })
  return linha
}

function renderizarArvore() {
  const { pastas, notas, quadros, arquivos } = dados
  renomeadores.clear()

  const notasDa = new Map()
  const quadrosDa = new Map()
  const arquivosDa = new Map()
  const notasOrdenadas = notas
    .map((nota) => ({ nota, titulo: Links.titulo(nota.texto) || '(sem título)' }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
  for (const item of notasOrdenadas) {
    if (!notasDa.has(item.nota.pasta_id)) notasDa.set(item.nota.pasta_id, [])
    notasDa.get(item.nota.pasta_id).push(item)
  }
  for (const q of quadros) {
    if (!quadrosDa.has(q.pasta_id)) quadrosDa.set(q.pasta_id, [])
    quadrosDa.get(q.pasta_id).push(q)
  }
  for (const a of arquivos) {
    if (!arquivosDa.has(a.pasta_id)) arquivosDa.set(a.pasta_id, [])
    arquivosDa.get(a.pasta_id).push(a)
  }

  const ids = new Set(pastas.map((p) => p.id))
  const filhos = new Map()
  for (const p of pastas) {
    const pai = p.pai_id !== null && ids.has(p.pai_id) ? p.pai_id : null
    if (!filhos.has(pai)) filhos.set(pai, [])
    filhos.get(pai).push(p)
  }

  const temFolhas = (pastaId) =>
    (notasDa.get(pastaId) || []).length +
      (quadrosDa.get(pastaId) || []).length +
      (arquivosDa.get(pastaId) || []).length >
    0

  const desenharFolhas = (pastaId, nivel) => {
    for (const q of quadrosDa.get(pastaId) || []) arvore.appendChild(criarFolhaQuadro(q, nivel))
    for (const { nota, titulo } of notasDa.get(pastaId) || []) {
      arvore.appendChild(criarFolhaNota(nota, titulo, nivel))
    }
    for (const a of arquivosDa.get(pastaId) || []) arvore.appendChild(criarFolhaArquivo(a, nivel))
  }

  const desenharPastas = (paiId, nivel) => {
    if (nivel > 30) return
    for (const pasta of filhos.get(paiId) || []) {
      const temFilhos = (filhos.get(pasta.id) || []).length > 0 || temFolhas(pasta.id)
      arvore.appendChild(criarLinhaPasta(pasta, nivel, temFilhos))
      if (pasta.aberta) {
        desenharPastas(pasta.id, nivel + 1)
        desenharFolhas(pasta.id, nivel + 1)
      }
    }
  }

  arvore.replaceChildren()
  const notasFixadas = notasOrdenadas.filter((x) => x.nota.fixada)
  const quadrosFixados = quadros.filter((q) => q.fixada)
  if (notasFixadas.length + quadrosFixados.length > 0) {
    const rotulo = document.createElement('div')
    rotulo.className = 'arvore-rotulo'
    rotulo.append(Icones.criar('fixar', 12), criarSpan('', 'Fixadas'))
    arvore.appendChild(rotulo)
    for (const q of quadrosFixados) arvore.appendChild(criarFolhaQuadro(q, 0))
    for (const { nota, titulo } of notasFixadas) arvore.appendChild(criarFolhaNota(nota, titulo, 0))
    const sep = document.createElement('div')
    sep.className = 'arvore-separador'
    arvore.appendChild(sep)
  }
  desenharPastas(null, 0)
  desenharFolhas(null, 0)
  if (modoLateral === 'tags') renderizarTags()
}

let itensPaleta = []
let indicePaleta = 0
let recentes = ler('recentes', [])

function registrarRecente(tipo, alvo) {
  recentes = recentes.filter((r) => !(r.tipo === tipo && r.alvo === alvo))
  recentes.unshift({ tipo, alvo })
  recentes = recentes.slice(0, 12)
  guardar('recentes', recentes)
}

function ordemRecente(tipo, id) {
  const i = recentes.findIndex((r) => r.tipo === tipo && r.alvo === id)
  return i === -1 ? 999 : i
}

function destacarTitulo(titulo, q) {
  const span = document.createElement('span')
  if (!q) {
    span.textContent = titulo
    return span
  }
  // mapa de posições: título normalizado → título original
  const mapa = []
  let norm = ''
  for (let i = 0; i < titulo.length; i++) {
    const n = Links.normalizar(titulo[i])
    for (const c of n) {
      mapa.push(i)
      norm += c
    }
  }
  const pos = norm.indexOf(q)
  if (pos === -1 || pos + q.length > mapa.length) {
    span.textContent = titulo
    return span
  }
  const ini = mapa[pos]
  const fim = mapa[pos + q.length - 1] + 1
  span.append(titulo.slice(0, ini))
  const mark = document.createElement('mark')
  mark.textContent = titulo.slice(ini, fim)
  span.append(mark, titulo.slice(fim))
  return span
}

function abrirPaleta(consulta = '') {
  paleta.hidden = false
  paletaBusca.value = consulta
  renderizarPaleta()
  paletaBusca.focus()
}

function fecharPaleta() {
  paleta.hidden = true
}

function abrirItemDaPaleta(item, novaAba = false) {
  fecharPaleta()
  registrarRecente(item.tipo, item.id)
  if (item.tipo === 'nota') abrirNota(item.id, { novaAba })
  else if (item.tipo === 'quadro') abrirQuadro(item.id, { novaAba })
  else abrirArquivo(item.id, { novaAba })
}

function renderizarPaleta() {
  const q = Links.normalizar(paletaBusca.value)
  const caminho = (pastaId) => (pastaId === null ? 'Raiz' : rotuloDaPasta(dados.pastas, pastaId))
  const itens = []

  for (const nota of dados.notas) {
    const titulo = Links.titulo(nota.texto) || '(sem título)'
    const nt = Links.normalizar(titulo)
    let peso
    if (!q) peso = 2
    else if (nt.startsWith(q)) peso = 0
    else if (nt.includes(q)) peso = 1
    else if (Links.normalizar(nota.texto).includes(q)) peso = 3
    else continue
    itens.push({ tipo: 'nota', id: nota.id, titulo, detalhe: caminho(nota.pasta_id), peso })
  }

  for (const quadro of dados.quadros) {
    const nq = Links.normalizar(quadro.nome)
    if (q && !nq.includes(q)) continue
    itens.push({
      tipo: 'quadro',
      id: quadro.id,
      titulo: quadro.nome,
      detalhe: 'Quadro · ' + caminho(quadro.pasta_id),
      peso: q ? (nq.startsWith(q) ? 0 : 1) : 2,
    })
  }

  for (const arq of dados.arquivos) {
    const na = Links.normalizar(arq.nome)
    if (q && !na.includes(q)) continue
    itens.push({
      tipo: 'arquivo',
      id: arq.id,
      titulo: arq.nome,
      detalhe: 'Arquivo · ' + caminho(arq.pasta_id),
      peso: q ? (na.startsWith(q) ? 0 : 1) : 2,
    })
  }

  itens.sort(
    (a, b) =>
      a.peso - b.peso || ordemRecente(a.tipo, a.id) - ordemRecente(b.tipo, b.id) || a.titulo.localeCompare(b.titulo, 'pt-BR')
  )
  itensPaleta = itens.slice(0, 40)
  indicePaleta = 0
  desenharPaleta()
}

function desenharPaleta() {
  paletaLista.replaceChildren()
  itensPaleta.forEach((item, i) => {
    const li = document.createElement('li')
    if (i === indicePaleta) li.className = 'ativo'
    li.appendChild(destacarTitulo(item.titulo, Links.normalizar(paletaBusca.value)))
    const detalhe = document.createElement('small')
    detalhe.textContent = item.detalhe
    li.appendChild(detalhe)
    li.addEventListener('mousedown', (e) => {
      e.preventDefault()
      abrirItemDaPaleta(item, e.ctrlKey || e.metaKey)
    })
    paletaLista.appendChild(li)
  })
  if (itensPaleta.length === 0) {
    const vazio = document.createElement('li')
    vazio.textContent = 'Nada encontrado.'
    paletaLista.appendChild(vazio)
  }
  paletaLista.querySelector('.ativo')?.scrollIntoView({ block: 'nearest' })
}

paletaBusca.addEventListener('input', renderizarPaleta)
paletaBusca.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (itensPaleta.length === 0) return
    const passo = e.key === 'ArrowDown' ? 1 : -1
    indicePaleta = (indicePaleta + passo + itensPaleta.length) % itensPaleta.length
    desenharPaleta()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (itensPaleta[indicePaleta]) abrirItemDaPaleta(itensPaleta[indicePaleta], e.ctrlKey || e.metaKey)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    fecharPaleta()
  }
})
paleta.addEventListener('pointerdown', (e) => {
  if (e.target === paleta) fecharPaleta()
})

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey
  const tecla = e.key.toLowerCase()

  if (e.key === 'F2') {
    e.preventDefault()
    renomearAtual()
    return
  }
  if (e.key === 'F1') {
    e.preventDefault()
    alternarAtalhos()
    return
  }
  if (e.altKey && !ctrl) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      voltarAba()
    }
    return
  }
  if (!ctrl || e.altKey) return

  if (e.key === 'Tab') {
    e.preventDefault()
    irParaAba(e.shiftKey ? -1 : 1)
    return
  }
  if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
    e.preventDefault()
    irParaAbaNumero(Number(e.key))
    return
  }
  if (e.shiftKey) {
    if (tecla === 't') {
      e.preventDefault()
      reabrirFechada()
    } else if (tecla === 'a') {
      e.preventDefault()
      alternarTarefas()
    } else if (tecla === 'l') {
      e.preventDefault()
      criarListaNova(pastaDoItemAtual())
    } else if (tecla === 'n') {
      e.preventDefault()
      criarDeModelo(pastaDoItemAtual())
    }
    return
  }

  if (vistaAtual === 'editor' && (tecla === 'f' || tecla === 'h')) {
    e.preventDefault()
    Editor.abrirBusca(tecla === 'h')
    return
  }

  switch (tecla) {
    case 'g':
      e.preventDefault()
      alternarGrafo()
      break
    case 'j':
      e.preventDefault()
      alternarCalendario()
      break
    case 'e':
      if (vistaAtual !== 'editor') break
      e.preventDefault()
      Editor.alternarLeitura()
      break
    case 'k':
    case 'o':
      e.preventDefault()
      abrirPaleta()
      break
    case 'n':
    case 't':
      e.preventDefault()
      criarNotaNova(pastaDoItemAtual())
      break
    case 'w':
      e.preventDefault()
      if (abaAtiva !== null) fecharAba(abaAtiva)
      break
    case '\\':
      e.preventDefault()
      alternarLateral()
      break
    case ',':
      e.preventDefault()
      Ajustes.abrirAjustes()
      break
    case '/':
      e.preventDefault()
      alternarAtalhos()
      break
    default:
      break
  }
})

document.addEventListener('dragover', (e) => {
  if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault()
})
document.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.length) e.preventDefault()
})

btnNovo.addEventListener('click', () => MenuContexto.abrirEm(btnNovo, itensDeCriacao(null)))
btnBusca.addEventListener('click', () => abrirPaleta())
btnGrafo.addEventListener('click', alternarGrafo)
btnCalendario.addEventListener('click', alternarCalendario)
btnTarefas.addEventListener('click', alternarTarefas)
btnLixeira.addEventListener('click', () => alternarVistaUnica('lixeira'))
btnEstatisticas.addEventListener('click', () => alternarVistaUnica('estatisticas'))
btnLateral.addEventListener('click', alternarLateral)
btnNovaGuia.addEventListener('click', () => criarNotaNova(pastaDoItemAtual()))
btnArquivos.addEventListener('click', () => definirModoLateral('arquivos'))
btnTags.addEventListener('click', () => definirModoLateral('tags'))
btnAjuda.addEventListener('click', alternarAtalhos)
document.getElementById('lado-fechar').addEventListener('click', fecharLado)
document.getElementById('btn-inicio').addEventListener('click', () => abrirNaAba('inicio', 'inicio'))
btnAjustes.addEventListener('click', () => Ajustes.abrirAjustes())
grafoTudo.addEventListener('click', () => {
  escopoGrafo = null
  desenharGrafo()
})

arvore.addEventListener('contextmenu', (e) => {
  if (e.target !== arvore) return
  abrirMenuNoClique(e, itensDeCriacao(null))
})
tornarAlvoDeSoltar(
  arvore,
  (item) => soltarEm(item, null),
  (arquivos) => adicionarArquivosSoltos(arquivos, null)
)

window.api.aoMudar(atualizarTela)
window.api.aoAbrirNota(async (id) => {
  await atualizarTela()
  if (dados.notas.some((n) => n.id === id)) await abrirNota(id, { novaAba: true })
})
Tarefas.iniciar({
  aoAbrirNota: (id, novaAba) => abrirNota(id, { novaAba }),
  aoAlterar: atualizarTela,
  aoAviso: avisoGlobal,
})

Editor.iniciar({
  aoAlterar: atualizarArvore,
  aoAbrirNota: (id, novaAba) => abrirNota(id, { novaAba }),
  aoAbrirPasta: (id, novaAba) => abrirPasta(id, { novaAba }),
  aoBuscar: (termo) => abrirPaleta(termo),
  aoVerNoCalendario: verNoCalendario,
  menuDaNota: () => {
    const nota = dados.notas.find((n) => n.id === Editor.idAtual())
    return nota ? itensDaNota(nota, true) : []
  },
})
Grafo.iniciar(abrirNotaEmNovaAba)
Quadro.iniciar(abrirNotaEmNovaAba)
Calendario.iniciar(abrirNotaEmNovaAba, null, atualizarTela, avisoGlobal)
Lixeira.iniciar({
  aoAlterar: atualizarTela,
  aoAviso: avisoGlobal,
  rotuloPasta: (id) => (dados.pastas.some((p) => p.id === id) ? rotuloDaPasta(dados.pastas, id) : ''),
})
Estatisticas.iniciar({ aoAbrirNota: (id, novaAba) => abrirNota(id, { novaAba }) })
Arquivo.iniciar({ aoAviso: avisoGlobal })
MenuContexto.ativarEmCampos()
Atalhos.iniciar()
Ajustes.iniciar()
Icones.aplicarNosBotoes()

lateralRecolhida = ler('lateralRecolhida', false)
larguraLateral = ler('larguraLateral', 260)
aplicarLateral()
definirModoLateral(ler('modoLateral', 'arquivos'))

atualizarTela().then(restaurarAbas)