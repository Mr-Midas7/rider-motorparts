// ═══════════════════════════════════════════════════════
// RIDER MOTORPARTS — Main Application Script
// ═══════════════════════════════════════════════════════

'use strict';

// ── STATE ──────────────────────────────────────────────
const state = {
  currentStep: 1,
  selectedServiceId: null,
  selectedServiceName: null,
  selectedServiceCat: null,
  selectedServicePrice: null,
  selectedServiceDuration: null,
  services: [],
  products: [],
  testimonials: [],
};

// ── UTILITY ────────────────────────────────────────────
function formatPrice(p) {
  return '₱' + Number(p).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
}

function showToast(msg, type = 'success', duration = 4000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => { t.classList.add('hidden'); }, duration);
}

function setLoading(btnId, spinnerId, loading) {
  const btn = document.getElementById(btnId);
  const sp = document.getElementById(spinnerId);
  if (btn) btn.disabled = loading;
  if (sp) sp.classList.toggle('hidden', !loading);
}

function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ── LOADER ────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('done');
  }, 2000);
});

// ── NAVBAR ────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

document.getElementById('navBurger').addEventListener('click', () => {
  document.getElementById('navMobile').classList.toggle('open');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-mobile a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navMobile').classList.remove('open');
  });
});

// ── REVEAL ON SCROLL ──────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

// ── SCHEDULE BLOCKS (customer-facing) ─────────────────
const scheduleBlocks = { days: new Set(), times: {} }; // times: { 'YYYY-MM-DD': Set(['08:00','09:00',...]) }

async function loadScheduleBlocks() {
  try {
    const { data } = await window.db.from('schedule_blocks').select('block_date, block_type, block_time');
    (data || []).forEach(b => {
      const d = b.block_date;
      if (b.block_type === 'day') {
        scheduleBlocks.days.add(d);
      } else if (b.block_type === 'time' && b.block_time) {
        if (!scheduleBlocks.times[d]) scheduleBlocks.times[d] = new Set();
        scheduleBlocks.times[d].add(b.block_time.slice(0, 5)); // normalize to HH:MM
      }
    });
  } catch (e) {
    console.warn('Could not load schedule blocks:', e);
  }
}

