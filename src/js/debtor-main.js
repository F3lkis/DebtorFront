
// ══════════════════════════════════════════════════════
//  VERIFICAÇÃO DE LOGIN E DADOS DO USUÁRIO
// ══════════════════════════════════════════════════════
const USER_ID = localStorage.getItem('dh_user_id');

if (!USER_ID) {
  alert("Sessão expirada. Por favor, faça login novamente.");
  window.location.href = "debtor-login.html"; // Ajuste se o nome do seu arquivo de login for diferente
}

const userName = localStorage.getItem('dh_user_name') || "User";
document.getElementById('user-avatar').textContent = userName.charAt(0).toUpperCase();

function logout() {
  localStorage.clear(); // Limpa tudo
  window.location.href = "debtor-login.html";
}

// ══════════════════════════════════════════════════════
//  CONFIGURAÇÃO DA API 
// ══════════════════════════════════════════════════════
const API_BASE = 'https://debtor-api-81qs.onrender.com';

// Proteção extra: O Spring Boot às vezes converte 'ProductId' (maiúsculo) 
// para 'productId' (minúsculo) no JSON. Isso garante que vamos pegar o ID certo.
const MAP = {
  id:            e => e.productId || e.ProductId || e.id,
  descricao:     e => e.itemBought || '—',
  valor:         e => Number(e.price || 0),
  departamento:  e => e.category || 'Outros', 
  categoria:     e => e.paymentMethod || '—', 
  data:          e => e.date || ''
};

// ══════════════════════════════════════════════════════
//  CAMADA DE API (Tratamento Mágico JSON/Text)
// ══════════════════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    ...options,
  });
  
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`${res.status}: ${msg}`);
  }
  
  // Lemos o conteúdo como texto primeiro
  const text = await res.text();
  
  // Se estiver vazio, retornamos sucesso
  if (!text) return null;
  
  try {
    // Tentamos converter para JSON (para quando o Java manda a lista de gastos)
    return JSON.parse(text);
  } catch (e) {
    // Se não for JSON (caso do "Bank Saved"), retornamos o texto puro sem dar erro
    return text;
  }
}

const Api = {
  listar() { return apiFetch(`/bank/user/${USER_ID}`); },
  criar(payload) { return apiFetch(`/saveBank/user/${USER_ID}`, { method: 'POST', body: JSON.stringify(payload) }); },
  excluir(id) { return apiFetch(`/deleteBank/${id}`, { method: 'DELETE' }); },
};

function normalizar(raw) {
  // A solução definitiva: Buscamos as chaves exatas que vimos no seu print do F12!
  const idCorreto = raw.productId ?? raw.ProductId ?? raw.id;

  return {
    id:           idCorreto,
    descricao:    raw.itemBought || '—',
    valor:        Number(raw.price || 0),
    departamento: raw.category || 'Outros',
    categoria:    raw.paymentMethod || '—',
    data:         raw.date || ''
  };
}

// ══════════════════════════════════════════════════════
//  ESTADO LOCAL & RENDERIZAÇÃO
// ══════════════════════════════════════════════════════
let expenses  = [];
let donutChart = null;

const COLORS = {
  Casa: '#7B6EF6', Alimentacao: '#F5A623', Transporte: '#1ED8A0',
  Lazer: '#60C3F9', Saude: '#F96060', Educacao: '#C9A4FF',
  Vestuario: '#FF8FAB', GastosAdversos: '#FF6B35', Outros: '#8A90AB'
};
const ICONS = {
  Casa: '🏠', Alimentacao: '🍔', Transporte: '🚗', Lazer: '🎮',
  Saude: '💊', Educacao: '📚', Vestuario: '👗', GastosAdversos: '⚠️', Outros: '📁'
};

function deptColor(d) { return COLORS[d] || COLORS['Outros']; }
function fmtBRL(v)    { return 'R$ ' + Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d)   { if(!d) return '—'; try { const [y,m,dd]=d.split('T')[0].split('-'); return `${dd}/${m}/${y}`; } catch{ return d; } }

function setApiStatus(state) {
  const el  = document.getElementById('api-status');
  const txt = document.getElementById('api-status-txt');
  if(!el || !txt) return;
  el.className = 'api-status ' + state;
  txt.textContent = state === 'ok' ? 'API online' : state === 'err' ? 'API offline' : 'Sincronizando...';
}

function getDeptTotals() {
  return expenses.reduce((acc,e) => { acc[e.departamento] = (acc[e.departamento]||0) + e.valor; return acc; }, {});
}

