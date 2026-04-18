// ============================================================
// FOLIA — Personal Budget Tracker
// TypeScript-style JS with full type annotations via JSDoc
// ============================================================

// ===== MODELS =====
/**
 * @typedef {'income'|'expense'} TxType
 * @typedef {'Food'|'Transport'|'Bills'|'Shopping'|'Health'|'Entertainment'|'Education'|'Salary'|'Freelance'|'Investment'|'Other'} Category
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} title
 * @property {number} amount
 * @property {Category} category
 * @property {string} date  // ISO
 * @property {TxType} type
 * @property {string} [note]
 * @property {boolean} [recurring]
 */

/**
 * @typedef {Object} Budget
 * @property {Category} category
 * @property {number} limit
 */

/**
 * @typedef {Object} SavingsGoal
 * @property {string} id
 * @property {string} name
 * @property {number} target
 * @property {number} saved
 * @property {string} [deadline]
 * @property {string} emoji
 */

// ===== CONSTANTS =====
const CATEGORIES = [
  { name: 'Food', icon: '🍜', color: '#f97316' },
  { name: 'Transport', icon: '🚌', color: '#3b82f6' },
  { name: 'Bills', icon: '⚡', color: '#8b5cf6' },
  { name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { name: 'Health', icon: '🏥', color: '#ef4444' },
  { name: 'Entertainment', icon: '🎬', color: '#f59e0b' },
  { name: 'Education', icon: '📚', color: '#06b6d4' },
  { name: 'Salary', icon: '💼', color: '#10b981' },
  { name: 'Freelance', icon: '💻', color: '#6366f1' },
  { name: 'Investment', icon: '📈', color: '#84cc16' },
  { name: 'Other', icon: '◦', color: '#6b7280' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.name, c]));
const CURRENCY = '৳';

// ===== STATE =====
/** @type {Transaction[]} */
let transactions = [];
/** @type {Budget[]} */
let budgets = [];
/** @type {SavingsGoal[]} */
let goals = [];
let currentPage = 'dashboard';
let chartInstances = {};
let activeTxType = 'expense';
let txEditId = null;
let goalEditId = null;

// ===== STORAGE UTILS =====
const Storage = {
  load() {
    transactions = JSON.parse(localStorage.getItem('folia_transactions') || '[]');
    budgets = JSON.parse(localStorage.getItem('folia_budgets') || '[]');
    goals = JSON.parse(localStorage.getItem('folia_goals') || '[]');
    const theme = localStorage.getItem('folia_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  },
  save() {
    localStorage.setItem('folia_transactions', JSON.stringify(transactions));
    localStorage.setItem('folia_budgets', JSON.stringify(budgets));
    localStorage.setItem('folia_goals', JSON.stringify(goals));
  },
};

// ===== UTILS =====
const Utils = {
  /** @returns {string} */
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2),

  /** @param {number} n @returns {string} */
  fmt: (n) => CURRENCY + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

  /** @param {string} d @returns {string} */
  fmtDate: (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),

  /** @param {string} d @returns {string} iso month */
  monthOf: (d) => d.slice(0, 7),

  /** @returns {string} */
  today: () => new Date().toISOString().slice(0, 10),

  /** @returns {string} */
  currentMonth: () => new Date().toISOString().slice(0, 7),

  /** @param {string} hex @param {number} a @returns {string} */
  hexAlpha: (hex, a) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  },

  destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  },
};

// ===== TOAST =====
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ===== NAVIGATION =====
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  renderPage(page);
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

function renderPage(page) {
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'budgets': renderBudgets(); break;
    case 'analytics': renderAnalytics(); break;
    case 'savings': renderSavings(); break;
  }
}

// ===== DASHBOARD =====
function renderDashboard() {
  const month = Utils.currentMonth();
  const monthTx = transactions.filter(t => t.date.startsWith(month));

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;
  const incomeCount = transactions.filter(t => t.type === 'income').length;
  const expenseCount = transactions.filter(t => t.type === 'expense').length;

  document.getElementById('totalBalance').textContent = Utils.fmt(balance);
  document.getElementById('totalIncome').textContent = Utils.fmt(totalIncome);
  document.getElementById('totalExpenses').textContent = Utils.fmt(totalExpenses);
  document.getElementById('savingsRate').textContent = savingsRate + '%';
  document.getElementById('incomeCount').textContent = incomeCount + ' transactions';
  document.getElementById('expenseCount').textContent = expenseCount + ' transactions';

  // Month label
  document.getElementById('currentMonthLabel').textContent =
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Recent 5 transactions
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  renderTxList('recentTransactions', recent, false);

  renderTrendChart();
  renderDonutChart();
}

