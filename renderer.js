const texto = document.getElementById('texto')
const tipo = document.getElementById('tipo')
const projeto = document.getElementById('projeto')
const projetosLista = document.getElementById('projetos-lista')
const prazo = document.getElementById('prazo')
const lista = document.getElementById('lista')
const busca = document.getElementById('busca')
const filtro = document.getElementById('filtro')
const filtroProjeto = document.getElementById('filtro-projeto')
const vazio = document.getElementById('vazio')
const arvore = document.getElementById('arvore')
const migalhas = document.getElementById('migalhas')
const subpastasEl = document.getElementById('subpastas')
const destinoCaptura = document.getElementById('destino-captura')
const incluirSub = document.getElementById('incluir-sub')
const rotuloSub = document.getElementById('rotulo-sub')
const grafoEscopo = document.getElementById('grafo-escopo')
const abas = document.querySelectorAll('#abas .aba')

const vistas = {
  lista: document.getElementById('vista-lista'),
  grafo: document.getElementById('vista-grafo'),
  quadro: document.getElementById('vista-quadro'),
}
let vistaAtual = 'lista'

// O que está selecionado na árvore: 'todas', 'raiz' (sem pasta) ou o id de uma pasta
let selecao = 'todas'
let dados = { pastas: [], notas: [], quadros: [] }
let quadroAtual = null
let pastaParaRenomear = null
let quadroParaRenomear = null
let semPastaAberta = true
const MIME = 'application/x-segundo-cerebro'
const ICONE_TIPO = { ideia: '💡', referencia: '🔖' }

// Pedaços especiais do texto: [[links]] e #tags (letras com acento, números, _ ou -)
const REGEX_TOKEN = /(\[\[[^\[\]\n]+\]\]|#[\p{L}\p{N}_-]+)/u
const SO_LINK = /^\[\[([^\[\]\n]+)\]\]$/
const SO_TAG = /^#[\p{L}\p{N}_-]+$/u

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

function contarPorPasta(notas) {
  const contagem = new Map()
  for (const n of notas) contagem.set(n.pasta_id, (contagem.get(n.pasta_id) || 0) + 1)
  return contagem
}

// Se a pasta selecionada foi apagada, volta para "Todas as notas"
function validarSelecao() {
  if (typeof selecao === 'number' && !dados.pastas.some((p) => p.id === selecao)) {
    selecao = 'todas'
  }
}

// Função que diz se uma nota está dentro do que foi selecionado na árvore
function criarEscopo() {
  if (selecao === 'todas') return () => true
  if (selecao === 'raiz') return (n) => n.pasta_id === null
  if (incluirSub.checked) {
    const ids = subarvore(dados.pastas, selecao)
    return (n) => ids.has(n.pasta_id)
  }
  return (n) => n.pasta_id === selecao
}

function nomeDoEscopo() {
  if (selecao === 'todas') return 'Todas as notas'
  if (selecao === 'raiz') return 'Sem pasta'
  return rotuloDaPasta(dados.pastas, selecao)
}

function pastaDeDestino() {
  return typeof selecao === 'number' ? selecao : null
}

async function buscarDados() {
  const [notas, pastas, quadros] = await Promise.all([
    window.api.listarNotas(),
    window.api.listarPastas(),
    window.api.listarQuadros(),
  ])
  dados = { notas, pastas, quadros }
  validarSelecao()
}

// ---------- Navegação entre as vistas ----------

async function mostrarVista(nome) {
  if (!vistas[nome]) return
  vistaAtual = nome

  for (const [chave, secao] of Object.entries(vistas)) secao.hidden = chave !== nome
  for (const aba of abas) aba.classList.toggle('ativo', aba.dataset.vista === nome)

  Grafo.definirVisivel(nome === 'grafo')
  Quadro.definirVisivel(nome === 'quadro')
  if (nome === 'grafo') await atualizarGrafo()
  renderizarArvore()
}

// O grafo mostra só as notas da pasta selecionada
async function atualizarGrafo() {
  await buscarDados()
  grafoEscopo.textContent = nomeDoEscopo()
  Grafo.atualizar(dados.notas.filter(criarEscopo()))
}

// Redesenha a lista/árvore e, se o grafo ou um quadro estiver aberto, eles também
async function atualizarTela() {
  await renderizar()
  if (vistaAtual === 'grafo') await atualizarGrafo()
  if (vistaAtual === 'quadro') await Quadro.recarregar()
}

async function selecionar(valor) {
  selecao = valor
  if (vistaAtual === 'quadro') await mostrarVista('lista')
  await atualizarTela()
}

async function abrirQuadro(id) {
  quadroAtual = id
  await mostrarVista('quadro')
  await Quadro.abrir(id)
}

for (const aba of abas) {
  aba.addEventListener('click', () => mostrarVista(aba.dataset.vista))
}

document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || e.altKey || e.shiftKey) return
  if (e.key === '1') {
    e.preventDefault()
    mostrarVista('lista')
  } else if (e.key === '2') {
    e.preventDefault()
    mostrarVista('grafo')
  }
})

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
    e.dataTransfer.dropEffect = 'move'
    el.classList.add('alvo-soltar')
  })
  el.addEventListener('dragleave', () => el.classList.remove('alvo-soltar'))
  el.addEventListener('drop', async (e) => {
    e.preventDefault()
    el.classList.remove('alvo-soltar')
    const item = lerArrasto(e)
    if (item) await aoSoltar(item)
  })
}

