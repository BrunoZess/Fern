// Calendário mensal: mostra as datas escritas nas notas (calculadas na hora, sem tabela própria).
const Calendario = (() => {
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

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

  const agora = new Date()
  let mes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  let selecionado = iso(agora)
  let porDia = new Map()
  let abrirNota = () => {}
  let abrirDia = () => {}

  function atualizar(notas) {
    porDia = new Map()
    for (const e of Datas.extrairTodos(notas)) {
      if (!porDia.has(e.data)) porDia.set(e.data, [])
      porDia.get(e.data).push(e)
    }
    for (const lista of porDia.values()) {
      lista.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99') || a.titulo.localeCompare(b.titulo, 'pt-BR'))
    }
    desenhar()
  }

  function criarEvento(e, comoLista) {
    const el = document.createElement(comoLista ? 'li' : 'div')
    if (comoLista) {
      if (e.hora) {
        const hora = document.createElement('span')
        hora.className = 'hora'
        hora.textContent = e.hora
        el.appendChild(hora)
      }
      el.appendChild(document.createTextNode(e.titulo))
      if (e.origem === 'prazo') {
        const pequeno = document.createElement('small')
        pequeno.textContent = 'Prazo da tarefa'
        el.appendChild(pequeno)
      }
    } else {
      el.className = 'cal-evento' + (e.origem === 'prazo' ? ' prazo' : '') + (e.feita ? ' feita' : '')
      el.textContent = (e.hora ? e.hora + ' ' : '') + e.titulo
    }
    el.title = e.titulo
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      abrirNota(e.notaId)
    })
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      MenuContexto.abrir({ x: ev.clientX, y: ev.clientY }, [
        { rotulo: 'Abrir nota', aoClicar: () => abrirNota(e.notaId) },
      ])
    })
    return el
  }

  function desenharDia() {
    const d = dataDeIso(selecionado)
    diaTituloEl.textContent = d.toLocaleDateString('pt-BR', {
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
    for (const e of lista) diaListaEl.appendChild(criarEvento(e, true))
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

      const lista = porDia.get(chave) || []
      for (const e of lista.slice(0, 3)) celula.appendChild(criarEvento(e, false))
      if (lista.length > 3) {
        const mais = document.createElement('div')
        mais.className = 'cal-mais'
        mais.textContent = `+${lista.length - 3} mais`
        celula.appendChild(mais)
      }

      celula.addEventListener('click', () => {
        selecionado = chave
        desenhar()
      })
      gradeEl.appendChild(celula)
    }
    desenharDia()
  }

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

  function definirVisivel() {}

  function iniciar(aoAbrirNota, aoAbrirDia) {
    abrirNota = aoAbrirNota
    abrirDia = aoAbrirDia || abrirDia
    document.getElementById('cal-abrir-dia')?.addEventListener('click', () => abrirDia(selecionado))
    for (const nome of SEMANA) {
      const span = document.createElement('span')
      span.textContent = nome
      semanaEl.appendChild(span)
    }
    document.getElementById('cal-anterior').addEventListener('click', () => mudarMes(-1))
    document.getElementById('cal-proximo').addEventListener('click', () => mudarMes(1))
    document.getElementById('cal-hoje').addEventListener('click', () => irPara(iso(new Date())))
  }

  return { iniciar, atualizar, irPara, definirVisivel }
})()