// ==================== 搜索配置管理 ====================

const SEARCH_DEFAULTS = {
  proxyUrl: 'http://localhost:3456',
  enabled: false,
};

let searchConfig = { ...SEARCH_DEFAULTS };

function loadSearchConfig() {
  try {
    const raw = ls.getItem(SEARCH_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      searchConfig = {
        proxyUrl: parsed.proxyUrl || SEARCH_DEFAULTS.proxyUrl,
        enabled: parsed.enabled === true,
      };
    }
  } catch (_) {
    searchConfig = { ...SEARCH_DEFAULTS };
  }
}

function saveSearchConfig() {
  try {
    ls.setItem(SEARCH_CONFIG_KEY, JSON.stringify(searchConfig));
  } catch (_) {}
}

/** 将 UI 控件的值同步到配置并保存 */
function applySearchConfigFromUI() {
  searchConfig.proxyUrl = ($('proxyUrl').value || SEARCH_DEFAULTS.proxyUrl).trim();
  searchConfig.preferredEngine = $('preferredEngine').value || SEARCH_DEFAULTS.preferredEngine;
  saveSearchConfig();
}

/** UI 中"启用联网搜索"主开关变化 */
function onSearchEnabledChange(checked) {
  searchConfig.enabled = checked;
  // 同步输入栏的搜索切换开关
  const toggle = $('webSearchToggle');
  if (toggle) toggle.checked = checked;
  saveSearchConfig();
}

/** 输入栏的 🌐 搜索开关变化 */
function toggleWebSearch() {
  const toggle = $('webSearchToggle');
  if (!toggle) return;
  searchConfig.enabled = toggle.checked;
  // 同步设置面板的开关
  const enabledCb = $('searchEnabled');
  if (enabledCb) enabledCb.checked = searchConfig.enabled;
  saveSearchConfig();
  if (searchConfig.enabled && !searchConfig.proxyUrl) {
    showToast('请先在搜索设置中配置代理地址', 'info');
  }
}

// ==================== 搜索代理调用 ====================

/**
 * 调用本地搜索代理执行搜索
 * @param {string} query 搜索关键词
 * @param {number} count 返回结果数量
 * @returns {Promise<Array<{title:string, url:string, snippet:string}>>}
 */
async function searchWeb(query, count = 8) {
  if (!searchConfig.proxyUrl) {
    showToast('未配置搜索代理地址，请在搜索设置中填写', 'error');
    throw new Error('未配置搜索代理地址');
  }
  let resp;
  try {
    resp = await fetch(`${searchConfig.proxyUrl}/api/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
  } catch (e) {
    showToast('搜索代理连接失败，请确认已启动 node server.js', 'error');
    throw new Error('搜索代理不可用: ' + e.message);
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `搜索请求失败 (${resp.status})`);
  }
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.results || []; // 搜到几个就返回几个，不限制数量
}

/**
 * 调用本地代理抓取指定 URL 的内容
 * @param {string} targetUrl 目标网址
 * @returns {Promise<string>} 页面文本内容
 */
async function fetchWebpage(targetUrl) {
  if (!searchConfig.proxyUrl) {
    showToast('未配置搜索代理地址，请在搜索设置中填写', 'error');
    throw new Error('未配置搜索代理地址');
  }
  let resp;
  try {
    resp = await fetch(`${searchConfig.proxyUrl}/api/fetch?url=${encodeURIComponent(targetUrl)}`, { signal: AbortSignal.timeout(20000) });
  } catch (e) {
    showToast('搜索代理连接失败，请确认已启动 node server.js', 'error');
    throw new Error('搜索代理不可用: ' + e.message);
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `抓取请求失败 (${resp.status})`);
  }
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.content || '';
}

// ==================== 连接测试 ====================

async function testSearchProxy() {
  const statusEl = $('proxyStatus');
  const testBtn = $('proxyUrl');
  if (!statusEl) return;

  const proxyUrl = ($('proxyUrl').value || '').trim();
  if (!proxyUrl) {
    statusEl.textContent = '❌ 请先输入代理地址';
    statusEl.style.color = 'var(--danger, #ef4444)';
    return;
  }

  statusEl.textContent = '⏳ 测试中…';
  statusEl.style.color = 'var(--text-tertiary, #888)';

  try {
    const resp = await fetch(`${proxyUrl}/api/status`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.status === 'ok') {
      statusEl.textContent = '✅ 连接成功，引擎: ' + (data.engines || []).join(', ');
      statusEl.style.color = 'var(--success, #22c55e)';
      // 保存代理地址到配置
      searchConfig.proxyUrl = proxyUrl;
      saveSearchConfig();
    } else {
      throw new Error('代理返回异常状态');
    }
  } catch (e) {
    statusEl.textContent = '❌ 连接失败: ' + e.message;
    statusEl.style.color = 'var(--danger, #ef4444)';
  }
}

/** 渲染搜索配置面板（填充当前值） */
function renderSearchConfig() {
  const proxyUrlEl = $('proxyUrl');
  const enabledEl = $('searchEnabled');
  if (proxyUrlEl) proxyUrlEl.value = searchConfig.proxyUrl || SEARCH_DEFAULTS.proxyUrl;
  if (enabledEl) enabledEl.checked = searchConfig.enabled === true;
}
