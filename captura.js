const texto = document.getElementById('texto')
const tipo = document.getElementById('tipo')

function prepararNovaCaptura() {
  texto.value = ''
  texto.focus()
}

async function salvar() {
  const conteudo = texto.value.trim()
  if (!conteudo) return
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