function refreshTimeSlots(dateStr) {
  const select = document.getElementById('apptTime');
  if (!select) return;
  const ALL_SLOTS = [
    { value: '08:00', label: '8:00 AM' },
    { value: '09:00', label: '9:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '13:00', label: '1:00 PM' },
    { value: '14:00', label: '2:00 PM' },
    { value: '15:00', label: '3:00 PM' },
    { value: '16:00', label: '4:00 PM' },
  ];
  const dayBlocked = scheduleBlocks.days.has(dateStr);
  const timeBlocked = scheduleBlocks.times[dateStr] || new Set();
  select.innerHTML = '<option value="">Select a time</option>';
  let hasAvailable = false;
  ALL_SLOTS.forEach(slot => {
    const blocked = dayBlocked || timeBlocked.has(slot.value);
    const opt = document.createElement('option');
    opt.value = blocked ? '' : slot.value;
    opt.textContent = blocked ? `${slot.label} — Unavailable` : slot.label;
    opt.disabled = blocked;
    if (blocked) opt.style.color = '#888';
    else hasAvailable = true;
    select.appendChild(opt);
  });
  if (!hasAvailable) {
    select.innerHTML = '<option value="" disabled>No available times for this day</option>';
  }
}

// ── SET MIN DATE FOR BOOKING ──────────────────────────
(function setMinDate() {
  const input = document.getElementById('apptDate');
  if (!input) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  input.min = tomorrow.toISOString().split('T')[0];
  input.addEventListener('change', async function () {
    const val = this.value;
    if (!val) return;
    // Check if whole day is blocked
    if (scheduleBlocks.days.has(val)) {
      showToast('This date is fully booked / unavailable. Please choose another day.', 'error');
      this.value = '';
      return;
    }
    // Refresh time slots for new date
    refreshTimeSlots(val);
  });
})();

// ── LOAD SERVICES ─────────────────────────────────────
async function loadServices() {
  try {
    const { data, error } = await window.db
      .from('services')
      .select('*')
      .eq('active', true)
      .order('category');

    if (error) throw error;
    state.services = data || [];
    renderServices(state.services, 'all');
    renderServiceSelect(state.services, 'all');
  } catch (err) {
    console.error('Failed to load services:', err);
    renderFallbackServices();
  }
}

function renderServices(services, filter) {
  const grid = document.getElementById('servicesGrid');
  const filtered = filter === 'all' ? services : services.filter(s => s.category === filter);

  if (!filtered.length) {
    grid.innerHTML = '<div class="services-loading">No services found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="service-card reveal">
      <div class="service-card-icon">${s.icon || '🔧'}</div>
      <div class="service-card-cat">${s.category}</div>
      <h4>${s.name}</h4>
      <p>${s.description || ''}</p>
      <div class="service-card-footer">
        <span class="service-price">From ${formatPrice(s.base_price)}</span>
        <span class="service-duration">~${s.duration_minutes} min</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

function renderServiceSelect(services, filter) {
  const grid = document.getElementById('serviceSelectGrid');
  if (!grid) return;
  const filtered = filter === 'all' ? services : services.filter(s => s.category === filter);

  grid.innerHTML = filtered.map(s => `
    <div class="service-option ${state.selectedServiceId === s.id ? 'selected' : ''}"
      onclick="selectService('${s.id}', '${s.name.replace(/'/g,"\\'")}', '${s.category}', ${s.base_price}, ${s.duration_minutes})">
      <div class="so-icon">${s.icon || '🔧'}</div>
      <div class="so-name">${s.name}</div>
      <div class="so-price">${formatPrice(s.base_price)}</div>
      <div class="so-duration">~${s.duration_minutes} min</div>
    </div>
  `).join('');

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:1rem">No services in this category.</p>';
  }
}

function renderFallbackServices() {
  // Fallback with static data if Supabase is not configured
  const fallback = [
    { id: '1', icon: '🔧', category: 'repair', name: 'Full Engine Tune-Up', description: 'Complete engine inspection and optimization.', base_price: 1200, duration_minutes: 120 },
    { id: '2', icon: '🛑', category: 'repair', name: 'Brake System Overhaul', description: 'Brake pads, rotor, and fluid service.', base_price: 800, duration_minutes: 90 },
    { id: '3', icon: '🛢️', category: 'maintenance', name: 'Oil Change & Filter', description: 'Premium synthetic oil change with filter.', base_price: 350, duration_minutes: 30 },
    { id: '4', icon: '⚙️', category: 'maintenance', name: 'Carburetor Cleaning', description: 'Deep clean and calibration for fuel efficiency.', base_price: 500, duration_minutes: 60 },
    { id: '5', icon: '💨', category: 'upgrade', name: 'Exhaust System Upgrade', description: 'Performance exhaust installation.', base_price: 2500, duration_minutes: 150 },
    { id: '6', icon: '💡', category: 'accessories', name: 'LED Lighting Kit', description: 'Full LED conversion installation.', base_price: 1500, duration_minutes: 90 },
  ];
  state.services = fallback;
  renderServices(fallback, 'all');
  renderServiceSelect(fallback, 'all');
}

// Services filter
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderServices(state.services, this.dataset.filter);
  });
});

// Service select category filter
document.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-scat]');
  if (!btn) return;
  btn.closest('.service-select-filter').querySelectorAll('[data-scat]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderServiceSelect(state.services, btn.dataset.scat);
});

// ── SELECT SERVICE ────────────────────────────────────
window.selectService = function (id, name, cat, price, duration) {
  state.selectedServiceId = id;
  state.selectedServiceName = name;
  state.selectedServiceCat = cat;
  state.selectedServicePrice = price;
  state.selectedServiceDuration = duration;
  clearError('errService');
  document.querySelectorAll('.service-option').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
};

// ── LOAD PRODUCTS ─────────────────────────────────────
async function loadProducts() {
  try {
    const { data, error } = await window.db
      .from('products')
      .select('*')
      .order('featured', { ascending: false });

    if (error) throw error;
    state.products = data || [];
    renderProducts(state.products, 'all');
  } catch (err) {
    console.error('Failed to load products:', err);
    renderFallbackProducts();
  }
}

function renderProducts(products, filter) {
  const grid = document.getElementById('productsGrid');
  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);

  if (!filtered.length) {
    grid.innerHTML = '<div class="services-loading">No products found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="product-card reveal" style="position:relative">
      ${p.featured ? '<span class="featured-badge">★ FEATURED</span>' : ''}
      <div class="product-img">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML='🔩'">`
          : '🔩'
        }
      </div>
      <div class="product-body">
        <div class="product-cat">${p.category}</div>
        <div class="product-name">${p.name}</div>
        <p class="product-desc">${p.description || ''}</p>
      </div>
      <div class="product-footer">
        <span class="product-price">${formatPrice(p.price)}</span>
        <span class="product-stock ${p.stock < 5 ? 'low' : ''}">
          ${p.stock > 0 ? (p.stock < 5 ? `Only ${p.stock} left!` : `In Stock`) : 'Out of Stock'}
        </span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

