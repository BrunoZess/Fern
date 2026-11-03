// Ícones de traço simples (SVG inline) que herdam a cor do texto.
const Icones = (() => {
  const PONTOS = [[9, 6], [15, 6], [9, 12], [15, 12], [9, 18], [15, 18]]
  const TRACOS = {
    mais: '<path d="M12 5v14M5 12h14"/>',
    pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    nota: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    tarefa: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
    feita: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    quadro:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    grafo:
      '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.4 6.4l7.2 1.2M7 8.3l4 7.4M17 10.3l-4 5.4"/>',
    seta: '<path d="M9 6l6 6-6 6"/>',
    lapis: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    elo: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    postit: '<path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6"/>',
    ajustar: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    organizar: '<path d="M4 7h10M4 12h16M4 17h10"/>',
    busca: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
    calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    grip: PONTOS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="currentColor" stroke="none"/>`).join(''),
  }

  function criar(nome, tamanho = 16) {
    const span = document.createElement('span')
    span.className = 'icone'
    span.innerHTML =
      `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TRACOS[nome] || ''}</svg>`
    return span
  }

  // Coloca o ícone indicado em data-icone dentro de cada botão do HTML
  function aplicarNosBotoes() {
    for (const el of document.querySelectorAll('[data-icone]')) {
      el.prepend(criar(el.dataset.icone))
    }
  }

  return { criar, aplicarNosBotoes }
})()