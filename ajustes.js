// Configurações (tema, texto, largura, ortografia) e a lista de atalhos.
const Ajustes = (() => {
  const CHAVE = 'ajustes'
  const LARGURAS = { estreita: '760px', normal: '1040px', larga: '1280px', total: '100%' }
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
        ['F2', 'Renomear a nota ou o quadro aberto'],
        ['Ctrl+G', 'Grafo'],
        ['Ctrl+J', 'Calendário'],
        ['Ctrl+Shift+A', 'Tarefas (todas as - [ ] de todas as notas, por prazo)'],
        ['Ctrl+Shift+L', 'Nova lista (de compras, etc.)'],
        ['Ctrl+Shift+N', 'Nova nota a partir de um modelo (pasta "Modelos")'],
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
        ['[[Pasta]] · [[Pasta/Sub]]', 'Link para uma pasta: abre o primeiro arquivo dela'],
        ['Ctrl+B · Ctrl+I', 'Negrito · itálico'],
        ['Ctrl+Enter', 'Criar, marcar ou desmarcar tarefa'],
        ['Tab · Shift+Tab', 'Recuar · avançar item de lista'],
        ['Alt+↑ · Alt+↓', 'Mover a linha'],
        ['Alt+Shift+↓ · Alt+Shift+↑', 'Duplicar a linha'],
        ['Ctrl+;', 'Inserir a data de hoje (vai pro calendário)'],
        ['Ctrl+Shift+;', 'Inserir a hora'],
        ['## Título · **negrito** · ~~riscado~~', 'A formatação aparece enquanto você digita'],
        ['Clique no [ ] de uma tarefa', 'Marcar ou desmarcar'],
        ['Ctrl+F · Ctrl+H', 'Buscar · buscar e substituir na nota'],
        ['F3 · Shift+F3', 'Próxima · anterior ocorrência'],
        ['{{data}} · {{hora}} · {{dia_semana}}', 'Num modelo, viram a data/hora de quando a nota é criada'],
      ],
    },
    {
      secao: 'Lista (compras)',
      itens: [
        ['Enter', 'Adicionar o item (colar várias linhas adiciona vários)'],
        ['Clique no texto', 'Editar o item'],
        ['Arrastar pela alça', 'Reordenar'],
        ['# Seção', 'Escrito como item, vira um título de seção'],
        ['Desmarcar tudo', 'Reaproveitar a mesma lista na próxima compra'],
      ],
    },
    {
      secao: 'Quadro',
      itens: [
        ['Duplo clique · T', 'Nova caixa de texto'],
        ['S', 'Novo post-it (opcional)'],
        ['P · E · V', 'Desenhar · borracha · sair do desenho'],
        ['Desenhar em cima de uma imagem', 'O rabisco fica preso à imagem'],
        ['Arrastar de um ponto do cartão', 'Ligar a outro cartão (no vazio, cria um post-it ligado)'],
        ['Ctrl+C · Ctrl+V · Ctrl+D', 'Copiar · colar · duplicar'],
        ['Ctrl+Shift+V', 'Colar cada linha como um post-it'],
        ['G', 'Organizar em grade'],
        ['Ctrl+A · Shift+arrastar', 'Selecionar tudo · caixa de seleção'],
        ['Setas', 'Mover a seleção (Shift = 50 px)'],
        ['Espaço + arrastar · botão do meio', 'Andar pelo quadro'],
        ['Ctrl+Z', 'Desfazer o último traço'],
        ['Ctrl+0', 'Zoom em 100%'],
      ],
    },
    {
      secao: 'Arquivos (PDF e imagens)',
      itens: [
        ['Ctrl+roda · Ctrl+= · Ctrl+-', 'Zoom'],
        ['Ctrl+0', 'Ajustar à largura'],
        ['P · E · Esc', 'Rabiscar · borracha · sair do rabisco'],
        ['Ctrl+Z', 'Desfazer o último rabisco'],
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
    window.api.lerConfig().then(mostrarConfig).catch(() => {})
  }

  // ---------- Lembretes e backup (guardados no processo principal) ----------

  function avisar(texto) {
    if (typeof avisoGlobal === 'function') avisoGlobal(texto)
  }

  function quando(iso) {
    if (!iso) return 'nunca'
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function mostrarConfig(c) {
    if (!c) return
    $('ajuste-lembretes').checked = c.lembretes.ativo
    $('ajuste-lembrete-hora').value = c.lembretes.hora
    $('ajuste-lembrete-antes').value = String(c.lembretes.antes)
    $('ajuste-backup-auto').checked = c.backup.auto
    $('ajuste-backup-info').textContent = `Pasta: ${c.backup.pastaEfetiva} · último backup: ${quando(c.backup.ultimo)}`
  }

  async function salvarConfig(parcial) {
    try {
      mostrarConfig(await window.api.salvarConfig(parcial))
    } catch {
      avisar('Não consegui salvar a configuração')
    }
  }

  async function executar(botao, acao) {
    botao.disabled = true
    try {
      await acao()
    } catch (err) {
      avisar(`Erro: ${(err && err.message) || err}`)
    } finally {
      botao.disabled = false
    }
  }

  function iniciarConfigApp() {
    $('ajuste-lembretes').addEventListener('change', (e) => salvarConfig({ lembretes: { ativo: e.target.checked } }))
    $('ajuste-lembrete-hora').addEventListener('change', (e) => {
      if (e.target.value) salvarConfig({ lembretes: { hora: e.target.value } })
    })
    $('ajuste-lembrete-antes').addEventListener('change', (e) =>
      salvarConfig({ lembretes: { antes: Number(e.target.value) } })
    )
    $('ajuste-lembrete-testar').addEventListener('click', async () => {
      const ok = await window.api.testarLembrete()
      if (!ok) avisar('As notificações não são suportadas neste sistema')
    })
    $('ajuste-backup-auto').addEventListener('change', (e) => salvarConfig({ backup: { auto: e.target.checked } }))
    $('ajuste-backup-pasta').addEventListener('click', async () => mostrarConfig(await window.api.escolherPastaBackup()))
    $('ajuste-backup-abrir').addEventListener('click', () => window.api.abrirPastaBackup())
    $('ajuste-backup-agora').addEventListener('click', (e) =>
      executar(e.currentTarget, async () => {
        avisar('Fazendo backup…')
        const r = await window.api.backupAgora()
        mostrarConfig(r.config)
        avisar('Backup feito')
      })
    )
    $('ajuste-exportar-zip').addEventListener('click', (e) =>
      executar(e.currentTarget, async () => {
        const destino = await window.api.exportarZip()
        if (destino) avisar('Exportado')
      })
    )
    $('ajuste-exportar-md').addEventListener('click', (e) =>
      executar(e.currentTarget, async () => {
        const r = await window.api.exportarMarkdown()
        if (r) avisar(`${r.total} notas exportadas em Markdown`)
      })
    )
    $('ajuste-restaurar').addEventListener('click', (e) => executar(e.currentTarget, () => window.api.restaurarBackup()))
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
    iniciarConfigApp()
    montarAjuda()
    aplicar()
  }

  return { iniciar, abrirAjustes, abrirAjuda, fecharModais, algumAberto }
})()