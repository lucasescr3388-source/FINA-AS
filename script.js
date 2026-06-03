/* ===================================
   FINARA — script.js
   =================================== */

'use strict';

/* ─────────────────────────────────────
   DATA LAYER
───────────────────────────────────── */
const DB = {
  get transactions() { return JSON.parse(localStorage.getItem('fn_transactions') || '[]'); },
  set transactions(v) { localStorage.setItem('fn_transactions', JSON.stringify(v)); },
  get goals()        { return JSON.parse(localStorage.getItem('fn_goals')        || '[]'); },
  set goals(v)       { localStorage.setItem('fn_goals', JSON.stringify(v)); },
  get theme()        { return localStorage.getItem('fn_theme') || 'light'; },
  set theme(v)       { localStorage.setItem('fn_theme', v); },
};

/* ─────────────────────────────────────
   CATEGORIES
───────────────────────────────────── */
const CATS = {
  receita: ['Salário','Freelance','Vendas','Outros'],
  despesa: ['Alimentação','Transporte','Moradia','Estudos','Arte','Lazer','Saúde','Outros'],
};
const CAT_ICONS = {
  Salário:'💼', Freelance:'💻', Vendas:'🛒', Outros:'📦',
  Alimentação:'🍽️', Transporte:'🚗', Moradia:'🏠', Estudos:'📚',
  Arte:'🎨', Lazer:'🎮', Saúde:'💊',
};
function catIcon(c) { return CAT_ICONS[c] || '📦'; }

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */
const fmt  = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n || 0);
const uid  = () => Math.random().toString(36).slice(2,10);
const now  = () => new Date().toISOString().split('T')[0];

function currentYM() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}
function txInMonth(tx, y, m) {
  const d = new Date(tx.date + 'T00:00:00');
  return d.getFullYear() === y && d.getMonth() === m;
}

function monthLabel(offsetMonths = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
}

/* ─────────────────────────────────────
   CHART INSTANCES
───────────────────────────────────── */
let pieChartInst       = null;
let barChartInst       = null;
let reportPieChartInst = null;
let reportBarChartInst = null;

/* ─────────────────────────────────────
   CHART COLORS
───────────────────────────────────── */
const PALETTE = [
  '#4f80ff','#f43f5e','#10b981','#f59e0b','#8b5cf6',
  '#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1',
];

function chartDefaults() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    gridColor: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)',
    textColor: dark ? '#7a90b8' : '#9aabcc',
  };
}

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(DB.theme);
  setCurrentMonth();
  initNav();
  initMobileMenu();
  initLancamentosPage();
  initMetasPage();
  renderAll();
});

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderGoals();
  renderReports();
}

/* ─────────────────────────────────────
   CURRENT MONTH LABEL
───────────────────────────────────── */
function setCurrentMonth() {
  const el = document.getElementById('currentMonth');
  if (el) el.textContent = new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
}

/* ─────────────────────────────────────
   NAVIGATION
───────────────────────────────────── */
const PAGE_TITLES = {
  dashboard:'Dashboard', lancamentos:'Lançamentos',
  metas:'Metas', relatorios:'Relatórios', configuracoes:'Configurações',
};

function initNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
      // close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || page;

  if (page === 'relatorios') renderReports();
  if (page === 'dashboard')  renderDashboard();
}

