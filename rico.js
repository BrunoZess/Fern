const Rico = (() => {
  let katex = null
  let mermaid = null
  let temaMermaid = null
  let contador = 0

  function escuro() {
    const tema = document.documentElement.dataset.tema
    if (tema) return tema === 'escuro'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  async function carregarKatex() {
    if (katex) return katex
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'node_modules/katex/dist/katex.min.css'
    document.head.appendChild(link)
    katex = (await import('./node_modules/katex/dist/katex.mjs')).default
    return katex
  }

  async function carregarMermaid() {
    if (!mermaid) mermaid = (await import('./node_modules/mermaid/dist/mermaid.esm.min.mjs')).default
    const tema = escuro() ? 'dark' : 'default'
    if (tema !== temaMermaid) {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: tema, fontFamily: 'inherit' })
      temaMermaid = tema
    }
    return mermaid
  }

  function mostrarErro(el, titulo, erro) {
    el.classList.add('rico-erro')
    el.textContent = `${titulo}: ${String((erro && erro.message) || erro).split('\n')[0]}`
  }

  async function processar(raiz) {
    const formulas = raiz.querySelectorAll('[data-tex]')
    if (formulas.length) {
      try {
        const k = await carregarKatex()
        for (const el of formulas) {
          try {
            k.render(el.dataset.tex, el, { displayMode: el.classList.contains('math-bloco'), throwOnError: true })
          } catch (erro) {
            mostrarErro(el, 'Erro na fórmula', erro)
          }
        }
      } catch (erro) {
        console.warn('KaTeX não carregou:', erro)
      }
    }

    const diagramas = raiz.querySelectorAll('.mermaid-bloco')
    if (diagramas.length) {
      let m
      try {
        m = await carregarMermaid()
      } catch (erro) {
        console.warn('Mermaid não carregou:', erro)
        return
      }
      for (const el of diagramas) {
        if (!el.isConnected) continue
        const id = `mermaid-${++contador}`
        try {
          const { svg } = await m.render(id, el.dataset.fonte)
          el.innerHTML = svg
        } catch (erro) {
          mostrarErro(el, 'Erro no diagrama', erro)
        } finally {
          document.getElementById(`d${id}`)?.remove()
        }
      }
    }
  }

  return { processar }
})()
