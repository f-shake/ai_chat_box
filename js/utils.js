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

// ==================== File & Image Utilities ====================

const FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_MAX_DIMENSION = 2048;
const IMAGE_QUALITY = 0.8;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(1) + 'MB';
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    txt: '📝', md: '📝', csv: '📊', json: '📊', xml: '📊', yaml: '📊', yml: '📊', toml: '📊',
    docx: '📄', doc: '📄',
    js: '💻', py: '💻', html: '💻', css: '💻', ts: '💻', jsx: '💻', tsx: '💻', java: '💻', go: '💻', rs: '💻',
    sh: '💻', bat: '💻', ps1: '💻',
    pdf: '📕',
    zip: '🗜', rar: '🗜', '7z': '🗜',
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', webp: '🖼', svg: '🖼',
  };
  return icons[ext] || '📎';
}

function getFileCategory(file) {
  const mime = file.type;
  if (mime.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  return 'text';
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('文件读取失败'));
    r.readAsText(file, 'UTF-8');
  });
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('文件读取失败'));
    r.readAsArrayBuffer(file);
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('图片读取失败'));
    r.readAsDataURL(file);
  });
}

async function compressImage(dataUrl) {
  // Skip if it's a small GIF (likely animated)
  const rawSize = Math.round(dataUrl.length * 3 / 4);
  if (rawSize < 100 * 1024) return dataUrl;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
        const scale = IMAGE_MAX_DIMENSION / Math.max(width, height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (blob) {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        } else {
          resolve(dataUrl);
        }
      }, 'image/jpeg', IMAGE_QUALITY);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function readFileAsContent(file) {
  const category = getFileCategory(file);
  let content, mime = file.type;

  // Validate size for non-image files
  if (category !== 'image' && file.size > FILE_MAX_SIZE) {
    throw new Error(`文件过大 (${formatFileSize(file.size)})，最大支持 ${formatFileSize(FILE_MAX_SIZE)}`);
  }

  if (category === 'image') {
    const dataUrl = await readAsDataURL(file);
    content = await compressImage(dataUrl);
  } else if (category === 'docx') {
    if (typeof mammoth === 'undefined') throw new Error('mammoth.js 未加载，无法解析 .docx 文件');
    const buf = await readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    content = result.value || '';
    mime = 'text/plain';
  } else {
    content = await readAsText(file);
    mime = mime || 'text/plain';
  }

  return { name: file.name, size: file.size, mime, content, _type: category };
}

/**
 * Convert stored message content (string or array) to API-ready format.
 * File parts are merged into the text part; image_url parts stay as-is.
 */
function flattenContentForApi(content) {
  if (typeof content === 'string') return content;

  const textParts = [];
  const imageParts = [];

  for (const part of content) {
    if (part.type === 'text') {
      textParts.push(part.text);
    } else if (part.type === 'file') {
      textParts.push(`\n\n--- ${part.file.name} ---\n${part.file.content}`);
    } else if (part.type === 'image_url') {
      imageParts.push(part);
    }
  }

  if (imageParts.length === 0) {
    return textParts.join('').trim() || ' ';
  }

  // Vision API format: text + images
  const result = [];
  const combinedText = textParts.join('').trim();
  if (combinedText) result.push({ type: 'text', text: combinedText });
  result.push(...imageParts);
  return result;
}

/** Extract plain text from content (string or array) — for titles, previews, copy */
function extractTextParts(content) {
  if (typeof content === 'string') return content;
  return content
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join(' ')
    .trim();
}

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
    body.textContent = body.dataset.truncated ?? '';
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

// ==================== Theme ====================

/** Initialize theme: check saved preference, then system preference */
function initTheme() {
  const saved = ls.getItem('ai_chat_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let theme;
  if (saved === 'dark' || saved === 'light') {
    theme = saved;
  } else {
    theme = prefersDark ? 'dark' : 'light';
  }

  applyTheme(theme);
}

/** Apply theme and update button icon */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/** Toggle between light and dark */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { ls.setItem('ai_chat_theme', next); } catch (_) {}
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  const saved = ls.getItem('ai_chat_theme');
  if (!saved) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});

// ==================== Sidebar toggle ====================

function toggleSidebar() {
  const sidebar = document.getElementById('settingsSidebar');
  const btn = document.getElementById('sidebarToggleBtn');
  if (!sidebar) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  if (btn) {
    btn.classList.toggle('collapsed', collapsed);
    btn.textContent = collapsed ? '◀' : '▶';
  }
  try { ls.setItem('ai_chat_sidebar_collapsed', collapsed ? '1' : ''); } catch (_) {}
}

function initSidebar() {
  const sidebar = document.getElementById('settingsSidebar');
  const btn = document.getElementById('sidebarToggleBtn');
  if (!sidebar || !btn) return;
  const saved = ls.getItem('ai_chat_sidebar_collapsed');
  if (saved === '1') {
    sidebar.classList.add('collapsed');
    btn.classList.add('collapsed');
    btn.textContent = '◀';
  } else {
    btn.textContent = '▶';
  }
}

// ==================== Header dropdown ====================

function toggleDropdown() {
  const menu = document.getElementById('headerDropdown');
  if (!menu) return;
  menu.classList.toggle('hidden');
}

function closeDropdown() {
  const menu = document.getElementById('headerDropdown');
  if (menu) menu.classList.add('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const menu = document.getElementById('headerDropdown');
  if (!menu || menu.classList.contains('hidden')) return;
  if (!e.target.closest('.header-dropdown')) {
    menu.classList.add('hidden');
  }
});