// pastaId = null significa "Sem pasta"
async function soltarEm(item, pastaId) {
  if (item.tipo === 'nota') await window.api.moverNota(item.id, pastaId)
  else if (item.tipo === 'pasta') await window.api.moverPasta(item.id, pastaId)
  else if (item.tipo === 'quadro') await window.api.moverQuadro(item.id, pastaId)
  await atualizarTela()
}

// ---------- Árvore (pastas, quadros e notas) ----------

function criarSpan(classe, conteudo) {
  const span = document.createElement('span')
  if (classe) span.className = classe
  span.textContent = conteudo
  return span
}

function criarBotaoAcao(emoji, dica, aoClicar) {
  const botao = document.createElement('button')
  botao.textContent = emoji
  botao.title = dica
  botao.addEventListener('click', (e) => {
    e.stopPropagation()
    aoClicar()
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

async function criarPastaNova(paiId) {
  const pasta = await window.api.criarPasta('Nova pasta', paiId)
  selecao = pasta.id
  pastaParaRenomear = pasta.id
  if (vistaAtual === 'quadro') await mostrarVista('lista')
  await atualizarTela()
}

async function criarQuadroNovo(pastaId) {
  const quadro = await window.api.criarQuadro('Novo quadro', pastaId)
  await abrirQuadro(quadro.id)
  quadroParaRenomear = quadro.id
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
  if (selecao === pasta.id) selecao = pasta.pai_id === null ? 'todas' : pasta.pai_id
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
    await mostrarVista('lista')
  }
  await atualizarTela()
}

function criarLinhaFixa(chave, icone, rotulo, total, temFolhas) {
  const ativa = selecao === chave && vistaAtual !== 'quadro'
  const linha = document.createElement('div')
  linha.className = 'arvore-item' + (ativa ? ' selecionado' : '')

  const seta = criarSpan('seta', temFolhas ? (semPastaAberta ? '▾' : '▸') : '\u00a0')
  if (chave === 'raiz' && temFolhas) {
    seta.addEventListener('click', (e) => {
      e.stopPropagation()
      semPastaAberta = !semPastaAberta
      renderizarArvore()
    })
  }

  linha.append(seta, criarSpan('', icone), criarSpan('nome', rotulo), criarSpan('contagem', total))
  linha.addEventListener('click', () => selecionar(chave))
  if (chave === 'raiz') tornarAlvoDeSoltar(linha, (item) => soltarEm(item, null))
  return linha
}

function criarLinhaPasta(pasta, nivel, temFilhos, total) {
  const ativa = selecao === pasta.id && vistaAtual !== 'quadro'
  const linha = document.createElement('div')
  linha.className = 'arvore-item' + (ativa ? ' selecionado' : '')
  linha.style.paddingLeft = `${8 + nivel * 16}px`

  const seta = criarSpan('seta', temFilhos ? (pasta.aberta ? '▾' : '▸') : '\u00a0')
  if (temFilhos) {
    seta.addEventListener('click', async (e) => {
      e.stopPropagation()
      await window.api.alternarPasta(pasta.id)
      await atualizarTela()
    })
  }

  const nome = criarSpan('nome', pasta.nome)
  nome.title = pasta.nome

  const acoes = document.createElement('span')
  acoes.className = 'acoes'
  acoes.append(
    criarBotaoAcao('＋', 'Nova subpasta', () => criarPastaNova(pasta.id)),
    criarBotaoAcao('🧩', 'Novo quadro nesta pasta', () => criarQuadroNovo(pasta.id)),
    criarBotaoAcao('✏️', 'Renomear', () =>
      iniciarRenomear(linha, pasta.nome, (novo) => window.api.renomearPasta(pasta.id, novo))
    ),
    criarBotaoAcao('🗑', 'Apagar pasta', () => apagarPasta(pasta))
  )

  linha.append(seta, criarSpan('', '📁'), nome, criarSpan('contagem', total > 0 ? total : ''), acoes)
  linha.addEventListener('click', () => selecionar(pasta.id))
  tornarArrastavel(linha, { tipo: 'pasta', id: pasta.id })
  tornarAlvoDeSoltar(linha, (item) => soltarEm(item, pasta.id))

  // Pasta recém-criada: já abre o campo para digitar o nome
  if (pastaParaRenomear === pasta.id) {
    pastaParaRenomear = null
    setTimeout(
      () => iniciarRenomear(linha, pasta.nome, (novo) => window.api.renomearPasta(pasta.id, novo)),
      0
    )
  }
  return linha
}

function criarFolhaQuadro(quadro, nivel) {
  const ativa = vistaAtual === 'quadro' && quadroAtual === quadro.id
  const linha = document.createElement('div')
  linha.className = 'arvore-item folha' + (ativa ? ' selecionado' : '')
  linha.style.paddingLeft = `${8 + nivel * 16}px`

  const nome = criarSpan('nome', quadro.nome)
  nome.title = quadro.nome

  const acoes = document.createElement('span')
  acoes.className = 'acoes'
  acoes.append(
    criarBotaoAcao('✏️', 'Renomear quadro', () =>
      iniciarRenomear(linha, quadro.nome, (novo) => window.api.renomearQuadro(quadro.id, novo))
    ),
    criarBotaoAcao('🗑', 'Apagar quadro', () => apagarQuadro(quadro))
  )

  linha.append(criarSpan('seta', '\u00a0'), criarSpan('', '🧩'), nome, acoes)
  linha.addEventListener('click', () => abrirQuadro(quadro.id))
  tornarArrastavel(linha, { tipo: 'quadro', id: quadro.id })

  if (quadroParaRenomear === quadro.id) {
    quadroParaRenomear = null
    setTimeout(
      () => iniciarRenomear(linha, quadro.nome, (novo) => window.api.renomearQuadro(quadro.id, novo)),
      0
    )
  }
  return linha
}

function criarFolhaNota(nota, titulo, nivel) {
  const linha = document.createElement('div')
  linha.className = 'arvore-item folha'
  linha.style.paddingLeft = `${8 + nivel * 16}px`

  const icone = nota.tipo === 'tarefa' ? (nota.concluida ? '✅' : '☐') : ICONE_TIPO[nota.tipo] || '📝'
  const nome = criarSpan(nota.concluida ? 'nome feita' : 'nome', titulo)
  nome.title = titulo

  linha.append(criarSpan('seta', '\u00a0'), criarSpan('', icone), nome)
  linha.addEventListener('click', () => irParaNota(nota.id))
  tornarArrastavel(linha, { tipo: 'nota', id: nota.id })
  return linha
}

function renderizarArvore() {
  const { pastas, notas, quadros } = dados
  const contagem = contarPorPasta(notas)

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

  const desenharFolhas = (pastaId, nivel) => {
    for (const q of quadrosDa.get(pastaId) || []) arvore.appendChild(criarFolhaQuadro(q, nivel))
    for (const { nota, titulo } of notasDa.get(pastaId) || []) {
      arvore.appendChild(criarFolhaNota(nota, titulo, nivel))
    }
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

  arvore.replaceChildren()
  arvore.appendChild(criarLinhaFixa('todas', '📚', 'Todas as notas', notas.length, false))
  arvore.appendChild(criarLinhaFixa('raiz', '📥', 'Sem pasta', contagem.get(null) || 0, temFolhas(null)))
  if (semPastaAberta) desenharFolhas(null, 1)

  const desenharPastas = (paiId, nivel) => {
    if (nivel > 30) return
    for (const pasta of filhos.get(paiId) || []) {
      const temFilhos = (filhos.get(pasta.id) || []).length > 0 || temFolhas(pasta.id)
      arvore.appendChild(criarLinhaPasta(pasta, nivel, temFilhos, contagem.get(pasta.id) || 0))
      if (pasta.aberta) {
        desenharPastas(pasta.id, nivel + 1)
        desenharFolhas(pasta.id, nivel + 1)
      }
    }
  }
  desenharPastas(null, 0)
}

// Migalhas de pão, chips das subpastas e o destino da captura
function renderizarContexto() {
  const { pastas, notas } = dados
  const contagem = contarPorPasta(notas)

  const trilha = [{ texto: '📚 Todas as notas', valor: 'todas' }]
  if (selecao === 'raiz') {
    trilha.push({ texto: '📥 Sem pasta', valor: 'raiz' })
  } else if (typeof selecao === 'number') {
    for (const p of caminhoDaPasta(pastas, selecao)) {
      trilha.push({ texto: '📁 ' + p.nome, valor: p.id })
    }
  }

  migalhas.replaceChildren()
  trilha.forEach((passo, i) => {
    if (i > 0) migalhas.appendChild(document.createTextNode(' › '))
    const ultimo = i === trilha.length - 1
    const el = document.createElement(ultimo ? 'strong' : 'span')
    el.textContent = passo.texto
    if (!ultimo) {
      el.className = 'migalha'
      el.addEventListener('click', () => selecionar(passo.valor))
    }
    migalhas.appendChild(el)
  })

  const ids = new Set(pastas.map((p) => p.id))
  const filhas = pastas.filter((p) =>
    typeof selecao === 'number' ? p.pai_id === selecao : p.pai_id === null || !ids.has(p.pai_id)
  )
  subpastasEl.replaceChildren()
  for (const p of filhas) {
    const chip = document.createElement('span')
    chip.className = 'chip-pasta'
    const total = contagem.get(p.id) || 0
    chip.textContent = `📁 ${p.nome}` + (total ? ` (${total})` : '')
    chip.addEventListener('click', () => selecionar(p.id))
    tornarAlvoDeSoltar(chip, (item) => soltarEm(item, p.id))
    subpastasEl.appendChild(chip)
  }
  subpastasEl.hidden = filhas.length === 0

  rotuloSub.hidden = typeof selecao !== 'number'
  destinoCaptura.textContent =
    'Salvando em: ' + (typeof selecao === 'number' ? '📁 ' + rotuloDaPasta(pastas, selecao) : '📥 Sem pasta')
}

// ---------- Lista de notas ----------

// Data de hoje no formato AAAA-MM-DD (fuso local), igual ao do campo de data
function hoje() {
  return new Date().toLocaleDateString('sv-SE')
}

function estaAtrasada(nota) {
  return nota.tipo === 'tarefa' && !nota.concluida && nota.prazo && nota.prazo < hoje()
}

function passaNoFiltro(nota) {
  if (filtroProjeto.value && nota.projeto !== filtroProjeto.value) return false
  switch (filtro.value) {
    case 'pendentes':
      return nota.tipo === 'tarefa' && !nota.concluida
    case 'atrasadas':
      return estaAtrasada(nota)
    case 'concluidas':
      return nota.tipo === 'tarefa' && Boolean(nota.concluida)
    default:
      return true
  }
}

function formatarData(aaaammdd) {
  const [a, m, d] = aaaammdd.split('-')
  return `${d}/${m}/${a}`
}

// Vai para a lista, mostra a nota (trocando de pasta se preciso) e a destaca por um instante
async function irParaNota(id) {
  if (vistaAtual !== 'lista') await mostrarVista('lista')
  busca.value = ''
  filtro.value = 'todas'
  filtroProjeto.value = ''

  const notas = await window.api.listarNotas()
  const nota = notas.find((n) => n.id === id)
  if (nota && !criarEscopo()(nota)) {
    selecao = nota.pasta_id === null ? 'raiz' : nota.pasta_id
  }
  await renderizar()

  const alvo = lista.querySelector(`[data-id="${id}"]`)
  if (!alvo) return
  alvo.scrollIntoView({ behavior: 'smooth', block: 'center' })
  alvo.classList.add('destaque')
  setTimeout(() => alvo.classList.remove('destaque'), 1500)
}

// Clicar num [[link]] que ainda não existe: abre a captura já com o título preenchido
function criarNotaDoLink(nome) {
  texto.value = nome + '\n'
  tipo.value = 'ideia'
  atualizarCampoPrazo()
  vistas.lista.scrollTo({ top: 0, behavior: 'smooth' })
  texto.focus()
}

// Monta o texto da nota: [[links]] e #tags viram elementos clicáveis
function criarConteudo(nota, indice) {
  const span = document.createElement('span')
  span.className = nota.concluida ? 'conteudo feita' : 'conteudo'

  for (const parte of nota.texto.split(REGEX_TOKEN)) {
    const link = SO_LINK.exec(parte)

    if (link) {
      const nome = link[1].trim()
      const alvo = Links.resolver(indice, nome)
      const el = document.createElement('span')
      el.className = alvo ? 'wikilink' : 'wikilink pendente'
      el.textContent = parte
      el.title = alvo ? 'Ir para a nota' : 'Essa nota ainda não existe. Clique para criar'
      el.addEventListener('click', () => (alvo ? irParaNota(alvo.id) : criarNotaDoLink(nome)))
      span.appendChild(el)
    } else if (SO_TAG.test(parte)) {
      const tag = document.createElement('span')
      tag.className = 'tag'
      tag.textContent = parte
      tag.addEventListener('click', () => {
        busca.value = parte
        renderizar()
      })
      span.appendChild(tag)
    } else if (parte) {
      span.appendChild(document.createTextNode(parte))
    }
  }
  span.appendChild(document.createTextNode(' '))
  return span
}

// "Mencionada em: ..." com as notas que apontam para esta
function criarBacklinks(nota, indice) {
  const origens = indice.entrada.get(nota.id) || []
  if (origens.length === 0) return null

  const div = document.createElement('div')
  div.className = 'backlinks'
  div.appendChild(document.createTextNode('Mencionada em: '))
  for (const origem of origens) {
    const chip = document.createElement('span')
    chip.className = 'wikilink'
    chip.textContent = Links.titulo(origem.texto) || '(sem título)'
    chip.addEventListener('click', () => irParaNota(origem.id))
    div.appendChild(chip)
  }
  return div
}

// Mini formulário que substitui a nota na lista durante a edição
function criarFormularioEdicao(nota) {
  const form = document.createElement('div')
  form.className = 'edicao'

  const area = document.createElement('textarea')
  area.value = nota.texto

  const selectTipo = document.createElement('select')
  const opcoes = [
    ['tarefa', 'Tarefa'],
    ['ideia', 'Ideia'],
    ['referencia', 'Referência'],
  ]
  for (const [valor, rotulo] of opcoes) {
    const opcao = document.createElement('option')
    opcao.value = valor
    opcao.textContent = rotulo
    selectTipo.appendChild(opcao)
  }
  selectTipo.value = nota.tipo

  // Campo "Pasta": lista todas as pastas pelo caminho completo
  const selectPasta = document.createElement('select')
  const semPasta = document.createElement('option')
  semPasta.value = ''
  semPasta.textContent = '📥 Sem pasta'
  selectPasta.appendChild(semPasta)
  const rotulos = dados.pastas
    .map((p) => ({ id: p.id, rotulo: rotuloDaPasta(dados.pastas, p.id) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  for (const { id, rotulo } of rotulos) {
    const opcao = document.createElement('option')
    opcao.value = String(id)
    opcao.textContent = '📁 ' + rotulo
    selectPasta.appendChild(opcao)
  }
  selectPasta.value = nota.pasta_id === null ? '' : String(nota.pasta_id)

  const campoProjeto = document.createElement('input')
  campoProjeto.type = 'text'
  campoProjeto.setAttribute('list', 'projetos-lista')
  campoProjeto.maxLength = 40
  campoProjeto.placeholder = 'Projeto (opcional)'
  campoProjeto.value = nota.projeto || ''

  const campoPrazo = document.createElement('input')
  campoPrazo.type = 'date'
  campoPrazo.value = nota.prazo || ''

  function ajustarPrazo() {
    campoPrazo.disabled = selectTipo.value !== 'tarefa'
    if (campoPrazo.disabled) campoPrazo.value = ''
  }
  selectTipo.addEventListener('change', ajustarPrazo)
  ajustarPrazo()

  const botaoSalvar = document.createElement('button')
  botaoSalvar.textContent = 'Salvar'
  botaoSalvar.className = 'primario'
  botaoSalvar.addEventListener('click', async () => {
    const conteudo = area.value.trim()
    if (!conteudo) return
    await window.api.atualizarNota(
      nota.id,
      conteudo,
      selectTipo.value,
      campoPrazo.value || null,
      campoProjeto.value,
      selectPasta.value === '' ? null : Number(selectPasta.value)
    )
    atualizarTela()
  })

  const botaoCancelar = document.createElement('button')
  botaoCancelar.textContent = 'Cancelar'
  botaoCancelar.addEventListener('click', renderizar)

  form.append(area, selectTipo, selectPasta, campoProjeto, campoPrazo, botaoSalvar, botaoCancelar)
  return form
}

// Atualiza o filtro de projetos e as sugestões do campo de projeto
async function atualizarProjetos() {
  const projetos = await window.api.listarProjetos()
  const atual = filtroProjeto.value

  filtroProjeto.innerHTML = ''
  const todos = document.createElement('option')
  todos.value = ''
  todos.textContent = 'Todos os projetos'
  filtroProjeto.appendChild(todos)

  projetosLista.innerHTML = ''
  for (const p of projetos) {
    const opcao = document.createElement('option')
    opcao.value = p
    opcao.textContent = p
    filtroProjeto.appendChild(opcao)

    const sugestao = document.createElement('option')
    sugestao.value = p
    projetosLista.appendChild(sugestao)
  }

  filtroProjeto.value = projetos.includes(atual) ? atual : ''
}

async function renderizar() {
  await atualizarProjetos()
  await buscarDados()

  const { pastas, notas: todasNotas } = dados
  const noEscopo = criarEscopo()
  const rotulos = new Map(pastas.map((p) => [p.id, rotuloDaPasta(pastas, p.id)]))
  // O índice de links usa TODAS as notas, de todas as pastas
  const indice = Links.indexar(todasNotas)

  renderizarArvore()
  renderizarContexto()

  const termo = busca.value
  const encontradas = await window.api.buscarNotas(termo)
  const notas = encontradas.filter((n) => noEscopo(n) && passaNoFiltro(n))

  lista.innerHTML = ''
  vazio.hidden = notas.length > 0
  const filtrando = termo.trim() || filtro.value !== 'todas' || filtroProjeto.value
  if (filtrando) vazio.textContent = 'Nada encontrado.'
  else if (selecao === 'todas') vazio.textContent = 'Nenhuma nota ainda. Capture a primeira!'
  else vazio.textContent = 'Nada aqui ainda. Capture uma nota ou arraste notas para esta pasta.'

  for (const nota of notas) {
    const li = document.createElement('li')
    li.dataset.id = nota.id

    // Alça para arrastar a nota até uma pasta
    const alca = document.createElement('span')
    alca.className = 'alca'
    alca.textContent = '⠿'
    alca.title = 'Arraste para uma pasta'
    alca.draggable = true
    alca.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData(MIME, JSON.stringify({ tipo: 'nota', id: nota.id }))
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setDragImage(li, 10, 10)
    })
    li.appendChild(alca)

    if (nota.tipo === 'tarefa') {
      const check = document.createElement('input')
      check.type = 'checkbox'
      check.checked = Boolean(nota.concluida)
      check.addEventListener('change', async () => {
        await window.api.alternarConcluida(nota.id)
        atualizarTela()
      })
      li.appendChild(check)
      li.appendChild(document.createTextNode(' '))
    }

    li.appendChild(criarSpan('tipo', nota.tipo))

    // Mostra a pasta da nota quando ela não é a pasta aberta
    if (nota.pasta_id !== null && nota.pasta_id !== selecao && rotulos.has(nota.pasta_id)) {
      li.appendChild(criarSpan('pasta-badge', '📁 ' + rotulos.get(nota.pasta_id)))
    }
    if (nota.projeto) li.appendChild(criarSpan('projeto', nota.projeto))
    if (nota.prazo) {
      const atrasada = estaAtrasada(nota)
      li.appendChild(
        criarSpan(
          atrasada ? 'prazo atrasado' : 'prazo',
          (atrasada ? 'atrasada · ' : '') + formatarData(nota.prazo)
        )
      )
    }

    li.appendChild(criarConteudo(nota, indice))

    const botaoEditar = document.createElement('button')
    botaoEditar.textContent = 'editar'
    botaoEditar.addEventListener('click', () => {
      li.replaceChildren(criarFormularioEdicao(nota))
    })
    li.appendChild(botaoEditar)

    const botaoRemover = document.createElement('button')
    botaoRemover.textContent = 'apagar'
    botaoRemover.addEventListener('click', async () => {
      await window.api.removerNota(nota.id)
      atualizarTela()
    })
    li.appendChild(botaoRemover)

    const backlinks = criarBacklinks(nota, indice)
    if (backlinks) li.appendChild(backlinks)

    lista.appendChild(li)
  }
}

// O prazo só faz sentido para tarefas
function atualizarCampoPrazo() {
  const ehTarefa = tipo.value === 'tarefa'
  prazo.disabled = !ehTarefa
  if (!ehTarefa) prazo.value = ''
}

document.getElementById('salvar').addEventListener('click', async () => {
  const conteudo = texto.value.trim()
  if (!conteudo) return
  await window.api.criarNota(
    conteudo,
    tipo.value,
    prazo.value || null,
    projeto.value,
    pastaDeDestino()
  )
  texto.value = ''
  prazo.value = ''
  projeto.value = ''
  atualizarTela()
})

document.getElementById('nova-pasta').addEventListener('click', () => criarPastaNova(null))
document.getElementById('novo-quadro').addEventListener('click', () => criarQuadroNovo(pastaDeDestino()))

tipo.addEventListener('change', atualizarCampoPrazo)
busca.addEventListener('input', renderizar)
filtro.addEventListener('change', renderizar)
filtroProjeto.addEventListener('change', renderizar)
incluirSub.addEventListener('change', atualizarTela)

// Quando a janelinha de captura cria uma nota, a tela se atualiza sozinha
window.api.aoMudar(atualizarTela)

// Clicar numa bolinha do grafo, ou abrir uma nota a partir de um quadro, mostra a nota na lista
Grafo.iniciar(irParaNota)
Quadro.iniciar(irParaNota)

atualizarCampoPrazo()
renderizar()