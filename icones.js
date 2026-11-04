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
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5"/><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/>',
    engrenagem: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    painel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    texto: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 14h8M8 17h5"/>',
    imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
    arquivo: '<path d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.2-8.2"/>',
    externo: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
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