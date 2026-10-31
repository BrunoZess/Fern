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

  // Eventos que o processo principal envia para a tela
  aoMudar: (callback) => ipcRenderer.on('notas:mudou', () => callback()),
  aoAbrirCaptura: (callback) => ipcRenderer.on('captura:abriu', () => callback()),
  fecharCaptura: () => ipcRenderer.invoke('captura:fechar'),
})