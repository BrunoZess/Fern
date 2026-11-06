const Lixeira = (() => {
  const listaEl = document.getElementById('lixeira-lista')
  const resumoEl = document.getElementById('lixeira-resumo')
  const esvaziarEl = document.getElementById('lixeira-esvaziar')
  const dicaEl = document.getElementById('lixeira-dica')
  const EXT_IMAGEM = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
  const ROTULO = { nota: 'Nota', quadro: 'Quadro', arquivo: 'Arquivo' }
  const UM_DIA = 86400000

  let cb = { aoAlterar: async () => {}, aoAviso: () => {}, rotuloPasta: () => '' }
  let itens = []
  let dias = 30

  const pad = (n) => String(n).padStart(2, '0')

  function dataDe(texto) {
    const [d, h = '00:00:00'] = String(texto).split(' ')
    const [a, m, dia] = d.split('-').map(Number)
    const [hh, mm, ss] = h.split(':').map(Number)
    return new Date(a, m - 1, dia, hh || 0, mm || 0, ss || 0)
  }

  function iconeDe(item) {
    if (item.tipo === 'nota') return item.notaTipo === 'lista' ? 'lista' : 'nota'
    if (item.tipo === 'quadro') return 'quadro'
    if (item.ext === 'pdf') return 'pdf'
    return EXT_IMAGEM.includes(item.ext) ? 'imagem' : 'arquivo'
  }

  function descricao(item) {
    const quando = dataDe(item.apagado_em)
    const restam = Math.max(0, dias - Math.floor((Date.now() - quando.getTime()) / UM_DIA))
    const partes = [ROTULO[item.tipo]]
    if (item.pasta_id !== null) partes.push(cb.rotuloPasta(item.pasta_id))
    partes.push(`apagado em ${pad(quando.getDate())}/${pad(quando.getMonth() + 1)}`)
    partes.push(restam <= 1 ? 'some amanhã' : `some em ${restam} dias`)
    return partes.filter(Boolean).join(' · ')
  }

  async function restaurar(item) {
    await window.api.restaurarDaLixeira(item.tipo, item.id)
    cb.aoAviso(`"${item.nome}" voltou para o lugar`)
    await cb.aoAlterar()
  }

  async function apagarDeVez(item) {
    if (!confirm(`Apagar "${item.nome}" para sempre? Isso não pode ser desfeito.`)) return
    await window.api.apagarDaLixeira(item.tipo, item.id)
    await cb.aoAlterar()
  }

  async function esvaziar() {
    if (itens.length === 0) return
    const n = itens.length
    if (!confirm(`Apagar para sempre ${n === 1 ? 'o item' : `os ${n} itens`} da lixeira? Isso não pode ser desfeito.`)) return
    await window.api.esvaziarLixeira()
    cb.aoAviso('Lixeira esvaziada')
    await cb.aoAlterar()
  }

  function criarLinha(item) {
    const li = document.createElement('li')
    li.className = 'lixeira-item'
    const icone = Icones.criar(iconeDe(item))
    const corpo = document.createElement('div')
    corpo.className = 'lixeira-corpo'
    const nome = document.createElement('div')
    nome.className = 'lixeira-nome'
    nome.textContent = item.nome
    const meta = document.createElement('div')
    meta.className = 'lixeira-meta'
    meta.textContent = descricao(item)
    corpo.append(nome, meta)

    const btnRestaurar = document.createElement('button')
    btnRestaurar.textContent = 'Restaurar'
    btnRestaurar.addEventListener('click', () => restaurar(item))
    const btnApagar = document.createElement('button')
    btnApagar.className = 'perigo'
    btnApagar.textContent = 'Apagar de vez'
    btnApagar.addEventListener('click', () => apagarDeVez(item))

    li.append(icone, corpo, btnRestaurar, btnApagar)
    return li
  }

  function desenhar() {
    resumoEl.textContent = itens.length === 0 ? '' : itens.length === 1 ? '1 item' : `${itens.length} itens`
    esvaziarEl.disabled = itens.length === 0
    dicaEl.textContent = `Itens apagados ficam aqui por ${dias} dias e depois somem sozinhos.`
    if (itens.length === 0) {
      const vazio = document.createElement('div')
      vazio.className = 'tarefas-vazio'
      vazio.textContent = 'A lixeira está vazia.'
      listaEl.replaceChildren(vazio)
      return
    }
    const ul = document.createElement('ul')
    ul.className = 'lixeira-lista'
    for (const item of itens) ul.appendChild(criarLinha(item))
    listaEl.replaceChildren(ul)
  }

  async function atualizar() {
    const r = await window.api.listarLixeira()
    dias = r.dias || dias
    itens = [
      ...r.notas.map((n) => ({
        tipo: 'nota',
        id: n.id,
        nome: Links.titulo(n.texto) || 'Sem título',
        notaTipo: n.tipo,
        pasta_id: n.pasta_id,
        apagado_em: n.apagado_em,
      })),
      ...r.quadros.map((q) => ({ tipo: 'quadro', id: q.id, nome: q.nome, pasta_id: q.pasta_id, apagado_em: q.apagado_em })),
      ...r.arquivos.map((a) => ({
        tipo: 'arquivo',
        id: a.id,
        nome: a.nome,
        ext: a.ext,
        pasta_id: a.pasta_id,
        apagado_em: a.apagado_em,
      })),
    ].sort((a, b) => b.apagado_em.localeCompare(a.apagado_em))
    desenhar()
  }

  function iniciar(opcoes) {
    cb = { ...cb, ...opcoes }
    esvaziarEl.addEventListener('click', esvaziar)
  }

  return { iniciar, atualizar }
})()