// ===== TREND CHART =====
function renderTrendChart() {
  Utils.destroyChart('trend');
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const months = getLast6Months();
  const incomeData = months.map(m =>
    transactions.filter(t => t.type === 'income' && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0)
  );
  const expenseData = months.map(m =>
    transactions.filter(t => t.type === 'expense' && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0)
  );
  const labels = months.map(m => {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short' });
  });

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#484f58' : '#a0aec0';

  chartInstances['trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#3ddc84',
          backgroundColor: 'rgba(61,220,132,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3ddc84',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#f85149',
          backgroundColor: 'rgba(248,81,73,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f85149',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'DM Mono', size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'DM Mono', size: 11 }, callback: v => CURRENCY + v.toLocaleString() } },
      },
    },
  });
}

function getLast6Months() {
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// ===== DONUT CHART =====
function renderDonutChart() {
  Utils.destroyChart('donut');
  const ctx = document.getElementById('donutChart');
  if (!ctx) return;

  const expenseTx = transactions.filter(t => t.type === 'expense');
  if (!expenseTx.length) return;

  const catTotals = {};
  expenseTx.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([c]) => c);
  const data = sorted.map(([, v]) => v);
  const colors = labels.map(l => CAT_MAP[l]?.color || '#6b7280');

  chartInstances['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${Utils.fmt(ctx.raw)}` } },
      },
    },
  });

  // Custom legend
  const legend = document.getElementById('donutLegend');
  if (legend) {
    const total = data.reduce((s, v) => s + v, 0);
    legend.innerHTML = sorted.slice(0, 6).map(([cat, val]) =>
      `<div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${CAT_MAP[cat]?.color}"></span>
        <span>${CAT_MAP[cat]?.icon || ''} ${cat}</span>
        <span class="donut-legend-val">${Math.round((val / total) * 100)}%</span>
      </div>`
    ).join('');
  }
}

// ===== TRANSACTIONS =====
function renderTransactions() {
  populateCategoryFilter();
  applyFilters();
}

function populateCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  const budgetSel = document.getElementById('budgetCategory');
  const txSel = document.getElementById('txCategory');
  if (sel && sel.children.length <= 1) {
    CATEGORIES.forEach(c => {
      sel.innerHTML += `<option value="${c.name}">${c.icon} ${c.name}</option>`;
    });
  }
  if (budgetSel) {
    budgetSel.innerHTML = CATEGORIES.map(c =>
      `<option value="${c.name}">${c.icon} ${c.name}</option>`
    ).join('');
  }
  if (txSel) {
    txSel.innerHTML = CATEGORIES.map(c =>
      `<option value="${c.name}">${c.icon} ${c.name}</option>`
    ).join('');
  }
}

function applyFilters() {
  const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const cat = document.getElementById('filterCategory')?.value || '';
  const type = document.getElementById('filterType')?.value || '';
  const month = document.getElementById('filterMonth')?.value || '';

  let filtered = [...transactions];
  if (search) filtered = filtered.filter(t => t.title.toLowerCase().includes(search) || t.note?.toLowerCase().includes(search));
  if (cat) filtered = filtered.filter(t => t.category === cat);
  if (type) filtered = filtered.filter(t => t.type === type);
  if (month) filtered = filtered.filter(t => t.date.startsWith(month));
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  renderTxList('allTransactions', filtered, true);
}

/**
 * @param {string} containerId
 * @param {Transaction[]} txs
 * @param {boolean} showActions
 */
