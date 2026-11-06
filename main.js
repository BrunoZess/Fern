const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  dialog,
  Notification,
} = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

app.setPath('userData', path.join(app.getPath('appData'), 'segundo-cerebro'))
app.setAppUserModelId('com.segundocerebro.app')

const ARGS_INICIO = ['--oculto']

let janelaPrincipal = null
let janelaCaptura = null
let bandeja = null
let saindo = false
let verificacaoManual = false

function criarJanelaPrincipal() {
  const iniciarOculto = process.argv.includes('--oculto') && bandeja !== null

  janelaPrincipal = new BrowserWindow({
    width: 1000,
    height: 700,
    show: !iniciarOculto,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  janelaPrincipal.loadFile('index.html')
  janelaPrincipal.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const tecla = input.key.toLowerCase()
    if (input.key === 'F12' || (input.control && input.shift && tecla === 'i')) {
      janelaPrincipal.webContents.toggleDevTools()
      event.preventDefault()
    } else if (input.control && !input.shift && tecla === 'r') {
      janelaPrincipal.webContents.reload()
      event.preventDefault()
    }
  })
  janelaPrincipal.on('close', (event) => {
    if (bandeja && !saindo) {
      event.preventDefault()
      janelaPrincipal.hide()
    }
  })
  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null
    if (!bandeja) app.quit()
  })
}

function mostrarPrincipal() {
  if (!app.isReady()) return
  if (!janelaPrincipal || janelaPrincipal.isDestroyed()) criarJanelaPrincipal()
  if (janelaPrincipal.isMinimized()) janelaPrincipal.restore()
  janelaPrincipal.show()
  janelaPrincipal.focus()
}

function criarJanelaCaptura() {
  janelaCaptura = new BrowserWindow({
    width: 520,
    height: 230,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  janelaCaptura.loadFile('captura.html')
  janelaCaptura.on('blur', () => {
    if (janelaCaptura && !janelaCaptura.isDestroyed()) janelaCaptura.hide()
  })
  janelaCaptura.on('closed', () => {
    janelaCaptura = null
  })
}

function alternarCaptura() {
  if (!janelaCaptura || janelaCaptura.isDestroyed()) criarJanelaCaptura()
  if (janelaCaptura.isVisible()) {
    janelaCaptura.hide()
    return
  }
  janelaCaptura.center()
  janelaCaptura.show()
  janelaCaptura.focus()
  janelaCaptura.webContents.send('captura:abriu')
}

function checarAtualizacao() {
  autoUpdater.checkForUpdates().catch(() => {})
}

function verificarAtualizacoes() {
  verificacaoManual = true
  checarAtualizacao()
}

function configurarAtualizacao() {
  autoUpdater.on('update-available', (info) => {
    if (verificacaoManual) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Atualização encontrada',
        message: `Encontrei a versão ${info.version}.`,
        detail: 'Estou baixando em segundo plano. Aviso quando estiver pronta.',
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    if (verificacaoManual) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Sem atualizações',
        message: 'Você já está na versão mais recente.',
      })
    }
    verificacaoManual = false
  })

  autoUpdater.on('error', (erro) => {
    console.warn('Falha ao verificar atualização:', erro.message)
    if (verificacaoManual) {
      dialog.showMessageBox({
        type: 'warning',
        title: 'Atualização',
        message: 'Não consegui verificar atualizações agora.',
        detail: 'Confira sua conexão e tente de novo mais tarde.',
      })
    }
    verificacaoManual = false
  })

  autoUpdater.on('update-downloaded', (info) => {
    verificacaoManual = false
    dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        title: 'Atualização pronta',
        message: `A versão ${info.version} foi baixada.`,
        detail: 'Reinicie o app para aplicar. Se escolher "Depois", ela é instalada quando você sair do app.',
      })
      .then(({ response }) => {
        if (response === 0) {
          saindo = true
          autoUpdater.quitAndInstall()
        }
      })
  })

  checarAtualizacao()
  setInterval(checarAtualizacao, 6 * 60 * 60 * 1000)
}

