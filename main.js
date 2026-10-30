const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} = require('electron')
const path = require('path')

// Fixa a pasta de dados: o banco fica no mesmo lugar no modo dev e no app instalado
app.setPath('userData', path.join(app.getPath('appData'), 'segundo-cerebro'))

// Argumento usado quando o Windows abre o app no login: sobe escondido na bandeja
const ARGS_INICIO = ['--oculto']

let janelaPrincipal = null
let janelaCaptura = null
let bandeja = null
let saindo = false

function criarJanelaPrincipal() {
  // Só abre escondida se houver bandeja para trazê-la de volta
  const iniciarOculto = process.argv.includes('--oculto') && bandeja !== null

  janelaPrincipal = new BrowserWindow({
    width: 900,
    height: 650,
    show: !iniciarOculto,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  janelaPrincipal.loadFile('index.html')

  // Com ícone na bandeja, o X só esconde a janela. Sem bandeja, fecha de verdade.
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

// Janelinha de captura: criada uma vez (escondida) e só mostrada/escondida depois, para abrir instantâneo
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
  // Some sozinha ao perder o foco, como o Spotlight
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

function criarBandeja() {
  const icone = nativeImage.createFromPath(path.join(__dirname, 'icon.png'))
  if (icone.isEmpty()) {
    console.warn('icon.png não encontrado: o app vai funcionar sem ícone na bandeja.')
    return
  }

  bandeja = new Tray(icone.resize({ width: 32, height: 32 }))
  bandeja.setToolTip('Segundo Cérebro')
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Segundo Cérebro', click: mostrarPrincipal },
      { label: 'Captura rápida', click: alternarCaptura },
      { type: 'separator' },
      {
        label: 'Iniciar com o Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings({ args: ARGS_INICIO }).openAtLogin,
        // No modo dev isso registraria o próprio Electron, então só vale no app instalado
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

// Validação única, usada tanto ao criar quanto ao editar uma nota
function validarNota(texto, tipo, prazo, projeto) {
  const tiposValidos = ['tarefa', 'ideia', 'referencia']
  if (typeof texto !== 'string' || !texto.trim() || !tiposValidos.includes(tipo)) {
    throw new Error('Nota inválida')
  }
  const prazoValido =
    tipo === 'tarefa' && typeof prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prazo)
      ? prazo
      : null
  const projetoValido =
    typeof projeto === 'string' && projeto.trim() ? projeto.trim().slice(0, 40) : null
  return { texto: texto.trim(), tipo, prazo: prazoValido, projeto: projetoValido }
}

function iniciar() {
  const db = require('./database')

  ipcMain.handle('notas:listar', () => db.listarNotas())

  ipcMain.handle('notas:buscar', (_event, termo) => {
    if (typeof termo !== 'string') throw new Error('Busca inválida')
    return db.buscarNotas(termo)
  })

  ipcMain.handle('projetos:listar', () => db.listarProjetos())

  ipcMain.handle('notas:criar', (event, texto, tipo, prazo, projeto) => {
    const n = validarNota(texto, tipo, prazo, projeto)
    const nota = db.criarNota(n.texto, n.tipo, n.prazo, n.projeto)

    // Se a nota veio da janelinha de captura, avisa a janela principal para atualizar a lista
    if (
      janelaPrincipal &&
      !janelaPrincipal.isDestroyed() &&
      event.sender !== janelaPrincipal.webContents
    ) {
      janelaPrincipal.webContents.send('notas:mudou')
    }
    return nota
  })

  ipcMain.handle('notas:atualizar', (_event, id, texto, tipo, prazo, projeto) => {
    if (!Number.isInteger(id)) throw new Error('Id inválido')
    const n = validarNota(texto, tipo, prazo, projeto)
    db.atualizarNota(id, n.texto, n.tipo, n.prazo, n.projeto)
  })

  ipcMain.handle('notas:alternar', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Id inválido')
    db.alternarConcluida(id)
  })

  ipcMain.handle('notas:remover', (_event, id) => {
    if (!Number.isInteger(id)) throw new Error('Id inválido')
    db.removerNota(id)
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
}

// Só permite uma instância do app: abrir de novo apenas traz a janela existente para a frente
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', mostrarPrincipal)
  app.whenReady().then(iniciar)
}

// Marca que o encerramento é de verdade (vindo do menu "Sair" ou do sistema)
app.on('before-quit', () => {
  saindo = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (bandeja) bandeja.destroy()
})