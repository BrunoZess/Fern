// Estatísticas: números gerais, atividade (notas criadas por dia), tarefas, tags e notas mais ligadas.
const Estatisticas = (() => {
  const conteudoEl = document.getElementById('est-conteudo')
  const SEMANAS = 26
  const UM_DIA = 86400000
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

  let cb = { aoAbrirNota: () => {} }

  const pad = (n) => String(n).padStart(2, '0')
  const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const fmt = (n) => n.toLocaleString('pt-BR')
  const contarPalavras = (texto) => (texto.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length

  function el(tag, classe, texto) {
    const e = document.createElement(tag)
    if (classe) e.className = classe
    if (texto !== undefined) e.textContent = texto
    return e
  }

  function secao(titulo, ...filhos) {
    const s = el('section', 'est-secao')
    s.append(el('h3', '', titulo), ...filhos)
    return s
  }

  function cartao(valor, rotulo) {
    const c = el('div', 'est-cartao')
    c.append(el('strong', '', fmt(valor)), el('span', '', rotulo))
    return c
  }

  // Lista com barras proporcionais: [{ rotulo, valor, aoClicar? }]
  function barras(itens, vazio) {
    if (itens.length === 0) return el('p', 'est-vazio', vazio)
    const max = Math.max(...itens.map((i) => i.valor), 1)
    const ul = el('ul', 'est-barras')
    for (const item of itens) {
      const li = el('li')
      const rotulo = el('span', 'est-rotulo', item.rotulo)
      if (item.aoClicar) {
        rotulo.classList.add('clicavel')
        rotulo.addEventListener('click', (e) => item.aoClicar(e.ctrlKey || e.metaKey))
      }
      const trilho = el('span', 'est-trilho')
      const barra = el('span', 'est-barra')
      barra.style.width = `${(item.valor / max) * 100}%`
      trilho.appendChild(barra)
      li.append(rotulo, trilho, el('span', 'est-valor', fmt(item.valor)))
      ul.appendChild(li)
    }
    return ul
  }

  function mapaDeCalor(porDia) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const inicio = new Date(hoje.getTime() - ((SEMANAS - 1) * 7 + hoje.getDay()) * UM_DIA)
    const max = Math.max(1, ...porDia.values())
    const grade = el('div', 'est-calor')
    const meses = el('div', 'est-calor-meses')
    let mesAnterior = -1
    for (let s = 0; s < SEMANAS; s++) {
      const coluna = el('div', 'est-calor-coluna')
      const primeiro = new Date(inicio.getTime() + s * 7 * UM_DIA)
      const rotuloMes = el('span', '', primeiro.getMonth() !== mesAnterior ? MESES[primeiro.getMonth()] : '')
      mesAnterior = primeiro.getMonth()
      meses.appendChild(rotuloMes)
      for (let d = 0; d < 7; d++) {
        const dia = new Date(primeiro)
        dia.setDate(primeiro.getDate() + d)
        const quadrado = el('span', 'est-calor-dia')
        if (dia > hoje) quadrado.classList.add('futuro')
        else {
          const n = porDia.get(isoDe(dia)) || 0
          const nivel = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4))
          quadrado.dataset.nivel = nivel
          quadrado.title = `${pad(dia.getDate())}/${pad(dia.getMonth() + 1)}: ${n === 1 ? '1 nota' : `${n} notas`}`
        }
        coluna.appendChild(quadrado)
      }
      grade.appendChild(coluna)
    }
    const caixa = el('div', 'est-calor-caixa')
    caixa.append(meses, grade)
    return caixa
  }

  function sequencia(porDia) {
    const d = new Date()
    if (!porDia.has(isoDe(d))) d.setDate(d.getDate() - 1)
    let n = 0
    while (porDia.has(isoDe(d))) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  }

  function atualizar({ notas, pastas, quadros, arquivos }) {
    const ignorar = Afazeres.pastasIgnoradas(pastas)
    const minhas = notas.filter((n) => !ignorar.has(n.pasta_id))
    const titulo = (n) => Links.titulo(n.texto) || 'Sem título'
    const abrir = (n) => (novaAba) => cb.aoAbrirNota(n.id, novaAba)

    const palavras = new Map(minhas.map((n) => [n.id, contarPalavras(n.texto || '')]))
    const totalPalavras = [...palavras.values()].reduce((a, b) => a + b, 0)
    const indice = Links.indexar(minhas)
    let totalLinks = 0
    for (const lista of indice.saida.values()) totalLinks += lista.filter((l) => l.alvo).length

    const tags = new Map()
    for (const n of minhas) {
      for (const t of new Set((n.texto || '').match(/#[\p{L}\p{N}_-]+/gu) || [])) tags.set(t, (tags.get(t) || 0) + 1)
    }

    const porDia = new Map()
    for (const n of minhas) {
      const dia = String(n.criada_em || '').slice(0, 10)
      if (dia) porDia.set(dia, (porDia.get(dia) || 0) + 1)
    }
    const hoje = isoDe(new Date())
    const ha = (dias) => isoDe(new Date(Date.now() - dias * UM_DIA))
    const criadasDesde = (iso) => minhas.filter((n) => String(n.criada_em || '').slice(0, 10) >= iso).length

    const tarefas = Afazeres.extrair(notas, pastas)
    const feitas = tarefas.filter((t) => t.feita).length
    const abertas = tarefas.length - feitas
    const atrasadas = tarefas.filter((t) => !t.feita && t.data && t.data < hoje).length
    const pct = tarefas.length ? Math.round((feitas / tarefas.length) * 100) : 0

    const orfas = minhas.filter(
      (n) => !(indice.entrada.get(n.id) || []).length && !(indice.saida.get(n.id) || []).some((l) => l.alvo)
    ).length

    // ----- Montagem -----
    const cartoes = el('div', 'est-cartoes')
    cartoes.append(
      cartao(minhas.length, minhas.length === 1 ? 'nota' : 'notas'),
      cartao(totalPalavras, 'palavras'),
      cartao(quadros.length, quadros.length === 1 ? 'quadro' : 'quadros'),
      cartao(arquivos.length, arquivos.length === 1 ? 'arquivo' : 'arquivos'),
      cartao(pastas.length, pastas.length === 1 ? 'pasta' : 'pastas'),
      cartao(totalLinks, totalLinks === 1 ? 'link entre notas' : 'links entre notas'),
      cartao(tags.size, tags.size === 1 ? 'tag' : 'tags')
    )

    const resumoAtividade = el(
      'p',
      'est-legenda',
      `Últimos 7 dias: ${fmt(criadasDesde(ha(6)))} · últimos 30 dias: ${fmt(criadasDesde(ha(29)))} · ` +
        `sequência atual: ${sequencia(porDia)} dia(s) seguidos criando notas`
    )

    const progresso = el('div', 'est-progresso')
    const preenchido = el('span')
    preenchido.style.width = `${pct}%`
    progresso.appendChild(preenchido)
    const resumoTarefas = el(
      'p',
      'est-legenda',
      tarefas.length === 0
        ? 'Nenhuma tarefa ainda. Escreva "- [ ]" numa nota para criar uma.'
        : `${fmt(feitas)} de ${fmt(tarefas.length)} concluídas (${pct}%) · ${fmt(abertas)} ${abertas === 1 ? 'aberta' : 'abertas'}` +
            (atrasadas ? ` · ${fmt(atrasadas)} atrasada(s)` : '')
    )
    if (atrasadas) resumoTarefas.classList.add('com-atraso')

    const topTags = [...tags.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, 8)
      .map(([rotulo, valor]) => ({ rotulo, valor }))

    const citadas = minhas
      .map((n) => ({ n, valor: (indice.entrada.get(n.id) || []).length }))
      .filter((x) => x.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6)
      .map(({ n, valor }) => ({ rotulo: titulo(n), valor, aoClicar: abrir(n) }))

    const maiores = minhas
      .map((n) => ({ n, valor: palavras.get(n.id) }))
      .filter((x) => x.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6)
      .map(({ n, valor }) => ({ rotulo: titulo(n), valor, aoClicar: abrir(n) }))

    const duas = el('div', 'est-duas')
    duas.append(
      secao('Notas mais citadas', barras(citadas, 'Nenhuma nota recebe [[links]] ainda.')),
      secao('Maiores notas (palavras)', barras(maiores, 'Nenhuma nota com texto ainda.'))
    )

    conteudoEl.replaceChildren(
      cartoes,
      secao('Atividade (notas criadas por dia)', mapaDeCalor(porDia), resumoAtividade),
      secao('Tarefas', progresso, resumoTarefas),
      duas,
      secao('Tags mais usadas', barras(topTags, 'Nenhuma #tag ainda.')),
      el('p', 'est-legenda', `${fmt(orfas)} nota(s) sem nenhum [[link]] (nem de ida, nem de volta). A pasta "Modelos" não entra nas contas.`)
    )
  }

  function iniciar(opcoes) {
    cb = { ...cb, ...opcoes }
  }

  return { iniciar, atualizar }
})()
