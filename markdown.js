const Markdown = (() => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  function normalizarUrl(bruta) {
    const limpa = bruta.replace(/[.,;:!?]+$/, '')
    return /^www\./i.test(limpa) ? `https://${limpa}` : limpa
  }

  function inline(texto) {
    const guardados = []
    const guardar = (html) => `\u0000${guardados.push(html) - 1}\u0000`

    let t = texto
      .replace(/`([^`\n]+)`/g, (_m, c) => guardar(`<code>${esc(c)}</code>`))
      .replace(/(^|[^\\$\w])\$(?=\S)([^$\n]+?)(?<=\S)\$(?![\w$])/g, (_m, antes, tex) =>
        antes + guardar(`<span class="math" data-tex="${esc(tex)}">${esc(tex)}</span>`)
      )
      .replace(/\[\[([^\[\]\n]+)\]\]/g, (_m, nome) => {
        const [alvo, apelido] = nome.split('|')
        return guardar(`<a class="wikilink" data-link="${esc(alvo.trim())}">${esc((apelido || alvo).trim())}</a>`)
      })
      .replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:|www\.)[^\s)]+)\)/gi, (_m, rotulo, url) =>
        guardar(`<a class="externo" data-url="${esc(normalizarUrl(url))}">${esc(rotulo)}</a>`)
      )
      .replace(/(?:https?:\/\/|www\.)[^\s<>"'\])]+/gi, (url) => {
        const limpa = url.replace(/[.,;:!?]+$/, '')
        const sobra = url.slice(limpa.length)
        return guardar(`<a class="externo" data-url="${esc(normalizarUrl(limpa))}">${esc(limpa)}</a>`) + sobra
      })

    t = esc(t)
      .replace(/\*\*(?=\S)([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(?=\S)([^_]+?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?=\S)([^*]+?)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^\w])_(?=\S)([^_]+?)_(?!\w)/g, '$1<em>$2</em>')
      .replace(/~~(?=\S)(.+?)~~/g, '<del>$1</del>')
      .replace(/==(?=\S)(.+?)==/g, '<mark>$1</mark>')
      .replace(/(^|\s)(#[\p{L}\p{N}_-]+)/gu, '$1<span class="tag" data-tag="$2">$2</span>')

    return t.replace(/\u0000(\d+)\u0000/g, (_m, i) => guardados[Number(i)])
  }

  const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
  const RE_CHECK = /^\[([ xX])\]\s?(.*)$/

  function renderizar(texto, offset = 0) {
    const linhas = texto.split('\n')
    const html = []
    let i = 0

    const ehTabela = (k) =>
      /\|/.test(linhas[k] || '') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(linhas[k + 1] || '')
    const celulas = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()))

    while (i < linhas.length) {
      const linha = linhas[i]

      const cerca = /^\s*```\s*([\w-]*)/.exec(linha)
      if (cerca) {
        const bloco = []
        i++
        while (i < linhas.length && !/^\s*```/.test(linhas[i])) bloco.push(linhas[i++])
        i++
        const fonte = bloco.join('\n')
        const lingua = cerca[1].toLowerCase()
        if (lingua === 'mermaid') {
          html.push(`<div class="mermaid-bloco" data-fonte="${esc(fonte)}"><pre><code>${esc(fonte)}</code></pre></div>`)
        } else if (lingua === 'math') {
          html.push(`<div class="math-bloco" data-tex="${esc(fonte)}">${esc(fonte)}</div>`)
        } else {
          html.push(`<pre><code>${esc(fonte)}</code></pre>`)
        }
        continue
      }
      if (/^\s*\$\$/.test(linha)) {
        const umaLinha = /^\s*\$\$(.+?)\$\$\s*$/.exec(linha)
        let tex
        if (umaLinha) {
          tex = umaLinha[1]
          i++
        } else {
          const bloco = [linha.replace(/^\s*\$\$/, '')]
          i++
          while (i < linhas.length && !/\$\$\s*$/.test(linhas[i])) bloco.push(linhas[i++])
          if (i < linhas.length) bloco.push(linhas[i++].replace(/\$\$\s*$/, ''))
          tex = bloco.join('\n')
        }
        html.push(`<div class="math-bloco" data-tex="${esc(tex.trim())}">${esc(tex.trim())}</div>`)
        continue
      }
      if (!linha.trim()) {
        i++
        continue
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(linha)
      if (h) {
        html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
        i++
        continue
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linha)) {
        html.push('<hr>')
        i++
        continue
      }
      if (/^\s*>/.test(linha)) {
        const bloco = []
        while (i < linhas.length && /^\s*>/.test(linhas[i])) bloco.push(linhas[i++].replace(/^\s*>\s?/, ''))
        html.push(`<blockquote>${bloco.map(inline).join('<br>')}</blockquote>`)
        continue
      }
      if (ehTabela(i)) {
        const cab = celulas(linhas[i])
        i += 2
        const corpo = []
        while (i < linhas.length && /\|/.test(linhas[i]) && linhas[i].trim()) corpo.push(celulas(linhas[i++]))
        html.push(
          `<table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
            corpo.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
            '</tbody></table>'
        )
        continue
      }
      if (RE_ITEM.test(linha)) {
        const pilha = []
        while (i < linhas.length && RE_ITEM.test(linhas[i])) {
          const [, recuo, marcador, conteudo] = RE_ITEM.exec(linhas[i])
          const nivel = Math.floor(recuo.replace(/\t/g, '  ').length / 2)
          const tag = /\d/.test(marcador) ? 'ol' : 'ul'
          while (pilha.length > nivel + 1 || (pilha.length === nivel + 1 && pilha[pilha.length - 1] !== tag)) {
            html.push(`</li></${pilha.pop()}>`)
          }
          if (pilha.length === nivel + 1) html.push('</li>')
          while (pilha.length < nivel + 1) {
            const inicio = tag === 'ol' && pilha.length === nivel ? ` start="${parseInt(marcador, 10)}"` : ''
            html.push(`<${tag}${inicio}>`)
            pilha.push(tag)
          }
          const c = RE_CHECK.exec(conteudo)
          if (c) {
            const feito = c[1] !== ' '
            html.push(
              `<li class="tarefa${feito ? ' feito' : ''}"><input type="checkbox" data-linha="${offset + i}"${feito ? ' checked' : ''}> ${inline(c[2])}`
            )
          } else {
            html.push(`<li>${inline(conteudo)}`)
          }
          i++
        }
        while (pilha.length) html.push(`</li></${pilha.pop()}>`)
        continue
      }
      const paragrafo = []
      while (
        i < linhas.length &&
        linhas[i].trim() &&
        !/^(#{1,6}\s|\s*```|\s*>|\s*\$\$)/.test(linhas[i]) &&
        !RE_ITEM.test(linhas[i]) &&
        !ehTabela(i)
      ) {
        paragrafo.push(inline(linhas[i++]))
      }
      html.push(`<p>${paragrafo.join('<br>')}</p>`)
    }
    return html.join('')
  }

  return { renderizar, inline }
})()

if (typeof module !== 'undefined') module.exports = Markdown
