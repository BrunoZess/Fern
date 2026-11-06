const Atalhos = (() => {
  const SECOES = [
    {
      id: 'essenciais',
      titulo: 'Essenciais',
      icone: 'mais',
      resumo: 'Os que mais valem a pena decorar. Com eles você faz quase tudo sem tirar a mão do teclado.',
      itens: [
        { teclas: ['Ctrl+K', 'Ctrl+O'], texto: 'Buscar e abrir notas e quadros', dica: 'Ctrl+Enter abre o resultado em uma nova aba.' },
        { teclas: ['Ctrl+N', 'Ctrl+T'], texto: 'Criar uma nota nova em outra aba' },
        { teclas: ['Ctrl+Shift+Espaço'], texto: 'Captura rápida', dica: 'Funciona em qualquer lugar do computador, mesmo com o app minimizado.' },
        { teclas: ['F1', 'Ctrl+/'], texto: 'Abrir esta tela de atalhos' },
        { teclas: ['Ctrl+,'], texto: 'Configurações (tema, tamanho do texto, backup…)' },
        { teclas: ['Ctrl+\\'], texto: 'Esconder ou mostrar a barra lateral' },
      ],
    },
    {
      id: 'telas',
      titulo: 'Telas',
      icone: 'grafo',
      resumo: 'Cada tela abre em uma aba própria. Apertar o atalho de novo fecha a tela.',
      itens: [
        { teclas: ['Ctrl+G'], texto: 'Grafo: como as notas se ligam' },
        { teclas: ['Ctrl+J'], texto: 'Calendário com as datas das notas e as notinhas' },
        { teclas: ['Ctrl+Shift+A'], texto: 'Tarefas: todas as "- [ ]" de todas as notas, por prazo' },
        { gesto: 'Ícones no rodapé da barra lateral', texto: 'Estatísticas, Lixeira, Atalhos e Configurações' },
      ],
    },
    {
      id: 'organizar',
      titulo: 'Criar e organizar',
      icone: 'pasta',
      resumo: 'Novos itens são criados na pasta do item que está aberto.',
      itens: [
        { teclas: ['Ctrl+Shift+N'], texto: 'Nova nota a partir de um modelo', dica: 'Os modelos ficam na pasta "Modelos".' },
        { teclas: ['Ctrl+Shift+L'], texto: 'Nova lista (de compras, por exemplo)' },
        { teclas: ['F2'], texto: 'Renomear a nota ou o quadro aberto' },
        { gesto: 'Botão direito', texto: 'Menu com todas as opções do item (renomear, fixar, mover para a lixeira…)' },
        { gesto: 'Arrastar na barra lateral', texto: 'Mover um item para outra pasta' },
        { gesto: 'Ctrl+clique · botão do meio', texto: 'Abrir um item da barra lateral em nova aba' },
      ],
    },
    {
      id: 'abas',
      titulo: 'Abas',
      icone: 'painel',
      resumo: 'Funcionam como as abas do navegador.',
      itens: [
        { teclas: ['Ctrl+W'], texto: 'Fechar a aba atual' },
        { teclas: ['Ctrl+Shift+T'], texto: 'Reabrir a última aba fechada' },
        { teclas: ['Ctrl+Tab'], texto: 'Ir para a próxima aba' },
        { teclas: ['Ctrl+Shift+Tab'], texto: 'Voltar para a aba anterior' },
        { teclas: ['Ctrl+1 … 8'], texto: 'Pular direto para a aba de número 1 a 8' },
        { teclas: ['Ctrl+9'], texto: 'Ir para a última aba' },
      ],
    },
    {
      id: 'escrever',
      titulo: 'Escrevendo',
      icone: 'lapis',
      resumo: 'Valem dentro de uma nota. A formatação aparece enquanto você digita.',
      itens: [
        { teclas: ['Ctrl+B'], texto: 'Negrito', dica: 'Fica **assim** no texto.' },
        { teclas: ['Ctrl+I'], texto: 'Itálico', dica: 'Fica *assim* no texto.' },
        { teclas: ['Ctrl+Enter'], texto: 'Transformar a linha em tarefa, ou marcar e desmarcar' },
        { teclas: ['Enter'], texto: 'Numa lista, continua com um novo item' },
        { teclas: ['Tab', 'Shift+Tab'], texto: 'Recuar ou avançar um item de lista' },
        { teclas: ['Alt+↑', 'Alt+↓'], texto: 'Mover a linha para cima ou para baixo' },
        { teclas: ['Alt+Shift+↑', 'Alt+Shift+↓'], texto: 'Duplicar a linha' },
        { teclas: ['Ctrl+;'], texto: 'Inserir a data de hoje', dica: 'Datas escritas na nota aparecem no calendário.' },
        { teclas: ['Ctrl+Shift+;'], texto: 'Inserir a hora atual' },
      ],
    },
    {
      id: 'links',
      titulo: 'Links entre notas',
      icone: 'elo',
      resumo: 'Ligar notas é o que monta o seu "segundo cérebro" e o grafo.',
      itens: [
        { teclas: ['[['], texto: 'Começar um link: aparece uma lista com as notas para escolher' },
        { teclas: ['Ctrl+L'], texto: 'Transformar o texto selecionado em [[link]]', dica: 'Digitar [ com o texto selecionado faz o mesmo.' },
        { gesto: 'Ctrl+clique num [[link]]', texto: 'Abrir a nota ligada' },
        { gesto: '[[Pasta]] · [[Pasta/Sub]]', texto: 'Link para uma pasta: abre o primeiro arquivo dela' },
      ],
    },
    {
      id: 'buscar',
      titulo: 'Buscar dentro da nota',
      icone: 'busca',
      resumo: 'Para achar ou trocar palavras na nota aberta.',
      itens: [
        { teclas: ['Ctrl+F'], texto: 'Buscar na nota' },
        { teclas: ['Ctrl+H'], texto: 'Buscar e substituir' },
        { teclas: ['F3', 'Enter'], texto: 'Ir para a próxima ocorrência' },
        { teclas: ['Shift+F3'], texto: 'Voltar para a ocorrência anterior' },
        { teclas: ['Ctrl+Enter'], texto: 'No campo de substituir, troca todas de uma vez' },
        { teclas: ['Esc'], texto: 'Fechar a busca' },
      ],
    },
    {
      id: 'leitura',
      titulo: 'Modo leitura, fórmulas e diagramas',
      icone: 'olho',
      resumo: 'O modo leitura mostra a nota formatada. É só escrever assim no texto:',
      itens: [
        { teclas: ['Ctrl+E'], texto: 'Entrar e sair do modo leitura', dica: 'O ícone de olho, no topo da nota, faz o mesmo.' },
        { gesto: '$E = mc^2$', texto: 'Fórmula no meio da frase (LaTeX)' },
        { gesto: '$$ … $$', texto: 'Fórmula grande, numa linha só dela' },
        { gesto: '```mermaid', texto: 'Diagrama (fluxograma, sequência, etc.). Feche o bloco com ```' },
        { gesto: '- [ ] tarefa', texto: 'Tarefa: dá para marcar clicando, inclusive no modo leitura' },
        { gesto: '#tag', texto: 'Tag: clique para ver todas as notas com ela' },
        { gesto: '{{data}} · {{hora}} · {{dia_semana}}', texto: 'Num modelo, vira a data e a hora em que a nota foi criada' },
      ],
    },
    {
      id: 'lista',
      titulo: 'Lista de compras',
      icone: 'lista',
      resumo: 'Notas do tipo lista têm um jeito próprio de usar.',
      itens: [
        { teclas: ['Enter'], texto: 'Adicionar o item', dica: 'Colar várias linhas adiciona vários itens.' },
        { gesto: 'Clique no texto', texto: 'Editar o item' },
        { gesto: 'Arrastar pela alça', texto: 'Mudar a ordem' },
        { gesto: '# Seção', texto: 'Escrito como item, vira um título de seção' },
        { gesto: 'Botão "Desmarcar tudo"', texto: 'Reaproveitar a mesma lista na próxima compra' },
      ],
    },
    {
      id: 'quadro',
      titulo: 'Quadro',
      icone: 'quadro',
      resumo: 'Valem quando o quadro está aberto e você não está escrevendo em um cartão.',
      itens: [
        { teclas: ['T'], texto: 'Nova caixa de texto', dica: 'Duplo clique no vazio faz o mesmo.' },
        { teclas: ['S'], texto: 'Novo post-it' },
        { teclas: ['P'], texto: 'Caneta para desenhar' },
        { teclas: ['E'], texto: 'Borracha' },
        { teclas: ['V', 'Esc'], texto: 'Sair do desenho' },
        { teclas: ['G'], texto: 'Organizar os cartões em grade' },
        { teclas: ['Delete'], texto: 'Apagar o que está selecionado' },
        { teclas: ['Setas'], texto: 'Mover a seleção', dica: 'Com Shift, anda mais rápido.' },
        { teclas: ['Ctrl+A'], texto: 'Selecionar tudo' },
        { teclas: ['Ctrl+C', 'Ctrl+V'], texto: 'Copiar e colar' },
        { teclas: ['Ctrl+D'], texto: 'Duplicar' },
        { teclas: ['Ctrl+Shift+V'], texto: 'Colar cada linha do texto como um post-it' },
        { teclas: ['Ctrl+Shift+C'], texto: 'Copiar o quadro como texto Markdown' },
        { teclas: ['Ctrl+Z'], texto: 'Desfazer o último traço' },
        { teclas: ['Ctrl+0'], texto: 'Voltar o zoom para 100%' },
        { gesto: 'Espaço + arrastar · botão do meio', texto: 'Andar pelo quadro' },
        { gesto: 'Shift + arrastar', texto: 'Selecionar vários com uma caixa' },
        { gesto: 'Arrastar da bolinha de um cartão', texto: 'Ligar a outro cartão (soltar no vazio cria um post-it ligado)' },
      ],
    },
    {
      id: 'arquivos',
      titulo: 'PDFs e imagens',
      icone: 'pdf',
      resumo: 'Para ler e rabiscar arquivos anexados.',
      itens: [
        { teclas: ['Ctrl+=', 'Ctrl+-'], texto: 'Aumentar ou diminuir o zoom', dica: 'Ctrl + rodinha do mouse também funciona.' },
        { teclas: ['Ctrl+0'], texto: 'Ajustar à largura da tela' },
        { teclas: ['P'], texto: 'Rabiscar' },
        { teclas: ['E'], texto: 'Borracha' },
        { teclas: ['Esc'], texto: 'Parar de rabiscar' },
        { teclas: ['Ctrl+Z'], texto: 'Desfazer o último rabisco' },
      ],
    },
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

  function montar() {
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
      titulos.append(criar('h3', '', secao.titulo), criar('p', '', secao.resumo))
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
