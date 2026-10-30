const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  listarNotas: () => ipcRenderer.invoke('notas:listar'),
  buscarNotas: (termo) => ipcRenderer.invoke('notas:buscar', termo),
  listarProjetos: () => ipcRenderer.invoke('projetos:listar'),
  criarNota: (texto, tipo, prazo, projeto) =>
    ipcRenderer.invoke('notas:criar', texto, tipo, prazo, projeto),
  atualizarNota: (id, texto, tipo, prazo, projeto) =>
    ipcRenderer.invoke('notas:atualizar', id, texto, tipo, prazo, projeto),
  alternarConcluida: (id) => ipcRenderer.invoke('notas:alternar', id),
  removerNota: (id) => ipcRenderer.invoke('notas:remover', id),

  // Eventos que o processo principal envia para a tela
  aoMudar: (callback) => ipcRenderer.on('notas:mudou', () => callback()),
  aoAbrirCaptura: (callback) => ipcRenderer.on('captura:abriu', () => callback()),
  fecharCaptura: () => ipcRenderer.invoke('captura:fechar'),
})