/* ─────────────────────────────────────
   MOBILE MENU
───────────────────────────────────── */
function initMobileMenu() {
  const btn     = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

/* ─────────────────────────────────────
   DASHBOARD
───────────────────────────────────── */
function renderDashboard() {
  const { y, m }  = currentYM();
  const txs       = DB.transactions;
  const monthTxs  = txs.filter(t => txInMonth(t, y, m));

  const income  = monthTxs.filter(t => t.type === 'receita').reduce((s,t) => s + t.amount, 0);
  const expense = monthTxs.filter(t => t.type === 'despesa').reduce((s,t) => s + t.amount, 0);
  const savings = income - expense;

  // Total balance (all time)
  const totalIncome  = txs.filter(t => t.type === 'receita').reduce((s,t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === 'despesa').reduce((s,t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  setText('kpiBalance',  fmt(balance));
  setText('kpiIncome',   fmt(income));
  setText('kpiExpense',  fmt(expense));
  setText('kpiSavings',  fmt(savings));

  // Main goal
  renderMainGoal();

  // Intelligence
  renderIntel(income, expense, savings, monthTxs, txs, y, m);

  // Charts
  renderPieChart(monthTxs);
  renderBarChart(txs);
}

function renderMainGoal() {
  const goals = DB.goals;
  if (!goals.length) {
    setText('mainGoalName', 'Nenhuma meta criada');
    setText('mainGoalCurrent', fmt(0));
    setText('mainGoalTarget',  'de ' + fmt(0));
    setText('mainGoalPct', '0%');
    setStyle('mainGoalFill', 'width', '0%');
    return;
  }
  const g   = goals[0];
  const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  setText('mainGoalName',    g.name);
  setText('mainGoalCurrent', fmt(g.current));
  setText('mainGoalTarget',  'de ' + fmt(g.target));
  setText('mainGoalPct',     pct + '%');
  setStyle('mainGoalFill',   'width', pct + '%');
}

/* ─────────────────────────────────────
   INTELLIGENCE MESSAGES
───────────────────────────────────── */
function renderIntel(income, expense, savings, monthTxs, allTxs, y, m) {
  const msgs = [];

  // Top expense category
  if (monthTxs.length) {
    const catTotals = {};
    monthTxs.filter(t => t.type === 'despesa').forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });
    const top = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0];
    if (top) msgs.push(`🍽️ Você gastou mais com <b>${top[0]}</b> este mês (${fmt(top[1])}).`);
  }

  // Compare savings to last month
  const prevDate = new Date(y, m - 1, 1);
  const py = prevDate.getFullYear(), pm = prevDate.getMonth();
  const prevMonth = allTxs.filter(t => txInMonth(t, py, pm));
  const prevIncome  = prevMonth.filter(t => t.type==='receita').reduce((s,t)=>s+t.amount,0);
  const prevExpense = prevMonth.filter(t => t.type==='despesa').reduce((s,t)=>s+t.amount,0);
  const prevSavings = prevIncome - prevExpense;

  if (prevSavings !== 0 && savings !== 0) {
    const diff = Math.round(((savings - prevSavings) / Math.abs(prevSavings)) * 100);
    if (diff > 0)
      msgs.push(`📈 Sua economia aumentou <b>${diff}%</b> em relação ao mês anterior.`);
    else if (diff < 0)
      msgs.push(`📉 Sua economia caiu <b>${Math.abs(diff)}%</b> em relação ao mês anterior.`);
  }

  // Goal progress
  const goals = DB.goals;
  if (goals.length) {
    const g   = goals[0];
    const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
    if (pct >= 100)      msgs.push(`🎉 Parabéns! Você atingiu a meta <b>${g.name}</b>!`);
    else if (pct >= 80)  msgs.push(`🎯 Você está em <b>${pct}%</b> da meta "${g.name}". Quase lá!`);
    else if (pct > 0)    msgs.push(`🎯 Progresso da meta <b>${g.name}</b>: ${pct}%.`);
  }

  // Expense > income warning
  if (expense > income && income > 0)
    msgs.push(`⚠️ Suas despesas (<b>${fmt(expense)}</b>) superaram as receitas este mês.`);

  if (!msgs.length) msgs.push('💡 Adicione lançamentos para receber insights financeiros personalizados.');

  const banner = document.getElementById('intelBanner');
  const msgEl  = document.getElementById('intelMessage');
  if (!banner || !msgEl) return;

  let i = 0;
  msgEl.innerHTML = msgs[i];
  if (msgs.length > 1) {
    clearInterval(banner._interval);
    banner._interval = setInterval(() => {
      i = (i + 1) % msgs.length;
      msgEl.style.opacity = '0';
      setTimeout(() => { msgEl.innerHTML = msgs[i]; msgEl.style.opacity = '1'; }, 200);
    }, 4000);
  }
}

/* ─────────────────────────────────────
   PIE CHART (Dashboard)
───────────────────────────────────── */
function renderPieChart(monthTxs) {
  const catTotals = {};
  monthTxs.filter(t => t.type === 'despesa').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(catTotals);
  const data   = Object.values(catTotals);
  const empty  = document.getElementById('pieEmpty');
  const canvas = document.getElementById('pieChart');

  if (!labels.length) {
    if (empty) empty.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (canvas) canvas.style.display = 'block';

  if (pieChartInst) pieChartInst.destroy();
  const { textColor } = chartDefaults();
  pieChartInst = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: PALETTE, borderWidth: 2,
        borderColor: document.documentElement.dataset.theme === 'dark' ? '#111f3a' : '#fff' }],
    },
    options: {
      cutout: '66%',
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, padding: 14, font:{ size:11, family:"'DM Sans'" }, boxWidth:10, usePointStyle:true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}` } },
      },
      animation: { animateRotate: true, duration: 600 },
    },
  });
}

/* ─────────────────────────────────────
   BAR CHART (Dashboard)
───────────────────────────────────── */
function renderBarChart(allTxs) {
  const months = [];
  const incomes = [], expenses = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(); d.setMonth(d.getMonth() + i);
    const y = d.getFullYear(), mo = d.getMonth();
    const txs = allTxs.filter(t => txInMonth(t, y, mo));
    months.push(monthLabel(i));
    incomes.push(txs.filter(t=>t.type==='receita').reduce((s,t)=>s+t.amount,0));
    expenses.push(txs.filter(t=>t.type==='despesa').reduce((s,t)=>s+t.amount,0));
  }

  const canvas = document.getElementById('barChart');
  if (!canvas) return;
  if (barChartInst) barChartInst.destroy();
  const { gridColor, textColor } = chartDefaults();

  barChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label:'Receitas', data:incomes,  backgroundColor:'rgba(16,185,129,.75)', borderRadius:6, borderSkipped:false },
        { label:'Despesas', data:expenses, backgroundColor:'rgba(244,63,94,.75)',  borderRadius:6, borderSkipped:false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ labels:{ color:textColor, font:{size:11,family:"'DM Sans'"}, usePointStyle:true, padding:14 } },
        tooltip:{ callbacks:{ label:ctx=>` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid:{ color:gridColor }, ticks:{ color:textColor, font:{size:11} } },
        y: { grid:{ color:gridColor }, ticks:{ color:textColor, font:{size:11}, callback:v=>'R$ '+v.toLocaleString('pt-BR') } },
      },
      animation: { duration: 600 },
    },
  });
}