function criarBandeja() {
  const icone = nativeImage.createFromPath(path.join(__dirname, 'icon.png'))
  if (icone.isEmpty()) {
    console.warn('icon.png não encontrado: o app vai funcionar sem ícone na bandeja.')
    return
  }

  bandeja = new Tray(icone.resize({ width: 32, height: 32 }))
  bandeja.setToolTip(`Fern v${app.getVersion()}`)
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Fern', click: mostrarPrincipal },
      { label: 'Captura rápida', click: alternarCaptura },
      { label: 'Fazer backup agora', click: () => backupManual() },
      { type: 'separator' },
      { label: `Versão ${app.getVersion()}`, enabled: false },
      {
        label: 'Verificar atualizações',
        enabled: app.isPackaged,
        click: verificarAtualizacoes,
      },
      {
        label: 'Iniciar com o Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings({ args: ARGS_INICIO }).openAtLogin,
        enabled: app.isPackaged,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, args: ARGS_INICIO })
        },
      },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() },
    ])
  )
  bandeja.on('click', mostrarPrincipal)
}

function validarNota(texto, tipo, prazo, projeto) {
  const tiposValidos = ['tarefa', 'ideia', 'referencia', 'lista']
  if (typeof texto !== 'string' || texto.length > 200000 || !tiposValidos.includes(tipo)) {
    throw new Error('Nota inválida')
  }
  const prazoValido =
    tipo === 'tarefa' && typeof prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prazo)
      ? prazo
      : null
  const projetoValido =
    typeof projeto === 'string' && projeto.trim() ? projeto.trim().slice(0, 40) : null
  return { texto, tipo, prazo: prazoValido, projeto: projetoValido }
}

function validarNomePasta(nome) {
  const limpo = typeof nome === 'string' ? nome.trim().slice(0, 60) : ''
  if (!limpo) throw new Error('Nome de pasta inválido')
  return limpo
}

function exigirId(id) {
  if (!Number.isInteger(id)) throw new Error('Id inválido')
  return id
}

const CORES_CARTAO = ['amarelo', 'rosa', 'verde', 'azul', 'roxo', 'branco']

function coordenada(valor) {
  if (!Number.isFinite(valor)) throw new Error('Coordenada inválida')
  return Math.max(-1e6, Math.min(1e6, valor))
}

const fsSync = require('fs')
const backup = require('./backup')
const Lembretes = require('./lembretes')

const CONFIG_PADRAO = {
  backup: { auto: true, pasta: null, manter: 7, ultimo: null },
  lembretes: { ativo: true, hora: '09:00', antes: 10, avisados: {} },
}
let config = null
let db = null

function caminhoConfig() {
  return path.join(app.getPath('userData'), 'config.json')
}

function lerConfig() {
  if (config) return config
  let salvo = {}
  try {
    salvo = JSON.parse(fsSync.readFileSync(caminhoConfig(), 'utf8'))
  } catch {
    salvo = {}
  }
  config = {
    backup: { ...CONFIG_PADRAO.backup, ...(salvo.backup || {}) },
    lembretes: { ...CONFIG_PADRAO.lembretes, ...(salvo.lembretes || {}) },
  }
  return config
}

function salvarConfig() {
  try {
    fsSync.writeFileSync(caminhoConfig(), JSON.stringify(config, null, 2))
  } catch (erro) {
    console.warn('Não consegui salvar a configuração:', erro.message)
  }
}

function configPublica() {
  const c = lerConfig()
  return {
    backup: { ...c.backup, pastaEfetiva: c.backup.pasta || backup.pastaPadrao(app.getPath('userData')) },
    lembretes: { ativo: c.lembretes.ativo, hora: c.lembretes.hora, antes: c.lembretes.antes },
    notificacoes: Notification.isSupported(),
  }
}

const contextoBackup = () => ({ db, userData: app.getPath('userData') })
let backupRodando = null

function fazerBackupAgora() {
  if (backupRodando) return backupRodando
  const c = lerConfig()
  const pasta = c.backup.pasta || backup.pastaPadrao(app.getPath('userData'))
  backupRodando = backup
    .fazerBackup(pasta, contextoBackup(), c.backup.manter)
    .then((destino) => {
      c.backup.ultimo = new Date().toISOString()
      salvarConfig()
      return destino
    })
    .finally(() => {
      backupRodando = null
    })
  return backupRodando
}

async function backupManual() {
  try {
    const destino = await fazerBackupAgora()
    const r = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Mostrar no Explorer', 'OK'],
      defaultId: 1,
      title: 'Backup',
      message: 'Backup feito!',
      detail: destino,
    })
    if (r.response === 0) require('electron').shell.showItemInFolder(destino)
  } catch (erro) {
    dialog.showMessageBox({ type: 'error', title: 'Backup', message: 'Não consegui fazer o backup.', detail: erro.message })
  }
}

