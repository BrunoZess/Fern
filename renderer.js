const arvore = document.getElementById('arvore')
const btnNovo = document.getElementById('btn-novo')
const btnBusca = document.getElementById('btn-busca')
const btnGrafo = document.getElementById('btn-grafo')
const btnCalendario = document.getElementById('btn-calendario')
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
}
let vistaAtual = 'vazia'

let dados = { pastas: [], notas: [], quadros: [] }
let notaAtual = null
let quadroAtual = null
let escopoGrafo = null // id de uma pasta, ou null para mostrar todas as notas
let pastaParaRenomear = null
let quadroParaRenomear = null

const MIME = 'application/x-segundo-cerebro'

// ---------- Pastas: funções auxiliares ----------

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

// Conjunto com o id da pasta e o de todas as suas descendentes
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

// ---------- Dados e vistas ----------

async function buscarDados() {
  const [notas, pastas, quadros] = await Promise.all([
    window.api.listarNotas(),
    window.api.listarPastas(),
    window.api.listarQuadros(),
  ])
  dados = { notas, pastas, quadros }
  if (typeof escopoGrafo === 'number' && !pastas.some((p) => p.id === escopoGrafo)) escopoGrafo = null

  // Se a nota aberta foi apagada em outro lugar, volta para a tela cinza
  if (vistaAtual === 'editor' && !Editor.definirDados(notas, pastas)) {
    Editor.esquecer()
    notaAtual = null
    await mostrarVista('vazia')
  }
}

async function mostrarVista(nome) {
  if (!vistas[nome]) return
  if (vistaAtual === 'editor' && nome !== 'editor') await Editor.fechar()
  vistaAtual = nome
  if (nome !== 'editor') notaAtual = null

  for (const [chave, secao] of Object.entries(vistas)) secao.hidden = chave !== nome
  btnGrafo.classList.toggle('ativo', nome === 'grafo')
  btnCalendario.classList.toggle('ativo', nome === 'calendario')

  Grafo.definirVisivel(nome === 'grafo')
  Quadro.definirVisivel(nome === 'quadro')
  if (nome === 'grafo') {
    await buscarDados()
    desenharGrafo()
  }
  Calendario.definirVisivel(nome === 'calendario')
  if (nome === 'calendario') {
    await buscarDados()
    Calendario.atualizar(dados.notas)
  }
  renderizarArvore()
}

function desenharGrafo() {
  const ids = typeof escopoGrafo === 'number' ? subarvore(dados.pastas, escopoGrafo) : null
  grafoEscopo.textContent = ids ? rotuloDaPasta(dados.pastas, escopoGrafo) : 'Todas as notas'
  grafoTudo.hidden = ids === null
  Grafo.atualizar(ids ? dados.notas.filter((n) => ids.has(n.pasta_id)) : dados.notas)
}

async function verNoGrafo(pastaId) {
  escopoGrafo = pastaId
  await mostrarVista('grafo')
}

async function alternarGrafo() {
  await mostrarVista(vistaAtual === 'grafo' ? 'vazia' : 'grafo')
}

async function alternarCalendario() {
  await mostrarVista(vistaAtual === 'calendario' ? 'vazia' : 'calendario')
}

async function verNoCalendario(data) {
  await mostrarVista('calendario')
  Calendario.irPara(data)
}

// Atualiza só a árvore (usado quando o editor salva)
async function atualizarArvore() {
  await buscarDados()
  renderizarArvore()
}

// Atualiza a árvore e a vista aberta (grafo ou quadro)
async function atualizarTela() {
  await buscarDados()
  renderizarArvore()
  if (vistaAtual === 'grafo') desenharGrafo()
  if (vistaAtual === 'calendario') Calendario.atualizar(dados.notas)
  if (vistaAtual === 'quadro') await Quadro.recarregar()
}

async function abrirNota(id, opcoes = {}) {
  if (vistaAtual === 'editor' && Editor.idAtual() === id) {
    Editor.aoMostrar(opcoes)
    return
  }
  const ok = await Editor.abrir(id)
  if (!ok) {
    await atualizarTela()
    return
  }
  if (vistaAtual !== 'editor') await mostrarVista('editor')
  notaAtual = id
  renderizarArvore()
  Editor.aoMostrar(opcoes)
}

