# Panetones do Rogerio

- Loja: https://bragarafaellr.github.io/panetones/
- Painel: https://bragarafaellr.github.io/panetones/admin.html

Site estático (GitHub Pages) + Google Sheets/Apps Script como banco.

## Setup

1. Criar a planilha Google "Panetones 2026" com uma aba chamada `Pedidos` e, na linha 1, o cabeçalho:
   `id | criadoEm | nome | whatsapp | itens | total | obs | status | atualizadoEm`
2. Na planilha: Extensões → Apps Script → apagar o conteúdo e colar `apps-script/Code.gs`. Salvar.
3. Configurações do projeto (engrenagem) → Propriedades do script → adicionar `ADMIN_TOKEN` = senha do painel. **Nunca** colocar essa senha no repositório.
4. Implantar → Nova implantação → tipo **App da Web** → Executar como: **eu** → Quem pode acessar: **Qualquer pessoa** → Implantar → autorizar → copiar a URL (`https://script.google.com/macros/s/.../exec`).
5. Em `config.js`, preencher `apiUrl` com essa URL, e `pix.chave` (chave aleatória), `pix.nome` (≤25 letras, sem acento) e `pix.cidade` (≤15 letras, sem acento). Commit e push na `main`.
6. GitHub → Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save.

Ao alterar `Code.gs` depois: Implantar → Gerenciar implantações → editar → Nova versão (a URL continua a mesma).

Preços ficam em `config.js` **e** em `apps-script/Code.gs` — mudar nos dois.

Enquanto `pix.chave` for `TODO_CHAVE_PIX`, a tela de pagamento mostra "QR code PIX em breve" (os pedidos são gravados normalmente).