function renderTxList(containerId, txs, showActions) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!txs.length) {
    el.innerHTML = '<div class="empty-state">No transactions found.</div>';
    return;
  }
  el.innerHTML = txs.map(t => {
    const cat = CAT_MAP[t.category] || CAT_MAP['Other'];
    return `
    <div class="tx-item" data-id="${t.id}">
      <div class="tx-icon" style="background:${Utils.hexAlpha(cat.color, 0.15)}; font-size:1.1rem">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-title">${escHtml(t.title)}</div>
        <div class="tx-meta">
          <span>${Utils.fmtDate(t.date)}</span>
          <span class="tx-cat-badge">${t.category}</span>
          ${t.recurring ? '<span class="tx-recurring-badge">↻ Monthly</span>' : ''}
          ${t.note ? `<span style="color:var(--text-3);font-style:italic;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.note)}</span>` : ''}
        </div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${Utils.fmt(t.amount)}</div>
      ${showActions ? `
      <div class="tx-actions">
        <button class="tx-action-btn edit" onclick="openEditTx('${t.id}')" title="Edit">✎</button>
        <button class="tx-action-btn" onclick="deleteTx('${t.id}')" title="Delete">✕</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== TRANSACTION CRUD =====
function openNewTx() {
  txEditId = null;
  document.getElementById('txModalTitle').textContent = 'New Transaction';
  document.getElementById('txTitle').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txDate').value = Utils.today();
  document.getElementById('txNote').value = '';
  document.getElementById('txRecurring').checked = false;
  populateCategoryFilter();
  setTxType('expense');
  openModal('txModal');
}

function openEditTx(id) {
  const t = transactions.find(tx => tx.id === id);
  if (!t) return;
  txEditId = id;
  document.getElementById('txModalTitle').textContent = 'Edit Transaction';
  document.getElementById('txTitle').value = t.title;
  document.getElementById('txAmount').value = t.amount;
  document.getElementById('txDate').value = t.date;
  document.getElementById('txNote').value = t.note || '';
  document.getElementById('txRecurring').checked = !!t.recurring;
  populateCategoryFilter();
  document.getElementById('txCategory').value = t.category;
  setTxType(t.type);
  openModal('txModal');
}

function setTxType(type) {
  activeTxType = type;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
}

function saveTx() {
  const title = document.getElementById('txTitle').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const category = document.getElementById('txCategory').value;
  const date = document.getElementById('txDate').value;
  const note = document.getElementById('txNote').value.trim();
  const recurring = document.getElementById('txRecurring').checked;

  if (!title) return showToast('⚠ Please enter a title');
  if (isNaN(amount) || amount <= 0) return showToast('⚠ Enter a valid amount');
  if (!date) return showToast('⚠ Please pick a date');

  if (txEditId) {
    const idx = transactions.findIndex(t => t.id === txEditId);
    if (idx !== -1) {
      transactions[idx] = { ...transactions[idx], title, amount, category, date, note, recurring, type: activeTxType };
      showToast('✓ Transaction updated');
    }
  } else {
    transactions.push({ id: Utils.uid(), title, amount, category, date, note, recurring, type: activeTxType });
    showToast('✓ Transaction added');
  }

  Storage.save();
  closeModal('txModal');
  renderPage(currentPage);
  checkBudgetAlerts();
}

function deleteTx(id) {
  if (!confirm('Delete this transaction?')) return;
  transactions = transactions.filter(t => t.id !== id);
  Storage.save();
  showToast('Transaction deleted');
  renderPage(currentPage);
}

// ===== BUDGETS =====
function renderBudgets() {
  const container = document.getElementById('budgetsGrid');
  const month = Utils.currentMonth();

  if (!budgets.length) {
    container.innerHTML = '<div class="empty-state">No budgets set. Click "+ Set Budget" to begin.</div>';
    return;
  }

  container.innerHTML = budgets.map(b => {
    const cat = CAT_MAP[b.category] || CAT_MAP['Other'];
    const spent = transactions.filter(t => t.type === 'expense' && t.category === b.category && t.date.startsWith(month))
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
    const over = spent > b.limit;
    const warn = !over && pct >= 80;
    const barClass = over ? 'over' : warn ? 'warn' : 'ok';

    return `
    <div class="budget-card">
      <div class="budget-card-header">
        <div class="budget-cat">
          <span style="font-size:1.3rem">${cat.icon}</span>
          <span>${b.category}</span>
        </div>
        <div class="budget-actions">
          <button class="tx-action-btn" onclick="deleteBudget('${b.category}')" title="Remove">✕</button>
        </div>
      </div>
      <div class="budget-bar-wrap">
        <div class="budget-bar ${barClass}" style="width:${pct}%"></div>
      </div>
      <div class="budget-nums">
        <span>${Utils.fmt(spent)} spent</span>
        <span>of ${Utils.fmt(b.limit)}</span>
      </div>
      ${over ? `<div class="budget-alert">⚠ Over budget by ${Utils.fmt(spent - b.limit)}</div>` : ''}
      ${warn ? `<div class="budget-warn-msg">⚡ ${Math.round(pct)}% of budget used</div>` : ''}
    </div>`;
  }).join('');
}

function deleteBudget(category) {
  budgets = budgets.filter(b => b.category !== category);
  Storage.save();
  renderBudgets();
  showToast('Budget removed');
}

function saveBudget() {
  const category = document.getElementById('budgetCategory').value;
  const limit = parseFloat(document.getElementById('budgetAmount').value);
  if (isNaN(limit) || limit <= 0) return showToast('⚠ Enter a valid limit');

  const existing = budgets.findIndex(b => b.category === category);
  if (existing !== -1) {
    budgets[existing].limit = limit;
  } else {
    budgets.push({ category, limit });
  }
  Storage.save();
  closeModal('budgetModal');
  renderBudgets();
  showToast('✓ Budget saved');
}

function checkBudgetAlerts() {
  const month = Utils.currentMonth();
  budgets.forEach(b => {
    const spent = transactions.filter(t => t.type === 'expense' && t.category === b.category && t.date.startsWith(month))
      .reduce((s, t) => s + t.amount, 0);
    if (spent > b.limit) {
      showToast(`⚠ ${b.category} budget exceeded!`, 4000);
    }
  });
}

// ===== ANALYTICS =====
function renderAnalytics() {
  populateYearSelect();
  const year = document.getElementById('analyticsYear')?.value || new Date().getFullYear().toString();
  renderBarChart(year);
  renderCategoryBar(year);
  renderRunningBalance();
}

function populateYearSelect() {
  const sel = document.getElementById('analyticsYear');
  if (!sel) return;
  const years = [...new Set(transactions.map(t => t.date.slice(0, 4)))];
  if (!years.length) years.push(new Date().getFullYear().toString());
  years.sort((a, b) => b.localeCompare(a));
  const current = sel.value || years[0];
  sel.innerHTML = years.map(y => `<option value="${y}" ${y === current ? 'selected' : ''}>${y}</option>`).join('');
}

function renderBarChart(year) {
  Utils.destroyChart('bar');
  const ctx = document.getElementById('barChart');
  if (!ctx) return;

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const labels = months.map(m => new Date(m + '-01').toLocaleString('default', { month: 'short' }));
  const incomeData = months.map(m => transactions.filter(t => t.type === 'income' && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0));
  const expenseData = months.map(m => transactions.filter(t => t.type === 'expense' && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0));

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#484f58' : '#a0aec0';

  chartInstances['bar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income', data: incomeData, backgroundColor: 'rgba(61,220,132,0.7)', borderRadius: 4, borderSkipped: false },
        { label: 'Expenses', data: expenseData, backgroundColor: 'rgba(248,81,73,0.7)', borderRadius: 4, borderSkipped: false },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: textColor, font: { family: 'DM Sans' } } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => CURRENCY + v.toLocaleString() } },
      },
    },
  });
}

function renderCategoryBar(year) {
  Utils.destroyChart('catBar');
  const ctx = document.getElementById('categoryBar');
  if (!ctx) return;

  const catTotals = {};
  transactions.filter(t => t.type === 'expense' && t.date.startsWith(year)).forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([c]) => `${CAT_MAP[c]?.icon || ''} ${c}`);
  const data = sorted.map(([, v]) => v);
  const colors = sorted.map(([c]) => CAT_MAP[c]?.color || '#6b7280');

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#484f58' : '#a0aec0';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  chartInstances['catBar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Spending', data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => CURRENCY + v.toLocaleString() } },
        y: { grid: { display: false }, ticks: { color: textColor } },
      },
    },
  });
}

function renderRunningBalance() {
  Utils.destroyChart('running');
  const ctx = document.getElementById('runningBalance');
  if (!ctx) return;

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return;

  let running = 0;
  const labels = [];
  const data = [];
  sorted.forEach(t => {
    running += t.type === 'income' ? t.amount : -t.amount;
    labels.push(Utils.fmtDate(t.date));
    data.push(parseFloat(running.toFixed(2)));
  });

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#484f58' : '#a0aec0';

  chartInstances['running'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Balance',
        data,
        borderColor: '#58a6ff',
        backgroundColor: 'rgba(88,166,255,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${Utils.fmt(ctx.raw)}` } },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, maxTicksLimit: 8 } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => CURRENCY + v.toLocaleString() } },
      },
    },
  });
}

