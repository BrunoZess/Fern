// Quadro (canvas) estilo Miro: post-its, imagens e notas, ligações com âncoras e desenho à mão livre.
// Câmera com pan e zoom; cartões são elementos HTML dentro de um "mundo" transformado,
// e conexões e traços são SVG nas mesmas coordenadas (por isso ficam nítidos em qualquer zoom).
const Quadro = (() => {
  const NS = 'http://www.w3.org/2000/svg'
  const LARGURA = 220
  const LARGURA_MIN = 60
  const ZOOM_MIN = 0.05
  const ZOOM_MAX = 24
  const CORES = ['amarelo', 'rosa', 'verde', 'azul', 'roxo', 'branco']
  const HEX_COR = {
    amarelo: '#fde68a',
    rosa: '#fbcfe8',
    verde: '#bbf7d0',
    azul: '#bfdbfe',
    roxo: '#ddd6fe',
    branco: '#ffffff',
  }
  const COR_LINHA = {
    cinza: '#8b8b93',
    azul: '#3b82f6',
    vermelho: '#ef4444',
    verde: '#10b981',
    laranja: '#f59e0b',
    roxo: '#8b5cf6',
  }
  const CORES_TINTA = ['#111827', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
  const TINTA = {
    caneta: { fator: 1, opacidade: 1, ponta: 'round' },
    lapis: { fator: 0.6, opacidade: 0.85, ponta: 'round' },
    marcatexto: { fator: 4, opacidade: 0.35, ponta: 'butt' },
  }
  const OPOSTO = { t: 'b', b: 't', l: 'r', r: 'l' }

  const area = document.getElementById('quadro-area')
  const mundo = document.getElementById('quadro-mundo')
  const camadaLinhas = document.getElementById('quadro-linhas')
  const camadaRascunho = document.getElementById('quadro-rascunho')
  const camadaCartoes = document.getElementById('quadro-cartoes')
  const camadaTracos = document.getElementById('quadro-tracos')
  const defs = document.getElementById('quadro-defs')
  const tituloEl = document.getElementById('quadro-titulo')
  const dicaEl = document.getElementById('quadro-dica')
  const btnConectar = document.getElementById('quadro-conectar')
  const btnDesenhar = document.getElementById('quadro-desenhar')
  const painelDesenho = document.getElementById('quadro-desenho')
  const tamanhoEl = document.getElementById('quadro-tamanho')
  const zoomEl = document.getElementById('quadro-zoom-pct')
  const paleta = document.getElementById('quadro-paleta')
  const seletor = document.getElementById('quadro-seletor')
  const seletorBusca = document.getElementById('quadro-seletor-busca')
  const seletorLista = document.getElementById('quadro-seletor-lista')

  let quadro = null
  let cartoes = [] // { id, tipo: 'texto' | 'nota' | 'imagem', nota_id, texto, x, y, cor, largura }
  let conexoes = [] // { id, de_id, para_id, de_lado, para_lado, forma, estilo, seta, cor }
  let tracos = [] // { id, ferramenta, cor, espessura, pontos: [x, y, x, y...], el }
  const elementos = new Map() // id do cartão -> elemento HTML
  let notasPorId = new Map()
  let todasNotas = []
  let selCartoes = new Set()
  let selConexao = null
  let modoConectar = false
  let origem = null
  let corAtual = 'amarelo'
  let modoDesenho = false // false | 'caneta' | 'lapis' | 'marcatexto' | 'borracha'
  let corTinta = '#3b82f6'
  let tamanhoTinta = 3
  const pilhaTracos = [] // ids dos traços criados nesta sessão (para o Ctrl+Z)
  let camX = 0
  let camY = 0
  let zoom = 1
  let visivel = false
  let arrasto = null
  let espaco = false
  let abrirNota = () => {}
  let ultimoPonteiro = null
  let colarEmLinhas = false
  let colarPendente = false
  let topoZ = 1
  let baixoZ = 0
  let avisoTimer = null
  let salvarTimer = null
  const pendentes = new Set()

  // ---------- Carregar ----------

  function lerPontos(texto) {
    try {
      const p = JSON.parse(texto)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }

  async function carregar(id, ajustar) {
    const [dados, notas] = await Promise.all([
      window.api.carregarQuadro(id),
      window.api.listarNotas(),
    ])
    todasNotas = notas
    notasPorId = new Map(notas.map((n) => [n.id, n]))
    if (!dados) {
      quadro = null
      cartoes = []
      conexoes = []
      tracos = []
    } else {
      quadro = dados.quadro
      cartoes = dados.cartoes
      conexoes = dados.conexoes
      tracos = dados.tracos.map((t) => ({ ...t, pontos: lerPontos(t.pontos) }))
    }
    desenharTudo()
    if (ajustar) ajustarATela()
  }

  async function abrir(id) {
    selCartoes = new Set()
    selConexao = null
    modoConectar = false
    origem = null
    btnConectar.classList.remove('ativo')
    area.classList.remove('modo-conectar')
    definirModoDesenho(false)
    pilhaTracos.length = 0
    await carregar(id, true)
  }

  // Recarrega sem mexer na câmera. Não interrompe edição, arrasto nem desenho.
  async function recarregar() {
    if (!quadro || arrasto) return
    const ativo = document.activeElement
    if (ativo && ativo.isContentEditable) return
    await carregar(quadro.id, false)
  }

  // ---------- Cartões ----------

  function previa(texto) {
    const linhas = texto.split('\n')
    const inicio = linhas.findIndex((l) => l.trim())
    const resto = linhas.slice(inicio + 1).join('\n').trim()
    return resto.length > 140 ? resto.slice(0, 140) + '…' : resto
  }

  function criarElementoCartao(c) {
    const el = document.createElement('div')
    el.dataset.id = c.id
    el.style.left = c.x + 'px'
    el.style.top = c.y + 'px'
    el.style.width = `${c.largura || LARGURA}px`

    if (c.tipo === 'imagem') {
      el.className = 'cartao imagem'
      const img = document.createElement('img')
      img.alt = ''
      img.draggable = false
      img.addEventListener('load', () => desenharConexoes())
      img.src = c.texto
      el.appendChild(img)
    } else if (c.tipo === 'nota') {
      const corpo = document.createElement('div')
      corpo.className = 'corpo'
      const nota = notasPorId.get(c.nota_id)
      el.className = 'cartao nota' + (nota ? ' tipo-' + nota.tipo : '')
      if (nota) {
        const titulo = document.createElement('div')
        titulo.className = 'titulo'
        titulo.textContent = Links.titulo(nota.texto) || '(sem título)'
        corpo.textContent = previa(nota.texto)
        const abrirBotao = document.createElement('button')
        abrirBotao.className = 'abrir'
        abrirBotao.textContent = '↗'
        abrirBotao.title = 'Abrir a nota'
        abrirBotao.addEventListener('click', () => abrirNota(nota.id))
        el.append(abrirBotao, titulo, corpo)
      } else {
        corpo.textContent = '(nota removida)'
        el.appendChild(corpo)
      }
    } else {
      const corpo = document.createElement('div')
      corpo.className = 'corpo'
      el.className = `cartao texto cor-${c.cor}`
      corpo.textContent = c.texto
      el.appendChild(corpo)
    }

    // Pontos de onde dá pra puxar uma seta (aparecem ao passar o mouse)
    for (const lado of ['t', 'r', 'b', 'l']) {
      const ancora = document.createElement('span')
      ancora.className = 'ancora'
      ancora.dataset.lado = lado
      el.appendChild(ancora)
    }

    elementos.set(c.id, el)
    camadaCartoes.appendChild(el)
  }

  function desenharTudo() {
    camadaCartoes.replaceChildren()
    elementos.clear()
    for (const c of cartoes) criarElementoCartao(c)
    camadaTracos.replaceChildren()
    for (const t of tracos) criarElementoTraco(t)
    selCartoes = new Set([...selCartoes].filter((id) => elementos.has(id)))
    if (selConexao !== null && !conexoes.some((k) => k.id === selConexao)) selConexao = null
    atualizarSelecaoVisual()
    marcarOrigem()
    atualizarTitulo()
    atualizarDica()
  }

  function atualizarTitulo() {
    tituloEl.textContent = quadro ? quadro.nome : 'Quadro não encontrado'
  }

  function atualizarDica() {
    if (modoConectar) {
      dicaEl.textContent = origem
        ? 'Clique no cartão de destino (Esc cancela)'
        : 'Clique no cartão de origem (Esc cancela)'
    } else if (cartoes.length === 0 && tracos.length === 0) {
      dicaEl.textContent = 'Duplo clique cria um post-it · Ctrl+V cola texto ou imagem'
    } else {
      dicaEl.textContent = ''
    }
  }

  function aviso(texto) {
    dicaEl.textContent = texto
    clearTimeout(avisoTimer)
    avisoTimer = setTimeout(atualizarDica, 2200)
  }

  // ---------- Geometria das conexões ----------

  function centroDe(c) {
    const el = elementos.get(c.id)
    return { x: c.x + el.offsetWidth / 2, y: c.y + el.offsetHeight / 2 }
  }

  // Ponto onde a reta do centro até (tx, ty) cruza a borda do retângulo
  function pontoNaBorda(cx, cy, metadeL, metadeA, tx, ty) {
    const dx = tx - cx
    const dy = ty - cy
    const escala = Math.min(metadeL / (Math.abs(dx) || 1e-9), metadeA / (Math.abs(dy) || 1e-9))
    return { x: cx + dx * escala, y: cy + dy * escala }
  }

  // Ponto de ligação de um lado do cartão (t, r, b, l) ou, em "auto", a borda voltada para o alvo.
  // nx, ny = direção para fora do cartão.
  function pontoDeLado(c, lado, alvo) {
    const el = elementos.get(c.id)
    const w = el.offsetWidth
    const h = el.offsetHeight
    const cx = c.x + w / 2
    const cy = c.y + h / 2
    if (lado === 't') return { x: cx, y: c.y, nx: 0, ny: -1 }
    if (lado === 'b') return { x: cx, y: c.y + h, nx: 0, ny: 1 }
    if (lado === 'l') return { x: c.x, y: cy, nx: -1, ny: 0 }
    if (lado === 'r') return { x: c.x + w, y: cy, nx: 1, ny: 0 }
    const p = pontoNaBorda(cx, cy, w / 2, h / 2, alvo.x, alvo.y)
    const horizontal = Math.abs(p.x - cx) / (w / 2) >= Math.abs(p.y - cy) / (h / 2)
    return horizontal
      ? { x: p.x, y: p.y, nx: Math.sign(p.x - cx) || 1, ny: 0 }
      : { x: p.x, y: p.y, nx: 0, ny: Math.sign(p.y - cy) || 1 }
  }

  function ladoMaisProximo(c, p) {
    let melhor = 't'
    let menor = Infinity
    for (const lado of ['t', 'r', 'b', 'l']) {
      const q = pontoDeLado(c, lado, p)
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < menor) {
        menor = d
        melhor = lado
      }
    }
    return melhor
  }

  function caminhoDaConexao(forma, p1, p2) {
    if (forma === 'reta') return `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`
    if (forma === 'angular') {
      const g = 26
      const a = { x: p1.x + p1.nx * g, y: p1.y + p1.ny * g }
      const b = { x: p2.x + p2.nx * g, y: p2.y + p2.ny * g }
      const meioX = (a.x + b.x) / 2
      const meioY = (a.y + b.y) / 2
      const pontos =
        p1.nx !== 0
          ? [p1, a, { x: meioX, y: a.y }, { x: meioX, y: b.y }, b, p2]
          : [p1, a, { x: a.x, y: meioY }, { x: b.x, y: meioY }, b, p2]
      return 'M' + pontos.map((q) => `${q.x} ${q.y}`).join(' L')
    }
    const d = Math.min(220, Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.4))
    return `M${p1.x} ${p1.y} C${p1.x + p1.nx * d} ${p1.y + p1.ny * d} ${p2.x + p2.nx * d} ${p2.y + p2.ny * d} ${p2.x} ${p2.y}`
  }

  function construirMarcadores() {
    for (const [nome, hex] of Object.entries(COR_LINHA)) {
      const m = document.createElementNS(NS, 'marker')
      m.setAttribute('id', `quadro-seta-${nome}`)
      m.setAttribute('viewBox', '0 0 10 10')
      m.setAttribute('refX', '9')
      m.setAttribute('refY', '5')
      m.setAttribute('markerWidth', '6')
      m.setAttribute('markerHeight', '6')
      m.setAttribute('orient', 'auto-start-reverse')
      const p = document.createElementNS(NS, 'path')
      p.setAttribute('d', 'M0 0L10 5L0 10z')
      p.setAttribute('fill', hex)
      m.appendChild(p)
      defs.appendChild(m)
    }
  }

  function criarCaminho(classe, d) {
    const p = document.createElementNS(NS, 'path')
    p.setAttribute('class', classe)
    p.setAttribute('d', d)
    return p
  }

  function desenharConexoes() {
    camadaLinhas.replaceChildren()
    const porId = new Map(cartoes.map((c) => [c.id, c]))

    for (const k of conexoes) {
      const a = porId.get(k.de_id)
      const b = porId.get(k.para_id)
      if (!a || !b || !elementos.has(a.id) || !elementos.has(b.id)) continue

      const ca = centroDe(a)
      const cb = centroDe(b)
      if (k.de_lado === 'auto' && k.para_lado === 'auto' && Math.hypot(cb.x - ca.x, cb.y - ca.y) < 1) continue

      const p1 = pontoDeLado(a, k.de_lado, cb)
      const p2 = pontoDeLado(b, k.para_lado, ca)
      const d = caminhoDaConexao(k.forma, p1, p2)
      const sel = selConexao === k.id
      const cor = COR_LINHA[k.cor] ? k.cor : 'cinza'

      const grupo = document.createElementNS(NS, 'g')
      grupo.setAttribute('class', 'conexao-grupo' + (sel ? ' selecionado' : ''))
      grupo.dataset.id = k.id

      grupo.appendChild(criarCaminho('hit', d))
      if (sel) grupo.appendChild(criarCaminho('halo', d))

      const linha = criarCaminho('linha', d)
      linha.style.stroke = COR_LINHA[cor]
      linha.style.strokeWidth = '2'
      if (k.estilo === 'tracejado') linha.style.strokeDasharray = '8 6'
      if (k.estilo === 'pontilhado') linha.style.strokeDasharray = '1 6'
      if (k.seta === 'fim' || k.seta === 'ambos') linha.setAttribute('marker-end', `url(#quadro-seta-${cor})`)
      if (k.seta === 'inicio' || k.seta === 'ambos') linha.setAttribute('marker-start', `url(#quadro-seta-${cor})`)
      grupo.appendChild(linha)

      camadaLinhas.appendChild(grupo)
    }
  }

  // ---------- Seleção ----------

  function atualizarAlcas() {
    for (const el of camadaCartoes.querySelectorAll('.alca-redim')) el.remove()
    if (selCartoes.size !== 1) return
    const el = elementos.get([...selCartoes][0])
    if (!el || el.classList.contains('cartao-editando')) return
    for (const canto of ['nw', 'ne', 'sw', 'se']) {
      const alca = document.createElement('span')
      alca.className = `alca-redim ${canto}`
      alca.dataset.canto = canto
      el.appendChild(alca)
    }
  }

  function atualizarSelecaoVisual() {
    for (const [id, el] of elementos) el.classList.toggle('selecionado', selCartoes.has(id))
    atualizarAlcas()
    desenharConexoes()
  }

  function limparSelecao() {
    selCartoes = new Set()
    selConexao = null
    atualizarSelecaoVisual()
  }

  function selecionarCartoes(ids) {
    selCartoes = new Set(ids)
    selConexao = null
    atualizarSelecaoVisual()
  }

  function selecionarConexao(id) {
    selCartoes = new Set()
    selConexao = id
    atualizarSelecaoVisual()
  }

  function cartoesSelecionados() {
    return cartoes.filter((c) => selCartoes.has(c.id))
  }

  function marcarOrigem() {
    for (const [id, el] of elementos) el.classList.toggle('origem', origem === id)
  }

  function alternarConectar(forcar) {
    modoConectar = typeof forcar === 'boolean' ? forcar : !modoConectar
    origem = null
    btnConectar.classList.toggle('ativo', modoConectar)
    area.classList.toggle('modo-conectar', modoConectar)
    if (modoConectar) definirModoDesenho(false)
    marcarOrigem()
    atualizarDica()
  }

  async function criarLigacao(de, deLado, para, paraLado) {
    const k = await window.api.criarConexao(quadro.id, de, para, deLado, paraLado)
    if (k) {
      conexoes.push(k)
      selecionarConexao(k.id)
    }
  }

  async function tratarCliqueConectar(c) {
    if (!origem) {
      origem = c.id
    } else if (origem === c.id) {
      origem = null
    } else {
      const de = origem
      origem = null
      await criarLigacao(de, 'auto', c.id, 'auto')
    }
    marcarOrigem()
    atualizarDica()
  }

  async function removerSelecao() {
    if (selConexao !== null) {
      const id = selConexao
      await window.api.removerConexao(id)
      conexoes = conexoes.filter((k) => k.id !== id)
      selConexao = null
      desenharConexoes()
      return
    }
    const ids = new Set(selCartoes)
    if (ids.size === 0) return
    for (const id of ids) {
      await window.api.removerCartao(id)
      elementos.get(id)?.remove()
      elementos.delete(id)
    }
    cartoes = cartoes.filter((c) => !ids.has(c.id))
    conexoes = conexoes.filter((k) => !ids.has(k.de_id) && !ids.has(k.para_id))
    selCartoes = new Set()
    atualizarAlcas()
    desenharConexoes()
    atualizarDica()
  }

  // ---------- Posições ----------

  function salvarPosicoes(lista) {
    return Promise.all(lista.map((c) => window.api.moverCartao(c.id, c.x, c.y)))
  }

  function agendarSalvar(lista) {
    for (const c of lista) pendentes.add(c.id)
    clearTimeout(salvarTimer)
    salvarTimer = setTimeout(async () => {
      const alvo = cartoes.filter((c) => pendentes.has(c.id))
      pendentes.clear()
      await salvarPosicoes(alvo)
    }, 400)
  }

  function posicionar(c, x, y) {
    c.x = x
    c.y = y
    const el = elementos.get(c.id)
    el.style.left = x + 'px'
    el.style.top = y + 'px'
  }

  function moverSelecaoPor(dx, dy) {
    const alvo = cartoesSelecionados()
    for (const c of alvo) posicionar(c, c.x + dx, c.y + dy)
    desenharConexoes()
    agendarSalvar(alvo)
  }

  async function organizarEmGrade() {
    const alvo = selCartoes.size > 1 ? cartoesSelecionados() : [...cartoes]
    if (alvo.length < 2) return
    const ordenados = [...alvo].sort((a, b) => Math.round(a.y / 80) - Math.round(b.y / 80) || a.x - b.x)
    const colunas = Math.max(1, Math.ceil(Math.sqrt(ordenados.length)))
    const minX = Math.min(...alvo.map((c) => c.x))
    const minY = Math.min(...alvo.map((c) => c.y))

    let y = minY
    for (let i = 0; i < ordenados.length; i += colunas) {
      let x = minX
      let altura = 0
      for (const c of ordenados.slice(i, i + colunas)) {
        const el = elementos.get(c.id)
        posicionar(c, x, y)
        x += el.offsetWidth + 24
        altura = Math.max(altura, el.offsetHeight)
      }
      y += altura + 24
    }
    desenharConexoes()
    await salvarPosicoes(alvo)
    aviso('Organizado em grade')
  }

  // ---------- Criar cartões ----------

  function centroDoMundo() {
    return { x: (area.clientWidth / 2 - camX) / zoom, y: (area.clientHeight / 2 - camY) / zoom }
  }

  function pertoDoCentro() {
    const c = centroDoMundo()
    const sorteio = () => (Math.random() - 0.5) * 40
    return { x: c.x - LARGURA / 2 + sorteio(), y: c.y - 40 + sorteio() }
  }

  function posicaoParaColar() {
    if (ultimoPonteiro) return { x: ultimoPonteiro.x - LARGURA / 2, y: ultimoPonteiro.y - 30 }
    return pertoDoCentro()
  }

  function adicionarCartaoLocal(c) {
    cartoes.push(c)
    criarElementoCartao(c)
    atualizarDica()
  }

  async function criarPostit(x, y) {
    if (!quadro) return
    const c = await window.api.criarCartao(quadro.id, 'texto', null, '', x, y, corAtual, LARGURA)
    if (!c) return
    adicionarCartaoLocal(c)
    selecionarCartoes([c.id])
    iniciarEdicao(elementos.get(c.id), c)
  }

  async function adicionarNota(nota) {
    if (!quadro) return
    const pos = pertoDoCentro()
    const c = await window.api.criarCartao(quadro.id, 'nota', nota.id, '', pos.x, pos.y, 'branco', LARGURA)
    if (!c) return
    adicionarCartaoLocal(c)
    selecionarCartoes([c.id])
  }

  async function duplicarSelecao() {
    const originais = cartoesSelecionados().filter((c) => c.tipo !== 'nota')
    if (originais.length === 0) {
      aviso('Só post-its e imagens podem ser duplicados')
      return
    }
    const novos = []
    for (const c of originais) {
      const copia = await window.api.criarCartao(quadro.id, c.tipo, null, c.texto, c.x + 30, c.y + 30, c.cor, c.largura)
      if (copia) {
        adicionarCartaoLocal(copia)
        novos.push(copia.id)
      }
    }
    selecionarCartoes(novos)
    aviso(novos.length === 1 ? 'Duplicado' : `${novos.length} duplicados`)
  }

  // ---------- Área de transferência ----------

  function textoDoCartao(c) {
    if (c.tipo === 'nota') return notasPorId.get(c.nota_id)?.texto || ''
    if (c.tipo === 'texto') return c.texto
    return ''
  }

  async function copiarSelecao() {
    const escolhidos = cartoesSelecionados()
    if (escolhidos.length === 0) {
      aviso('Nada selecionado para copiar')
      return
    }
    try {
      if (escolhidos.length === 1 && escolhidos[0].tipo === 'imagem') {
        await window.api.copiarImagem(escolhidos[0].texto)
        aviso('Imagem copiada')
        return
      }
      const partes = escolhidos.map(textoDoCartao).filter((t) => t.trim())
      if (partes.length === 0) {
        aviso('Nada de texto para copiar')
        return
      }
      await window.api.copiarTexto(partes.join('\n\n'))
      aviso(partes.length === 1 ? 'Texto copiado' : `${partes.length} cartões copiados`)
    } catch {
      aviso('Não consegui copiar')
    }
  }

  function rotuloDoCartao(c) {
    if (c.tipo === 'imagem') return '[imagem]'
    if (c.tipo === 'nota') {
      const nota = notasPorId.get(c.nota_id)
      return nota ? Links.titulo(nota.texto) || '(sem título)' : '(nota removida)'
    }
    const linha = c.texto.replace(/\s+/g, ' ').trim()
    return linha ? linha.slice(0, 120) : '(vazio)'
  }

  async function copiarQuadroComoMarkdown() {
    if (!quadro) return
    const nomes = new Map()
    const linhas = [`# ${quadro.nome}`, '']
    for (const c of [...cartoes].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const nome = rotuloDoCartao(c)
      nomes.set(c.id, nome)
      linhas.push(`- ${nome}`)
    }
    if (conexoes.length > 0) {
      linhas.push('', '## Conexões', '')
      for (const k of conexoes) {
        linhas.push(`- ${nomes.get(k.de_id) ?? '?'} → ${nomes.get(k.para_id) ?? '?'}`)
      }
    }
    try {
      await window.api.copiarTexto(linhas.join('\n'))
      aviso('Quadro copiado como Markdown')
    } catch {
      aviso('Não consegui copiar')
    }
  }

  function carregarImagem(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Imagem ilegível'))
      }
      img.src = url
    })
  }

  // Guarda a imagem em alta resolução (até 3000 px), para ela continuar nítida com zoom
  async function reduzirImagem(blob, ladoMax = 3000) {
    const img = await carregarImagem(blob)
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * escala))
    canvas.height = Math.max(1, Math.round(img.height * escala))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    let dataUrl = canvas.toDataURL('image/png')
    if (dataUrl.length > 6000000) dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    return { dataUrl, largura: canvas.width }
  }

  async function colarImagem(blob, pos) {
    try {
      const { dataUrl, largura } = await reduzirImagem(blob)
      const larguraCartao = Math.min(420, largura)
      const c = await window.api.criarCartao(quadro.id, 'imagem', null, dataUrl, pos.x, pos.y, 'branco', larguraCartao)
      if (!c) return
      adicionarCartaoLocal(c)
      selecionarCartoes([c.id])
    } catch {
      aviso('Não consegui colar essa imagem')
    }
  }

  async function colarTexto(conteudo, emLinhas) {
    const pos = posicaoParaColar()
    if (!emLinhas) {
      const c = await window.api.criarCartao(quadro.id, 'texto', null, conteudo.slice(0, 2000), pos.x, pos.y, corAtual, LARGURA)
      if (c) {
        adicionarCartaoLocal(c)
        selecionarCartoes([c.id])
      }
      return
    }
    const linhas = conteudo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 60)
    const criados = []
    for (let i = 0; i < linhas.length; i++) {
      const x = pos.x + (i % 3) * (LARGURA + 20)
      const y = pos.y + Math.floor(i / 3) * 110
      const c = await window.api.criarCartao(quadro.id, 'texto', null, linhas[i], x, y, corAtual, LARGURA)
      if (c) {
        adicionarCartaoLocal(c)
        criados.push(c.id)
      }
    }
    selecionarCartoes(criados)
    aviso(`${criados.length} post-its criados`)
  }

  // Lê a área de transferência pelo processo principal (usado pelo menu e como reserva do Ctrl+V)
  async function colarDoSistema(pos, emLinhas = false) {
    try {
      const { texto, imagem } = await window.api.lerAreaTransferencia()
      if (imagem) {
        const blob = await (await fetch(imagem)).blob()
        await colarImagem(blob, { x: pos.x - LARGURA / 2, y: pos.y - 30 })
      } else if (texto && texto.trim()) {
        ultimoPonteiro = pos
        await colarTexto(texto, emLinhas)
      } else {
        aviso('Área de transferência vazia')
      }
    } catch {
      aviso('Não consegui colar')
    }
  }

  // ---------- Edição de post-it ----------

  function iniciarEdicao(el, c) {
    const corpo = el.querySelector('.corpo')
    corpo.contentEditable = 'plaintext-only'
    el.classList.add('cartao-editando')
    atualizarAlcas()
    corpo.focus()

    const intervalo = document.createRange()
    intervalo.selectNodeContents(corpo)
    intervalo.collapse(false)
    const selecao = window.getSelection()
    selecao.removeAllRanges()
    selecao.addRange(intervalo)

    const terminar = async () => {
      corpo.removeEventListener('blur', terminar)
      corpo.removeEventListener('input', aoDigitar)
      corpo.removeEventListener('keydown', aoTeclar)
      corpo.contentEditable = 'false'
      el.classList.remove('cartao-editando')
      const novo = corpo.innerText.replace(/\n+$/, '')
      if (novo !== c.texto) {
        c.texto = novo
        await window.api.editarCartao(c.id, c.texto, c.cor)
      }
      atualizarAlcas()
      desenharConexoes()
    }
    const aoDigitar = () => desenharConexoes()
    const aoTeclar = (e) => {
      e.stopPropagation()
      if (e.key === 'Escape' || (e.key === 'Enter' && e.ctrlKey)) corpo.blur()
    }
    corpo.addEventListener('blur', terminar)
    corpo.addEventListener('input', aoDigitar)
    corpo.addEventListener('keydown', aoTeclar)
  }

  // ---------- Cores dos post-its ----------

  function construirPaleta() {
    for (const cor of CORES) {
      const botao = document.createElement('button')
      botao.style.background = HEX_COR[cor]
      botao.title = cor
      botao.dataset.cor = cor
      botao.addEventListener('click', () => escolherCor(cor))
      paleta.appendChild(botao)
    }
    marcarPaleta()
  }

  function marcarPaleta() {
    for (const botao of paleta.children) botao.classList.toggle('ativo', botao.dataset.cor === corAtual)
  }

  async function escolherCor(cor) {
    corAtual = cor
    marcarPaleta()
    for (const c of cartoesSelecionados()) {
      if (c.tipo !== 'texto') continue
      c.cor = cor
      elementos.get(c.id).className = `cartao texto cor-${cor} selecionado`
      await window.api.editarCartao(c.id, c.texto, cor)
    }
  }

  // ---------- Escolher uma nota existente ----------

  function abrirSeletor() {
    if (!quadro) return
    seletor.hidden = false
    seletorBusca.value = ''
    renderizarSeletor()
    seletorBusca.focus()
  }

  function fecharSeletor() {
    seletor.hidden = true
  }

  function renderizarSeletor() {
    const termo = Links.normalizar(seletorBusca.value)
    const jaNoQuadro = new Set(cartoes.filter((c) => c.tipo === 'nota').map((c) => c.nota_id))
    const encontradas = todasNotas
      .filter((n) => !termo || Links.normalizar(n.texto).includes(termo))
      .slice(0, 60)

    seletorLista.replaceChildren()
    for (const nota of encontradas) {
      const li = document.createElement('li')
      const titulo = document.createElement('div')
      titulo.textContent = Links.titulo(nota.texto) || '(sem título)'
      li.appendChild(titulo)

      const detalhe = previa(nota.texto)
      const jaEsta = jaNoQuadro.has(nota.id)
      if (detalhe || jaEsta) {
        const pequeno = document.createElement('small')
        pequeno.textContent = jaEsta ? 'já está no quadro' : detalhe
        li.appendChild(pequeno)
      }
      if (jaEsta) {
        li.className = 'desativado'
      } else {
        li.addEventListener('click', () => {
          fecharSeletor()
          adicionarNota(nota)
        })
      }
      seletorLista.appendChild(li)
    }
    if (encontradas.length === 0) {
      const vazio = document.createElement('li')
      vazio.className = 'desativado'
      vazio.textContent = 'Nenhuma nota encontrada.'
      seletorLista.appendChild(vazio)
    }
  }

  // ---------- Câmera ----------

  function aplicarCamera() {
    mundo.style.transform = `translate(${camX}px, ${camY}px) scale(${zoom})`
    mundo.style.setProperty('--inv', String(1 / zoom))
    const passo = 24 * zoom
    area.style.backgroundSize = `${passo}px ${passo}px`
    area.style.backgroundPosition = `${camX}px ${camY}px`
    area.style.backgroundImage = passo < 8 ? 'none' : ''
    zoomEl.textContent = `${Math.round(zoom * 100)}%`
  }

  function aplicarZoom(fator, px, py) {
    const novo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * fator))
    camX = px - (px - camX) * (novo / zoom)
    camY = py - (py - camY) * (novo / zoom)
    zoom = novo
    aplicarCamera()
  }

  function ajustarATela() {
    const largura = area.clientWidth
    const altura = area.clientHeight
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const c of cartoes) {
      const el = elementos.get(c.id)
      minX = Math.min(minX, c.x)
      maxX = Math.max(maxX, c.x + el.offsetWidth)
      minY = Math.min(minY, c.y)
      maxY = Math.max(maxY, c.y + el.offsetHeight)
    }
    for (const t of tracos) {
      for (let i = 0; i + 1 < t.pontos.length; i += 2) {
        minX = Math.min(minX, t.pontos[i])
        maxX = Math.max(maxX, t.pontos[i])
        minY = Math.min(minY, t.pontos[i + 1])
        maxY = Math.max(maxY, t.pontos[i + 1])
      }
    }
    if (!Number.isFinite(minX)) {
      zoom = 1
      camX = largura / 2
      camY = altura / 2
      aplicarCamera()
      return
    }
    const margem = 90
    const caixaL = maxX - minX + margem * 2
    const caixaA = maxY - minY + margem * 2
    zoom = Math.max(ZOOM_MIN, Math.min(largura / caixaL, altura / caixaA, 1.5))
    camX = largura / 2 - ((minX + maxX) / 2) * zoom
    camY = altura / 2 - ((minY + maxY) / 2) * zoom
    aplicarCamera()
  }

  function pontoNoMundo(e) {
    const r = area.getBoundingClientRect()
    return { x: (e.clientX - r.left - camX) / zoom, y: (e.clientY - r.top - camY) / zoom }
  }

  function definirVisivel(valor) {
    visivel = valor
    if (!valor) return
    aplicarCamera()
    desenharConexoes()
  }

  // ---------- Desenho à mão livre ----------

  function aplicarEstiloTraco(el, ferramenta, cor, espessura) {
    const t = TINTA[ferramenta] || TINTA.caneta
    el.setAttribute('fill', 'none')
    el.setAttribute('stroke', cor)
    el.setAttribute('stroke-width', String(espessura))
    el.setAttribute('stroke-opacity', String(t.opacidade))
    el.setAttribute('stroke-linecap', t.ponta)
    el.setAttribute('stroke-linejoin', 'round')
  }

  // Curva suave passando pelo meio dos pontos
  function caminhoSuave(p) {
    if (p.length < 4) return `M${p[0]} ${p[1]} L${p[0]} ${p[1]}`
    let d = `M${p[0]} ${p[1]}`
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2
      const my = (p[i + 1] + p[i + 3]) / 2
      d += ` Q${p[i]} ${p[i + 1]} ${mx} ${my}`
    }
    return d + ` L${p[p.length - 2]} ${p[p.length - 1]}`
  }

  function criarElementoTraco(t) {
    const el = document.createElementNS(NS, 'path')
    aplicarEstiloTraco(el, t.ferramenta, t.cor, t.espessura)
    el.setAttribute('d', caminhoSuave(t.pontos))
    camadaTracos.appendChild(el)
    t.el = el
  }

  function definirModoDesenho(valor) {
    modoDesenho = valor || false
    painelDesenho.hidden = !modoDesenho
    btnDesenhar.classList.toggle('ativo', Boolean(modoDesenho))
    area.classList.toggle('modo-desenho', Boolean(modoDesenho))
    for (const b of painelDesenho.querySelectorAll('[data-ferramenta]')) {
      b.classList.toggle('ativo', b.dataset.ferramenta === modoDesenho)
    }
    if (modoDesenho) {
      if (modoConectar) alternarConectar(false)
      limparSelecao()
    }
  }

  function iniciarDesenho(e) {
    if (!quadro) return
    const p = pontoNoMundo(e)
    if (modoDesenho === 'borracha') {
      arrasto = { tipo: 'borracha' }
      apagarTracosEm(p)
      return
    }
    const espessura = tamanhoTinta * TINTA[modoDesenho].fator
    const el = document.createElementNS(NS, 'path')
    aplicarEstiloTraco(el, modoDesenho, corTinta, espessura)
    camadaTracos.appendChild(el)
    arrasto = {
      tipo: 'traco',
      el,
      ferramenta: modoDesenho,
      cor: corTinta,
      espessura,
      pontos: [p.x, p.y],
      ultimoX: e.clientX,
      ultimoY: e.clientY,
    }
    el.setAttribute('d', caminhoSuave(arrasto.pontos))
  }

  async function finalizarTraco(a) {
    const pontos = a.pontos.length === 2 ? [...a.pontos, ...a.pontos] : a.pontos
    try {
      const criado = await window.api.criarTraco(quadro.id, a.ferramenta, a.cor, a.espessura, pontos)
      tracos.push({ id: criado.id, ferramenta: a.ferramenta, cor: a.cor, espessura: a.espessura, pontos, el: a.el })
      pilhaTracos.push(criado.id)
      atualizarDica()
    } catch {
      a.el.remove()
      aviso('Não consegui salvar o traço')
    }
  }

  function distanciaAoSegmento(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1
    const dy = y2 - y1
    const comprimento = dx * dx + dy * dy
    let t = comprimento === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / comprimento
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
  }

  function tracoTocado(t, p, raio) {
    const r = raio + t.espessura / 2
    const pts = t.pontos
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const x2 = i + 3 < pts.length ? pts[i + 2] : pts[i]
      const y2 = i + 3 < pts.length ? pts[i + 3] : pts[i + 1]
      if (distanciaAoSegmento(p.x, p.y, pts[i], pts[i + 1], x2, y2) <= r) return true
    }
    return false
  }

  function removerTracoLocal(t) {
    t.el.remove()
    window.api.removerTraco(t.id).catch(() => {})
    const i = pilhaTracos.indexOf(t.id)
    if (i >= 0) pilhaTracos.splice(i, 1)
  }

  function apagarTracosEm(p) {
    const raio = (8 + tamanhoTinta) / zoom
    const restantes = []
    for (const t of tracos) {
      if (tracoTocado(t, p, raio)) removerTracoLocal(t)
      else restantes.push(t)
    }
    tracos = restantes
  }

  function desfazerTraco() {
    while (pilhaTracos.length > 0) {
      const id = pilhaTracos[pilhaTracos.length - 1]
      const t = tracos.find((x) => x.id === id)
      if (!t) {
        pilhaTracos.pop()
        continue
      }
      tracos = tracos.filter((x) => x.id !== id)
      removerTracoLocal(t)
      aviso('Traço desfeito')
      return
    }
    aviso('Nada para desfazer')
  }

  async function limparTracos() {
    if (tracos.length === 0) return
    if (!confirm('Apagar todos os desenhos deste quadro?')) return
    for (const t of tracos) {
      t.el.remove()
      await window.api.removerTraco(t.id)
    }
    tracos = []
    pilhaTracos.length = 0
  }

  function construirPainelDesenho() {
    const caixa = document.getElementById('quadro-cores-tinta')
    for (const hex of CORES_TINTA) {
      const botao = document.createElement('button')
      botao.style.background = hex
      botao.dataset.hex = hex
      botao.addEventListener('click', () => {
        corTinta = hex
        marcarCoresTinta()
      })
      caixa.appendChild(botao)
    }
    marcarCoresTinta()
    for (const b of painelDesenho.querySelectorAll('[data-ferramenta]')) {
      b.addEventListener('click', () => definirModoDesenho(b.dataset.ferramenta))
    }
    tamanhoEl.addEventListener('input', () => {
      tamanhoTinta = Number(tamanhoEl.value)
    })
    btnDesenhar.addEventListener('click', () => definirModoDesenho(modoDesenho ? false : 'caneta'))
  }

  function marcarCoresTinta() {
    for (const b of document.getElementById('quadro-cores-tinta').children) {
      b.classList.toggle('ativo', b.dataset.hex === corTinta)
    }
  }

  // ---------- Ligações puxadas das âncoras ----------

  function limparAlvos() {
    for (const el of elementos.values()) el.classList.remove('alvo-conexao')
  }

  function iniciarRascunho(e, ancoraEl) {
    const cartaoEl = ancoraEl.closest('.cartao')
    const c = cartoes.find((x) => x.id === Number(cartaoEl.dataset.id))
    if (!c) return
    const lado = ancoraEl.dataset.lado
    const p0 = pontoDeLado(c, lado, pontoNoMundo(e))
    const el = criarCaminho('rascunho', `M${p0.x} ${p0.y}`)
    camadaRascunho.appendChild(el)
    arrasto = {
      tipo: 'rascunho',
      de: c.id,
      lado,
      p0,
      el,
      inicioX: e.clientX,
      inicioY: e.clientY,
      moveu: false,
      alvo: null,
      fimMundo: p0,
    }
  }

  function atualizarRascunho(e) {
    const p = pontoNoMundo(e)
    arrasto.fimMundo = p
    let fim = { x: p.x, y: p.y, nx: 0, ny: 0 }
    let alvo = null
    const sob = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cartao')
    for (const [id, el] of elementos) el.classList.toggle('alvo-conexao', el === sob && id !== arrasto.de)
    if (sob && Number(sob.dataset.id) !== arrasto.de) {
      const c = cartoes.find((x) => x.id === Number(sob.dataset.id))
      if (c) {
        const lado = ladoMaisProximo(c, p)
        fim = pontoDeLado(c, lado, p)
        alvo = { id: c.id, lado }
      }
    }
    arrasto.alvo = alvo
    arrasto.el.setAttribute('d', caminhoDaConexao('curva', arrasto.p0, fim))
  }

  // Soltou sobre um cartão: liga. Soltou no vazio: cria um post-it já ligado.
  async function concluirRascunho(a) {
    if (a.alvo) {
      await criarLigacao(a.de, a.lado, a.alvo.id, a.alvo.lado)
      return
    }
    const p = a.fimMundo
    const altura = 70
    const x = a.lado === 'r' ? p.x : a.lado === 'l' ? p.x - LARGURA : p.x - LARGURA / 2
    const y = a.lado === 'b' ? p.y : a.lado === 't' ? p.y - altura : p.y - altura / 2
    const c = await window.api.criarCartao(quadro.id, 'texto', null, '', x, y, corAtual, LARGURA)
    if (!c) return
    adicionarCartaoLocal(c)
    await criarLigacao(a.de, a.lado, c.id, OPOSTO[a.lado])
    selecionarCartoes([c.id])
    iniciarEdicao(elementos.get(c.id), c)
  }

  // ---------- Redimensionar ----------

  function iniciarRedim(e, alcaEl) {
    const cartaoEl = alcaEl.closest('.cartao')
    const c = cartoes.find((x) => x.id === Number(cartaoEl.dataset.id))
    if (!c) return
    arrasto = {
      tipo: 'redim',
      cartao: c,
      canto: alcaEl.dataset.canto,
      inicioX: e.clientX,
      x0: c.x,
      larg0: cartaoEl.offsetWidth,
    }
  }

  // ---------- Menu do botão direito ----------

  const marca = (ativo) => (ativo ? '✓ ' : '\u2003')

  function trazerParaFrente() {
    for (const id of selCartoes) elementos.get(id).style.zIndex = String(++topoZ)
  }

  function enviarParaTras() {
    for (const id of selCartoes) elementos.get(id).style.zIndex = String(--baixoZ)
  }

  function itensDoFundo(pos) {
    return [
      { rotulo: 'Novo post-it aqui', aoClicar: () => criarPostit(pos.x - LARGURA / 2, pos.y - 30) },
      { rotulo: 'Colar', atalho: 'Ctrl+V', aoClicar: () => colarDoSistema(pos) },
      { rotulo: 'Adicionar nota existente…', aoClicar: abrirSeletor },
      { separador: true },
      { rotulo: 'Desenhar', atalho: 'P', aoClicar: () => definirModoDesenho('caneta') },
      { rotulo: 'Apagar todos os desenhos', desativado: tracos.length === 0, aoClicar: limparTracos },
      { separador: true },
      {
        rotulo: 'Selecionar tudo',
        atalho: 'Ctrl+A',
        desativado: cartoes.length === 0,
        aoClicar: () => selecionarCartoes(cartoes.map((c) => c.id)),
      },
      { rotulo: 'Organizar em grade', atalho: 'G', desativado: cartoes.length < 2, aoClicar: organizarEmGrade },
      { rotulo: 'Ajustar à tela', aoClicar: ajustarATela },
      { separador: true },
      { rotulo: 'Copiar quadro como Markdown', atalho: 'Ctrl+Shift+C', aoClicar: copiarQuadroComoMarkdown },
    ]
  }

  function itensDosCartoes() {
    const escolhidos = cartoesSelecionados()
    const unico = escolhidos.length === 1 ? escolhidos[0] : null
    const itens = []

    if (unico?.tipo === 'texto') {
      itens.push({
        rotulo: 'Editar texto',
        atalho: 'Duplo clique',
        aoClicar: () => iniciarEdicao(elementos.get(unico.id), unico),
      })
    }
    if (unico?.tipo === 'nota') {
      itens.push({
        rotulo: 'Abrir nota',
        atalho: 'Duplo clique',
        desativado: !notasPorId.has(unico.nota_id),
        aoClicar: () => abrirNota(unico.nota_id),
      })
    }
    if (escolhidos.some((c) => c.tipo === 'texto')) {
      itens.push({
        cores: CORES.map((id) => ({ id, hex: HEX_COR[id] })),
        atual: unico?.tipo === 'texto' ? unico.cor : corAtual,
        aoEscolher: (cor) => escolherCor(cor),
      })
    }
    if (itens.length > 0) itens.push({ separador: true })

    itens.push(
      {
        rotulo: unico?.tipo === 'imagem' ? 'Copiar imagem' : 'Copiar texto',
        atalho: 'Ctrl+C',
        aoClicar: copiarSelecao,
      },
      {
        rotulo: 'Duplicar',
        atalho: 'Ctrl+D',
        desativado: !escolhidos.some((c) => c.tipo !== 'nota'),
        aoClicar: duplicarSelecao,
      },
      { separador: true },
      { rotulo: 'Trazer para a frente', aoClicar: trazerParaFrente },
      { rotulo: 'Enviar para trás', aoClicar: enviarParaTras }
    )
    if (unico) {
      itens.push({
        rotulo: 'Conectar a partir daqui',
        atalho: 'C',
        aoClicar: () => {
          alternarConectar(true)
          origem = unico.id
          marcarOrigem()
          atualizarDica()
        },
      })
    }
    if (escolhidos.length > 1) {
      itens.push({ rotulo: 'Organizar em grade', atalho: 'G', aoClicar: organizarEmGrade })
    }
    itens.push(
      { separador: true },
      {
        rotulo:
          escolhidos.length > 1
            ? `Apagar ${escolhidos.length} cartões`
            : unico?.tipo === 'nota'
              ? 'Tirar do quadro'
              : 'Apagar',
        atalho: 'Delete',
        perigo: true,
        aoClicar: removerSelecao,
      }
    )
    return itens
  }

  function itensDaConexao(k) {
    const aplicar = (campos) => async () => {
      await window.api.editarConexao(k.id, campos)
      Object.assign(k, campos)
      desenharConexoes()
    }
    const opcao = (campo, valor, rotulo) => ({
      rotulo: marca(k[campo] === valor) + rotulo,
      aoClicar: aplicar({ [campo]: valor }),
    })
    return [
      opcao('seta', 'fim', 'Seta no fim'),
      opcao('seta', 'inicio', 'Seta no início'),
      opcao('seta', 'ambos', 'Setas nas duas pontas'),
      opcao('seta', 'nenhuma', 'Sem seta'),
      { separador: true },
      opcao('estilo', 'solido', 'Linha contínua'),
      opcao('estilo', 'tracejado', 'Linha tracejada'),
      opcao('estilo', 'pontilhado', 'Linha pontilhada'),
      { separador: true },
      opcao('forma', 'curva', 'Curva'),
      opcao('forma', 'reta', 'Reta'),
      opcao('forma', 'angular', 'Angular'),
      { separador: true },
      {
        cores: Object.entries(COR_LINHA).map(([id, hex]) => ({ id, hex })),
        atual: k.cor,
        aoEscolher: (cor) => aplicar({ cor })(),
      },
      { separador: true },
      {
        rotulo: 'Inverter direção',
        aoClicar: async () => {
          await window.api.inverterConexao(k.id)
          const idAntigo = k.de_id
          const ladoAntigo = k.de_lado
          k.de_id = k.para_id
          k.de_lado = k.para_lado
          k.para_id = idAntigo
          k.para_lado = ladoAntigo
          desenharConexoes()
        },
      },
      { rotulo: 'Apagar conexão', atalho: 'Delete', perigo: true, aoClicar: removerSelecao },
    ]
  }

  function configurarMenuContexto() {
    area.addEventListener('contextmenu', (e) => {
      // Editando o texto de um post-it: o menu de recortar/copiar/colar cuida disso
      if (e.target.closest('.cartao-editando')) return
      e.preventDefault()
      if (!quadro) return

      const ponto = { x: e.clientX, y: e.clientY }
      const cartaoEl = e.target.closest('.cartao')
      const conexaoEl = e.target.closest('.conexao-grupo')

      if (cartaoEl) {
        const id = Number(cartaoEl.dataset.id)
        if (!selCartoes.has(id)) selecionarCartoes([id])
        MenuContexto.abrir(ponto, itensDosCartoes())
      } else if (conexaoEl) {
        const k = conexoes.find((x) => x.id === Number(conexaoEl.dataset.id))
        if (!k) return
        selecionarConexao(k.id)
        MenuContexto.abrir(ponto, itensDaConexao(k))
      } else {
        MenuContexto.abrir(ponto, itensDoFundo(pontoNoMundo(e)))
      }
    })
  }

  // ---------- Eventos ----------

  function estaDigitando() {
    const ativo = document.activeElement
    return Boolean(
      ativo && (ativo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName))
    )
  }

  function iniciar(aoAbrirNota) {
    abrirNota = aoAbrirNota
    construirMarcadores()
    construirPaleta()
    construirPainelDesenho()
    configurarMenuContexto()

    area.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault()
    })

    area.addEventListener('pointerdown', (e) => {
      // Botão do meio, ou Espaço + arrastar: anda pelo quadro em qualquer modo
      if (e.button === 1 || (e.button === 0 && espaco)) {
        e.preventDefault()
        arrasto = { tipo: 'fundo', ultimoX: e.clientX, ultimoY: e.clientY }
        area.classList.add('arrastando')
        return
      }
      if (e.button !== 0 || e.target.closest('button')) return

      if (modoDesenho) {
        iniciarDesenho(e)
        return
      }

      const alcaEl = e.target.closest('.alca-redim')
      if (alcaEl) {
        iniciarRedim(e, alcaEl)
        return
      }
      const ancoraEl = e.target.closest('.ancora')
      if (ancoraEl) {
        iniciarRascunho(e, ancoraEl)
        return
      }

      const cartaoEl = e.target.closest('.cartao')
      if (cartaoEl && cartaoEl.classList.contains('cartao-editando')) return
      const conexaoEl = e.target.closest('.conexao-grupo')

      if (cartaoEl) {
        const c = cartoes.find((x) => x.id === Number(cartaoEl.dataset.id))
        if (!c) return
        if (modoConectar) {
          tratarCliqueConectar(c)
          return
        }
        cartaoEl.style.zIndex = String(++topoZ)

        if (e.shiftKey || e.ctrlKey) {
          const novo = new Set(selCartoes)
          if (novo.has(c.id)) novo.delete(c.id)
          else novo.add(c.id)
          selecionarCartoes(novo)
          return
        }

        const jaSelecionado = selCartoes.has(c.id)
        if (!jaSelecionado) selecionarCartoes([c.id])
        arrasto = {
          tipo: 'cartoes',
          clicado: c.id,
          inicioX: e.clientX,
          inicioY: e.clientY,
          origens: new Map(cartoesSelecionados().map((x) => [x.id, { x: x.x, y: x.y }])),
          moveu: false,
          reduzir: jaSelecionado && selCartoes.size > 1,
        }
      } else if (conexaoEl) {
        selecionarConexao(Number(conexaoEl.dataset.id))
      } else if (e.shiftKey) {
        const r = area.getBoundingClientRect()
        const caixa = document.createElement('div')
        caixa.className = 'quadro-caixa'
        area.appendChild(caixa)
        arrasto = {
          tipo: 'caixa',
          caixa,
          p0: pontoNoMundo(e),
          tela0: { x: e.clientX - r.left, y: e.clientY - r.top },
          base: new Set(selCartoes),
        }
        selConexao = null
      } else {
        limparSelecao()
        arrasto = { tipo: 'fundo', ultimoX: e.clientX, ultimoY: e.clientY }
        area.classList.add('arrastando')
      }
    })

    area.addEventListener('pointermove', (e) => {
      ultimoPonteiro = pontoNoMundo(e)
    })
    area.addEventListener('pointerleave', () => {
      ultimoPonteiro = null
    })

    window.addEventListener('pointermove', (e) => {
      if (!arrasto) return

      if (arrasto.tipo === 'fundo') {
        camX += e.clientX - arrasto.ultimoX
        camY += e.clientY - arrasto.ultimoY
        arrasto.ultimoX = e.clientX
        arrasto.ultimoY = e.clientY
        aplicarCamera()
      } else if (arrasto.tipo === 'caixa') {
        const r = area.getBoundingClientRect()
        const tx = e.clientX - r.left
        const ty = e.clientY - r.top
        Object.assign(arrasto.caixa.style, {
          left: Math.min(arrasto.tela0.x, tx) + 'px',
          top: Math.min(arrasto.tela0.y, ty) + 'px',
          width: Math.abs(tx - arrasto.tela0.x) + 'px',
          height: Math.abs(ty - arrasto.tela0.y) + 'px',
        })
        const p = pontoNoMundo(e)
        const minX = Math.min(arrasto.p0.x, p.x)
        const maxX = Math.max(arrasto.p0.x, p.x)
        const minY = Math.min(arrasto.p0.y, p.y)
        const maxY = Math.max(arrasto.p0.y, p.y)
        const ids = new Set(arrasto.base)
        for (const c of cartoes) {
          const el = elementos.get(c.id)
          if (c.x < maxX && c.x + el.offsetWidth > minX && c.y < maxY && c.y + el.offsetHeight > minY) {
            ids.add(c.id)
          }
        }
        selecionarCartoes(ids)
      } else if (arrasto.tipo === 'redim') {
        const dx = (e.clientX - arrasto.inicioX) / zoom
        const oeste = arrasto.canto.includes('w')
        const c = arrasto.cartao
        const larg = Math.max(LARGURA_MIN, Math.min(6000, arrasto.larg0 + (oeste ? -dx : dx)))
        c.largura = larg
        c.x = oeste ? arrasto.x0 + (arrasto.larg0 - larg) : arrasto.x0
        const el = elementos.get(c.id)
        el.style.width = larg + 'px'
        el.style.left = c.x + 'px'
        desenharConexoes()
      } else if (arrasto.tipo === 'rascunho') {
        if (!arrasto.moveu && Math.hypot(e.clientX - arrasto.inicioX, e.clientY - arrasto.inicioY) < 6) return
        arrasto.moveu = true
        atualizarRascunho(e)
      } else if (arrasto.tipo === 'traco') {
        if (Math.hypot(e.clientX - arrasto.ultimoX, e.clientY - arrasto.ultimoY) < 1.5) return
        arrasto.ultimoX = e.clientX
        arrasto.ultimoY = e.clientY
        const p = pontoNoMundo(e)
        arrasto.pontos.push(p.x, p.y)
        arrasto.el.setAttribute('d', caminhoSuave(arrasto.pontos))
      } else if (arrasto.tipo === 'borracha') {
        apagarTracosEm(pontoNoMundo(e))
      } else {
        const andou = Math.hypot(e.clientX - arrasto.inicioX, e.clientY - arrasto.inicioY)
        if (!arrasto.moveu && andou < 4) return
        arrasto.moveu = true
        const dx = (e.clientX - arrasto.inicioX) / zoom
        const dy = (e.clientY - arrasto.inicioY) / zoom
        for (const c of cartoes) {
          const o = arrasto.origens.get(c.id)
          if (o) posicionar(c, o.x + dx, o.y + dy)
        }
        desenharConexoes()
      }
    })

    const terminarArrasto = async () => {
      if (!arrasto) return
      const a = arrasto
      arrasto = null
      area.classList.remove('arrastando')

      if (a.tipo === 'caixa') {
        a.caixa.remove()
      } else if (a.tipo === 'cartoes') {
        if (a.moveu) await salvarPosicoes(cartoes.filter((c) => a.origens.has(c.id)))
        else if (a.reduzir) selecionarCartoes([a.clicado])
      } else if (a.tipo === 'redim') {
        await window.api.redimensionarCartao(a.cartao.id, a.cartao.x, a.cartao.y, a.cartao.largura)
      } else if (a.tipo === 'rascunho') {
        a.el.remove()
        limparAlvos()
        if (a.moveu) await concluirRascunho(a)
      } else if (a.tipo === 'traco') {
        await finalizarTraco(a)
      }
    }
    window.addEventListener('pointerup', terminarArrasto)
    window.addEventListener('pointercancel', terminarArrasto)

    area.addEventListener('dblclick', (e) => {
      if (e.target.closest('button') || modoConectar || modoDesenho) return
      if (e.target.closest('.ancora') || e.target.closest('.alca-redim')) return
      const cartaoEl = e.target.closest('.cartao')
      if (!cartaoEl) {
        const p = pontoNoMundo(e)
        criarPostit(p.x - LARGURA / 2, p.y - 30)
        return
      }
      const c = cartoes.find((x) => x.id === Number(cartaoEl.dataset.id))
      if (!c) return
      if (c.tipo === 'texto') iniciarEdicao(cartaoEl, c)
      else if (c.tipo === 'nota' && notasPorId.has(c.nota_id)) abrirNota(c.nota_id)
    })

    // Zoom com a roda, em torno do cursor, suave e proporcional
    area.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = area.getBoundingClientRect()
        const fator = Math.min(2, Math.max(0.5, Math.exp(-e.deltaY * 0.0016)))
        aplicarZoom(fator, e.clientX - r.left, e.clientY - r.top)
      },
      { passive: false }
    )

    // Arrastar imagens do Windows para o quadro
    area.addEventListener('dragover', (e) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault()
    })
    area.addEventListener('drop', async (e) => {
      const arquivos = Array.from(e.dataTransfer?.files || [])
      if (arquivos.length === 0) return
      e.preventDefault()
      if (!quadro) return
      const p = pontoNoMundo(e)
      let i = 0
      for (const arquivo of arquivos.filter((f) => f.type.startsWith('image/'))) {
        await colarImagem(arquivo, { x: p.x - LARGURA / 2 + i * 30, y: p.y - 30 + i * 30 })
        i++
      }
    })

    // Ctrl+V: texto vira post-it, imagem vira cartão de imagem
    document.addEventListener('paste', async (e) => {
      if (!visivel || !quadro || estaDigitando()) return
      const dados = e.clipboardData
      if (!dados) return
      e.preventDefault()
      colarPendente = false
      const emLinhas = colarEmLinhas
      colarEmLinhas = false

      const imagem = Array.from(dados.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      if (imagem) {
        await colarImagem(imagem.getAsFile(), posicaoParaColar())
        return
      }
      const conteudo = dados.getData('text/plain')
      if (conteudo.trim()) await colarTexto(conteudo, emLinhas)
    })

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        espaco = false
        area.classList.remove('pan')
      }
    })
    window.addEventListener('blur', () => {
      espaco = false
      area.classList.remove('pan')
    })

    document.addEventListener('keydown', (e) => {
      if (!visivel) return

      if (e.key === 'Escape') {
        if (!seletor.hidden) {
          fecharSeletor()
        } else if (arrasto && arrasto.tipo === 'rascunho') {
          arrasto.el.remove()
          limparAlvos()
          arrasto = null
        } else if (modoDesenho) {
          definirModoDesenho(false)
        } else if (modoConectar) {
          alternarConectar(false)
        } else {
          limparSelecao()
        }
        return
      }
      if (estaDigitando()) return

      if (e.code === 'Space') {
        e.preventDefault()
        espaco = true
        area.classList.add('pan')
        return
      }

      const tecla = e.key.toLowerCase()

      if (e.ctrlKey || e.metaKey) {
        if (tecla === 'a') {
          e.preventDefault()
          selecionarCartoes(cartoes.map((c) => c.id))
        } else if (tecla === 'c') {
          e.preventDefault()
          if (e.shiftKey) copiarQuadroComoMarkdown()
          else copiarSelecao()
        } else if (tecla === 'd') {
          e.preventDefault()
          duplicarSelecao()
        } else if (tecla === 'z') {
          e.preventDefault()
          desfazerTraco()
        } else if (tecla === '0') {
          e.preventDefault()
          aplicarZoom(1 / zoom, area.clientWidth / 2, area.clientHeight / 2)
        } else if (tecla === 'v') {
          colarEmLinhas = e.shiftKey
          // Reserva: se o navegador não entregar o evento "paste", lê pelo processo principal
          colarPendente = true
          const emLinhas = e.shiftKey
          setTimeout(() => {
            if (!colarPendente) return
            colarPendente = false
            colarEmLinhas = false
            colarDoSistema(ultimoPonteiro || centroDoMundo(), emLinhas)
          }, 150)
        }
        return
      }
      if (e.altKey) return

      const setas = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }
      if (tecla === 'delete' || tecla === 'backspace') {
        e.preventDefault()
        removerSelecao()
      } else if (setas[tecla] && selCartoes.size > 0) {
        e.preventDefault()
        const passo = e.shiftKey ? 50 : 10
        moverSelecaoPor(setas[tecla][0] * passo, setas[tecla][1] * passo)
      } else if (tecla === 'n') {
        const p = pertoDoCentro()
        criarPostit(p.x, p.y)
      } else if (tecla === 'c') {
        alternarConectar()
      } else if (tecla === 'g') {
        organizarEmGrade()
      } else if (tecla === 'p') {
        definirModoDesenho(modoDesenho ? false : 'caneta')
      } else if (tecla === 'e') {
        definirModoDesenho('borracha')
      } else if (tecla === 'v') {
        definirModoDesenho(false)
      }
    })

    // Barra de ferramentas
    document.getElementById('quadro-postit').addEventListener('click', () => {
      const p = pertoDoCentro()
      criarPostit(p.x, p.y)
    })
    document.getElementById('quadro-nota').addEventListener('click', abrirSeletor)
    btnConectar.addEventListener('click', () => alternarConectar())
    document.getElementById('quadro-apagar').addEventListener('click', removerSelecao)
    document.getElementById('quadro-ajustar').addEventListener('click', ajustarATela)
    document.getElementById('quadro-organizar').addEventListener('click', organizarEmGrade)
    const centro = () => [area.clientWidth / 2, area.clientHeight / 2]
    document.getElementById('quadro-zoom-mais').addEventListener('click', () => aplicarZoom(1.25, ...centro()))
    document.getElementById('quadro-zoom-menos').addEventListener('click', () => aplicarZoom(1 / 1.25, ...centro()))
    zoomEl.addEventListener('click', () => aplicarZoom(1 / zoom, ...centro()))

    seletorBusca.addEventListener('input', renderizarSeletor)
    seletor.addEventListener('pointerdown', (e) => {
      if (e.target === seletor) fecharSeletor()
    })
  }

  return { iniciar, abrir, recarregar, definirVisivel }
})()