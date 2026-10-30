const texto = document.getElementById('texto')
const tipo = document.getElementById('tipo')
const projeto = document.getElementById('projeto')
const projetosLista = document.getElementById('projetos-lista')
const prazo = document.getElementById('prazo')
const lista = document.getElementById('lista')
const busca = document.getElementById('busca')
const filtro = document.getElementById('filtro')
const filtroProjeto = document.getElementById('filtro-projeto')
const vazio = document.getElementById('vazio')

// Tags: # seguido de letras (com acento), números, _ ou -
const REGEX_TAG = /(#[\p{L}\p{N}_-]+)/u
const SO_TAG = /^#[\p{L}\p{N}_-]+$/u

// Data de hoje no formato AAAA-MM-DD (fuso local), igual ao do campo de data
function hoje() {
  return new Date().toLocaleDateString('sv-SE')
}

function estaAtrasada(nota) {
  return nota.tipo === 'tarefa' && !nota.concluida && nota.prazo && nota.prazo < hoje()
}

function passaNoFiltro(nota) {
  if (filtroProjeto.value && nota.projeto !== filtroProjeto.value) return false
  switch (filtro.value) {
    case 'pendentes':
      return nota.tipo === 'tarefa' && !nota.concluida
    case 'atrasadas':
      return estaAtrasada(nota)
    case 'concluidas':
      return nota.tipo === 'tarefa' && Boolean(nota.concluida)
    default:
      return true
  }
}

function formatarData(aaaammdd) {
  const [a, m, d] = aaaammdd.split('-')
  return `${d}/${m}/${a}`
}

// Monta o texto da nota, transformando cada #tag em um elemento clicável
function criarConteudo(textoNota, concluida) {
  const span = document.createElement('span')
  if (concluida) span.className = 'feita'

  for (const parte of textoNota.split(REGEX_TAG)) {
    if (SO_TAG.test(parte)) {
      const tag = document.createElement('span')
      tag.className = 'tag'
      tag.textContent = parte
      tag.addEventListener('click', () => {
        busca.value = parte
        renderizar()
      })
      span.appendChild(tag)
    } else if (parte) {
      span.appendChild(document.createTextNode(parte))
    }
  }
  span.appendChild(document.createTextNode(' '))
  return span
}

// Mini formulário que substitui a nota na lista durante a edição
function criarFormularioEdicao(nota) {
  const form = document.createElement('div')
  form.className = 'edicao'

  const area = document.createElement('textarea')
  area.value = nota.texto

  const selectTipo = document.createElement('select')
  const opcoes = [
    ['tarefa', 'Tarefa'],
    ['ideia', 'Ideia'],
    ['referencia', 'Referência'],
  ]
  for (const [valor, rotulo] of opcoes) {
    const opcao = document.createElement('option')
    opcao.value = valor
    opcao.textContent = rotulo
    selectTipo.appendChild(opcao)
  }
  selectTipo.value = nota.tipo

  const campoProjeto = document.createElement('input')
  campoProjeto.type = 'text'
  campoProjeto.setAttribute('list', 'projetos-lista')
  campoProjeto.maxLength = 40
  campoProjeto.placeholder = 'Projeto (opcional)'
  campoProjeto.value = nota.projeto || ''

  const campoPrazo = document.createElement('input')
  campoPrazo.type = 'date'
  campoPrazo.value = nota.prazo || ''

  function ajustarPrazo() {
    campoPrazo.disabled = selectTipo.value !== 'tarefa'
    if (campoPrazo.disabled) campoPrazo.value = ''
  }
  selectTipo.addEventListener('change', ajustarPrazo)
  ajustarPrazo()

  const botaoSalvar = document.createElement('button')
  botaoSalvar.textContent = 'Salvar'
  botaoSalvar.addEventListener('click', async () => {
    const conteudo = area.value.trim()
    if (!conteudo) return
    await window.api.atualizarNota(
      nota.id,
      conteudo,
      selectTipo.value,
      campoPrazo.value || null,
      campoProjeto.value
    )
    renderizar()
  })

  const botaoCancelar = document.createElement('button')
  botaoCancelar.textContent = 'Cancelar'
  botaoCancelar.addEventListener('click', renderizar)

  form.appendChild(area)
  form.appendChild(selectTipo)
  form.appendChild(campoProjeto)
  form.appendChild(campoPrazo)
  form.appendChild(botaoSalvar)
  form.appendChild(botaoCancelar)
  return form
}

// Atualiza o filtro de projetos e as sugestões do campo de projeto
async function atualizarProjetos() {
  const projetos = await window.api.listarProjetos()
  const atual = filtroProjeto.value

  filtroProjeto.innerHTML = ''
  const todos = document.createElement('option')
  todos.value = ''
  todos.textContent = 'Todos os projetos'
  filtroProjeto.appendChild(todos)

  projetosLista.innerHTML = ''
  for (const p of projetos) {
    const opcao = document.createElement('option')
    opcao.value = p
    opcao.textContent = p
    filtroProjeto.appendChild(opcao)

    const sugestao = document.createElement('option')
    sugestao.value = p
    projetosLista.appendChild(sugestao)
  }

  filtroProjeto.value = projetos.includes(atual) ? atual : ''
}

async function renderizar() {
  await atualizarProjetos()

  const termo = busca.value
  const todas = await window.api.buscarNotas(termo)
  const notas = todas.filter(passaNoFiltro)

  lista.innerHTML = ''
  vazio.hidden = notas.length > 0
  const filtrando = termo.trim() || filtro.value !== 'todas' || filtroProjeto.value
  vazio.textContent = filtrando ? 'Nada encontrado.' : 'Nenhuma nota ainda. Capture a primeira!'

  for (const nota of notas) {
    const li = document.createElement('li')

    if (nota.tipo === 'tarefa') {
      const check = document.createElement('input')
      check.type = 'checkbox'
      check.checked = Boolean(nota.concluida)
      check.addEventListener('change', async () => {
        await window.api.alternarConcluida(nota.id)
        renderizar()
      })
      li.appendChild(check)
      li.appendChild(document.createTextNode(' '))
    }

    const etiqueta = document.createElement('span')
    etiqueta.className = 'tipo'
    etiqueta.textContent = nota.tipo
    li.appendChild(etiqueta)

    if (nota.projeto) {
      const badgeProjeto = document.createElement('span')
      badgeProjeto.className = 'projeto'
      badgeProjeto.textContent = nota.projeto
      li.appendChild(badgeProjeto)
    }

    if (nota.prazo) {
      const badge = document.createElement('span')
      const atrasada = estaAtrasada(nota)
      badge.className = atrasada ? 'prazo atrasado' : 'prazo'
      badge.textContent = (atrasada ? 'atrasada · ' : '') + formatarData(nota.prazo)
      li.appendChild(badge)
    }

    li.appendChild(criarConteudo(nota.texto, Boolean(nota.concluida)))

    const botaoEditar = document.createElement('button')
    botaoEditar.textContent = 'editar'
    botaoEditar.addEventListener('click', () => {
      li.replaceChildren(criarFormularioEdicao(nota))
    })
    li.appendChild(botaoEditar)

    const botaoRemover = document.createElement('button')
    botaoRemover.textContent = 'x'
    botaoRemover.addEventListener('click', async () => {
      await window.api.removerNota(nota.id)
      renderizar()
    })
    li.appendChild(botaoRemover)

    lista.appendChild(li)
  }
}

// O prazo só faz sentido para tarefas
function atualizarCampoPrazo() {
  const ehTarefa = tipo.value === 'tarefa'
  prazo.disabled = !ehTarefa
  if (!ehTarefa) prazo.value = ''
}

document.getElementById('salvar').addEventListener('click', async () => {
  const conteudo = texto.value.trim()
  if (!conteudo) return
  await window.api.criarNota(conteudo, tipo.value, prazo.value || null, projeto.value)
  texto.value = ''
  prazo.value = ''
  projeto.value = ''
  renderizar()
})

tipo.addEventListener('change', atualizarCampoPrazo)
busca.addEventListener('input', renderizar)
filtro.addEventListener('change', renderizar)
filtroProjeto.addEventListener('change', renderizar)

window.api.aoMudar(renderizar)

atualizarCampoPrazo()
renderizar()