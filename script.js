/* ============================================================
   YADGAR — script.js
   ============================================================ */

// ── Données par défaut ──────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: 'alimentation', name: 'Alimentation', color: '#99B7F5', builtin: true },
  { id: 'transport',    name: 'Transport',    color: '#F296BD', builtin: true },
  { id: 'loisirs',      name: 'Loisirs',      color: '#FCCA59', builtin: true },
  { id: 'sante',        name: 'Santé',        color: '#a8d8b9', builtin: true },
  { id: 'shopping',     name: 'Shopping',     color: '#F5793B', builtin: true },
  { id: 'autres',       name: 'Autres',       color: '#d0b5f2', builtin: true }
];

const PALETTE = [
  '#99B7F5','#F296BD','#FCCA59','#F5793B',
  '#267F53','#a8d8b9','#d0b5f2','#f2e0b5',
  '#b5f2d0','#f2b5b5','#b5e0f2','#d4e0a8'
];

const FREQ_LABELS = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel' };

// ── LocalStorage ────────────────────────────────────────────
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// ── État global ─────────────────────────────────────────────
let categories   = load('yadgar_categories', DEFAULT_CATEGORIES);
let transactions = load('yadgar_transactions', []);
let recurrents   = load('yadgar_recurrents', []);
let currentDate  = new Date();

DEFAULT_CATEGORIES.forEach(def => {
  if (!categories.find(c => c.id === def.id)) categories.unshift(def);
});
save('yadgar_categories', categories);

// ── Appliquer les récurrents au démarrage ───────────────────
function applyRecurrents() {
  const today = new Date();
  let changed = false;

  recurrents.forEach(rec => {
    const lastApplied = rec.lastApplied ? new Date(rec.lastApplied) : null;
    let shouldApply = false;

    if (rec.freq === 'monthly') {
      // Appliquer si on n'a pas encore appliqué ce mois-ci
      if (!lastApplied ||
          lastApplied.getFullYear() < today.getFullYear() ||
          (lastApplied.getFullYear() === today.getFullYear() && lastApplied.getMonth() < today.getMonth())) {
        shouldApply = true;
      }
    } else if (rec.freq === 'weekly') {
      if (!lastApplied) {
        shouldApply = true;
      } else {
        const diffDays = Math.floor((today - lastApplied) / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) shouldApply = true;
      }
    } else if (rec.freq === 'daily') {
      if (!lastApplied) {
        shouldApply = true;
      } else {
        const todayStr = today.toISOString().split('T')[0];
        const lastStr  = lastApplied.toISOString().split('T')[0];
        if (todayStr !== lastStr) shouldApply = true;
      }
    }

    if (shouldApply) {
      const t = {
        id: Date.now().toString() + Math.random(),
        type: rec.type,
        label: rec.label,
        amount: rec.amount,
        date: today.toISOString().split('T')[0],
        note: rec.note || '',
        category: rec.category || 'autres',
        fromRecurrent: rec.id
      };
      transactions.push(t);
      rec.lastApplied = today.toISOString();
      changed = true;
    }
  });

  if (changed) {
    save('yadgar_transactions', transactions);
    save('yadgar_recurrents', recurrents);
  }
}

// ── Navigation ──────────────────────────────────────────────
const views    = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');

function switchView(name) {
  views.forEach(v => v.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('[data-view="' + name + '"]').forEach(el => el.classList.add('active'));
  if (window._drawerNavItems) {
    window._drawerNavItems.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  }
  renderAll();
}

navItems.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

// ── Mois ────────────────────────────────────────────────────
function updateMonthLabel() {
  const label = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const formatted = label.charAt(0).toUpperCase() + label.slice(1);
  document.getElementById('currentMonthLabel').textContent = formatted;
  const mobileLabel = document.getElementById('mobileMonthLabel');
  if (mobileLabel) mobileLabel.textContent = formatted;
}

document.getElementById('prevMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateMonthLabel(); renderAll(); });
document.getElementById('nextMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateMonthLabel(); renderAll(); });

function transactionsOfMonth() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  return transactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; });
}