function renderFallbackProducts() {
  const fallback = [
    { id:'1', name: 'Yoshimura R-77 Exhaust', category: 'upgrades', description: 'Full titanium exhaust with carbon fiber end cap.', price: 15999, stock: 5, featured: true, image_url: null },
    { id:'2', name: 'Michelin Pilot Road 5', category: 'parts', description: 'Premium touring tire. 180/55 ZR17.', price: 4500, stock: 20, featured: true, image_url: null },
    { id:'3', name: 'Shoei NXR2 Helmet', category: 'accessories', description: 'Full-face racing helmet with Pinlock visor.', price: 22000, stock: 12, featured: true, image_url: null },
    { id:'4', name: 'Brembo Brake Caliper', category: 'upgrades', description: 'Racing-spec 4-piston radial brake caliper.', price: 18500, stock: 4, featured: true, image_url: null },
    { id:'5', name: 'NGK Iridium Spark Plugs', category: 'parts', description: 'Premium iridium plugs (4pcs).', price: 1200, stock: 50, featured: false, image_url: null },
    { id:'6', name: 'Motul 7100 Engine Oil', category: 'maintenance', description: '4T fully synthetic ester oil. 10W-40.', price: 650, stock: 100, featured: false, image_url: null },
  ];
  state.products = fallback;
  renderProducts(fallback, 'all');
}

document.querySelectorAll('[data-pfilter]').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('[data-pfilter]').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderProducts(state.products, this.dataset.pfilter);
  });
});

