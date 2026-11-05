// Títulos, [[links]] e backlinks. Funções puras: recebem a lista de notas e devolvem dados.
const Links = (() => {
  const REGEX_TAG = /#[\p{L}\p{N}_-]+/gu
  const REGEX_LINK = /\[\[([^\[\]\n]+)\]\]/g
  let pastasConhecidas = []

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

  // porTitulo: título normalizado -> nota | saida: id -> [{ nome, alvo }] | entrada: id -> notas que a mencionam
  function indexar(notas) {
    const porTitulo = new Map()
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

  // ---------- Pastas ----------

  function definirPastas(lista) {
    pastasConhecidas = lista || []
  }

  // "Faculdade", "Faculdade/Física" ou "Faculdade/": acha a pasta (a menos profunda, se houver repetidas)
  function resolverPasta(nome) {
    const partes = nome
      .trim()
      .replace(/\/+$/, '')
      .split('/')
      .map(normalizar)
      .filter(Boolean)
    if (partes.length === 0) return null

    const porId = new Map(pastasConhecidas.map((p) => [p.id, p]))
    const caminhoDe = (pasta) => {
      const nomes = []
      let atual = pasta
      let guarda = 0
      while (atual && guarda++ < 50) {
        nomes.unshift(normalizar(atual.nome))
        atual = atual.pai_id === null ? null : porId.get(atual.pai_id)
      }
      return nomes
    }

    const candidatas = pastasConhecidas
      .map((pasta) => ({ pasta, caminho: caminhoDe(pasta) }))
      .filter(({ caminho }) =>
        partes.every((parte, i) => caminho[caminho.length - partes.length + i] === parte)
      )
      .sort((a, b) => a.caminho.length - b.caminho.length || a.pasta.nome.localeCompare(b.pasta.nome, 'pt-BR'))
    return candidatas.length > 0 ? candidatas[0].pasta : null
  }

  return { normalizar, titulo, extrairLinks, resolver, indexar, definirPastas, resolverPasta }
})()

if (typeof module !== 'undefined') module.exports = Links
