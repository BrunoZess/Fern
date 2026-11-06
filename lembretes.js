const Afazeres = require('./afazeres')

const UM_DIA = 86400000

function quando(t, horaPadrao, antesMin) {
  const [a, m, d] = t.data.split('-').map(Number)
  const [h, min] = (t.hora || horaPadrao || '09:00').split(':').map(Number)
  const alvo = new Date(a, m - 1, d, h, min).getTime()
  return t.hora ? alvo - antesMin * 60000 : alvo
}

const chaveDe = (t) => `${t.notaId}|${t.texto}|${t.data}|${t.hora || ''}`

function pendentes({ notas, pastas, horaPadrao, antes, avisados, agora = Date.now() }) {
  const avisar = []
  for (const t of Afazeres.extrair(notas, pastas)) {
    if (t.feita || !t.data) continue
    const chave = chaveDe(t)
    if (avisados[chave]) continue
    const momento = quando(t, horaPadrao, antes)
    if (agora >= momento && agora - momento < UM_DIA) {
      avisados[chave] = agora
      avisar.push(t)
    }
  }
  for (const [chave, em] of Object.entries(avisados)) {
    if (agora - em > 45 * UM_DIA) delete avisados[chave]
  }
  return avisar
}

module.exports = { pendentes }
