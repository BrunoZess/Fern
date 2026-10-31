// Títulos, [[links]] e backlinks. Funções puras: recebem a lista de notas e devolvem dados.
// Usadas pela janela principal e, nos próximos passos, pelo grafo e pelo quadro.
const Links = (() => {
  const REGEX_TAG = /#[\p{L}\p{N}_-]+/gu
  const REGEX_LINK = /\[\[([^\[\]\n]+)\]\]/g

  function normalizar(s) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Título = primeira linha com texto, sem #tags e sem os colchetes dos [[links]]
  function titulo(texto) {
    const linha = texto.split('\n').find((l) => l.trim()) || ''
    return linha
      .replace(/\[\[([^\[\]]+)\]\]/g, '$1')
      .replace(REGEX_TAG, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
  }

  function extrairLinks(texto) {
    return Array.from(texto.matchAll(REGEX_LINK), (m) => m[1].trim())
  }

  function resolver(indice, nome) {
    return indice.porTitulo.get(normalizar(nome)) || null
  }

  // Monta o índice completo a partir de todas as notas:
  //  porTitulo: título normalizado -> nota
  //  saida:     id da nota -> [{ nome, alvo }] (os [[links]] que ela contém)
  //  entrada:   id da nota -> [notas que a mencionam] (backlinks)
  function indexar(notas) {
    const porTitulo = new Map()
    // Se houver títulos repetidos, vale a nota mais antiga (menor id)
    for (const nota of [...notas].sort((a, b) => a.id - b.id)) {
      const t = normalizar(titulo(nota.texto))
      if (t && !porTitulo.has(t)) porTitulo.set(t, nota)
    }

    const indice = { porTitulo, saida: new Map(), entrada: new Map() }

    for (const nota of notas) {
      const lista = []
      for (const nome of extrairLinks(nota.texto)) {
        const alvo = resolver(indice, nome)
        lista.push({ nome, alvo })
        if (alvo && alvo.id !== nota.id) {
          const origens = indice.entrada.get(alvo.id) || []
          if (!origens.some((o) => o.id === nota.id)) origens.push(nota)
          indice.entrada.set(alvo.id, origens)
        }
      }
      indice.saida.set(nota.id, lista)
    }
    return indice
  }

  return { normalizar, titulo, extrairLinks, resolver, indexar }
})()