// ===== SAVINGS GOALS =====
function renderSavings() {
  const container = document.getElementById('goalsGrid');
  if (!goals.length) {
    container.innerHTML = '<div class="empty-state">No savings goals yet. Create one to start tracking!</div>';
    return;
  }
  container.innerHTML = goals.map(g => {
    const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
    const remaining = Math.max(g.target - g.saved, 0);
    const deadline = g.deadline ? `Target: ${Utils.fmtDate(g.deadline)}` : 'No deadline';
    return `
    <div class="goal-card">
      <span class="goal-emoji">${g.emoji || '🎯'}</span>
      <div class="goal-name">${escHtml(g.name)}</div>
      <div class="goal-date">${deadline}</div>
      <div class="goal-progress-bar">
        <div class="goal-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="goal-nums">
        <span>${Utils.fmt(g.saved)} saved</span>
        <span>${Utils.fmt(g.target)} goal</span>
      </div>
      <div class="goal-pct">${pct}% complete</div>
      ${remaining > 0 ? `<div style="font-size:0.75rem;color:var(--text-3);margin-top:0.3rem">${Utils.fmt(remaining)} remaining</div>` : '<div style="font-size:0.75rem;color:var(--accent);margin-top:0.3rem">🎉 Goal reached!</div>'}
      <div class="goal-actions" style="margin-top:1rem">
        <button class="goal-action-btn" onclick="openEditGoal('${g.id}')">Edit</button>
        <button class="goal-action-btn del" onclick="deleteGoal('${g.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function openNewGoal() {
  goalEditId = null;
  document.getElementById('goalModalTitle').textContent = 'New Savings Goal';
  document.getElementById('goalName').value = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalSaved').value = '';
  document.getElementById('goalDate').value = '';
  document.getElementById('goalEmoji').value = '🎯';
  openModal('goalModal');
}

function openEditGoal(id) {
  const g = goals.find(x => x.id === id);
  if (!g) return;
  goalEditId = id;
  document.getElementById('goalModalTitle').textContent = 'Edit Goal';
  document.getElementById('goalName').value = g.name;
  document.getElementById('goalTarget').value = g.target;
  document.getElementById('goalSaved').value = g.saved;
  document.getElementById('goalDate').value = g.deadline || '';
  document.getElementById('goalEmoji').value = g.emoji || '🎯';
  openModal('goalModal');
}

function saveGoal() {
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const saved = parseFloat(document.getElementById('goalSaved').value) || 0;
  const deadline = document.getElementById('goalDate').value;
  const emoji = document.getElementById('goalEmoji').value || '🎯';

  if (!name) return showToast('⚠ Please enter a goal name');
  if (isNaN(target) || target <= 0) return showToast('⚠ Enter a valid target amount');

  if (goalEditId) {
    const idx = goals.findIndex(g => g.id === goalEditId);
    if (idx !== -1) goals[idx] = { ...goals[idx], name, target, saved, deadline, emoji };
    showToast('✓ Goal updated');
  } else {
    goals.push({ id: Utils.uid(), name, target, saved, deadline, emoji });
    showToast('✓ Goal created');
  }

  Storage.save();
  closeModal('goalModal');
  renderSavings();
}

function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  goals = goals.filter(g => g.id !== id);
  Storage.save();
  renderSavings();
  showToast('Goal deleted');
}

// ===== MODALS =====
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ===== CSV EXPORT =====
function exportCSV() {
  if (!transactions.length) return showToast('No transactions to export');
  const header = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Note', 'Recurring'];
  const rows = transactions.map(t => [
    t.date, `"${t.title.replace(/"/g, '""')}"`, t.type, t.category, t.amount,
    `"${(t.note || '').replace(/"/g, '""')}"`, t.recurring ? 'Yes' : 'No',
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `folia-export-${Utils.today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ CSV exported');
}

// ===== THEME =====
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('folia_theme', next);
  // Re-render charts with new colors
  if (currentPage === 'dashboard') { renderTrendChart(); renderDonutChart(); }
  if (currentPage === 'analytics') { renderAnalytics(); }
}

// ===== SEED DATA =====
function seedData() {
  if (transactions.length) return;
  const today = new Date();
  const mkDate = (daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  transactions = [
    { id: Utils.uid(), title: 'Monthly Salary', amount: 65000, category: 'Salary', date: mkDate(1), type: 'income', note: '', recurring: true },
    { id: Utils.uid(), title: 'Freelance Project', amount: 12000, category: 'Freelance', date: mkDate(5), type: 'income', note: 'Web design', recurring: false },
    { id: Utils.uid(), title: 'Grocery Shopping', amount: 3200, category: 'Food', date: mkDate(2), type: 'expense', note: 'Weekly groceries', recurring: false },
    { id: Utils.uid(), title: 'Electricity Bill', amount: 1800, category: 'Bills', date: mkDate(3), type: 'expense', note: '', recurring: true },
    { id: Utils.uid(), title: 'Rickshaw & CNG', amount: 850, category: 'Transport', date: mkDate(4), type: 'expense', note: '', recurring: false },
    { id: Utils.uid(), title: 'Netflix', amount: 600, category: 'Entertainment', date: mkDate(6), type: 'expense', note: '', recurring: true },
    { id: Utils.uid(), title: 'Doctor Visit', amount: 1500, category: 'Health', date: mkDate(8), type: 'expense', note: 'General checkup', recurring: false },
    { id: Utils.uid(), title: 'Online Course', amount: 2500, category: 'Education', date: mkDate(10), type: 'expense', note: 'React course', recurring: false },
    { id: Utils.uid(), title: 'Restaurant dinner', amount: 2100, category: 'Food', date: mkDate(7), type: 'expense', note: 'Family dinner', recurring: false },
    { id: Utils.uid(), title: 'Clothing', amount: 4500, category: 'Shopping', date: mkDate(12), type: 'expense', note: 'Eid shopping', recurring: false },
    // Previous month
    { id: Utils.uid(), title: 'Monthly Salary', amount: 65000, category: 'Salary', date: mkDate(32), type: 'income', note: '', recurring: true },
    { id: Utils.uid(), title: 'Grocery Shopping', amount: 2900, category: 'Food', date: mkDate(33), type: 'expense', note: '', recurring: false },
    { id: Utils.uid(), title: 'Electricity Bill', amount: 1700, category: 'Bills', date: mkDate(34), type: 'expense', note: '', recurring: true },
    { id: Utils.uid(), title: 'Transport', amount: 750, category: 'Transport', date: mkDate(35), type: 'expense', note: '', recurring: false },
    { id: Utils.uid(), title: 'Freelance', amount: 8000, category: 'Freelance', date: mkDate(40), type: 'income', note: 'Logo design', recurring: false },
  ];

  budgets = [
    { category: 'Food', limit: 6000 },
    { category: 'Transport', limit: 2000 },
    { category: 'Entertainment', limit: 1500 },
    { category: 'Shopping', limit: 5000 },
  ];

  goals = [
    { id: Utils.uid(), name: 'Emergency Fund', target: 300000, saved: 85000, deadline: '', emoji: '🛡️' },
    { id: Utils.uid(), name: 'Laptop Upgrade', target: 80000, saved: 35000, deadline: mkDate(-90), emoji: '💻' },
    { id: Utils.uid(), name: 'Vacation Fund', target: 50000, saved: 12000, deadline: mkDate(-180), emoji: '✈️' },
  ];

  Storage.save();
}

// ===== INIT =====
function init() {
  Storage.load();
  seedData();
  bindEvents();
  navigate('dashboard');
}

function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(n => {
    n.addEventListener('click', e => { e.preventDefault(); navigate(n.dataset.page); });
  });

  // Panel links
  document.querySelectorAll('.panel-link').forEach(l => {
    l.addEventListener('click', e => { e.preventDefault(); navigate(l.dataset.page); });
  });

  // Add tx buttons
  document.getElementById('dashAddTxBtn')?.addEventListener('click', openNewTx);
  document.getElementById('txAddBtn')?.addEventListener('click', openNewTx);
  document.getElementById('saveTxBtn')?.addEventListener('click', saveTx);

  // Type toggle
  document.querySelectorAll('.type-btn').forEach(b => {
    b.addEventListener('click', () => setTxType(b.dataset.type));
  });

  // Budget
  document.getElementById('addBudgetBtn')?.addEventListener('click', () => {
    populateCategoryFilter();
    openModal('budgetModal');
  });
  document.getElementById('saveBudgetBtn')?.addEventListener('click', saveBudget);

  // Goals
  document.getElementById('addGoalBtn')?.addEventListener('click', openNewGoal);
  document.getElementById('saveGoalBtn')?.addEventListener('click', saveGoal);

  // Filters
  ['searchInput', 'filterCategory', 'filterType', 'filterMonth'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyFilters);
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterMonth').value = '';
    applyFilters();
  });

  // Analytics year
  document.getElementById('analyticsYear')?.addEventListener('change', () => renderAnalytics());

  // Modal closes
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Theme
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

  // Export
  document.getElementById('exportBtn')?.addEventListener('click', exportCSV);

  // Mobile menu
  document.getElementById('mobileMenu')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  });

  // Keyboard close modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