// ── LOAD TESTIMONIALS ─────────────────────────────────
async function loadTestimonials() {
  try {
    const { data, error } = await window.db
      .from('testimonials')
      .select('*')
      .eq('featured', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    state.testimonials = data || [];
    renderTestimonials(state.testimonials);
  } catch (err) {
    renderFallbackTestimonials();
  }
}

function renderTestimonials(testimonials) {
  const track = document.getElementById('testimonialsTrack');
  if (!testimonials.length) return;

  track.innerHTML = testimonials.map(t => `
    <div class="testi-card reveal">
      <span class="testi-quote">"</span>
      <div class="testi-stars">${'★'.repeat(t.rating || 5)}</div>
      <p class="testi-text">${t.message}</p>
      <div class="testi-author">
        <div class="testi-avatar">${t.customer_name.charAt(0)}</div>
        <div>
          <div class="testi-name">${t.customer_name}</div>
          <div class="testi-moto">${t.motorcycle || 'Valued Customer'}</div>
        </div>
      </div>
    </div>
  `).join('');

  track.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

function renderFallbackTestimonials() {
  const fallback = [
    { customer_name: 'Marco Reyes', motorcycle: 'Honda CBR600RR', rating: 5, message: 'Rider Motorparts transformed my CBR! The ECU remap and exhaust upgrade gave me insane power gains. Professional team, clean work!' },
    { customer_name: 'Jake Santos', motorcycle: 'Yamaha R3', rating: 5, message: 'Best shop in the city. Brought in my R3 for a full suspension setup and the bike handles like a dream now. Highly recommend!' },
    { customer_name: 'Ana Cruz', motorcycle: 'Kawasaki Ninja 400', rating: 5, message: 'They installed my LED kit and windshield in one visit. Fast, affordable, and the results are stunning. My Ninja looks brand new!' },
    { customer_name: 'Carlo Mendoza', motorcycle: 'Suzuki GSX-R150', rating: 4, message: 'Great service for my GSXRs tune-up. On time, transparent pricing, and they explained everything. Will be back for sure.' },
    { customer_name: 'Paolo Garcia', motorcycle: 'Ducati Monster 821', rating: 5, message: 'Trusted them with my Ducati and they delivered. Full brake overhaul and chain service done perfectly. These guys know their stuff!' },
  ];
  renderTestimonials(fallback);
}

// ── MULTI-STEP FORM ───────────────────────────────────
function gotoStep(n) {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step${i}`);
    if (step) step.classList.toggle('active', i === n);
    const sidebar = document.querySelector(`.step[data-step="${i}"]`);
    if (sidebar) {
      sidebar.classList.toggle('active', i === n);
      sidebar.classList.toggle('done', i < n);
    }
  }
  state.currentStep = n;
  document.getElementById('bookingForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.nextStep = function (from) {
  if (from === 1 && !validateStep1()) return;
  if (from === 2 && !validateStep2()) return;
  if (from === 3 && !validateStep3()) return;
  if (from === 4) { return; }

  if (from === 3) buildSummary();
  gotoStep(from + 1);
};

window.prevStep = function (from) {
  gotoStep(from - 1);
};

function validateStep1() {
  let ok = true;
  const name = document.getElementById('customerName').value.trim();
  const email = document.getElementById('customerEmail').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  clearError('errName'); clearError('errEmail'); clearError('errPhone');

  if (!name) { setError('errName', 'Full name is required.'); ok = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('errEmail', 'Valid email required.'); ok = false; }
  if (!phone) { setError('errPhone', 'Phone number is required.'); ok = false; }
  return ok;
}

function validateStep2() {
  let ok = true;
  const brand = document.getElementById('motosBrand').value;
  const model = document.getElementById('motosModel').value.trim();
  clearError('errBrand'); clearError('errModel');

  if (!brand) { setError('errBrand', 'Select your motorcycle brand.'); ok = false; }
  if (!model) { setError('errModel', 'Enter your motorcycle model.'); ok = false; }
  return ok;
}

function validateStep3() {
  clearError('errService');
  if (!state.selectedServiceId) {
    setError('errService', 'Please select a service.');
    return false;
  }
  return true;
}

function buildSummary() {
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;

  document.getElementById('bookingSummary').innerHTML = `
    <div class="summary-title">📋 Booking Summary</div>
    <div class="summary-row">
      <span>Customer</span>
      <span>${document.getElementById('customerName').value}</span>
    </div>
    <div class="summary-row">
      <span>Motorcycle</span>
      <span>${document.getElementById('motosBrand').value} ${document.getElementById('motosModel').value} ${document.getElementById('motosYear').value || ''}</span>
    </div>
    <div class="summary-row">
      <span>Service</span>
      <span>${state.selectedServiceName}</span>
    </div>
    <div class="summary-row">
      <span>Category</span>
      <span>${state.selectedServiceCat}</span>
    </div>
    <div class="summary-row">
      <span>Duration</span>
      <span>~${state.selectedServiceDuration} minutes</span>
    </div>
    <div class="summary-row">
      <span>Date</span>
      <span>${formatDate(date)}</span>
    </div>
    <div class="summary-row">
      <span>Time</span>
      <span>${formatTime(time)}</span>
    </div>
    <div class="summary-row">
      <span>Base Price</span>
      <span style="color:var(--yellow);font-size:1.1rem">${formatPrice(state.selectedServicePrice)}</span>
    </div>
  `;
}

// ── SUBMIT BOOKING ─────────────────────────────────────
window.submitBooking = async function () {
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;
  clearError('errDate'); clearError('errTime');

  let ok = true;
  if (!date) { setError('errDate', 'Select an appointment date.'); ok = false; }
  if (!time) { setError('errTime', 'Select a time slot.'); ok = false; }
  if (!ok) return;

  setLoading('submitBtn', 'submitSpinner', true);
  document.getElementById('submitText').textContent = 'Booking...';

  const payload = {
    customer_name: document.getElementById('customerName').value.trim(),
    customer_email: document.getElementById('customerEmail').value.trim(),
    customer_phone: document.getElementById('customerPhone').value.trim(),
    motorcycle_brand: document.getElementById('motosBrand').value,
    motorcycle_model: document.getElementById('motosModel').value.trim(),
    motorcycle_year: parseInt(document.getElementById('motosYear').value) || null,
    motorcycle_plate: document.getElementById('motosPlate').value.trim() || null,
    service_id: state.selectedServiceId === '1' || isNaN(state.selectedServiceId) ? null : state.selectedServiceId,
    service_name: state.selectedServiceName,
    service_category: state.selectedServiceCat,
    appointment_date: date,
    appointment_time: time,
    additional_notes: document.getElementById('additionalNotes').value.trim() || null,
    status: 'pending',
  };

  try {
    const { data, error } = await window.db
      .from('appointments')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    // Show success
    const ref = data.booking_ref || 'RMP-' + Math.random().toString(36).substr(2, 8).toUpperCase();
    document.getElementById('successRef').textContent = ref;

    // Hide all steps
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.getElementById('stepSuccess').classList.add('active');

    showToast('Appointment booked successfully! 🏍️', 'success', 6000);

  } catch (err) {
    console.error('Booking error:', err);

    // Demo mode: show success anyway with fake ref
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
      const fakeRef = 'RMP-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      document.getElementById('successRef').textContent = fakeRef;
      document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
      document.getElementById('stepSuccess').classList.add('active');
      showToast('Demo mode: Booking simulated! Connect Supabase to save real data.', 'success', 6000);
    } else {
      showToast('Booking failed. Please try again.', 'error');
    }
  } finally {
    setLoading('submitBtn', 'submitSpinner', false);
    document.getElementById('submitText').textContent = 'Confirm Booking';
  }
};

// ── RESET BOOKING ─────────────────────────────────────
window.newBooking = function () {
  // Reset form
  ['customerName','customerEmail','customerPhone',
   'motosModel','motosYear','motosPlate',
   'additionalNotes','apptDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('motosBrand').value = '';
  document.getElementById('apptTime').value = '';

  state.selectedServiceId = null;
  state.selectedServiceName = null;
  state.selectedServiceCat = null;
  state.selectedServicePrice = null;

  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  gotoStep(1);
  document.getElementById('step1').classList.add('active');
  document.getElementById('book').scrollIntoView({ behavior: 'smooth' });
};

// ── LOOKUP BOOKING ─────────────────────────────────────
window.lookupBooking = async function () {
  const input = document.getElementById('lookupInput').value.trim();
  if (!input) {
    showToast('Enter a booking reference or email.', 'error');
    return;
  }

  setLoading('lookupText', 'lookupSpinner', true);
  const resultDiv = document.getElementById('lookupResult');
  resultDiv.innerHTML = '';

  try {
    let query = window.db.from('appointments').select('*');

    if (input.toUpperCase().startsWith('RMP-')) {
      query = query.eq('booking_ref', input.toUpperCase());
    } else {
      query = query.eq('customer_email', input.toLowerCase());
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(5);
    if (error) throw error;

    if (!data || !data.length) {
      resultDiv.innerHTML = '<div class="lookup-err">No appointment found with that reference or email.</div>';
      return;
    }

    resultDiv.innerHTML = data.map(appt => `
      <div class="lookup-result-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem">
          <h4>🏍️ ${appt.motorcycle_brand} ${appt.motorcycle_model}</h4>
          <span class="status-badge status-${appt.status}">${appt.status.replace('_', ' ')}</span>
        </div>
        <div class="summary-row"><span>Booking Ref</span><span style="color:var(--yellow);font-weight:700">${appt.booking_ref}</span></div>
        <div class="summary-row"><span>Customer</span><span>${appt.customer_name}</span></div>
        <div class="summary-row"><span>Service</span><span>${appt.service_name}</span></div>
        <div class="summary-row"><span>Date</span><span>${formatDate(appt.appointment_date)}</span></div>
        <div class="summary-row"><span>Time</span><span>${formatTime(appt.appointment_time)}</span></div>
        <div class="summary-row"><span>Plate</span><span>${appt.motorcycle_plate || 'N/A'}</span></div>
        <div class="summary-row"><span>Year</span><span>${appt.motorcycle_year || 'N/A'}</span></div>
        ${appt.additional_notes ? `<div class="summary-row"><span>Notes</span><span>${appt.additional_notes}</span></div>` : ''}
        <div class="summary-row"><span>Booked On</span><span>${new Date(appt.created_at).toLocaleDateString('en-PH')}</span></div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Lookup error:', err);
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
      resultDiv.innerHTML = '<div class="lookup-err">Demo mode: Connect Supabase to enable real booking lookups.</div>';
    } else {
      resultDiv.innerHTML = '<div class="lookup-err">Error fetching booking. Please try again.</div>';
    }
  } finally {
    document.getElementById('lookupText').textContent = 'Search';
    document.getElementById('lookupSpinner').classList.add('hidden');
    const btn = document.querySelector('#lookup .btn-primary');
    if (btn) btn.disabled = false;
  }
};

// Allow Enter key on lookup input
document.getElementById('lookupInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') lookupBooking();
});

// ── INIT ───────────────────────────────────────────────
(async function init() {
  await Promise.all([
    loadServices(),
    loadProducts(),
    loadTestimonials(),
    loadScheduleBlocks(),
  ]);

  // Observe all existing reveal elements
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
})();
