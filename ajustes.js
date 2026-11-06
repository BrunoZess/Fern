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
    }
  }

  function abrirAjustes() {
    $('ajuste-tema').value = cfg.tema
    $('ajuste-fonte').value = cfg.fonte
    $('ajuste-fonte-valor').textContent = `${cfg.fonte}px`
    $('ajuste-largura').value = cfg.largura
    $('ajuste-ortografia').checked = Boolean(cfg.ortografia)
    $('ajustes').hidden = false
    window.api.lerConfig().then(mostrarConfig).catch(() => {})
  }

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

  function fecharModais() {
    $('ajustes').hidden = true
  }

  function algumAberto() {
    return !$('ajustes').hidden
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
    $('ajustes').addEventListener('pointerdown', (e) => {
      if (e.target === $('ajustes')) fecharModais()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && algumAberto()) fecharModais()
    })
    iniciarConfigApp()
    aplicar()
  }

  return { iniciar, abrirAjustes, fecharModais, algumAberto }
})()