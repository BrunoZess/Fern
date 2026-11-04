const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {

  // Arquivos
  listarArquivos: () => ipcRenderer.invoke('arquivos:listar'),
  escolherArquivos: (pastaId) => ipcRenderer.invoke('arquivos:escolher', pastaId),
  adicionarArquivo: (nome, pastaId, bytes) => ipcRenderer.invoke('arquivos:adicionar', nome, pastaId, bytes),
  lerArquivo: (id) => ipcRenderer.invoke('arquivos:ler', id),
  renomearArquivo: (id, nome) => ipcRenderer.invoke('arquivos:renomear', id, nome),
  moverArquivo: (id, pastaId) => ipcRenderer.invoke('arquivos:mover', id, pastaId),
  removerArquivo: (id) => ipcRenderer.invoke('arquivos:remover', id),
  abrirArquivoExterno: (id) => ipcRenderer.invoke('arquivos:abrir-externo', id),
  mostrarArquivoNaPasta: (id) => ipcRenderer.invoke('arquivos:mostrar', id),
  salvarCopiaArquivo: (id) => ipcRenderer.invoke('arquivos:salvar-copia', id),
  listarTracosArquivo: (id) => ipcRenderer.invoke('tracos-arquivo:listar', id),
  criarTracoArquivo: (id, pagina, ferramenta, cor, espessura, pontos) =>
    ipcRenderer.invoke('tracos-arquivo:criar', id, pagina, ferramenta, cor, espessura, pontos),
  removerTracoArquivo: (id) => ipcRenderer.invoke('tracos-arquivo:remover', id),
  listarNotinhas: () => ipcRenderer.invoke('notinhas:listar'),
  criarNotinha: (data, texto, cor) => ipcRenderer.invoke('notinhas:criar', data, texto, cor),
  editarNotinha: (id, texto, cor) => ipcRenderer.invoke('notinhas:editar', id, texto, cor),
  removerNotinha: (id) => ipcRenderer.invoke('notinhas:remover', id),
  criarCartao: (quadroId, tipo, notaId, texto, x, y, cor, largura, estilo) =>
    ipcRenderer.invoke('cartoes:criar', quadroId, tipo, notaId, texto, x, y, cor, largura, estilo),
  editarCartao: (id, texto, cor, estilo) => ipcRenderer.invoke('cartoes:editar', id, texto, cor, estilo),
  criarTraco: (quadroId, ferramenta, cor, espessura, pontos, cartaoId) =>
    ipcRenderer.invoke('tracos:criar', quadroId, ferramenta, cor, espessura, pontos, cartaoId),

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
  moverCartao: (id, x, y) => ipcRenderer.invoke('cartoes:mover', id, x, y),
  redimensionarCartao: (id, x, y, largura) =>
    ipcRenderer.invoke('cartoes:redimensionar', id, x, y, largura),
  removerCartao: (id) => ipcRenderer.invoke('cartoes:remover', id),
  criarConexao: (quadroId, deId, paraId, deLado, paraLado) =>
    ipcRenderer.invoke('conexoes:criar', quadroId, deId, paraId, deLado, paraLado),
  editarConexao: (id, campos) => ipcRenderer.invoke('conexoes:editar', id, campos),
  inverterConexao: (id) => ipcRenderer.invoke('conexoes:inverter', id),
  removerConexao: (id) => ipcRenderer.invoke('conexoes:remover', id),
  removerTraco: (id) => ipcRenderer.invoke('tracos:remover', id),
  copiarTexto: (texto) => ipcRenderer.invoke('clipboard:texto', texto),
  copiarImagem: (dataUrl) => ipcRenderer.invoke('clipboard:imagem', dataUrl),
  abrirLink: (url) => ipcRenderer.invoke('externo:abrir', url),
  lerAreaTransferencia: () => ipcRenderer.invoke('clipboard:ler'),
  // Eventos que o processo principal envia para a tela
  aoMudar: (callback) => ipcRenderer.on('notas:mudou', () => callback()),
  aoAbrirCaptura: (callback) => ipcRenderer.on('captura:abriu', () => callback()),
  fecharCaptura: () => ipcRenderer.invoke('captura:fechar'),
})