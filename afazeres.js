// Tarefas de todas as notas: linhas "- [ ]" / "- [x]" e notas antigas do tipo "tarefa".
// Funções puras, usadas pela vista de Tarefas (tela) e pelos lembretes (processo principal).
const Afazeres = (() => {
  const D = typeof Datas !== 'undefined' ? Datas : require('./datas')
  const L = typeof Links !== 'undefined' ? Links : require('./links')

  const RE_TAREFA = /^(\s*[-*+]\s\[)([ xX])(\]\s?)(.*)$/
  const PASTA_MODELOS = 'modelos'

  // Pastas cujo conteúdo não entra nas tarefas: "Modelos" (na raiz) e as subpastas dela
  function pastasIgnoradas(pastas) {
    const ids = new Set()
    for (const p of pastas) {
      if (p.pai_id === null && L.normalizar(p.nome) === PASTA_MODELOS) ids.add(p.id)
    }
    let cresceu = true
    while (cresceu) {
      cresceu = false
      for (const p of pastas) {
        if (p.pai_id !== null && ids.has(p.pai_id) && !ids.has(p.id)) {
          ids.add(p.id)
          cresceu = true
        }
      }
    }
    return ids
  }

  // [{ notaId, linha (índice no texto inteiro, ou null para nota-tarefa), texto, titulo, feita, data, hora, tituloNota }]
  function extrair(notas, pastas = []) {
    const ignorar = pastasIgnoradas(pastas)
    const tarefas = []
    for (const nota of notas) {
      if (nota.tipo === 'lista' || ignorar.has(nota.pasta_id)) continue
      const texto = nota.texto || ''
      const tituloNota = L.titulo(texto) || '(sem título)'

      if (nota.tipo === 'tarefa') {
        const a = D.analisarLinha(texto.split('\n')[0] || '', nota.criada_em)
        tarefas.push({
          notaId: nota.id,
          linha: null,
          texto: tituloNota,
          titulo: tituloNota,
          feita: Boolean(nota.concluida),
          data: nota.prazo || a.datas[0] || null,
          hora: a.hora,
          tituloNota,
        })
      }

      let emCodigo = false
      texto.split('\n').forEach((linha, i) => {
        if (/^\s*```/.test(linha)) {
          emCodigo = !emCodigo
          return
        }
        if (emCodigo || i === 0) return
        const m = RE_TAREFA.exec(linha)
        if (!m || !m[4].trim()) return
        const a = D.analisarLinha(linha, nota.criada_em)
        tarefas.push({
          notaId: nota.id,
          linha: i,
          texto: m[4].trim(),
          titulo: a.titulo || m[4].trim(),
          feita: m[2] !== ' ',
          data: a.datas[0] || null,
          hora: a.hora,
          tituloNota,
        })
      })
    }
    return tarefas
  }

  // Marca ou desmarca a tarefa da linha; devolve o texto novo (ou null se a linha mudou)
  function alternarLinha(texto, indice, textoEsperado) {
    const linhas = texto.split('\n')
    const m = RE_TAREFA.exec(linhas[indice] || '')
    if (!m || (textoEsperado !== undefined && m[4].trim() !== textoEsperado)) return null
    linhas[indice] = m[1] + (m[2] === ' ' ? 'x' : ' ') + m[3] + m[4]
    return linhas.join('\n')
  }

  return { extrair, alternarLinha, pastasIgnoradas, RE_TAREFA }
})()

if (typeof module !== 'undefined') module.exports = Afazeres
