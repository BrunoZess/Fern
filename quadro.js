// Quadro (canvas) estilo Miro: cartões soltos (post-its, imagens ou notas existentes) e conexões com seta.
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
  let cartoes = [] // { id, tipo: 'texto' | 'nota' | 'imagem', nota_id, texto, x, y, cor }
  let conexoes = [] // { id, de_id, para_id }
  const elementos = new Map() // id do cartão -> elemento HTML
  let notasPorId = new Map()
  let todasNotas = []
  let selCartoes = new Set() // ids dos cartões selecionados
  let selConexao = null // id da conexão selecionada
  let modoConectar = false
  let origem = null // id do cartão de origem ao conectar
  let corAtual = 'amarelo'
  let camX = 0
  let camY = 0
  let zoom = 1
  let visivel = false
  let arrasto = null
  let abrirNota = () => {}
  let ultimoPonteiro = null // posição do mouse sobre o quadro, em coordenadas do mundo
  let colarEmLinhas = false
  let topoZ = 1
  let avisoTimer = null
  let salvarTimer = null
  const pendentes = new Set() // cartões movidos pelo teclado que ainda não foram salvos

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
    selCartoes = new Set()
    selConexao = null
    modoConectar = false
    origem = null
    btnConectar.classList.remove('ativo')
    area.classList.remove('modo-conectar')
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

    elementos.set(c.id, el)
    camadaCartoes.appendChild(el)
  }

  function desenharTudo() {
    camadaCartoes.replaceChildren()
    elementos.clear()
    for (const c of cartoes) criarElementoCartao(c)
    selCartoes = new Set([...selCartoes].filter((id) => elementos.has(id)))
    if (selConexao !== null && !conexoes.some((k) => k.id === selConexao)) selConexao = null
    for (const [id, el] of elementos) el.classList.toggle('selecionado', selCartoes.has(id))
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
    tituloEl.textContent = `${quadro.nome} · ${n} ${n === 1 ? 'cartão' : 'cartões'}`
  }

  function atualizarDica() {
    if (modoConectar) {
      dicaEl.textContent = origem
        ? 'Clique no cartão de destino (Esc cancela)'
        : 'Clique no cartão de origem (Esc cancela)'
    } else if (cartoes.length === 0) {
      dicaEl.textContent = 'Duplo clique cria um post-it · Ctrl+V cola texto ou imagem'
    } else {
      dicaEl.textContent = ''
    }
  }

  // Mensagem rápida na parte de baixo
  function aviso(texto) {
    dicaEl.textContent = texto
    clearTimeout(avisoTimer)
    avisoTimer = setTimeout(atualizarDica, 2200)
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

      const sel = selConexao === k.id
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

  // ---------- Seleção ----------

  function atualizarSelecaoVisual() {
    for (const [id, el] of elementos) el.classList.toggle('selecionado', selCartoes.has(id))
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
    desenharConexoes()
    atualizarTitulo()
    atualizarDica()
  }

  // ---------- Posições ----------

  function salvarPosicoes(lista) {
    return Promise.all(lista.map((c) => window.api.moverCartao(c.id, c.x, c.y)))
  }

  // Salva depois de uma pausa (usado ao mover com as setas)
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

  // Arruma os cartões (os selecionados, ou todos) em linhas e colunas
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

  // Onde colar: embaixo do mouse, se ele estiver sobre o quadro; senão, perto do centro
  function posicaoParaColar() {
    if (ultimoPonteiro) return { x: ultimoPonteiro.x - LARGURA / 2, y: ultimoPonteiro.y - 30 }
    return pertoDoCentro()
  }

  function adicionarCartaoLocal(c) {
    cartoes.push(c)
    criarElementoCartao(c)
    atualizarTitulo()
    atualizarDica()
  }

  async function criarPostit(x, y) {
    if (!quadro) return
    const c = await window.api.criarCartao(quadro.id, 'texto', null, '', x, y, corAtual)
    if (!c) return
    adicionarCartaoLocal(c)
    selecionarCartoes([c.id])
    iniciarEdicao(elementos.get(c.id), c)
  }

  async function adicionarNota(nota) {
    if (!quadro) return
    const pos = pertoDoCentro()
    const c = await window.api.criarCartao(quadro.id, 'nota', nota.id, '', pos.x, pos.y, 'branco')
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
      const copia = await window.api.criarCartao(quadro.id, c.tipo, null, c.texto, c.x + 30, c.y + 30, c.cor)
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

  // Reduz a imagem (lado maior até 900 px) para o banco não ficar pesado
  async function reduzirImagem(blob, ladoMax = 900) {
    const img = await carregarImagem(blob)
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * escala))
    canvas.height = Math.max(1, Math.round(img.height * escala))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const png = canvas.toDataURL('image/png')
    return png.length < 1500000 ? png : canvas.toDataURL('image/jpeg', 0.85)
  }

  async function colarImagem(blob, pos) {
    try {
      const dataUrl = await reduzirImagem(blob)
      const c = await window.api.criarCartao(quadro.id, 'imagem', null, dataUrl, pos.x, pos.y, 'branco')
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
      const c = await window.api.criarCartao(quadro.id, 'texto', null, conteudo.slice(0, 2000), pos.x, pos.y, corAtual)
      if (c) {
        adicionarCartaoLocal(c)
        selecionarCartoes([c.id])
      }
      return
    }

    // Cada linha vira um post-it, organizados em 3 colunas
    const linhas = conteudo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 60)
    const criados = []
    for (let i = 0; i < linhas.length; i++) {
      const x = pos.x + (i % 3) * (LARGURA + 20)
      const y = pos.y + Math.floor(i / 3) * 110
      const c = await window.api.criarCartao(quadro.id, 'texto', null, linhas[i], x, y, corAtual)
      if (c) {
        adicionarCartaoLocal(c)
        criados.push(c.id)
      }
    }
    selecionarCartoes(criados)
    aviso(`${criados.length} post-its criados`)
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

  // Vale para a próxima cor de post-it e para todos os post-its selecionados
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

  function estaDigitando() {
    const ativo = document.activeElement
    return Boolean(ativo && (ativo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName)))
  }

  // ---------- Menu do botão direito ----------

  let baixoZ = 0

  function trazerParaFrente() {
    for (const id of selCartoes) elementos.get(id).style.zIndex = String(++topoZ)
  }

  function enviarParaTras() {
    for (const id of selCartoes) elementos.get(id).style.zIndex = String(--baixoZ)
  }

  async function colarDoSistema(pos) {
    try {
      const { texto, imagem } = await window.api.lerAreaTransferencia()
      if (imagem) {
        const blob = await (await fetch(imagem)).blob()
        await colarImagem(blob, { x: pos.x - LARGURA / 2, y: pos.y - 30 })
      } else if (texto && texto.trim()) {
        ultimoPonteiro = pos
        await colarTexto(texto, false)
      } else {
        aviso('Área de transferência vazia')
      }
    } catch {
      aviso('Não consegui colar')
    }
  }

  function itensDoFundo(pos) {
    return [
      { rotulo: 'Novo post-it aqui', aoClicar: () => criarPostit(pos.x - LARGURA / 2, pos.y - 30) },
      { rotulo: 'Colar', atalho: 'Ctrl+V', aoClicar: () => colarDoSistema(pos) },
      { rotulo: 'Adicionar nota existente…', aoClicar: abrirSeletor },
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

  function configurarMenuContexto() {
    area.addEventListener('contextmenu', (e) => {
      // Editando o texto de um post-it: deixa o menu de recortar/copiar/colar cuidar disso
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
        selecionarConexao(Number(conexaoEl.dataset.id))
        MenuContexto.abrir(ponto, [
          { rotulo: 'Apagar conexão', atalho: 'Delete', perigo: true, aoClicar: removerSelecao },
        ])
      } else {
        MenuContexto.abrir(ponto, itensDoFundo(pontoNoMundo(e)))
      }
    })
  }
  function iniciar(aoAbrirNota) {
    abrirNota = aoAbrirNota
    construirPaleta()
    configurarMenuContexto()

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
        cartaoEl.style.zIndex = String(++topoZ)

        // Shift ou Ctrl + clique: adiciona ou tira o cartão da seleção
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
          // clicar (sem arrastar) num cartão de uma seleção múltipla deixa só ele selecionado
          reduzir: jaSelecionado && selCartoes.size > 1,
        }
      } else if (conexaoEl) {
        selecionarConexao(Number(conexaoEl.dataset.id))
      } else if (e.shiftKey) {
        // Shift + arrastar no fundo: caixa de seleção
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
        return
      }

      if (arrasto.tipo === 'caixa') {
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
          const cruza =
            c.x < maxX && c.x + el.offsetWidth > minX && c.y < maxY && c.y + el.offsetHeight > minY
          if (cruza) ids.add(c.id)
        }
        selecionarCartoes(ids)
        return
      }

      // Arrastando cartões (todos os selecionados juntos)
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
      }
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
      else if (c.tipo === 'nota' && notasPorId.has(c.nota_id)) abrirNota(c.nota_id)
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

    // Arrastar imagens do Windows para o quadro
    area.addEventListener('dragover', (e) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault()
    })
    area.addEventListener('drop', async (e) => {
      const arquivos = Array.from(e.dataTransfer?.files || [])
      if (arquivos.length === 0) return
      e.preventDefault() // evita o Electron abrir o arquivo na janela
      if (!quadro) return
      const p = pontoNoMundo(e)
      let i = 0
      for (const arquivo of arquivos.filter((f) => f.type.startsWith('image/'))) {
        await colarImagem(arquivo, { x: p.x - LARGURA / 2 + i * 30, y: p.y - 30 + i * 30 })
        i++
      }
    })

    // Colar (Ctrl+V): texto vira post-it, imagem vira cartão de imagem
    document.addEventListener('paste', async (e) => {
      if (!visivel || !quadro || estaDigitando()) return
      const dados = e.clipboardData
      if (!dados) return
      e.preventDefault()
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

    document.addEventListener('keydown', (e) => {
      if (!visivel) return
      if (e.key === 'Escape') {
        if (!seletor.hidden) fecharSeletor()
        else if (modoConectar) alternarConectar(false)
        else limparSelecao()
        return
      }
      if (estaDigitando()) return

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
        } else if (tecla === 'v' && e.shiftKey) {
          colarEmLinhas = true // o evento "paste" chega logo depois
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
    document.getElementById('quadro-organizar')?.addEventListener('click', organizarEmGrade)
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