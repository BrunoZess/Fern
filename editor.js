// Editor de notas: título, propriedades, texto com autosave, autocompletar de [[links]],
// atalhos de escrita, modo leitura em Markdown e backlinks.
const Editor = (() => {
  const secao = document.getElementById('vista-editor')
  const caminhoEl = document.getElementById('editor-caminho')
  const tituloEl = document.getElementById('editor-titulo')
  const tipoEl = document.getElementById('editor-tipo')
  const projetoEl = document.getElementById('editor-projeto')
  const prazoEl = document.getElementById('editor-prazo')
  const concluidaRotulo = document.getElementById('editor-concluida-rotulo')
  const concluidaEl = document.getElementById('editor-concluida')
  const textoEl = document.getElementById('editor-texto')
  const leituraEl = document.getElementById('editor-leitura')
  const backlinksEl = document.getElementById('editor-backlinks')
  const contagemEl = document.getElementById('editor-contagem')
  const estadoEl = document.getElementById('editor-estado')
  const sugestoesEl = document.getElementById('editor-sugestoes')
  const btnModo = document.getElementById('editor-modo')
  const btnMais = document.getElementById('editor-mais')
  const projetosLista = document.getElementById('projetos-lista')

  let nota = null // { id, tipo, prazo, projeto, pasta_id, concluida }
  let todasNotas = []
  let pastas = []
  let leitura = false
  let salvarTimer = null
  let sujo = false
  let itensSugestao = []
  let indiceSugestao = 0
  let consulta = null // { inicio } do texto digitado depois de "[["
  let cb = { aoAlterar: () => {}, aoAbrirNota: () => {}, aoBuscar: () => {}, menuDaNota: () => [] }

  // ---------- Texto: título (primeira linha) + corpo ----------

  function separar(texto) {
    const i = texto.indexOf('\n')
    return i === -1 ? { titulo: texto, corpo: '' } : { titulo: texto.slice(0, i), corpo: texto.slice(i + 1) }
  }

  function montarTexto() {
    const titulo = tituloEl.value.replace(/\n/g, ' ')
    const corpo = textoEl.value
    return corpo === '' ? titulo : `${titulo}\n${corpo}`
  }

  // ---------- Salvar ----------

  function estado(texto) {
    estadoEl.textContent = texto
  }

  function gravar(n, texto) {
    return window.api.atualizarNota(n.id, texto, n.tipo, n.prazo, n.projeto, n.pasta_id)
  }

  async function salvar() {
    if (!nota) return
    const n = nota
    await gravar(n, montarTexto())
    sujo = false
    estado('Salvo')
    cb.aoAlterar()
  }

  function agendarSalvar() {
    sujo = true
    estado('Salvando…')
    clearTimeout(salvarTimer)
    salvarTimer = setTimeout(salvar, 700)
  }

  // Grava o que faltar e descarta a nota se ela ficou totalmente vazia
  async function fechar() {
    if (!nota) return
    clearTimeout(salvarTimer)
    const atual = nota
    const texto = montarTexto()
    nota = null
    fecharSugestoes()
    if (texto === '' && !atual.projeto && !atual.prazo) {
      await window.api.removerNota(atual.id)
      cb.aoAlterar()
      return
    }
    if (sujo) await gravar(atual, texto)
    sujo = false
  }

  // Esquece a nota sem salvar (usado quando ela foi apagada)
  function esquecer() {
    clearTimeout(salvarTimer)
    nota = null
    sujo = false
    fecharSugestoes()
  }

  // ---------- Abrir ----------

  async function abrir(id) {
    await fechar()
    const [notas, listaPastas, projetos] = await Promise.all([
      window.api.listarNotas(),
      window.api.listarPastas(),
      window.api.listarProjetos(),
    ])
    const encontrada = notas.find((n) => n.id === id)
    if (!encontrada) return false

    todasNotas = notas
    pastas = listaPastas
    nota = {
      id: encontrada.id,
      tipo: encontrada.tipo,
      prazo: encontrada.prazo,
      projeto: encontrada.projeto,
      pasta_id: encontrada.pasta_id,
      concluida: Boolean(encontrada.concluida),
    }

    const { titulo, corpo } = separar(encontrada.texto)
    tituloEl.value = titulo
    textoEl.value = corpo
    tipoEl.value = nota.tipo
    projetoEl.value = nota.projeto || ''
    prazoEl.value = nota.prazo || ''
    concluidaEl.checked = nota.concluida

    projetosLista.replaceChildren()
    for (const p of projetos) {
      const opcao = document.createElement('option')
      opcao.value = p
      projetosLista.appendChild(opcao)
    }

    sujo = false
    definirModo(false)
    atualizarPropriedades()
    atualizarCaminho()
    atualizarBacklinks()
    atualizarContagem()
    estado('Salvo')
    return true
  }

  // Chamado depois que a tela do editor aparece
  function aoMostrar(opcoes = {}) {
    ajustarAltura()
    if (opcoes.focarTitulo) {
      tituloEl.focus()
      tituloEl.select()
    } else if (!tituloEl.value && !textoEl.value) {
      tituloEl.focus()
    }
  }

  // Atualiza a lista de notas e pastas; devolve false se a nota aberta deixou de existir
  function definirDados(notas, listaPastas) {
    todasNotas = notas
    pastas = listaPastas
    if (!nota) return true
    const atual = notas.find((n) => n.id === nota.id)
    if (!atual) return false
    nota.pasta_id = atual.pasta_id
    atualizarCaminho()
    atualizarBacklinks()
    return true
  }

  // ---------- Partes da tela ----------

  function atualizarPropriedades() {
    const ehTarefa = nota.tipo === 'tarefa'
    prazoEl.hidden = !ehTarefa
    concluidaRotulo.hidden = !ehTarefa
  }

  function atualizarCaminho() {
    const partes = []
    let atual = pastas.find((p) => p.id === nota.pasta_id)
    let guarda = 0
    while (atual && guarda++ < 50) {
      partes.unshift(atual.nome)
      const paiId = atual.pai_id
      atual = paiId === null ? null : pastas.find((p) => p.id === paiId)
    }
    caminhoEl.textContent = ['Raiz', ...partes].join(' / ')
  }

  function atualizarBacklinks() {
    const indice = Links.indexar(todasNotas)
    const origens = indice.entrada.get(nota.id) || []
    backlinksEl.replaceChildren()
    backlinksEl.hidden = origens.length === 0
    if (origens.length === 0) return

    backlinksEl.appendChild(document.createTextNode('Mencionada em '))
    for (const origem of origens) {
      const chip = document.createElement('span')
      chip.className = 'wikilink'
      chip.textContent = Links.titulo(origem.texto) || '(sem título)'
      chip.addEventListener('click', () => cb.aoAbrirNota(origem.id))
      backlinksEl.appendChild(chip)
    }
  }

  function atualizarContagem() {
    const t = montarTexto().trim()
    const palavras = t ? t.split(/\s+/).length : 0
    if (palavras === 0) {
      contagemEl.textContent = 'Nota vazia'
      return
    }
    const minutos = Math.max(1, Math.round(palavras / 200))
    contagemEl.textContent = `${palavras} ${palavras === 1 ? 'palavra' : 'palavras'} · ${t.length} caracteres · ${minutos} min de leitura`
  }

  function ajustarAltura() {
    textoEl.style.height = 'auto'
    textoEl.style.height = textoEl.scrollHeight + 'px'
  }

  // ---------- Modo leitura ----------

  function renderizarLeitura() {
    const indice = Links.indexar(todasNotas)
    leituraEl.innerHTML = Markdown.renderizar(textoEl.value, {
      resolver: (nome) => Links.resolver(indice, nome),
    })
  }

  function definirModo(modoLeitura) {
    leitura = modoLeitura
    textoEl.hidden = leitura
    leituraEl.hidden = !leitura
    btnModo.textContent = leitura ? 'Escrever' : 'Ler'
    fecharSugestoes()
    if (leitura) {
      renderizarLeitura()
    } else {
      ajustarAltura()
      textoEl.focus()
    }
  }

  function alternarModo() {
    if (!nota) return
    definirModo(!leitura)
  }

  async function criarNotaDoLink(nome) {
    const nova = await window.api.criarNota(nome, 'ideia', null, '', nota.pasta_id)
    cb.aoAlterar()
    cb.aoAbrirNota(nova.id)
  }

  leituraEl.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-nota], [data-novo], [data-tag], [data-externo]')
    if (!alvo) return
    if (alvo.dataset.nota) cb.aoAbrirNota(Number(alvo.dataset.nota))
    else if (alvo.dataset.novo !== undefined) criarNotaDoLink(alvo.dataset.novo)
    else if (alvo.dataset.tag) cb.aoBuscar(alvo.dataset.tag)
    else if (alvo.dataset.externo) window.api.abrirLink(alvo.dataset.externo).catch(() => {})
  })

  // Marcar uma tarefa no modo leitura troca o [ ] / [x] no texto
  leituraEl.addEventListener('change', (e) => {
    const caixa = e.target
    if (!caixa.matches('input[type="checkbox"][data-linha]')) return
    const linhas = textoEl.value.split('\n')
    const i = Number(caixa.dataset.linha)
    if (linhas[i] === undefined) return
    linhas[i] = linhas[i].replace(/\[( |x|X)\]/, caixa.checked ? '[x]' : '[ ]')
    textoEl.value = linhas.join('\n')
    agendarSalvar()
    renderizarLeitura()
  })

  // ---------- Edição de texto ----------

  function inserir(texto) {
    textoEl.focus()
    if (!document.execCommand('insertText', false, texto)) {
      textoEl.setRangeText(texto, textoEl.selectionStart, textoEl.selectionEnd, 'end')
      textoEl.dispatchEvent(new Event('input'))
    }
  }

  function apagarSelecao() {
    textoEl.focus()
    if (!document.execCommand('delete')) {
      textoEl.setRangeText('', textoEl.selectionStart, textoEl.selectionEnd, 'end')
      textoEl.dispatchEvent(new Event('input'))
    }
  }

  // **negrito**, *itálico*, `código`: envolve a seleção (ou tira, se já estiver envolvida)
  function envolver(marca) {
    const a = textoEl.selectionStart
    const b = textoEl.selectionEnd
    const sel = textoEl.value.slice(a, b)
    const n = marca.length
    if (sel.length >= n * 2 && sel.startsWith(marca) && sel.endsWith(marca)) {
      inserir(sel.slice(n, sel.length - n))
    } else {
      inserir(marca + sel + marca)
      if (a === b) textoEl.setSelectionRange(a + n, a + n)
    }
  }

  function linkParaNota() {
    const a = textoEl.selectionStart
    const b = textoEl.selectionEnd
    inserir(`[[${textoEl.value.slice(a, b)}]]`)
    if (a === b) textoEl.setSelectionRange(a + 2, a + 2)
  }

  function limitesDaLinha(pos) {
    const valor = textoEl.value
    const inicio = valor.lastIndexOf('\n', pos - 1) + 1
    const fim = valor.indexOf('\n', pos)
    return { inicio, fim: fim === -1 ? valor.length : fim }
  }

  // Ctrl+Enter: vira tarefa, marca ou desmarca
  function alternarTarefaDaLinha() {
    const { inicio, fim } = limitesDaLinha(textoEl.selectionStart)
    const linha = textoEl.value.slice(inicio, fim)
    let nova
    if (/^\s*[-*+]\s\[ \]/.test(linha)) nova = linha.replace('[ ]', '[x]')
    else if (/^\s*[-*+]\s\[[xX]\]/.test(linha)) nova = linha.replace(/\[[xX]\]/, '[ ]')
    else if (/^\s*[-*+]\s/.test(linha)) nova = linha.replace(/^(\s*[-*+]\s)/, '$1[ ] ')
    else nova = linha.replace(/^(\s*)/, '$1- [ ] ')
    textoEl.setSelectionRange(inicio, fim)
    inserir(nova)
  }

  // Enter no fim de um item de lista cria o próximo item; em item vazio, sai da lista
  function continuarLista(e) {
    const pos = textoEl.selectionStart
    if (pos !== textoEl.selectionEnd) return
    const { inicio } = limitesDaLinha(pos)
    const antes = textoEl.value.slice(inicio, pos)
    const m = /^(\s*)([-*+]|\d+\.)\s(\[[ xX]\]\s)?/.exec(antes)
    if (!m) return

    e.preventDefault()
    if (antes.length === m[0].length) {
      textoEl.setSelectionRange(inicio, pos)
      apagarSelecao()
      return
    }
    const marcador = /^\d+\.$/.test(m[2]) ? `${parseInt(m[2], 10) + 1}.` : m[2]
    inserir(`\n${m[1]}${marcador} ${m[3] ? '[ ] ' : ''}`)
  }

  // Tab / Shift+Tab: recua ou avança itens de lista
  function indentar(inverso) {
    const a = textoEl.selectionStart
    const { inicio, fim } = limitesDaLinha(a)
    const linha = textoEl.value.slice(inicio, fim)

    if (!inverso) {
      if (/^\s*([-*+]|\d+\.)\s/.test(linha)) {
        textoEl.setSelectionRange(inicio, inicio)
        inserir('  ')
        textoEl.setSelectionRange(a + 2, a + 2)
      } else {
        inserir('  ')
      }
      return
    }
    const espacos = /^ {1,2}/.exec(linha)
    if (!espacos) return
    textoEl.setSelectionRange(inicio, inicio + espacos[0].length)
    apagarSelecao()
    const novaPos = Math.max(inicio, a - espacos[0].length)
    textoEl.setSelectionRange(novaPos, novaPos)
  }

  // ---------- Autocompletar de [[links]] ----------

  // Posição (x, y) do cursor dentro do textarea, usando uma cópia invisível do texto
  function coordenadasDoCursor(pos) {
    const estilo = getComputedStyle(textoEl)
    const espelho = document.createElement('div')
    for (const p of [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'boxSizing', 'width',
    ]) {
      espelho.style[p] = estilo[p]
    }
    Object.assign(espelho.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      top: '0',
      left: '-9999px',
    })
    espelho.textContent = textoEl.value.slice(0, pos)
    const marcador = document.createElement('span')
    marcador.textContent = '\u200b'
    espelho.appendChild(marcador)
    document.body.appendChild(espelho)
    const ponto = { x: marcador.offsetLeft, y: marcador.offsetTop }
    espelho.remove()
    return ponto
  }

  function fecharSugestoes() {
    sugestoesEl.hidden = true
    consulta = null
    itensSugestao = []
  }

  function renderizarSugestoes() {
    sugestoesEl.replaceChildren()
    itensSugestao.forEach((item, i) => {
      const li = document.createElement('li')
      li.textContent = item.rotulo
      if (i === indiceSugestao) li.className = 'ativo'
      li.addEventListener('mousedown', (e) => {
        e.preventDefault()
        aplicarSugestao(item)
      })
      sugestoesEl.appendChild(li)
    })
  }

  function atualizarSugestoes() {
    if (!nota || leitura) return fecharSugestoes()
    const pos = textoEl.selectionStart
    if (pos !== textoEl.selectionEnd) return fecharSugestoes()

    const m = /\[\[([^\[\]\n]*)$/.exec(textoEl.value.slice(0, pos))
    if (!m) return fecharSugestoes()

    const termo = m[1]
    const q = Links.normalizar(termo)
    const titulos = [
      ...new Set(
        todasNotas
          .filter((n) => n.id !== nota.id)
          .map((n) => Links.titulo(n.texto))
          .filter(Boolean)
      ),
    ]
    const filtrados = titulos
      .filter((t) => !q || Links.normalizar(t).includes(q))
      .sort(
        (a, b) =>
          Number(!Links.normalizar(a).startsWith(q)) - Number(!Links.normalizar(b).startsWith(q)) ||
          a.localeCompare(b, 'pt-BR')
      )
      .slice(0, 8)

    itensSugestao = filtrados.map((t) => ({ rotulo: t, valor: t }))
    if (termo.trim() && !titulos.some((t) => Links.normalizar(t) === q)) {
      itensSugestao.push({ rotulo: `Criar “${termo.trim()}”`, valor: termo.trim() })
    }
    if (itensSugestao.length === 0) return fecharSugestoes()

    consulta = { inicio: pos - termo.length }
    indiceSugestao = 0
    renderizarSugestoes()

    const { x, y } = coordenadasDoCursor(pos)
    const r = textoEl.getBoundingClientRect()
    const alturaLinha = parseFloat(getComputedStyle(textoEl).lineHeight) || 24
    sugestoesEl.hidden = false
    const esquerda = Math.min(r.left + x, window.innerWidth - sugestoesEl.offsetWidth - 12)
    sugestoesEl.style.left = `${Math.max(8, esquerda)}px`
    sugestoesEl.style.top = `${r.top + y + alturaLinha}px`
  }

  function aplicarSugestao(item) {
    if (!item || !consulta) return
    textoEl.focus()
    textoEl.setSelectionRange(consulta.inicio, textoEl.selectionStart)
    inserir(`${item.valor}]]`)
    fecharSugestoes()
  }

  // ---------- Menu do botão direito ----------

  async function colarDoSistema() {
    const { texto } = await window.api.lerAreaTransferencia()
    if (texto) inserir(texto)
  }

  textoEl.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const temSelecao = textoEl.selectionStart !== textoEl.selectionEnd
    MenuContexto.abrir({ x: e.clientX, y: e.clientY }, [
      { rotulo: 'Recortar', atalho: 'Ctrl+X', desativado: !temSelecao, aoClicar: () => document.execCommand('cut') },
      { rotulo: 'Copiar', atalho: 'Ctrl+C', desativado: !temSelecao, aoClicar: () => document.execCommand('copy') },
      { rotulo: 'Colar', atalho: 'Ctrl+V', aoClicar: colarDoSistema },
      { separador: true },
      { rotulo: 'Negrito', atalho: 'Ctrl+B', aoClicar: () => envolver('**') },
      { rotulo: 'Itálico', atalho: 'Ctrl+I', aoClicar: () => envolver('*') },
      { rotulo: 'Código', aoClicar: () => envolver('`') },
      { rotulo: 'Link para nota', atalho: '[[', aoClicar: linkParaNota },
      { rotulo: 'Tarefa', atalho: 'Ctrl+Enter', aoClicar: alternarTarefaDaLinha },
      { separador: true },
      { rotulo: 'Ler (pré-visualizar)', atalho: 'Ctrl+E', aoClicar: alternarModo },
      { separador: true },
      ...cb.menuDaNota(),
    ])
  })

  leituraEl.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    MenuContexto.abrir({ x: e.clientX, y: e.clientY }, [
      { rotulo: 'Voltar a escrever', atalho: 'Ctrl+E', aoClicar: alternarModo },
      { separador: true },
      ...cb.menuDaNota(),
    ])
  })

  // ---------- Eventos ----------

  function iniciar(opcoes) {
    cb = { ...cb, ...opcoes }

    tituloEl.addEventListener('input', () => {
      atualizarContagem()
      agendarSalvar()
    })
    tituloEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (leitura) definirModo(false)
        textoEl.focus()
        textoEl.setSelectionRange(0, 0)
      }
    })

    textoEl.addEventListener('input', () => {
      ajustarAltura()
      atualizarContagem()
      agendarSalvar()
      atualizarSugestoes()
    })
    textoEl.addEventListener('blur', fecharSugestoes)

    textoEl.addEventListener('keydown', (e) => {
      if (!sugestoesEl.hidden) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const passo = e.key === 'ArrowDown' ? 1 : -1
          indiceSugestao = (indiceSugestao + passo + itensSugestao.length) % itensSugestao.length
          renderizarSugestoes()
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          aplicarSugestao(itensSugestao[indiceSugestao])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          fecharSugestoes()
          return
        }
      }

      if (e.ctrlKey || e.metaKey) {
        const tecla = e.key.toLowerCase()
        if (tecla === 'b') {
          e.preventDefault()
          envolver('**')
        } else if (tecla === 'i') {
          e.preventDefault()
          envolver('*')
        } else if (e.key === 'Enter') {
          e.preventDefault()
          alternarTarefaDaLinha()
        }
        return
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) continuarLista(e)
      else if (e.key === 'Tab') {
        e.preventDefault()
        indentar(e.shiftKey)
      }
    })

    tipoEl.addEventListener('change', () => {
      if (!nota) return
      nota.tipo = tipoEl.value
      if (nota.tipo !== 'tarefa') {
        nota.prazo = null
        nota.concluida = false
        prazoEl.value = ''
        concluidaEl.checked = false
      }
      atualizarPropriedades()
      agendarSalvar()
    })
    projetoEl.addEventListener('input', () => {
      if (!nota) return
      nota.projeto = projetoEl.value.trim() || null
      agendarSalvar()
    })
    prazoEl.addEventListener('change', () => {
      if (!nota) return
      nota.prazo = prazoEl.value || null
      agendarSalvar()
    })
    concluidaEl.addEventListener('change', async () => {
      if (!nota) return
      await window.api.alternarConcluida(nota.id)
      nota.concluida = concluidaEl.checked
      cb.aoAlterar()
    })

    btnModo.addEventListener('click', alternarModo)
    btnMais.addEventListener('click', () => MenuContexto.abrirEm(btnMais, cb.menuDaNota()))
    window.addEventListener('resize', () => {
      if (!secao.hidden && !leitura) ajustarAltura()
    })

    // Ctrl+E alterna entre escrever e ler
    document.addEventListener('keydown', (e) => {
      if (secao.hidden || !nota) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        alternarModo()
      }
    })
  }

  return {
    iniciar,
    abrir,
    fechar,
    esquecer,
    aoMostrar,
    definirDados,
    idAtual: () => (nota ? nota.id : null),
    tituloAtual: () => Links.titulo(montarTexto()),
  }
})()