// ── Utilitaires ─────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n); }
function fmtDate(str) { return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
function getCat(id) { return categories.find(c => c.id === id) || { name: 'Autres', color: '#ccc' }; }
function initials(name) { return name.slice(0, 2).toUpperCase(); }
function escHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// ── Item transaction ─────────────────────────────────────────
function buildTransactionItem(t) {
  const cat = getCat(t.category);
  const li = document.createElement('li');
  li.className = 'transaction-item';
  li.innerHTML = `
    <span class="t-icon" style="background:${cat.color}">${initials(cat.name)}</span>
    <span class="t-info">
      <span class="t-label">${escHtml(t.label)}${t.fromRecurrent ? ' <span style="font-size:.68rem;opacity:.6;font-weight:700">AUTO</span>' : ''}</span>
      <span class="t-meta">${fmtDate(t.date)}${t.note ? ' · ' + escHtml(t.note) : ''}${t.type === 'depense' ? ' · ' + escHtml(cat.name) : ''}</span>
    </span>
    <span class="t-amount ${t.type}">${t.type === 'depense' ? '-' : '+'}${fmt(t.amount)}</span>
    <button class="t-delete" title="Supprimer"><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
  `;
  li.querySelector('.t-delete').addEventListener('click', () => { transactions = transactions.filter(x => x.id !== t.id); save('yadgar_transactions', transactions); renderAll(); });
  return li;
}

// ── RENDER DASHBOARD ────────────────────────────────────────
function renderDashboard() {
  const month = transactionsOfMonth();
  const dep = month.filter(t => t.type === 'depense');
  const rev = month.filter(t => t.type === 'revenu');
  const totalDep = dep.reduce((s, t) => s + t.amount, 0);
  const totalRev = rev.reduce((s, t) => s + t.amount, 0);
  const solde = totalRev - totalDep;

  document.getElementById('totalDepenses').textContent = fmt(totalDep);
  document.getElementById('totalRevenus').textContent  = fmt(totalRev);
  document.getElementById('solde').textContent         = fmt(solde);
  document.getElementById('balanceCard').classList.toggle('negative', solde < 0);

  const recentList = document.getElementById('recentList');
  recentList.innerHTML = '';
  if (dep.length === 0) { recentList.innerHTML = '<li class="empty-state">Aucune dépense ce mois. Commence par en ajouter une.</li>'; }
  else { [...dep].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6).forEach(t => recentList.appendChild(buildTransactionItem(t))); }

  renderChart(dep);
}

// ── CHART ───────────────────────────────────────────────────
let chartInstance = null;
function renderChart(dep) {
  const canvas = document.getElementById('catChart');
  const legend = document.getElementById('chartLegend');
  legend.innerHTML = '';
  if (dep.length === 0) { if (chartInstance) { chartInstance.destroy(); chartInstance = null; } canvas.style.display = 'none'; legend.innerHTML = '<p class="empty-state">Aucune donnée</p>'; return; }
  canvas.style.display = '';
  const map = {};
  dep.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: Object.keys(map).map(id => getCat(id).name), datasets: [{ data: Object.values(map), backgroundColor: Object.keys(map).map(id => getCat(id).color), borderWidth: 2, borderColor: '#1a1a1a' }] },
    options: { cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed) } } } }
  });
  Object.keys(map).forEach(id => {
    const cat = getCat(id);
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${cat.color}"></span><span class="legend-name">${escHtml(cat.name)}</span><span class="legend-pct">${Math.round(map[id] / total * 100)}%</span>`;
    legend.appendChild(item);
  });
}