function renderStats() {
  const total = expenses.reduce((s,e) => s + e.valor, 0);
  const depts = Object.keys(getDeptTotals()).length;
  const maxE  = expenses.length ? expenses.reduce((a,b) => a.valor > b.valor ? a : b) : null;
  
  document.getElementById('stat-total').textContent = fmtBRL(total);
  document.getElementById('stat-total-sub').innerHTML = `<b>${expenses.length} lançamentos</b> registrados`;
  document.getElementById('stat-depts').textContent   = depts;
  document.getElementById('stat-count').textContent   = expenses.length;
  document.getElementById('stat-max').textContent     = maxE ? fmtBRL(maxE.valor) : 'R$ 0';
  document.getElementById('stat-max-dept').textContent = maxE ? maxE.departamento : '—';
  document.getElementById('donut-total').textContent  = fmtBRL(total);
}

function renderChart() {
  const map    = getDeptTotals();
  const labels = Object.keys(map);
  const data   = Object.values(map);
  const colors = labels.map(deptColor);

  const canvas = document.getElementById('donutChart');
  if(!canvas) return;

  if (donutChart) {
    donutChart.data.labels = labels;
    donutChart.data.datasets[0].data   = data;
    donutChart.data.datasets[0].backgroundColor = colors;
    donutChart.update();
  } else {
    donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets:[{ data, backgroundColor:colors, borderWidth:2, borderColor:'#13161F', hoverBorderColor:'#13161F' }] },
      options: { responsive:true, maintainAspectRatio:false, cutout:'68%',
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${fmtBRL(ctx.raw)}` } } }
      }
    });
  }

  // Previne erro visual na legenda quando apaga todos os gastos
  const elLegend = document.getElementById('legend');
  if(data.length === 0) {
      elLegend.innerHTML = '<div style="font-size: 13px; color: var(--text-lo); text-align: center; padding-top: 20px;">Nenhum dado para o gráfico.</div>';
      return;
  }

  const total = data.reduce((a,b) => a+b, 0);
  elLegend.innerHTML = labels.map((l,i) => {
    const pct = total ? Math.round(data[i]/total*100) : 0;
    return `<div class="legend-item">
      <div class="legend-left"><span class="legend-dot" style="background:${colors[i]}"></span><span class="legend-name">${l}</span></div>
      <div class="legend-right">
        <div class="legend-bar-wrap"><div class="legend-bar" style="width:${pct}%;background:${colors[i]}"></div></div>
        <span class="legend-pct">${pct}%</span>
      </div>
    </div>`;
  }).join('');
}

function renderList() {
  const badge = document.getElementById('recent-count-badge');
  const el    = document.getElementById('expense-list');
  
  if(badge) badge.textContent = `${expenses.length} registros`;

  if (!expenses.length) {
    el.innerHTML = '<div class="empty">Nenhum gasto registrado ainda.<br>Adicione um novo gasto ↓</div>';
    return;
  }

  // Ordena para os mais novos aparecerem em cima
  const sorted = [...expenses].sort((a,b) => (b.id||0)-(a.id||0));

  el.innerHTML = sorted.map(e => {
    const c = deptColor(e.departamento);
    return `<div class="expense-item" id="row-${e.id}">
      <div class="exp-icon" style="background:${c}22">${ICONS[e.departamento]||'📁'}</div>
      <div class="exp-info">
        <div class="exp-name">${e.descricao}</div>
        <div class="exp-meta">${e.categoria}<span class="exp-dept" style="background:${c}22;color:${c}">${e.departamento}</span></div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="exp-amount" style="color:${c}">${fmtBRL(e.valor)}</div>
        <div class="exp-date">${fmtDate(e.data)}</div>
      </div>
      <div class="exp-actions">
        <div class="confirm-bar" id="confirm-${e.id}">
          Remover?
          <button class="btn-yes" onclick="confirmDelete(${e.id})">Sim</button>
          <button class="btn-no"  onclick="cancelDelete(${e.id})">Não</button>
        </div>
        <button class="btn-del" title="Excluir lançamento" onclick="askDelete(${e.id})">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderRanking() {
  const map    = getDeptTotals();
  const ranked = Object.entries(map).sort((a,b) => b[1]-a[1]);
  const max    = ranked[0]?.[1] || 1;
  const el     = document.getElementById('dept-ranking');
  
  if (!ranked.length) { el.innerHTML = '<div class="empty">Sem dados disponíveis.</div>'; return; }
  
  el.innerHTML = ranked.map(([dept,val]) => {
    const pct = Math.round(val/max*100);
    const c   = deptColor(dept);
    return `<div class="dept-item">
      <div class="dept-row">
        <span class="dept-name">${ICONS[dept]||'📁'} ${dept}</span>
        <span class="dept-val">${fmtBRL(val)}</span>
      </div>
      <div class="dept-track"><div class="dept-fill" style="width:${pct}%;background:${c}"></div></div>
    </div>`;
  }).join('');
}

function renderAll() { renderStats(); renderChart(); renderList(); renderRanking(); }

// ══════════════════════════════════════════════════════
//  OPERAÇÕES CRUD (Totalmente sincronizadas com a Render)
// ══════════════════════════════════════════════════════
async function loadExpenses() {
  setApiStatus('wait');
  try {
    const raw  = await Api.listar();
    const list = Array.isArray(raw) ? raw : (raw.content ?? raw.data ?? []);
    expenses   = list.map(normalizar);
    setApiStatus('ok');
    renderAll();
  } catch (err) {
    setApiStatus('err');
    showToast('Falha ao sincronizar com o servidor.', true);
  }
}

async function handleSubmit() {
  const desc  = document.getElementById('f-desc').value.trim();
  const valor = parseFloat(document.getElementById('f-valor').value);
  const dept  = document.getElementById('f-dept').value;
  const cat   = document.getElementById('f-cat').value;
  const data  = document.getElementById('f-data').value;

  if (!desc || isNaN(valor) || valor <= 0 || !dept) {
    showToast('⚠️ Preencha descrição, valor e categoria.', true);
    return;
  }

  const payload = { 
    itemBought: desc, 
    price: valor, 
    category: dept, 
    paymentMethod: cat, 
    date: data 
  };

  setBtnLoading(true);
  try {
    await Api.criar(payload);
    await loadExpenses(); // <-- MÁGICA 1: Puxa do banco atualizado instantaneamente!
    showToast('Gasto salvo e sincronizado!');
    resetForm();
  } catch (err) {
    showToast(`Erro ao salvar: ${err.message}`, true);
  } finally {
    setBtnLoading(false);
  }
}

// ── FLUXO DE REMOÇÃO VISUAL E LÓGICO ──
function askDelete(id) {
  // Esconde outros abertos
  document.querySelectorAll('.confirm-bar.show').forEach(el => {
    if (el.id !== `confirm-${id}`) el.classList.remove('show');
  });
  
  const bar = document.getElementById(`confirm-${id}`);
  const btn = bar?.nextElementSibling; 
  if (!bar) return;
  
  const isOpen = bar.classList.toggle('show');
  if (btn) btn.style.display = isOpen ? 'none' : 'flex';
}

function cancelDelete(id) {
  const bar = document.getElementById(`confirm-${id}`);
  const btn = bar?.nextElementSibling;
  if (bar) bar.classList.remove('show');
  if (btn) btn.style.display = 'flex';
}

async function confirmDelete(id) {
  const row = document.getElementById(`row-${id}`);
  if (row) { 
    // Animação de saída elegante
    row.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; 
    row.style.opacity = '0'; 
    row.style.transform = 'translateX(20px)'; 
  }
  
  // Aguarda a animação terminar antes de chamar a API
  await new Promise(r => setTimeout(r, 300));
  await handleDelete(id);
}

async function handleDelete(id) {
  // Se o ID for inválido, bloqueia antes de mandar pro Java
  if (id === undefined || id === null || id === 'undefined' || id === 'null') {
      showToast('Erro no código: ID não encontrado na tela.', true);
      return;
  }
  
  setApiStatus('wait');
  try {
    await Api.excluir(id);
    await loadExpenses(); // A mágica da sincronização total
    showToast('Lançamento removido do banco de dados.');
  } catch (err) {
    showToast(`Erro ao excluir: Falha na conexão.`, true);
    renderList(); 
  }
}

// ══════════════════════════════════════════════════════
//  HELPERS DE UI E INICIALIZAÇÃO
// ══════════════════════════════════════════════════════
function showToast(msg, isErr=false) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toast-msg').textContent = msg;
  t.className = 'toast show' + (isErr ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function setBtnLoading(loading) {
  const btn = document.getElementById('btn-submit');
  if(!btn) return;
  btn.disabled   = loading;
  btn.textContent = loading ? 'Salvando na Nuvem…' : 'Registrar Gasto';
}

function resetForm() {
  ['f-desc','f-valor','f-dept','f-cat'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
  });
  const dataEl = document.getElementById('f-data');
  if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
}

function scrollToForm() {
  document.getElementById('form-section').scrollIntoView({ behavior:'smooth', block:'center' });
  setTimeout(() => document.getElementById('f-desc').focus(), 400);
}

// Inicialização de datas e carregamento inicial
document.getElementById('current-date').textContent = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
const fDataInit = document.getElementById('f-data');
if(fDataInit) fDataInit.value = new Date().toISOString().split('T')[0];

// Inicia a aplicação puxando tudo do usuário logado
loadExpenses();
