// Quadro (canvas) estilo Miro: cartões soltos (post-its ou notas existentes) e conexões com seta.
// Câmera com pan e zoom; cartões são elementos HTML dentro de um "mundo" transformado.
// Este arquivo não conhece o Electron: usa window.api e recebe uma função para abrir uma nota.
const Quadro = (() => {
  const NS = 'http://www.w3.org/2000/svg'
  const LARGURA = 220
  const CORES = ['amarelo', 'rosa', 'verde', 'azul', 'roxo', 'branco']
  const HEX_COR = {
    amarelo: '#fde68a',
    rosa: '#fbcfe8',
    verde: '#bbf7d0',
    azul: '#bfdbfe',
    roxo: '#ddd6fe',
    branco: '#ffffff',
  }
  const ICONE_TIPO = { tarefa: '☑️', ideia: '💡', referencia: '🔖' }

  const area = document.getElementById('quadro-area')
  const mundo = document.getElementById('quadro-mundo')
  const camadaLinhas = document.getElementById('quadro-linhas')
  const camadaCartoes = document.getElementById('quadro-cartoes')
  const tituloEl = document.getElementById('quadro-titulo')
  const dicaEl = document.getElementById('quadro-dica')
  const btnConectar = document.getElementById('quadro-conectar')
  const paleta = document.getElementById('quadro-paleta')
  const seletor = document.getElementById('quadro-seletor')
  const seletorBusca = document.getElementById('quadro-seletor-busca')
  const seletorLista = document.getElementById('quadro-seletor-lista')

  let quadro = null
  let cartoes = [] // { id, tipo, nota_id, texto, x, y, cor }
  let conexoes = [] // { id, de_id, para_id }
  const elementos = new Map() // id do cartão -> elemento HTML
  let notasPorId = new Map()
  let todasNotas = []
  let selecionado = null // { tipo: 'cartao' | 'conexao', id }
  let modoConectar = false
  let origem = null // id do cartão de origem ao conectar
  let corAtual = 'amarelo'
  let camX = 0
  let camY = 0
  let zoom = 1
  let visivel = false
  let arrasto = null
  let abrirNota = () => {}

  // ---------- Carregar e desenhar ----------

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
    } else {
      quadro = dados.quadro
      cartoes = dados.cartoes
      conexoes = dados.conexoes
    }
    desenharTudo()
    if (ajustar) ajustarATela()
  }

  async function abrir(id) {
    selecionado = null
    modoConectar = false
    origem = null
    await carregar(id, true)
  }

  // Recarrega sem mexer na câmera (ex.: quando uma nota muda). Não interrompe edição nem arrasto.
  async function recarregar() {
    if (!quadro || arrasto) return
    const ativo = document.activeElement
    if (ativo && ativo.isContentEditable) return
    await carregar(quadro.id, false)
  }

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

    const corpo = document.createElement('div')
    corpo.className = 'corpo'

    if (c.tipo === 'nota') {
      const nota = notasPorId.get(c.nota_id)
      el.className = 'cartao nota' + (nota ? ' tipo-' + nota.tipo : '')
      if (nota) {
        const titulo = document.createElement('div')
        titulo.className = 'titulo'
        titulo.textContent = `${ICONE_TIPO[nota.tipo] || '📝'} ${Links.titulo(nota.texto) || '(sem título)'}`
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
      el.className = `cartao texto cor-${c.cor}`
      corpo.textContent = c.texto
      el.appendChild(corpo)
    }

    elementos.set(c.id, el)
    camadaCartoes.appendChild(el)
  }

  function desenharTudo() {
    camadaCartoes.replaceChildren()
    elementos.clear()
    for (const c of cartoes) criarElementoCartao(c)
    if (selecionado && selecionado.tipo === 'cartao' && !elementos.has(selecionado.id)) {
      selecionado = null
    }
    for (const [id, el] of elementos) {
      el.classList.toggle('selecionado', selecionado?.tipo === 'cartao' && selecionado.id === id)
    }
    marcarOrigem()
    desenharConexoes()
    atualizarTitulo()
    atualizarDica()
  }

  function atualizarTitulo() {
    if (!quadro) {
      tituloEl.textContent = 'Quadro não encontrado'
      return
    }
    const n = cartoes.length
    tituloEl.textContent = `🧩 ${quadro.nome} · ${n} ${n === 1 ? 'cartão' : 'cartões'}`
  }

  function atualizarDica() {
    if (modoConectar) {
      dicaEl.textContent = origem
        ? 'Clique no cartão de destino (Esc cancela)'
        : 'Clique no cartão de origem (Esc cancela)'
    } else if (cartoes.length === 0) {
      dicaEl.textContent = 'Duplo clique no fundo cria um post-it · 📝 adiciona uma nota existente'
    } else {
      dicaEl.textContent = ''
    }
  }

  // ---------- Conexões ----------

  // Ponto onde a reta do centro do cartão até (tx, ty) cruza a borda do retângulo
  function pontoNaBorda(cx, cy, metadeL, metadeA, tx, ty) {
    const dx = tx - cx
    const dy = ty - cy
    const escala = Math.min(metadeL / (Math.abs(dx) || 1e-9), metadeA / (Math.abs(dy) || 1e-9))
    return { x: cx + dx * escala, y: cy + dy * escala }
  }

  function criarLinha(classe) {
    const linha = document.createElementNS(NS, 'line')
    linha.setAttribute('class', classe)
    return linha
  }

  function desenharConexoes() {
    camadaLinhas.replaceChildren()
    const porId = new Map(cartoes.map((c) => [c.id, c]))

    for (const k of conexoes) {
      const a = porId.get(k.de_id)
      const b = porId.get(k.para_id)
      const elA = elementos.get(k.de_id)
      const elB = elementos.get(k.para_id)
      if (!a || !b || !elA || !elB) continue

      const ca = { x: a.x + elA.offsetWidth / 2, y: a.y + elA.offsetHeight / 2 }
      const cb = { x: b.x + elB.offsetWidth / 2, y: b.y + elB.offsetHeight / 2 }
      if (Math.hypot(cb.x - ca.x, cb.y - ca.y) < 1) continue

      const p1 = pontoNaBorda(ca.x, ca.y, elA.offsetWidth / 2, elA.offsetHeight / 2, cb.x, cb.y)
      const p2 = pontoNaBorda(cb.x, cb.y, elB.offsetWidth / 2, elB.offsetHeight / 2, ca.x, ca.y)

      const sel = selecionado?.tipo === 'conexao' && selecionado.id === k.id
      const grupo = document.createElementNS(NS, 'g')
      grupo.setAttribute('class', 'conexao-grupo' + (sel ? ' selecionado' : ''))
      grupo.dataset.id = k.id

      const hit = criarLinha('hit')
      const linha = criarLinha('linha')
      linha.setAttribute('marker-end', sel ? 'url(#quadro-seta-sel)' : 'url(#quadro-seta)')
      for (const l of [hit, linha]) {
        l.setAttribute('x1', p1.x)
        l.setAttribute('y1', p1.y)
        l.setAttribute('x2', p2.x)
        l.setAttribute('y2', p2.y)
      }
      grupo.append(hit, linha)
      camadaLinhas.appendChild(grupo)
    }
  }

  // ---------- Seleção, conexão e remoção ----------

  function selecionar(novo) {
    selecionado = novo
    for (const [id, el] of elementos) {
      el.classList.toggle('selecionado', Boolean(novo) && novo.tipo === 'cartao' && novo.id === id)
    }
    desenharConexoes()
  }

  function marcarOrigem() {
    for (const [id, el] of elementos) el.classList.toggle('origem', origem === id)
  }

  function alternarConectar(forcar) {
    modoConectar = typeof forcar === 'boolean' ? forcar : !modoConectar
    origem = null
    btnConectar.classList.toggle('ativo', modoConectar)
    area.classList.toggle('modo-conectar', modoConectar)
    marcarOrigem()
    atualizarDica()
  }

  async function tratarCliqueConectar(c) {
    if (!origem) {
      origem = c.id
    } else if (origem === c.id) {
      origem = null
    } else {
      const de = origem
      origem = null
      const conexao = await window.api.criarConexao(quadro.id, de, c.id)
      if (conexao) {
        conexoes.push(conexao)
        desenharConexoes()
      }
    }
    marcarOrigem()
    atualizarDica()
  }

  async function removerSelecao() {
    if (!selecionado) return
    const { tipo, id } = selecionado
    if (tipo === 'cartao') {
      await window.api.removerCartao(id)
      cartoes = cartoes.filter((c) => c.id !== id)
      conexoes = conexoes.filter((k) => k.de_id !== id && k.para_id !== id)
      elementos.get(id)?.remove()
      elementos.delete(id)
    } else {
      await window.api.removerConexao(id)
      conexoes = conexoes.filter((k) => k.id !== id)
    }
    selecionado = null
    desenharConexoes()
    atualizarTitulo()
    atualizarDica()
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

  async function criarPostit(x, y) {
    if (!quadro) return
    const c = await window.api.criarCartao(quadro.id, 'texto', null, '', x, y, corAtual)
    if (!c) return
    cartoes.push(c)
    criarElementoCartao(c)
    selecionar({ tipo: 'cartao', id: c.id })
    atualizarTitulo()
    atualizarDica()
    iniciarEdicao(elementos.get(c.id), c)
  }

  async function adicionarNota(nota) {
    if (!quadro) return
    const pos = pertoDoCentro()
    const c = await window.api.criarCartao(quadro.id, 'nota', nota.id, '', pos.x, pos.y, 'branco')
    if (!c) return
    cartoes.push(c)
    criarElementoCartao(c)
    selecionar({ tipo: 'cartao', id: c.id })
    desenharConexoes()
    atualizarTitulo()
    atualizarDica()
  }

  // ---------- Edição de post-it ----------

  function iniciarEdicao(el, c) {
    const corpo = el.querySelector('.corpo')
    corpo.contentEditable = 'plaintext-only'
    el.classList.add('cartao-editando')
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

  // ---------- Cores ----------

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
    if (selecionado?.tipo !== 'cartao') return
    const c = cartoes.find((x) => x.id === selecionado.id)
    if (!c || c.tipo !== 'texto') return
    c.cor = cor
    elementos.get(c.id).className = `cartao texto cor-${cor} selecionado`
    await window.api.editarCartao(c.id, c.texto, cor)
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
      titulo.textContent = `${ICONE_TIPO[nota.tipo] || '📝'} ${Links.titulo(nota.texto) || '(sem título)'}`
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
    const passo = 24 * zoom
    area.style.backgroundSize = `${passo}px ${passo}px`
    area.style.backgroundPosition = `${camX}px ${camY}px`
  }

  function aplicarZoom(fator, px, py) {
    const novo = Math.min(3, Math.max(0.2, zoom * fator))
    camX = px - (px - camX) * (novo / zoom)
    camY = py - (py - camY) * (novo / zoom)
    zoom = novo
    aplicarCamera()
  }

  function ajustarATela() {
    const largura = area.clientWidth
    const altura = area.clientHeight
    if (cartoes.length === 0) {
      zoom = 1
      camX = largura / 2
      camY = altura / 2
      aplicarCamera()
      return
    }
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
    const margem = 90
    const caixaL = maxX - minX + margem * 2
    const caixaA = maxY - minY + margem * 2
    zoom = Math.max(0.2, Math.min(largura / caixaL, altura / caixaA, 1.2))
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

  // ---------- Eventos ----------

  function iniciar(aoAbrirNota) {
    abrirNota = aoAbrirNota
    construirPaleta()

    area.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      if (e.target.closest('button')) return
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
        selecionar({ tipo: 'cartao', id: c.id })
        arrasto = {
          tipo: 'cartao',
          cartao: c,
          el: cartaoEl,
          inicioX: e.clientX,
          inicioY: e.clientY,
          origX: c.x,
          origY: c.y,
          moveu: false,
        }
      } else if (conexaoEl) {
        selecionar({ tipo: 'conexao', id: Number(conexaoEl.dataset.id) })
      } else {
        selecionar(null)
        arrasto = { tipo: 'fundo', ultimoX: e.clientX, ultimoY: e.clientY }
        area.classList.add('arrastando')
      }
    })

    window.addEventListener('pointermove', (e) => {
      if (!arrasto) return
      if (arrasto.tipo === 'fundo') {
        camX += e.clientX - arrasto.ultimoX
        camY += e.clientY - arrasto.ultimoY
        arrasto.ultimoX = e.clientX
        arrasto.ultimoY = e.clientY
        aplicarCamera()
        return
      }
      const andou = Math.hypot(e.clientX - arrasto.inicioX, e.clientY - arrasto.inicioY)
      if (!arrasto.moveu && andou < 4) return
      arrasto.moveu = true
      const c = arrasto.cartao
      c.x = arrasto.origX + (e.clientX - arrasto.inicioX) / zoom
      c.y = arrasto.origY + (e.clientY - arrasto.inicioY) / zoom
      arrasto.el.style.left = c.x + 'px'
      arrasto.el.style.top = c.y + 'px'
      desenharConexoes()
    })

    const terminarArrasto = async () => {
      if (!arrasto) return
      const a = arrasto
      arrasto = null
      area.classList.remove('arrastando')
      if (a.tipo === 'cartao' && a.moveu) await window.api.moverCartao(a.cartao.id, a.cartao.x, a.cartao.y)
    }
    window.addEventListener('pointerup', terminarArrasto)
    window.addEventListener('pointercancel', terminarArrasto)

    // Duplo clique: no fundo cria um post-it; num post-it edita; numa nota abre a nota
    area.addEventListener('dblclick', (e) => {
      if (e.target.closest('button') || modoConectar) return
      const cartaoEl = e.target.closest('.cartao')
      if (!cartaoEl) {
        const p = pontoNoMundo(e)
        criarPostit(p.x - LARGURA / 2, p.y - 30)
        return
      }
      const c = cartoes.find((x) => x.id === Number(cartaoEl.dataset.id))
      if (!c) return
      if (c.tipo === 'texto') iniciarEdicao(cartaoEl, c)
      else if (notasPorId.has(c.nota_id)) abrirNota(c.nota_id)
    })

    area.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = area.getBoundingClientRect()
        aplicarZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top)
      },
      { passive: false }
    )

    document.addEventListener('keydown', (e) => {
      if (!visivel) return
      if (e.key === 'Escape') {
        if (!seletor.hidden) fecharSeletor()
        else if (modoConectar) alternarConectar(false)
        else selecionar(null)
        return
      }
      const ativo = document.activeElement
      const digitando =
        ativo && (ativo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName))
      if (digitando || e.ctrlKey || e.altKey) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removerSelecao()
      } else if (e.key.toLowerCase() === 'n') {
        const p = pertoDoCentro()
        criarPostit(p.x, p.y)
      } else if (e.key.toLowerCase() === 'c') {
        alternarConectar()
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
    const centro = () => [area.clientWidth / 2, area.clientHeight / 2]
    document.getElementById('quadro-zoom-mais').addEventListener('click', () => aplicarZoom(1.25, ...centro()))
    document.getElementById('quadro-zoom-menos').addEventListener('click', () => aplicarZoom(1 / 1.25, ...centro()))

    // Janela de escolha de nota
    seletorBusca.addEventListener('input', renderizarSeletor)
    seletor.addEventListener('pointerdown', (e) => {
      if (e.target === seletor) fecharSeletor()
    })
  }

  return { iniciar, abrir, recarregar, definirVisivel }
})()