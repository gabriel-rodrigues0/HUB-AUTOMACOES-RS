/*
 * pdf-fill.mjs — nucleo de preenchimento dos PDFs (carimbo sobre o modelo oficial).
 * Modulo ISOMORFICO: recebe a lib pdf-lib por parametro, entao roda igual no
 * navegador (vendor/pdf-lib.esm.min.js) e no Node (teste de calibragem).
 * NUNCA redesenha o documento: usa o PDF-base oficial como fundo.
 */
const BLACK = (lib) => lib.rgb(0, 0, 0);
const WHITE = (lib) => lib.rgb(1, 1, 1);

async function fonts(lib, doc) {
  return {
    times: await doc.embedFont(lib.StandardFonts.TimesRoman),
    helv: await doc.embedFont(lib.StandardFonts.Helvetica),
    helvB: await doc.embedFont(lib.StandardFonts.HelveticaBold),
  };
}

// quebra texto em linhas que cabem em maxWidth
function wrap(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const wd of words) {
    const t = cur ? cur + ' ' + wd : wd;
    if (font.widthOfTextAtSize(t, size) > maxWidth && cur) { lines.push(cur); cur = wd; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawValue(lib, page, fnts, cfg, text) {
  if (text == null || text === '') return;
  const font = fnts[cfg.font || 'helv'];
  const size = cfg.size || 11;
  if (cfg.whiteout) {
    const w = cfg.whiteout;
    page.drawRectangle({ x: w.x, y: w.y, width: w.w, height: w.h, color: WHITE(lib) });
  }
  const full = (cfg.prefix || '') + text;
  // multilinha (endereco do posto)
  if (cfg.maxWidth) {
    const lines = wrap(full, font, size, cfg.maxWidth);
    const lh = cfg.lineHeight || size + 4;
    lines.forEach((ln, i) => page.drawText(ln, { x: cfg.x, y: cfg.y - i * lh, size, font, color: BLACK(lib) }));
    return;
  }
  let x = cfg.x;
  const tw = font.widthOfTextAtSize(full, size);
  if (cfg.align === 'center') x = cfg.x - tw / 2;
  page.drawText(full, { x, y: cfg.y, size, font, color: BLACK(lib) });
  if (cfg.underline) {
    page.drawLine({ start: { x, y: cfg.y - 2 }, end: { x: x + tw, y: cfg.y - 2 }, thickness: 1, color: BLACK(lib) });
  }
}

// ---------------- CARTA BANCARIA ----------------
const CARTA_FIELDS = ['NOME', 'CARGO', 'SALARIO', 'ENDERECO', 'CEP', 'RG', 'CPF', 'DATA'];
export async function fillCarta(lib, baseBytes, coords, data) {
  const doc = await lib.PDFDocument.load(baseBytes);
  const fnts = await fonts(lib, doc);
  const page = doc.getPages()[coords.page || 0];
  for (const f of CARTA_FIELDS) {
    const cfg = coords.fields[f];
    if (cfg && data[f] != null && data[f] !== '') {
      page.drawText(String(data[f]), { x: cfg.x, y: cfg.y, size: cfg.size || 11, font: fnts.times, color: BLACK(lib) });
    }
  }
  return doc.save();
}

// ---------------- GUIA ONCARE ----------------
const ONCARE_FIELDS = ['EMPRESA', 'LOCAL', 'DATA_EXAME', 'UNIDADE', 'SETOR', 'CARGO', 'NOME', 'RG', 'CPF', 'TEL', 'NASCIMENTO'];
export async function fillOncare(lib, baseBytes, coords, data) {
  const doc = await lib.PDFDocument.load(baseBytes);
  const fnts = await fonts(lib, doc);
  const page = doc.getPages()[coords.page || 0];
  for (const f of ONCARE_FIELDS) {
    const cfg = coords.fields[f];
    if (cfg && data[f] != null && data[f] !== '') {
      page.drawText(String(data[f]), { x: cfg.x, y: cfg.y, size: cfg.size || 10, font: fnts.helv, color: BLACK(lib) });
    }
  }
  return doc.save();
}

// ---------------- PASSAPORTE (white-out + carimbo) ----------------
export async function fillPassaporte(lib, baseBytes, coords, data) {
  const doc = await lib.PDFDocument.load(baseBytes);
  const fnts = await fonts(lib, doc);
  const page = doc.getPages()[0];
  const A = coords.always;
  drawValue(lib, page, fnts, A.DATA_INICIO, data.dataInicio);
  drawValue(lib, page, fnts, A.NOME, data.nome);
  drawValue(lib, page, fnts, A.ESCALA, data.escala);
  drawValue(lib, page, fnts, A.HORARIO, data.horarioTrabalho);
  if (data.tipo === 'POSTO') {
    const P = coords.posto;
    drawValue(lib, page, fnts, P.TIPO, 'POSTO');
    drawValue(lib, page, fnts, P.HORA_APRES, data.horarioApresentacao);
    drawValue(lib, page, fnts, P.ENDERECO, data.endereco);
  }
  return doc.save();
}
