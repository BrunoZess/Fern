const Arquivo = (() => {
  const NS = 'http://www.w3.org/2000/svg'
  const MIME = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
  }

  const $ = (id) => document.getElementById(id)
  const area = $('arq-area')
  const paginasEl = $('arq-paginas')
  const msgEl = $('arq-msg')
  const nomeEl = $('arq-nome')
  const infoEl = $('arq-info')
  const zoomEl = $('arq-zoom-pct')
  const painel = $('arq-desenho')
  const btnDesenhar = $('arq-desenhar')

  let meta = null
  let tipo = null
  let pdf = null
  let urlImagem = null
  let paginas = []
  let escala = 1
  let ferramenta = false
  let visivel = false
  let arrasto = null
  let observador = null
  let timerRender = null
  let carregando = null
  let escalaAnim = null
  let pdfjs = null
  let painelTinta = null
  let aoAviso = () => {}
  const pilha = []

  async function carregarPdfjs() {
    if (pdfjs) return pdfjs
    pdfjs = await import('./node_modules/pdfjs-dist/build/pdf.min.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      './node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
      document.baseURI
    ).href
    return pdfjs
  }

  function mostrarMensagem(texto) {
    msgEl.textContent = texto
    msgEl.hidden = false
  }

  function limpar() {
    if (observador) observador.disconnect()
    observador = null
    clearTimeout(timerRender)
    for (const p of paginas) {
      if (p.tarefa) {
        try {
          p.tarefa.cancel()
        } catch {
        }
      }
    }
    paginasEl.replaceChildren()
    paginas = []
    if (pdf) {
      try {
        pdf.destroy()
      } catch {
      }
      pdf = null
    }
    if (urlImagem) {
      URL.revokeObjectURL(urlImagem)
      urlImagem = null
    }
    pilha.length = 0
    msgEl.hidden = true
  }


  function criarPagina(n, w, h) {
    const caixa = document.createElement('div')
    caixa.className = 'arq-pagina'
    caixa.dataset.n = String(n)
    const base = document.createElement(tipo === 'pdf' ? 'canvas' : 'img')
    base.className = 'arq-base'
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('class', 'arq-tracos')
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    caixa.append(base, svg)
    paginasEl.appendChild(caixa)
    return { n, w, h, caixa, base, svg, renderizada: false, versao: 0, tarefa: null, tracos: [] }
  }

  async function montarPdf(bytes, token) {
    const lib = await carregarPdfjs()
    pdf = await lib.getDocument({ data: bytes }).promise
    tipo = 'pdf'
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n)
      const v = pagina.getViewport({ scale: 1 })
      pagina.cleanup()
      if (token !== carregando) return
      paginas.push(criarPagina(n, v.width, v.height))
    }
  }

  async function montarImagem(bytes) {
    tipo = 'imagem'
    urlImagem = URL.createObjectURL(new Blob([bytes], { type: MIME[meta.ext] || 'application/octet-stream' }))
    const img = new Image()
    img.src = urlImagem
    await img.decode()
    const p = criarPagina(1, img.naturalWidth || 800, img.naturalHeight || 600)
    p.base.src = urlImagem
    p.renderizada = true
    paginas.push(p)
  }

  function criarElementoTraco(p, t) {
    const el = document.createElementNS(NS, 'path')
    Tinta.aplicarEstilo(el, t.ferramenta, t.cor, t.espessura)
    el.setAttribute('d', Tinta.caminhoSuave(t.pontos))
    p.svg.appendChild(el)
    t.el = el
  }

  async function abrir(id) {
    if (meta && meta.id === id && paginas.length > 0) {
      renderizarVisiveis()
      return
    }
    const token = (carregando = Symbol())
    limpar()
    definirFerramenta(false)
    meta = null
    nomeEl.textContent = ''
    infoEl.textContent = ''

    const lista = await window.api.listarArquivos()
    if (token !== carregando) return
    meta = lista.find((a) => a.id === id) || null
    if (!meta) {
      mostrarMensagem('Arquivo não encontrado.')
      return
    }
    nomeEl.textContent = meta.nome
    mostrarMensagem('Carregando…')

    try {
      const bytes = await window.api.lerArquivo(id)
      if (token !== carregando) return
      if (meta.ext === 'pdf') await montarPdf(bytes, token)
      else await montarImagem(bytes)
      if (token !== carregando) return

      const salvos = await window.api.listarTracosArquivo(id)
      for (const linha of salvos) {
        const p = paginas[linha.pagina - 1]
        if (!p) continue
        let pontos = []
        try {
          pontos = JSON.parse(linha.pontos)
        } catch {
          pontos = []
        }
        const t = { id: linha.id, ferramenta: linha.ferramenta, cor: linha.cor, espessura: linha.espessura, pontos }
        p.tracos.push(t)
        criarElementoTraco(p, t)
      }

      msgEl.hidden = true
      if (observador === null) criarObservador()
      for (const p of paginas) if (tipo === 'pdf') observador.observe(p.caixa)
      ajustarLargura()
      atualizarInfo()
    } catch (erro) {
      if (token !== carregando) return
      const senha = erro && erro.name === 'PasswordException'
      mostrarMensagem(
        senha
          ? 'Este PDF tem senha e não pode ser aberto aqui. Use "Abrir no programa padrão".'
          : 'Não consegui abrir este arquivo. Use "Abrir no programa padrão".'
      )
    }
  }


  function criarObservador() {
    observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const p = paginas[Number(e.target.dataset.n) - 1]
          if (!p) continue
          if (e.isIntersecting) renderizarPagina(p)
          else liberarPagina(p)
        }
      },
      { root: area, rootMargin: '1200px 0px' }
    )
  }

  async function renderizarPagina(p) {
    if (tipo !== 'pdf' || p.renderizada || !pdf) return
    p.renderizada = true
    const versao = ++p.versao
    const doc = pdf
    try {
      const pagina = await doc.getPage(p.n)
      if (versao !== p.versao || doc !== pdf) return
      const dpr = window.devicePixelRatio || 1
      const passo = Math.min(escala * dpr, 8192 / Math.max(p.w, p.h))
      const viewport = pagina.getViewport({ scale: passo })

      const rascunho = document.createElement('canvas')
      rascunho.width = Math.floor(viewport.width)
      rascunho.height = Math.floor(viewport.height)
      p.tarefa = pagina.render({ canvasContext: rascunho.getContext('2d'), viewport })
      await p.tarefa.promise
      if (versao !== p.versao) return
      p.base.width = rascunho.width
      p.base.height = rascunho.height
      p.base.getContext('2d').drawImage(rascunho, 0, 0)
    } catch (erro) {
      if (versao === p.versao && !(erro && erro.name === 'RenderingCancelledException')) p.renderizada = false
    }
  }

  function liberarPagina(p) {
    if (tipo !== 'pdf') return
    p.versao++
    if (p.tarefa) {
      try {
        p.tarefa.cancel()
      } catch {
      }
      p.tarefa = null
    }
    p.base.width = 0
    p.base.height = 0
    p.renderizada = false
  }

  function renderizarVisiveis() {
    if (!visivel || tipo !== 'pdf') return
    const a = area.getBoundingClientRect()
    for (const p of paginas) {
      const r = p.caixa.getBoundingClientRect()
      if (r.bottom > a.top - 1200 && r.top < a.bottom + 1200) renderizarPagina(p)
    }
  }

  function refazer() {
    for (const p of paginas) {
      p.versao++
      p.renderizada = false
      if (p.tarefa) {
        try {
          p.tarefa.cancel()
        } catch {
        }
        p.tarefa = null
      }
    }
    clearTimeout(timerRender)
    timerRender = setTimeout(renderizarVisiveis, 120)
  }

  function layout() {
    for (const p of paginas) {
      p.caixa.style.width = `${p.w * escala}px`
      p.caixa.style.height = `${p.h * escala}px`
    }
    zoomEl.textContent = `${Math.round(escala * 100)}%`
  }

  function definirEscala(nova, yAncora) {
    const origem = escalaAnim ? escalaAnim.alvo : escala
    const alvo = Math.min(6, Math.max(0.2, nova))
    if (alvo === escala && !escalaAnim) return
    const y = yAncora === undefined ? area.clientHeight / 2 : yAncora
    const ponto = (area.scrollTop + y) / escala
    escalaAnim = { de: escala, alvo, y, ponto, t0: performance.now() }
    tickEscala()
  }

  function tickEscala() {
    const a = escalaAnim
    const t = Math.min(1, (performance.now() - a.t0) / 130)
    const k = 1 - Math.pow(1 - t, 3)
    escala = a.de + (a.alvo - a.de) * k
    layout()
    area.scrollTop = a.ponto * escala - a.y
    if (t < 1 && escalaAnim === a) requestAnimationFrame(tickEscala)
    else if (escalaAnim === a) {
      escalaAnim = null
      refazer()
    }
  }

  function ajustarLargura() {
    if (paginas.length === 0) return
    const maior = Math.max(...paginas.map((p) => p.w))
    escala = Math.min(6, Math.max(0.2, Math.max(200, area.clientWidth - 48) / maior))
    layout()
    area.scrollTop = 0
    refazer()
  }

  function atualizarInfo() {
    if (!meta || paginas.length === 0) return
    if (tipo !== 'pdf') {
      infoEl.textContent = `${paginas[0].w} × ${paginas[0].h} px`
      return
    }
    const referencia = area.scrollTop + area.clientHeight / 3
    let atual = 1
    for (const p of paginas) {
      if (p.caixa.offsetTop <= referencia) atual = p.n
      else break
    }
    infoEl.textContent = `Página ${atual} de ${paginas.length}`
  }


  let borrachaCursor = null

  function criarBorrachaCursor() {
    if (borrachaCursor) return borrachaCursor
    borrachaCursor = document.createElement('div')
    borrachaCursor.className = 'borracha-cursor'
    area.appendChild(borrachaCursor)
    return borrachaCursor
  }

  function moverBorrachaCursor(e) {
    const el = criarBorrachaCursor()
    const r = area.getBoundingClientRect()
    const d = (8 + Tinta.estado.tamanho) * 2
    el.style.width = d + 'px'
    el.style.height = d + 'px'
    el.style.left = e.clientX - r.left + area.scrollLeft - d / 2 + 'px'
    el.style.top = e.clientY - r.top + area.scrollTop - d / 2 + 'px'
    el.hidden = false
  }

  function esconderBorrachaCursor() {
    if (borrachaCursor) borrachaCursor.hidden = true
  }

  function definirFerramenta(valor) {
    ferramenta = valor || false
    painel.hidden = !ferramenta
    btnDesenhar.classList.toggle('ativo', Boolean(ferramenta))
    paginasEl.classList.toggle('desenhando', Boolean(ferramenta))
    area.classList.toggle('modo-borracha', ferramenta === 'borracha')
    if (ferramenta !== 'borracha') esconderBorrachaCursor()
    if (painelTinta) painelTinta.marcar(ferramenta)
  }

  function paginaEm(x, y, alvo) {
    const el = (alvo && alvo.closest && alvo.closest('.arq-pagina')) || document.elementFromPoint(x, y)?.closest('.arq-pagina')
    return el ? paginas[Number(el.dataset.n) - 1] : null
  }

  function pontoNaPagina(p, e) {
    const r = p.caixa.getBoundingClientRect()
    return { x: (e.clientX - r.left) / escala, y: (e.clientY - r.top) / escala }
  }

  const unidade = (p) => Math.max(1, p.w / 700)

  async function salvarTraco(a) {
    const pontos = a.pontos.length === 2 ? [...a.pontos, ...a.pontos] : Tinta.suavizar(a.pontos)
    try {
      const criado = await window.api.criarTracoArquivo(meta.id, a.p.n, a.ferramenta, a.cor, a.espessura, pontos)
      const t = { id: criado.id, ferramenta: a.ferramenta, cor: a.cor, espessura: a.espessura, pontos, el: a.el }
      a.p.tracos.push(t)
      pilha.push({ p: a.p, t })
    } catch {
      a.el.remove()
      aoAviso('Não consegui salvar o rabisco')
    }
  }

  function removerTraco(p, t) {
    t.el.remove()
    p.tracos = p.tracos.filter((x) => x !== t)
    window.api.removerTracoArquivo(t.id).catch(() => {})
    const i = pilha.findIndex((x) => x.t === t)
    if (i >= 0) pilha.splice(i, 1)
  }

  function cortarPontos(pts, x, y, raio) {
    const runs = []
    let atual = []
    for (let i = 0; i + 1 < pts.length; i += 2) {
      if (Math.hypot(pts[i] - x, pts[i + 1] - y) <= raio) {
        if (atual.length) runs.push(atual)
        atual = []
      } else {
        atual.push(pts[i], pts[i + 1])
      }
    }
    if (atual.length) runs.push(atual)
    return runs.filter((r) => r.length >= 4)
  }

  const caminhoDosRuns = (runs) => runs.map((run) => Tinta.caminhoSuave(run)).join(' ')

  function apagarEm(e) {
    const p = paginaEm(e.clientX, e.clientY, null)
    if (!p) return
    const ponto = pontoNaPagina(p, e)
    const raio = (8 + Tinta.estado.tamanho) / escala
    const restantes = []
    for (const t of p.tracos) {
      const r = raio + t.espessura / 2
      const runs = t._runs || [t.pontos]
      const novas = []
      let mudou = false
      for (const run of runs) {
        const cort = cortarPontos(run, ponto.x, ponto.y, r)
        novas.push(...cort)
        if (cort.length !== 1 || cort[0]?.length !== run.length) mudou = true
      }
      if (!mudou) {
        restantes.push(t)
        continue
      }
      if (novas.length === 0) {
        t.el.remove()
        if (arrasto?.mortos) arrasto.mortos.push({ p, t })
        continue
      }
      t._runs = novas
      t._sujo = true
      t.el.setAttribute('d', caminhoDosRuns(novas))
      restantes.push(t)
    }
    p.tracos = restantes
  }

  async function persistirCortes(a) {
    const vistos = new Set()
    const paginasAfetadas = new Set()
    for (const { p, t } of a.mortos || []) {
      if (vistos.has(t)) continue
      vistos.add(t)
      paginasAfetadas.add(p)
      window.api.removerTracoArquivo(t.id).catch(() => {})
      const i = pilha.findIndex((x) => x.t === t)
      if (i >= 0) pilha.splice(i, 1)
    }
    for (const p of paginasAfetadas) {
      for (const t of p.tracos.filter((x) => x._sujo)) {
        const runs = t._runs
        t.el.remove()
        p.tracos = p.tracos.filter((x) => x !== t)
        window.api.removerTracoArquivo(t.id).catch(() => {})
        const i = pilha.findIndex((x) => x.t === t)
        if (i >= 0) pilha.splice(i, 1)
        for (const run of runs) {
          try {
            const criado = await window.api.criarTracoArquivo(meta.id, p.n, t.ferramenta, t.cor, t.espessura, run)
            const novo = { id: criado.id, ferramenta: t.ferramenta, cor: t.cor, espessura: t.espessura, pontos: run }
            p.tracos.push(novo)
            criarElementoTraco(p, novo)
          } catch {
          }
        }
      }
    }
  }

  function desfazer() {
    const ultimo = pilha[pilha.length - 1]
    if (!ultimo) {
      aoAviso('Nada para desfazer')
      return
    }
    removerTraco(ultimo.p, ultimo.t)
  }


  function iniciar(opcoes = {}) {
    aoAviso = opcoes.aoAviso || aoAviso
    painelTinta = Tinta.montarPainel(painel, (f) => definirFerramenta(f))
    btnDesenhar.addEventListener('click', () => definirFerramenta(ferramenta ? false : 'caneta'))

    $('arq-zoom-mais').addEventListener('click', () => definirEscala(escala * 1.25))
    $('arq-zoom-menos').addEventListener('click', () => definirEscala(escala / 1.25))
    zoomEl.addEventListener('click', ajustarLargura)
    $('arq-externo').addEventListener('click', async () => {
      if (!meta) return
      const r = await window.api.abrirArquivoExterno(meta.id)
      if (!r.ok) aoAviso(r.motivo || 'Não consegui abrir este arquivo')
    })

    area.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) return
        e.preventDefault()
        const r = area.getBoundingClientRect()
        definirEscala(escala * Math.min(2, Math.max(0.5, Math.exp(-e.deltaY * 0.0016))), e.clientY - r.top)
      },
      { passive: false }
    )

    let quadro = null
    area.addEventListener('scroll', () => {
      if (quadro) return
      quadro = requestAnimationFrame(() => {
        quadro = null
        atualizarInfo()
      })
    })

    paginasEl.addEventListener('pointerdown', (e) => {
      if (!ferramenta || e.button !== 0) return
      const p = paginaEm(e.clientX, e.clientY, e.target)
      if (!p) return
      e.preventDefault()
      if (ferramenta === 'borracha') {
        arrasto = { tipo: 'borracha', mortos: [] }
        apagarEm(e)
        moverBorrachaCursor(e)
        return
      }
      const ponto = pontoNaPagina(p, e)
      const espessura = Tinta.espessura(ferramenta) * unidade(p)
      const el = document.createElementNS(NS, 'path')
      Tinta.aplicarEstilo(el, ferramenta, Tinta.estado.cor, espessura)
      p.svg.appendChild(el)
      arrasto = {
        tipo: 'traco',
        p,
        el,
        ferramenta,
        cor: Tinta.estado.cor,
        espessura,
        pontos: [ponto.x, ponto.y],
        ultimoX: e.clientX,
        ultimoY: e.clientY,
      }
      el.setAttribute('d', Tinta.caminhoSuave(arrasto.pontos))
    })

    paginasEl.addEventListener('pointermove', (e) => {
      if (ferramenta === 'borracha') moverBorrachaCursor(e)
    })
    paginasEl.addEventListener('pointerleave', esconderBorrachaCursor)

    window.addEventListener('pointermove', (e) => {
      if (!arrasto) return
      if (arrasto.tipo === 'borracha') {
        apagarEm(e)
        moverBorrachaCursor(e)
        return
      }
      const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
      const limiar = Math.max(0.8, 1.2 * escala)
      for (const ev of eventos) {
        if (Math.hypot(ev.clientX - arrasto.ultimoX, ev.clientY - arrasto.ultimoY) < limiar) continue
        arrasto.ultimoX = ev.clientX
        arrasto.ultimoY = ev.clientY
        const ponto = pontoNaPagina(arrasto.p, ev)
        arrasto.pontos.push(ponto.x, ponto.y)
      }
      arrasto.el.setAttribute('d', Tinta.caminhoSuave(arrasto.pontos))
    })

    const terminar = async () => {
      if (!arrasto) return
      const a = arrasto
      arrasto = null
      if (a.tipo === 'traco') await salvarTraco(a)
      else if (a.tipo === 'borracha') await persistirCortes(a)
    }
    window.addEventListener('pointerup', terminar)
    window.addEventListener('pointercancel', terminar)

    window.addEventListener('resize', () => {
      if (visivel) renderizarVisiveis()
    })

    document.addEventListener('keydown', (e) => {
      if (!visivel) return
      const ativo = document.activeElement
      if (ativo && (ativo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName))) return
      const tecla = e.key.toLowerCase()

      if (e.ctrlKey || e.metaKey) {
        if (tecla === '=' || tecla === '+') {
          e.preventDefault()
          definirEscala(escala * 1.25)
        } else if (tecla === '-') {
          e.preventDefault()
          definirEscala(escala / 1.25)
        } else if (tecla === '0') {
          e.preventDefault()
          ajustarLargura()
        } else if (tecla === 'z') {
          e.preventDefault()
          desfazer()
        }
        return
      }
      if (e.altKey) return
      if (e.key === 'Escape') definirFerramenta(false)
      else if (tecla === 'p') definirFerramenta(ferramenta ? false : 'caneta')
      else if (tecla === 'e') definirFerramenta('borracha')
    })
  }

  function definirVisivel(valor) {
    visivel = valor
    if (valor) renderizarVisiveis()
  }

  return { iniciar, abrir, definirVisivel }
})()