const Tinta = (() => {
  const ESTILOS = {
    caneta: { fator: 1, opacidade: 1, ponta: 'round' },
    lapis: { fator: 0.6, opacidade: 0.85, ponta: 'round' },
    marcatexto: { fator: 4, opacidade: 0.35, ponta: 'butt' },
  }
  const CORES = ['#111827', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
  const estado = { cor: '#3b82f6', tamanho: 3 }

  const espessura = (ferramenta) => estado.tamanho * (ESTILOS[ferramenta] || ESTILOS.caneta).fator

  function aplicarEstilo(el, ferramenta, cor, largura) {
    const e = ESTILOS[ferramenta] || ESTILOS.caneta
    el.setAttribute('fill', 'none')
    el.setAttribute('stroke', cor)
    el.setAttribute('stroke-width', String(largura))
    el.setAttribute('stroke-opacity', String(e.opacidade))
    el.setAttribute('stroke-linecap', e.ponta)
    el.setAttribute('stroke-linejoin', 'round')
  }

  function caminhoSuave(p) {
    if (p.length < 4) return `M${p[0]} ${p[1]} L${p[0]} ${p[1]}`
    let d = `M${p[0]} ${p[1]}`
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2
      const my = (p[i + 1] + p[i + 3]) / 2
      d += ` Q${p[i]} ${p[i + 1]} ${mx} ${my}`
    }
    return d + ` L${p[p.length - 2]} ${p[p.length - 1]}`
  }

  function distanciaAoSegmento(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1
    const dy = y2 - y1
    const comprimento = dx * dx + dy * dy
    let t = comprimento === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / comprimento
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
  }

  function tocado(pontos, largura, x, y, raio) {
    const r = raio + largura / 2
    for (let i = 0; i + 1 < pontos.length; i += 2) {
      const x2 = i + 3 < pontos.length ? pontos[i + 2] : pontos[i]
      const y2 = i + 3 < pontos.length ? pontos[i + 3] : pontos[i + 1]
      if (distanciaAoSegmento(x, y, pontos[i], pontos[i + 1], x2, y2) <= r) return true
    }
    return false
  }

  const arredondar = (pontos) => pontos.map((v) => Math.round(v * 1000) / 1000)

  function montarPainel(painel, aoEscolher) {
    const caixa = painel.querySelector('.cores-tinta')
    const marcarCores = () => {
      for (const b of caixa.children) b.classList.toggle('ativo', b.dataset.hex === estado.cor)
    }
    for (const hex of CORES) {
      const botao = document.createElement('button')
      botao.style.background = hex
      botao.dataset.hex = hex
      botao.title = hex
      botao.addEventListener('click', () => {
        estado.cor = hex
        marcarCores()
      })
      caixa.appendChild(botao)
    }
    marcarCores()

    const botoes = [...painel.querySelectorAll('[data-ferramenta]')]
    for (const b of botoes) b.addEventListener('click', () => aoEscolher(b.dataset.ferramenta))

    const slider = painel.querySelector('input[type="range"]')
    slider.value = String(estado.tamanho)
    slider.addEventListener('input', () => {
      estado.tamanho = Number(slider.value)
    })

    return {
      marcar(ferramenta) {
        for (const b of botoes) b.classList.toggle('ativo', b.dataset.ferramenta === ferramenta)
        slider.value = String(estado.tamanho)
        marcarCores()
      },
    }
  }

  return { ESTILOS, CORES, estado, espessura, aplicarEstilo, caminhoSuave, tocado, arredondar, montarPainel }
})()