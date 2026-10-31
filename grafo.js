// Visão de grafo: cada nota é uma bolinha e cada [[link]] é uma linha.
// O layout usa uma simulação de forças escrita à mão (sem biblioteca):
// as notas se repelem, os links funcionam como molas e uma gravidade leve segura tudo perto do centro.
// Este arquivo não conhece o banco nem o Electron: recebe notas e uma função para abrir uma nota.
const Grafo = (() => {
  const NS = 'http://www.w3.org/2000/svg'
  const CORES_TIPO = { tarefa: '#2563eb', ideia: '#7c3aed', referencia: '#059669' }
  const ROTULO_TIPO = { tarefa: 'Tarefa', ideia: 'Ideia', referencia: 'Referência' }
  const COR_SEM_PROJETO = '#9ca3af'

  // Parâmetros da simulação
  const REPULSAO = 3000
  const MOLA = 0.04
  const COMPRIMENTO = 90
  const GRAVIDADE = 0.012
  const ATRITO = 0.85
  const VELOCIDADE_MAX = 20
  const DIST_MIN2 = 400 // distância mínima (20px) ao quadrado, evita forças gigantes
  const RESFRIAMENTO = 0.987

  const svg = document.getElementById('grafo-svg')
  const gCamera = document.getElementById('grafo-camera')
  const gArestas = document.getElementById('grafo-arestas')
  const gNos = document.getElementById('grafo-nos')
  const legenda = document.getElementById('grafo-legenda')
  const info = document.getElementById('grafo-info')
  const nomesCheck = document.getElementById('grafo-nomes')
  const orfasCheck = document.getElementById('grafo-orfas')
  const corPor = document.getElementById('grafo-cor')

  let notasAtuais = []
  let nos = [] // { id, nota, titulo, x, y, vx, vy, fixo, grau, el, circulo }
  let arestas = [] // { a, b, el }
  let vizinhos = new Map() // id -> Set de ids vizinhos
  const posicoes = new Map() // id -> { x, y }: o grafo não "pula" quando os dados mudam

  let alfa = 0 // "temperatura" da simulação: esfria até parar
  let visivel = false
  let rodando = false
  let camX = 0
  let camY = 0
  let zoom = 1
  let cameraPronta = false
  let arrasto = null
  let abrirNota = () => {}

  // ---------- Dados ----------

  function plural(n, singular, pluralTexto) {
    return `${n} ${n === 1 ? singular : pluralTexto}`
  }

  function truncar(texto, max) {
    return texto.length > max ? texto.slice(0, max - 1) + '…' : texto
  }

  function posicaoInicial() {
    const angulo = Math.random() * Math.PI * 2
    const raio = 40 + Math.random() * 100
    return { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio }
  }

  function atualizar(notas) {
    notasAtuais = notas
    construir()
  }

  function construir() {
    for (const no of nos) posicoes.set(no.id, { x: no.x, y: no.y })
    arrasto = null

    const indice = Links.indexar(notasAtuais)

    // Conexões sem direção e sem repetição (A->B e B->A viram uma linha só)
    const pares = new Map()
    for (const nota of notasAtuais) {
      for (const { alvo } of indice.saida.get(nota.id) || []) {
        if (!alvo || alvo.id === nota.id) continue
        const par = nota.id < alvo.id ? [nota.id, alvo.id] : [alvo.id, nota.id]
        pares.set(par.join('-'), par)
      }
    }

    const grau = new Map()
    for (const [a, b] of pares.values()) {
      grau.set(a, (grau.get(a) || 0) + 1)
      grau.set(b, (grau.get(b) || 0) + 1)
    }

    const primeiraVez = posicoes.size === 0
    const visiveis = notasAtuais.filter((n) => !orfasCheck.checked || grau.get(n.id))

    nos = visiveis.map((nota) => {
      const pos = posicoes.get(nota.id) || posicaoInicial()
      return {
        id: nota.id,
        nota,
        titulo: Links.titulo(nota.texto) || '(sem título)',
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        fixo: false,
        grau: grau.get(nota.id) || 0,
      }
    })

    const porId = new Map(nos.map((n) => [n.id, n]))
    arestas = []
    vizinhos = new Map()
    for (const [idA, idB] of pares.values()) {
      const a = porId.get(idA)
      const b = porId.get(idB)
      if (!a || !b) continue
      arestas.push({ a, b })
      if (!vizinhos.has(idA)) vizinhos.set(idA, new Set())
      if (!vizinhos.has(idB)) vizinhos.set(idB, new Set())
      vizinhos.get(idA).add(idB)
      vizinhos.get(idB).add(idA)
    }

    // Desenha os elementos SVG
    gArestas.replaceChildren()
    gNos.replaceChildren()
    for (const aresta of arestas) {
      aresta.el = document.createElementNS(NS, 'line')
      aresta.el.setAttribute('class', 'aresta')
      gArestas.appendChild(aresta.el)
    }
    for (const no of nos) criarElementoNo(no)

    atualizarRotulos()
    atualizarLegenda()
    atualizarInfo()
    desenhar()
    aquecer(primeiraVez ? 1 : 0.5)
  }

  function raio(no) {
    return 6 + Math.min(12, no.grau * 2)
  }

  function criarElementoNo(no) {
    const g = document.createElementNS(NS, 'g')
    g.setAttribute('class', no.nota.concluida ? 'no concluida' : 'no')

    const dica = document.createElementNS(NS, 'title')
    dica.textContent = no.titulo

    const circulo = document.createElementNS(NS, 'circle')
    circulo.setAttribute('r', raio(no))
    circulo.setAttribute('fill', corDoNo(no.nota))

    const rotulo = document.createElementNS(NS, 'text')
    rotulo.setAttribute('dy', raio(no) + 13)
    rotulo.textContent = truncar(no.titulo, 26)

    g.append(dica, circulo, rotulo)
    g.addEventListener('pointerdown', (e) => iniciarArrasto(e, no))
    g.addEventListener('pointerenter', () => destacar(no))
    g.addEventListener('pointerleave', () => destacar(null))

    no.el = g
    no.circulo = circulo
    gNos.appendChild(g)
  }

  // ---------- Cores, legenda e informações ----------

  function corDoProjeto(nome) {
    let matiz = 0
    for (const c of Links.normalizar(nome)) matiz = (matiz * 31 + c.codePointAt(0)) % 360
    return `hsl(${matiz} 65% 48%)`
  }

  function corDoNo(nota) {
    if (corPor.value === 'projeto') {
      return nota.projeto ? corDoProjeto(nota.projeto) : COR_SEM_PROJETO
    }
    return CORES_TIPO[nota.tipo] || COR_SEM_PROJETO
  }

  function recolorir() {
    for (const no of nos) no.circulo.setAttribute('fill', corDoNo(no.nota))
    atualizarLegenda()
  }

  function atualizarLegenda() {
    const itens = [] // [cor | null, texto]
    if (corPor.value === 'projeto') {
      const projetos = [...new Set(nos.map((n) => n.nota.projeto).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      )
      for (const p of projetos.slice(0, 8)) itens.push([corDoProjeto(p), p])
      if (projetos.length > 8) itens.push([null, `e mais ${projetos.length - 8}`])
      if (nos.some((n) => !n.nota.projeto)) itens.push([COR_SEM_PROJETO, 'Sem projeto'])
    } else {
      for (const [tipo, cor] of Object.entries(CORES_TIPO)) itens.push([cor, ROTULO_TIPO[tipo]])
    }

    legenda.replaceChildren()
    for (const [cor, texto] of itens) {
      const item = document.createElement('span')
      if (cor) {
        const ponto = document.createElement('span')
        ponto.className = 'ponto'
        ponto.style.background = cor
        item.appendChild(ponto)
      }
      item.appendChild(document.createTextNode(texto))
      legenda.appendChild(item)
    }
  }

  function atualizarInfo() {
    let texto = `${plural(nos.length, 'nota', 'notas')} · ${plural(arestas.length, 'conexão', 'conexões')}`
    if (arestas.length === 0) texto += ' · use [[links]] para conectar notas'
    info.textContent = texto
  }

  function atualizarRotulos() {
    gNos.classList.toggle('sem-nomes', !nomesCheck.checked)
  }

  // Passar o mouse: realça a nota e suas vizinhas, apaga o resto
  function destacar(no) {
    const viz = no ? vizinhos.get(no.id) || new Set() : null
    for (const n of nos) {
      const apagado = no && n !== no && !viz.has(n.id)
      n.el.classList.toggle('apagado', Boolean(apagado))
    }
    for (const aresta of arestas) {
      const liga = Boolean(no) && (aresta.a === no || aresta.b === no)
      aresta.el.classList.toggle('realce', liga)
      aresta.el.classList.toggle('apagado', Boolean(no) && !liga)
    }
  }

  // ---------- Simulação de forças ----------

  function passo(forca) {
    const n = nos.length

    // Repulsão entre todos os pares de notas
    for (let i = 0; i < n; i++) {
      const a = nos[i]
      for (let j = i + 1; j < n; j++) {
        const b = nos[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        if (dx === 0 && dy === 0) {
          dx = 0.5
          dy = 0.5
        }
        const d2 = Math.max(dx * dx + dy * dy, DIST_MIN2)
        const d = Math.sqrt(d2)
        const f = (REPULSAO / d2) * forca
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    // Os links funcionam como molas
    for (const { a, b } of arestas) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1
      const f = (d - COMPRIMENTO) * MOLA * forca
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }

    // Gravidade, atrito e movimento
    for (const no of nos) {
      if (no.fixo) {
        no.vx = 0
        no.vy = 0
        continue
      }
      no.vx -= no.x * GRAVIDADE * forca
      no.vy -= no.y * GRAVIDADE * forca
      no.vx *= ATRITO
      no.vy *= ATRITO
      const v = Math.hypot(no.vx, no.vy)
      if (v > VELOCIDADE_MAX) {
        no.vx = (no.vx / v) * VELOCIDADE_MAX
        no.vy = (no.vy / v) * VELOCIDADE_MAX
      }
      no.x += no.vx
      no.y += no.vy
    }
  }

  function desenhar() {
    for (const aresta of arestas) {
      aresta.el.setAttribute('x1', aresta.a.x)
      aresta.el.setAttribute('y1', aresta.a.y)
      aresta.el.setAttribute('x2', aresta.b.x)
      aresta.el.setAttribute('y2', aresta.b.y)
    }
    for (const no of nos) no.el.setAttribute('transform', `translate(${no.x} ${no.y})`)
  }

  // Reaquece a simulação (ao mexer nos dados ou arrastar uma nota)
  function aquecer(valor) {
    alfa = Math.max(alfa, valor)
    iniciarLoop()
  }

  function iniciarLoop() {
    if (rodando || !visivel) return
    rodando = true
    requestAnimationFrame(quadro)
  }

  function quadro() {
    if (!visivel || alfa < 0.01) {
      rodando = false
      return
    }
    passo(alfa)
    alfa *= RESFRIAMENTO
    desenhar()
    requestAnimationFrame(quadro)
  }

  // ---------- Câmera (zoom e navegação) ----------

  function aplicarCamera() {
    gCamera.setAttribute('transform', `translate(${camX} ${camY}) scale(${zoom})`)
  }

  function centralizar() {
    zoom = 1
    camX = svg.clientWidth / 2
    camY = svg.clientHeight / 2
    aplicarCamera()
  }

  // Zoom mantendo fixo o ponto do mundo que está sob o cursor
  function aplicarZoom(fator, px, py) {
    const novo = Math.min(4, Math.max(0.2, zoom * fator))
    camX = px - (px - camX) * (novo / zoom)
    camY = py - (py - camY) * (novo / zoom)
    zoom = novo
    aplicarCamera()
  }

  // Enquadra todas as notas na tela
  function ajustarATela() {
    if (nos.length === 0) {
      centralizar()
      return
    }
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const no of nos) {
      minX = Math.min(minX, no.x)
      maxX = Math.max(maxX, no.x)
      minY = Math.min(minY, no.y)
      maxY = Math.max(maxY, no.y)
    }
    const margem = 70
    const largura = svg.clientWidth
    const altura = svg.clientHeight
    const caixaL = Math.max(maxX - minX, 1) + margem * 2
    const caixaA = Math.max(maxY - minY, 1) + margem * 2
    zoom = Math.max(0.2, Math.min(largura / caixaL, altura / caixaA, 1.5))
    camX = largura / 2 - ((minX + maxX) / 2) * zoom
    camY = altura / 2 - ((minY + maxY) / 2) * zoom
    aplicarCamera()
  }

  // ---------- Mouse: arrastar notas e navegar ----------

  function pontoNoMundo(e) {
    const r = svg.getBoundingClientRect()
    return { x: (e.clientX - r.left - camX) / zoom, y: (e.clientY - r.top - camY) / zoom }
  }

  function iniciarArrasto(e, no) {
    if (e.button !== 0) return
    e.stopPropagation()
    svg.setPointerCapture(e.pointerId)
    arrasto = { tipo: 'no', no, inicioX: e.clientX, inicioY: e.clientY, moveu: false }
    no.fixo = true
  }

  function terminarArrasto() {
    if (!arrasto) return
    if (arrasto.tipo === 'no') {
      arrasto.no.fixo = false
      // Se o mouse quase não se mexeu, foi um clique: abre a nota
      if (!arrasto.moveu) abrirNota(arrasto.no.id)
    }
    svg.classList.remove('arrastando')
    arrasto = null
  }

  function iniciar(aoAbrirNota) {
    abrirNota = aoAbrirNota

    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || arrasto) return
      svg.setPointerCapture(e.pointerId)
      arrasto = { tipo: 'fundo', ultimoX: e.clientX, ultimoY: e.clientY }
      svg.classList.add('arrastando')
    })

    svg.addEventListener('pointermove', (e) => {
      if (!arrasto) return
      if (arrasto.tipo === 'fundo') {
        camX += e.clientX - arrasto.ultimoX
        camY += e.clientY - arrasto.ultimoY
        arrasto.ultimoX = e.clientX
        arrasto.ultimoY = e.clientY
        aplicarCamera()
        return
      }
      if (Math.hypot(e.clientX - arrasto.inicioX, e.clientY - arrasto.inicioY) > 4) {
        arrasto.moveu = true
      }
      if (arrasto.moveu) {
        const p = pontoNoMundo(e)
        arrasto.no.x = p.x
        arrasto.no.y = p.y
        aquecer(0.3)
        desenhar()
      }
    })

    svg.addEventListener('pointerup', terminarArrasto)
    svg.addEventListener('pointercancel', terminarArrasto)

    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = svg.getBoundingClientRect()
        aplicarZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top)
      },
      { passive: false }
    )

    const centro = () => [svg.clientWidth / 2, svg.clientHeight / 2]
    document.getElementById('grafo-zoom-mais').addEventListener('click', () => aplicarZoom(1.25, ...centro()))
    document.getElementById('grafo-zoom-menos').addEventListener('click', () => aplicarZoom(1 / 1.25, ...centro()))
    document.getElementById('grafo-ajustar').addEventListener('click', ajustarATela)

    nomesCheck.addEventListener('change', atualizarRotulos)
    corPor.addEventListener('change', recolorir)
    orfasCheck.addEventListener('change', construir)
  }

  // Chamado quando a aba do grafo aparece ou some
  function definirVisivel(valor) {
    visivel = valor
    if (!valor) return
    if (!cameraPronta) {
      centralizar()
      cameraPronta = true
    }
    desenhar()
    if (alfa >= 0.01) iniciarLoop()
  }

  return { iniciar, atualizar, definirVisivel }
})()