// ==================== Utility ====================
const $ = id => document.getElementById(id);
const ls = localStorage;
const CONFIG_KEY = 'ai_chat_config';
const CONV_KEY   = 'ai_chat_conversations';
const ACTIVE_KEY = 'ai_chat_active_conv';
const PROMPTS_KEY = 'ai_chat_prompts';
const GROUPS_KEY = 'ai_chat_groups';
const HIDDEN_PROMPTS_KEY = 'ai_chat_hidden_prompts';
const API_CONFIGS_KEY = 'ai_chat_api_configs';
const ACTIVE_API_CONFIG_KEY = 'ai_chat_active_api_config';

function showToast(msg, type = 'info', duration = 3000) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.display = 'none'; }, duration);
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function getNow() { return new Date().toISOString(); }

// ==================== Collapse support ====================
const COLLAPSE_LENGTH = 200;
let msgFullContent = {};  // msgId -> full formatted HTML for collapsible messages

function toggleMessageCollapse(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const body = el.querySelector('.msg-body');
  const btn = el.querySelector('.collapse-toggle');
  if (!body || !btn) return;

  if (body.classList.contains('collapsed')) {
    body.classList.remove('collapsed');
    body.innerHTML = msgFullContent[id] || '';
    btn.textContent = '收起 ▴';
  } else {
    body.classList.add('collapsed');
    body.textContent = body.dataset.truncated || '…';
    btn.textContent = '展开 ▾';
  }
}

// ==================== Format content (markdown) ====================
function formatContent(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined') {
    return marked.parse(text, { breaks: true, gfm: true });
  }
  return escapeHtml(text);
}

// ==================== Mobile panel toggles ====================
function toggleMobilePanel(panel) {
  const el = panel === 'history'
    ? document.querySelector('.history-sidebar')
    : document.querySelector('.sidebar');
  const overlay = document.getElementById('mobileOverlay');
  const isOpen = el.classList.toggle('mobile-open');
  overlay.classList.toggle('active', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobilePanels() {
  document.querySelectorAll('.history-sidebar, .sidebar')
    .forEach(el => el.classList.remove('mobile-open'));
  const overlay = document.getElementById('mobileOverlay');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ==================== Input helpers ====================
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}
