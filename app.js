// app.js - Hub de Automacoes R&S (Pro Security). 100% navegador.
// Usa o mesmo nucleo isomorfico pdf-fill.mjs validado no build.
import { fillCarta, fillOncare, fillPassaporte } from './pdf-fill.mjs';

let PDFLib;
try {
  PDFLib = await import('./vendor/pdf-lib.esm.min.js');
} catch {
  PDFLib = await import('./pdf-lib.esm.min.js');
}

// ---- CONFIG ----
const SENHA = 'prosecurity';           // senha interna (troque aqui; proteja com Cloudflare Access em producao)
const EMPRESAS = {
  'PRO CLEAN':     { base: 'base_clean.pdf',     coords: 'clean',     razao: 'PRO CLEAN HIGIENIZACAO E LIMPEZA LTDA',       cnpj: '16.626.344/0001-40', cargoPadrao: 'AUXILIAR DE LIMPEZA', icon: '\u{1F9F9}' },
  'PRO SERVICOS':  { base: 'base_porteiro.pdf',  coords: 'porteiro',  razao: 'PRO SECURITY SERVICOS ESPECIALIZADOS LTDA',   cnpj: '56.566.292/0001-89', cargoPadrao: 'PORTEIRO',           icon: '\u{1F3E2}' },
  'PRO SEGURANCA': { base: 'base_vigilante.pdf', coords: 'vigilante', razao: 'PRO SECURITY SEGURANCA PATRIMONIAL LTDA',     cnpj: '96.231.568/0001-92', cargoPadrao: 'VIGILANTE',          icon: '\u{1F6E1}\uFE0F' },
};
const DEFAULT_CARGOS = {
  'PRO CLEAN': [
    { cargo: 'AUXILIAR DE LIMPEZA', salario: 'R$ 1.837,40' },
    { cargo: 'AUXILIAR DE SERVIÇOS GERAIS', salario: 'R$ 1.890,24' },
    { cargo: 'AUXILIAR DE MANUTENCAO', salario: 'R$ 2.750,00' },
  ],
  'PRO SERVICOS': [
    { cargo: 'PORTEIRO', salario: 'R$ 2.031,57' },
    { cargo: 'RECEPCIONISTA', salario: 'R$ 2.031,57' },
    { cargo: 'AUXILIAR ADMINISTRATIVO', salario: 'R$ 2.447,37' },
  ],
  'PRO SEGURANCA': [
    { cargo: 'VIGILANTE', salario: 'R$ 2.271,74' },
    { cargo: 'VSPP', salario: 'R$ 3.848,75' },
  ],
};
const BASE_ENDERECO = 'RUA IBIRAPORA, 100 - JARDIM LONDRINA';
const TIPO_EXAMES = {
  admissional: { label: 'Admissional', icon: 'AD' },
  complementar: { label: 'Complementar', icon: 'CP' },
};
const PASSAPORTE_HORARIOS = [
  '12X36 - 06:00 ÀS 18:00',
  '12X36 - 07:00 ÀS 19:00',
  '12X36 - 08:00 ÀS 16:20',
  '12X36 - 08:00 ÀS 17:00',
  '12X36 - 08:00 ÀS 20:00',
  '12X36 - 09:00 ÀS 21:00',
  '12X36 - 10:00 ÀS 19:00',
  '12X36 - 10:00 ÀS 22:00',
  '12X36 - 11:00 ÀS 23:00',
  '12X36 - 18:00 ÀS 06:00',
  '12X36 - 19:00 ÀS 07:00',
  '12X36 - FOLGUISTA',
  '4X2 - 06:00 ÀS 18:00',
  '4X2 - 09:00 ÀS 20:00',
  '4X2 - 14:00 ÀS 22:00',
  '4X2 - 18:00 ÀS 06:00',
  '4X2 - FOLGUISTA',
  '5X1 - 06:00 ÀS 14:00',
  '5X1 - 06:00 ÀS 18:00',
  '5X1 - 14:00 ÀS 22:00',
  '5X1 - 18:00 ÀS 06:00',
  '5X1 - 19:00 ÀS 05:00',
  '5X1 - 22:00 ÀS 07:00',
  '5X1 - FOLGUISTA',
  '5X2 - 08:00 ÀS 17:00',
  '5X2 - FOLGUISTA',
  '6X1 - 06:00 ÀS 14:20',
  '6X1 - 06:00 ÀS 15:00',
  '6X1 - 07:00 ÀS 15:20',
  '6X1 - 07:00 ÀS 15:36',
  '6X1 - 07:00 ÀS 16:00',
  '6X1 - 07:00 ÀS 17:00',
  '6X1 - 08:00 ÀS 10:20',
  '6X1 - 08:00 ÀS 16:00',
  '6X1 - 08:00 ÀS 16:20',
  '6X1 - 08:00 ÀS 17:00',
  '6X1 - 08:00 ÀS 17:20',
  '6X1 - 08:00 ÀS 18:00',
  '6X1 - 08:20 ÀS 16:40',
  '6X1 - 09:00 ÀS 17:20',
  '6X1 - 09:00 ÀS 18:00',
  '6X1 - 09:40 ÀS 18:00',
  '6X1 - 10:00 ÀS 18:20',
  '6X1 - 10:00 ÀS 19:00',
  '6X1 - 10:40 ÀS 19:00',
  '6X1 - 11:00 ÀS 20:00',
  '6X1 - 11:40 ÀS 20:00',
  '6X1 - 12:00 ÀS 18:00',
  '6X1 - 12:40 ÀS 21:00',
  '6X1 - 14:00 ÀS 22:00',
  '6X1 - FOLGUISTA',
];
const PASSAPORTE_ESCALAS = [...new Set(PASSAPORTE_HORARIOS.map((item) => item.split(' - ')[0]))];

