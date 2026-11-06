const fs = require('fs')
const zlib = require('zlib')
const { promisify } = require('util')

const deflateRaw = promisify(zlib.deflateRaw)
const LIMITE = 0xffffffff

const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dataDos(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const dia = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { hora, dia }
}

const SEM_COMPRESSAO = /\.(png|jpe?g|gif|webp|zip|7z|rar|gz|mp3|mp4|m4a|mov|avi|mkv|pdf|docx|xlsx|pptx)$/i

class EscritorZip {
  constructor(caminho) {
    this.fd = fs.openSync(caminho, 'w')
    this.posicao = 0
    this.central = []
  }

  escrever(buf) {
    fs.writeSync(this.fd, buf)
    this.posicao += buf.length
  }

  async adicionar(nome, conteudo) {
    const dados = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(String(conteudo), 'utf8')
    const nomeBuf = Buffer.from(nome.replace(/\\/g, '/'), 'utf8')
    const crc = crc32(dados)
    let metodo = 0
    let gravado = dados
    if (!SEM_COMPRESSAO.test(nome) && dados.length > 64) {
      const comprimido = await deflateRaw(dados)
      if (comprimido.length < dados.length) {
        metodo = 8
        gravado = comprimido
      }
    }
    if (dados.length >= LIMITE || this.posicao + gravado.length + 100 >= LIMITE) {
      throw new Error('O backup passou de 4 GB, o limite do formato .zip usado pelo app.')
    }
    const { hora, dia } = dataDos(new Date())
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(metodo, 8)
    local.writeUInt16LE(hora, 10)
    local.writeUInt16LE(dia, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(gravado.length, 18)
    local.writeUInt32LE(dados.length, 22)
    local.writeUInt16LE(nomeBuf.length, 26)
    local.writeUInt16LE(0, 28)
    const offset = this.posicao
    this.escrever(local)
    this.escrever(nomeBuf)
    this.escrever(gravado)
    this.central.push({ nomeBuf, metodo, hora, dia, crc, comprimido: gravado.length, tamanho: dados.length, offset })
  }

  fechar() {
    const inicio = this.posicao
    for (const e of this.central) {
      const h = Buffer.alloc(46)
      h.writeUInt32LE(0x02014b50, 0)
      h.writeUInt16LE(20, 4)
      h.writeUInt16LE(20, 6)
      h.writeUInt16LE(0x0800, 8)
      h.writeUInt16LE(e.metodo, 10)
      h.writeUInt16LE(e.hora, 12)
      h.writeUInt16LE(e.dia, 14)
      h.writeUInt32LE(e.crc, 16)
      h.writeUInt32LE(e.comprimido, 20)
      h.writeUInt32LE(e.tamanho, 24)
      h.writeUInt16LE(e.nomeBuf.length, 28)
      h.writeUInt32LE(e.offset, 42)
      this.escrever(h)
      this.escrever(e.nomeBuf)
    }
    const fim = Buffer.alloc(22)
    fim.writeUInt32LE(0x06054b50, 0)
    fim.writeUInt16LE(this.central.length, 8)
    fim.writeUInt16LE(this.central.length, 10)
    fim.writeUInt32LE(this.posicao - inicio, 12)
    fim.writeUInt32LE(inicio, 16)
    this.escrever(fim)
    fs.closeSync(this.fd)
  }

  descartar() {
    try {
      fs.closeSync(this.fd)
    } catch {
    }
  }
}

function lerZip(buf) {
  let fim = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fim = i
      break
    }
  }
  if (fim < 0) throw new Error('Este arquivo não é um .zip válido.')
  const total = buf.readUInt16LE(fim + 10)
  let p = buf.readUInt32LE(fim + 16)
  const entradas = []
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip corrompido.')
    const metodo = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const comprimido = buf.readUInt32LE(p + 20)
    const lenNome = buf.readUInt16LE(p + 28)
    const lenExtra = buf.readUInt16LE(p + 30)
    const lenComent = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const nome = buf.toString('utf8', p + 46, p + 46 + lenNome)
    p += 46 + lenNome + lenExtra + lenComent
    entradas.push({
      nome,
      ler() {
        const ini = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28)
        const bruto = buf.subarray(ini, ini + comprimido)
        let dados
        if (metodo === 0) dados = Buffer.from(bruto)
        else if (metodo === 8) dados = zlib.inflateRawSync(bruto)
        else throw new Error('Compressão não suportada no zip.')
        if (crc32(dados) !== crc) throw new Error(`Arquivo corrompido dentro do zip: ${nome}`)
        return dados
      },
    })
  }
  return entradas
}

module.exports = { EscritorZip, lerZip, crc32 }