// ── RENDER DÉPENSES ─────────────────────────────────────────
function renderDepenses() {
  const search    = document.getElementById('searchDepenses').value.toLowerCase();
  const filterVal = document.getElementById('filterCat').value;
  const list      = document.getElementById('allDepList');
  const month     = transactionsOfMonth().filter(t => t.type === 'depense');
  const filtered  = month.filter(t => {
    const ms = t.label.toLowerCase().includes(search) || (t.note && t.note.toLowerCase().includes(search));
    return ms && (!filterVal || t.category === filterVal);
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  list.innerHTML = '';
  if (filtered.length === 0) { list.innerHTML = '<li class="empty-state">Aucune dépense trouvée.</li>'; }
  else { filtered.forEach(t => list.appendChild(buildTransactionItem(t))); }

  // Refresh dropdown filtre
  buildCustomSelect('filterCatWrap', 'filterCatTrigger', 'filterCatDropdown', 'filterCat',
    [{ value: '', label: 'Toutes les catégories' }, ...categories.map(c => ({ value: c.id, label: c.name, color: c.color }))],
    filterVal, v => { document.getElementById('filterCat').value = v; renderDepenses(); }
  );
}

// ── RENDER REVENUS ──────────────────────────────────────────
function renderRevenus() {
  const list  = document.getElementById('allRevList');
  const month = transactionsOfMonth().filter(t => t.type === 'revenu').sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = '';
  if (month.length === 0) { list.innerHTML = '<li class="empty-state">Aucun revenu ce mois.</li>'; }
  else { month.forEach(t => list.appendChild(buildTransactionItem(t))); }
}

// ── RENDER RÉCURRENTS ───────────────────────────────────────
function renderRecurrents() {
  const grid = document.getElementById('recGrid');
  grid.innerHTML = '';
  if (recurrents.length === 0) {
    grid.innerHTML = '<p class="empty-state" style="padding:40px 0">Aucun élément récurrent. Ajoutes-en un pour commencer.</p>';
    return;
  }
  recurrents.forEach(rec => {
    const cat = getCat(rec.category);
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.innerHTML = `
      <div class="rec-header">
        <span class="rec-icon" style="background:${rec.type === 'revenu' ? '#a8d8b9' : cat.color}">${initials(rec.label)}</span>
        <div class="rec-info">
          <p class="rec-name">${escHtml(rec.label)}</p>
          <p class="rec-meta">${rec.type === 'depense' ? escHtml(cat.name) : 'Revenu'}${rec.note ? ' · ' + escHtml(rec.note) : ''}</p>
        </div>
      </div>
      <p class="rec-amount ${rec.type}">${rec.type === 'depense' ? '-' : '+'}${fmt(rec.amount)}</p>
      <span class="rec-badge">${FREQ_LABELS[rec.freq] || rec.freq}</span>
      <div class="rec-actions">
        <button class="rec-btn edit-rec" data-id="${rec.id}">Modifier</button>
        <button class="rec-btn danger del-rec" data-id="${rec.id}">Supprimer</button>
      </div>
    `;
    card.querySelector('.del-rec').addEventListener('click', () => {
      recurrents = recurrents.filter(r => r.id !== rec.id);
      save('yadgar_recurrents', recurrents);
      renderRecurrents();
    });
    card.querySelector('.edit-rec').addEventListener('click', () => openRecModal(rec));
    grid.appendChild(card);
  });
}

// ── RENDER CATÉGORIES ────────────────────────────────────────
function renderCategories() {
  const grid  = document.getElementById('catGrid');
  grid.innerHTML = '';
  const month = transactionsOfMonth().filter(t => t.type === 'depense');
  categories.forEach(cat => {
    const count = month.filter(t => t.category === cat.id).length;
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-dot" style="background:${cat.color}"></div>
      <p class="cat-name">${escHtml(cat.name)}</p>
      <p class="cat-count">${count} dépense${count > 1 ? 's' : ''} ce mois</p>
      ${!cat.builtin ? `<button class="cat-delete"><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>` : ''}
    `;
    if (!cat.builtin) { card.querySelector('.cat-delete').addEventListener('click', () => { categories = categories.filter(c => c.id !== cat.id); save('yadgar_categories', categories); renderAll(); }); }
    grid.appendChild(card);
  });
}

function renderAll() { renderDashboard(); renderDepenses(); renderRevenus(); renderRecurrents(); renderCategories(); }

// ── CUSTOM SELECT ───────────────────────────────────────────
const _selectListeners = new WeakMap();

function buildCustomSelect(wrapId, triggerId, dropdownId, hiddenId, options, currentVal, onChange) {
  const wrap     = document.getElementById(wrapId);
  const trigger  = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  if (!wrap || !trigger || !dropdown) return;

  // Toujours fermé à la construction
  wrap.classList.remove('open');

  // Afficher la valeur courante
  const current = options.find(o => o.value === currentVal) || options[0];
  trigger.textContent = current ? current.label : (options[0] ? options[0].label : '');

  // Reconstruire les options
  dropdown.innerHTML = '';
  options.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'custom-select-option' + (opt.value === currentVal ? ' selected' : '');
    div.innerHTML = opt.color
      ? `<span class="opt-dot" style="background:${opt.color}"></span>${escHtml(opt.label)}`
      : escHtml(opt.label);
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById(hiddenId).value = opt.value;
      trigger.textContent = opt.label;
      wrap.classList.remove('open');
      if (onChange) onChange(opt.value);
    });
    dropdown.appendChild(div);
  });

  // Attacher le listener de toggle UNE SEULE FOIS par trigger
  if (!_selectListeners.has(trigger)) {
    const handler = (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      document.querySelectorAll('.custom-select-wrap.open').forEach(w => w.classList.remove('open'));
      document.querySelectorAll('.datepicker-panel.open').forEach(p => p.classList.remove('open'));
      if (!isOpen) wrap.classList.add('open');
    };
    trigger.addEventListener('click', handler);
    _selectListeners.set(trigger, handler);
  }
}

// Fermer tous les selects en cliquant ailleurs
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrap.open').forEach(w => w.classList.remove('open'));
  document.querySelectorAll('.datepicker-panel.open').forEach(p => p.classList.remove('open'));
});

// ── CUSTOM DATEPICKER ────────────────────────────────────────
const _dpListeners = new WeakMap();

function buildDatepicker(panelId, triggerId, hiddenId, initialDate) {
  const panel   = document.getElementById(panelId);
  const trigger = document.getElementById(triggerId);
  const hidden  = document.getElementById(hiddenId);
  if (!panel || !trigger) return;

  // Toujours fermé à la construction
  panel.classList.remove('open');

  // Stocker l'état de vue dans des propriétés du panel pour éviter les globaux partagés
  panel._dpYear  = initialDate.getFullYear();
  panel._dpMonth = initialDate.getMonth();

  function renderDp() {
    panel.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'dp-header';
    const title = document.createElement('span');
    title.className = 'dp-title';
    const monthName = new Date(panel._dpYear, panel._dpMonth, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    title.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const nav = document.createElement('div');
    nav.className = 'dp-nav';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button'; prevBtn.className = 'dp-nav-btn'; prevBtn.textContent = '‹';
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); panel._dpMonth--; if (panel._dpMonth < 0) { panel._dpMonth = 11; panel._dpYear--; } renderDp(); });
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button'; nextBtn.className = 'dp-nav-btn'; nextBtn.textContent = '›';
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); panel._dpMonth++; if (panel._dpMonth > 11) { panel._dpMonth = 0; panel._dpYear++; } renderDp(); });
    nav.appendChild(prevBtn); nav.appendChild(nextBtn);
    header.appendChild(title); header.appendChild(nav);
    panel.appendChild(header);

    const weekdays = document.createElement('div'); weekdays.className = 'dp-weekdays';
    ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].forEach(d => { const s = document.createElement('div'); s.className = 'dp-weekday'; s.textContent = d; weekdays.appendChild(s); });
    panel.appendChild(weekdays);

    const grid = document.createElement('div'); grid.className = 'dp-days';
    const firstDay = new Date(panel._dpYear, panel._dpMonth, 1).getDay();
    const offset   = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(panel._dpYear, panel._dpMonth + 1, 0).getDate();
    const today = new Date();
    const selectedStr = hidden.value;

    for (let i = 0; i < offset; i++) {
      const prev = new Date(panel._dpYear, panel._dpMonth, -offset + i + 1);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dp-day other-month'; btn.textContent = prev.getDate();
      grid.appendChild(btn);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dp-day'; btn.textContent = d;
      const dateStr = `${panel._dpYear}-${String(panel._dpMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (today.getFullYear() === panel._dpYear && today.getMonth() === panel._dpMonth && today.getDate() === d) btn.classList.add('today');
      if (dateStr === selectedStr) btn.classList.add('selected');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hidden.value = dateStr;
        trigger.textContent = new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        panel.classList.remove('open');
        renderDp();
      });
      grid.appendChild(btn);
    }

    panel.appendChild(grid);
  }

  // Attacher le listener de toggle UNE SEULE FOIS
  if (!_dpListeners.has(trigger)) {
    const handler = (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains('open');
      document.querySelectorAll('.custom-select-wrap.open').forEach(w => w.classList.remove('open'));
      document.querySelectorAll('.datepicker-panel.open').forEach(p => p.classList.remove('open'));
      if (!isOpen) { panel.classList.add('open'); renderDp(); }
    };
    trigger.addEventListener('click', handler);
    _dpListeners.set(trigger, handler);
  }

  panel.addEventListener('click', e => e.stopPropagation());
}

// ── MODAL TRANSACTION ────────────────────────────────────────
const modalOverlay    = document.getElementById('modalOverlay');
const transactionForm = document.getElementById('transactionForm');

function openModal(type) {
  document.getElementById('transactionType').value = type;
  document.getElementById('modalTitle').textContent = type === 'depense' ? 'Nouvelle dépense' : 'Nouveau revenu';
  document.getElementById('catGroup').style.display = type === 'depense' ? '' : 'none';
  document.getElementById('fieldLabel').value  = '';
  document.getElementById('fieldAmount').value = '';
  document.getElementById('fieldNote').value   = '';

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('fieldDate').value = todayStr;
  document.getElementById('datepickerTrigger').textContent = new Date(todayStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  if (type === 'depense') {
    buildCustomSelect('fieldCatWrap', 'fieldCatTrigger', 'fieldCatDropdown', 'fieldCat',
      categories.map(c => ({ value: c.id, label: c.name, color: c.color })),
      categories[0]?.id, null
    );
    document.getElementById('fieldCat').value = categories[0]?.id || '';
  }

  buildDatepicker('datepickerPanel', 'datepickerTrigger', 'fieldDate', new Date());

  modalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('fieldLabel').focus(), 100);
}

function closeModal() { modalOverlay.classList.remove('open'); }

document.getElementById('openModal').addEventListener('click',    () => openModal('depense'));
document.getElementById('openModalDep').addEventListener('click', () => openModal('depense'));
document.getElementById('openModalRev').addEventListener('click', () => openModal('revenu'));
document.getElementById('closeModal').addEventListener('click',   closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

transactionForm.addEventListener('submit', e => {
  e.preventDefault();
  const type   = document.getElementById('transactionType').value;
  const label  = document.getElementById('fieldLabel').value.trim();
  const amount = parseFloat(document.getElementById('fieldAmount').value);
  const date   = document.getElementById('fieldDate').value;
  const note   = document.getElementById('fieldNote').value.trim();
  const cat    = type === 'depense' ? document.getElementById('fieldCat').value : 'revenus';
  if (!label || !amount || !date) return;
  transactions.push({ id: Date.now().toString(), type, label, amount, date, note, category: cat });
  save('yadgar_transactions', transactions);
  closeModal();
  renderAll();
});

// ── MODAL RÉCURRENT ──────────────────────────────────────────
const recModalOverlay = document.getElementById('recModalOverlay');
const recForm         = document.getElementById('recForm');
let editingRecId      = null;

function openRecModal(existingRec) {
  editingRecId = existingRec ? existingRec.id : null;

  const type = existingRec ? existingRec.type : 'depense';
  document.getElementById('recType').value = type;
  document.querySelectorAll('#recTypeToggle .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === type);
  });

  document.getElementById('recLabel').value  = existingRec ? existingRec.label : '';
  document.getElementById('recAmount').value = existingRec ? existingRec.amount : '';
  document.getElementById('recNote').value   = existingRec ? (existingRec.note || '') : '';
  document.getElementById('recCatGroup').style.display = type === 'depense' ? '' : 'none';

  buildCustomSelect('recFreqWrap', 'recFreqTrigger', 'recFreqDropdown', 'recFreq',
    [{ value: 'monthly', label: 'Mensuel' }, { value: 'weekly', label: 'Hebdomadaire' }, { value: 'daily', label: 'Quotidien' }],
    existingRec ? existingRec.freq : 'monthly', null
  );
  document.getElementById('recFreq').value = existingRec ? existingRec.freq : 'monthly';

  if (type === 'depense') {
    buildCustomSelect('recCatWrap', 'recCatTrigger', 'recCatDropdown', 'recCat',
      categories.map(c => ({ value: c.id, label: c.name, color: c.color })),
      existingRec ? existingRec.category : categories[0]?.id, null
    );
    document.getElementById('recCat').value = existingRec ? existingRec.category : (categories[0]?.id || '');
  }

  recModalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('recLabel').focus(), 100);
}

// Toggle dépense/revenu dans le modal récurrent
document.querySelectorAll('#recTypeToggle .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#recTypeToggle .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('recType').value = btn.dataset.val;
    document.getElementById('recCatGroup').style.display = btn.dataset.val === 'depense' ? '' : 'none';
    if (btn.dataset.val === 'depense') {
      buildCustomSelect('recCatWrap', 'recCatTrigger', 'recCatDropdown', 'recCat',
        categories.map(c => ({ value: c.id, label: c.name, color: c.color })),
        categories[0]?.id, null
      );
      document.getElementById('recCat').value = categories[0]?.id || '';
    }
  });
});

