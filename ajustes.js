const Ajustes = (() => {
  const CHAVE = 'ajustes'
  const LARGURAS = { estreita: '760px', normal: '1040px', larga: '1280px', total: '100%' }
  const PADRAO = { tema: 'auto', fonte: 15, largura: 'normal', ortografia: false, acento: 'padrao', movimento: 'suave', brilho: true, minimapa: true }
  let cfg = { ...PADRAO }
  try {
    cfg = { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }
  } catch {
    cfg = { ...PADRAO }
  }

  const $ = (id) => document.getElementById(id)
  let focoAnterior = null

  function aplicar() {
    const raiz = document.documentElement
    if (cfg.tema === 'auto') delete raiz.dataset.tema
    else raiz.dataset.tema = cfg.tema
    const cores = { violeta: '#9b8cff', azul: '#62a4ff', verde: '#5bbf9b', rosa: '#ee8bb8', laranja: '#e4a06d' }
    if (cores[cfg.acento]) raiz.style.setProperty('--acento', cores[cfg.acento])
    else raiz.style.removeProperty('--acento')
    raiz.dataset.movimento = cfg.movimento || 'suave'
    raiz.dataset.brilho = cfg.brilho ? 'sim' : 'nao'
    raiz.dataset.minimapa = cfg.minimapa === false ? 'nao' : 'sim'
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
    focoAnterior = document.activeElement
    $('ajuste-acento').value = cfg.acento
    $('ajuste-movimento').value = cfg.movimento
    $('ajuste-brilho').checked = Boolean(cfg.brilho)
    $('ajuste-minimapa').checked = cfg.minimapa !== false
    $('ajuste-tema').value = cfg.tema
    $('ajuste-fonte').value = cfg.fonte
    $('ajuste-fonte-valor').textContent = `${cfg.fonte}px`
    $('ajuste-largura').value = cfg.largura
    $('ajuste-ortografia').checked = Boolean(cfg.ortografia)
    $('ajustes').hidden = false
    $('ajustes-fechar').focus()
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
    if ($('ajustes').hidden) return
    $('ajustes').hidden = true
    if (focoAnterior?.isConnected) focoAnterior.focus()
    focoAnterior = null
  }

  function algumAberto() {
    return !$('ajustes').hidden
  }

  function iniciar() {
    for (const [id, campo, tipo] of [
      ['ajuste-acento', 'acento', 'value'],
      ['ajuste-movimento', 'movimento', 'value'],
      ['ajuste-brilho', 'brilho', 'checked'],
      ['ajuste-minimapa', 'minimapa', 'checked'],
    ]) {
      $(id).addEventListener('change', (e) => {
        cfg[campo] = e.target[tipo]
        aplicar()
        salvar()
      })
    }
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
      if (!algumAberto()) return
      if (e.key === 'Escape') {
        e.preventDefault()
        fecharModais()
      }
      if (e.key === 'Tab') {
        const controles = [...$('ajustes').querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
          .filter(el => el.getClientRects().length > 0)
        if (!controles.length) return
        const primeiro = controles[0], ultimo = controles[controles.length - 1]
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
      }
    })
    iniciarConfigApp()
    aplicar()
  }

  return { iniciar, abrirAjustes, fecharModais, algumAberto }
})()