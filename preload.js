const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Notas
  listarNotas: () => ipcRenderer.invoke('notas:listar'),
  buscarNotas: (termo) => ipcRenderer.invoke('notas:buscar', termo),
  listarProjetos: () => ipcRenderer.invoke('projetos:listar'),
  criarNota: (texto, tipo, prazo, projeto, pastaId) =>
    ipcRenderer.invoke('notas:criar', texto, tipo, prazo, projeto, pastaId),
  atualizarNota: (id, texto, tipo, prazo, projeto, pastaId) =>
    ipcRenderer.invoke('notas:atualizar', id, texto, tipo, prazo, projeto, pastaId),
  moverNota: (id, pastaId) => ipcRenderer.invoke('notas:mover', id, pastaId),
  alternarConcluida: (id) => ipcRenderer.invoke('notas:alternar', id),
  removerNota: (id) => ipcRenderer.invoke('notas:remover', id),

  // Pastas
  listarPastas: () => ipcRenderer.invoke('pastas:listar'),
  criarPasta: (nome, paiId) => ipcRenderer.invoke('pastas:criar', nome, paiId),
  renomearPasta: (id, nome) => ipcRenderer.invoke('pastas:renomear', id, nome),
  alternarPasta: (id) => ipcRenderer.invoke('pastas:alternar', id),
  moverPasta: (id, novoPaiId) => ipcRenderer.invoke('pastas:mover', id, novoPaiId),
  removerPasta: (id) => ipcRenderer.invoke('pastas:remover', id),

  // Quadros
  listarQuadros: () => ipcRenderer.invoke('quadros:listar'),
  criarQuadro: (nome, pastaId) => ipcRenderer.invoke('quadros:criar', nome, pastaId),
  renomearQuadro: (id, nome) => ipcRenderer.invoke('quadros:renomear', id, nome),
  moverQuadro: (id, pastaId) => ipcRenderer.invoke('quadros:mover', id, pastaId),
  removerQuadro: (id) => ipcRenderer.invoke('quadros:remover', id),
  carregarQuadro: (id) => ipcRenderer.invoke('quadros:carregar', id),
  criarCartao: (quadroId, tipo, notaId, texto, x, y, cor) =>
    ipcRenderer.invoke('cartoes:criar', quadroId, tipo, notaId, texto, x, y, cor),
  moverCartao: (id, x, y) => ipcRenderer.invoke('cartoes:mover', id, x, y),
  editarCartao: (id, texto, cor) => ipcRenderer.invoke('cartoes:editar', id, texto, cor),
  removerCartao: (id) => ipcRenderer.invoke('cartoes:remover', id),
  criarConexao: (quadroId, deId, paraId) =>
    ipcRenderer.invoke('conexoes:criar', quadroId, deId, paraId),
  removerConexao: (id) => ipcRenderer.invoke('conexoes:remover', id),

  // Eventos que o processo principal envia para a tela
  aoMudar: (callback) => ipcRenderer.on('notas:mudou', () => callback()),
  aoAbrirCaptura: (callback) => ipcRenderer.on('captura:abriu', () => callback()),
  fecharCaptura: () => ipcRenderer.invoke('captura:fechar'),
})