function verificarBackupAutomatico() {
  const c = lerConfig()
  if (!c.backup.auto) return
  const ultimo = c.backup.ultimo ? new Date(c.backup.ultimo).getTime() : 0
  if (Date.now() - ultimo < 20 * 60 * 60 * 1000) return
  fazerBackupAgora().catch((erro) => console.warn('Backup automático falhou:', erro.message))
}

function mostrarNotificacao(titulo, corpo, notaId) {
  if (!Notification.isSupported()) return
  const n = new Notification({ title: titulo, body: corpo, icon: path.join(__dirname, 'icon.png') })
  n.on('click', () => {
    mostrarPrincipal()
    if (notaId && janelaPrincipal && !janelaPrincipal.isDestroyed()) {
      janelaPrincipal.webContents.send('abrir-nota', notaId)
    }
  })
  n.show()
}

function verificarLembretes() {
  const c = lerConfig()
  if (!c.lembretes.ativo || !db) return
  const avisar = Lembretes.pendentes({
    notas: db.listarNotas(),
    pastas: db.listarPastas(),
    horaPadrao: c.lembretes.hora,
    antes: c.lembretes.antes,
    avisados: c.lembretes.avisados,
  })
  if (avisar.length === 0) return
  salvarConfig()
  if (avisar.length > 3) {
    mostrarNotificacao(`${avisar.length} tarefas para agora`, avisar.map((t) => `• ${t.titulo}`).slice(0, 5).join('\n'))
    return
  }
  for (const t of avisar) {
    const quando = t.hora ? `Às ${t.hora}` : 'Para hoje'
    mostrarNotificacao(t.titulo, `${quando} · ${t.tituloNota}`, t.notaId)
  }
}