document.getElementById('openModalRec').addEventListener('click', () => openRecModal(null));
document.getElementById('closeRecModal').addEventListener('click', () => recModalOverlay.classList.remove('open'));
recModalOverlay.addEventListener('click', e => { if (e.target === recModalOverlay) recModalOverlay.classList.remove('open'); });

recForm.addEventListener('submit', e => {
  e.preventDefault();
  const type   = document.getElementById('recType').value;
  const label  = document.getElementById('recLabel').value.trim();
  const amount = parseFloat(document.getElementById('recAmount').value);
  const freq   = document.getElementById('recFreq').value;
  const cat    = type === 'depense' ? document.getElementById('recCat').value : 'revenus';
  const note   = document.getElementById('recNote').value.trim();
  if (!label || !amount) return;

  if (editingRecId) {
    const idx = recurrents.findIndex(r => r.id === editingRecId);
    if (idx !== -1) { recurrents[idx] = { ...recurrents[idx], type, label, amount, freq, category: cat, note }; }
  } else {
    recurrents.push({ id: Date.now().toString(), type, label, amount, freq, category: cat, note, lastApplied: null });
  }

  save('yadgar_recurrents', recurrents);
  recModalOverlay.classList.remove('open');
  editingRecId = null;
  renderAll();
});

// ── MODAL CATÉGORIE ──────────────────────────────────────────
const catModalOverlay = document.getElementById('catModalOverlay');

