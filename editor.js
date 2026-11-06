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
  const caixaTextoEl = document.getElementById('editor-texto-caixa')
  const realceEl = document.getElementById('editor-realce')
  const listaEl = document.getElementById('editor-lista')
  const leituraEl = document.getElementById('editor-leitura')
  const btnLer = document.getElementById('editor-ler')
  const corpoEl = secao.querySelector('.editor-corpo')
  const buscaEl = document.getElementById('editor-busca')
  const buscaTermoEl = document.getElementById('busca-termo')
  const buscaSubstEl = document.getElementById('busca-subst')
  const buscaContadorEl = document.getElementById('busca-contador')
  const buscaCaixaEl = document.getElementById('busca-caixa')
  const buscaLinhaSubstEl = document.getElementById('busca-linha-subst')

  let nota = null
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

  function separar(texto) {
    const i = texto.indexOf('\n')
    return i === -1 ? { titulo: texto, corpo: '' } : { titulo: texto.slice(0, i), corpo: texto.slice(i + 1) }
  }

  function montarTexto() {
    const titulo = tituloEl.value.replace(/\n/g, ' ')
    const corpo = textoEl.value
    return corpo === '' ? titulo : `${titulo}\n${corpo}`
  }

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
    listaComoTexto = false
    atualizarCaminho()
    atualizarRelacionados()
    atualizarContagem()
    aplicarModo()
    if (buscaAberta) recalcularBusca()
    estado('Salvo')
    return true
  }

  function aoMostrar(opcoes = {}) {
    ajustarAltura()
    if (opcoes.focarLista && modoAtual() === 'lista') {
      listaEl.querySelector('.lista-novo')?.focus()
    } else if (opcoes.focarTitulo) {
      tituloEl.focus()
      tituloEl.select()
    } else if (!tituloEl.value && !textoEl.value) {
      tituloEl.focus()
    }
  }

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
    desenharRealce()
    textoEl.style.height = 'auto'
    textoEl.style.height = textoEl.scrollHeight + 'px'
  }

  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const PROTEGIDO = /(```[\s\S]*?```|`[^`\n]*`|\[\[[^\[\]\n]*\]\]|https?:\/\/\S+)/g

  function titulosCandidatos() {
    const mapa = new Map()
    for (const n of todasNotas) {
      if (nota && n.id === nota.id) continue
      const t = Links.titulo(n.texto)
      if (t.length >= 3 && !mapa.has(t.toLowerCase())) mapa.set(t.toLowerCase(), t)
    }
    return mapa
  }

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

function moverLinha(delta) {
  const valor = textoEl.value
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

  function inserirDataHora(hora) {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    inserir(
      hora
        ? `${p(d.getHours())}:${p(d.getMinutes())}`
        : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
    )
  }

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

  const RE_TAREFA = Afazeres.RE_TAREFA
  const RE_SECAO = /^\s*#{1,6}\s+(.*)$/
  let listaComoTexto = false
  let lendo = false
  let linhasAnimadas = new Set()
  let progressoAnterior = { id: null, largura: '0%' }

  function modoAtual() {
    if (!nota) return 'texto'
    if (nota.tipo === 'lista' && !listaComoTexto) return 'lista'
    if (lendo) return 'leitura'
    return 'texto'
  }

  function aplicarModo() {
    const modo = modoAtual()
    caixaTextoEl.hidden = modo !== 'texto'
    listaEl.hidden = modo !== 'lista'
    leituraEl.hidden = modo !== 'leitura'
    secao.classList.toggle('modo-lista', modo === 'lista')
    btnLer.classList.toggle('ativo', modo === 'leitura')
    if (modo === 'lista') renderizarLista()
    if (modo === 'texto') ajustarAltura()
    if (modo === 'leitura') renderizarLeitura()
  }

  function renderizarLeitura() {
    leituraEl.innerHTML = textoEl.value.trim()
      ? Markdown.renderizar(textoEl.value)
      : '<p class="leitura-vazia">Nota sem texto. Ctrl+E volta para a edição.</p>'
    Rico.processar(leituraEl)
  }

  function alternarLeitura(forcar) {
    if (!nota) return
    const novo = typeof forcar === 'boolean' ? forcar : !lendo
    if (novo && nota.tipo === 'lista' && !listaComoTexto) return
    if (novo && buscaAberta) fecharBusca(false)
    lendo = novo
    fecharSugestoes()
    aplicarModo()
    if (!lendo) textoEl.focus()
  }

  function cliqueNaLeitura(e) {
    const caixa = e.target.closest('input[type="checkbox"][data-linha]')
    if (caixa) {
      alternarLinhaDoCorpo(Number(caixa.dataset.linha))
      return
    }
    const wiki = e.target.closest('a.wikilink')
    if (wiki) {
      e.preventDefault()
      const nome = wiki.dataset.link
      const r = resolverLink(Links.indexar(todasNotas), nome)
      if (r) abrirLinkResolvido(r, e.ctrlKey || e.metaKey)
      else criarNotaDoLink(nome)
      return
    }
    const externo = e.target.closest('a.externo')
    if (externo) {
      e.preventDefault()
      abrirNoNavegador(externo.dataset.url)
      return
    }
    const tag = e.target.closest('.tag[data-tag]')
    if (tag) cb.aoBuscar(tag.dataset.tag)
  }

  function mudarCorpo(novo) {
    textoEl.value = novo
    ajustarAltura()
    atualizarContagem()
    agendarSalvar()
    agendarRelacionados()
    if (modoAtual() === 'lista') renderizarLista()
    if (modoAtual() === 'leitura') renderizarLeitura()
  }

  async function definirTipo(tipo) {
    if (!nota || nota.tipo === tipo) return
    nota.tipo = tipo
    listaComoTexto = false
    clearTimeout(salvarTimer)
    await salvar()
    aplicarModo()
  }

  function alternarLinhaDoCorpo(indice) {
    const novo = Afazeres.alternarLinha(textoEl.value, indice)
    if (novo !== null) mudarCorpo(novo)
  }

  function itensDoCorpo() {
    return textoEl.value.split('\n').map((linha, i) => {
      const m = RE_TAREFA.exec(linha)
      if (m) return { i, tipo: 'item', texto: m[4], feito: m[2] !== ' ' }
      const s = RE_SECAO.exec(linha)
      if (s) return { i, tipo: 'secao', texto: s[1] }
      return { i, tipo: linha.trim() ? 'texto' : 'vazio', texto: linha }
    })
  }

  function sugestoesDeItens() {
    const atuais = new Set(itensDoCorpo().filter((x) => x.tipo === 'item' && !x.feito).map((x) => Links.normalizar(x.texto)))
    const vistos = new Map()
    for (const n of todasNotas) {
      if (n.tipo !== 'lista') continue
      for (const linha of (n.texto || '').split('\n')) {
        const m = RE_TAREFA.exec(linha)
        const t = m && m[4].trim()
        if (!t) continue
        const chave = Links.normalizar(t)
        if (!atuais.has(chave) && !vistos.has(chave)) vistos.set(chave, t)
      }
    }
    return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  function adicionarItens(textos) {
    const limpos = textos.map((t) => t.replace(/^\s*([-*+]\s(\[[ xX]\]\s)?)?/, '').trim()).filter(Boolean)
    if (limpos.length === 0) return
    const linhas = textoEl.value === '' ? [] : textoEl.value.split('\n')
    let repetidos = 0
    const novos = []
    for (const t of limpos) {
      const chave = Links.normalizar(t)
      const existente = linhas.findIndex((l) => {
        const m = RE_TAREFA.exec(l)
        return m && Links.normalizar(m[4]) === chave
      })
      if (existente >= 0) {
        const m = RE_TAREFA.exec(linhas[existente])
        if (m[2] !== ' ') linhas[existente] = `${m[1]} ${m[3]}${m[4]}`
        else repetidos++
        continue
      }
      novos.push(`- [ ] ${t}`)
    }
    let ultimo = -1
    linhas.forEach((l, i) => {
      if (RE_TAREFA.test(l) || RE_SECAO.test(l)) ultimo = i
    })
    if (ultimo === -1) {
      while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop()
      ultimo = linhas.length - 1
      linhas.push(...novos)
    } else {
      linhas.splice(ultimo + 1, 0, ...novos)
    }
    linhasAnimadas = new Set(novos.map((_, k) => ultimo + 1 + k))
    mudarCorpo(linhas.join('\n'))
    if (repetidos > 0) estado(repetidos === 1 ? 'Esse item já está na lista' : `${repetidos} itens já estavam na lista`, true)
  }

  function trocarLinha(indice, nova) {
    const linhas = textoEl.value.split('\n')
    if (nova === null) linhas.splice(indice, 1)
    else linhas[indice] = nova
    mudarCorpo(linhas.join('\n'))
  }

  function editarItem(li, item) {
    const span = li.querySelector('.lista-texto')
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'lista-editar'
    input.value = item.texto
    span.replaceWith(input)
    input.focus()
    input.select()
    let feito = false
    const concluir = (salvarEdicao) => {
      if (feito) return
      feito = true
      const t = input.value.trim()
      if (!salvarEdicao || t === item.texto.trim()) return renderizarLista()
      const m = RE_TAREFA.exec(textoEl.value.split('\n')[item.i])
      if (!m) return renderizarLista()
      trocarLinha(item.i, t ? `${m[1]}${m[2]}${m[3]}${t}` : null)
    }
    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') concluir(true)
      else if (e.key === 'Escape') concluir(false)
    })
    input.addEventListener('blur', () => concluir(true))
  }

  function moverItem(de, para) {
    if (de === para) return
    const linhas = textoEl.value.split('\n')
    const [linha] = linhas.splice(de, 1)
    linhas.splice(para > de ? para - 1 : para, 0, linha)
    mudarCorpo(linhas.join('\n'))
  }

  function criarLinhaItem(item) {
    const li = document.createElement('li')
    li.className = 'lista-item' + (item.feito ? ' feito' : '') + (linhasAnimadas.has(item.i) ? ' entrando' : '')
    li.dataset.linha = item.i

    const alca = Icones.criar('grip', 14)
    alca.classList.add('lista-alca')
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.checked = item.feito
    check.addEventListener('change', () => {
      linhasAnimadas = new Set([item.i])
      alternarLinhaDoCorpo(item.i)
    })
    const texto = document.createElement('span')
    texto.className = 'lista-texto'
    texto.innerHTML = Markdown.inline(item.texto)
    texto.title = 'Clique para editar'
    texto.addEventListener('click', (e) => {
      const externo = e.target.closest('a.externo')
      if (externo) return abrirNoNavegador(externo.dataset.url)
      editarItem(li, item)
    })
    const apagar = document.createElement('button')
    apagar.className = 'lista-apagar'
    apagar.title = 'Tirar da lista'
    apagar.appendChild(Icones.criar('fechar', 14))
    apagar.addEventListener('click', () => trocarLinha(item.i, null))

    li.append(alca, check, texto, apagar)
    if (!item.feito) {
      li.draggable = true
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/x-linha', String(item.i))
        e.dataTransfer.effectAllowed = 'move'
        li.classList.add('arrastando')
      })
      li.addEventListener('dragend', () => li.classList.remove('arrastando'))
      li.addEventListener('dragover', (e) => {
        if (!Array.from(e.dataTransfer.types).includes('text/x-linha')) return
        e.preventDefault()
        li.classList.add('alvo')
      })
      li.addEventListener('dragleave', () => li.classList.remove('alvo'))
      li.addEventListener('drop', (e) => {
        e.preventDefault()
        li.classList.remove('alvo')
        const de = Number(e.dataTransfer.getData('text/x-linha'))
        if (Number.isInteger(de)) moverItem(de, item.i)
      })
    }
    return li
  }

  function textoParaCopiar() {
    const saida = [tituloEl.value.trim() || 'Lista', '']
    let secaoPendente = null
    for (const x of itensDoCorpo()) {
      if (x.tipo === 'secao') secaoPendente = x.texto
      if (x.tipo !== 'item' || x.feito) continue
      if (secaoPendente !== null) {
        if (saida.length > 2) saida.push('')
        saida.push(`*${secaoPendente}*`)
        secaoPendente = null
      }
      saida.push(`• ${x.texto.trim()}`)
    }
    return saida.join('\n')
  }

  function renderizarLista() {
    const foco = document.activeElement && document.activeElement.classList.contains('lista-novo')
    const itens = itensDoCorpo()
    const todos = itens.filter((x) => x.tipo === 'item')
    const feitos = todos.filter((x) => x.feito)
    listaEl.replaceChildren()

    const add = document.createElement('form')
    add.className = 'lista-add'
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'lista-novo'
    input.placeholder = 'Adicionar item… (Enter)'
    input.setAttribute('list', 'lista-sugestoes')
    const datalist = document.createElement('datalist')
    datalist.id = 'lista-sugestoes'
    for (const t of sugestoesDeItens().slice(0, 300)) {
      const op = document.createElement('option')
      op.value = t
      datalist.appendChild(op)
    }
    const botao = document.createElement('button')
    botao.type = 'submit'
    botao.className = 'primario'
    botao.textContent = 'Adicionar'
    add.append(input, botao, datalist)
    add.addEventListener('submit', (e) => {
      e.preventDefault()
      const valor = input.value
      input.value = ''
      adicionarItens([valor])
      listaEl.querySelector('.lista-novo')?.focus()
    })
    input.addEventListener('paste', (e) => {
      const colado = e.clipboardData.getData('text')
      if (!colado.includes('\n')) return
      e.preventDefault()
      adicionarItens(colado.split(/\r?\n/))
      listaEl.querySelector('.lista-novo')?.focus()
    })

    const progresso = document.createElement('div')
    progresso.className = 'lista-progresso'
    const barra = document.createElement('div')
    barra.className = 'lista-barra'
    const cheio = document.createElement('span')
    const largura = todos.length ? `${(feitos.length / todos.length) * 100}%` : '0%'
    cheio.style.width = progressoAnterior.id === nota.id ? progressoAnterior.largura : largura
    if (cheio.style.width !== largura) requestAnimationFrame(() => requestAnimationFrame(() => (cheio.style.width = largura)))
    progressoAnterior = { id: nota.id, largura }
    barra.appendChild(cheio)
    const rotulo = document.createElement('small')
    rotulo.textContent = todos.length
      ? feitos.length === todos.length
        ? `Tudo pego! (${todos.length})`
        : `${feitos.length} de ${todos.length}`
      : 'Lista vazia'
    progresso.append(barra, rotulo)

    const ul = document.createElement('ul')
    ul.className = 'lista-itens'
    let secaoPendente = null
    for (const x of itens) {
      if (x.tipo === 'secao') {
        secaoPendente = x
      } else if (x.tipo === 'item' && !x.feito) {
        if (secaoPendente) {
          const h = document.createElement('li')
          h.className = 'lista-secao'
          h.textContent = secaoPendente.texto
          ul.appendChild(h)
          secaoPendente = null
        }
        ul.appendChild(criarLinhaItem(x))
      } else if (x.tipo === 'texto') {
        const li = document.createElement('li')
        li.className = 'lista-nota'
        li.innerHTML = Markdown.inline(x.texto)
        ul.appendChild(li)
      }
    }
    if (todos.length > 0 && todos.length === feitos.length) {
      const li = document.createElement('li')
      li.className = 'lista-nota'
      li.textContent = 'Tudo marcado. Use “Desmarcar tudo” para reaproveitar a lista.'
      ul.appendChild(li)
    }
    listaEl.append(add, progresso, ul)

    if (feitos.length > 0) {
      const det = document.createElement('details')
      det.className = 'lista-feitos'
      det.open = localStorage.getItem('listaFeitosAberta') !== '0'
      det.addEventListener('toggle', () => localStorage.setItem('listaFeitosAberta', det.open ? '1' : '0'))
      const sum = document.createElement('summary')
      sum.textContent = `Marcados (${feitos.length})`
      const ulf = document.createElement('ul')
      ulf.className = 'lista-itens'
      for (const x of feitos) ulf.appendChild(criarLinhaItem(x))
      det.append(sum, ulf)
      listaEl.appendChild(det)
    }

    const acoes = document.createElement('div')
    acoes.className = 'lista-acoes'
    const acao = (rotuloBotao, dica, desativado, aoClicar) => {
      const b = document.createElement('button')
      b.textContent = rotuloBotao
      b.title = dica
      b.disabled = desativado
      b.addEventListener('click', aoClicar)
      acoes.appendChild(b)
    }
    acao('Desmarcar tudo', 'Desmarca todos os itens, para usar a lista de novo na próxima compra', feitos.length === 0, () =>
      mudarCorpo(textoEl.value.split('\n').map((l) => l.replace(/^(\s*[-*+]\s\[)[xX](\])/, '$1 $2')).join('\n'))
    )
    acao('Limpar marcados', 'Tira da lista os itens marcados', feitos.length === 0, () => {
      if (!confirm(`Tirar ${feitos.length} ${feitos.length === 1 ? 'item marcado' : 'itens marcados'} da lista?`)) return
      mudarCorpo(textoEl.value.split('\n').filter((l) => !/^\s*[-*+]\s\[[xX]\]/.test(l)).join('\n'))
    })
    acao('Copiar lista', 'Copia o que falta pegar (para mandar no WhatsApp, por exemplo)', todos.length === feitos.length, async () => {
      await window.api.copiarTexto(textoParaCopiar())
      estado('Lista copiada', true)
    })
    listaEl.appendChild(acoes)
    if (foco) listaEl.querySelector('.lista-novo')?.focus()
  }

  function iniciarLista() {
  }

  let buscaAberta = false
  let diferenciarCaixa = false
  let achados = []
  let achadoAtual = -1

  function abrirBusca(substituir = false) {
    if (!nota) return
    lendo = false
    if (modoAtual() !== 'texto') {
      listaComoTexto = true
      aplicarModo()
    }
    const selecao = textoEl.value.slice(textoEl.selectionStart, textoEl.selectionEnd)
    if (selecao && !selecao.includes('\n') && document.activeElement === textoEl) buscaTermoEl.value = selecao
    buscaAberta = true
    buscaEl.hidden = false
    buscaLinhaSubstEl.hidden = !substituir
    const alvo = substituir && buscaTermoEl.value ? buscaSubstEl : buscaTermoEl
    alvo.focus()
    alvo.select()
    recalcularBusca()
  }

  function fecharBusca(focarTexto = true) {
    if (!buscaAberta) return
    buscaAberta = false
    buscaEl.hidden = true
    const a = achados[achadoAtual]
    achados = []
    desenharRealce()
    if (nota && nota.tipo === 'lista' && listaComoTexto) {
      listaComoTexto = false
      aplicarModo()
      return
    }
    if (focarTexto && modoAtual() === 'texto') {
      textoEl.focus()
      if (a) textoEl.setSelectionRange(a.a, a.b)
    }
  }

  function regexDaBusca() {
    const termo = buscaTermoEl.value
    if (!termo) return null
    return new RegExp(escapar(termo), diferenciarCaixa ? 'g' : 'gi')
  }

  function recalcularBusca(manterPosicao = false) {
    const re = regexDaBusca()
    const anterior = achados[achadoAtual]
    achados = []
    if (re) for (const m of textoEl.value.matchAll(re)) achados.push({ a: m.index, b: m.index + m[0].length })
    if (achados.length === 0) achadoAtual = -1
    else if (manterPosicao && anterior) {
      achadoAtual = Math.max(0, achados.findIndex((x) => x.a >= anterior.a))
    } else {
      const cursor = anterior ? anterior.a : textoEl.selectionStart
      const i = achados.findIndex((x) => x.a >= cursor)
      achadoAtual = i === -1 ? 0 : i
    }
    desenharRealce(!manterPosicao)
  }

  const LIMITE_REALCE = 80000
  const F = { marca: 1, negrito: 2, titulo: 4, riscado: 8, codigo: 16, link: 32, tag: 64, suave: 128, achado: 256, atual: 512, caixa: 1024 }
  const NOMES_F = Object.entries(F)

  function decorar(valor) {
    const f = new Uint16Array(valor.length)
    const pintar = (a, b, bit) => {
      for (let i = a; i < b; i++) f[i] |= bit
    }
    let pos = 0
    let emCodigo = false
    for (const linha of valor.split('\n')) {
      const ini = pos
      const fimLinha = ini + linha.length
      pos = fimLinha + 1
      if (/^\s*```/.test(linha)) {
        emCodigo = !emCodigo
        pintar(ini, fimLinha, F.codigo | F.suave)
        continue
      }
      if (emCodigo) {
        pintar(ini, fimLinha, F.codigo)
        continue
      }
      let corpo = ini
      let m
      if ((m = /^#{1,6}\s+/.exec(linha))) {
        corpo = ini + m[0].length
        pintar(ini, corpo, F.marca)
        pintar(corpo, fimLinha, F.titulo)
      } else if ((m = /^(\s*[-*+]\s)\[([ xX])\]/.exec(linha))) {
        const b = ini + m[1].length
        pintar(ini, b, F.marca)
        pintar(b, b + 3, F.caixa)
        corpo = b + 3
        if (m[2] !== ' ') pintar(corpo, fimLinha, F.riscado | F.suave)
      } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linha)) {
        pintar(ini, fimLinha, F.marca)
        continue
      } else if ((m = /^(\s*)([-*+]|\d+[.)])\s/.exec(linha))) {
        pintar(ini + m[1].length, ini + m[0].length, F.marca)
        corpo = ini + m[0].length
      } else if ((m = /^\s*>\s?/.exec(linha))) {
        pintar(ini, ini + m[0].length, F.marca)
        pintar(ini + m[0].length, fimLinha, F.suave)
      }
      const resto = valor.slice(corpo, fimLinha)
      const regra = (re, fn) => {
        for (const x of resto.matchAll(re)) fn(corpo + x.index, x)
      }
      const envolto = (n, bit) => (a, x) => {
        const b = a + x[0].length
        pintar(a, a + n, F.marca)
        pintar(b - n, b, F.marca)
        pintar(a + n, b - n, bit)
      }
      regra(/`[^`\n]+`/g, (a, x) => pintar(a, a + x[0].length, F.codigo))
      regra(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, envolto(2, F.negrito))
      regra(/(?<![*\w])\*(?![*\s])([^*\n]+?)(?<=\S)\*(?!\*)/g, envolto(1, 0))
      regra(/~~(?=\S)(.+?)(?<=\S)~~/g, envolto(2, F.riscado))
      regra(/\[\[[^\]\n]+\]\]/g, envolto(2, F.link))
      regra(/https?:\/\/[^\s)>\]]+/g, (a, x) => pintar(a, a + x[0].length, F.link))
      regra(/(^|\s)(#[\p{L}\p{N}_\-/]+)/gu, (a, x) => pintar(a + x[1].length, a + x[0].length, F.tag))
    }
    return f
  }

  function classesDe(bits) {
    return NOMES_F.filter(([, b]) => bits & b)
      .map(([n]) => `md-${n}`)
      .join(' ')
  }

  function desenharRealce(rolar = false) {
    const valor = textoEl.value
    const vivo = valor.length <= LIMITE_REALCE
    caixaTextoEl.classList.toggle('realce-vivo', vivo)
    if (!vivo && achados.length === 0) {
      realceEl.replaceChildren()
      return
    }
    const f = vivo ? decorar(valor) : new Uint16Array(valor.length)
    achados.forEach((x, i) => {
      const bit = i === achadoAtual ? F.achado | F.atual : F.achado
      for (let k = x.a; k < x.b; k++) f[k] |= bit
    })
    const frag = document.createDocumentFragment()
    let i = 0
    while (i < valor.length) {
      let j = i + 1
      while (j < valor.length && f[j] === f[i]) j++
      const pedaco = valor.slice(i, j)
      if (f[i] === 0) frag.appendChild(document.createTextNode(pedaco))
      else {
        const el = document.createElement(f[i] & F.achado ? 'mark' : 'span')
        el.className = classesDe(f[i])
        el.textContent = pedaco
        frag.appendChild(el)
      }
      i = j
    }
    frag.appendChild(document.createTextNode('\n'))
    realceEl.replaceChildren(frag)
    if (!buscaAberta) return
    const termo = buscaTermoEl.value
    buscaContadorEl.textContent = !termo ? '' : achados.length === 0 ? 'Nada' : `${achadoAtual + 1} de ${achados.length}`
    buscaContadorEl.classList.toggle('nada', Boolean(termo) && achados.length === 0)
    const atual = realceEl.querySelector('.md-atual')
    if (rolar && atual) {
      const r = atual.getBoundingClientRect()
      const c = corpoEl.getBoundingClientRect()
      if (r.top < c.top + 60 || r.bottom > c.bottom - 20) {
        corpoEl.scrollTop += r.top - c.top - corpoEl.clientHeight / 3
      }
    }
  }

  function irParaAchado(delta) {
    if (achados.length === 0) return
    achadoAtual = (achadoAtual + delta + achados.length) % achados.length
    const a = achados[achadoAtual]
    textoEl.setSelectionRange(a.a, a.b)
    desenharRealce(true)
  }

  function substituirAtual() {
    const a = achados[achadoAtual]
    if (!a) return
    const foco = document.activeElement
    textoEl.setSelectionRange(a.a, a.b)
    inserir(buscaSubstEl.value)
    const depois = a.a + buscaSubstEl.value.length
    textoEl.setSelectionRange(depois, depois)
    achados = []
    recalcularBusca()
    if (foco && foco !== textoEl) foco.focus()
  }

  function substituirTodos() {
    const re = regexDaBusca()
    if (!re || achados.length === 0) return
    const total = achados.length
    const subst = buscaSubstEl.value
    const novo = textoEl.value.replace(re, () => subst)
    const foco = document.activeElement
    textoEl.focus()
    textoEl.setSelectionRange(0, textoEl.value.length)
    inserir(novo)
    achados = []
    recalcularBusca()
    if (foco && foco !== textoEl) foco.focus()
    estado(`${total} ${total === 1 ? 'troca feita' : 'trocas feitas'}`, true)
  }

  function iniciarBusca() {
    buscaTermoEl.addEventListener('input', () => {
      achados = []
      achadoAtual = -1
      recalcularBusca()
    })
    const teclas = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        fecharBusca()
      } else if (e.key === 'Enter' && e.target === buscaTermoEl) {
        e.preventDefault()
        irParaAchado(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Enter' && e.target === buscaSubstEl) {
        e.preventDefault()
        if (e.ctrlKey || e.altKey) substituirTodos()
        else substituirAtual()
      } else if (e.key === 'F3') {
        e.preventDefault()
        irParaAchado(e.shiftKey ? -1 : 1)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        buscaLinhaSubstEl.hidden = false
        buscaSubstEl.focus()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        buscaTermoEl.focus()
        buscaTermoEl.select()
      }
      e.stopPropagation()
    }
    buscaTermoEl.addEventListener('keydown', teclas)
    buscaSubstEl.addEventListener('keydown', teclas)
    document.getElementById('busca-prox').addEventListener('click', () => irParaAchado(1))
    document.getElementById('busca-ant').addEventListener('click', () => irParaAchado(-1))
    document.getElementById('busca-fechar').addEventListener('click', () => fecharBusca())
    document.getElementById('busca-um').addEventListener('click', substituirAtual)
    document.getElementById('busca-todos').addEventListener('click', substituirTodos)
    document.getElementById('busca-alternar').addEventListener('click', () => {
      buscaLinhaSubstEl.hidden = !buscaLinhaSubstEl.hidden
      if (!buscaLinhaSubstEl.hidden) buscaSubstEl.focus()
    })
    buscaCaixaEl.addEventListener('click', () => {
      diferenciarCaixa = !diferenciarCaixa
      buscaCaixaEl.classList.toggle('ativo', diferenciarCaixa)
      achados = []
      recalcularBusca()
    })
    textoEl.addEventListener('keydown', (e) => {
      if (!buscaAberta) return
      if (e.key === 'Escape') {
        fecharBusca()
      } else if (e.key === 'F3') {
        e.preventDefault()
        irParaAchado(e.shiftKey ? -1 : 1)
      }
    })
  }

  function iniciar(opcoes) {
    cb = { ...cb, ...opcoes }
    autoLigarEl.checked = autoLigar

    autoLigarEl.addEventListener('change', () => {
      autoLigar = autoLigarEl.checked
      try {
        localStorage.setItem('autoLigar', autoLigar ? '1' : '0')
      } catch {
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
        const modo = modoAtual()
        if (modo === 'lista') listaEl.querySelector('.lista-novo')?.focus()
        else {
          textoEl.focus()
          textoEl.setSelectionRange(0, 0)
        }
      }
    })

    textoEl.addEventListener('input', () => {
      ajustarAltura()
      atualizarContagem()
      agendarSalvar()
      agendarRelacionados()
      atualizarSugestoes()
      if (buscaAberta) recalcularBusca(true)
    })
    textoEl.addEventListener('blur', fecharSugestoes)

    textoEl.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || !nota) return
      const pos = textoEl.selectionStart
      if (pos !== textoEl.selectionEnd) return
      const { inicio, fim } = limitesDaLinha(pos)
      const m = /^(\s*[-*+]\s)\[[ xX]\]/.exec(textoEl.value.slice(inicio, fim))
      if (!m) return
      const a = inicio + m[1].length
      if (pos <= a || pos >= a + 3) return
      alternarTarefaDaLinha()
      textoEl.setSelectionRange(pos, pos)
    })

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
    btnLer.addEventListener('click', () => alternarLeitura())
    leituraEl.addEventListener('click', cliqueNaLeitura)
    leituraEl.addEventListener('dblclick', (e) => {
      if (!e.target.closest('a, input, .mermaid-bloco, .math, .math-bloco')) alternarLeitura(false)
    })
    iniciarLista()
    iniciarBusca()
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
    tipoAtual: () => (nota ? nota.tipo : null),
    abrirBusca,
    alternarLeitura,
    definirTipo,
    tituloAtual: () => Links.titulo(montarTexto()),
    textoAtual: () => (nota ? montarTexto() : null),
  }
})()