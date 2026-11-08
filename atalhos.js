const Atalhos = (() => {
  const SECOES = [
    {
      id: 'essenciais',
      titulo: 'Essenciais',
      icone: 'mais',
      resumo: 'Os atalhos mais importantes do app. Se você decorar só estes, já resolve 90% do dia a dia sem tirar a mão do teclado.',
      itens: [
        { teclas: ['Ctrl+K', 'Ctrl+O'], texto: 'Abre a busca de todas as notas, quadros e arquivos. É o atalho mais útil do app.', dica: 'Digita e aperta Enter para abrir. Ctrl+Enter abre em uma aba nova em vez de trocar a atual.' },
        { teclas: ['Ctrl+N', 'Ctrl+T'], texto: 'Cria uma nota nova, em uma aba nova, na pasta do item aberto.' },
        { teclas: ['F1', 'Ctrl+/'], texto: 'Abre esta tela de atalhos. Escolhe no topo qual atalho você quer ler de novo.' },
        { teclas: ['Ctrl+,'], texto: 'Abre as Configurações: tema, tamanho do texto, backup e notificações.' },
        { teclas: ['Ctrl+\\'], texto: 'Esconde ou mostra a barra lateral com as pastas e itens.', dica: 'Útil para escrever em tela cheia sem distração.' },
      ],
    },
    {
      id: 'telas',
      titulo: 'Telas',
      icone: 'grafo',
      resumo: 'Cada tela abre em uma aba própria. Apertar o atalho de novo fecha a aba da tela.',
      itens: [
        { teclas: ['Ctrl+G'], texto: 'Abre o Grafo: um mapa visual mostrando como as notas se ligam umas às outras.' },
        { teclas: ['Ctrl+J'], texto: 'Abre o Calendário com as datas das notas e as notinhas de cada dia.', dica: 'Datas escritas na nota aparecem no calendário automaticamente.' },
        { teclas: ['Ctrl+Shift+A'], texto: 'Abre as Tarefas: todas as "- [ ]" de todas as notas, agrupadas por prazo.' },
        { gesto: 'Ícones no rodapé da barra lateral', texto: 'Estatísticas (gráfico de uso), Lixeira (restaurar apagados), Atalhos e Configurações.' },
      ],
    },
    {
      id: 'organizar',
      titulo: 'Criar e organizar',
      icone: 'pasta',
      resumo: 'Tudo o que você cria cai na pasta do item que está aberto. Se não tiver nada aberto, vai para a raiz.',
      itens: [
        { teclas: ['Ctrl+Shift+N'], texto: 'Cria uma nota a partir de um modelo pronto.', dica: 'Os modelos ficam na pasta "Modelos" e deixam {{data}} e {{hora}} prontos.' },
        { teclas: ['Ctrl+Shift+L'], texto: 'Cria uma lista (de compras, filmes, tarefas — o que for).' },
        { teclas: ['F2'], texto: 'Renomeia a nota ou o quadro aberto na hora, sem abrir menu nenhum.' },
        { gesto: 'Botão direito num item', texto: 'Abre o menu de contexto com todas as opções: renomear, fixar, mover para a lixeira…' },
        { gesto: 'Arrastar na barra lateral', texto: 'Move um item para outra pasta só arrastando.' },
        { gesto: 'Ctrl+clique ou botão do meio', texto: 'Abre um item da barra lateral numa aba nova, sem fechar a atual.' },
      ],
    },
    {
      id: 'abas',
      titulo: 'Abas',
      icone: 'painel',
      resumo: 'Funcionam como as abas do navegador: fecham, reabrem e trocam de lugar.',
      itens: [
        { teclas: ['Ctrl+W'], texto: 'Fecha a aba atual.' },
        { teclas: ['Ctrl+Shift+T'], texto: 'Reabre a última aba fechada.' },
        { teclas: ['Alt+←'], texto: 'Volta para a aba em que você estava antes — tipo o botão voltar do navegador.' },
        { gesto: 'Botão direito na aba', texto: 'Menu da aba: fixar (protege contra fechar sem querer), visualizar ao lado, fechar outras…' },
        { teclas: ['Ctrl+Tab'], texto: 'Vai para a próxima aba.' },
        { teclas: ['Ctrl+Shift+Tab'], texto: 'Volta para a aba anterior.' },
        { teclas: ['Ctrl+1 … 8'], texto: 'Pula direto para a aba de número 1 a 8.' },
        { teclas: ['Ctrl+9'], texto: 'Vai direto para a última aba.' },
      ],
    },
    {
      id: 'escrever',
      titulo: 'Escrevendo',
      icone: 'lapis',
      resumo: 'Atalhos que valem dentro de uma nota. A formatação já aparece enquanto você digita — não precisa entrar em modo de edição.',
      itens: [
        { teclas: ['Ctrl+B'], texto: 'Negrito na palavra ou na seleção.', dica: 'O texto fica entre **asteriscos** no arquivo.' },
        { teclas: ['Ctrl+I'], texto: 'Itálico na palavra ou na seleção.', dica: 'O texto fica entre *asteriscos* no arquivo.' },
        { teclas: ['Ctrl+Enter'], texto: 'Transforma a linha em tarefa; apertar de novo marca ou desmarca.' },
        { teclas: ['Enter'], texto: 'Dentro de uma lista, já cria o próximo item automaticamente.' },
        { teclas: ['Tab', 'Shift+Tab'], texto: 'Aumenta ou diminui o recuo de um item de lista.' },
        { teclas: ['Alt+↑', 'Alt+↓'], texto: 'Sobe ou desce a linha atual dentro da nota.' },
        { teclas: ['Alt+Shift+↑', 'Alt+Shift+↓'], texto: 'Duplica a linha atual para cima ou para baixo.' },
        { teclas: ['Ctrl+;'], texto: 'Insere a data de hoje.', dica: 'Datas assim aparecem no calendário e nas tarefas com prazo.' },
        { teclas: ['Ctrl+Shift+;'], texto: 'Insere a hora atual.' },
      ],
    },
    {
      id: 'links',
      titulo: 'Links entre notas',
      icone: 'elo',
      resumo: 'Ligar uma nota na outra é o que forma a sua rede de ideias — e é o que alimenta o grafo.',
      itens: [
        { teclas: ['[['], texto: 'Digita [[ e uma lista aparece com todas as notas para você escolher.' },
        { teclas: ['Ctrl+L'], texto: 'Transforma o texto selecionado em um [[link]].', dica: 'Só digitar [ com o texto selecionado já faz a mesma coisa.' },
        { gesto: 'Ctrl+clique num [[link]]', texto: 'Abre a nota ligada na hora.' },
        { gesto: '[[Pasta]] ou [[Pasta/Sub]]', texto: 'Link para uma pasta abre o primeiro arquivo dela.' },
      ],
    },
    {
      id: 'buscar',
      titulo: 'Buscar dentro da nota',
      icone: 'busca',
      resumo: 'Para achar ou trocar palavras dentro da nota que está aberta.',
      itens: [
        { teclas: ['Ctrl+F'], texto: 'Abre a busca dentro da nota atual.' },
        { teclas: ['Ctrl+H'], texto: 'Abre busca e substituição juntas.' },
        { teclas: ['F3', 'Enter'], texto: 'Pula para a próxima ocorrência.' },
        { teclas: ['Shift+F3'], texto: 'Volta para a ocorrência anterior.' },
        { teclas: ['Ctrl+Enter'], texto: 'No campo de substituir, troca todas de uma vez.' },
        { teclas: ['Esc'], texto: 'Fecha a barra de busca.' },
      ],
    },
    {
      id: 'leitura',
      titulo: 'Modo leitura, fórmulas e diagramas',
      icone: 'olho',
      resumo: 'O modo leitura transforma a nota em um documento bonito: fórmulas, diagramas, links e tarefas aparecem formatados. É só escrever assim no texto:',
      itens: [
        { teclas: ['Ctrl+E'], texto: 'Entra e sai do modo leitura.', dica: 'O ícone de olho, no topo da nota, faz o mesmo.' },
        { gesto: '$E = mc^2$', texto: 'Fórmula no meio da frase, escrita em LaTeX.' },
        { gesto: '$$ … $$', texto: 'Fórmula grande, numa linha só dela.' },
        { gesto: '```mermaid', texto: 'Começa um diagrama (fluxograma, sequência, mapa). Fecha o bloco com ```.' },
        { gesto: '- [ ] tarefa', texto: 'Vira uma caixinha de tarefa; dá pra marcar clicando, até no modo leitura.' },
        { gesto: '#tag', texto: 'Vira uma tag: clicar nela abre a busca com todas as notas que têm a mesma tag.' },
        { gesto: '{{data}} · {{hora}} · {{dia_semana}}', texto: 'Num modelo, essas palavras viram a data e a hora em que a nota foi criada.' },
      ],
    },
    {
      id: 'lista',
      titulo: 'Lista de compras',
      icone: 'lista',
      resumo: 'Notas do tipo lista têm um jeito próprio de usar — feitas pra você checar itens um por um.',
      itens: [
        { teclas: ['Enter'], texto: 'Adiciona o item na lista.', dica: 'Colar várias linhas de uma vez adiciona vários itens de uma vez.' },
        { gesto: 'Clique no texto', texto: 'Edita o item já criado.' },
        { gesto: 'Arrastar pela alça', texto: 'Muda a ordem dos itens.' },
        { gesto: '# Seção', texto: 'Escrever # seguido de texto cria um título de seção dentro da lista.' },
        { gesto: 'Botão "Desmarcar tudo"', texto: 'Zera todos os itens de uma vez — bom pra reaproveitar a mesma lista na próxima compra.' },
      ],
    },
    {
      id: 'quadro',
      titulo: 'Quadro',
      icone: 'quadro',
      resumo: 'Estes atalhos valem quando o quadro está aberto e você não está escrevendo dentro de um cartão.',
      itens: [
        { teclas: ['T'], texto: 'Cria uma caixa de texto nova onde o cursor está.', dica: 'Dar dois cliques no vazio faz a mesma coisa.' },
        { teclas: ['S'], texto: 'Cria um post-it colorido.' },
        { teclas: ['P'], texto: 'Ativa a caneta para desenhar.' },
        { teclas: ['E'], texto: 'Ativa a borracha.' },
        { teclas: ['V', 'Esc'], texto: 'Sai do modo de desenho e volta ao cursor normal.' },
        { teclas: ['G'], texto: 'Organiza os cartões do quadro em grade sozinho.' },
        { teclas: ['Delete'], texto: 'Apaga o que estiver selecionado.' },
        { teclas: ['Setas'], texto: 'Move a seleção um passo por vez.', dica: 'Com Shift anda mais rápido.' },
        { teclas: ['Ctrl+A'], texto: 'Seleciona todos os cartões do quadro.' },
        { teclas: ['Ctrl+C', 'Ctrl+V'], texto: 'Copia e cola.' },
        { teclas: ['Ctrl+D'], texto: 'Duplica a seleção no mesmo lugar.' },
        { teclas: ['Ctrl+Shift+V'], texto: 'Cola cada linha do texto copiado como um post-it separado.' },
        { teclas: ['Ctrl+Shift+C'], texto: 'Copia o quadro inteiro como texto Markdown.' },
        { teclas: ['Ctrl+Z'], texto: 'Desfaz a última coisa feita: traço, cartão apagado, movimento, edição, conexão…' },
        { teclas: ['Ctrl+0'], texto: 'Volta o zoom para 100%.' },
        { teclas: ['Home'], texto: 'Enquadra tudo: volta a câmera pra mostrar todos os cartões.' },
        { gesto: 'Espaço + arrastar ou botão do meio', texto: 'Arrasta o quadro pra navegar por ele.' },
        { gesto: 'Shift + arrastar', texto: 'Seleciona vários cartões de uma vez com uma caixa.' },
        { gesto: 'Arrastar da bolinha de um cartão', texto: 'Liga um cartão em outro — soltar no vazio cria um post-it já ligado.' },
      ],
    },
    {
      id: 'arquivos',
      titulo: 'PDFs e imagens',
      icone: 'pdf',
      resumo: 'Para ler e rabiscar arquivos PDF ou imagens anexados numa nota.',
      itens: [
        { teclas: ['Ctrl+=', 'Ctrl+-'], texto: 'Aumenta ou diminui o zoom do arquivo.', dica: 'Ctrl + rodinha do mouse também funciona.' },
        { teclas: ['Ctrl+0'], texto: 'Ajusta a largura do arquivo na tela.' },
        { teclas: ['P'], texto: 'Ativa a caneta para rabiscar por cima do arquivo.' },
        { teclas: ['E'], texto: 'Ativa a borracha parcial.' },
        { teclas: ['Esc'], texto: 'Sai do modo rabisco.' },
        { teclas: ['Ctrl+Z'], texto: 'Desfaz o último rabisco.' },
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
