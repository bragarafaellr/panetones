const CONFIG = {
  // Preços devem bater com apps-script/Code.gs (o servidor recalcula o total)
  produtos: [
    { id: 'frutas', nome: 'Frutas', precos: { '500g': 95, '250g': 57 } },
    { id: 'chocolate', nome: 'Chocolate', precos: { '500g': 115, '250g': 69 } },
    { id: 'presunto-queijo', nome: 'Presunto e queijo', precos: { '500g': 115, '250g': 69 } }
  ],
  pix: {
    chave: 'd253657f-5c6a-4140-a336-0b42dc2f9b10', // chave aleatória
    nome: 'COLOCAR_NOME_TITULAR',   // máx. 25 chars, sem acento
    cidade: 'COLOCAR_CIDADE'        // máx. 15 chars, sem acento
  },
  apiUrl: 'COLOCAR_URL_DO_WEB_APP',
  dataLimite: '2026-12-19T23:59:59-03:00',
  whatsappComprovante: '5511971672448'
};
