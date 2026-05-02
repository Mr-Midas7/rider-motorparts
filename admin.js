// ═══════════════════════════════════════════════════
// RIDER MOTORPARTS — Admin Dashboard JS
// ═══════════════════════════════════════════════════
'use strict';

// ── AUTH GUARD ──────────────────────────────────────
(async () => {
  const { data: { session } } = await window.db.auth.getSession();
  if (!session) { window.location.href = 'admin-login.html'; return; }
  const email = session.user.email;
  const display = document.getElementById('adminEmailDisplay');
  const avatar = document.querySelector('.admin-avatar');
  if (display) display.textContent = email;
  if (avatar) avatar.textContent = email.charAt(0).toUpperCase();
  initApp();
})();

// ── STATE ────────────────────────────────────────────
const S = {
  appointments: [],
  services: [],
  products: [],
  customers: [],
  testimonials: [],
  filteredAppts: [],
  filteredCustomers: [],
};

// ── UTILS ────────────────────────────────────────────
const fmt = {
  price: p => '₱' + Number(p).toLocaleString('en-PH', { minimumFractionDigits: 2 }),
  date: d => { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); },
  time: t => { if (!t) return '—'; const [h,m] = t.split(':'); const hr = parseInt(h); return `${hr%12||12}:${m} ${hr>=12?'PM':'AM'}`; },
  dt: s => s ? new Date(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
};

function toast(msg, type = 'success') {
  const el = document.getElementById('adminToast');
  el.textContent = (type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : '⚠️ ') + msg;
  el.className = `admin-toast ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

function statusBadge(status) {
  const labels = { pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

// ── SIDEBAR / NAV ────────────────────────────────────
let sidebarOpen = window.innerWidth > 900;

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mw = document.getElementById('mainWrap');
  if (window.innerWidth > 900) {
    sidebarOpen = !sidebarOpen;
    sb.classList.toggle('collapsed', !sidebarOpen);
    mw.classList.toggle('expanded', !sidebarOpen);
  } else {
    sb.classList.toggle('open');
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchPage(item.dataset.page);
    if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
  });
});

function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  document.getElementById('topbarTitle').textContent = page.charAt(0).toUpperCase() + page.slice(1);
  if (page === 'appointments') renderAppointments();
  if (page === 'services') renderServices();
  if (page === 'products') renderProducts();
  if (page === 'customers') renderCustomers();
  if (page === 'testimonials') renderTestimonials();
  if (page === 'schedule') { renderBlocks(); renderCalendar(); }
}

async function doLogout() {
  await window.db.auth.signOut();
  window.location.href = 'admin-login.html';
}

// ── INIT ─────────────────────────────────────────────
async function initApp() {
  await Promise.all([
    loadAppointments(),
    loadServices(),
    loadProducts(),
    loadTestimonials(),
    loadBlocks(),
  ]);
  buildDashboard();
  initCalendar();
}

// ── LOAD DATA ────────────────────────────────────────
async function loadAppointments() {
  const { data } = await window.db.from('appointments').select('*').order('created_at', { ascending: false });
  S.appointments = data || [];
  S.filteredAppts = [...S.appointments];
  // Update pending badge
  const pending = S.appointments.filter(a => a.status === 'pending').length;
  const badge = document.getElementById('pendingBadge');
  if (pending > 0) { badge.textContent = pending; badge.classList.add('show'); }
}

async function loadServices() {
  const { data } = await window.db.from('services').select('*').order('category');
  S.services = data || [];
}

async function loadProducts() {
  const { data } = await window.db.from('products').select('*').order('featured', { ascending: false });
  S.products = data || [];
}

async function loadTestimonials() {
  const { data } = await window.db.from('testimonials').select('*').order('created_at', { ascending: false });
  S.testimonials = data || [];
}

// ── DASHBOARD ────────────────────────────────────────
function buildDashboard() {
  const appts = S.appointments;
  const uniqueEmails = [...new Set(appts.map(a => a.customer_email))];

  document.getElementById('statTotal').textContent = appts.length;
  document.getElementById('statPending').textContent = appts.filter(a => a.status === 'pending').length;
  document.getElementById('statCompleted').textContent = appts.filter(a => a.status === 'completed').length;
  document.getElementById('statCustomers').textContent = uniqueEmails.length;
  document.getElementById('statServices').textContent = S.services.filter(s => s.active).length;
  document.getElementById('statProducts').textContent = S.products.length;

  buildServiceChart();
  buildStatusChart();
  buildRecentTable();
}

function buildServiceChart() {
  const counts = {};
  S.appointments.forEach(a => { counts[a.service_name] = (counts[a.service_name] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 6);
  const max = sorted[0]?.[1] || 1;
  const html = sorted.length
    ? sorted.map(([name, count]) => `
        <div class="chart-bar-row">
          <div class="chart-bar-label" title="${name}">${name}</div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${(count/max*100).toFixed(1)}%">
              <span class="chart-bar-val">${count}</span>
            </div>
          </div>
        </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:0.9rem">No data yet</p>';
  document.getElementById('serviceChart').innerHTML = html;
}

