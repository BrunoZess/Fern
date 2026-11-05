// Vista de Tarefas: todas as "- [ ]" de todas as notas (e as notas do tipo tarefa), agrupadas por prazo.
const Tarefas = (() => {
  const $ = (id) => document.getElementById(id)
  const listaEl = $('tarefas-lista')
  const novaEl = $('tarefas-nova')
  const filtroEl = $('tarefas-filtro')
  const feitasEl = $('tarefas-feitas')
  const resumoEl = $('tarefas-resumo')
  const NOME_CAIXA = 'Caixa de entrada'
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

  let notas = []
  let pastas = []
  let cb = { aoAbrirNota: () => {}, aoAlterar: async () => {}, aoAviso: () => {} }

  const pad = (n) => String(n).padStart(2, '0')
  const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  function maisDias(n) {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return isoDe(d)
  }

  function rotuloData(iso) {
    const hoje = maisDias(0)
    if (iso === hoje) return 'Hoje'
    if (iso === maisDias(1)) return 'Amanhã'
    if (iso === maisDias(-1)) return 'Ontem'
    const [a, m, d] = iso.split('-').map(Number)
    const data = new Date(a, m - 1, d)
    const ano = a === new Date().getFullYear() ? '' : `/${a}`
    return `${SEMANA[data.getDay()]} ${pad(d)}/${pad(m)}${ano}`
  }

  function grupoDe(t) {
    if (t.feita) return 'feitas'
    if (!t.data) return 'semdata'
    const hoje = maisDias(0)
    if (t.data < hoje) return 'atrasadas'
    if (t.data === hoje) return 'hoje'
    if (t.data === maisDias(1)) return 'amanha'
    if (t.data <= maisDias(7)) return 'semana'
    return 'depois'
  }

  const GRUPOS = [
    ['atrasadas', 'Atrasadas'],
    ['hoje', 'Hoje'],
    ['amanha', 'Amanhã'],
    ['semana', 'Próximos 7 dias'],
    ['depois', 'Mais pra frente'],
    ['semdata', 'Sem data'],
    ['feitas', 'Concluídas'],
  ]

  async function alternar(t) {
    const nota = notas.find((n) => n.id === t.notaId)
    if (!nota) return
    if (t.linha === null) {
      await window.api.alternarConcluida(nota.id)
    } else {
      const novo = Afazeres.alternarLinha(nota.texto, t.linha, t.texto)
      if (novo === null) return cb.aoAviso('A nota mudou; atualize a lista')
      await window.api.atualizarNota(nota.id, novo, nota.tipo, nota.prazo, nota.projeto, nota.pasta_id)
    }
    await cb.aoAlterar()
  }

  function criarLinha(t) {
    const li = document.createElement('li')
    li.className = 'tarefa-item' + (t.feita ? ' feita' : '')
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.checked = t.feita
    check.addEventListener('change', () => alternar(t))
    const corpo = document.createElement('div')
    corpo.className = 'tarefa-corpo'
    const texto = document.createElement('div')
    texto.className = 'tarefa-texto'
    texto.innerHTML = Markdown.inline(t.texto)
    const meta = document.createElement('div')
    meta.className = 'tarefa-meta'
    if (t.data) {
      const data = document.createElement('span')
      data.className = 'tarefa-data' + (!t.feita && t.data < maisDias(0) ? ' atrasada' : '')
      data.textContent = rotuloData(t.data) + (t.hora ? ` · ${t.hora}` : '')
      meta.appendChild(data)
    }
    const origem = document.createElement('span')
    origem.className = 'tarefa-nota'
    origem.textContent = t.tituloNota
    meta.appendChild(origem)
    corpo.append(texto, meta)
    corpo.title = 'Abrir a nota (Ctrl+clique: nova aba)'
    corpo.addEventListener('click', (e) => {
      if (e.target.closest('a.externo')) {
        window.api.abrirLink(e.target.closest('a.externo').dataset.url).catch(() => {})
        return
      }
      cb.aoAbrirNota(t.notaId, e.ctrlKey || e.metaKey)
    })
    li.append(check, corpo)
    return li
  }

  function renderizar() {
    const filtro = Links.normalizar(filtroEl.value)
    let tarefas = Afazeres.extrair(notas, pastas)
    const abertas = tarefas.filter((t) => !t.feita)
    const atrasadas = abertas.filter((t) => t.data && t.data < maisDias(0)).length
    const hoje = abertas.filter((t) => t.data === maisDias(0)).length
    resumoEl.textContent =
      `${abertas.length} ${abertas.length === 1 ? 'aberta' : 'abertas'}` +
      (hoje ? ` · ${hoje} para hoje` : '') +
      (atrasadas ? ` · ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : '')

    if (filtro) {
      tarefas = tarefas.filter((t) => Links.normalizar(`${t.texto} ${t.tituloNota}`).includes(filtro))
    }
    if (!feitasEl.checked) tarefas = tarefas.filter((t) => !t.feita)

    const porGrupo = new Map()
    for (const t of tarefas) {
      const g = grupoDe(t)
      if (!porGrupo.has(g)) porGrupo.set(g, [])
      porGrupo.get(g).push(t)
    }
    const ordem = (a, b) =>
      (a.data || '9999').localeCompare(b.data || '9999') ||
      (a.hora || '99').localeCompare(b.hora || '99') ||
      b.notaId - a.notaId ||
      (a.linha ?? -1) - (b.linha ?? -1)

    listaEl.replaceChildren()
    for (const [id, rotulo] of GRUPOS) {
      const itens = porGrupo.get(id)
      if (!itens || itens.length === 0) continue
      itens.sort(id === 'feitas' ? (a, b) => -ordem(a, b) : ordem)
      const sec = document.createElement('section')
      sec.className = `tarefas-grupo grupo-${id}`
      const h = document.createElement('h3')
      h.textContent = `${rotulo} `
      const n = document.createElement('small')
      n.textContent = itens.length
      h.appendChild(n)
      const ul = document.createElement('ul')
      for (const t of itens.slice(0, id === 'feitas' ? 100 : 1000)) ul.appendChild(criarLinha(t))
      sec.append(h, ul)
      listaEl.appendChild(sec)
    }
    if (listaEl.childElementCount === 0) {
      const vazio = document.createElement('div')
      vazio.className = 'tarefas-vazio'
      vazio.textContent = filtro
        ? 'Nenhuma tarefa encontrada.'
        : 'Nenhuma tarefa aberta. Escreva "- [ ] algo" em qualquer nota, ou use o campo acima.'
      listaEl.appendChild(vazio)
    }
  }

  function atualizar(listaNotas, listaPastas) {
    notas = listaNotas
    pastas = listaPastas
    renderizar()
  }

  // Tarefas novas vão para a nota "Caixa de entrada" (criada na raiz se não existir)
  async function adicionar(texto) {
    const t = texto.trim()
    if (!t) return
    let caixa = notas.find(
      (n) => n.tipo !== 'lista' && Links.normalizar(Links.titulo(n.texto)) === Links.normalizar(NOME_CAIXA)
    )
    if (!caixa) {
      await window.api.criarNota(`${NOME_CAIXA}\n- [ ] ${t}`, 'ideia', null, '', null)
    } else {
      const novo = caixa.texto.replace(/\s+$/, '') + `\n- [ ] ${t}`
      await window.api.atualizarNota(caixa.id, novo, caixa.tipo, caixa.prazo, caixa.projeto, caixa.pasta_id)
    }
    await cb.aoAlterar()
    cb.aoAviso(`Tarefa adicionada em "${NOME_CAIXA}"`)
  }

  function iniciar(opcoes) {
    cb = { ...cb, ...opcoes }
    filtroEl.addEventListener('input', renderizar)
    feitasEl.checked = localStorage.getItem('tarefasFeitas') === '1'
    feitasEl.addEventListener('change', () => {
      localStorage.setItem('tarefasFeitas', feitasEl.checked ? '1' : '0')
      renderizar()
    })
    novaEl.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const valor = novaEl.value
      novaEl.value = ''
      await adicionar(valor)
    })
  }

  function focar() {
    novaEl.focus()
  }

  return { iniciar, atualizar, focar }
})()
