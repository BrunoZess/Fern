// Conversor de Markdown simples e seguro, usado no modo leitura.
// Todo texto do usuário é escapado; só links http(s)/mailto são aceitos.
const Markdown = (() => {
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Formatação dentro de uma linha: código, [[links]], links, URLs, #tags, negrito, itálico, riscado
  function inline(bruto, ctx) {
    const guardados = []
    const guardar = (html) => `\u0000${guardados.push(html) - 1}\u0000`
    let t = bruto

    t = t.replace(/`([^`\n]+)`/g, (_, c) => guardar(`<code>${esc(c)}</code>`))

    t = t.replace(/\[\[([^\[\]\n]+)\]\]/g, (_, nome) => {
      const limpo = nome.trim()
      const alvo = ctx.resolver ? ctx.resolver(limpo) : null
      return guardar(
        alvo
          ? `<a class="wikilink" data-nota="${alvo.id}">${esc(limpo)}</a>`
          : `<a class="wikilink pendente" data-novo="${esc(limpo)}">${esc(limpo)}</a>`
      )
    })

    t = t.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (todo, rotulo, url) =>
      /^(https?:\/\/|mailto:)/i.test(url)
        ? guardar(`<a class="externo" data-externo="${esc(url)}">${esc(rotulo)}</a>`)
        : todo
    )

    t = t.replace(/https?:\/\/[^\s<>()]+/g, (url) =>
      guardar(`<a class="externo" data-externo="${esc(url)}">${esc(url)}</a>`)
    )

    t = t.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_, antes, tag) =>
      antes + guardar(`<a class="tag" data-tag="#${esc(tag)}">#${esc(tag)}</a>`)
    )

    t = esc(t)
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    t = t.replace(/(^|[^\w])_([^_\n]+)_(?![\w])/g, '$1<em>$2</em>')
    t = t.replace(/~~([^~\n]+)~~/g, '<s>$1</s>')

    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[Number(i)])
  }

  const RE_LISTA = /^\s*([-*+]|\d+\.)\s/
  const RE_QUEBRA_PARAGRAFO = /^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s|(-{3,}|\*{3,}|_{3,})\s*$)/

  // ctx.resolver(nome) devolve a nota de um [[link]] (ou null)
  function renderizar(texto, ctx = {}) {
    const linhas = texto.split('\n')
    const saida = []
    let i = 0

    while (i < linhas.length) {
      const linha = linhas[i]

      if (/^```/.test(linha)) {
        const codigo = []
        i++
        while (i < linhas.length && !/^```/.test(linhas[i])) codigo.push(linhas[i++])
        i++
        saida.push(`<pre><code>${esc(codigo.join('\n'))}</code></pre>`)
        continue
      }

      if (!linha.trim()) {
        i++
        continue
      }

      const titulo = /^(#{1,6})\s+(.*)$/.exec(linha)
      if (titulo) {
        const n = titulo[1].length
        saida.push(`<h${n}>${inline(titulo[2], ctx)}</h${n}>`)
        i++
        continue
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(linha)) {
        saida.push('<hr>')
        i++
        continue
      }

      if (/^>\s?/.test(linha)) {
        const citacao = []
        while (i < linhas.length && /^>\s?/.test(linhas[i])) citacao.push(linhas[i++].replace(/^>\s?/, ''))
        saida.push(`<blockquote>${citacao.map((l) => inline(l, ctx)).join('<br>')}</blockquote>`)
        continue
      }

      if (RE_LISTA.test(linha)) {
        const ordenada = /^\s*\d+\.\s/.test(linha)
        const itens = []
        while (i < linhas.length && RE_LISTA.test(linhas[i])) {
          const m = /^(\s*)([-*+]|\d+\.)\s(\[( |x|X)\]\s)?(.*)$/.exec(linhas[i])
          const nivel = Math.floor(m[1].replace(/\t/g, '  ').length / 2)
          const ehTarefa = Boolean(m[3])
          const feita = ehTarefa && m[4].toLowerCase() === 'x'
          const marca = ehTarefa ? `<input type="checkbox" data-linha="${i}"${feita ? ' checked' : ''}> ` : ''
          const classe = (ehTarefa ? 'tarefa' : '') + (feita ? ' feito' : '')
          itens.push(
            `<li class="${classe.trim()}" style="margin-left:${nivel * 1.4}em">${marca}${inline(m[5], ctx)}</li>`
          )
          i++
        }
        const tag = ordenada ? 'ol' : 'ul'
        saida.push(`<${tag}>${itens.join('')}</${tag}>`)
        continue
      }

      const paragrafo = []
      while (i < linhas.length && linhas[i].trim() && !RE_QUEBRA_PARAGRAFO.test(linhas[i])) {
        paragrafo.push(linhas[i++])
      }
      if (paragrafo.length === 0) {
        paragrafo.push(linhas[i++])
      }
      saida.push(`<p>${paragrafo.map((l) => inline(l, ctx)).join('<br>')}</p>`)
    }

    return saida.join('\n')
  }

  return { renderizar }
})()