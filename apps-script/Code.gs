// Preços devem bater com config.js
const PRECOS = {
  'frutas': { '500g': 95, '250g': 57 },
  'chocolate': { '500g': 115, '250g': 69 },
  'presunto-queijo': { '500g': 115, '250g': 69 }
};
const DATA_LIMITE = new Date('2026-12-19T23:59:59-03:00');
const STATUS = ['Aguardando pagamento', 'Pago', 'Entregue', 'Cancelado'];

function doPost(e) {
  let r;
  try { r = tratar(JSON.parse(e.postData.contents)); }
  catch (err) { r = { erro: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function tratar(d) {
  if (d.acao === 'criar') return criar(d);
  const token = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!token || d.token !== token) return { erro: 'Não autorizado' };
  if (d.acao === 'listar') return listar();
  if (d.acao === 'status') return mudarStatus(d);
  return { erro: 'Ação inválida' };
}

function aba() { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pedidos'); }

// Impede que texto do comprador vire fórmula na planilha
function texto(s) { s = String(s || '').trim(); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function criar(d) {
  if (new Date() > DATA_LIMITE) return { erro: 'Pedidos encerrados' };
  const nome = texto(d.nome).slice(0, 100);
  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '');
  if (!nome || whatsapp.length < 10 || whatsapp.length > 11) return { erro: 'Informe nome e WhatsApp válidos' };
  if (!Array.isArray(d.itens)) return { erro: 'Itens inválidos' };
  const itens = [];
  let total = 0;
  for (const i of d.itens) {
    const preco = PRECOS[i.id] && PRECOS[i.id][i.tamanho];
    const qtd = Number(i.qtd);
    if (!preco || !Number.isInteger(qtd) || qtd < 0) return { erro: 'Item inválido' };
    if (qtd > 0) { itens.push({ id: i.id, tamanho: i.tamanho, qtd: qtd }); total += preco * qtd; }
  }
  if (total <= 0) return { erro: 'Pedido vazio' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = aba();
    const ultimo = sh.getLastRow() > 1 ? Number(String(sh.getRange(sh.getLastRow(), 1).getValue()).slice(3)) : 0;
    const id = 'PAN' + String(ultimo + 1).padStart(4, '0');
    const agora = new Date();
    sh.appendRow([id, agora, nome, whatsapp, JSON.stringify(itens), total, texto(d.obs).slice(0, 500), STATUS[0], agora]);
    return { id: id, total: total };
  } finally {
    lock.releaseLock();
  }
}

function listar() {
  const linhas = aba().getDataRange().getValues().slice(1);
  return {
    pedidos: linhas.map(r => ({
      id: r[0], criadoEm: r[1], nome: r[2], whatsapp: String(r[3]), itens: JSON.parse(r[4] || '[]'),
      total: r[5], obs: r[6], status: r[7], atualizadoEm: r[8]
    }))
  };
}

function mudarStatus(d) {
  if (STATUS.indexOf(d.status) < 0) return { erro: 'Status inválido' };
  const sh = aba();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  const i = ids.findIndex(r => r[0] === d.id);
  if (i < 1) return { erro: 'Pedido não encontrado' };
  sh.getRange(i + 1, 8, 1, 2).setValues([[d.status, new Date()]]);
  return { ok: true };
}
