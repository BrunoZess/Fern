// Encontra datas escritas nas notas (27/01, 27/01/2027, 2027-01-27) e vira eventos do calendário.
const Datas = (() => {
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`

  function valida(a, m, d) {
    const x = new Date(a, m - 1, d)
    return x.getFullYear() === a && x.getMonth() === m - 1 && x.getDate() === d
  }

  // Sem ano escrito: usa o ano da criação da nota, ou o seguinte se a data ficaria muito no passado
  function anoInferido(dia, mes, criadaEm) {
    const criada = criadaEm ? new Date(String(criadaEm).replace(' ', 'T')) : new Date()
    const base = Number.isNaN(criada.getTime()) ? new Date() : criada
    let ano = base.getFullYear()
    if (new Date(ano, mes - 1, dia) < new Date(base.getTime() - 60 * 86400000)) ano++
    return ano
  }

  const RE_BR = /(?<![\d/])(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(\d{4}|\d{2}))?(?![\d/])/g
  const RE_ISO = /(?<![\d-])(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?![\d-])/g
  const RE_HORA = /(?:\bàs?\s+)?(?<![\d/:.])([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))(?!\d)/gi

  function acharDatas(linha, criadaEm) {
    const achados = []
    for (const m of linha.matchAll(RE_BR)) {
      const dia = Number(m[1])
      const mes = Number(m[2])
      let ano = anoInferido(dia, mes, criadaEm)
      if (m[3]) ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
      if (valida(ano, mes, dia)) {
        achados.push({ data: iso(ano, mes, dia), inicio: m.index, fim: m.index + m[0].length })
      }
    }
    for (const m of linha.matchAll(RE_ISO)) {
      const ano = Number(m[1])
      const mes = Number(m[2])
      const dia = Number(m[3])
      if (valida(ano, mes, dia)) {
        achados.push({ data: iso(ano, mes, dia), inicio: m.index, fim: m.index + m[0].length })
      }
    }
    return achados
  }

  function semDatas(linha, datas) {
    let t = linha
    for (const d of [...datas].sort((a, b) => b.inicio - a.inicio)) {
      t = t.slice(0, d.inicio) + ' ' + t.slice(d.fim)
    }
    return t
  }

  function acharHora(texto) {
    const m = new RegExp(RE_HORA.source, 'i').exec(texto)
    if (!m) return null
    return `${pad(Number(m[1]))}:${m[2] || m[3] || '00'}`
  }

  function limparTitulo(texto) {
    return texto
      .replace(RE_HORA, ' ')
      .replace(/^\s*([-*+]|\d+\.)\s+(\[[ xX]\]\s*)?/, '')
      .replace(/\[\[([^\[\]]+)\]\]/g, '$1')
      .replace(/#[\p{L}\p{N}_-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[-–—:,;.\s]+|[-–—:,;.\s]+$/g, '')
  }

  // Devolve [{ notaId, data: 'AAAA-MM-DD', hora, titulo, feita, origem: 'texto' | 'prazo' }]
  function extrairEventos(nota) {
    const eventos = []
    const texto = nota.texto || ''
    const tituloNota = Links.titulo(texto) || '(sem título)'
    let emCodigo = false

    texto.split('\n').forEach((linha) => {
      if (/^```/.test(linha)) {
        emCodigo = !emCodigo
        return
      }
      if (emCodigo) return

      const limpa = linha.replace(/https?:\/\/\S+/g, ' ')
      const datas = acharDatas(limpa, nota.criada_em)
      if (datas.length === 0) return

      const resto = semDatas(limpa, datas)
      const hora = acharHora(resto)
      const titulo = limparTitulo(resto) || tituloNota
      const feita = /^\s*[-*+]\s\[[xX]\]/.test(linha)
      for (const d of datas) {
        eventos.push({ notaId: nota.id, data: d.data, hora, titulo, feita, origem: 'texto' })
      }
    })

    if (nota.tipo === 'tarefa' && nota.prazo) {
      const repetido = eventos.some((e) => e.data === nota.prazo && e.titulo === tituloNota)
      if (!repetido) {
        eventos.push({
          notaId: nota.id,
          data: nota.prazo,
          hora: null,
          titulo: tituloNota,
          feita: Boolean(nota.concluida),
          origem: 'prazo',
        })
      }
    }
    return eventos
  }

  function extrairTodos(notas) {
    return notas.flatMap((n) => extrairEventos(n))
  }

  return { extrairEventos, extrairTodos }
})()