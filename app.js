// app.js — Hub de Automações R&S (Pro Security). 100% navegador.
// Usa o mesmo nucleo isomorfico pdf-fill.mjs validado no build.
import * as PDFLib from './vendor/pdf-lib.esm.min.js';
import { fillCarta, fillOncare, fillPassaporte } from './pdf-fill.mjs';

// ---- CONFIG ----
const SENHA = 'prosecurity';           // senha interna (troque aqui; proteja com Cloudflare Access em producao)
const EMPRESAS = {
  'PRO CLEAN':     { base: 'base_clean.pdf',     coords: 'clean',     razao: 'PRO CLEAN HIGIENIZAÇÃO E LIMPEZA LTDA',       cnpj: '16.626.344/0001-40', cargoPadrao: 'AUXILIAR DE LIMPEZA', icon: '🧹' },
  'PRO SERVIÇOS':  { base: 'base_porteiro.pdf',  coords: 'porteiro',  razao: 'PRO SECURITY SERVIÇOS ESPECIALIZADOS LTDA',   cnpj: '56.566.292/0001-89', cargoPadrao: 'PORTEIRO',           icon: '🏢' },
  'PRO SEGURANÇA': { base: 'base_vigilante.pdf', coords: 'vigilante', razao: 'PRO SECURITY SEGURANÇA PATRIMONIAL LTDA',     cnpj: '96.231.568/0001-92', cargoPadrao: 'VIGILANTE',          icon: '🛡️' },
};
const DEFAULT_CARGOS = {
  'PRO CLEAN':     [{ cargo: 'AUXILIAR DE LIMPEZA', salario: 'R$ 1.837,40' }],
  'PRO SERVIÇOS':  [{ cargo: 'PORTEIRO',            salario: 'R$ 2.031,57' }],
  'PRO SEGURANÇA': [{ cargo: 'VIGILANTE',           salario: 'R$ 2.271,74' }],
};
const BASE_ENDERECO = 'Rua Ibiraporã, 100 - Jardim Londrina';

// ---- ESTADO ----
let CARTAS = {}, ONCARE = {}, PASSAPORTE = {};
let cartaEmpresa = null, oncareEmpresa = null, passTipo = 'BASE';

// ---- UTIL ----
const $ = (id) => document.getElementById(id);
const upper = (s) => (s || '').trim().toUpperCase();
function fmtData(v) { if (!v) return ''; const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; }
function getCargos() { try { return JSON.parse(localStorage.getItem('hub_rs_cargos')) || structuredClone(DEFAULT_CARGOS); } catch { return structuredClone(DEFAULT_CARGOS); } }
function setCargos(c) { localStorage.setItem('hub_rs_cargos', JSON.stringify(c)); }

