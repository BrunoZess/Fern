const MenuContexto = (() => {
  let menu = null
  let ancora = null

  function fechar() {
    if (menu) menu.remove()
    menu = null
    ancora = null
  }

  function criarItem(item) {
    if (item.separador) {
      const sep = document.createElement('div')
      sep.className = 'ctx-sep'
      return sep
    }

    if (item.cores) {
      const linha = document.createElement('div')
      linha.className = 'ctx-cores'
      for (const cor of item.cores) {
        const botao = document.createElement('button')
        botao.title = cor.id
        botao.style.background = cor.hex
        if (cor.id === item.atual) botao.classList.add('ativo')
        botao.addEventListener('click', () => {
          fechar()
          item.aoEscolher(cor.id)
        })
        linha.appendChild(botao)
      }
      return linha
    }

    const botao = document.createElement('button')
    botao.className = 'ctx-item' + (item.perigo ? ' perigo' : '')
    botao.disabled = Boolean(item.desativado)

    const rotulo = document.createElement('span')
    rotulo.textContent = item.rotulo
    botao.appendChild(rotulo)

    if (item.atalho) {
      const atalho = document.createElement('span')
      atalho.className = 'ctx-atalho'
      atalho.textContent = item.atalho
      botao.appendChild(atalho)
    }
    botao.addEventListener('click', () => {
      fechar()
      if (item.aoClicar) item.aoClicar()
    })
    return botao
  }

  function montar(itens) {
    const el = document.createElement('div')
    el.className = 'ctx-menu'
    el.addEventListener('mousedown', (e) => e.preventDefault())
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    for (const item of itens) el.appendChild(criarItem(item))
    return el
  }

  function posicionar(el, x, y) {
    document.body.appendChild(el)
    const margem = 8
    const esquerda = Math.min(x, window.innerWidth - el.offsetWidth - margem)
    const topo = Math.min(y, window.innerHeight - el.offsetHeight - margem)
    el.style.left = `${Math.max(margem, esquerda)}px`
    el.style.top = `${Math.max(margem, topo)}px`
  }

  function abrir(ponto, itens) {
    fechar()
    if (!itens || itens.length === 0) return
    menu = montar(itens)
    posicionar(menu, ponto.x, ponto.y)
  }

  function abrirEm(elemento, itens) {
    if (menu && ancora === elemento) {
      fechar()
      return
    }
    fechar()
    if (!itens || itens.length === 0) return
    const r = elemento.getBoundingClientRect()
    menu = montar(itens)
    ancora = elemento
    posicionar(menu, r.left, r.bottom + 4)
  }

  function ativarEmCampos() {
    document.addEventListener('contextmenu', (e) => {
      if (e.defaultPrevented) return
      const seletor =
        'input[type="text"], input[type="search"], textarea, [contenteditable="true"], [contenteditable="plaintext-only"]'
      const campo = e.target.closest(seletor)
      if (!campo) return
      e.preventDefault()

      const ehCampo = typeof campo.selectionStart === 'number'
      const temSelecao = ehCampo
        ? campo.selectionStart !== campo.selectionEnd
        : window.getSelection().toString() !== ''

      abrir({ x: e.clientX, y: e.clientY }, [
        { rotulo: 'Recortar', atalho: 'Ctrl+X', desativado: !temSelecao, aoClicar: () => document.execCommand('cut') },
        { rotulo: 'Copiar', atalho: 'Ctrl+C', desativado: !temSelecao, aoClicar: () => document.execCommand('copy') },
        {
          rotulo: 'Colar',
          atalho: 'Ctrl+V',
          aoClicar: async () => {
            const { texto } = await window.api.lerAreaTransferencia()
            if (texto) document.execCommand('insertText', false, texto)
          },
        },
        { separador: true },
        {
          rotulo: 'Selecionar tudo',
          atalho: 'Ctrl+A',
          aoClicar: () => (ehCampo ? campo.select() : document.execCommand('selectAll')),
        },
      ])
    })
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!menu) return
      if (menu.contains(e.target) || (ancora && ancora.contains(e.target))) return
      fechar()
    },
    true
  )
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fechar()
  })
  document.addEventListener('scroll', fechar, true)
  window.addEventListener('resize', fechar)
  window.addEventListener('blur', fechar)

  return { abrir, abrirEm, fechar, ativarEmCampos }
})()