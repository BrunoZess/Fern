const Ics = (() => {
  const pad = (n) => String(n).padStart(2, '0')
  const dataCompacta = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const horaCompacta = (d) => `${dataCompacta(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  const utc = (d) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

  function escapar(texto) {
    return String(texto).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
  }

  function dobrar(linha) {
    const partes = []
    let atual = ''
    let bytes = 0
    for (const ch of linha) {
      const tam = new TextEncoder().encode(ch).length
      const limite = partes.length === 0 ? 75 : 74
      if (bytes + tam > limite) {
        partes.push(atual)
        atual = ''
        bytes = 0
      }
      atual += ch
      bytes += tam
    }
    partes.push(atual)
    return partes.join('\r\n ')
  }

  function hash(texto) {
    let h = 5381
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0
    return h.toString(16)
  }

  function dataDeIso(iso, hora) {
    const [a, m, d] = iso.split('-').map(Number)
    const [h, min] = hora ? hora.split(':').map(Number) : [0, 0]
    return new Date(a, m - 1, d, h, min)
  }

  function blocoEvento({ uid, iso, hora, titulo, descricao }, agora) {
    const inicio = dataDeIso(iso, hora)
    const linhas = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${utc(agora)}`]
    if (hora) {
      const fim = new Date(inicio.getTime() + 60 * 60 * 1000)
      linhas.push(`DTSTART:${horaCompacta(inicio)}`, `DTEND:${horaCompacta(fim)}`)
    } else {
      const fim = new Date(inicio)
      fim.setDate(fim.getDate() + 1)
      linhas.push(`DTSTART;VALUE=DATE:${dataCompacta(inicio)}`, `DTEND;VALUE=DATE:${dataCompacta(fim)}`)
    }
    linhas.push(`SUMMARY:${escapar(titulo)}`)
    if (descricao) linhas.push(`DESCRIPTION:${escapar(descricao)}`)
    linhas.push('END:VEVENT')
    return linhas
  }

  function gerar(eventos, notinhas = [], titulos = new Map(), agora = new Date()) {
    const linhas = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Fern//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Fern',
    ]
    const vistos = new Set()
    for (const e of eventos) {
      if (e.feita) continue
      const chave = `${e.notaId}|${e.data}|${e.hora || ''}|${e.titulo}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      const tituloNota = titulos.get(e.notaId)
      linhas.push(
        ...blocoEvento(
          {
            uid: `${hash(chave)}-${e.notaId}@segundo-cerebro`,
            iso: e.data,
            hora: e.hora,
            titulo: e.titulo,
            descricao: tituloNota && tituloNota !== e.titulo ? `Nota: ${tituloNota}` : '',
          },
          agora
        )
      )
    }
    for (const n of notinhas) {
      const texto = String(n.texto || '').trim()
      if (!texto) continue
      const [primeira, ...resto] = texto.split('\n')
      linhas.push(
        ...blocoEvento(
          { uid: `notinha-${n.id}@segundo-cerebro`, iso: n.data, hora: null, titulo: primeira, descricao: resto.join('\n') },
          agora
        )
      )
    }
    linhas.push('END:VCALENDAR')
    return linhas.map(dobrar).join('\r\n') + '\r\n'
  }

  return { gerar, escapar, dobrar }
})()

if (typeof module !== 'undefined') module.exports = Ics