async function baseBytes(file) {
  const r = await fetch('./bases/' + file);
  if (!r.ok) throw new Error('Não foi possível carregar o modelo: ' + file);
  return new Uint8Array(await r.arrayBuffer());
}
function baixar(bytes, nome) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function toast(msg, tipo = 'info') {
  const ic = { success: '✅', error: '❌', info: 'ℹ️' };
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

// ---- VALIDACAO ----
function limparErro(el) { el.classList.remove('error'); const e = $('err-' + el.id); if (e) e.classList.remove('show'); }
function erro(id) { const el = $(id); el.classList.add('error'); const e = $('err-' + id); if (e) e.classList.add('show'); }
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
    sel.innerHTML = '<option value="">Selecione…</option>' + lista.map((c) => `<option value="${c.cargo}" data-sal="${c.salario}">${c.cargo}</option>`).join('');
    $('c_salario').value = '';
  },
  onCargoChange() { const o = $('c_cargo').selectedOptions[0]; $('c_salario').value = o ? (o.dataset.sal || '') : ''; },

  // ---- PASSAPORTE tipo ----
  selTipo(t) {
    passTipo = t;
    document.querySelectorAll('#passTipos .choice-btn').forEach((b) => b.classList.toggle('active', b.dataset.v === t));
    const end = $('p_endereco'), h = $('p_hapres'), hint = $('p_endHint');
    if (t === 'BASE') {
      end.value = BASE_ENDERECO; end.readOnly = true; h.value = '07:00'; h.readOnly = true;
      hint.textContent = 'Apresentação direto na BASE (preenchido automaticamente).';
    } else {
      if (end.readOnly) { end.value = ''; h.value = ''; }
      end.readOnly = false; h.readOnly = false;
      hint.textContent = 'Apresentação direto no POSTO (preencha endereço e horário).';
    }
    limparErro(end); limparErro(h);
  },

  hoje(id) { const d = new Date(); $(id).value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },

  // ---- GERAR CARTA ----
  async gerarCarta() {
    if (!cartaEmpresa) return toast('Selecione a empresa.', 'error');
    if (!$('c_cargo').value) return toast('Selecione o cargo.', 'error');
    if (!validar(['c_nome', 'c_endereco', 'c_cep', 'c_rg', 'c_cpf', 'c_data'])) return toast('Preencha os campos obrigatórios.', 'error');
    if ($('c_cpf').value.replace(/\D/g, '').length !== 11) { erro('c_cpf'); return toast('CPF inválido.', 'error'); }
    if ($('c_cep').value.replace(/\D/g, '').length !== 8) { erro('c_cep'); return toast('CEP inválido.', 'error'); }
    const btn = $('c_btn'); btn.classList.add('loading'); btn.disabled = true;
    try {
      const e = EMPRESAS[cartaEmpresa];
      const nome = upper($('c_nome').value), cargo = $('c_cargo').value;
      const data = { NOME: nome, CARGO: cargo, SALARIO: $('c_salario').value, ENDERECO: upper($('c_endereco').value), CEP: $('c_cep').value.trim(), RG: $('c_rg').value.trim(), CPF: $('c_cpf').value.trim(), DATA: fmtData($('c_data').value) };
      const bytes = await fillCarta(PDFLib, await baseBytes(e.base), CARTAS[e.coords], data);
      baixar(bytes, `${nome} - ${cargo}.pdf`);
      toast('Carta gerada com sucesso.', 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  },

  // ---- GERAR ONCARE ----
  async gerarOncare() {
    if (!oncareEmpresa) return toast('Selecione a empresa.', 'error');
    if (!validar(['o_local', 'o_unidade', 'o_data', 'o_cargo', 'o_nome', 'o_rg', 'o_cpf', 'o_tel', 'o_nasc'])) return toast('Preencha os campos obrigatórios.', 'error');
    if ($('o_cpf').value.replace(/\D/g, '').length !== 11) { erro('o_cpf'); return toast('CPF inválido.', 'error'); }
    const btn = $('o_btn'); btn.classList.add('loading'); btn.disabled = true;
    try {
      const nome = upper($('o_nome').value);
      const data = { EMPRESA: EMPRESAS[oncareEmpresa].razao, LOCAL: upper($('o_local').value), DATA_EXAME: fmtData($('o_data').value), UNIDADE: upper($('o_unidade').value), CARGO: upper($('o_cargo').value), NOME: nome, RG: $('o_rg').value.trim(), CPF: $('o_cpf').value.trim(), TEL: $('o_tel').value.trim(), NASCIMENTO: fmtData($('o_nasc').value) };
      const bytes = await fillOncare(PDFLib, await baseBytes('base_oncare.pdf'), ONCARE, data);
      baixar(bytes, `GUIA ONCARE - ${nome}.pdf`);
      toast('Guia OnCare gerada com sucesso.', 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  },

  // ---- GERAR PASSAPORTE ----
  async gerarPassaporte() {
    const reqs = ['p_nome', 'p_data', 'p_escala', 'p_htrab', 'p_endereco', 'p_hapres'];
    if (!validar(reqs)) return toast('Preencha os campos obrigatórios.', 'error');
    const btn = $('p_btn'); btn.classList.add('loading'); btn.disabled = true;
    try {
      const nome = upper($('p_nome').value);
      const data = {
        dataInicio: fmtData($('p_data').value), nome: `${$('p_trat').value} ${nome}`,
        escala: $('p_escala').value, horarioTrabalho: $('p_htrab').value.trim(), tipo: passTipo,
        horarioApresentacao: $('p_hapres').value.trim(), endereco: upper($('p_endereco').value),
      };
      const bytes = await fillPassaporte(PDFLib, await baseBytes('base_passaporte.pdf'), PASSAPORTE, data);
      baixar(bytes, `PASSAPORTE - ${nome}.pdf`);
      toast('Passaporte gerado com sucesso.', 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  },

  // ---- CARGO MODAL ----
  abrirCargoModal() {
    const sel = $('m_empresa'); sel.innerHTML = Object.keys(EMPRESAS).map((e) => `<option>${e}</option>`).join('');
    if (cartaEmpresa) sel.value = cartaEmpresa;
    $('m_cargo').value = ''; $('m_salario').value = '';
    $('cargoModal').classList.add('show');
  },
  fecharCargoModal() { $('cargoModal').classList.remove('show'); },
  salvarCargo() {
    const empresa = $('m_empresa').value, cargo = upper($('m_cargo').value), salario = $('m_salario').value.trim();
    if (!cargo || !salario) return toast('Informe cargo e salário.', 'error');
    const all = getCargos(); (all[empresa] = all[empresa] || []);
    if (all[empresa].some((c) => c.cargo === cargo)) return toast('Cargo já cadastrado nesta empresa.', 'error');
    all[empresa].push({ cargo, salario }); setCargos(all);
    this.fecharCargoModal();
    if (cartaEmpresa === empresa) { this.preencherCargos(empresa); $('c_cargo').value = cargo; this.onCargoChange(); }
    this.renderConfig();
    toast(`Cargo "${cargo}" cadastrado em ${empresa}.`, 'success');
  },
  removerCargo(empresa, cargo) {
    const all = getCargos(); all[empresa] = (all[empresa] || []).filter((c) => c.cargo !== cargo); setCargos(all);
    this.renderConfig(); if (cartaEmpresa === empresa) this.preencherCargos(empresa);
    toast('Cargo removido.', 'info');
  },
  renderConfig() {
    const all = getCargos();
    $('cfgCargos').innerHTML = Object.keys(EMPRESAS).map((emp) => {
      const itens = (all[emp] || []).map((c) =>
        `<div class="cargo-item"><span><span class="ci-cargo">${c.cargo}</span> &nbsp; <span class="ci-sal">${c.salario}</span></span><button onclick="App.removerCargo('${emp.replace(/'/g, "\\'")}','${c.cargo.replace(/'/g, "\\'")}')">remover</button></div>`
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
    r.onload = () => { try { setCargos(JSON.parse(r.result)); this.renderConfig(); if (cartaEmpresa) this.preencherCargos(cartaEmpresa); toast('Cargos importados.', 'success'); } catch { toast('Arquivo inválido.', 'error'); } };
    r.readAsText(f); ev.target.value = '';
  },

  limpar(tool) {
    const map = { carta: ['c_nome', 'c_endereco', 'c_cep', 'c_rg', 'c_cpf', 'c_salario'], oncare: ['o_local', 'o_unidade', 'o_cargo', 'o_nome', 'o_rg', 'o_cpf', 'o_tel'], passaporte: ['p_nome', 'p_htrab'] };
    (map[tool] || []).forEach((id) => { const el = $(id); el.value = ''; limparErro(el); });
    if (tool === 'carta') { $('c_cargo').value = ''; }
    if (tool === 'passaporte') { $('p_escala').value = ''; this.selTipo('BASE'); }
    toast('Formulário limpo.', 'info');
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
      fetch('./coords/cartas.json').then((r) => r.json()),
      fetch('./coords/oncare.json').then((r) => r.json()),
      fetch('./coords/passaporte.json').then((r) => r.json()),
    ]);
  } catch (e) { toast('Falha ao carregar configurações. Sirva o site por HTTP.', 'error'); }

  // botoes de empresa
  const mkEmp = (cont, tool) => {
    $(cont).innerHTML = Object.entries(EMPRESAS).map(([nome, e]) =>
      `<button class="choice-btn" data-v="${nome}" onclick="App.selEmpresa('${tool}','${nome}')"><span class="choice-icon">${e.icon}</span><span class="choice-name">${nome}</span></button>`
    ).join('');
  };
  mkEmp('cartaEmpresas', 'carta'); mkEmp('oncareEmpresas', 'oncare');

  // tipos passaporte
  $('passTipos').innerHTML = [['BASE', '🏠'], ['POSTO', '📍']].map(([t, ic]) =>
    `<button class="choice-btn" data-v="${t}" onclick="App.selTipo('${t}')"><span class="choice-icon">${ic}</span><span class="choice-name">${t}</span></button>`
  ).join('');
  App.selTipo('BASE');

  // mascaras + limpar erro
  const mask = (id, fn) => { const el = $(id); el.addEventListener('input', () => { fn(el); limparErro(el); }); };
  mask('c_cpf', mascaraCPF); mask('c_cep', mascaraCEP);
  mask('o_cpf', mascaraCPF); mask('o_tel', mascaraTel);
  ['c_nome', 'c_endereco', 'c_rg', 'c_data', 'o_local', 'o_unidade', 'o_data', 'o_cargo', 'o_nome', 'o_rg', 'o_nasc', 'p_nome', 'p_data', 'p_escala', 'p_htrab', 'p_endereco', 'p_hapres']
    .forEach((id) => $(id).addEventListener('input', () => limparErro($(id))));

  App.hoje('c_data'); App.hoje('p_data');
  App.renderConfig();
}
init();
