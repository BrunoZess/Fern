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


// Espaço de produtividade: usa as notas e tarefas do Fern, sem banco separado.
const FernFluxo = (() => {
  const CHAVE = 'fernFluxoConfigV1'
  const $ = (id) => document.getElementById(id)
  const pad = (v) => String(v).padStart(2, '0')
  const dataDe = (deslocamento = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + deslocamento)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const dataBonita = (iso) => {
    if (!iso) return 'Sem data'
    if (iso === dataDe()) return 'Hoje'
    if (iso === dataDe(1)) return 'Amanhã'
    const [ano, mes, dia] = iso.split('-').map(Number)
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }
  const padrao = { revisoes: {}, regras: [{ id: 1, gatilho: 'concluir', acao: 'registrar', ativo: true }], historico: [], avisados: [], modo: 'kanban', pasta: 'todas', aba: 'inicio' }
  let estado = carregar()
  let notas = [], pastas = [], abrirNota = () => {}, aberto = false

  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}')
      return { ...padrao, ...salvo, revisoes: salvo.revisoes || {}, regras: Array.isArray(salvo.regras) ? salvo.regras : padrao.regras }
    } catch { return { ...padrao } }
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado)) } catch {} }
  function el(tag, texto, classe) {
    const n = document.createElement(tag)
    if (texto !== undefined) n.textContent = String(texto)
    if (classe) n.className = classe
    return n
  }
  function botao(texto, fn, classe = '') {
    const b = el('button', texto, classe)
    b.type = 'button'
    b.addEventListener('click', fn)
    return b
  }
  function titulo(n) { return Links.titulo(n.texto || '') || 'Sem título' }
  function notasFiltradas() { return estado.pasta === 'todas' ? notas : notas.filter(n => String(n.pasta_id) === estado.pasta) }
  function tarefasFiltradas() {
    const ids = new Set(notasFiltradas().map(n => n.id))
    return Afazeres.extrair(notas, pastas).filter(t => ids.has(t.notaId))
  }
  function navegar(aba) { estado.aba = aba; salvar(); renderizar() }
  function abrir() {
    aberto = true
    $('fern-fluxo').hidden = false
    renderizar()
  }
  function fechar() { aberto = false; $('fern-fluxo').hidden = true }
  function irParaNota(notaId) { fechar(); abrirNota(notaId, true) }
  function vazio(pai, icone, tituloVazio, descricao) {
    const caixa = el('div', undefined, 'fluxo-vazio')
    caixa.append(el('div', icone, 'fluxo-vazio-icone'), el('strong', tituloVazio), el('p', descricao))
    pai.append(caixa)
  }
  function tituloSecao(pai, tituloTexto, explicacao) {
    const topo = el('div', undefined, 'fluxo-secao-titulo')
    topo.append(el('h3', tituloTexto))
    if (explicacao) topo.append(el('p', explicacao))
    pai.append(topo)
  }
  function escolha(pai, opcoes, valor, mudar) {
    const select = el('select')
    for (const [v, nome] of opcoes) {
      const opcao = el('option', nome)
      opcao.value = v
      select.append(opcao)
    }
    select.value = valor
    select.addEventListener('change', () => mudar(select.value))
    pai.append(select)
    return select
  }
  function tarefaCard(pai, t) {
    const card = botao('', () => irParaNota(t.notaId), 'fluxo-tarefa')
    card.append(el('span', t.feita ? '✓' : '○', 'fluxo-status'), el('span', t.titulo, 'fluxo-tarefa-nome'))
    if (t.data) card.append(el('span', dataBonita(t.data), 'fluxo-tag'))
    pai.append(card)
  }
  function informacao(pai, icone, numero, nome, classe = '') {
    const card = el('div', undefined, 'fluxo-numero ' + classe)
    card.append(el('span', icone, 'fluxo-numero-icone'), el('strong', numero), el('small', nome))
    pai.append(card)
  }
  function inicio(corpo, ts) {
    const pendentes = ts.filter(t => !t.feita)
    const hoje = pendentes.filter(t => t.data === dataDe())
    const atrasadas = pendentes.filter(t => t.data && t.data < dataDe())
    const revisoes = notasFiltradas().filter(n => estado.revisoes[n.id]?.proxima <= dataDe())
    const boasVindas = el('div', undefined, 'fluxo-hero')
    boasVindas.append(el('h2', 'Visão geral'))
    corpo.append(boasVindas)
    const numeros = el('div', undefined, 'fluxo-numeros')
    informacao(numeros, '▤', notasFiltradas().length, 'Notas')
    informacao(numeros, '◉', pendentes.length, 'Tarefas abertas')
    informacao(numeros, '◷', hoje.length, 'Para hoje')
    informacao(numeros, '!', atrasadas.length, 'Atrasadas', atrasadas.length ? 'fluxo-alerta' : '')
    corpo.append(numeros)
    tituloSecao(corpo, 'Acesso rápido', '')
    const atalhos = el('div', undefined, 'fluxo-atalhos')
    for (const [icone, nome, desc, aba] of [
      ['▦', 'Semana', '', 'semana'],
      ['▥', 'Quadros', '', 'quadros'],
      ['◎', 'Revisões', '', 'revisoes'],
      ['⚡', 'Automações', '', 'automacoes']
    ]) {
      const b = botao('', () => navegar(aba), 'fluxo-atalho')
      b.append(el('span', icone, 'fluxo-atalho-icone'))
      const texto = el('span'); texto.append(el('strong', nome)); if (desc) texto.append(el('small', desc))
      b.append(texto, el('span', '→', 'fluxo-atalho-seta'))
      atalhos.append(b)
    }
    corpo.append(atalhos)
    tituloSecao(corpo, 'Próximos prazos', '')
    const urgentes = pendentes.filter(t => t.data).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 4)
    if (!urgentes.length) vazio(corpo, '✓', 'Sem prazos próximos', '')
    else urgentes.forEach(t => tarefaCard(corpo, t))
    if (revisoes.length) corpo.append(botao(`◎ Você tem ${revisoes.length} nota(s) para revisar →`, () => navegar('revisoes'), 'fluxo-aviso'))
  }
  function semana(corpo, ts) {
    tituloSecao(corpo, 'Semana', '')
    const pendentes = ts.filter(t => !t.feita)
    const grade = el('div', undefined, 'fluxo-semana')
    for (let i = 0; i < 7; i++) {
      const dia = dataDe(i), tarefasDia = pendentes.filter(t => t.data === dia)
      const coluna = el('div', undefined, 'fluxo-dia' + (i === 0 ? ' fluxo-dia-hoje' : ''))
      const cabeca = el('div', undefined, 'fluxo-dia-cabeca')
      cabeca.append(el('strong', i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : new Date(dia+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})), el('span', dataBonita(dia)))
      coluna.append(cabeca)
      if (!tarefasDia.length) coluna.append(el('small', '—', 'fluxo-livre'))
      else tarefasDia.forEach(t => tarefaCard(coluna, t))
      grade.append(coluna)
    }
    corpo.append(grade)
    const semData = pendentes.filter(t => !t.data)
    const atrasadas = pendentes.filter(t => t.data && t.data < dataDe())
    const partes = el('div', undefined, 'fluxo-duas-colunas')
    for (const [nome, lista, dica] of [['Sem prazo', semData, ''], ['Atrasadas', atrasadas, '']]) {
      const caixa = el('div', undefined, 'fluxo-painel')
      caixa.append(el('h3', `${nome} · ${lista.length}`)); if (dica) caixa.append(el('p', dica))
      if (!lista.length) caixa.append(el('small', 'Nada por aqui.'))
      else lista.slice(0, 30).forEach(t => tarefaCard(caixa, t))
      partes.append(caixa)
    }
    corpo.append(partes)
  }
  function quadros(corpo, ts) {
    tituloSecao(corpo, 'Visualizações', '')
    const barra = el('div', undefined, 'fluxo-modos')
    for (const [modo, nome] of [['kanban','▦ Kanban'], ['linha','◷ Linha do tempo'], ['mapa','◎ Conexões']]) {
      const b = botao(nome, () => { estado.modo = modo; salvar(); renderizar() }, 'fluxo-modo' + (estado.modo === modo ? ' ativo' : ''))
      barra.append(b)
    }
    corpo.append(barra)
    if (estado.modo === 'kanban') {
      const colunas = el('div', undefined, 'fluxo-kanban')
      for (const [nome, lista, icone] of [['A fazer', ts.filter(t => !t.feita), '○'], ['Concluídas', ts.filter(t => t.feita), '✓']]) {
        const c = el('div', undefined, 'fluxo-kanban-coluna')
        c.append(el('h3', `${icone} ${nome}  · ${lista.length}`))
        if (!lista.length) vazio(c, '✦', 'Tudo tranquilo', 'As tarefas vão aparecer aqui.')
        else lista.slice(0, 80).forEach(t => tarefaCard(c, t))
        colunas.append(c)
      }
      corpo.append(colunas)
    } else if (estado.modo === 'linha') {
      const lista = ts.filter(t => t.data).sort((a,b) => a.data.localeCompare(b.data))
      if (!lista.length) vazio(corpo, '◷', 'Nenhum prazo definido', 'Adicione datas às tarefas para montar sua linha do tempo.')
      else {
        const linha = el('div', undefined, 'fluxo-timeline')
        lista.slice(0, 80).forEach(t => {
          const item = el('div', undefined, 'fluxo-timeline-item')
          item.append(el('span', dataBonita(t.data), 'fluxo-tag'))
          tarefaCard(item, t)
          linha.append(item)
        })
        corpo.append(linha)
      }
    } else {
      const indice = Links.indexar(notasFiltradas())
      let total = 0
      for (const n of notasFiltradas().slice(0,100)) {
        const ligadas = (indice.saida.get(n.id) || []).filter(x => x.alvo)
        if (!ligadas.length) continue
        total++
        const linha = el('div', undefined, 'fluxo-conexao')
        linha.append(botao(titulo(n), () => irParaNota(n.id), 'fluxo-conexao-origem'), el('span', '→'))
        for (const link of ligadas) linha.append(botao(titulo(link.alvo), () => irParaNota(link.alvo.id), 'fluxo-conexao-alvo'))
        corpo.append(linha)
      }
      if (!total) vazio(corpo, '◎', 'Conecte suas ideias', 'Escreva [[Nome da nota]] dentro de outra nota para criar uma ligação.')
    }
  }
  function revisoes(corpo) {
    tituloSecao(corpo, 'Revisão espaçada', 'Intervalos: 1, 7 e 30 dias.')
    const candidatas = notasFiltradas().filter(n => n.tipo !== 'lista').slice(0, 300)
    const deHoje = candidatas.filter(n => estado.revisoes[n.id]?.proxima <= dataDe())
    const cabe = el('div', undefined, 'fluxo-revisao-banner')
    cabe.append(el('span', '◎', 'fluxo-revisao-icone'), el('strong', `${deHoje.length} ${deHoje.length === 1 ? 'nota para revisar' : 'notas para revisar'} hoje`), el('small', 'Um pouquinho por dia faz diferença.'))
    corpo.append(cabe)
    if (!deHoje.length) vazio(corpo, '✦', 'Você está em dia!', 'Escolha uma nota abaixo para começar seu ciclo de revisões.')
    else for (const n of deHoje) {
      const r = estado.revisoes[n.id]
      const linha = el('div', undefined, 'fluxo-revisao-item')
      linha.append(botao(titulo(n), () => irParaNota(n.id), 'fluxo-revisao-nota'))
      linha.append(botao('✓ Já revisei', () => { r.etapa = Math.min(Number(r.etapa || 0) + 1, 2); r.proxima = dataDe([1, 7, 30][r.etapa]); salvar(); renderizar() }, 'fluxo-primario'))
      corpo.append(linha)
    }
    tituloSecao(corpo, 'Adicionar uma nota', '')
    const barra = el('div', undefined, 'fluxo-linha')
    escolha(barra, [['', 'Escolha uma nota…'], ...candidatas.filter(n => !estado.revisoes[n.id]).map(n => [String(n.id), titulo(n)])], '', id => {
      if (!id) return
      estado.revisoes[id] = { etapa: 0, proxima: dataDe(1) }; salvar(); renderizar()
    })
    corpo.append(barra)
    const agendadas = candidatas.filter(n => estado.revisoes[n.id]).sort((a,b) => estado.revisoes[a.id].proxima.localeCompare(estado.revisoes[b.id].proxima))
    if (agendadas.length) {
      tituloSecao(corpo, 'Suas revisões agendadas', '')
      for (const n of agendadas) {
        const linha = el('div', undefined, 'fluxo-revisao-item')
        linha.append(el('span', titulo(n), 'fluxo-revisao-nota'), el('small', dataBonita(estado.revisoes[n.id].proxima)))
        linha.append(botao('Remover', () => { delete estado.revisoes[n.id]; salvar(); renderizar() }, 'fluxo-botao-sutil'))
        corpo.append(linha)
      }
    }
  }
  function adicionarRegra(gatilho) {
    if (estado.regras.some(r => r.gatilho === gatilho)) return
    estado.regras.push({ id: Date.now(), gatilho, acao: gatilho === 'concluir' ? 'registrar' : 'avisar', ativo: true })
    salvar(); renderizar()
  }
  function automacoes(corpo) {
    tituloSecao(corpo, 'Automações', '')
    for (const [gatilho, icone, nome, explicacao, exemplo] of [
      ['concluir', '✓', 'Registrar tarefas concluídas', 'Quando uma tarefa for finalizada, guardar esse evento no histórico.', 'QUANDO concluir uma tarefa → ENTÃO registrar no histórico'],
      ['prazo', '◷', 'Avisar sobre prazos próximos', 'Registrar um aviso até 2 dias antes do vencimento e notificar quando permitido.', 'QUANDO faltar até 2 dias → ENTÃO avisar']
    ]) {
      const regra = estado.regras.find(r => r.gatilho === gatilho)
      const card = el('div', undefined, 'fluxo-automacao')
      card.append(el('span', icone, 'fluxo-automacao-icone'))
      const info = el('div', undefined, 'fluxo-automacao-info')
      info.append(el('h3', nome), el('p', explicacao), el('small', exemplo))
      card.append(info)
      if (regra) {
        const rotulo = el('label', undefined, 'fluxo-switch')
        const check = el('input'); check.type = 'checkbox'; check.checked = regra.ativo
        check.setAttribute('aria-label', nome)
        check.addEventListener('change', () => { regra.ativo = check.checked; salvar(); renderizar() })
        rotulo.append(check, el('span'))
        card.append(rotulo)
      } else card.append(botao('+ Adicionar', () => adicionarRegra(gatilho), 'fluxo-primario'))
      corpo.append(card)
    }
    tituloSecao(corpo, 'Histórico', '')
    if (!estado.historico.length) vazio(corpo, '⚡', 'Nada registrado ainda', 'Quando uma automação acontecer, ela vai aparecer aqui.')
    else for (const h of estado.historico.slice(-30).reverse()) {
      const linha = el('div', undefined, 'fluxo-historico')
      linha.append(el('span', '✦'), el('span', h.texto), el('small', h.data))
      corpo.append(linha)
    }
    tituloSecao(corpo, 'Seus dados', '')
    const acoes = el('div', undefined, 'fluxo-linha')
    acoes.append(botao('↓ Exportar configurações', () => {
      const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob), a = el('a')
      a.href = url; a.download = 'fern-automacoes.json'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }))
    const importar = el('input'); importar.type = 'file'; importar.accept = '.json,application/json'
    importar.setAttribute('aria-label', 'Importar configurações')
    importar.addEventListener('change', async () => {
      const f = importar.files[0]; if (!f) return
      try {
        const v = JSON.parse(await f.text())
        if (!v || !Array.isArray(v.regras) || !v.revisoes || typeof v.revisoes !== 'object' || Array.isArray(v.revisoes)) throw Error('Formato inválido')
        estado = { ...padrao, ...v, aba: 'automacoes', historico: Array.isArray(v.historico) ? v.historico : [] }
        salvar(); renderizar()
      } catch { alert('Não consegui importar esse arquivo. Confira se ele foi exportado pelo Fern.') }
    })
    acoes.append(importar); corpo.append(acoes)
  }
  function renderizar() {
    if (!aberto) return
    const corpo = $('fern-fluxo-corpo'), nav = $('fern-fluxo-navegacao')
    corpo.replaceChildren(); nav.replaceChildren()
    for (const [id, icone, nome] of [['inicio','⌂','Início'], ['semana','▦','Semana'], ['quadros','▥','Quadros'], ['revisoes','◎','Revisões'], ['automacoes','⚡','Automações']]) {
      const b = botao(`${icone}  ${nome}`, () => navegar(id), 'fluxo-nav-botao' + (estado.aba === id ? ' ativo' : ''))
      b.setAttribute('aria-current', estado.aba === id ? 'page' : 'false')
      nav.append(b)
    }
    const ts = tarefasFiltradas()
    const tela = el('div', undefined, 'fluxo-conteudo-animado')
    corpo.append(tela)
    switch (estado.aba) {
      case 'semana': semana(tela, ts); break
      case 'quadros': quadros(tela, ts); break
      case 'revisoes': revisoes(tela); break
      case 'automacoes': automacoes(tela); break
      default: inicio(tela, ts)
    }
    $('fern-fluxo-pasta').value = estado.pasta
  }
  function verificar() {
    if (!notas.length || !estado.regras.some(r => r.ativo && r.gatilho === 'prazo')) return
    const agora = dataDe(), avisados = new Set(estado.avisados)
    for (const t of Afazeres.extrair(notas, pastas)) {
      if (t.feita || !t.data || t.data < agora || t.data > dataDe(2)) continue
      const id = `${t.notaId}:${t.linha}:${t.data}`
      if (avisados.has(id)) continue
      avisados.add(id)
      const msg = `Prazo próximo: ${t.titulo} (${dataBonita(t.data)})`
      estado.historico.push({ data: new Date().toLocaleString('pt-BR'), texto: msg })
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Fern', { body: msg })
    }
    estado.avisados = [...avisados].slice(-400)
    estado.historico = estado.historico.slice(-150)
    salvar()
  }
  function registrarConclusoes(antes, depois) {
    if (!estado.regras.some(r => r.ativo && r.gatilho === 'concluir')) return
    const a = new Map(Afazeres.extrair(antes, pastas).map(t => [`${t.notaId}:${t.linha}:${t.texto}`, t]))
    for (const t of Afazeres.extrair(depois, pastas)) {
      const anterior = a.get(`${t.notaId}:${t.linha}:${t.texto}`)
      if (t.feita && anterior && !anterior.feita) estado.historico.push({ data: new Date().toLocaleString('pt-BR'), texto: `Concluída: ${t.titulo}` })
    }
    estado.historico = estado.historico.slice(-150); salvar()
  }
  function atualizarDados(novas, novasPastas) {
    if (notas.length) registrarConclusoes(notas, novas)
    notas = novas.map(n => ({ ...n })); pastas = novasPastas
    verificar()
    const seletor = $('fern-fluxo-pasta')
    if (seletor) {
      seletor.replaceChildren()
      for (const [id, nome] of [['todas', 'Todas as pastas'], ...pastas.map(p => [String(p.id), p.nome])]) {
        const o = el('option', nome); o.value = id; seletor.append(o)
      }
      if (![...seletor.options].some(o => o.value === estado.pasta)) estado.pasta = 'todas'
      seletor.value = estado.pasta
    }
    if (aberto) renderizar()
  }
  function iniciar(opcoes) {
    abrirNota = opcoes.abrirNota
    const modal = el('div', undefined, 'fluxo-fundo'); modal.id = 'fern-fluxo'; modal.hidden = true
    const janela = el('div', undefined, 'fluxo-janela')
    janela.setAttribute('role', 'dialog'); janela.setAttribute('aria-modal', 'true'); janela.setAttribute('aria-label', 'Ferramentas do Fern')
    const cabeca = el('header', undefined, 'fluxo-cabeca')
    const marca = el('div', undefined, 'fluxo-marca')
    marca.append(el('span', '✦', 'fluxo-logo'))
    const nomes = el('div'); nomes.append(el('strong', 'Fern'), el('small', ''))
    marca.append(nomes)
    cabeca.append(marca, botao('✕', fechar, 'fluxo-fechar'))
    janela.append(cabeca)
    const barra = el('div', undefined, 'fluxo-barra')
    const nav = el('nav', undefined, 'fluxo-navegacao'); nav.id = 'fern-fluxo-navegacao'
    const filtro = el('div', undefined, 'fluxo-filtro'); filtro.append(el('span', 'Pasta'))
    const select = el('select'); select.id = 'fern-fluxo-pasta'
    select.addEventListener('change', () => { estado.pasta = select.value; salvar(); renderizar() })
    filtro.append(select)
    barra.append(nav, filtro); janela.append(barra)
    const corpo = el('main', undefined, 'fluxo-corpo'); corpo.id = 'fern-fluxo-corpo'
    janela.append(corpo)
    const rodape = el('footer', '', 'fluxo-rodape')
    janela.append(rodape)
    modal.append(janela)
    modal.addEventListener('click', e => { if (e.target === modal) fechar() })
    document.body.append(modal)
    const b = botao('✦', abrir, 'icone-botao'); b.title = 'Ferramentas e automações (Ctrl+Shift+F)'
    const ref = $('btn-tarefas'); if (ref?.parentElement) ref.parentElement.append(b)
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); aberto ? fechar() : abrir() }
      else if (e.key === 'Escape' && aberto) fechar()
    })
    atualizarDados(notas, pastas)
    setInterval(verificar, 60 * 1000)
  }
  return { iniciar, atualizarDados, abrir }
})()
