// Preços devem bater com config.js
const PRECOS = {
  'frutas': { '500g': 95, '250g': 57 },
  'chocolate': { '500g': 115, '250g': 69 },
  'presunto-queijo': { '500g': 115, '250g': 69 },
  'goiabada-requeijao': { '500g': 95, '250g': 57 }
};
const DATA_LIMITE = new Date('2026-12-19T23:59:59-03:00');
// Colunas: A id | B criadoEm | C nome | D whatsapp | E itens | F total | G obs | H status | I atualizadoEm | J prontos | K pago

function doPost(e) {
  let r;
  try { r = tratar(JSON.parse(e.postData.contents)); }
  catch (err) { r = { erro: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

// Diagnóstico: abrir a URL no navegador mostra a versão e os sabores que esta implantação conhece
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ versao: 2, sabores: Object.keys(PRECOS) })).setMimeType(ContentService.MimeType.JSON);
}

function tratar(d) {
  if (d.acao === 'criar') return comLock(() => criar(d));
  const token = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!token || d.token !== token) return { erro: 'Não autorizado' };
  if (d.acao === 'listar') return { pedidos: lerPedidos() };
  if (d.acao === 'fornada') return comLock(() => fornada(d));
  if (d.acao === 'status') return comLock(() => mudarStatus(d));
  if (d.acao === 'pago') return comLock(() => mudarPago(d));
  if (d.acao === 'desfazer') return comLock(() => desfazer(d));
  return { erro: 'Ação inválida' };
}

function comLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
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
    if (!preco || !Number.isInteger(qtd) || qtd < 0) return { erro: 'Item inválido: ' + i.id + ' ' + i.tamanho };
    if (qtd > 0) { itens.push({ id: i.id, tamanho: i.tamanho, qtd: qtd }); total += preco * qtd; }
  }
  if (total <= 0) return { erro: 'Pedido vazio' };

  const sh = aba();
  const ultimo = sh.getLastRow() > 1 ? Number(String(sh.getRange(sh.getLastRow(), 1).getValue()).slice(3)) : 0;
  const id = 'PAN' + String(ultimo + 1).padStart(4, '0');
  const agora = new Date();
  sh.appendRow([id, agora, nome, whatsapp, JSON.stringify(itens), total, texto(d.obs).slice(0, 500), 'Na fila', agora, '{}', 'Não']);
  return { id: id, total: total };
}

// Etapa: Cancelado/Enviado são marcados à mão; o resto sai do que já está pronto
function etapa(status, itens, prontos) {
  if (status === 'Cancelado') return 'Cancelado';
  if (status === 'Enviado' || status === 'Entregue') return 'Enviado';
  const pedidos = itens.reduce((s, i) => s + i.qtd, 0);
  const feitos = itens.reduce((s, i) => s + Math.min(i.qtd, prontos[i.id + '|' + i.tamanho] || 0), 0);
  return feitos === 0 ? 'Na fila' : feitos < pedidos ? 'Fazendo' : 'Pronto pra entrega';
}

function lerPedidos() {
  return aba().getDataRange().getValues().slice(1).map((r, n) => {
    const itens = JSON.parse(r[4] || '[]');
    const prontos = JSON.parse(r[9] || '{}');
    // Pedidos de antes da coluna "pago" usavam o status para isso
    const pago = r[10] ? r[10] === 'Sim' : (r[7] === 'Pago' || r[7] === 'Entregue');
    return {
      linha: n + 2, id: r[0], criadoEm: r[1], nome: r[2], whatsapp: String(r[3]), itens: itens,
      total: r[5], obs: r[6], etapa: etapa(r[7], itens, prontos), atualizadoEm: r[8], prontos: prontos, pago: pago
    };
  });
}

function acharPedido(id) {
  const p = lerPedidos().find(p => p.id === id);
  if (!p) throw new Error('Pedido não encontrado');
  return p;
}

function gravar(p, status) {
  aba().getRange(p.linha, 8, 1, 3).setValues([[status, new Date(), JSON.stringify(p.prontos)]]);
}

// Distribui o que saiu da fornada entre os pedidos mais antigos que ainda precisam desse item
function fornada(d) {
  const qtd = Number(d.qtd);
  if (!(PRECOS[d.id] && PRECOS[d.id][d.tamanho]) || !Number.isInteger(qtd) || qtd < 1) return { erro: 'Fornada inválida' };
  const chave = d.id + '|' + d.tamanho;
  let resta = qtd;
  const destinos = [];
  for (const p of lerPedidos()) {
    if (!resta) break;
    if (p.etapa === 'Cancelado' || p.etapa === 'Enviado') continue;
    const pedido = p.itens.filter(i => i.id === d.id && i.tamanho === d.tamanho).reduce((s, i) => s + i.qtd, 0);
    const falta = pedido - (p.prontos[chave] || 0);
    if (falta <= 0) continue;
    const vai = Math.min(falta, resta);
    p.prontos[chave] = (p.prontos[chave] || 0) + vai;
    resta -= vai;
    gravar(p, etapa('', p.itens, p.prontos));
    destinos.push({ id: p.id, nome: p.nome, qtd: vai });
  }
  return { destinos: destinos, sobra: resta };
}

function mudarStatus(d) {
  if (['Enviado', 'Cancelado', 'Na fila'].indexOf(d.status) < 0) return { erro: 'Status inválido' };
  const p = acharPedido(d.id);
  gravar(p, d.status === 'Na fila' ? etapa('', p.itens, p.prontos) : d.status);
  return { ok: true };
}

function mudarPago(d) {
  const p = acharPedido(d.id);
  aba().getRange(p.linha, 11).setValue(d.pago ? 'Sim' : 'Não');
  aba().getRange(p.linha, 9).setValue(new Date());
  return { ok: true };
}

function desfazer(d) {
  const p = acharPedido(d.id);
  p.prontos = {};
  gravar(p, p.etapa === 'Cancelado' || p.etapa === 'Enviado' ? p.etapa : 'Na fila');
  return { ok: true };
}