async function abrirQuadro(id) {
  quadroAtual = id
  await mostrarVista('quadro')
  await Quadro.abrir(id)
}

// ---------- Criar, duplicar e apagar ----------

async function garantirPastaAberta(pastaId) {
  const pasta = dados.pastas.find((p) => p.id === pastaId)
  if (pasta && !pasta.aberta) await window.api.alternarPasta(pastaId)
}

async function criarNotaNova(pastaId) {
  if (pastaId !== null) await garantirPastaAberta(pastaId)
  const nota = await window.api.criarNota('', 'ideia', null, '', pastaId)
  await atualizarTela()
  await abrirNota(nota.id, { focarTitulo: true })
}

async function criarPastaNova(paiId) {
  const pasta = await window.api.criarPasta('Nova pasta', paiId)
  pastaParaRenomear = pasta.id
  await atualizarTela()
}

async function criarQuadroNovo(pastaId) {
  const quadro = await window.api.criarQuadro('Novo quadro', pastaId)
  await abrirQuadro(quadro.id)
  quadroParaRenomear = quadro.id
  await atualizarTela()
}

async function duplicarNota(nota) {
  const linhas = nota.texto.split('\n')
  linhas[0] = (linhas[0] || 'Sem título') + ' (cópia)'
  const nova = await window.api.criarNota(
    linhas.join('\n'),
    nota.tipo,
    nota.prazo,
    nota.projeto || '',
    nota.pasta_id
  )
  await atualizarTela()
  await abrirNota(nova.id)
}

async function apagarNota(nota) {
  const titulo = Links.titulo(nota.texto) || 'Sem título'
  if (!confirm(`Apagar a nota "${titulo}"? Isso não pode ser desfeito.`)) return
  if (notaAtual === nota.id) {
    Editor.esquecer()
    await mostrarVista('vazia')
  }
  await window.api.removerNota(nota.id)
  await atualizarTela()
}

async function apagarPasta(pasta) {
  const temConteudo =
    dados.notas.some((n) => n.pasta_id === pasta.id) ||
    dados.pastas.some((p) => p.pai_id === pasta.id) ||
    dados.quadros.some((q) => q.pasta_id === pasta.id)
  if (temConteudo) {
    const ok = confirm(
      `A pasta "${pasta.nome}" tem conteúdo. Ao apagar, as notas, quadros e subpastas sobem para a pasta de cima. Continuar?`
    )
    if (!ok) return
  }
  await window.api.removerPasta(pasta.id)
  await atualizarTela()
}

async function apagarQuadro(quadro) {
  const ok = confirm(
    `Apagar o quadro "${quadro.nome}"? Os cartões dele serão perdidos (as notas continuam existindo).`
  )
  if (!ok) return
  await window.api.removerQuadro(quadro.id)
  if (quadroAtual === quadro.id) {
    quadroAtual = null
    await mostrarVista('vazia')
  }
  await atualizarTela()
}

// ---------- Menus ----------

// paiId = null significa a raiz
const itensDeCriacao = (paiId) => [
  { rotulo: 'Nova nota', atalho: 'Ctrl+N', aoClicar: () => criarNotaNova(paiId) },
  { rotulo: 'Novo quadro', aoClicar: () => criarQuadroNovo(paiId) },
  { rotulo: 'Nova pasta', aoClicar: () => criarPastaNova(paiId) },
]

