const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  dialog,
} = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

// Fixa a pasta de dados: o banco fica no mesmo lugar no modo dev e no app instalado
app.setPath('userData', path.join(app.getPath('appData'), 'segundo-cerebro'))

// Argumento usado quando o Windows abre o app no login: sobe escondido na bandeja
const ARGS_INICIO = ['--oculto']

let janelaPrincipal = null
let janelaCaptura = null
let bandeja = null
let saindo = false
let verificacaoManual = false

function criarJanelaPrincipal() {
  // Só abre escondida se houver bandeja para trazê-la de volta
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

// ---------- Atualização automática (só no app instalado) ----------

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
  bandeja.setToolTip(`Segundo Cérebro v${app.getVersion()}`)
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Segundo Cérebro', click: mostrarPrincipal },
      { label: 'Captura rápida', click: alternarCaptura },
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

// ---------- Validação (a tela nunca é a última linha de defesa) ----------

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

function iniciar() {
  const db = require('./database')

  // Id de pasta existente, ou null (= sem pasta)
  const pastaValida = (id) => (Number.isInteger(id) && db.pastaExiste(id) ? id : null)

  // ----- Notas -----

  ipcMain.handle('notas:listar', () => db.listarNotas())

  ipcMain.handle('notas:buscar', (_event, termo) => {
    if (typeof termo !== 'string') throw new Error('Busca inválida')
    return db.buscarNotas(termo)
  })

  ipcMain.handle('projetos:listar', () => db.listarProjetos())

  ipcMain.handle('notas:criar', (event, texto, tipo, prazo, projeto, pastaId) => {
    const n = validarNota(texto, tipo, prazo, projeto)
    const nota = db.criarNota(n.texto, n.tipo, n.prazo, n.projeto, pastaValida(pastaId))

    // Se a nota veio da janelinha de captura, avisa a janela principal para atualizar
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

  // ----- Pastas -----

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

    // ----- Quadros -----

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

  ipcMain.handle('quadros:carregar', (_event, id) => db.carregarQuadro(exigirId(id)))

    const { clipboard } = require('electron')
  // Só imagens PNG, JPEG ou WebP em base64 (nada de SVG, que pode carregar scripts)
  const IMAGEM_VALIDA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

  ipcMain.handle('cartoes:criar', (_event, quadroId, tipo, notaId, texto, x, y, cor) => {
    exigirId(quadroId)
    if (!db.quadroExiste(quadroId)) throw new Error('Quadro inexistente')
    if (!['nota', 'texto', 'imagem'].includes(tipo)) throw new Error('Tipo de cartão inválido')

    const nota = tipo === 'nota' ? exigirId(notaId) : null
    let conteudo = ''
    if (tipo === 'texto') {
      conteudo = typeof texto === 'string' ? texto.slice(0, 2000) : ''
    } else if (tipo === 'imagem') {
      if (typeof texto !== 'string' || texto.length > 4000000 || !IMAGEM_VALIDA.test(texto)) {
        throw new Error('Imagem inválida ou grande demais')
      }
      conteudo = texto
    }
    const corValida = CORES_CARTAO.includes(cor) ? cor : 'amarelo'
    return db.criarCartao(quadroId, tipo, nota, conteudo, coordenada(x), coordenada(y), corValida)
  })

  // Área de transferência: quem fala com o sistema é o processo principal
  ipcMain.handle('clipboard:texto', (_event, texto) => {
    if (typeof texto !== 'string') throw new Error('Texto inválido')
    clipboard.writeText(texto.slice(0, 200000))
  })

  ipcMain.handle('clipboard:imagem', (_event, dataUrl) => {
    if (typeof dataUrl !== 'string' || !IMAGEM_VALIDA.test(dataUrl)) throw new Error('Imagem inválida')
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
  })

  ipcMain.handle('cartoes:mover', (_event, id, x, y) => {
    db.moverCartao(exigirId(id), coordenada(x), coordenada(y))
  })

  ipcMain.handle('cartoes:editar', (_event, id, texto, cor) => {
    const conteudo = typeof texto === 'string' ? texto.slice(0, 2000) : ''
    const corValida = CORES_CARTAO.includes(cor) ? cor : 'amarelo'
    db.editarCartao(exigirId(id), conteudo, corValida)
  })

  ipcMain.handle('cartoes:remover', (_event, id) => {
    db.removerCartao(exigirId(id))
  })

  ipcMain.handle('conexoes:criar', (_event, quadroId, deId, paraId) => {
    return db.criarConexao(exigirId(quadroId), exigirId(deId), exigirId(paraId))
  })

  ipcMain.handle('conexoes:remover', (_event, id) => {
    db.removerConexao(exigirId(id))
  })


  // ----- Janelinha de captura -----

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