// ---- ESTADO ----
let CARTAS = {}, ONCARE = {}, PASSAPORTE = {};
let cartaEmpresa = null, oncareEmpresa = null, passTipo = 'BASE', tipoExame = 'admissional', horariosAbertos = false;
const customSelectState = {};

// ---- UTIL ----
const $ = (id) => document.getElementById(id);
const upper = (s) => (s || '').trim().toUpperCase();
const semAcentos = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function fmtData(v) { if (!v) return ''; const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; }
function cloneDefaultCargos() { return JSON.parse(JSON.stringify(DEFAULT_CARGOS)); }
function normalizarEmpresa(nome) {
  const raw = (nome || '').toUpperCase();
  if (raw.includes('CLEAN')) return 'PRO CLEAN';
  if (raw.includes('SERV')) return 'PRO SERVICOS';
  if (raw.includes('SEGUR')) return 'PRO SEGURANCA';
  return nome;
}
function mesclarCargosSalvos(salvos) {
  const todos = cloneDefaultCargos();
  Object.entries(salvos || {}).forEach(([empresaOriginal, lista]) => {
    const empresa = normalizarEmpresa(empresaOriginal);
    if (!todos[empresa] || !Array.isArray(lista)) return;
    lista.forEach((item) => {
      const cargo = upper(item && item.cargo);
      const salario = (item && item.salario || '').trim();
      if (!cargo || !salario) return;
      if (!todos[empresa].some((c) => c.cargo === cargo)) todos[empresa].push({ cargo, salario });
    });
  });
  return todos;
}
function getCargos() {
  try {
    const salvos = JSON.parse(localStorage.getItem('hub_rs_cargos') || '{}');
    const mesclados = mesclarCargosSalvos(salvos);
    localStorage.setItem('hub_rs_cargos', JSON.stringify(mesclados));
    return mesclados;
  } catch {
    return cloneDefaultCargos();
  }
}
function setCargos(c) { localStorage.setItem('hub_rs_cargos', JSON.stringify(c)); }

