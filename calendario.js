// Calendário mensal: lembretes tirados das datas escritas nas notas (com cor própria)
// e notinhas escritas direto no dia (guardadas no banco).
const Calendario = (() => {
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const CORES = {
    vermelho: '#ef4444',
    laranja: '#f59e0b',
    amarelo: '#eab308',
    verde: '#10b981',
    azul: '#3b82f6',
    roxo: '#8b5cf6',
    rosa: '#ec4899',
    cinza: '#8b8b93',
  }
  const LISTA_CORES = Object.entries(CORES).map(([id, hex]) => ({ id, hex }))
  const COR_EVENTO = 'azul'
  const COR_NOTINHA = 'amarelo'

  const tituloEl = document.getElementById('cal-titulo')
  const semanaEl = document.getElementById('cal-semana')
  const gradeEl = document.getElementById('cal-grade')
  const diaTituloEl = document.getElementById('cal-dia-titulo')
  const diaListaEl = document.getElementById('cal-dia-lista')

  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const dataDeIso = (s) => {
    const [a, m, d] = s.split('-').map(Number)
    return new Date(a, m - 1, d)
  }
  const hexDe = (cor) => CORES[cor] || CORES[COR_EVENTO]

  const agora = new Date()
  let mes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  let selecionado = iso(agora)
  let porDia = new Map()
  let titulosDasNotas = new Map()
  let abrirNota = () => {}
  let abrirDia = () => {}
  let aoMudar = () => {}
  let popover = null
  let coresEventos = {}
  try {
    coresEventos = JSON.parse(localStorage.getItem('coresEventos') || '{}')
  } catch {
    coresEventos = {}
  }

  function corDoItem(item) {
    return item.tipo === 'notinha' ? item.cor : coresEventos[item.chave] || COR_EVENTO
  }

  function comparar(a, b) {
    if (a.tipo !== b.tipo) return a.tipo === 'evento' ? -1 : 1
    if (a.tipo === 'evento') {
      return (a.hora || '99').localeCompare(b.hora || '99') || a.titulo.localeCompare(b.titulo, 'pt-BR')
    }
    return a.id - b.id
  }

  function atualizar(notas, notinhas = []) {
    titulosDasNotas = new Map(notas.map((n) => [n.id, Links.titulo(n.texto) || 'Sem título']))
    porDia = new Map()
    const colocar = (item) => {
      if (!porDia.has(item.data)) porDia.set(item.data, [])
      porDia.get(item.data).push(item)
    }
    for (const e of Datas.extrairTodos(notas)) {
      colocar({ ...e, tipo: 'evento', chave: `${e.notaId}|${e.data}|${Links.normalizar(e.titulo)}` })
    }
    for (const n of notinhas) {
      colocar({ tipo: 'notinha', id: n.id, data: n.data, texto: n.texto, cor: n.cor })
    }
    for (const lista of porDia.values()) lista.sort(comparar)
    desenhar()
  }

  // ---------- Cores e ações de cada item ----------

  function definirCorEvento(item, cor) {
    if (cor) coresEventos[item.chave] = cor
    else delete coresEventos[item.chave]
    try {
      localStorage.setItem('coresEventos', JSON.stringify(coresEventos))
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
    desenhar()
  }

  async function mudarCorNotinha(item, cor) {
    await window.api.editarNotinha(item.id, item.texto, cor)
    aoMudar()
  }

  async function apagarNotinha(item) {
    await window.api.removerNotinha(item.id)
    aoMudar()
  }

  function acionar(item, rect) {
    if (item.tipo === 'evento') abrirNota(item.notaId)
    else abrirPopover({ data: item.data, notinha: item, rect })
  }

  function menuDoItem(ev, item, rect) {
    const itens = []
    if (item.tipo === 'evento') {
      itens.push(
        { rotulo: 'Abrir nota', aoClicar: () => abrirNota(item.notaId) },
        { separador: true },
        { cores: LISTA_CORES, atual: corDoItem(item), aoEscolher: (cor) => definirCorEvento(item, cor) },
        { rotulo: 'Cor padrão', aoClicar: () => definirCorEvento(item, null) }
      )
    } else {
      itens.push(
        { rotulo: 'Editar', aoClicar: () => abrirPopover({ data: item.data, notinha: item, rect }) },
        { cores: LISTA_CORES, atual: item.cor, aoEscolher: (cor) => mudarCorNotinha(item, cor) },
        { separador: true },
        { rotulo: 'Apagar notinha', perigo: true, aoClicar: () => apagarNotinha(item) }
      )
    }
    MenuContexto.abrir({ x: ev.clientX, y: ev.clientY }, itens)
  }

  // ---------- Itens no calendário ----------

  function criarItem(item, comoLista) {
    const hex = hexDe(corDoItem(item))
    const el = document.createElement(comoLista ? 'li' : 'div')

    if (comoLista) {
      el.style.borderLeftColor = hex
      if (item.tipo === 'evento') {
        if (item.hora) {
          const hora = document.createElement('span')
          hora.className = 'hora'
          hora.textContent = item.hora
          el.appendChild(hora)
        }
        el.appendChild(document.createTextNode(item.titulo))
        const pequeno = document.createElement('small')
        pequeno.textContent = `Da nota: ${titulosDasNotas.get(item.notaId) || '—'}`
        el.appendChild(pequeno)
      } else {
        const texto = document.createElement('span')
        texto.className = 'cal-item-texto'
        texto.textContent = item.texto
        el.appendChild(texto)
        const pequeno = document.createElement('small')
        pequeno.textContent = 'Notinha · clique para editar'
        el.appendChild(pequeno)
      }
    } else {
      el.className = 'cal-evento' + (item.tipo === 'notinha' ? ' notinha' : '') + (item.feita ? ' feita' : '')
      el.style.borderLeftColor = hex
      el.style.background =
        item.tipo === 'notinha'
          ? `color-mix(in srgb, ${hex} 30%, var(--bg))`
          : `color-mix(in srgb, ${hex} 14%, transparent)`
      el.textContent =
        item.tipo === 'notinha'
          ? item.texto.split('\n')[0]
          : (item.hora ? item.hora + ' ' : '') + item.titulo
    }

    el.title = item.tipo === 'notinha' ? item.texto : item.titulo
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      acionar(item, el.getBoundingClientRect())
    })
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      menuDoItem(ev, item, el.getBoundingClientRect())
    })
    return el
  }

  function desenharDia() {
    diaTituloEl.textContent = dataDeIso(selecionado).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    diaListaEl.replaceChildren()
    const lista = porDia.get(selecionado) || []
    if (lista.length === 0) {
      const vazio = document.createElement('li')
      vazio.textContent = 'Nada neste dia.'
      vazio.style.cursor = 'default'
      diaListaEl.appendChild(vazio)
      return
    }
    for (const item of lista) diaListaEl.appendChild(criarItem(item, true))
  }

  function selecionarDia(chave) {
    selecionado = chave
    desenhar()
  }

  function desenhar() {
    tituloEl.textContent = `${MESES[mes.getMonth()]} ${mes.getFullYear()}`
    gradeEl.replaceChildren()
    const hoje = iso(new Date())
    const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1 - mes.getDay())

    for (let i = 0; i < 42; i++) {
      const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
      const chave = iso(dia)
      const celula = document.createElement('div')
      celula.className =
        'cal-dia' +
        (dia.getMonth() !== mes.getMonth() ? ' fora' : '') +
        (chave === hoje ? ' hoje' : '') +
        (chave === selecionado ? ' selecionado' : '')

      const numero = document.createElement('span')
      numero.className = 'cal-num'
      numero.textContent = dia.getDate()
      celula.appendChild(numero)

      // O "+" do canto só aparece quando o mouse passa pelo dia
      const mais = document.createElement('button')
      mais.className = 'cal-add'
      mais.textContent = '+'
      mais.title = 'Nova notinha neste dia'
      mais.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const rect = mais.getBoundingClientRect()
        selecionarDia(chave)
        abrirPopover({ data: chave, rect })
      })
      celula.appendChild(mais)

      const lista = porDia.get(chave) || []
      for (const item of lista.slice(0, 3)) celula.appendChild(criarItem(item, false))
      if (lista.length > 3) {
        const resto = document.createElement('div')
        resto.className = 'cal-mais'
        resto.textContent = `+${lista.length - 3} mais`
        celula.appendChild(resto)
      }

      celula.addEventListener('click', () => selecionarDia(chave))
      gradeEl.appendChild(celula)
    }
    desenharDia()
  }

  // ---------- Balão para escrever uma notinha ----------

  function fecharPopover() {
    if (popover) popover.remove()
    popover = null
  }

  function abrirPopover({ data, notinha, rect }) {
    fecharPopover()
    let cor = notinha ? notinha.cor : COR_NOTINHA

    const caixa = document.createElement('div')
    caixa.className = 'cal-popover'

    const titulo = document.createElement('div')
    titulo.className = 'cal-popover-titulo'
    titulo.textContent = dataDeIso(data).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    const texto = document.createElement('textarea')
    texto.maxLength = 1000
    texto.placeholder = 'Escreva uma notinha… (Enter salva)'
    texto.value = notinha ? notinha.texto : ''

    const cores = document.createElement('div')
    cores.className = 'cal-cores'
    const marcar = () => {
      for (const b of cores.children) b.classList.toggle('ativo', b.dataset.cor === cor)
    }
    for (const c of LISTA_CORES) {
      const botao = document.createElement('button')
      botao.style.background = c.hex
      botao.title = c.id
      botao.dataset.cor = c.id
      botao.addEventListener('click', () => {
        cor = c.id
        marcar()
        texto.focus()
      })
      cores.appendChild(botao)
    }
    marcar()

    const salvar = async () => {
      const conteudo = texto.value.trim()
      if (!conteudo) {
        fecharPopover()
        return
      }
      if (notinha) await window.api.editarNotinha(notinha.id, conteudo, cor)
      else await window.api.criarNotinha(data, conteudo, cor)
      fecharPopover()
      aoMudar()
    }

    const botoes = document.createElement('div')
    botoes.className = 'cal-popover-botoes'
    if (notinha) {
      const apagar = document.createElement('button')
      apagar.className = 'perigo'
      apagar.textContent = 'Apagar'
      apagar.addEventListener('click', async () => {
        fecharPopover()
        await apagarNotinha(notinha)
      })
      botoes.appendChild(apagar)
    }
    const espaco = document.createElement('span')
    espaco.className = 'espaco'
    const cancelar = document.createElement('button')
    cancelar.textContent = 'Cancelar'
    cancelar.addEventListener('click', fecharPopover)
    const confirmar = document.createElement('button')
    confirmar.className = 'primario'
    confirmar.textContent = 'Salvar'
    confirmar.addEventListener('click', salvar)
    botoes.append(espaco, cancelar, confirmar)

    texto.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        salvar()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        fecharPopover()
      }
    })

    caixa.append(titulo, texto, cores, botoes)
    document.body.appendChild(caixa)
    const esquerda = Math.min(rect.left, window.innerWidth - caixa.offsetWidth - 12)
    const topo = Math.min(rect.bottom + 6, window.innerHeight - caixa.offsetHeight - 12)
    caixa.style.left = `${Math.max(8, esquerda)}px`
    caixa.style.top = `${Math.max(8, topo)}px`
    popover = caixa
    texto.focus()
    texto.setSelectionRange(texto.value.length, texto.value.length)
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (popover && !popover.contains(e.target)) fecharPopover()
    },
    true
  )

  // ---------- Navegação ----------

  function mudarMes(delta) {
    mes = new Date(mes.getFullYear(), mes.getMonth() + delta, 1)
    desenhar()
  }

  function irPara(dataIso) {
    const d = dataDeIso(dataIso)
    mes = new Date(d.getFullYear(), d.getMonth(), 1)
    selecionado = dataIso
    desenhar()
  }

  function definirVisivel(visivel) {
    if (!visivel) fecharPopover()
  }

  function iniciar(aoAbrirNota, aoAbrirDia, aoMudarDados) {
    abrirNota = aoAbrirNota
    abrirDia = aoAbrirDia || abrirDia
    aoMudar = aoMudarDados || aoMudar

    for (const nome of SEMANA) {
      const span = document.createElement('span')
      span.textContent = nome
      semanaEl.appendChild(span)
    }
    document.getElementById('cal-anterior').addEventListener('click', () => mudarMes(-1))
    document.getElementById('cal-proximo').addEventListener('click', () => mudarMes(1))
    document.getElementById('cal-hoje').addEventListener('click', () => irPara(iso(new Date())))
    document.getElementById('cal-nova-notinha').addEventListener('click', (e) => {
      abrirPopover({ data: selecionado, rect: e.currentTarget.getBoundingClientRect() })
    })
  }

  return { iniciar, atualizar, irPara, definirVisivel }
})()