function buildColorPicker() {
  const picker = document.getElementById('colorPicker');
  picker.innerHTML = '';
  PALETTE.forEach(color => {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'color-swatch' + (color === '#99B7F5' ? ' selected' : '');
    s.style.background = color;
    s.addEventListener('click', () => {
      picker.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
      document.getElementById('catColor').value = color;
    });
    picker.appendChild(s);
  });
}

document.getElementById('openModalCat').addEventListener('click', () => {
  document.getElementById('catName').value  = '';
  document.getElementById('catColor').value = '#99B7F5';
  buildColorPicker();
  catModalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('catName').focus(), 100);
});

document.getElementById('closeCatModal').addEventListener('click', () => catModalOverlay.classList.remove('open'));
catModalOverlay.addEventListener('click', e => { if (e.target === catModalOverlay) catModalOverlay.classList.remove('open'); });

document.getElementById('catForm').addEventListener('submit', e => {
  e.preventDefault();
  const name  = document.getElementById('catName').value.trim();
  const color = document.getElementById('catColor').value;
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  categories.push({ id, name, color, builtin: false });
  save('yadgar_categories', categories);
  catModalOverlay.classList.remove('open');
  renderAll();
});

// ── Recherche ────────────────────────────────────────────────
document.getElementById('searchDepenses').addEventListener('input', renderDepenses);