function iniciar() {
  Menu.setApplicationMenu(null)
  try {
    if (backup.aplicarRestauracaoPendente(app.getPath('userData'))) console.log('Backup restaurado.')
  } catch (erro) {
    dialog.showErrorBox('Restauração', `Não consegui aplicar o backup restaurado: ${erro.message}`)
  }
  db = require('./database')
  lerConfig()

  const pastaValida = (id) => (Number.isInteger(id) && db.pastaExiste(id) ? id : null)

  ipcMain.handle('notas:listar', () => db.listarNotas())

  ipcMain.handle('notas:buscar', (_event, termo) => {
    if (typeof termo !== 'string') throw new Error('Busca inválida')
    return db.buscarNotas(termo)
  })

  ipcMain.handle('projetos:listar', () => db.listarProjetos())

  ipcMain.handle('notas:criar', (event, texto, tipo, prazo, projeto, pastaId) => {
    const n = validarNota(texto, tipo, prazo, projeto)
    const nota = db.criarNota(n.texto, n.tipo, n.prazo, n.projeto, pastaValida(pastaId))

    if (
      janelaPrincipal &&
      !janelaPrincipal.isDestroyed() &&
      event.sender !== janelaPrincipal.webContents
    ) {
      janelaPrincipal.webContents.send('notas:mudou')
    }
    return nota
  })

  ipcMain.handle('notas:atualizar', (_event, id, texto, tipo, prazo, projeto, pastaId) => {
    exigirId(id)
    const n = validarNota(texto, tipo, prazo, projeto)
    db.atualizarNota(id, n.texto, n.tipo, n.prazo, n.projeto, pastaValida(pastaId))
  })

  ipcMain.handle('notas:mover', (_event, id, pastaId) => {
    exigirId(id)
    db.moverNota(id, pastaValida(pastaId))
  })

  ipcMain.handle('notas:alternar', (_event, id) => {
    db.alternarConcluida(exigirId(id))
  })

  ipcMain.handle('notas:remover', (_event, id) => {
    db.removerNota(exigirId(id))
  })

  ipcMain.handle('notas:fixar', (_event, id, fixada) => {
    db.fixarNota(exigirId(id), Boolean(fixada))
  })

  ipcMain.handle('pastas:listar', () => db.listarPastas())

  ipcMain.handle('pastas:criar', (_event, nome, paiId) => {
    return db.criarPasta(validarNomePasta(nome), pastaValida(paiId))
  })

  ipcMain.handle('pastas:renomear', (_event, id, nome) => {
    db.renomearPasta(exigirId(id), validarNomePasta(nome))
  })

  ipcMain.handle('pastas:alternar', (_event, id) => {
    db.alternarPasta(exigirId(id))
  })

  ipcMain.handle('pastas:mover', (_event, id, novoPaiId) => {
    exigirId(id)
    if (novoPaiId !== null && !Number.isInteger(novoPaiId)) throw new Error('Pasta inválida')
    return db.moverPasta(id, novoPaiId)
  })

  ipcMain.handle('pastas:remover', (_event, id) => {
    db.removerPasta(exigirId(id))
  })

  const { clipboard } = require('electron')
  const IMAGEM_VALIDA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
  const escolher = (valor, lista) => (lista.includes(valor) ? valor : null)
  const LADOS = ['auto', 't', 'r', 'b', 'l']
  const FORMAS = ['reta', 'curva', 'angular']
  const ESTILOS = ['solido', 'tracejado', 'pontilhado']
  const SETAS = ['fim', 'inicio', 'ambos', 'nenhuma']
  const CORES_LINHA = ['cinza', 'azul', 'vermelho', 'verde', 'laranja', 'roxo']
  const FERRAMENTAS_TRACO = ['caneta', 'lapis', 'marcatexto']

  ipcMain.handle('quadros:listar', () => db.listarQuadros())

  ipcMain.handle('quadros:criar', (_event, nome, pastaId) => {
    return db.criarQuadro(validarNomePasta(nome), pastaValida(pastaId))
  })

  ipcMain.handle('quadros:renomear', (_event, id, nome) => {
    db.renomearQuadro(exigirId(id), validarNomePasta(nome))
  })

  ipcMain.handle('quadros:mover', (_event, id, pastaId) => {
    db.moverQuadro(exigirId(id), pastaValida(pastaId))
  })

  ipcMain.handle('quadros:remover', (_event, id) => {
    db.removerQuadro(exigirId(id))
  })

  ipcMain.handle('quadros:fixar', (_event, id, fixada) => {
    db.fixarQuadro(exigirId(id), Boolean(fixada))
  })

  ipcMain.handle('quadros:carregar', (_event, id) => db.carregarQuadro(exigirId(id)))

  const validarEstilo = (valor) => {
    if (typeof valor !== 'string' || !valor) return ''
    try {
      const e = JSON.parse(valor)
      const saida = {}
      if (Number.isFinite(e.t)) saida.t = Math.max(8, Math.min(200, Math.round(e.t)))
      if (typeof e.c === 'string' && /^#[0-9a-fA-F]{6}$/.test(e.c)) saida.c = e.c
      return JSON.stringify(saida)
    } catch {
      return ''
    }
  }

  ipcMain.handle('cartoes:criar', (_event, quadroId, tipo, notaId, texto, x, y, cor, largura, estilo) => {
    exigirId(quadroId)
    if (!db.quadroExiste(quadroId)) throw new Error('Quadro inexistente')
    if (!['nota', 'texto', 'imagem', 'caixa'].includes(tipo)) throw new Error('Tipo de cartão inválido')

    const nota = tipo === 'nota' ? exigirId(notaId) : null
    let conteudo = ''
    if (tipo === 'texto' || tipo === 'caixa') {
      conteudo = typeof texto === 'string' ? texto.slice(0, 4000) : ''
    } else if (tipo === 'imagem') {
      if (typeof texto !== 'string' || texto.length > 14000000 || !IMAGEM_VALIDA.test(texto)) {
        throw new Error('Imagem inválida ou grande demais')
      }
      conteudo = texto
    }
    const corValida = CORES_CARTAO.includes(cor) ? cor : 'amarelo'
    const larguraValida = Number.isFinite(largura) ? Math.max(60, Math.min(6000, largura)) : 220
    return db.criarCartao(
      quadroId, tipo, nota, conteudo, coordenada(x), coordenada(y), corValida, larguraValida, validarEstilo(estilo)
    )
  })

  ipcMain.handle('cartoes:editar', (_event, id, texto, cor, estilo) => {
    const conteudo = typeof texto === 'string' ? texto.slice(0, 4000) : ''
    const corValida = CORES_CARTAO.includes(cor) ? cor : 'amarelo'
    db.editarCartao(exigirId(id), conteudo, corValida, validarEstilo(estilo))
  })

  ipcMain.handle('cartoes:mover', (_event, id, x, y) => {
    db.moverCartao(exigirId(id), coordenada(x), coordenada(y))
  })

  ipcMain.handle('cartoes:redimensionar', (_event, id, x, y, largura) => {
    if (!Number.isFinite(largura)) throw new Error('Largura inválida')
    db.redimensionarCartao(exigirId(id), coordenada(x), coordenada(y), Math.max(60, Math.min(6000, largura)))
  })

  ipcMain.handle('cartoes:remover', (_event, id) => {
    db.removerCartao(exigirId(id))
  })

  ipcMain.handle('conexoes:criar', (_event, quadroId, deId, paraId, deLado, paraLado) => {
    return db.criarConexao(
      exigirId(quadroId),
      exigirId(deId),
      exigirId(paraId),
      escolher(deLado, LADOS) || 'auto',
      escolher(paraLado, LADOS) || 'auto'
    )
  })

  ipcMain.handle('conexoes:editar', (_event, id, campos) => {
    const c = campos && typeof campos === 'object' ? campos : {}
    db.editarConexao(
      exigirId(id),
      escolher(c.forma, FORMAS),
      escolher(c.estilo, ESTILOS),
      escolher(c.seta, SETAS),
      escolher(c.cor, CORES_LINHA)
    )
  })

  ipcMain.handle('conexoes:inverter', (_event, id) => {
    db.inverterConexao(exigirId(id))
  })

  ipcMain.handle('conexoes:remover', (_event, id) => {
    db.removerConexao(exigirId(id))
  })

  ipcMain.handle('tracos:criar', (_event, quadroId, ferramenta, cor, espessura, pontos, cartaoId) => {
    exigirId(quadroId)
    if (!db.quadroExiste(quadroId)) throw new Error('Quadro inexistente')
    if (!FERRAMENTAS_TRACO.includes(ferramenta)) throw new Error('Ferramenta inválida')
    if (typeof cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(cor)) throw new Error('Cor inválida')
    if (!Number.isFinite(espessura) || espessura < 0.0005 || espessura > 200) throw new Error('Espessura inválida')
    const pontosValidos =
      Array.isArray(pontos) &&
      pontos.length >= 2 &&
      pontos.length <= 40000 &&
      pontos.length % 2 === 0 &&
      pontos.every((v) => Number.isFinite(v))
    if (!pontosValidos) throw new Error('Pontos inválidos')
    const arredondados = pontos.map((v) => Math.round(v * 1000) / 1000)
    const anexo = Number.isInteger(cartaoId) ? cartaoId : null
    return db.criarTraco(quadroId, ferramenta, cor, espessura, JSON.stringify(arredondados), anexo)
  })

  ipcMain.handle('tracos:remover', (_event, id) => {
    db.removerTraco(exigirId(id))
  })

  ipcMain.handle('clipboard:texto', (_event, texto) => {
    if (typeof texto !== 'string') throw new Error('Texto inválido')
    clipboard.writeText(texto.slice(0, 200000))
  })

  ipcMain.handle('clipboard:imagem', (_event, dataUrl) => {
    if (typeof dataUrl !== 'string' || !IMAGEM_VALIDA.test(dataUrl)) throw new Error('Imagem inválida')
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
  })

  const CORES_NOTINHA = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'cinza']

  ipcMain.handle('notinhas:listar', () => db.listarNotinhas())

  ipcMain.handle('notinhas:criar', (_event, data, texto, cor) => {
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida')
    const conteudo = typeof texto === 'string' ? texto.trim().slice(0, 1000) : ''
    if (!conteudo) throw new Error('Notinha vazia')
    return db.criarNotinha(data, conteudo, CORES_NOTINHA.includes(cor) ? cor : 'amarelo')
  })

  ipcMain.handle('notinhas:editar', (_event, id, texto, cor) => {
    const conteudo = typeof texto === 'string' ? texto.trim().slice(0, 1000) : ''
    if (!conteudo) throw new Error('Notinha vazia')
    db.editarNotinha(exigirId(id), conteudo, CORES_NOTINHA.includes(cor) ? cor : 'amarelo')
  })

  ipcMain.handle('notinhas:remover', (_event, id) => {
    db.removerNotinha(exigirId(id))
  })

  const { shell } = require('electron')

  ipcMain.handle('externo:abrir', (_event, url) => {
    if (typeof url !== 'string' || url.length > 2000 || !/^(https?:\/\/|mailto:)/i.test(url)) {
      throw new Error('Link inválido')
    }
    return shell.openExternal(url)
  })

  ipcMain.handle('clipboard:ler', () => {
    const imagem = clipboard.readImage()
    return { texto: clipboard.readText(), imagem: imagem.isEmpty() ? null : imagem.toDataURL() }
  })
  const fs = require('fs')
  const DIR_ARQUIVOS = path.join(app.getPath('userData'), 'arquivos')
  fs.mkdirSync(DIR_ARQUIVOS, { recursive: true })
  const LIMITE_ARQUIVO = 300 * 1024 * 1024
  const EXT_PERIGOSAS = new Set([
    'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'ps1', 'vbs', 'vbe', 'js', 'jse', 'jar', 'lnk', 'reg',
    'dll', 'hta', 'wsf', 'cpl', 'msc', 'sh', 'app', 'apk',
  ])

  const nomeSeguro = (nome) =>
    String(nome || 'arquivo').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120) || 'arquivo'
  const extDe = (nome) => {
    const m = /\.([A-Za-z0-9]{1,8})$/.exec(nome)
    return m ? m[1].toLowerCase() : ''
  }
  const caminhoDoArquivo = (a) => path.join(DIR_ARQUIVOS, a.ext ? `${a.id}.${a.ext}` : String(a.id))
  const arquivoOuErro = (id) => {
    const a = db.obterArquivo(exigirId(id))
    if (!a) throw new Error('Arquivo inexistente')
    return a
  }

  async function guardarArquivo(nome, pastaId, bytes) {
    const limpo = nomeSeguro(nome)
    const registro = db.criarArquivo(limpo, pastaId, extDe(limpo), bytes.length)
    try {
      await fs.promises.writeFile(caminhoDoArquivo(registro), bytes)
    } catch (erro) {
      db.removerArquivo(registro.id)
      throw erro
    }
    return registro
  }

  ipcMain.handle('arquivos:listar', () => db.listarArquivos())

  ipcMain.handle('arquivos:escolher', async (_event, pastaId) => {
    const resultado = await dialog.showOpenDialog(janelaPrincipal, {
      title: 'Adicionar arquivos',
      properties: ['openFile', 'multiSelections'],
    })
    const adicionados = []
    let ignorados = 0
    if (resultado.canceled) return { adicionados, ignorados }
    for (const caminho of resultado.filePaths) {
      try {
        const stat = await fs.promises.stat(caminho)
        if (!stat.isFile() || stat.size > LIMITE_ARQUIVO) {
          ignorados++
          continue
        }
        const bytes = await fs.promises.readFile(caminho)
        adicionados.push(await guardarArquivo(path.basename(caminho), pastaValida(pastaId), bytes))
      } catch {
        ignorados++
      }
    }
    return { adicionados, ignorados }
  })

  ipcMain.handle('arquivos:adicionar', async (_event, nome, pastaId, bytes) => {
    if (!ArrayBuffer.isView(bytes) || bytes.byteLength > LIMITE_ARQUIVO) throw new Error('Arquivo inválido')
    return guardarArquivo(nome, pastaValida(pastaId), Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  })

  ipcMain.handle('arquivos:ler', (_event, id) => fs.promises.readFile(caminhoDoArquivo(arquivoOuErro(id))))

  ipcMain.handle('arquivos:renomear', (_event, id, nome) => {
    db.renomearArquivo(arquivoOuErro(id).id, nomeSeguro(nome))
  })

  ipcMain.handle('arquivos:mover', (_event, id, pastaId) => {
    db.moverArquivo(arquivoOuErro(id).id, pastaValida(pastaId))
  })

  ipcMain.handle('arquivos:remover', async (_event, id) => {
    const a = arquivoOuErro(id)
    db.removerArquivo(a.id)
    await fs.promises.rm(caminhoDoArquivo(a), { force: true })
  })

  ipcMain.handle('arquivos:abrir-externo', async (_event, id) => {
    const a = arquivoOuErro(id)
    if (EXT_PERIGOSAS.has(a.ext)) {
      return { ok: false, motivo: 'Por segurança, este tipo de arquivo não é aberto pelo app. Use "Mostrar no Explorer".' }
    }
    const erro = await shell.openPath(caminhoDoArquivo(a))
    return erro ? { ok: false, motivo: erro } : { ok: true }
  })

  ipcMain.handle('arquivos:mostrar', (_event, id) => {
    shell.showItemInFolder(caminhoDoArquivo(arquivoOuErro(id)))
  })

  ipcMain.handle('arquivos:salvar-copia', async (_event, id) => {
    const a = arquivoOuErro(id)
    const r = await dialog.showSaveDialog(janelaPrincipal, { defaultPath: a.nome })
    if (r.canceled || !r.filePath) return false
    await fs.promises.copyFile(caminhoDoArquivo(a), r.filePath)
    return true
  })

  const DIAS_LIXEIRA = 30
  const TIPOS_LIXEIRA = ['nota', 'quadro', 'arquivo']
  const tipoDaLixeira = (tipo) => {
    if (!TIPOS_LIXEIRA.includes(tipo)) throw new Error('Tipo inválido')
    return tipo
  }

  async function apagarDeVez(tipo, id) {
    const item = db.itemDaLixeira(tipo, id)
    if (!item) return
    if (tipo === 'nota') db.removerNota(id)
    else if (tipo === 'quadro') db.removerQuadro(id)
    else {
      db.removerArquivo(id)
      await fs.promises.rm(caminhoDoArquivo(item), { force: true })
    }
  }

  async function limparLixeiraVencida() {
    for (const { tipo, id } of db.vencidosDaLixeira(DIAS_LIXEIRA)) {
      try {
        await apagarDeVez(tipo, id)
      } catch (erro) {
        console.warn('Não consegui limpar um item da lixeira:', erro.message)
      }
    }
  }

  ipcMain.handle('lixeira:listar', () => ({ ...db.listarLixeira(), dias: DIAS_LIXEIRA }))

  ipcMain.handle('lixeira:mover', (_event, tipo, id) => {
    db.moverParaLixeira(tipoDaLixeira(tipo), exigirId(id))
  })

  ipcMain.handle('lixeira:restaurar', (_event, tipo, id) => {
    db.restaurarDaLixeira(tipoDaLixeira(tipo), exigirId(id))
  })

  ipcMain.handle('lixeira:apagar', (_event, tipo, id) => apagarDeVez(tipoDaLixeira(tipo), exigirId(id)))

  ipcMain.handle('lixeira:esvaziar', async () => {
    const { notas, quadros, arquivos } = db.listarLixeira()
    for (const n of notas) await apagarDeVez('nota', n.id)
    for (const q of quadros) await apagarDeVez('quadro', q.id)
    for (const a of arquivos) await apagarDeVez('arquivo', a.id)
  })

  limparLixeiraVencida()
  setInterval(limparLixeiraVencida, 6 * 60 * 60 * 1000)

  ipcMain.handle('calendario:exportar-ics', async (_event, conteudo) => {
    if (typeof conteudo !== 'string' || conteudo.length > 20 * 1024 * 1024) throw new Error('Calendário inválido')
    const r = await dialog.showSaveDialog(janelaPrincipal, {
      title: 'Exportar calendário (.ics)',
      defaultPath: path.join(app.getPath('documents'), 'Fern.ics'),
      filters: [{ name: 'Calendário', extensions: ['ics'] }],
    })
    if (r.canceled || !r.filePath) return null
    await fs.promises.writeFile(r.filePath, conteudo, 'utf8')
    return r.filePath
  })

  ipcMain.handle('tracos-arquivo:listar', (_event, id) => db.listarTracosArquivo(arquivoOuErro(id).id))

  ipcMain.handle('tracos-arquivo:criar', (_event, id, pagina, ferramenta, cor, espessura, pontos) => {
    const a = arquivoOuErro(id)
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000) throw new Error('Página inválida')
    if (!FERRAMENTAS_TRACO.includes(ferramenta)) throw new Error('Ferramenta inválida')
    if (typeof cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(cor)) throw new Error('Cor inválida')
    if (!Number.isFinite(espessura) || espessura < 0.05 || espessura > 500) throw new Error('Espessura inválida')
    const pontosValidos =
      Array.isArray(pontos) &&
      pontos.length >= 2 &&
      pontos.length <= 40000 &&
      pontos.length % 2 === 0 &&
      pontos.every((v) => Number.isFinite(v))
    if (!pontosValidos) throw new Error('Pontos inválidos')
    const arredondados = pontos.map((v) => Math.round(v * 100) / 100)
    return db.criarTracoArquivo(a.id, pagina, ferramenta, cor, espessura, JSON.stringify(arredondados))
  })

  ipcMain.handle('tracos-arquivo:remover', (_event, id) => {
    db.removerTracoArquivo(exigirId(id))
  })

  ipcMain.handle('config:ler', () => configPublica())

  ipcMain.handle('config:salvar', (_event, novo) => {
    const c = lerConfig()
    const n = novo && typeof novo === 'object' ? novo : {}
    if (n.backup && typeof n.backup === 'object') {
      if (typeof n.backup.auto === 'boolean') c.backup.auto = n.backup.auto
      if (Number.isInteger(n.backup.manter)) c.backup.manter = Math.max(1, Math.min(60, n.backup.manter))
    }
    if (n.lembretes && typeof n.lembretes === 'object') {
      if (typeof n.lembretes.ativo === 'boolean') c.lembretes.ativo = n.lembretes.ativo
      if (typeof n.lembretes.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(n.lembretes.hora)) {
        c.lembretes.hora = n.lembretes.hora
      }
      if (Number.isInteger(n.lembretes.antes)) c.lembretes.antes = Math.max(0, Math.min(1440, n.lembretes.antes))
    }
    salvarConfig()
    verificarBackupAutomatico()
    return configPublica()
  })

  ipcMain.handle('backup:escolher-pasta', async () => {
    const r = await dialog.showOpenDialog(janelaPrincipal, {
      title: 'Pasta dos backups automáticos',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (r.canceled || !r.filePaths[0]) return configPublica()
    lerConfig().backup.pasta = r.filePaths[0]
    salvarConfig()
    return configPublica()
  })

  ipcMain.handle('backup:abrir-pasta', async () => {
    const pasta = configPublica().backup.pastaEfetiva
    fs.mkdirSync(pasta, { recursive: true })
    await shell.openPath(pasta)
  })

  ipcMain.handle('backup:agora', async () => {
    const destino = await fazerBackupAgora()
    return { destino, config: configPublica() }
  })

  ipcMain.handle('backup:exportar-zip', async () => {
    const r = await dialog.showSaveDialog(janelaPrincipal, {
      title: 'Exportar tudo (.zip)',
      defaultPath: path.join(app.getPath('documents'), `Fern ${backup.carimbo()}.zip`),
      filters: [{ name: 'Arquivo zip', extensions: ['zip'] }],
    })
    if (r.canceled || !r.filePath) return null
    await backup.criarZip(r.filePath, contextoBackup())
    shell.showItemInFolder(r.filePath)
    return r.filePath
  })

  ipcMain.handle('backup:exportar-markdown', async () => {
    const r = await dialog.showOpenDialog(janelaPrincipal, {
      title: 'Exportar notas como Markdown (escolha onde criar a pasta)',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
    })
    if (r.canceled || !r.filePaths[0]) return null
    const resultado = await backup.exportarMarkdown(r.filePaths[0], contextoBackup())
    shell.openPath(resultado.pasta)
    return resultado
  })

  ipcMain.handle('backup:restaurar', async () => {
    const r = await dialog.showOpenDialog(janelaPrincipal, {
      title: 'Restaurar backup',
      filters: [{ name: 'Backup do Fern', extensions: ['zip'] }],
      properties: ['openFile'],
    })
    if (r.canceled || !r.filePaths[0]) return false
    const confirma = await dialog.showMessageBox(janelaPrincipal, {
      type: 'warning',
      buttons: ['Restaurar e reiniciar', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Restaurar backup',
      message: 'Trocar tudo o que está no app pelo conteúdo deste backup?',
      detail:
        'Antes, faço um backup do estado atual (fica na pasta de backups). O app reinicia sozinho para concluir.',
    })
    if (confirma.response !== 0) return false
    await fazerBackupAgora()
    await backup.prepararRestauracao(r.filePaths[0], app.getPath('userData'))
    saindo = true
    app.relaunch()
    app.exit(0)
    return true
  })

  ipcMain.handle('lembretes:testar', () => {
    if (!Notification.isSupported()) return false
    mostrarNotificacao('Lembretes ligados', 'É assim que as tarefas com data vão te avisar.')
    return true
  })

  ipcMain.handle('captura:fechar', () => {
    if (janelaCaptura && !janelaCaptura.isDestroyed()) janelaCaptura.hide()
  })

  criarBandeja()
  criarJanelaPrincipal()
  criarJanelaCaptura()

  const registrou = globalShortcut.register('CommandOrControl+Shift+Space', alternarCaptura)
  if (!registrou) {
    console.warn('Não foi possível registrar o atalho global (outro app pode estar usando).')
  }

  if (app.isPackaged) configurarAtualizacao()

  setTimeout(verificarBackupAutomatico, 60 * 1000)
  setInterval(verificarBackupAutomatico, 60 * 60 * 1000)
  setTimeout(verificarLembretes, 5 * 1000)
  setInterval(verificarLembretes, 30 * 1000)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', mostrarPrincipal)
  app.whenReady().then(iniciar)
}

app.on('before-quit', () => {
  saindo = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (bandeja) bandeja.destroy()
})