const Atalhos = (() => {
  const SECOES = [
    {
      id: 'essenciais',
      titulo: 'Essenciais',
      icone: 'mais',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+K', 'Ctrl+O'], texto: 'Busca geral do Fern.', dica: 'Digite, aperte Enter para abrir ou Ctrl+Enter para abrir em nova aba.' },
        { gesto: '> dentro do Ctrl+K', texto: 'Mostra comandos para criar itens, abrir telas, mudar preferências e iniciar o Pomodoro.' },
        { teclas: ['Ctrl+N', 'Ctrl+T'], texto: 'Cria uma nota nova na pasta do item aberto.' },
        { teclas: ['F1', 'Ctrl+/'], texto: 'Abre esta tela de atalhos.' },
        { teclas: ['Ctrl+,'], texto: 'Abre as Configurações.' },
        { teclas: ['Ctrl+\\'], texto: 'Mostra ou esconde a barra lateral.', dica: 'Bom para escrever com menos distração.' },
      ],
    },
    {
      id: 'telas',
      titulo: 'Telas',
      icone: 'grafo',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+G'], texto: 'Abre o Grafo.' },
        { teclas: ['Ctrl+J'], texto: 'Abre o Calendário.', dica: 'Datas escritas nas notas aparecem lá automaticamente.' },
        { teclas: ['Ctrl+Shift+A'], texto: 'Abre a tela de Tarefas.' },
        { gesto: 'Ícones no rodapé da barra lateral', texto: 'Abrem Estatísticas, Lixeira, Atalhos e Configurações.' },
      ],
    },
    {
      id: 'organizar',
      titulo: 'Criar e organizar',
      icone: 'pasta',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+Shift+N'], texto: 'Cria uma nota a partir de um modelo.', dica: 'Os modelos podem usar {{data}} e {{hora}}.' },
        { teclas: ['Ctrl+Shift+L'], texto: 'Cria uma lista nova.' },
        { teclas: ['F2'], texto: 'Renomeia a nota ou o quadro aberto.' },
        { gesto: 'Botão direito num item', texto: 'Abre o menu de contexto com ações rápidas.' },
        { gesto: 'Arrastar na barra lateral', texto: 'Move um item para outra pasta.' },
        { gesto: 'Ctrl+clique ou botão do meio', texto: 'Abre um item em nova aba.' },
      ],
    },
    {
      id: 'abas',
      titulo: 'Abas',
      icone: 'painel',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+W'], texto: 'Fecha a aba atual.' },
        { teclas: ['Ctrl+Shift+T'], texto: 'Reabre a última aba fechada.' },
        { teclas: ['Alt+←'], texto: 'Volta para a aba anterior.' },
        { gesto: 'Botão direito na aba', texto: 'Abre o menu com fixar, fechar outras e mais.' },
        { teclas: ['Ctrl+Tab'], texto: 'Vai para a próxima aba.' },
        { teclas: ['Ctrl+Shift+Tab'], texto: 'Vai para a aba anterior.' },
        { teclas: ['Ctrl+1 … 8'], texto: 'Pula direto para uma aba pelo número.' },
        { teclas: ['Ctrl+9'], texto: 'Vai para a última aba.' },
      ],
    },
    {
      id: 'escrever',
      titulo: 'Escrevendo',
      icone: 'lapis',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+B'], texto: 'Negrito.' },
        { teclas: ['Ctrl+I'], texto: 'Itálico.' },
        { teclas: ['Ctrl+Enter'], texto: 'Transforma a linha em tarefa ou marca/desmarca.' },
        { teclas: ['Enter'], texto: 'Dentro de listas, cria o próximo item.' },
        { teclas: ['Tab', 'Shift+Tab'], texto: 'Aumenta ou diminui recuo.' },
        { teclas: ['Alt+↑', 'Alt+↓'], texto: 'Move a linha atual.' },
        { teclas: ['Alt+Shift+↑', 'Alt+Shift+↓'], texto: 'Duplica a linha atual.' },
        { teclas: ['Ctrl+;'], texto: 'Insere a data de hoje.' },
        { teclas: ['Ctrl+Shift+;'], texto: 'Insere a hora atual.' },
      ],
    },
    {
      id: 'links',
      titulo: 'Links entre notas',
      icone: 'elo',
      resumo: '',
      itens: [
        { teclas: ['[['], texto: 'Abre a lista de notas para criar um link.' },
        { teclas: ['Ctrl+L'], texto: 'Transforma a seleção em [[link]].' },
        { gesto: 'Ctrl+clique num [[link]]', texto: 'Abre a nota ligada.' },
        { gesto: '[[Pasta]] ou [[Pasta/Sub]]', texto: 'Abre o primeiro item dessa pasta.' },
      ],
    },
    {
      id: 'buscar',
      titulo: 'Buscar dentro da nota',
      icone: 'busca',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+F'], texto: 'Abre a busca.' },
        { teclas: ['Ctrl+H'], texto: 'Abre busca + substituição.' },
        { teclas: ['F3', 'Enter'], texto: 'Próxima ocorrência.' },
        { teclas: ['Shift+F3'], texto: 'Ocorrência anterior.' },
        { teclas: ['Ctrl+Enter'], texto: 'Substitui tudo de uma vez.' },
        { teclas: ['Esc'], texto: 'Fecha a barra de busca.' },
      ],
    },
    {
      id: 'leitura',
      titulo: 'Modo leitura, fórmulas e diagramas',
      icone: 'olho',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+E'], texto: 'Liga ou desliga o modo leitura.' },
        { gesto: '$E = mc^2$', texto: 'Fórmula inline em LaTeX.' },
        { gesto: '$$ … $$', texto: 'Fórmula em bloco.' },
        { gesto: '```mermaid', texto: 'Começa um diagrama Mermaid.' },
        { gesto: '- [ ] tarefa', texto: 'Cria uma tarefa marcável.' },
        { gesto: '#tag', texto: 'Cria uma tag clicável.' },
        { gesto: '{{data}} · {{hora}} · {{dia_semana}}', texto: 'Variáveis úteis em modelos.' },
      ],
    },
    {
      id: 'lista',
      titulo: 'Lista de compras',
      icone: 'lista',
      resumo: '',
      itens: [
        { teclas: ['Enter'], texto: 'Adiciona um novo item.' },
        { gesto: 'Clique no texto', texto: 'Edita o item.' },
        { gesto: 'Arrastar pela alça', texto: 'Muda a ordem dos itens.' },
        { gesto: '# Seção', texto: 'Cria um título de seção.' },
        { gesto: 'Botão “Desmarcar tudo”', texto: 'Limpa todos os itens marcados.' },
      ],
    },
    {
      id: 'quadro',
      titulo: 'Quadro',
      icone: 'quadro',
      resumo: '',
      itens: [
        { teclas: ['V'], texto: 'Ativa a seleção de cartões pelo botão no HUD.' },
        { teclas: ['V'], texto: 'Ativa o cursor para clicar e mover cartões.' },
        { teclas: ['R'], texto: 'Ativa seleção por retângulo: arraste para selecionar vários cartões.', dica: 'Shift + arrastar adiciona cartões à seleção. Esc sai da ferramenta.' },
        { teclas: ['T'], texto: 'Cria uma caixa de texto.' },
        { teclas: ['S'], texto: 'Cria um post-it.' },
        { teclas: ['P'], texto: 'Ativa a caneta.' },
        { teclas: ['E'], texto: 'Ativa a borracha.' },
        { teclas: ['V', 'Esc'], texto: 'Volta ao cursor normal.' },
        { teclas: ['G'], texto: 'Organiza os cartões em grade.' },
        { teclas: ['Delete'], texto: 'Apaga a seleção.' },
        { teclas: ['Setas'], texto: 'Move a seleção.', dica: 'Com Shift anda mais rápido.' },
        { teclas: ['Ctrl+A'], texto: 'Seleciona tudo.' },
        { teclas: ['Ctrl+C', 'Ctrl+V'], texto: 'Copia e cola.' },
        { teclas: ['Ctrl+D'], texto: 'Duplica a seleção.' },
        { teclas: ['Ctrl+Shift+V'], texto: 'Cola cada linha como um post-it separado.' },
        { teclas: ['Ctrl+Shift+C'], texto: 'Copia o quadro inteiro como Markdown.' },
        { teclas: ['Ctrl+Z', 'Ctrl+Y'], texto: 'Desfaz e refaz ações.' },
        { teclas: ['Ctrl+0'], texto: 'Volta o zoom para 100%.' },
        { teclas: ['Home'], texto: 'Enquadra tudo.' },
        { gesto: 'Espaço + arrastar ou botão do meio', texto: 'Navega pelo quadro.' },
        { gesto: 'Shift + arrastar', texto: 'Seleciona em caixa.' },
        { gesto: 'Alt + arrastar', texto: 'Seleciona em laço.', dica: 'Alt+Shift soma a nova área à seleção.' },
        { gesto: 'Arrastar da bolinha de um cartão', texto: 'Liga um cartão em outro.' },
      ],
    },
    {
      id: 'arquivos',
      titulo: 'PDFs e imagens',
      icone: 'pdf',
      resumo: '',
      itens: [
        { teclas: ['Ctrl+=', 'Ctrl+-'], texto: 'Aumenta ou diminui o zoom.' },
        { teclas: ['Ctrl+0'], texto: 'Ajusta à largura da tela.' },
        { teclas: ['P'], texto: 'Ativa a caneta.' },
        { teclas: ['E'], texto: 'Ativa a borracha.' },
        { gesto: 'Botões Seleção/Laço', texto: 'Seleciona rabiscos para apagar.' },
        { teclas: ['Esc'], texto: 'Sai do modo rabisco.' },
        { teclas: ['Ctrl+Z', 'Ctrl+Y'], texto: 'Desfaz e refaz rabiscos.' },
      ],
    },
  ]

  const DESTAQUES = [
    { secao: 'Essenciais', teclas: 'Ctrl+K', texto: 'Buscar qualquer nota, quadro ou arquivo' },
    { secao: 'Essenciais', teclas: 'Ctrl+N', texto: 'Criar uma nota nova' },
    { secao: 'Telas', teclas: 'Ctrl+Shift+A', texto: 'Abrir a tela de tarefas' },
    { secao: 'Telas', teclas: 'Ctrl+G', texto: 'Abrir o grafo' },
    { secao: 'Quadro', teclas: 'Ctrl+Z / Ctrl+Y', texto: 'Desfazer e refazer no quadro' },
    { secao: 'Arquivos', teclas: 'Ctrl+0', texto: 'Ajustar o zoom de PDFs e imagens' },
  ]

  const $ = (id) => document.getElementById(id)
  let iniciado = false

  function criar(tag, classe, texto) {
    const el = document.createElement(tag)
    if (classe) el.className = classe
    if (texto !== undefined) el.textContent = texto
    return el
  }

  function combinacao(texto) {
    const caixa = criar('span', 'atalho-combo')
    const partes = texto.split(/\+(?=.)/)
    partes.forEach((parte, i) => {
      if (i > 0) caixa.appendChild(criar('span', 'atalho-mais', '+'))
      caixa.appendChild(criar('kbd', '', parte))
    })
    return caixa
  }

  function linhaDoItem(item) {
    const li = criar('li', 'atalho-item')
    const corpo = criar('div', 'atalho-corpo')
    corpo.appendChild(criar('span', 'atalho-texto', item.texto))
    if (item.dica) corpo.appendChild(criar('small', 'atalho-dica', item.dica))
    const teclas = criar('div', 'atalho-teclas')
    if (item.gesto) {
      teclas.appendChild(criar('span', 'atalho-gesto', item.gesto))
    } else {
      item.teclas.forEach((t, i) => {
        if (i > 0) teclas.appendChild(criar('span', 'atalho-ou', 'ou'))
        teclas.appendChild(combinacao(t))
      })
    }
    li.append(corpo, teclas)
    li.dataset.busca = [item.texto, item.dica, item.gesto, ...(item.teclas || [])].filter(Boolean).join(' ').toLowerCase()
    return li
  }

  function montarDestaques() {
    const wrap = $('atalhos-destaques')
    wrap.replaceChildren()
    for (const item of DESTAQUES) {
      const card = criar('article', 'atalho-destaque')
      card.append(
        criar('span', 'atalho-destaque-secao', item.secao),
        combinacao(item.teclas),
        criar('strong', '', item.texto)
      )
      wrap.appendChild(card)
    }
  }

  function montar() {
    montarDestaques()
    const indice = $('atalhos-indice')
    const conteudo = $('atalhos-conteudo')
    for (const secao of SECOES) {
      const chip = criar('button', 'atalhos-chip')
      chip.append(Icones.criar(secao.icone, 14), document.createTextNode(secao.titulo))
      chip.addEventListener('click', () => $(`atalhos-${secao.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' }))
      indice.appendChild(chip)

      const bloco = criar('section', 'atalhos-secao')
      bloco.id = `atalhos-${secao.id}`
      const topo = criar('div', 'atalhos-secao-topo')
      const icone = criar('span', 'atalhos-secao-icone')
      icone.appendChild(Icones.criar(secao.icone, 18))
      const titulos = criar('div')
      titulos.append(criar('h3', '', secao.titulo))
      if (secao.resumo) titulos.append(criar('p', '', secao.resumo))
      topo.append(icone, titulos)
      const lista = criar('ul', 'atalhos-lista')
      for (const item of secao.itens) lista.appendChild(linhaDoItem(item))
      bloco.append(topo, lista)
      conteudo.appendChild(bloco)
    }
  }

  function filtrar() {
    const termo = $('atalhos-busca').value.trim().toLowerCase()
    let visiveis = 0
    for (const bloco of document.querySelectorAll('.atalhos-secao')) {
      let naSecao = 0
      for (const li of bloco.querySelectorAll('.atalho-item')) {
        const mostra = !termo || li.dataset.busca.includes(termo)
        li.hidden = !mostra
        if (mostra) naSecao++
      }
      bloco.hidden = naSecao === 0
      visiveis += naSecao
    }
    $('atalhos-indice').hidden = Boolean(termo)
    $('atalhos-destaques').hidden = Boolean(termo)
    $('atalhos-nada').hidden = visiveis > 0
  }

  function iniciar() {
    if (iniciado) return
    iniciado = true
    montar()
    $('atalhos-busca').addEventListener('input', filtrar)
    $('atalhos-busca').addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && e.target.value) {
        e.stopPropagation()
        e.target.value = ''
        filtrar()
      }
    })
  }

  function focar() {
    $('atalhos-busca').focus()
  }

  return { iniciar, focar, SECOES }
})()
