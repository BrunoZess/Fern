// Configurações (tema, texto, largura, ortografia) e a lista de atalhos.
const Ajustes = (() => {
  const CHAVE = 'ajustes'
  const LARGURAS = { estreita: '600px', normal: '720px', larga: '900px', total: '100%' }
  const PADRAO = { tema: 'auto', fonte: 15, largura: 'normal', ortografia: false }
  let cfg = { ...PADRAO }
  try {
    cfg = { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }
  } catch {
    cfg = { ...PADRAO }
  }

  const $ = (id) => document.getElementById(id)

  const ATALHOS = [
    {
      secao: 'Geral',
      itens: [
        ['Ctrl+K · Ctrl+O', 'Buscar notas e quadros'],
        ['Ctrl+N · Ctrl+T', 'Nova nota em uma nova aba'],
        ['Alt+D', 'Abrir a nota do dia'],
        ['F2', 'Renomear a nota ou o quadro aberto'],
        ['Ctrl+G', 'Grafo'],
        ['Ctrl+J', 'Calendário'],
        ['Ctrl+\\', 'Recolher ou abrir a barra lateral'],
        ['Ctrl+,', 'Configurações'],
        ['F1 · Ctrl+/', 'Esta lista de atalhos'],
      ],
    },
    {
      secao: 'Abas',
      itens: [
        ['Ctrl+W', 'Fechar a aba'],
        ['Ctrl+Shift+T', 'Reabrir a última aba fechada'],
        ['Ctrl+Tab · Ctrl+Shift+Tab', 'Próxima · anterior'],
        ['Ctrl+1 … 9', 'Ir para a aba N (9 = a última)'],
        ['Ctrl+clique · botão do meio', 'Abrir em nova aba (barra lateral)'],
      ],
    },
    {
      secao: 'Escrevendo',
      itens: [
        ['[[', 'Autocompletar de links para outras notas'],
        ['Ctrl+L · [ com texto selecionado', 'Transformar em [[link]]'],
        ['Ctrl+clique num [[link]]', 'Abrir a nota'],
        ['Ctrl+B · Ctrl+I', 'Negrito · itálico'],
        ['Ctrl+Enter', 'Criar, marcar ou desmarcar tarefa'],
        ['Tab · Shift+Tab', 'Recuar · avançar item de lista'],
        ['Alt+↑ · Alt+↓', 'Mover a linha'],
        ['Alt+Shift+↓ · Alt+Shift+↑', 'Duplicar a linha'],
        ['Ctrl+;', 'Inserir a data de hoje (vai pro calendário)'],
        ['Ctrl+Shift+;', 'Inserir a hora'],
      ],
    },
    {
      secao: 'Quadro',
      itens: [
        ['Duplo clique', 'Novo post-it (no fundo) ou editar (num post-it)'],
        ['N · C · G', 'Post-it · conectar · organizar em grade'],
        ['P · E · V', 'Desenhar · borracha · sair do desenho'],
        ['Ctrl+C · Ctrl+V · Ctrl+D', 'Copiar · colar · duplicar'],
        ['Ctrl+Shift+V', 'Colar cada linha como um post-it'],
        ['Ctrl+A · Shift+arrastar', 'Selecionar tudo · caixa de seleção'],
        ['Setas', 'Mover a seleção (Shift = 50 px)'],
        ['Espaço + arrastar · botão do meio', 'Andar pelo quadro'],
        ['Ctrl+Z', 'Desfazer o último traço'],
        ['Ctrl+0', 'Zoom em 100%'],
      ],
    },
  ]

  function aplicar() {
    const raiz = document.documentElement
    if (cfg.tema === 'auto') delete raiz.dataset.tema
    else raiz.dataset.tema = cfg.tema
    raiz.style.setProperty('--fonte-editor', `${cfg.fonte}px`)
    raiz.style.setProperty('--largura-editor', LARGURAS[cfg.largura] || LARGURAS.normal)
    for (const id of ['editor-texto', 'editor-titulo']) {
      const el = $(id)
      if (el) el.spellcheck = Boolean(cfg.ortografia)
    }
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(cfg))
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
  }

  function abrirAjustes() {
    $('ajuste-tema').value = cfg.tema
    $('ajuste-fonte').value = cfg.fonte
    $('ajuste-fonte-valor').textContent = `${cfg.fonte}px`
    $('ajuste-largura').value = cfg.largura
    $('ajuste-ortografia').checked = Boolean(cfg.ortografia)
    $('ajuda').hidden = true
    $('ajustes').hidden = false
  }

  function abrirAjuda() {
    $('ajustes').hidden = true
    $('ajuda').hidden = false
  }

  function fecharModais() {
    $('ajustes').hidden = true
    $('ajuda').hidden = true
  }

  function algumAberto() {
    return !$('ajustes').hidden || !$('ajuda').hidden
  }

  function montarAjuda() {
    const lista = $('ajuda-lista')
    for (const { secao, itens } of ATALHOS) {
      const bloco = document.createElement('div')
      bloco.className = 'ajuda-secao'
      const titulo = document.createElement('h4')
      titulo.textContent = secao
      bloco.appendChild(titulo)
      for (const [tecla, descricao] of itens) {
        const linha = document.createElement('div')
        linha.className = 'ajuda-item'
        const d = document.createElement('span')
        d.textContent = descricao
        const k = document.createElement('kbd')
        k.textContent = tecla
        linha.append(d, k)
        bloco.appendChild(linha)
      }
      lista.appendChild(bloco)
    }
  }

  function iniciar() {
    $('ajuste-tema').addEventListener('change', (e) => {
      cfg.tema = e.target.value
      aplicar()
      salvar()
    })
    $('ajuste-fonte').addEventListener('input', (e) => {
      cfg.fonte = Number(e.target.value)
      $('ajuste-fonte-valor').textContent = `${cfg.fonte}px`
      aplicar()
      salvar()
    })
    $('ajuste-largura').addEventListener('change', (e) => {
      cfg.largura = e.target.value
      aplicar()
      salvar()
    })
    $('ajuste-ortografia').addEventListener('change', (e) => {
      cfg.ortografia = e.target.checked
      aplicar()
      salvar()
    })
    $('ajustes-fechar').addEventListener('click', fecharModais)
    for (const id of ['ajustes', 'ajuda']) {
      $(id).addEventListener('pointerdown', (e) => {
        if (e.target === $(id)) fecharModais()
      })
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && algumAberto()) fecharModais()
    })
    montarAjuda()
    aplicar()
  }

  return { iniciar, abrirAjustes, abrirAjuda, fecharModais, algumAberto }
})()