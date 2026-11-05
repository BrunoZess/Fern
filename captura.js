const texto = document.getElementById('texto')
const tipo = document.getElementById('tipo')

function prepararNovaCaptura() {
  texto.value = ''
  texto.focus()
}

async function salvar() {
  let conteudo = texto.value.trim()
  if (!conteudo) return
  if (tipo.value === 'lista') {
    const [titulo, ...itens] = conteudo.split('\n').map((l) => l.trim()).filter(Boolean)
    const linhas = itens.map((l) => (/^[-*+]\s\[[ xX]\]/.test(l) ? l : `- [ ] ${l.replace(/^[-*+]\s+/, '')}`))
    conteudo = [titulo, ...linhas].join('\n')
  }
  await window.api.criarNota(conteudo, tipo.value, null, null)
  texto.value = ''
  await window.api.fecharCaptura()
}

texto.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    salvar()
  } else if (e.key === 'Escape') {
    window.api.fecharCaptura()
  }
})

window.api.aoAbrirCaptura(prepararNovaCaptura)