function buildStatusChart() {
  const statusColors = { pending: '#FF9800', confirmed: '#FFD000', in_progress: '#4488FF', completed: '#00C97A', cancelled: '#FF4545' };
  const counts = { pending: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0 };
  S.appointments.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
  const total = S.appointments.length || 1;
  const rows = Object.entries(counts).map(([status, count]) => `
    <div class="status-pie-row">
      <div class="status-dot" style="background:${statusColors[status]}"></div>
      <div class="status-pie-label">${status.replace('_',' ')}</div>
      <div class="status-pie-bar"><div class="status-pie-fill" style="width:${(count/total*100).toFixed(1)}%;background:${statusColors[status]}"></div></div>
      <div class="status-pie-val">${count}</div>
    </div>`).join('');
  document.getElementById('statusChart').innerHTML = `<div class="status-pie">${rows}</div>`;
}

function buildRecentTable() {
  const recent = S.appointments.slice(0, 8);
  document.getElementById('recentBody').innerHTML = recent.length
    ? recent.map(a => `<tr>
        <td><span class="ref-code">${a.booking_ref || '—'}</span></td>
        <td>${a.customer_name}</td>
        <td class="text-sm text-muted">${a.motorcycle_brand} ${a.motorcycle_model}</td>
        <td class="text-sm">${a.service_name}</td>
        <td class="text-sm">${fmt.date(a.appointment_date)}</td>
        <td>${statusBadge(a.status)}</td>
        <td><button class="btn-icon" onclick="switchPage('appointments');setTimeout(()=>viewAppt('${a.id}'),100)">✏️ Edit</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="loading-cell">No appointments yet</td></tr>';
}

// ── APPOINTMENTS ─────────────────────────────────────
function renderAppointments() {
  const tbody = document.getElementById('apptBody');
  const data = S.filteredAppts;
  document.getElementById('apptFooter').textContent = `Showing ${data.length} of ${S.appointments.length} appointments`;

  tbody.innerHTML = data.length
    ? data.map(a => `<tr>
        <td><span class="ref-code">${a.booking_ref || '—'}</span></td>
        <td>
          <div style="font-weight:600">${a.customer_name}</div>
          <div class="text-sm text-muted">${a.customer_email}</div>
        </td>
        <td class="text-sm">${a.customer_phone}</td>
        <td class="text-sm">${a.motorcycle_brand} ${a.motorcycle_model} ${a.motorcycle_year || ''}</td>
        <td>
          <div style="font-size:0.85rem">${a.service_name}</div>
          <div class="text-sm text-muted">${a.service_category}</div>
        </td>
        <td class="text-sm">${fmt.date(a.appointment_date)}<br><span class="text-muted">${fmt.time(a.appointment_time)}</span></td>
        <td>
          <select class="status-select" onchange="updateApptStatus('${a.id}', this.value)">
            ${['pending','confirmed','in_progress','completed','cancelled'].map(s =>
              `<option value="${s}" ${a.status===s?'selected':''}>${s.replace('_',' ')}</option>`
            ).join('')}
          </select>
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" onclick="viewAppt('${a.id}')">✏️ Edit</button>
            <button class="btn-icon" onclick="viewApptDetails('${a.id}')">👁 View</button>
            <button class="btn-icon danger" onclick="deleteAppt('${a.id}')">🗑</button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="loading-cell">No appointments found</td></tr>';
}

function filterAppts() {
  const q = document.getElementById('apptSearch').value.toLowerCase();
  const status = document.getElementById('apptStatusFilter').value;
  const cat = document.getElementById('apptCatFilter').value;
  S.filteredAppts = S.appointments.filter(a => {
    const matchQ = !q || [a.customer_name, a.booking_ref, a.motorcycle_brand, a.motorcycle_model, a.service_name].some(f => f?.toLowerCase().includes(q));
    const matchS = !status || a.status === status;
    const matchC = !cat || a.service_category === cat;
    return matchQ && matchS && matchC;
  });
  renderAppointments();
}

async function updateApptStatus(id, status) {
  const { error } = await window.db.from('appointments').update({ status }).eq('id', id);
  if (error) { toast('Failed to update status', 'error'); return; }
  const appt = S.appointments.find(a => a.id === id);
  if (appt) appt.status = status;
  S.filteredAppts = S.filteredAppts.map(a => a.id === id ? { ...a, status } : a);
  toast('Status updated successfully');
  buildDashboard();
  const pending = S.appointments.filter(a => a.status === 'pending').length;
  const badge = document.getElementById('pendingBadge');
  badge.textContent = pending; badge.classList.toggle('show', pending > 0);
}

function viewAppt(id) {
  const a = S.appointments.find(x => x.id === id);
  if (!a) return;
  document.getElementById('modalTitle').textContent = '✏️ Edit Appointment';
  document.getElementById('modalBody').innerHTML = `
    <div style="background:var(--card-bg);border:1px solid var(--steel);border-radius:8px;padding:0.7rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:var(--font-cond);font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">Booking Ref</span>
      <span class="ref-code">${a.booking_ref}</span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">
      <div class="form-group" style="margin:0">
        <label>Customer Name</label>
        <input id="ea_name" value="${a.customer_name || ''}" placeholder="Full name" />
      </div>
      <div class="form-group" style="margin:0">
        <label>Phone</label>
        <input id="ea_phone" value="${a.customer_phone || ''}" placeholder="Phone number" />
      </div>
      <div class="form-group" style="margin:0">
        <label>Email</label>
        <input id="ea_email" value="${a.customer_email || ''}" placeholder="Email" />
      </div>
      <div class="form-group" style="margin:0">
        <label>Status</label>
        <select id="ea_status">
          ${['pending','confirmed','in_progress','completed','cancelled'].map(s =>
            `<option value="${s}" ${a.status===s?'selected':''}>${s.replace('_',' ')}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div style="margin:0.8rem 0;border-top:1px solid var(--steel);padding-top:0.8rem">
      <div style="font-family:var(--font-cond);font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem">Motorcycle</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 80px 100px;gap:0.8rem">
        <div class="form-group" style="margin:0">
          <label>Brand</label>
          <input id="ea_brand" value="${a.motorcycle_brand || ''}" placeholder="e.g. Honda" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Model</label>
          <input id="ea_model" value="${a.motorcycle_model || ''}" placeholder="e.g. CBR600RR" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Year</label>
          <input id="ea_year" type="number" value="${a.motorcycle_year || ''}" placeholder="2022" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Plate</label>
          <input id="ea_plate" value="${a.motorcycle_plate || ''}" placeholder="ABC 123" />
        </div>
      </div>
    </div>

    <div style="margin:0.8rem 0;border-top:1px solid var(--steel);padding-top:0.8rem">
      <div style="font-family:var(--font-cond);font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem">Schedule & Service</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">
        <div class="form-group" style="margin:0">
          <label>Appointment Date</label>
          <input id="ea_date" type="date" value="${a.appointment_date || ''}" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Time Slot</label>
          <select id="ea_time">
            ${[['08:00','8:00 AM'],['09:00','9:00 AM'],['10:00','10:00 AM'],['11:00','11:00 AM'],['13:00','1:00 PM'],['14:00','2:00 PM'],['15:00','3:00 PM'],['16:00','4:00 PM']].map(([v,l]) =>
              `<option value="${v}" ${(a.appointment_time||'').startsWith(v)?'selected':''}>${l}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Service Name</label>
          <input id="ea_service" value="${a.service_name || ''}" placeholder="e.g. Oil Change" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Service Category</label>
          <select id="ea_cat">
            ${['repair','upgrade','accessories','maintenance'].map(c =>
              `<option value="${c}" ${a.service_category===c?'selected':''}>${c}</option>`
            ).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="form-group" style="margin:0.8rem 0 0;border-top:1px solid var(--steel);padding-top:0.8rem">
      <label>Additional Notes</label>
      <textarea id="ea_notes" rows="2" placeholder="Any special instructions or notes…">${a.additional_notes || ''}</textarea>
    </div>`;

  document.getElementById('modalFooter').innerHTML = `
    <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
    <button class="modal-btn primary" onclick="saveAppt('${id}')">💾 Save Changes</button>`;
  openModal();
}

function viewApptDetails(id) {
  const a = S.appointments.find(x => x.id === id);
  if (!a) return;
  document.getElementById('modalTitle').textContent = 'Appointment Details';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:grid;gap:0.7rem">
      ${row('Booking Ref', `<span class="ref-code">${a.booking_ref}</span>`)}
      ${row('Status', statusBadge(a.status))}
      ${row('Customer', a.customer_name)}
      ${row('Email', a.customer_email)}
      ${row('Phone', a.customer_phone)}
      ${row('Motorcycle', `${a.motorcycle_brand} ${a.motorcycle_model} ${a.motorcycle_year || ''}`)}
      ${a.motorcycle_plate ? row('Plate', a.motorcycle_plate) : ''}
      ${row('Service', a.service_name)}
      ${row('Category', a.service_category)}
      ${row('Date', fmt.date(a.appointment_date))}
      ${row('Time', fmt.time(a.appointment_time))}
      ${a.additional_notes ? row('Notes', a.additional_notes) : ''}
      ${row('Booked On', fmt.dt(a.created_at))}
    </div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="modal-btn secondary" onclick="closeModal()">Close</button>
    <button class="modal-btn primary" onclick="closeModal();viewAppt('${id}')">✏️ Edit</button>`;
  openModal();
}

async function saveAppt(id) {
  const payload = {
    customer_name:    document.getElementById('ea_name').value.trim(),
    customer_email:   document.getElementById('ea_email').value.trim(),
    customer_phone:   document.getElementById('ea_phone').value.trim(),
    motorcycle_brand: document.getElementById('ea_brand').value.trim(),
    motorcycle_model: document.getElementById('ea_model').value.trim(),
    motorcycle_year:  parseInt(document.getElementById('ea_year').value) || null,
    motorcycle_plate: document.getElementById('ea_plate').value.trim() || null,
    appointment_date: document.getElementById('ea_date').value,
    appointment_time: document.getElementById('ea_time').value + ':00',
    service_name:     document.getElementById('ea_service').value.trim(),
    service_category: document.getElementById('ea_cat').value,
    status:           document.getElementById('ea_status').value,
    additional_notes: document.getElementById('ea_notes').value.trim() || null,
  };
  if (!payload.customer_name || !payload.appointment_date || !payload.service_name) {
    toast('Customer name, date and service are required', 'error'); return;
  }
  const { error } = await window.db.from('appointments').update(payload).eq('id', id);
  if (error) { toast('Failed to save changes: ' + error.message, 'error'); return; }
  S.appointments = S.appointments.map(a => a.id === id ? { ...a, ...payload } : a);
  S.filteredAppts = S.filteredAppts.map(a => a.id === id ? { ...a, ...payload } : a);
  closeModal();
  renderAppointments();
  buildDashboard();
  toast('Appointment updated successfully!');
}

function row(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--steel);gap:1rem">
    <span style="color:var(--text-muted);font-size:0.85rem;font-family:var(--font-cond);text-transform:uppercase;letter-spacing:0.08em;flex-shrink:0">${label}</span>
    <span style="font-size:0.9rem;text-align:right">${value}</span>
  </div>`;
}

async function deleteAppt(id) {
  if (!confirm('Delete this appointment? This cannot be undone.')) return;
  const { error } = await window.db.from('appointments').delete().eq('id', id);
  if (error) { toast('Failed to delete appointment', 'error'); return; }
  S.appointments = S.appointments.filter(a => a.id !== id);
  S.filteredAppts = S.filteredAppts.filter(a => a.id !== id);
  renderAppointments(); buildDashboard();
  toast('Appointment deleted');
}

// ── SERVICES ─────────────────────────────────────────
function renderServices() {
  document.getElementById('servicesBody').innerHTML = S.services.length
    ? S.services.map(s => `<tr>
        <td style="font-size:1.5rem">${s.icon || '🔧'}</td>
        <td style="font-weight:600">${s.name}</td>
        <td><span class="badge badge-${s.category === 'repair' ? 'in_progress' : s.category === 'upgrade' ? 'confirmed' : s.category === 'maintenance' ? 'completed' : 'pending'}">${s.category}</span></td>
        <td class="text-sm">${s.duration_minutes} min</td>
        <td style="color:var(--yellow);font-weight:700">${fmt.price(s.base_price)}</td>
        <td><span class="badge ${s.active ? 'badge-active' : 'badge-inactive'}">${s.active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" onclick="openServiceModal('${s.id}')">✏️ Edit</button>
            <button class="btn-icon danger" onclick="deleteService('${s.id}')">🗑</button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="loading-cell">No services found</td></tr>';
}

function openServiceModal(id = null) {
  const s = id ? S.services.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = s ? 'Edit Service' : 'Add New Service';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>Service Name *</label><input id="sName" value="${s?.name || ''}" placeholder="e.g. Full Engine Tune-Up" /></div>
    <div class="form-group half-grid">
      <div><label>Category *</label>
        <select id="sCat">
          ${['repair','upgrade','accessories','maintenance'].map(c => `<option value="${c}" ${s?.category===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      <div><label>Icon (emoji)</label><input id="sIcon" value="${s?.icon || '🔧'}" placeholder="🔧" /></div>
    </div>
    <div class="form-group half-grid">
      <div><label>Base Price (₱) *</label><input type="number" id="sPrice" value="${s?.base_price || ''}" placeholder="500" /></div>
      <div><label>Duration (minutes)</label><input type="number" id="sDuration" value="${s?.duration_minutes || 60}" /></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="sDesc" rows="3" placeholder="Describe what this service includes…">${s?.description || ''}</textarea></div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="sActive" ${s?.active !== false ? 'checked' : ''} /> Active (visible to customers)</label></div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
    <button class="modal-btn primary" onclick="saveService('${id || ''}')">💾 Save Service</button>`;
  openModal();
}

async function saveService(id) {
  const name = document.getElementById('sName').value.trim();
  const category = document.getElementById('sCat').value;
  const base_price = parseFloat(document.getElementById('sPrice').value);
  const duration_minutes = parseInt(document.getElementById('sDuration').value) || 60;
  const description = document.getElementById('sDesc').value.trim();
  const icon = document.getElementById('sIcon').value.trim() || '🔧';
  const active = document.getElementById('sActive').checked;
  if (!name || !category || isNaN(base_price)) { toast('Please fill all required fields', 'error'); return; }
  const payload = { name, category, base_price, duration_minutes, description, icon, active };
  if (id) {
    const { error } = await window.db.from('services').update(payload).eq('id', id);
    if (error) { toast('Failed to update service', 'error'); return; }
    S.services = S.services.map(s => s.id === id ? { ...s, ...payload } : s);
  } else {
    const { data, error } = await window.db.from('services').insert([payload]).select().single();
    if (error) { toast('Failed to add service', 'error'); return; }
    S.services.push(data);
  }
  closeModal(); renderServices(); toast(id ? 'Service updated!' : 'Service added!');
}

async function deleteService(id) {
  if (!confirm('Delete this service?')) return;
  const { error } = await window.db.from('services').delete().eq('id', id);
  if (error) { toast('Failed to delete', 'error'); return; }
  S.services = S.services.filter(s => s.id !== id);
  renderServices(); toast('Service deleted');
}

// ── PRODUCTS ─────────────────────────────────────────
function renderProducts() {
  document.getElementById('productsBody').innerHTML = S.products.length
    ? S.products.map(p => `<tr>
        <td>
          <div style="font-weight:600">${p.name}</div>
          <div class="text-sm text-muted">${(p.description || '').substring(0,50)}${p.description?.length > 50 ? '…' : ''}</div>
        </td>
        <td><span class="badge badge-pending">${p.category}</span></td>
        <td style="color:var(--yellow);font-weight:700">${fmt.price(p.price)}</td>
        <td><span style="color:${p.stock < 5 ? 'var(--error)' : 'var(--success)'}">${p.stock}</span></td>
        <td>${p.featured ? '<span class="badge badge-featured">★ Featured</span>' : '<span class="text-muted text-sm">—</span>'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" onclick="openProductModal('${p.id}')">✏️ Edit</button>
            <button class="btn-icon danger" onclick="deleteProduct('${p.id}')">🗑</button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="loading-cell">No products found</td></tr>';
}

function openProductModal(id = null) {
  const p = id ? S.products.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = p ? 'Edit Product' : 'Add New Product';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>Product Name *</label><input id="pName" value="${p?.name || ''}" placeholder="e.g. Yoshimura R-77 Exhaust" /></div>
    <div class="form-group half-grid">
      <div><label>Category *</label>
        <select id="pCat">${['parts','accessories','upgrades','maintenance'].map(c => `<option value="${c}" ${p?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div><label>Price (₱) *</label><input type="number" id="pPrice" value="${p?.price || ''}" placeholder="1500" /></div>
    </div>
    <div class="form-group half-grid">
      <div><label>Stock Quantity</label><input type="number" id="pStock" value="${p?.stock ?? 0}" /></div>
      <div><label>Image URL</label><input id="pImg" value="${p?.image_url || ''}" placeholder="https://…" /></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="pDesc" rows="3" placeholder="Describe this product…">${p?.description || ''}</textarea></div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="pFeatured" ${p?.featured ? 'checked' : ''} /> Feature this product on homepage</label></div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
    <button class="modal-btn primary" onclick="saveProduct('${id || ''}')">💾 Save Product</button>`;
  openModal();
}

async function saveProduct(id) {
  const name = document.getElementById('pName').value.trim();
  const category = document.getElementById('pCat').value;
  const price = parseFloat(document.getElementById('pPrice').value);
  const stock = parseInt(document.getElementById('pStock').value) || 0;
  const image_url = document.getElementById('pImg').value.trim() || null;
  const description = document.getElementById('pDesc').value.trim();
  const featured = document.getElementById('pFeatured').checked;
  if (!name || !category || isNaN(price)) { toast('Please fill all required fields', 'error'); return; }
  const payload = { name, category, price, stock, image_url, description, featured };
  if (id) {
    const { error } = await window.db.from('products').update(payload).eq('id', id);
    if (error) { toast('Failed to update product', 'error'); return; }
    S.products = S.products.map(p => p.id === id ? { ...p, ...payload } : p);
  } else {
    const { data, error } = await window.db.from('products').insert([payload]).select().single();
    if (error) { toast('Failed to add product', 'error'); return; }
    S.products.push(data);
  }
  closeModal(); renderProducts(); toast(id ? 'Product updated!' : 'Product added!');
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  const { error } = await window.db.from('products').delete().eq('id', id);
  if (error) { toast('Failed to delete', 'error'); return; }
  S.products = S.products.filter(p => p.id !== id);
  renderProducts(); toast('Product deleted');
}

// ── CUSTOMERS ────────────────────────────────────────
function renderCustomers() {
  // Build unique customer list from appointments
  const map = {};
  S.appointments.forEach(a => {
    if (!map[a.customer_email]) {
      map[a.customer_email] = {
        name: a.customer_name, email: a.customer_email, phone: a.customer_phone,
        motorcycle: `${a.motorcycle_brand} ${a.motorcycle_model}`,
        bookings: 0, lastBooking: a.created_at, latestStatus: a.status,
      };
    }
    map[a.customer_email].bookings++;
    if (new Date(a.created_at) > new Date(map[a.customer_email].lastBooking)) {
      map[a.customer_email].lastBooking = a.created_at;
      map[a.customer_email].latestStatus = a.status;
    }
  });
  S.customers = Object.values(map);
  S.filteredCustomers = [...S.customers];
  renderCustomerTable();
}

function renderCustomerTable() {
  document.getElementById('customersBody').innerHTML = S.filteredCustomers.length
    ? S.filteredCustomers.map(c => `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.6rem">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--yellow-dim);border:1px solid var(--yellow-border);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);color:var(--yellow);font-size:1rem;flex-shrink:0">${c.name.charAt(0)}</div>
            <span style="font-weight:600">${c.name}</span>
          </div>
        </td>
        <td class="text-sm">${c.email}</td>
        <td class="text-sm">${c.phone}</td>
        <td class="text-sm">${c.motorcycle}</td>
        <td style="text-align:center;font-weight:700;color:var(--yellow)">${c.bookings}</td>
        <td class="text-sm">${fmt.dt(c.lastBooking)}</td>
        <td>${statusBadge(c.latestStatus)}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="loading-cell">No customers found</td></tr>';
}

function filterCustomers() {
  const q = document.getElementById('custSearch').value.toLowerCase();
  S.filteredCustomers = S.customers.filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
  );
  renderCustomerTable();
}

// ── TESTIMONIALS ─────────────────────────────────────
function renderTestimonials() {
  document.getElementById('testimonialsBody').innerHTML = S.testimonials.length
    ? S.testimonials.map(t => `<tr>
        <td style="font-weight:600">${t.customer_name}</td>
        <td class="text-sm text-muted">${t.motorcycle || '—'}</td>
        <td><span class="star-rating">${'★'.repeat(t.rating || 5)}</span></td>
        <td class="text-sm" style="max-width:280px">${(t.message || '').substring(0,80)}${t.message?.length > 80 ? '…' : ''}</td>
        <td>${t.featured ? '<span class="badge badge-featured">★ Yes</span>' : '<span class="text-muted text-sm">No</span>'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" onclick="openTestimonialModal('${t.id}')">✏️ Edit</button>
            <button class="btn-icon ${t.featured ? 'danger' : 'success'}" onclick="toggleFeatured('${t.id}', ${!t.featured})">${t.featured ? '★ Unfeature' : '☆ Feature'}</button>
            <button class="btn-icon danger" onclick="deleteTestimonial('${t.id}')">🗑</button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="loading-cell">No testimonials found</td></tr>';
}

function openTestimonialModal(id = null) {
  const t = id ? S.testimonials.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = t ? 'Edit Testimonial' : 'Add Testimonial';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group half-grid">
      <div><label>Customer Name *</label><input id="tName" value="${t?.customer_name || ''}" placeholder="e.g. Juan Dela Cruz" /></div>
      <div><label>Motorcycle</label><input id="tMoto" value="${t?.motorcycle || ''}" placeholder="e.g. Honda CBR600RR" /></div>
    </div>
    <div class="form-group"><label>Rating (1–5)</label>
      <select id="tRating">${[5,4,3,2,1].map(n => `<option value="${n}" ${(t?.rating||5)===n?'selected':''}>${'★'.repeat(n)} (${n})</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Message *</label><textarea id="tMsg" rows="4" placeholder="Customer review…">${t?.message || ''}</textarea></div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="tFeatured" ${t?.featured ? 'checked' : ''} /> Show on website homepage</label></div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
    <button class="modal-btn primary" onclick="saveTestimonial('${id || ''}')">💾 Save</button>`;
  openModal();
}

async function saveTestimonial(id) {
  const customer_name = document.getElementById('tName').value.trim();
  const motorcycle = document.getElementById('tMoto').value.trim() || null;
  const rating = parseInt(document.getElementById('tRating').value);
  const message = document.getElementById('tMsg').value.trim();
  const featured = document.getElementById('tFeatured').checked;
  if (!customer_name || !message) { toast('Name and message are required', 'error'); return; }
  const payload = { customer_name, motorcycle, rating, message, featured };
  if (id) {
    const { error } = await window.db.from('testimonials').update(payload).eq('id', id);
    if (error) { toast('Failed to update', 'error'); return; }
    S.testimonials = S.testimonials.map(t => t.id === id ? { ...t, ...payload } : t);
  } else {
    const { data, error } = await window.db.from('testimonials').insert([payload]).select().single();
    if (error) { toast('Failed to add testimonial', 'error'); return; }
    S.testimonials.push(data);
  }
  closeModal(); renderTestimonials(); toast(id ? 'Testimonial updated!' : 'Testimonial added!');
}

async function toggleFeatured(id, featured) {
  const { error } = await window.db.from('testimonials').update({ featured }).eq('id', id);
  if (error) { toast('Failed to update', 'error'); return; }
  S.testimonials = S.testimonials.map(t => t.id === id ? { ...t, featured } : t);
  renderTestimonials(); toast(featured ? 'Now featured on site!' : 'Removed from homepage');
}

async function deleteTestimonial(id) {
  if (!confirm('Delete this testimonial?')) return;
  const { error } = await window.db.from('testimonials').delete().eq('id', id);
  if (error) { toast('Failed to delete', 'error'); return; }
  S.testimonials = S.testimonials.filter(t => t.id !== id);
  renderTestimonials(); toast('Testimonial deleted');
}

// ── MODAL ─────────────────────────────────────────────
function openModal() { document.getElementById('modalOverlay').classList.add('open'); }
function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('modalOverlay').classList.remove('open'); });

// ── SCHEDULE BLOCKS ──────────────────────────────────
// State for blocks
S.blocks = [];
S.filteredBlocks = [];
let calYear, calMonth;
let blockType = 'day';
let selectedBlockTime = null;

function setBlockType(type) {
  blockType = type;
  selectedBlockTime = null;
  document.getElementById('btnBlockDay').classList.toggle('active', type === 'day');
  document.getElementById('btnBlockTime').classList.toggle('active', type === 'time');
  document.getElementById('timeSlotGroup').style.display = type === 'time' ? '' : 'none';
  document.querySelectorAll('#adminTimeSlots .time-slot-btn').forEach(b => b.classList.remove('selected'));
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#adminTimeSlots .time-slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#adminTimeSlots .time-slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBlockTime = btn.dataset.time;
    });
  });
});

async function loadBlocks() {
  const { data } = await window.db.from('schedule_blocks').select('*').order('block_date', { ascending: true });
  S.blocks = data || [];
  S.filteredBlocks = [...S.blocks];
  renderBlocks();
  renderCalendar();
}

function renderBlocks() {
  const tbody = document.getElementById('blocksBody');
  const footer = document.getElementById('blocksFooter');
  if (!tbody) return;
  const data = S.filteredBlocks;
  footer.textContent = `Showing ${data.length} of ${S.blocks.length} blocks`;
  tbody.innerHTML = data.length
    ? data.map(b => `<tr>
        <td style="font-weight:600">${fmt.date(b.block_date)}</td>
        <td>${b.block_type === 'day'
          ? '<span class="badge-blocked-day">🚫 Full Day</span>'
          : '<span class="badge-blocked-time">⏰ Time Slot</span>'}</td>
        <td>${b.block_type === 'time' ? fmt.time(b.block_time) : '<span class="text-muted">—</span>'}</td>
        <td class="text-sm text-muted">${b.reason || '—'}</td>
        <td><button class="btn-icon danger" onclick="removeBlock('${b.id}')">🗑 Remove</button></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="loading-cell">No blocks set.</td></tr>';
}

function filterBlocks() {
  const q = document.getElementById('blockSearch').value.toLowerCase();
  S.filteredBlocks = S.blocks.filter(b =>
    !q || fmt.date(b.block_date).toLowerCase().includes(q) || (b.reason || '').toLowerCase().includes(q)
  );
  renderBlocks();
}

async function addBlock() {
  const date = document.getElementById('blockDate').value;
  const reason = document.getElementById('blockReason').value.trim() || null;
  if (!date) { toast('Please select a date', 'error'); return; }
  if (blockType === 'time' && !selectedBlockTime) { toast('Please select a time slot', 'error'); return; }

  // Check for duplicate
  const dup = S.blocks.find(b =>
    b.block_date === date &&
    b.block_type === blockType &&
    (blockType === 'day' || b.block_time === selectedBlockTime + ':00')
  );
  if (dup) { toast('This date/time is already blocked', 'warning'); return; }

  const payload = {
    block_date: date,
    block_type: blockType,
    block_time: blockType === 'time' ? selectedBlockTime + ':00' : null,
    reason,
  };

  const { data, error } = await window.db.from('schedule_blocks').insert([payload]).select().single();
  if (error) { toast('Failed to add block: ' + error.message, 'error'); return; }
  S.blocks.push(data);
  S.filteredBlocks = [...S.blocks];
  renderBlocks();
  renderCalendar();
  // Reset form
  document.getElementById('blockDate').value = '';
  document.getElementById('blockReason').value = '';
  selectedBlockTime = null;
  document.querySelectorAll('#adminTimeSlots .time-slot-btn').forEach(b => b.classList.remove('selected'));
  toast('Block added! Customers cannot book this slot.');
}

async function removeBlock(id) {
  if (!confirm('Remove this block? Customers will be able to book this slot again.')) return;
  const { error } = await window.db.from('schedule_blocks').delete().eq('id', id);
  if (error) { toast('Failed to remove block', 'error'); return; }
  S.blocks = S.blocks.filter(b => b.id !== id);
  S.filteredBlocks = S.filteredBlocks.filter(b => b.id !== id);
  renderBlocks();
  renderCalendar();
  toast('Block removed!');
}

// ── MINI CALENDAR ──────────────────────────────────────
function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
}

function prevCalMonth() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); }
function nextCalMonth() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); }

function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  const grid = document.getElementById('calGrid');
  if (!label || !grid) return;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${months[calMonth]} ${calYear}`;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Build sets of blocked dates
  const blockedDaySet = new Set(S.blocks.filter(b => b.block_type === 'day').map(b => b.block_date));
  const timeBlockSet = new Set(S.blocks.filter(b => b.block_type === 'time').map(b => b.block_date));

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();

  let cells = '';
  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells += `<div class="cal-cell other-month">${daysInPrev - i}</div>`;
  }
  // This month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;
    const isBlockedDay = blockedDaySet.has(dateStr);
    const hasTimeBlocks = timeBlockSet.has(dateStr);
    let cls = 'cal-cell';
    if (isPast) cls += ' past';
    if (isToday) cls += ' today';
    if (isBlockedDay) cls += ' blocked-day';
    if (hasTimeBlocks) cls += ' has-time-blocks';
    const dot = (isBlockedDay || hasTimeBlocks) ? '<span class="cal-dot"></span>' : '';
    cells += `<div class="${cls}" title="${isBlockedDay ? 'Full day blocked' : hasTimeBlocks ? 'Some times blocked' : ''}">${d}${dot}</div>`;
  }
  // Next month padding
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    cells += `<div class="cal-cell other-month">${i}</div>`;
  }
  grid.innerHTML = cells;
}