/* ─────────────────────────────────────
   LANÇAMENTOS PAGE
───────────────────────────────────── */
let activeFilter = 'all';
let currentType  = 'receita';
let editingId    = null;

function initLancamentosPage() {
  document.getElementById('btnNovoLancamento').addEventListener('click', () => openLancamento());
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderTransactions();
    });
  });
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => setType(btn.dataset.type));
  });
}

function setType(type) {
  currentType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  populateCategories(type);
}

function populateCategories(type) {
  const sel = document.getElementById('lancCategoria');
  sel.innerHTML = CATS[type].map(c => `<option value="${c}">${c}</option>`).join('');
}

function openLancamento(id = null) {
  editingId = id;
  const tx = id ? DB.transactions.find(t => t.id === id) : null;

  setText('modalLancTitle', id ? 'Editar Lançamento' : 'Novo Lançamento');
  document.getElementById('lancId').value       = id || '';
  document.getElementById('lancValor').value    = tx ? tx.amount : '';
  document.getElementById('lancDesc').value     = tx ? tx.description : '';
  document.getElementById('lancData').value     = tx ? tx.date : now();

  const type = tx ? tx.type : 'receita';
  setType(type);
  if (tx) document.getElementById('lancCategoria').value = tx.category;

  openModal('modalLancamento');
}

