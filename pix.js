// BR Code PIX estático (EMV). Ver manual do BACEN.
function gerarPix({ chave, nome, cidade, valor, txid }) {
  const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const limpo = (s, n) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, n);
  const corpo =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave)) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor != null ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpo(nome, 25)) +
    campo('60', limpo(cidade, 15)) +
    campo('62', campo('05', txid)) +
    '6304';
  return corpo + crc16(corpo);
}

// CRC16-CCITT-FALSE: poly 0x1021, init 0xFFFF
function crc16(s) {
  let crc = 0xFFFF;
  for (const b of new TextEncoder().encode(s)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

if (typeof module !== 'undefined') module.exports = { gerarPix, crc16 };