function itensDaPasta(pasta, renomear) {
  return [
    { rotulo: 'Nova nota', aoClicar: () => criarNotaNova(pasta.id) },
    { rotulo: 'Novo quadro', aoClicar: () => criarQuadroNovo(pasta.id) },
    { rotulo: 'Nova subpasta', aoClicar: () => criarPastaNova(pasta.id) },
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
  if (!aberta) itens.push({ rotulo: 'Abrir', aoClicar: () => abrirNota(nota.id) })
  itens.push(
    { rotulo: 'Renomear', aoClicar: () => abrirNota(nota.id, { focarTitulo: true }) },
    {
      rotulo: 'Copiar link',
      atalho: '[[ ]]',
      desativado: !titulo,
      aoClicar: () => window.api.copiarTexto(`[[${titulo}]]`),
    },
    { rotulo: 'Duplicar', aoClicar: () => duplicarNota(nota) },
    { separador: true },
    { rotulo: 'Apagar nota', perigo: true, aoClicar: () => apagarNota(nota) }
  )
  return itens
}

function itensDoQuadro(quadro, renomear) {
  return [
    { rotulo: 'Abrir', aoClicar: () => abrirQuadro(quadro.id) },
    { rotulo: 'Renomear', aoClicar: renomear },
    { separador: true },
    { rotulo: 'Apagar quadro', perigo: true, aoClicar: () => apagarQuadro(quadro) },
  ]
}

function abrirMenuNoClique(e, itens) {
  e.preventDefault()
  e.stopPropagation()
  MenuContexto.abrir({ x: e.clientX, y: e.clientY }, itens)
}

// ---------- Arrastar e soltar ----------

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

function tornarAlvoDeSoltar(el, aoSoltar) {
  el.addEventListener('dragover', (e) => {
    if (!Array.from(e.dataTransfer.types).includes(MIME)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    el.classList.add('alvo-soltar')
  })
  el.addEventListener('dragleave', () => el.classList.remove('alvo-soltar'))
  el.addEventListener('drop', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    el.classList.remove('alvo-soltar')
    const item = lerArrasto(e)
    if (item) await aoSoltar(item)
  })
}

// pastaId = null significa a raiz
async function soltarEm(item, pastaId) {
  if (item.tipo === 'nota') await window.api.moverNota(item.id, pastaId)
  else if (item.tipo === 'pasta') await window.api.moverPasta(item.id, pastaId)
  else if (item.tipo === 'quadro') await window.api.moverQuadro(item.id, pastaId)
  await atualizarTela()
}

// ---------- Árvore ----------

function criarSpan(classe, conteudo) {
  const span = document.createElement('span')
  if (classe) span.className = classe
  span.textContent = conteudo
  return span
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

// Troca o nome por um campo de texto, direto na árvore
function iniciarRenomear(linha, nomeAtual, aoSalvar) {
  const nomeEl = linha.querySelector('.nome')
  if (!nomeEl) return
  linha.draggable = false

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'input-renomear'
  input.maxLength = 60
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

  const renomear = () =>
    iniciarRenomear(linha, pasta.nome, (novo) => window.api.renomearPasta(pasta.id, novo))

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
  tornarAlvoDeSoltar(linha, (item) => soltarEm(item, pasta.id))

  // Pasta recém-criada: já abre o campo para digitar o nome
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

  linha.append(criarSeta(false, false), Icones.criar('quadro'), nome)
  linha.addEventListener('click', () => abrirQuadro(quadro.id))
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

  const icone = nota.tipo === 'tarefa' ? (nota.concluida ? 'feita' : 'tarefa') : 'nota'
  const nome = criarSpan(nota.concluida ? 'nome feita' : 'nome', titulo)
  nome.title = titulo

  linha.append(criarSeta(false, false), Icones.criar(icone), nome)
  linha.addEventListener('click', () => abrirNota(nota.id))
  linha.addEventListener('contextmenu', (e) =>
    abrirMenuNoClique(e, itensDaNota(nota, vistaAtual === 'editor' && notaAtual === nota.id))
  )
  tornarArrastavel(linha, { tipo: 'nota', id: nota.id })
  return linha
}

function renderizarArvore() {
  const { pastas, notas, quadros } = dados

  // Agrupa notas e quadros por pasta (a chave null é a raiz)
  const notasDa = new Map()
  const quadrosDa = new Map()
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

  // Pasta sem pai válido vai para a raiz
  const ids = new Set(pastas.map((p) => p.id))
  const filhos = new Map()
  for (const p of pastas) {
    const pai = p.pai_id !== null && ids.has(p.pai_id) ? p.pai_id : null
    if (!filhos.has(pai)) filhos.set(pai, [])
    filhos.get(pai).push(p)
  }

  const temFolhas = (pastaId) =>
    (notasDa.get(pastaId) || []).length + (quadrosDa.get(pastaId) || []).length > 0

  const desenharFolhas = (pastaId, nivel) => {
    for (const q of quadrosDa.get(pastaId) || []) arvore.appendChild(criarFolhaQuadro(q, nivel))
    for (const { nota, titulo } of notasDa.get(pastaId) || []) {
      arvore.appendChild(criarFolhaNota(nota, titulo, nivel))
    }
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
  desenharPastas(null, 0)
  desenharFolhas(null, 0)
}

// ---------- Busca rápida (Ctrl+K) ----------

let itensPaleta = []
let indicePaleta = 0

function abrirPaleta(consulta = '') {
  paleta.hidden = false
  paletaBusca.value = consulta
  renderizarPaleta()
  paletaBusca.focus()
}

function fecharPaleta() {
  paleta.hidden = true
}

function abrirItemDaPaleta(item) {
  fecharPaleta()
  if (item.tipo === 'nota') abrirNota(item.id)
  else abrirQuadro(item.id)
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

  itens.sort((a, b) => a.peso - b.peso || a.titulo.localeCompare(b.titulo, 'pt-BR'))
  itensPaleta = itens.slice(0, 40)
  indicePaleta = 0
  desenharPaleta()
}

function desenharPaleta() {
  paletaLista.replaceChildren()
  itensPaleta.forEach((item, i) => {
    const li = document.createElement('li')
    if (i === indicePaleta) li.className = 'ativo'
    li.appendChild(criarSpan('', item.titulo))
    const detalhe = document.createElement('small')
    detalhe.textContent = item.detalhe
    li.appendChild(detalhe)
    li.addEventListener('mousedown', (e) => {
      e.preventDefault()
      abrirItemDaPaleta(item)
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
    if (itensPaleta[indicePaleta]) abrirItemDaPaleta(itensPaleta[indicePaleta])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    fecharPaleta()
  }
})
paleta.addEventListener('pointerdown', (e) => {
  if (e.target === paleta) fecharPaleta()
})

// ---------- Atalhos e inicialização ----------

document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || e.altKey || e.shiftKey) return
  const tecla = e.key.toLowerCase()
  if (tecla === 'g') {
    e.preventDefault()
    alternarGrafo()
  } else if (tecla === 'k') {
    e.preventDefault()
    abrirPaleta()
  } else if (tecla === 'n') {
    e.preventDefault()
    const atual = dados.notas.find((n) => n.id === notaAtual)
    criarNotaNova(atual ? atual.pasta_id : null)
  } else if (tecla === 'j') {
    e.preventDefault()
    alternarCalendario()
  }
})

btnNovo.addEventListener('click', () => MenuContexto.abrirEm(btnNovo, itensDeCriacao(null)))
btnBusca.addEventListener('click', () => abrirPaleta())
btnGrafo.addEventListener('click', alternarGrafo)
btnCalendario.addEventListener('click', alternarCalendario)
grafoTudo.addEventListener('click', () => {
  escopoGrafo = null
  desenharGrafo()
})

// Botão direito no espaço vazio da barra lateral: criar na raiz
arvore.addEventListener('contextmenu', (e) => {
  if (e.target !== arvore) return
  abrirMenuNoClique(e, itensDeCriacao(null))
})
// Soltar no espaço vazio da barra lateral move o item para a raiz
tornarAlvoDeSoltar(arvore, (item) => soltarEm(item, null))

// Quando a janelinha de captura cria uma nota, a tela se atualiza sozinha
window.api.aoMudar(atualizarTela)

Editor.iniciar({
  aoAlterar: atualizarArvore,
  aoAbrirNota: (id) => abrirNota(id),
  aoVerNoCalendario: verNoCalendario,
  menuDaNota: () => {
    const nota = dados.notas.find((n) => n.id === Editor.idAtual())
    return nota ? itensDaNota(nota, true) : []
  },
})
Grafo.iniciar(abrirNota)
Quadro.iniciar(abrirNota)
Calendario.iniciar(abrirNota)
MenuContexto.ativarEmCampos()

Icones.aplicarNosBotoes()
atualizarTela()