function saveLancamento() {
  const valor = parseFloat(document.getElementById('lancValor').value);
  const desc  = document.getElementById('lancDesc').value.trim();
  const cat   = document.getElementById('lancCategoria').value;
  const date  = document.getElementById('lancData').value;

  if (!valor || valor <= 0)    { showToast('Informe um valor válido'); return; }
  if (!desc)                   { showToast('Adicione uma descrição');  return; }
  if (!date)                   { showToast('Selecione a data');        return; }

  const txs = DB.transactions;
  if (editingId) {
    const idx = txs.findIndex(t => t.id === editingId);
    if (idx !== -1) txs[idx] = { ...txs[idx], type:currentType, amount:valor, category:cat, description:desc, date };
  } else {
    txs.unshift({ id:uid(), type:currentType, amount:valor, category:cat, description:desc, date, createdAt:Date.now() });
  }
  DB.transactions = txs;
  closeModal('modalLancamento');
  renderAll();
  showToast(editingId ? 'Lançamento atualizado ✓' : 'Lançamento salvo ✓');
}

function deleteTx(id) {
  if (!confirm('Excluir este lançamento?')) return;
  DB.transactions = DB.transactions.filter(t => t.id !== id);
  renderAll();
  showToast('Lançamento removido');
}

function renderTransactions() {
  const list = document.getElementById('transactionsList');
  let txs = [...DB.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
  if (activeFilter !== 'all') txs = txs.filter(t => t.type === activeFilter);

  if (!txs.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${activeFilter==='receita'?'💰':activeFilter==='despesa'?'💸':'💳'}</div>
      <div class="empty-title">Nenhum lançamento encontrado</div>
      <div class="empty-sub">Clique em "Novo Lançamento" para adicionar</div>
    </div>`;
    return;
  }

  list.innerHTML = txs.map(t => `
    <div class="transaction-item" data-id="${t.id}">
      <div class="tx-icon ${t.type==='receita'?'income-icon':'expense-icon'}">${catIcon(t.category)}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.description)}</div>
        <div class="tx-cat">${t.category}</div>
      </div>
      <div class="tx-date">${fmtDate(t.date)}</div>
      <div class="tx-amount ${t.type==='receita'?'income':'expense'}">
        ${t.type==='receita'?'+':'−'} ${fmt(t.amount)}
      </div>
      <div class="tx-actions">
        <button class="tx-btn" onclick="openLancamento('${t.id}')" title="Editar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="tx-btn" onclick="deleteTx('${t.id}')" title="Excluir">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

/* ─────────────────────────────────────
   METAS PAGE
───────────────────────────────────── */
let editingMetaId = null;

function initMetasPage() {
  document.getElementById('btnNovaMeta').addEventListener('click', () => openMeta());
}

function openMeta(id = null) {
  editingMetaId = id;
  const g = id ? DB.goals.find(g => g.id === id) : null;

  setText('modalMetaTitle', id ? 'Editar Meta' : 'Nova Meta');
  document.getElementById('metaId').value            = id || '';
  document.getElementById('metaNome').value          = g ? g.name    : '';
  document.getElementById('metaValorDesejado').value = g ? g.target  : '';
  document.getElementById('metaValorAtual').value    = g ? g.current : '';
  document.getElementById('metaPrazo').value         = g ? g.deadline : '';

  openModal('modalMeta');
}

function saveMeta() {
  const nome    = document.getElementById('metaNome').value.trim();
  const target  = parseFloat(document.getElementById('metaValorDesejado').value);
  const current = parseFloat(document.getElementById('metaValorAtual').value) || 0;
  const deadline= document.getElementById('metaPrazo').value;

  if (!nome)              { showToast('Dê um nome à meta'); return; }
  if (!target || target<=0) { showToast('Informe o valor desejado'); return; }

  const goals = DB.goals;
  if (editingMetaId) {
    const idx = goals.findIndex(g => g.id === editingMetaId);
    if (idx !== -1) goals[idx] = { ...goals[idx], name:nome, target, current, deadline };
  } else {
    goals.unshift({ id:uid(), name:nome, target, current, deadline, createdAt:Date.now() });
  }
  DB.goals = goals;
  closeModal('modalMeta');
  renderAll();
  showToast(editingMetaId ? 'Meta atualizada ✓' : 'Meta criada ✓');
}

function deleteMeta(id) {
  if (!confirm('Excluir esta meta?')) return;
  DB.goals = DB.goals.filter(g => g.id !== id);
  renderAll();
  showToast('Meta removida');
}

function renderGoals() {
  const container = document.getElementById('goalsList');
  const goals = DB.goals;

  if (!goals.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎯</div>
      <div class="empty-title">Nenhuma meta criada</div>
      <div class="empty-sub">Defina um objetivo financeiro para começar</div>
    </div>`;
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct       = g.target > 0 ? Math.min(100, Math.round((g.current/g.target)*100)) : 0;
    const remaining = Math.max(0, g.target - g.current);
    const deadlineStr = g.deadline ? `Prazo: ${fmtDate(g.deadline)}` : 'Sem prazo definido';
    const color = pct >= 100 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#4f80ff';

    return `
    <div class="goal-card">
      <div class="goal-card-header">
        <div>
          <div class="goal-card-name">${esc(g.name)}</div>
          <div class="goal-card-deadline">${deadlineStr}</div>
        </div>
        <div class="goal-card-actions">
          <button class="tx-btn" onclick="openMeta('${g.id}')" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="tx-btn" onclick="deleteMeta('${g.id}')" title="Excluir">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="goal-amounts-row">
        <div class="goal-current-val">${fmt(g.current)}</div>
        <div class="goal-target-val">meta: ${fmt(g.target)}</div>
      </div>
      <div class="goal-progress-wrap">
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="goal-pct" style="color:${color}">${pct}%</span>
      </div>
      <div class="goal-remaining">Faltam ${fmt(remaining)}</div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────
   RELATÓRIOS PAGE
───────────────────────────────────── */
function renderReports() {
  const txs = DB.transactions;
  const totalIncome  = txs.filter(t=>t.type==='receita').reduce((s,t)=>s+t.amount,0);
  const totalExpense = txs.filter(t=>t.type==='despesa').reduce((s,t)=>s+t.amount,0);
  const totalSavings = totalIncome - totalExpense;

  setText('rptIncome',  fmt(totalIncome));
  setText('rptExpense', fmt(totalExpense));
  setText('rptSavings', fmt(totalSavings));

  // Top category
  const catTotals = {};
  txs.filter(t=>t.type==='despesa').forEach(t=>{
    catTotals[t.category] = (catTotals[t.category]||0)+t.amount;
  });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  setText('rptTopCat', topCat ? `${catIcon(topCat[0])} ${topCat[0]}` : '—');

  // Pie
  const canvas2 = document.getElementById('reportPieChart');
  const empty2  = document.getElementById('reportPieEmpty');
  if (Object.keys(catTotals).length) {
    if (empty2) empty2.style.display = 'none';
    if (canvas2) canvas2.style.display = 'block';
    if (reportPieChartInst) reportPieChartInst.destroy();
    const { textColor } = chartDefaults();
    reportPieChartInst = new Chart(canvas2, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catTotals),
        datasets: [{ data:Object.values(catTotals), backgroundColor:PALETTE, borderWidth:2,
          borderColor: document.documentElement.dataset.theme==='dark'?'#111f3a':'#fff' }],
      },
      options: {
        cutout:'66%',
        plugins:{
          legend:{position:'bottom',labels:{color:textColor,padding:14,font:{size:11,family:"'DM Sans'"},boxWidth:10,usePointStyle:true}},
          tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.parsed)}`}},
        },
        animation:{animateRotate:true,duration:600},
      },
    });
  } else {
    if (empty2) empty2.style.display = 'block';
    if (canvas2) canvas2.style.display = 'none';
  }

  // Bar — all months with data
  const allMonths = {};
  txs.forEach(t => {
    const d = new Date(t.date+'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!allMonths[key]) allMonths[key] = {income:0,expense:0};
    if (t.type==='receita') allMonths[key].income  += t.amount;
    else                    allMonths[key].expense += t.amount;
  });

  // Fill last 6 months
  if (!Object.keys(allMonths).length) {
    for (let i=-5;i<=0;i++) {
      const d=new Date(); d.setMonth(d.getMonth()+i);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      allMonths[key]={income:0,expense:0};
    }
  }
  const sortedKeys = Object.keys(allMonths).sort();
  const rLabels  = sortedKeys.map(k=>{ const[y,m]=k.split('-'); return new Date(+y,+m-1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}); });
  const rIncomes  = sortedKeys.map(k=>allMonths[k].income);
  const rExpenses = sortedKeys.map(k=>allMonths[k].expense);

  const canvas3 = document.getElementById('reportBarChart');
  if (!canvas3) return;
  if (reportBarChartInst) reportBarChartInst.destroy();
  const { gridColor, textColor } = chartDefaults();
  reportBarChartInst = new Chart(canvas3, {
    type:'bar',
    data:{
      labels:rLabels,
      datasets:[
        {label:'Receitas',data:rIncomes, backgroundColor:'rgba(16,185,129,.75)',borderRadius:6,borderSkipped:false},
        {label:'Despesas',data:rExpenses,backgroundColor:'rgba(244,63,94,.75)', borderRadius:6,borderSkipped:false},
      ],
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:textColor,font:{size:11,family:"'DM Sans'"},usePointStyle:true,padding:14}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`}},
      },
      scales:{
        x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}},
        y:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11},callback:v=>'R$ '+v.toLocaleString('pt-BR')}},
      },
      animation:{duration:600},
    },
  });
}

