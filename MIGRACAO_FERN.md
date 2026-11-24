# Fern — atualização de identidade

Esta atualização muda o nome do aplicativo, o identificador do Windows, o banco e o instalador para **Fern**.

## Como aplicar

1. Feche completamente o Fern, inclusive o ícone na bandeja do Windows.
2. Substitua os arquivos contidos no ZIP na pasta do projeto; mantenha os nomes.
3. Execute `npm install` (apenas se necessário) e `npm start`.
4. Para construir o instalador com ícone correto: `npm run dist`.

## Dados existentes

Na primeira abertura, o Fern copia dados antigos de `%APPDATA%\segundo-cerebro` para `%APPDATA%\Fern` e converte o nome do banco local para `fern.db`. A pasta antiga fica preservada como backup e backups ZIP antigos ainda podem ser restaurados. Não apague nenhuma pasta de dados até confirmar que todas as notas, quadros e anexos aparecem.

## Ícone na barra de tarefas

O ícone `.ico` entra no instalador do Windows. Durante `npm start`, o Windows pode continuar mostrando o ícone do processo Electron em alguns contextos; para ver o ícone do Fern de forma consistente, gere e instale o executável de distribuição com `npm run dist`. Se um atalho antigo estiver fixado na barra de tarefas, desafixe e fixe o novo executável.

## GitHub

O repositório já se chama `Fern`. Os arquivos de projeto mudaram, mas **descrição, About e Releases publicadas anteriormente precisam ser editados no GitHub**. Abra a página do repositório e altere o texto no campo About (ícone de engrenagem), além de editar releases antigas se desejar eliminar toda a referência pública. Isso não é alterado pelo ZIP.