// ── Échap ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); recModalOverlay.classList.remove('open'); catModalOverlay.classList.remove('open'); }
});

// ── Mobile : topbar + hamburger drawer ──────────────────────
function injectMobileNav() {
  const ITEMS = [
    ['dashboard',  '<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="2" fill="currentColor"/><rect x="11" y="2" width="7" height="7" rx="2" fill="currentColor" opacity=".4"/><rect x="2" y="11" width="7" height="7" rx="2" fill="currentColor" opacity=".4"/><rect x="11" y="11" width="7" height="7" rx="2" fill="currentColor"/></svg>', 'Tableau de bord'],
    ['depenses',   '<svg viewBox="0 0 20 20" fill="none"><path d="M3 6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', 'Mes dépenses'],
    ['revenus',    '<svg viewBox="0 0 20 20" fill="none"><path d="M10 3v14M6 7l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Mes revenus'],
    ['recurrents', '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10a6 6 0 1110.93-3.36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M15 4v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Récurrents'],
    ['categories', '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 10l5-2.5M10 10V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', 'Catégories']
  ];

  // ── Topbar ──────────────────────────────────────────────────
  const topbar = document.createElement('div');
  topbar.className = 'mobile-topbar';
  topbar.innerHTML = `
    <span class="topbar-logo">Yadgar</span>
    <div class="topbar-month">
      <button class="month-btn" id="mobilePrevMonth">
        <svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <span class="topbar-month-label" id="mobileMonthLabel"></span>
      <button class="month-btn" id="mobileNextMonth">
        <svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
    <button class="hamburger-btn" id="hamburgerBtn">
      <span></span><span></span><span></span>
    </button>
  `;
  document.body.appendChild(topbar);

  // ── Overlay ─────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'mobile-drawer-overlay';
  document.body.appendChild(overlay);

  // ── Drawer ──────────────────────────────────────────────────
  const drawer = document.createElement('div');
  drawer.className = 'mobile-drawer';

  const drawerHeader = document.createElement('div');
  drawerHeader.className = 'drawer-header';
  drawerHeader.innerHTML = `<span class="drawer-logo">Yadgar</span><button class="drawer-close" id="drawerClose">✕</button>`;
  drawer.appendChild(drawerHeader);

  const drawerNav = document.createElement('nav');
  drawerNav.className = 'drawer-nav';

  ITEMS.forEach(([view, icon, label]) => {
    const btn = document.createElement('button');
    btn.className = 'drawer-nav-item' + (view === 'dashboard' ? ' active' : '');
    btn.dataset.view = view;
    btn.innerHTML = icon + `<span>${label}</span>`;
    btn.addEventListener('click', () => {
      switchView(view);
      closeDrawer();
    });
    drawerNav.appendChild(btn);
  });

  drawer.appendChild(drawerNav);
  document.body.appendChild(drawer);

  // ── Logique ouverture/fermeture ──────────────────────────────
  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.getElementById('hamburgerBtn').classList.add('open');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.getElementById('hamburgerBtn').classList.remove('open');
  }

  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  overlay.addEventListener('click', closeDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);

  // ── Mois mobile ──────────────────────────────────────────────
  document.getElementById('mobilePrevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1); updateMonthLabel(); renderAll();
  });
  document.getElementById('mobileNextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1); updateMonthLabel(); renderAll();
  });

  window._drawerNavItems = drawerNav.querySelectorAll('.drawer-nav-item');
}

// ── Init ─────────────────────────────────────────────────────
injectMobileNav();
applyRecurrents();
updateMonthLabel();
renderAll();