/* ─────────────────────────────────────
   SETTINGS
───────────────────────────────────── */
function setTheme(theme) {
  DB.theme = theme;
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.getElementById('btnThemeLight')?.classList.toggle('active', theme==='light');
  document.getElementById('btnThemeDark')?.classList.toggle('active',  theme==='dark');
  // Re-render charts for correct colors
  setTimeout(() => {
    renderPieChart(DB.transactions.filter(t => txInMonth(t, currentYM().y, currentYM().m)));
    renderBarChart(DB.transactions);
    if (document.getElementById('page-relatorios').classList.contains('active')) renderReports();
  }, 50);
}

function exportBackup() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: DB.transactions,
    goals: DB.goals,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `finara-backup-${now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exportado ✓');
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.transactions) throw new Error('Formato inválido');
      DB.transactions = data.transactions;
      if (data.goals) DB.goals = data.goals;
      renderAll();
      showToast('Backup importado ✓');
    } catch {
      showToast('Arquivo inválido');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function clearData() {
  if (!confirm('Tem certeza? Todos os lançamentos e metas serão removidos permanentemente.')) return;
  DB.transactions = [];
  DB.goals = [];
  renderAll();
  showToast('Dados removidos');
}

/* ─────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  el.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.style.display = 'none';
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

/* ─────────────────────────────────────
   TOAST
───────────────────────────────────── */
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ─────────────────────────────────────
   UTILITY
───────────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
}
function setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}