async function fetchFirst(paths) {
  let last;
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (response.ok) return response;
      last = response;
    } catch (error) {
      last = { ok: false, statusText: error.message };
    }
  }
  return last || { ok: false, statusText: 'arquivo nao encontrado' };
}
async function jsonFirst(paths, fallback = {}) {
  const response = await fetchFirst(paths);
  if (!response.ok) return fallback;
  return response.json();
}
async function baseBytes(file) {
  const r = await fetchFirst(['./bases/' + file, './' + file]);
  if (!r.ok) throw new Error('Nao foi possivel carregar o modelo: ' + file);
  return new Uint8Array(await r.arrayBuffer());
}
function baixar(bytes, nome) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function copiarTexto(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(texto);
    return;
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}
function toast(msg, tipo = 'info') {
  const ic = { success: 'OK', error: '!', info: 'i' };
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = `<span class="toast-icon">${ic[tipo]}</span><span class="toast-msg">${msg}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(() => { el.style.animation = 'fadeOut .4s ease forwards'; setTimeout(() => el.remove(), 400); }, 3600);
}

// ---- MASCARAS ----
function mascaraCPF(i) { let v = i.value.replace(/\D/g, '').slice(0, 11); if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4'); else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3'); else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2'); i.value = v; }
function mascaraCEP(i) { let v = i.value.replace(/\D/g, '').slice(0, 8); if (v.length > 5) v = v.replace(/(\d{5})(\d{1,3})/, '$1-$2'); i.value = v; }
function mascaraTel(i) { let v = i.value.replace(/\D/g, '').slice(0, 11); if (v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3'); else if (v.length > 6) v = v.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3'); else if (v.length > 2) v = v.replace(/(\d{2})(\d{1,5})/, '($1) $2'); else if (v.length) v = v.replace(/(\d{1,2})/, '($1'); i.value = v; }
function mascaraRG(i) {
  let v = i.value.toUpperCase().replace(/[^0-9X]/g, '').slice(0, 9);
  if (v.length > 8) v = v.replace(/(\d{1,2})(\d{3})(\d{3})([0-9X])/, '$1.$2.$3-$4');
  else if (v.length > 5) v = v.replace(/(\d{1,2})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 2) v = v.replace(/(\d{1,2})(\d{1,3})/, '$1.$2');
  i.value = v;
}
function mascaraMoedaBRL(i) {
  const centavos = i.value.replace(/\D/g, '').replace(/^0+/, '') || '0';
  const valor = Number(centavos) / 100;
  i.value = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function escalaDoHorario(valor) {
  const texto = upper(valor).replace(/\s+/g, ' ').trim();
  return PASSAPORTE_ESCALAS.find((escala) => texto.startsWith(escala));
}
function horarioSemEscala(valor) {
  const escala = escalaDoHorario(valor);
  if (!escala) return (valor || '').trim();
  return (valor || '').trim().replace(new RegExp('^' + escala + '\\s*-?\\s*', 'i'), '').trim();
}
function horaEntradaHorario(valor) {
  const texto = horarioSemEscala(valor).trim().toUpperCase();
  if (texto.includes('FOLGUISTA')) return '';
  const match = texto.match(/\b(\d{1,2})(?::?(\d{2}))?\b/);
  if (!match) return '';
  return `${String(match[1]).padStart(2, '0')}:${match[2] || '00'}`;
}
function atualizarHorarioApresentacao() {
  const h = $('p_hapres');
  if (!h) return;
  if (passTipo === 'BASE') {
    h.value = '07:00';
  } else {
    h.value = horaEntradaHorario($('p_htrab').value);
  }
  h.readOnly = true;
}
function forcarCaps(el) {
  if (!el || typeof el.value !== 'string') return;
  const ini = el.selectionStart, fim = el.selectionEnd;
  const novo = el.value.toUpperCase();
  if (el.value === novo) return;
  el.value = novo;
  try { el.setSelectionRange(ini, fim); } catch {}
}
function textoPdfPassaporte(valor) {
  return semAcentos(valor).replace(/\bA\s+S\b/g, 'AS').replace(/[?�]S/g, 'AS').replace(/\s+/g, ' ').trim();
}
function renderHorariosPassaporte() {
  const lista = $('p_htrab_options');
  if (!lista) return;
  const escala = $('p_escala') && $('p_escala').value;
  if (!escala) {
    lista.innerHTML = '';
    lista.classList.add('hidden');
    return;
  }
  const termo = semAcentos(horarioSemEscala($('p_htrab').value)).toUpperCase().replace(/\s+/g, ' ').trim();
  const horarios = PASSAPORTE_HORARIOS
    .filter((item) => item.startsWith(escala + ' - '))
    .map((item) => horarioSemEscala(item))
    .filter((item) => !termo || semAcentos(item).toUpperCase().includes(termo));
  lista.innerHTML = horarios.map((item) =>
    `<button class="suggestion-item" type="button" role="option" data-v="${item.replace(/"/g, '&quot;')}">${item}</button>`
  ).join('');
  lista.classList.toggle('hidden', !horariosAbertos || !horarios.length);
}
function renderEscalasPassaporte() {
  const sel = $('p_escala');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione...</option>' + PASSAPORTE_ESCALAS.map((escala) => `<option>${escala}</option>`).join('');
  atualizarCustomSelect('p_escala');
}
function optionHtml(valor) {
  return String(valor || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function atualizarCustomSelect(id) {
  const sel = $(id), input = $(id + '_input');
  if (!sel || !input) return;
  const opcao = sel.selectedOptions && sel.selectedOptions[0];
  input.value = opcao && sel.value ? opcao.textContent : '';
  input.disabled = sel.disabled;
}
function renderCustomSelect(id) {
  const sel = $(id), input = $(id + '_input'), lista = $(id + '_options');
  const state = customSelectState[id] || {};
  if (!sel || !input || !lista) return;
  const termo = semAcentos(input.value).toUpperCase().replace(/\s+/g, ' ').trim();
  let opcoes = Array.from(sel.options)
    .filter((opcao) => opcao.value)
    .map((opcao) => ({ value: opcao.value, label: opcao.textContent }));
  if (state.filterable && !input.readOnly && termo) {
    opcoes = opcoes.filter((opcao) => semAcentos(opcao.label).toUpperCase().includes(termo));
  }
  lista.innerHTML = opcoes.map((opcao) =>
    `<button class="suggestion-item${opcao.value === sel.value ? ' active' : ''}" type="button" role="option" data-v="${optionHtml(opcao.value)}">${optionHtml(opcao.label)}</button>`
  ).join('');
  lista.classList.toggle('hidden', !state.aberto || sel.disabled || !opcoes.length);
}
function fecharCustomSelects(exceto = '') {
  Object.keys(customSelectState).forEach((id) => {
    if (id === exceto) return;
    customSelectState[id].aberto = false;
    atualizarCustomSelect(id);
    renderCustomSelect(id);
  });
}
function selecionarCustomSelect(id, valor) {
  const sel = $(id);
  if (!sel) return;
  sel.value = valor;
  customSelectState[id].aberto = false;
  atualizarCustomSelect(id);
  renderCustomSelect(id);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  limparErro(sel);
}
function setupCustomSelect(id, opts = {}) {
  const sel = $(id), input = $(id + '_input'), lista = $(id + '_options');
  if (!sel || !input || !lista) return;
  customSelectState[id] = { aberto: false, filterable: !!opts.filterable };
  const abrir = () => {
    if (sel.disabled || input.disabled) return;
    fecharCustomSelects(id);
    customSelectState[id].aberto = true;
    renderCustomSelect(id);
  };
  input.addEventListener('focus', abrir);
  input.addEventListener('click', abrir);
  input.addEventListener('input', () => {
    forcarCaps(input);
    if (customSelectState[id].filterable) {
      sel.value = '';
      if (id === 'c_cargo' && $('c_salario')) $('c_salario').value = '';
      customSelectState[id].aberto = true;
      renderCustomSelect(id);
    }
  });
  sel.addEventListener('change', () => {
    atualizarCustomSelect(id);
    renderCustomSelect(id);
    limparErro(sel);
  });
  lista.addEventListener('mousedown', (event) => {
    const item = event.target.closest('.suggestion-item');
    if (!item) return;
    event.preventDefault();
    selecionarCustomSelect(id, item.dataset.v);
  });
  atualizarCustomSelect(id);
}

// ---- VALIDACAO ----
function limparErro(el) { el.classList.remove('error'); const proxy = $(el.id + '_input'); if (proxy) proxy.classList.remove('error'); const e = $('err-' + el.id); if (e) e.classList.remove('show'); }
function erro(id) { const el = $(id); el.classList.add('error'); const proxy = $(id + '_input'); if (proxy) proxy.classList.add('error'); const e = $('err-' + id); if (e) e.classList.add('show'); }
function validar(ids) {
  let ok = true;
  for (const id of ids) { const el = $(id); if (!el.value.trim()) { erro(id); ok = false; } }
  return ok;
}

// ============================================================
const App = {
  // ---- GATE ----
  entrar() {
    if (($('gatePass').value || '').trim().toLowerCase() === SENHA) { sessionStorage.setItem('hub_auth', '1'); $('gate').classList.add('hidden'); }
    else { toast('Senha incorreta.', 'error'); }
  },
  // ---- NAV ----
  tab(name) {
    ['inicio', 'rs', 'carta', 'oncare', 'passaporte', 'config'].forEach((v) => $('view-' + v).classList.add('hidden'));
    $('view-' + name).classList.remove('hidden');
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name || (name === 'config' && t.dataset.tab === 'config')));
    if (['carta', 'oncare', 'passaporte'].includes(name)) document.querySelector('.tab[data-tab="rs"]').classList.add('active');
    if (name === 'config') this.renderConfig();
    window.scrollTo(0, 0);
  },
  tool(name) {
    ['inicio', 'rs', 'carta', 'oncare', 'passaporte', 'config'].forEach((v) => $('view-' + v).classList.add('hidden'));
    $('view-' + name).classList.remove('hidden');
    window.scrollTo(0, 0);
  },

  // ---- EMPRESA (carta/oncare) ----
  selEmpresa(tool, nome) {
    const cont = tool === 'carta' ? 'cartaEmpresas' : 'oncareEmpresas';
    document.querySelectorAll('#' + cont + ' .choice-btn').forEach((b) => b.classList.toggle('active', b.dataset.v === nome));
    if (tool === 'carta') {
      cartaEmpresa = nome; const e = EMPRESAS[nome];
      $('cartaCnpj').textContent = e.cnpj; $('cartaRazao').textContent = e.razao; $('cartaCargoPad').textContent = e.cargoPadrao;
      $('cartaInfo').classList.add('show');
      this.preencherCargos(nome);
    } else { oncareEmpresa = nome; }
  },
  preencherCargos(empresa) {
    const sel = $('c_cargo'); const lista = getCargos()[empresa] || [];
    sel.disabled = false;
    $('c_cargo_input').disabled = false;
    $('c_cargo_input').placeholder = 'Digite ou selecione um cargo';
    $('c_addCargo').disabled = false;
    $('c_addCargo').title = 'Cadastrar novo cargo';
    $('c_cargoHint').textContent = 'O salario e preenchido automaticamente.';
    sel.innerHTML = '<option value="">Selecione...</option>' + lista.map((c) => `<option value="${c.cargo}" data-sal="${c.salario}">${c.cargo}</option>`).join('');
    const padrao = EMPRESAS[empresa] && EMPRESAS[empresa].cargoPadrao;
    if (padrao && lista.some((c) => c.cargo === padrao)) sel.value = padrao;
    else if (lista[0]) sel.value = lista[0].cargo;
    atualizarCustomSelect('c_cargo');
    renderCustomSelect('c_cargo');
    this.onCargoChange();
  },
  onCargoChange() { const o = $('c_cargo').selectedOptions[0]; $('c_salario').value = o ? (o.dataset.sal || '') : ''; },
  bloquearCargo() {
    cartaEmpresa = null;
    $('c_cargo').innerHTML = '<option value="">Selecione a empresa primeiro</option>';
    $('c_cargo').value = '';
    $('c_cargo').disabled = true;
    $('c_cargo_input').value = '';
    $('c_cargo_input').placeholder = 'Selecione a empresa primeiro';
    $('c_cargo_input').disabled = true;
    renderCustomSelect('c_cargo');
    $('c_addCargo').disabled = true;
    $('c_addCargo').title = 'Selecione uma empresa antes de cadastrar cargo';
    $('c_salario').value = '';
    $('c_cargoHint').textContent = 'Selecione uma empresa para liberar os cargos.';
  },

  // ---- PASSAPORTE tipo ----
  selTipo(t) {
    passTipo = t;
    document.querySelectorAll('#passTipos .choice-btn').forEach((b) => b.classList.toggle('active', b.dataset.v === t));
    const end = $('p_endereco'), h = $('p_hapres'), hint = $('p_endHint');
    if (t === 'BASE') {
      end.value = BASE_ENDERECO; end.readOnly = true; h.value = '07:00'; h.readOnly = true;
      hint.textContent = 'Apresentacao direto na BASE (preenchido automaticamente).';
    } else {
      if (end.readOnly) end.value = '';
      end.readOnly = false; h.readOnly = true;
      atualizarHorarioApresentacao();
      hint.textContent = 'Apresentacao direto no POSTO; horario acompanha a entrada.';
    }
    limparErro(end); limparErro(h);
  },
  selTipoExame(tipo) {
    tipoExame = tipo;
    document.querySelectorAll('#oncareTipos .choice-btn').forEach((b) => b.classList.toggle('active', b.dataset.v === tipo));
  },

  dias(id, offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    $(id).value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    limparErro($(id));
  },
  hoje(id) { this.dias(id, 0); },

  // ---- GERAR CARTA ----
  async gerarCarta() {
    if (!cartaEmpresa) return toast('Selecione a empresa.', 'error');
    if (!$('c_cargo').value) return toast('Selecione o cargo.', 'error');
    if (!validar(['c_nome', 'c_endereco', 'c_cep', 'c_cidade', 'c_rg', 'c_cpf', 'c_data'])) return toast('Preencha os campos obrigatorios.', 'error');
    const btn = $('c_btn'); btn.classList.add('loading'); btn.disabled = true;
    try {
      const e = EMPRESAS[cartaEmpresa];
      const nome = upper($('c_nome').value), cargo = $('c_cargo').value;
      const cidade = upper($('c_cidade').value);
      const cidadePdf = semAcentos(cidade) === 'SAO PAULO - SP' ? '' : cidade;
      const data = { NOME: nome, CARGO: cargo, SALARIO: $('c_salario').value, ENDERECO: upper($('c_endereco').value), CEP: $('c_cep').value.trim(), CIDADE: cidadePdf, RG: $('c_rg').value.trim(), CPF: $('c_cpf').value.trim(), DATA: fmtData($('c_data').value) };
      const bytes = await fillCarta(PDFLib, await baseBytes(e.base), CARTAS[e.coords], data);
      baixar(bytes, `${nome} - ${cargo}.pdf`);
      toast('Carta gerada com sucesso.', 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  },
  async copiarMensagemCarta() {
    const texto = [
      'Segue a carta para abertura da conta salário.',
      'Basta imprimir e comparecer na agência mais próxima.',
    ].join('\n');
    await copiarTexto(texto);
    toast('Mensagem da carta copiada.', 'success');
  },

  // ---- GERAR ONCARE ----
  async gerarOncare() {
    if (!oncareEmpresa) return toast('Selecione a empresa.', 'error');
    if (!validar(['o_local', 'o_unidade', 'o_data', 'o_cargo', 'o_nome', 'o_rg', 'o_cpf', 'o_tel', 'o_nasc'])) return toast('Preencha os campos obrigatorios.', 'error');
    const btn = $('o_btn'); btn.classList.add('loading'); btn.disabled = true;
    try {
      const nome = upper($('o_nome').value);
      const data = {
        EMPRESA: oncareEmpresa,
        TIPO_EXAME_TEXTO: TIPO_EXAMES[tipoExame].label.toUpperCase(),
        MARCA_MUDANCA_FUNCAO: tipoExame === 'complementar' ? 'X' : '',
        LOCAL: upper($('o_local').value),
        DATA_EXAME: fmtData($('o_data').value),
        UNIDADE: upper($('o_unidade').value),
        CARGO: upper($('o_cargo').value),
        NOME: nome,
        RG: $('o_rg').value.trim(),
        CPF: $('o_cpf').value.trim(),
        TEL: $('o_tel').value.trim(),
        NASCIMENTO: fmtData($('o_nasc').value),
      };
      const modeloOncare = tipoExame === 'complementar' ? 'base_oncare_complementar.pdf' : 'base_oncare_admissional.pdf';
      const bytes = await fillOncare(PDFLib, await baseBytes(modeloOncare), ONCARE, data);
      baixar(bytes, `GUIA ONCARE - ${nome}.pdf`);
      toast('Guia OnCare gerada com sucesso.', 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  },
  assuntoOncare() {
    if (!$('o_data').value) {
      erro('o_data');
      toast('Informe a data do exame para copiar o assunto.', 'error');
      return '';
    }
    return `AGENDAMENTO ${fmtData($('o_data').value).slice(0, 5)}`;
  },
  emailOncare() {
    const data = fmtData($('o_data').value);
    if (!data) {
      erro('o_data');
      toast('Informe a data do exame para copiar o e-mail.', 'error');
      return '';
    }
    return [
      'Boa tarde!',
      '',
      `Por gentileza, realizar o agendamento para o dia ${data}.`,
      '',
      'Seguem anexos a guia OnCare e os documentos necessarios.',
      '',
      'Atenciosamente,',
    ].join('\n');
  },
  async copiarAssuntoOncare() {
    const assunto = this.assuntoOncare();
    if (!assunto) return;
    await copiarTexto(assunto);
    toast('Assunto copiado.', 'success');
  },
  async copiarEmailOncare() {
    const corpo = this.emailOncare();
    if (!corpo) return;
    await copiarTexto(corpo);
    toast('Modelo de e-mail copiado.', 'success');
  },

  // ---- GERAR PASSAPORTE ----
  async gerarPassaporte() {
    const reqs = ['p_nome', 'p_data', 'p_escala', 'p_htrab', 'p_endereco', 'p_hapres'];
    if (!validar(reqs)) return toast('Preencha os campos obrigatorios.', 'error');
    const btn = $('p_btn'); btn.classList.add('loading'); btn.disabled = true;
    try {
      const nome = upper($('p_nome').value);
      const data = {
        dataInicio: fmtData($('p_data').value), nome: `${$('p_trat').value} ${textoPdfPassaporte(nome)}`,
        escala: $('p_escala').value, horarioTrabalho: textoPdfPassaporte(horarioSemEscala($('p_htrab').value)), tipo: passTipo,
        horarioApresentacao: textoPdfPassaporte($('p_hapres').value), endereco: textoPdfPassaporte(upper($('p_endereco').value)),
      };
      const bytes = await fillPassaporte(PDFLib, await baseBytes('base_passaporte.pdf'), PASSAPORTE, data);
      baixar(bytes, `PASSAPORTE - ${nome}.pdf`);
      toast('Passaporte gerado com sucesso.', 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  },

  // ---- CARGO MODAL ----
  abrirCargoModal() {
    if (!cartaEmpresa) return toast('Selecione uma empresa antes de cadastrar cargo.', 'info');
    const sel = $('m_empresa'); sel.innerHTML = Object.keys(EMPRESAS).map((e) => `<option>${e}</option>`).join('');
    if (cartaEmpresa) sel.value = cartaEmpresa;
    atualizarCustomSelect('m_empresa');
    renderCustomSelect('m_empresa');
    $('m_cargo').value = ''; $('m_salario').value = '';
    $('cargoModal').classList.add('show');
  },
  fecharCargoModal() { $('cargoModal').classList.remove('show'); },
  salvarCargo() {
    const empresa = $('m_empresa').value, cargo = upper($('m_cargo').value), salario = $('m_salario').value.trim();
    if (!cargo || !salario) return toast('Informe cargo e salario.', 'error');
    const all = getCargos(); (all[empresa] = all[empresa] || []);
    if (all[empresa].some((c) => c.cargo === cargo)) return toast('Cargo ja cadastrado nesta empresa.', 'error');
    all[empresa].push({ cargo, salario }); setCargos(all);
    this.fecharCargoModal();
    if (cartaEmpresa === empresa) { this.preencherCargos(empresa); $('c_cargo').value = cargo; atualizarCustomSelect('c_cargo'); this.onCargoChange(); }
    this.renderConfig();
    toast(`Cargo "${cargo}" cadastrado em ${empresa}.`, 'success');
  },
  removerCargo(empresa, cargo) {
    if ((DEFAULT_CARGOS[empresa] || []).some((c) => c.cargo === cargo)) {
      return toast('Cargo padrao nao pode ser removido.', 'info');
    }
    const all = getCargos(); all[empresa] = (all[empresa] || []).filter((c) => c.cargo !== cargo); setCargos(all);
    this.renderConfig(); if (cartaEmpresa === empresa) this.preencherCargos(empresa);
    toast('Cargo removido.', 'info');
  },
  renderConfig() {
    const all = getCargos();
    $('cfgCargos').innerHTML = Object.keys(EMPRESAS).map((emp) => {
      const itens = (all[emp] || []).map((c) =>
        `<div class="cargo-item"><span><span class="ci-cargo">${c.cargo}</span> &nbsp; <span class="ci-sal">${c.salario}</span></span>${(DEFAULT_CARGOS[emp] || []).some((p) => p.cargo === c.cargo) ? '<span class="ci-fixed">padrao</span>' : `<button onclick="App.removerCargo('${emp.replace(/'/g, "\\'")}','${c.cargo.replace(/'/g, "\\'")}')">remover</button>`}</div>`
      ).join('') || '<p class="field-hint">Nenhum cargo cadastrado.</p>';
      return `<div class="empresa-block"><h4>${emp}</h4><div class="cargo-list">${itens}</div></div>`;
    }).join('');
  },
  exportarCargos() {
    const blob = new Blob([JSON.stringify(getCargos(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cargos-rs.json'; a.click();
    toast('Backup exportado.', 'success');
  },
  importarCargos(ev) {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { setCargos(JSON.parse(r.result)); this.renderConfig(); if (cartaEmpresa) this.preencherCargos(cartaEmpresa); toast('Cargos importados.', 'success'); } catch { toast('Arquivo invalido.', 'error'); } };
    r.readAsText(f); ev.target.value = '';
  },

  limpar(tool) {
    const map = { carta: ['c_nome', 'c_endereco', 'c_cep', 'c_cidade', 'c_rg', 'c_cpf', 'c_salario'], oncare: ['o_local', 'o_unidade', 'o_cargo', 'o_nome', 'o_rg', 'o_cpf', 'o_tel', 'o_nasc'], passaporte: ['p_nome', 'p_htrab'] };
    (map[tool] || []).forEach((id) => { const el = $(id); el.value = ''; limparErro(el); });
    if (tool === 'carta') { $('c_cidade').value = 'SÃO PAULO - SP'; this.bloquearCargo(); document.querySelectorAll('#cartaEmpresas .choice-btn').forEach((b) => b.classList.remove('active')); $('cartaInfo').classList.remove('show'); }
    if (tool === 'oncare') { this.selTipoExame('admissional'); document.querySelectorAll('#oncareEmpresas .choice-btn').forEach((b) => b.classList.remove('active')); oncareEmpresa = null; }
    if (tool === 'passaporte') { $('p_escala').value = ''; atualizarCustomSelect('p_escala'); $('p_hapres').value = ''; horariosAbertos = false; renderHorariosPassaporte(); this.selTipo('BASE'); }
    toast('Formulario limpo.', 'info');
  },
};
window.App = App;

// ============================================================
// INIT
async function init() {
  if (sessionStorage.getItem('hub_auth') === '1') $('gate').classList.add('hidden');
  $('gatePass').addEventListener('keydown', (e) => { if (e.key === 'Enter') App.entrar(); });

  try {
    [CARTAS, ONCARE, PASSAPORTE] = await Promise.all([
      jsonFirst(['./coords/cartas.json', './cartas.json']),
      jsonFirst(['./coords/oncare.json', './oncare.json']),
      jsonFirst(['./coords/passaporte.json', './passaporte.json']),
    ]);
  } catch (e) { toast('Falha ao carregar configuracoes.', 'error'); }

  // botoes de empresa
  const mkEmp = (cont, tool) => {
    $(cont).innerHTML = Object.entries(EMPRESAS).map(([nome, e]) =>
      `<button class="choice-btn" data-v="${nome}" onclick="App.selEmpresa('${tool}','${nome}')"><span class="choice-icon">${e.icon}</span><span class="choice-name">${nome}</span></button>`
    ).join('');
  };
  mkEmp('cartaEmpresas', 'carta'); mkEmp('oncareEmpresas', 'oncare');

  $('oncareTipos').innerHTML = Object.entries(TIPO_EXAMES).map(([tipo, item]) =>
    `<button class="choice-btn" data-v="${tipo}" onclick="App.selTipoExame('${tipo}')"><span class="choice-icon">${item.icon}</span><span class="choice-name">${item.label}</span></button>`
  ).join('');
  App.selTipoExame('admissional');

  // tipos passaporte
  $('passTipos').innerHTML = [['BASE', '\u{1F3E0}'], ['POSTO', '\u{1F4CD}']].map(([t, ic]) =>
    `<button class="choice-btn" data-v="${t}" onclick="App.selTipo('${t}')"><span class="choice-icon">${ic}</span><span class="choice-name">${t}</span></button>`
  ).join('');
  renderEscalasPassaporte();
  setupCustomSelect('c_cargo', { filterable: true });
  setupCustomSelect('p_trat');
  setupCustomSelect('p_escala');
  setupCustomSelect('m_empresa');
  renderHorariosPassaporte();
  App.selTipo('BASE');

  // mascaras + limpar erro
  const mask = (id, fn) => { const el = $(id); el.addEventListener('input', () => { fn(el); limparErro(el); }); };
  mask('c_cpf', mascaraCPF); mask('c_cep', mascaraCEP); mask('c_rg', mascaraRG);
  mask('o_cpf', mascaraCPF); mask('o_tel', mascaraTel); mask('o_rg', mascaraRG);
  mask('m_salario', mascaraMoedaBRL);
  ['c_nome', 'c_endereco', 'c_cidade', 'o_local', 'o_unidade', 'o_cargo', 'o_nome', 'p_nome', 'p_htrab', 'p_endereco', 'p_hapres', 'm_cargo']
    .forEach((id) => $(id).addEventListener('input', () => forcarCaps($(id))));
  ['c_nome', 'c_endereco', 'c_cidade', 'c_data', 'o_local', 'o_unidade', 'o_data', 'o_cargo', 'o_nome', 'o_nasc', 'p_nome', 'p_data', 'p_escala', 'p_htrab', 'p_endereco', 'p_hapres', 'm_cargo']
    .forEach((id) => $(id).addEventListener('input', () => limparErro($(id))));
  $('p_escala').addEventListener('change', () => {
    $('p_htrab').value = '';
    atualizarHorarioApresentacao();
    horariosAbertos = true;
    renderHorariosPassaporte();
    limparErro($('p_escala'));
  });
  $('p_htrab').addEventListener('focus', () => {
    horariosAbertos = true;
    renderHorariosPassaporte();
  });
  $('p_htrab').addEventListener('input', () => {
    horariosAbertos = true;
    const escala = escalaDoHorario($('p_htrab').value);
    if (escala && $('p_escala').value !== escala) {
      $('p_escala').value = escala;
      atualizarCustomSelect('p_escala');
      limparErro($('p_escala'));
    }
    atualizarHorarioApresentacao();
    renderHorariosPassaporte();
  });
  $('p_htrab_options').addEventListener('mousedown', (event) => {
    const item = event.target.closest('.suggestion-item');
    if (!item) return;
    event.preventDefault();
    $('p_htrab').value = item.dataset.v;
    atualizarHorarioApresentacao();
    horariosAbertos = false;
    renderHorariosPassaporte();
    limparErro($('p_htrab'));
    limparErro($('p_escala'));
  });
  document.addEventListener('mousedown', (event) => {
    if (event.target.closest('.autocomplete-field')) return;
    fecharCustomSelects();
    horariosAbertos = false;
    renderHorariosPassaporte();
  });

  App.bloquearCargo();
  App.renderConfig();
}
init();

