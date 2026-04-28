'use strict';

const CONFIG_KEY = 'roha_config';
const AUTH_KEY   = 'roha_session';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); }
  catch { return {}; }
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

async function sha256(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== DOM refs =====
const loginSection     = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm        = document.getElementById('login-form');
const loginError       = document.getElementById('login-error');

// ===== First-time check =====
async function initLogin() {
  const config = getConfig();
  if (!config.admin_password_hash) {
    document.getElementById('login-title').textContent    = 'Create Admin Password';
    document.getElementById('login-subtitle').textContent = 'Choose a password to protect the admin panel.';
    document.getElementById('confirm-group').style.display = 'block';
    document.getElementById('login-btn-text').textContent  = 'Set Password & Enter';
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';

  const password = document.getElementById('login-password').value;
  const config   = getConfig();

  if (!config.admin_password_hash) {
    // First-time: create password
    const confirm = document.getElementById('confirm-password').value;
    if (password.length < 6) {
      showError(loginError, 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      showError(loginError, 'Passwords do not match.');
      return;
    }
    config.admin_password_hash = await sha256(password);
    saveConfig(config);
  } else {
    const hash = await sha256(password);
    if (hash !== config.admin_password_hash) {
      showError(loginError, 'Incorrect password. Please try again.');
      return;
    }
  }

  sessionStorage.setItem(AUTH_KEY, '1');
  showDashboard();
});

// ===== Dashboard =====
function showDashboard() {
  loginSection.style.display    = 'none';
  dashboardSection.style.display = 'block';
  loadFormValues();
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  dashboardSection.style.display = 'none';
  loginSection.style.display     = 'block';
  document.getElementById('login-password').value = '';
}

// ===== Tabs =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== Load saved values into form =====
function loadFormValues() {
  const config = getConfig();
  const p      = config.property || {};

  setVal('prop-url',                p.url);
  setVal('prop-name',               p.name);
  setVal('prop-location',           p.location);
  setVal('prop-description',        p.description);
  setVal('prop-checkin-time',       p.checkin_time);
  setVal('prop-checkout-time',      p.checkout_time);
  setVal('prop-max-guests',         p.max_guests);
  setVal('prop-bedrooms',           p.bedrooms);
  setVal('prop-bathrooms',          p.bathrooms);

  setVal('prop-amenities',          p.amenities);
  setVal('prop-rules',              p.rules);
  setVal('prop-checkin-instructions', p.checkin_instructions);
  setVal('prop-faq',                p.faq);
  setVal('prop-additional',         p.additional_info);

  setVal('api-key',                 config.api_key);
  setVal('api-model',               config.model || 'claude-haiku-4-5-20251001');
  setVal('welcome-message',         config.welcome_message);

  const banner = document.getElementById('setup-banner');
  banner.style.display = config.api_key ? 'none' : 'block';
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.value = value;
}

// ===== Save handlers =====
function saveProperty() {
  const config = getConfig();
  config.property = {
    ...config.property,
    url:           document.getElementById('prop-url').value.trim(),
    name:          document.getElementById('prop-name').value.trim(),
    location:      document.getElementById('prop-location').value.trim(),
    description:   document.getElementById('prop-description').value.trim(),
    checkin_time:  document.getElementById('prop-checkin-time').value.trim(),
    checkout_time: document.getElementById('prop-checkout-time').value.trim(),
    max_guests:    document.getElementById('prop-max-guests').value.trim(),
    bedrooms:      document.getElementById('prop-bedrooms').value.trim(),
    bathrooms:     document.getElementById('prop-bathrooms').value.trim(),
  };
  saveConfig(config);
  flash('prop-save-msg');
}

function saveDetails() {
  const config = getConfig();
  config.property = {
    ...config.property,
    amenities:             document.getElementById('prop-amenities').value.trim(),
    rules:                 document.getElementById('prop-rules').value.trim(),
    checkin_instructions:  document.getElementById('prop-checkin-instructions').value.trim(),
    faq:                   document.getElementById('prop-faq').value.trim(),
    additional_info:       document.getElementById('prop-additional').value.trim(),
  };
  saveConfig(config);
  flash('details-save-msg');
}

function saveApiSettings() {
  const config = getConfig();
  config.api_key         = document.getElementById('api-key').value.trim();
  config.model           = document.getElementById('api-model').value;
  config.welcome_message = document.getElementById('welcome-message').value.trim();
  saveConfig(config);
  document.getElementById('setup-banner').style.display = config.api_key ? 'none' : 'block';
  flash('api-save-msg');
}

async function changePassword() {
  const curEl   = document.getElementById('cur-password');
  const newEl   = document.getElementById('new-password');
  const confEl  = document.getElementById('confirm-new-password');
  const errEl   = document.getElementById('pw-error');
  const sucEl   = document.getElementById('pw-success');

  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  const config   = getConfig();
  const curHash  = await sha256(curEl.value);

  if (curHash !== config.admin_password_hash) {
    showError(errEl, 'Current password is incorrect.');
    return;
  }
  if (newEl.value.length < 6) {
    showError(errEl, 'New password must be at least 6 characters.');
    return;
  }
  if (newEl.value !== confEl.value) {
    showError(errEl, 'New passwords do not match.');
    return;
  }

  config.admin_password_hash = await sha256(newEl.value);
  saveConfig(config);

  curEl.value = '';
  newEl.value = '';
  confEl.value = '';

  sucEl.textContent    = '✓ Password changed successfully!';
  sucEl.style.display  = 'block';
  setTimeout(() => { sucEl.style.display = 'none'; }, 3500);
}

// ===== Helpers =====
function showError(el, msg) {
  el.textContent    = msg;
  el.style.display  = 'block';
}

function flash(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2800);
}

// ===== Init =====
if (sessionStorage.getItem(AUTH_KEY)) {
  showDashboard();
} else {
  initLogin();
}
