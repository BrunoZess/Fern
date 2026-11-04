// Editor de notas: só título e texto. Autosave, [[links]] para notas e pastas, atalhos de escrita
// e links relacionados (links, menções, backlinks e datas).
const Editor = (() => {
  const secao = document.getElementById('vista-editor')
  const caminhoEl = document.getElementById('editor-caminho')
  const tituloEl = document.getElementById('editor-titulo')
  const tagsEl = document.getElementById('editor-tags')
  const textoEl = document.getElementById('editor-texto')
  const relacionadosEl = document.getElementById('editor-relacionados')
  const contagemEl = document.getElementById('editor-contagem')
  const estadoEl = document.getElementById('editor-estado')
  const autoLigarEl = document.getElementById('editor-autoligar')
  const sugestoesEl = document.getElementById('editor-sugestoes')
  const btnMais = document.getElementById('editor-mais')

  // Os campos antigos (tipo, prazo, projeto...) ficam guardados como estão, só não aparecem mais
  let nota = null // { id, tipo, prazo, projeto, pasta_id, criada_em }
  let todasNotas = []
  let pastas = []
  let salvarTimer = null
  let relTimer = null
  let estadoTimer = null
  let sujo = false
  let autoLigar = true
  let backlinksTotal = 0
  let itensSugestao = []
  let indiceSugestao = 0
  let consulta = null
  let cb = {
    aoAlterar: () => {},
    aoAbrirNota: () => {},
    aoAbrirPasta: () => {},
    aoVerNoCalendario: () => {},
    aoBuscar: () => {},
    menuDaNota: () => [],
  }

  try {
    autoLigar = localStorage.getItem('autoLigar') !== '0'
  } catch {
    autoLigar = true
  }

  // ---------- Texto: título (primeira linha) + corpo ----------

  function separar(texto) {
    const i = texto.indexOf('\n')
    return i === -1 ? { titulo: texto, corpo: '' } : { titulo: texto.slice(0, i), corpo: texto.slice(i + 1) }
  }

  function montarTexto() {
    const titulo = tituloEl.value.replace(/\n/g, ' ')
    const corpo = textoEl.value
    return corpo === '' ? titulo : `${titulo}\n${corpo}`
  }

  // ---------- Salvar ----------

  function estado(texto, temporario = false) {
    estadoEl.textContent = texto
    clearTimeout(estadoTimer)
    if (temporario) {
      estadoTimer = setTimeout(() => {
        estadoEl.textContent = sujo ? 'Salvando…' : 'Salvo'
      }, 2500)
    }
  }

  function gravar(n, texto) {
    return window.api.atualizarNota(n.id, texto, n.tipo, n.prazo, n.projeto, n.pasta_id)
  }

  async function salvar() {
    if (!nota) return
    await gravar(nota, montarTexto())
    sujo = false
    estado('Salvo')
    cb.aoAlterar()
  }

  function agendarSalvar() {
    sujo = true
    estado('Salvando…')
    clearTimeout(salvarTimer)
    salvarTimer = setTimeout(salvar, 700)
  }

  // Grava o que faltar e descarta a nota se ela ficou totalmente vazia
  async function fechar() {
    if (!nota) return
    clearTimeout(salvarTimer)
    clearTimeout(relTimer)
    const atual = nota
    const texto = montarTexto()
    nota = null
    fecharSugestoes()
    if (texto === '') {
      await window.api.removerNota(atual.id)
      cb.aoAlterar()
      return
    }
    if (sujo) await gravar(atual, texto)
    sujo = false
  }

  function esquecer() {
    clearTimeout(salvarTimer)
    clearTimeout(relTimer)
    nota = null
    sujo = false
    fecharSugestoes()
  }

  // ---------- Abrir ----------

  async function abrir(id) {
    await fechar()
    const [notas, listaPastas] = await Promise.all([window.api.listarNotas(), window.api.listarPastas()])
    const encontrada = notas.find((n) => n.id === id)
    if (!encontrada) return false

    todasNotas = notas
    pastas = listaPastas
    Links.definirPastas(listaPastas)
    nota = {
      id: encontrada.id,
      tipo: encontrada.tipo,
      prazo: encontrada.prazo,
      projeto: encontrada.projeto,
      pasta_id: encontrada.pasta_id,
      criada_em: encontrada.criada_em,
    }

    const { titulo, corpo } = separar(encontrada.texto)
    tituloEl.value = titulo
    textoEl.value = corpo

    sujo = false
    atualizarCaminho()
    atualizarRelacionados()
    atualizarContagem()
    estado('Salvo')
    return true
  }

  function aoMostrar(opcoes = {}) {
    ajustarAltura()
    if (opcoes.focarTitulo) {
      tituloEl.focus()
      tituloEl.select()
    } else if (!tituloEl.value && !textoEl.value) {
      tituloEl.focus()
    }
  }

  // Atualiza notas e pastas; devolve false se a nota aberta deixou de existir
  function definirDados(notas, listaPastas) {
    todasNotas = notas
    pastas = listaPastas
    Links.definirPastas(listaPastas)
    if (!nota) return true
    const atual = notas.find((n) => n.id === nota.id)
    if (!atual) return false
    nota.pasta_id = atual.pasta_id
    atualizarCaminho()
    atualizarRelacionados()
    return true
  }

  // ---------- Partes da tela ----------

  function nomesDoCaminho(pasta) {
    const partes = []
    let atual = pasta
    let guarda = 0
    while (atual && guarda++ < 50) {
      partes.unshift(atual.nome)
      const paiId = atual.pai_id
      atual = paiId === null ? null : pastas.find((p) => p.id === paiId)
    }
    return partes
  }

  function atualizarCaminho() {
    const pasta = pastas.find((p) => p.id === nota.pasta_id)
    caminhoEl.textContent = ['Raiz', ...nomesDoCaminho(pasta)].join(' / ')
  }

  function atualizarContagem() {
    const t = montarTexto().trim()
    const palavras = t ? t.split(/\s+/).length : 0
    if (palavras === 0) {
      contagemEl.textContent = 'Nota vazia'
      return
    }
    const links =
      backlinksTotal > 0 ? ` · ${backlinksTotal} ${backlinksTotal === 1 ? 'backlink' : 'backlinks'}` : ''
    contagemEl.textContent = `${palavras} ${palavras === 1 ? 'palavra' : 'palavras'} · ${t.length} caracteres${links}`
  }

  function ajustarAltura() {
    textoEl.style.height = 'auto'
    textoEl.style.height = textoEl.scrollHeight + 'px'
  }

  // ---------- Links, menções e datas ----------

  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const PROTEGIDO = /(```[\s\S]*?```|`[^`\n]*`|\[\[[^\[\]\n]*\]\]|https?:\/\/\S+)/g

  // título em minúsculas -> título original (de todas as outras notas)
  function titulosCandidatos() {
    const mapa = new Map()
    for (const n of todasNotas) {
      if (nota && n.id === nota.id) continue
      const t = Links.titulo(n.texto)
      if (t.length >= 3 && !mapa.has(t.toLowerCase())) mapa.set(t.toLowerCase(), t)
    }
    return mapa
  }

  // Um [[link]] aponta para uma nota ou para uma pasta (nota tem prioridade; "Nome/" força a pasta)
  function resolverLink(indice, nome) {
    if (!/\/\s*$/.test(nome)) {
      const alvo = Links.resolver(indice, nome)
      if (alvo) return { tipo: 'nota', nota: alvo }
    }
    const pasta = Links.resolverPasta(nome)
    return pasta ? { tipo: 'pasta', pasta } : null
  }

  function abrirLinkResolvido(r, novaAba) {
    if (r.tipo === 'nota') cb.aoAbrirNota(r.nota.id, novaAba)
    else cb.aoAbrirPasta(r.pasta.id, novaAba)
  }

  // Troca menções soltas por [[links]], ignorando código, URLs e links que já existem
  function substituirMencoes(texto, mapa) {
    const titulos = [...mapa.values()].sort((a, b) => b.length - a.length)
    const achados = new Set()
    if (titulos.length === 0) return { texto, achados }
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${titulos.map(escapar).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
    const partes = texto.split(PROTEGIDO)
    for (let i = 0; i < partes.length; i += 2) {
      partes[i] = partes[i].replace(re, (m) => {
        const canonico = mapa.get(m.toLowerCase())
        if (!canonico) return m
        achados.add(canonico)
        return `[[${canonico}]]`
      })
    }
    return { texto: partes.join(''), achados }
  }

  function ligarMencoes(somente) {
    let mapa = titulosCandidatos()
    if (somente) {
      mapa = new Map([...mapa].filter(([, titulo]) => somente.includes(titulo)))
    }
    const pos = textoEl.selectionStart
    const { texto, achados } = substituirMencoes(textoEl.value, mapa)
    if (achados.size === 0) {
      estado('Nenhuma menção para ligar', true)
      return
    }
    textoEl.focus()
    textoEl.select()
    inserir(texto)
    const nova = Math.min(pos, textoEl.value.length)
    textoEl.setSelectionRange(nova, nova)
    estado(`${achados.size} ${achados.size === 1 ? 'nota ligada' : 'notas ligadas'}`, true)
  }

  // Ao digitar espaço/pontuação/Enter logo depois do título de outra nota, vira [[link]]
  function ligarTituloAntesDoCursor() {
    const pos = textoEl.selectionStart
    if (pos !== textoEl.selectionEnd) return
    const antes = textoEl.value.slice(0, pos)
    if ((antes.match(/\[\[/g) || []).length > (antes.match(/\]\]/g) || []).length) return
    const linhaAtual = antes.slice(antes.lastIndexOf('\n') + 1)
    if ((linhaAtual.match(/`/g) || []).length % 2 === 1) return

    const titulos = [...titulosCandidatos().values()].sort((a, b) => b.length - a.length)
    for (const t of titulos) {
      if (t.length > antes.length) continue
      const trecho = antes.slice(antes.length - t.length)
      if (Links.normalizar(trecho) !== Links.normalizar(t)) continue
      const anterior = antes[antes.length - t.length - 1]
      if (anterior && /[\p{L}\p{N}_]/u.test(anterior)) continue
      textoEl.setSelectionRange(pos - t.length, pos)
      inserir(`[[${t}]]`)
      return
    }
  }

  async function criarNotaDoLink(nome) {
    const nova = await window.api.criarNota(nome, 'ideia', null, '', nota.pasta_id)
    cb.aoAlterar()
    cb.aoAbrirNota(nova.id, false)
  }

  // Seleciona um trecho, cria uma nota com ele e troca o trecho pelo link
  async function criarNotaComSelecao() {
    const a = textoEl.selectionStart
    const b = textoEl.selectionEnd
    const selecao = textoEl.value.slice(a, b).trim()
    const titulo = Links.titulo(selecao)
    if (!selecao || !titulo) return
    await window.api.criarNota(selecao, 'ideia', null, '', nota.pasta_id)
    textoEl.setSelectionRange(a, b)
    inserir(`[[${titulo}]]`)
    cb.aoAlterar()
    estado(`Nota "${titulo}" criada`, true)
  }

  function criarChip(texto, classe, aoClicar) {
    const el = document.createElement('span')
    el.className = classe
    el.textContent = texto
    el.addEventListener('click', aoClicar)
    return el
  }

  function criarGrupo(rotulo, chips) {
    const grupo = document.createElement('div')
    grupo.className = 'rel-grupo'
    const r = document.createElement('span')
    r.className = 'rel-rotulo'
    r.textContent = rotulo
    grupo.appendChild(r)
    for (const chip of chips) grupo.appendChild(chip)
    return grupo
  }

  // Pílulas com as #tags da nota, embaixo do título
  function atualizarTags(texto) {
    const tags = [...new Set(texto.match(/(?<![^\s])#[\p{L}\p{N}_-]+/gu) || [])]
    tagsEl.replaceChildren()
    for (const tag of tags) tagsEl.appendChild(criarChip(tag, 'tag-pill', () => cb.aoBuscar(tag)))
    tagsEl.hidden = tags.length === 0
  }

  function atualizarRelacionados() {
    if (!nota) return
    relacionadosEl.replaceChildren()
    const texto = montarTexto()
    atualizarTags(texto)
    const indice = Links.indexar(todasNotas)

    const nomes = [...new Set(Links.extrairLinks(texto))]
    if (nomes.length > 0) {
      relacionadosEl.appendChild(
        criarGrupo(
          'Links',
          nomes.map((nome) => {
            const r = resolverLink(indice, nome)
            if (r && r.tipo === 'pasta') {
              return criarChip(`${r.pasta.nome}/`, 'rel-chip wikilink pasta', () => abrirLinkResolvido(r, false))
            }
            if (r) return criarChip(nome, 'rel-chip wikilink', () => abrirLinkResolvido(r, false))
            return criarChip(nome, 'rel-chip wikilink pendente', () => criarNotaDoLink(nome))
          })
        )
      )
    }

    const origens = indice.entrada.get(nota.id) || []
    backlinksTotal = origens.length
    atualizarContagem()
    if (origens.length > 0) {
      relacionadosEl.appendChild(
        criarGrupo(
          'Mencionada em',
          origens.map((o) =>
            criarChip(Links.titulo(o.texto) || '(sem título)', 'rel-chip wikilink', () =>
              cb.aoAbrirNota(o.id, false)
            )
          )
        )
      )
    }

    const { achados } = substituirMencoes(textoEl.value, titulosCandidatos())
    if (achados.size > 0) {
      relacionadosEl.appendChild(
        criarGrupo(
          'Possíveis links',
          [...achados].map((titulo) => criarChip(titulo, 'rel-chip sugestao', () => ligarMencoes([titulo])))
        )
      )
    }

    const eventos = Datas.extrairEventos({ id: nota.id, texto, criada_em: nota.criada_em })
    if (eventos.length > 0) {
      relacionadosEl.appendChild(
        criarGrupo(
          'No calendário',
          eventos.slice(0, 8).map((e) => {
            const curta = `${e.data.slice(8, 10)}/${e.data.slice(5, 7)}`
            return criarChip(`${curta}${e.hora ? ' ' + e.hora : ''} ${e.titulo}`, 'rel-chip', () =>
              cb.aoVerNoCalendario(e.data)
            )
          })
        )
      )
    }
    
    const urls = [...new Set(Array.from(textoEl.value.matchAll(RE_URL), (m) => normalizarUrl(m[0])))]
    if (urls.length > 0) {
      relacionadosEl.appendChild(
        criarGrupo(
          'Sites',
          urls.slice(0, 8).map((url) => {
            let rotulo = url
            try {
              rotulo = new URL(url).hostname.replace(/^www\./, '')
            } catch {
              // mantém a URL inteira
            }
            return criarChip(rotulo, 'rel-chip externo', () => abrirNoNavegador(url))
          })
        )
      )
    }

    relacionadosEl.hidden = relacionadosEl.childElementCount === 0
  }

  function agendarRelacionados() {
    clearTimeout(relTimer)
    relTimer = setTimeout(atualizarRelacionados, 500)
  }

  // ---------- Edição de texto ----------

  function inserir(texto) {
    textoEl.focus()
    if (!document.execCommand('insertText', false, texto)) {
      textoEl.setRangeText(texto, textoEl.selectionStart, textoEl.selectionEnd, 'end')
      textoEl.dispatchEvent(new Event('input'))
    }
  }

  function apagarSelecao() {
    textoEl.focus()
    if (!document.execCommand('delete')) {
      textoEl.setRangeText('', textoEl.selectionStart, textoEl.selectionEnd, 'end')
      textoEl.dispatchEvent(new Event('input'))
    }
  }

  function envolver(marca) {
    const a = textoEl.selectionStart
    const b = textoEl.selectionEnd
    const sel = textoEl.value.slice(a, b)
    const n = marca.length
    if (sel.length >= n * 2 && sel.startsWith(marca) && sel.endsWith(marca)) {
      inserir(sel.slice(n, sel.length - n))
    } else {
      inserir(marca + sel + marca)
      if (a === b) textoEl.setSelectionRange(a + n, a + n)
    }
  }

  // [ com texto selecionado, ou Ctrl+L: vira [[link]]
  function linkParaNota() {
    const a = textoEl.selectionStart
    const b = textoEl.selectionEnd
    inserir(`[[${textoEl.value.slice(a, b)}]]`)
    if (a === b) {
      textoEl.setSelectionRange(a + 2, a + 2)
      atualizarSugestoes()
    }
  }

  function limitesDaLinha(pos) {
    const valor = textoEl.value
    const inicio = valor.lastIndexOf('\n', pos - 1) + 1
    const fim = valor.indexOf('\n', pos)
    return { inicio, fim: fim === -1 ? valor.length : fim }
  }

  // ---------- Links de sites ----------
  const RE_URL = /(?:https?:\/\/|www\.)[^\s<>"'\])]+/gi

  function normalizarUrl(bruta) {
    const limpa = bruta.replace(/[.,;:!?]+$/, '')
    return /^www\./i.test(limpa) ? `https://${limpa}` : limpa
  }

  function urlNaPosicao(pos) {
    for (const m of textoEl.value.matchAll(RE_URL)) {
      if (pos >= m.index && pos <= m.index + m[0].length) return normalizarUrl(m[0])
    }
    return null
  }

  function abrirNoNavegador(url) {
    window.api.abrirLink(url).catch(() => estado('Não consegui abrir o link', true))
  }

  function alternarTarefaDaLinha() {
    const { inicio, fim } = limitesDaLinha(textoEl.selectionStart)
    const linha = textoEl.value.slice(inicio, fim)
    let nova
    if (/^\s*[-*+]\s\[ \]/.test(linha)) nova = linha.replace('[ ]', '[x]')
    else if (/^\s*[-*+]\s\[[xX]\]/.test(linha)) nova = linha.replace(/\[[xX]\]/, '[ ]')
    else if (/^\s*[-*+]\s/.test(linha)) nova = linha.replace(/^(\s*[-*+]\s)/, '$1[ ] ')
    else nova = linha.replace(/^(\s*)/, '$1- [ ] ')
    textoEl.setSelectionRange(inicio, fim)
    inserir(nova)
  }

  function continuarLista(e) {
    const pos = textoEl.selectionStart
    if (pos !== textoEl.selectionEnd) return
    const { inicio } = limitesDaLinha(pos)
    const antes = textoEl.value.slice(inicio, pos)
    const m = /^(\s*)([-*+]|\d+\.)\s(\[[ xX]\]\s)?/.exec(antes)
    if (!m) return

    e.preventDefault()
    if (antes.length === m[0].length) {
      textoEl.setSelectionRange(inicio, pos)
      apagarSelecao()
      return
    }
    const marcador = /^\d+\.$/.test(m[2]) ? `${parseInt(m[2], 10) + 1}.` : m[2]
    inserir(`\n${m[1]}${marcador} ${m[3] ? '[ ] ' : ''}`)
  }

  function indentar(inverso) {
    const a = textoEl.selectionStart
    const { inicio, fim } = limitesDaLinha(a)
    const linha = textoEl.value.slice(inicio, fim)

    if (!inverso) {
      if (/^\s*([-*+]|\d+\.)\s/.test(linha)) {
        textoEl.setSelectionRange(inicio, inicio)
        inserir('  ')
        textoEl.setSelectionRange(a + 2, a + 2)
      } else {
        inserir('  ')
      }
      return
    }
    const espacos = /^ {1,2}/.exec(linha)
    if (!espacos) return
    textoEl.setSelectionRange(inicio, inicio + espacos[0].length)
    apagarSelecao()
    const novaPos = Math.max(inicio, a - espacos[0].length)
    textoEl.setSelectionRange(novaPos, novaPos)
  }

  // Alt+↑ / Alt+↓: move a linha (ou as linhas selecionadas)
  function moverLinha(delta) {
    const valor = textoEl.value
      const url = urlNaPosicao(pos)
      if (url) {
        abrirNoNavegador(url)
        return
      }
    const a = textoEl.selectionStart
    const b = textoEl.selectionEnd
    const inicio = valor.lastIndexOf('\n', a - 1) + 1
    const fimIdx = valor.indexOf('\n', b)
    const fim = fimIdx === -1 ? valor.length : fimIdx
    const bloco = valor.slice(inicio, fim)

    if (delta < 0) {
      if (inicio === 0) return
      const inicioAnterior = valor.lastIndexOf('\n', inicio - 2) + 1
      const anterior = valor.slice(inicioAnterior, inicio - 1)
      textoEl.setSelectionRange(inicioAnterior, fim)
      inserir(bloco + '\n' + anterior)
      textoEl.setSelectionRange(inicioAnterior + (a - inicio), inicioAnterior + (b - inicio))
    } else {
      if (fim >= valor.length) return
      const fimProximaIdx = valor.indexOf('\n', fim + 1)
      const fimProxima = fimProximaIdx === -1 ? valor.length : fimProximaIdx
      const proxima = valor.slice(fim + 1, fimProxima)
      textoEl.setSelectionRange(inicio, fimProxima)
      inserir(proxima + '\n' + bloco)
      const deslocamento = proxima.length + 1
      textoEl.setSelectionRange(a + deslocamento, b + deslocamento)
    }
  }

  // Alt+Shift+↓ / ↑: duplica a linha para baixo ou para cima
  function duplicarLinha(paraBaixo) {
    const valor = textoEl.value
    const a = textoEl.selectionStart
    const b = textoEl.selectionEnd
    const inicio = valor.lastIndexOf('\n', a - 1) + 1
    const fimIdx = valor.indexOf('\n', b)
    const fim = fimIdx === -1 ? valor.length : fimIdx
    const bloco = valor.slice(inicio, fim)
    if (paraBaixo) {
      textoEl.setSelectionRange(fim, fim)
      inserir('\n' + bloco)
      const d = bloco.length + 1
      textoEl.setSelectionRange(a + d, b + d)
    } else {
      textoEl.setSelectionRange(inicio, inicio)
      inserir(bloco + '\n')
      textoEl.setSelectionRange(a, b)
    }
  }

  // Ctrl+; insere a data de hoje (e ela já vai para o calendário); Ctrl+Shift+; insere a hora
  function inserirDataHora(hora) {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    inserir(
      hora
        ? `${p(d.getHours())}:${p(d.getMinutes())}`
        : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
    )
  }

  // ---------- Autocompletar de [[links]] (notas e pastas) ----------

  function coordenadasDoCursor(pos) {
    const estilo = getComputedStyle(textoEl)
    const espelho = document.createElement('div')
    for (const p of [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'boxSizing', 'width',
    ]) {
      espelho.style[p] = estilo[p]
    }
    Object.assign(espelho.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      top: '0',
      left: '-9999px',
    })
    espelho.textContent = textoEl.value.slice(0, pos)
    const marcador = document.createElement('span')
    marcador.textContent = '\u200b'
    espelho.appendChild(marcador)
    document.body.appendChild(espelho)
    const ponto = { x: marcador.offsetLeft, y: marcador.offsetTop }
    espelho.remove()
    return ponto
  }

  function fecharSugestoes() {
    sugestoesEl.hidden = true
    consulta = null
    itensSugestao = []
  }

  function renderizarSugestoes() {
    sugestoesEl.replaceChildren()
    itensSugestao.forEach((item, i) => {
      const li = document.createElement('li')
      li.textContent = item.rotulo
      if (item.pasta) li.classList.add('pasta')
      if (i === indiceSugestao) li.classList.add('ativo')
      li.addEventListener('mousedown', (e) => {
        e.preventDefault()
        aplicarSugestao(item)
      })
      sugestoesEl.appendChild(li)
    })
  }

  // Nome curto da pasta se for único; senão o caminho completo com "/" no fim
  function valorParaPasta(pasta) {
    const nome = Links.normalizar(pasta.nome)
    const homonimas = pastas.filter((p) => Links.normalizar(p.nome) === nome).length
    const notaIgual = todasNotas.some((n) => Links.normalizar(Links.titulo(n.texto)) === nome)
    return homonimas === 1 && !notaIgual ? pasta.nome : nomesDoCaminho(pasta).join('/') + '/'
  }

  function atualizarSugestoes() {
    if (!nota) return fecharSugestoes()
    const pos = textoEl.selectionStart
    if (pos !== textoEl.selectionEnd) return fecharSugestoes()

    const m = /\[\[([^\[\]\n]*)$/.exec(textoEl.value.slice(0, pos))
    if (!m) return fecharSugestoes()

    const termo = m[1]
    const q = Links.normalizar(termo)
    const comecaComQ = (s) => Number(!Links.normalizar(s).startsWith(q))
    const titulos = [...titulosCandidatos().values()]

    const notasFiltradas = titulos
      .filter((t) => !q || Links.normalizar(t).includes(q))
      .sort((a, b) => comecaComQ(a) - comecaComQ(b) || a.localeCompare(b, 'pt-BR'))
      .slice(0, 8)
    const pastasFiltradas = pastas
      .filter((p) => !q || Links.normalizar(p.nome).includes(q))
      .sort((a, b) => comecaComQ(a.nome) - comecaComQ(b.nome) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 4)

    itensSugestao = notasFiltradas.map((t) => ({ rotulo: t, valor: t }))
    for (const p of pastasFiltradas) {
      itensSugestao.push({ rotulo: `${nomesDoCaminho(p).join(' / ')} /`, valor: valorParaPasta(p), pasta: true })
    }
    const existeExato =
      titulos.some((t) => Links.normalizar(t) === q) || pastas.some((p) => Links.normalizar(p.nome) === q)
    if (termo.trim() && !existeExato) {
      itensSugestao.push({ rotulo: `Criar “${termo.trim()}”`, valor: termo.trim() })
    }
    if (itensSugestao.length === 0) return fecharSugestoes()

    consulta = { inicio: pos - termo.length }
    indiceSugestao = 0
    renderizarSugestoes()

    const { x, y } = coordenadasDoCursor(pos)
    const r = textoEl.getBoundingClientRect()
    const alturaLinha = parseFloat(getComputedStyle(textoEl).lineHeight) || 24
    sugestoesEl.hidden = false
    const esquerda = Math.min(r.left + x, window.innerWidth - sugestoesEl.offsetWidth - 12)
    sugestoesEl.style.left = `${Math.max(8, esquerda)}px`
    sugestoesEl.style.top = `${r.top + y + alturaLinha}px`
  }

  function aplicarSugestao(item) {
    if (!item || !consulta) return
    textoEl.focus()
    textoEl.setSelectionRange(consulta.inicio, textoEl.selectionStart)
    inserir(`${item.valor}]]`)
    fecharSugestoes()
  }

  // ---------- Menu do botão direito ----------

  async function colarDoSistema() {
    const { texto } = await window.api.lerAreaTransferencia()
    if (texto) inserir(texto)
  }

  textoEl.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const temSelecao = textoEl.selectionStart !== textoEl.selectionEnd
    const urlAqui = urlNaPosicao(textoEl.selectionStart)
    MenuContexto.abrir({ x: e.clientX, y: e.clientY }, [
      ...(urlAqui
        ? [{ rotulo: 'Abrir link no navegador', aoClicar: () => abrirNoNavegador(urlAqui) }, { separador: true }]
        : []),
      { rotulo: 'Recortar', atalho: 'Ctrl+X', desativado: !temSelecao, aoClicar: () => document.execCommand('cut') },
      { rotulo: 'Copiar', atalho: 'Ctrl+C', desativado: !temSelecao, aoClicar: () => document.execCommand('copy') },
      { rotulo: 'Colar', atalho: 'Ctrl+V', aoClicar: colarDoSistema },
      { separador: true },
      { rotulo: 'Negrito', atalho: 'Ctrl+B', aoClicar: () => envolver('**') },
      { rotulo: 'Itálico', atalho: 'Ctrl+I', aoClicar: () => envolver('*') },
      { rotulo: 'Código', aoClicar: () => envolver('`') },
      { rotulo: 'Tarefa', atalho: 'Ctrl+Enter', aoClicar: alternarTarefaDaLinha },
      { separador: true },
      { rotulo: 'Link para nota ou pasta', atalho: 'Ctrl+L', aoClicar: linkParaNota },
      { rotulo: 'Criar nota com a seleção', desativado: !temSelecao, aoClicar: criarNotaComSelecao },
      { rotulo: 'Ligar menções a outras notas', aoClicar: () => ligarMencoes() },
      { separador: true },
      ...cb.menuDaNota(),
    ])
  })

  // ---------- Eventos ----------

  function iniciar(opcoes) {
    cb = { ...cb, ...opcoes }
    autoLigarEl.checked = autoLigar

    autoLigarEl.addEventListener('change', () => {
      autoLigar = autoLigarEl.checked
      try {
        localStorage.setItem('autoLigar', autoLigar ? '1' : '0')
      } catch {
        // sem armazenamento: a escolha vale só nesta sessão
      }
    })

    tituloEl.addEventListener('input', () => {
      atualizarContagem()
      agendarSalvar()
      agendarRelacionados()
    })
    tituloEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        textoEl.focus()
        textoEl.setSelectionRange(0, 0)
      }
    })

    textoEl.addEventListener('input', () => {
      ajustarAltura()
      atualizarContagem()
      agendarSalvar()
      agendarRelacionados()
      atualizarSugestoes()
    })
    textoEl.addEventListener('blur', fecharSugestoes)

    // Ctrl + clique num [[link]] abre a nota (ou o primeiro arquivo da pasta) em nova aba
    textoEl.addEventListener('click', (e) => {
      if (!(e.ctrlKey || e.metaKey) || !nota) return
      const pos = textoEl.selectionStart
      const valor = textoEl.value
      const inicio = valor.lastIndexOf('[[', pos)
      if (inicio === -1) return
      const fim = valor.indexOf(']]', inicio)
      if (fim === -1 || pos > fim + 2 || valor.slice(inicio, fim).includes('\n')) return
      const nome = valor.slice(inicio + 2, fim).trim()
      if (!nome) return
      const r = resolverLink(Links.indexar(todasNotas), nome)
      if (r) abrirLinkResolvido(r, true)
      else criarNotaDoLink(nome)
    })

    textoEl.addEventListener('keydown', (e) => {
      if (!sugestoesEl.hidden) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const passo = e.key === 'ArrowDown' ? 1 : -1
          indiceSugestao = (indiceSugestao + passo + itensSugestao.length) % itensSugestao.length
          renderizarSugestoes()
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          aplicarSugestao(itensSugestao[indiceSugestao])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          fecharSugestoes()
          return
        }
      }

      if (e.ctrlKey || e.metaKey) {
        const tecla = e.key.toLowerCase()
        if (tecla === 'b') {
          e.preventDefault()
          envolver('**')
        } else if (tecla === 'i') {
          e.preventDefault()
          envolver('*')
        } else if (tecla === 'l') {
          e.preventDefault()
          linkParaNota()
        } else if (e.key === ';') {
          e.preventDefault()
          inserirDataHora(false)
        } else if (e.key === ':') {
          e.preventDefault()
          inserirDataHora(true)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          alternarTarefaDaLinha()
        }
        return
      }

      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        if (e.shiftKey) duplicarLinha(e.key === 'ArrowDown')
        else moverLinha(e.key === 'ArrowDown' ? 1 : -1)
        return
      }

      if (e.key === '[' && !e.altKey && textoEl.selectionStart !== textoEl.selectionEnd) {
        e.preventDefault()
        linkParaNota()
        return
      }

      // Terminou de digitar uma palavra: se for o título de outra nota, vira link
      if (autoLigar && !e.altKey && (e.key === ' ' || e.key === 'Enter' || /^[.,;:!?)]$/.test(e.key))) {
        ligarTituloAntesDoCursor()
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) continuarLista(e)
      else if (e.key === 'Tab') {
        e.preventDefault()
        indentar(e.shiftKey)
      }
    })

    btnMais.addEventListener('click', () => MenuContexto.abrirEm(btnMais, cb.menuDaNota()))
    window.addEventListener('resize', () => {
      if (!secao.hidden) ajustarAltura()
    })
  }

  return {
    iniciar,
    abrir,
    fechar,
    esquecer,
    aoMostrar,
    definirDados,
    idAtual: () => (nota ? nota.id : null),
    tituloAtual: () => Links.titulo(montarTexto()),
  }
})()