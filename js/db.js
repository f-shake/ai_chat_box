// ==================== IndexedDB storage backend ====================
// Replaces localStorage for ai_chat_* keys. Provides much larger storage
// (~50MB+ vs localStorage's ~5MB), enabling image-heavy conversations.
//
// How it works:
//   1. initDB() opens IndexedDB, loads all records into an in-memory cache
//   2. Overrides localStorage methods so the existing `ls` reference works unchanged
//   3. All ai_chat_* keys go to IndexedDB; other keys keep using original localStorage
//   4. On first run, migrates existing data from localStorage

const DB_NAME = 'ai_chat_box_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let _db = null;
let _dbReady = false;
const _cache = new Map();

/**
 * Initialize IndexedDB, load cache, migrate from localStorage if needed.
 * Must be called once at startup before any data reads.
 */
async function initDB() {
  if (_dbReady) return;

  try {
    // 1. Open database
    _db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME))
          d.createObjectStore(STORE_NAME, { keyPath: 'k' });
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });

    // 2. Load all records into cache
    const records = await new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    for (const { k, v } of records) {
      _cache.set(k, v);
    }

    // 3. Migrate from localStorage if cache is empty
    if (_cache.size === 0) {
      let hasChatData = false;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ai_chat_')) {
          _cache.set(k, localStorage.getItem(k));
          hasChatData = true;
        }
      }
      if (hasChatData) {
        // Flush migrated data to IndexedDB
        const tx = _db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const [k, v] of _cache) store.put({ k, v });
        await new Promise(r => { tx.oncomplete = r; });
        // Clear old localStorage entries
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('ai_chat_')) localStorage.removeItem(k);
        }
        console.log('[db] Migrated data from localStorage to IndexedDB');
      }
    }

    // 4. Override localStorage methods so existing `ls` reference picks them up
    _overrideLocalStorage();

    _dbReady = true;
    console.log('[db] IndexedDB ready, cache size:', _cache.size);
  } catch (e) {
    console.warn('[db] IndexedDB init failed, using localStorage:', e.message);
    _dbReady = true; // continue with original localStorage
  }
}

function _overrideLocalStorage() {
  const origGetItem = localStorage.getItem.bind(localStorage);
  const origSetItem = localStorage.setItem.bind(localStorage);
  const origRemoveItem = localStorage.removeItem.bind(localStorage);
  const origClear = localStorage.clear.bind(localStorage);

  localStorage.getItem = function(key) {
    if (key && key.startsWith('ai_chat_')) return _cache.get(key) || null;
    return origGetItem(key);
  };

  localStorage.setItem = function(key, value) {
    _cache.set(key, value);
    if (key && key.startsWith('ai_chat_')) {
      if (_db) {
        try {
          const tx = _db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put({ k: key, v: value });
        } catch (_) {}
      }
    } else {
      origSetItem(key, value);
    }
  };

  localStorage.removeItem = function(key) {
    _cache.delete(key);
    if (key && key.startsWith('ai_chat_')) {
      if (_db) {
        try {
          const tx = _db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(key);
        } catch (_) {}
      }
    } else {
      origRemoveItem(key);
    }
  };

  localStorage.clear = function() {
    _cache.clear();
    if (_db) {
      try {
        const tx = _db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      } catch (_) {}
    }
    origClear();
  };
}

// ==================== Import / Export ====================

/** Collect selected data for export */
function collectExportData(selection) {
  const data = { exportedAt: new Date().toISOString(), version: 1 };

  if (selection.prompts) {
    data.groups = JSON.parse(ls.getItem('ai_chat_groups') || '[]');
    data.prompts = JSON.parse(ls.getItem('ai_chat_prompts') || '[]');
    data.hiddenPrompts = JSON.parse(ls.getItem('ai_chat_hidden_prompts') || '[]');
  }
  if (selection.apiConfigs) {
    data.apiConfigs = JSON.parse(ls.getItem('ai_chat_api_configs') || '[]');
    data.activeApiConfigId = ls.getItem('ai_chat_active_api_config') || null;
  }
  if (selection.conversations) {
    data.conversations = JSON.parse(ls.getItem('ai_chat_conversations') || '[]');
    data.activeConvId = ls.getItem('ai_chat_active_conv') || null;
  }

  return data;
}

/** Download data as JSON file */
function downloadExport(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-chat-box-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import data from a JSON object, merging into existing storage */
function importData(data, selection) {
  const results = [];

  if (selection.prompts && data.prompts) {
    ls.setItem('ai_chat_prompts', JSON.stringify(data.prompts));
    ls.setItem('ai_chat_groups', JSON.stringify(data.groups || []));
    ls.setItem('ai_chat_hidden_prompts', JSON.stringify(data.hiddenPrompts || []));
    results.push(`智能体: ${data.prompts.length} 个`);
  }
  if (selection.apiConfigs && data.apiConfigs) {
    ls.setItem('ai_chat_api_configs', JSON.stringify(data.apiConfigs));
    if (data.activeApiConfigId) {
      ls.setItem('ai_chat_active_api_config', data.activeApiConfigId);
    }
    results.push(`服务清单: ${data.apiConfigs.length} 个`);
  }
  if (selection.conversations && data.conversations) {
    ls.setItem('ai_chat_conversations', JSON.stringify(data.conversations));
    if (data.activeConvId) {
      ls.setItem('ai_chat_active_conv', data.activeConvId);
    }
    results.push(`对话历史: ${data.conversations.length} 个`);
  }

  return results;
}

/** Show export dialog: JSON multi-select OR CSV single-option */
function showExportDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'prompt-dialog-overlay';
  overlay.innerHTML = `
    <div class="prompt-dialog" style="width:420px">
      <h3>导出数据</h3>

      <div style="margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;padding:6px 0">
          <input type="radio" name="exportMode" value="json" checked onchange="toggleExportMode()">
          <span>📦 JSON 导出（可导入）</span>
        </label>
        <div id="exportJsonOptions" style="padding:4px 0 4px 28px;display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
            <input type="checkbox" checked data-key="prompts"> 🤖 智能体清单
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
            <input type="checkbox" checked data-key="apiConfigs"> 🔌 服务清单
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
            <input type="checkbox" checked data-key="conversations"> 💬 问答历史
          </label>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;padding:6px 0">
          <input type="radio" name="exportMode" value="csv" onchange="toggleExportMode()">
          <span>📄 CSV 导出（当前条问答，不可导入）</span>
        </label>
      </div>

      <div class="dialog-actions">
        <button class="btn-cancel" onclick="this.closest('.prompt-dialog-overlay').remove()">取消</button>
        <button class="btn-confirm" onclick="doExport(this)">导出</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  window.toggleExportMode = function() {
    const mode = document.querySelector('input[name="exportMode"]:checked')?.value;
    const jsonOpts = document.getElementById('exportJsonOptions');
    if (jsonOpts) jsonOpts.style.opacity = mode === 'json' ? '1' : '0.4';
  };

  window.doExport = function(btn) {
    const dialog = btn.closest('.prompt-dialog');
    const mode = dialog.querySelector('input[name="exportMode"]:checked')?.value;

    if (mode === 'csv') {
      overlay.remove();
      delete window.toggleExportMode;
      delete window.doExport;
      exportChat();
      return;
    }

    // JSON export
    const checks = dialog.querySelectorAll('#exportJsonOptions input[type="checkbox"]');
    const selection = {};
    checks.forEach(c => { selection[c.dataset.key] = c.checked; });
    if (!Object.values(selection).some(Boolean)) {
      showToast('请至少选择一项', 'error');
      return;
    }
    const data = collectExportData(selection);
    downloadExport(data);
    overlay.remove();
    showToast('导出成功', 'success');
    delete window.toggleExportMode;
    delete window.doExport;
  };
}

/** Handle import: file picker → read JSON → preview → confirm */
function showImportDialog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) throw new Error('无效的导出文件');
        _showImportPreview(data);
      } catch (err) {
        showToast('导入失败: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  };
  input.click();
}

function _showImportPreview(data) {
  // Store data globally so inline onclick can access it
  window._importData = data;

  const overlay = document.createElement('div');
  overlay.className = 'prompt-dialog-overlay';
  overlay.innerHTML = `
    <div class="prompt-dialog" style="width:420px">
      <h3>导入数据</h3>
      <p style="font-size:13px;color:#888;margin:0 0 12px">
        文件包含以下数据，选择要导入的内容（将覆盖当前数据）：
      </p>
      <div class="export-checkboxes" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
          <input type="checkbox" checked data-key="prompts">
          <span>🤖 智能体 ${data.prompts ? '(' + data.prompts.length + ' 个)' : '(无)'}</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
          <input type="checkbox" checked data-key="apiConfigs">
          <span>🔌 服务清单 ${data.apiConfigs ? '(' + data.apiConfigs.length + ' 个)' : '(无)'}</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
          <input type="checkbox" checked data-key="conversations">
          <span>💬 对话历史 ${data.conversations ? '(' + data.conversations.length + ' 个)' : '(无)'}</span>
        </label>
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel" onclick="this.closest('.prompt-dialog-overlay').remove();window._importData=null">取消</button>
        <button class="btn-confirm" onclick="confirmImport(this)">导入</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.confirmImport = function(btn) {
  const overlay = btn.closest('.prompt-dialog-overlay');
  const dialog = btn.closest('.prompt-dialog');
  const data = window._importData;
  if (!data) { showToast('导入数据丢失，请重新选择文件', 'error'); return; }

  const checks = dialog.querySelectorAll('input[type="checkbox"]');
  const selection = {};
  checks.forEach(c => { selection[c.dataset.key] = c.checked; });
  if (!Object.values(selection).some(Boolean)) {
    showToast('请至少选择一项', 'error');
    return;
  }

  const results = importData(data, selection);
  overlay.remove();
  window._importData = null;
  showToast('导入完成: ' + results.join('; '), 'success');

  // Reload all data from storage into in-memory arrays
  if (typeof loadConversations === 'function') loadConversations();
  if (typeof loadActiveId === 'function') loadActiveId();
  if (typeof loadGroups === 'function') loadGroups();
  if (typeof loadPrompts === 'function') loadPrompts();
  if (typeof loadApiConfigs === 'function') loadApiConfigs();
  if (typeof loadActiveApiConfigId === 'function') loadActiveApiConfigId();

  // Re-sync active API config to hidden fields
  if (typeof getActiveApiConfig === 'function') {
    const cfg = getActiveApiConfig();
    if (cfg && $('apiUrl')) {
      $('apiUrl').value = cfg.apiUrl || '';
      $('apiKey').value = cfg.apiKey || '';
      $('model').value = cfg.model || '';
    }
  }

  // Re-sync active conversation
  if (typeof findConv === 'function' && activeConvId) {
    const conv = findConv(activeConvId);
    if (conv) {
      currentConvMessages = conv.messages || [];
      $('convTitle').textContent = getConvTitle(conv);
    } else {
      activeConvId = null;
      currentConvMessages = [];
      $('convTitle').textContent = '新对话';
    }
  } else {
    currentConvMessages = [];
  }
  msgCounter = 0;

  // Re-render everything
  if (typeof renderApiConfigs === 'function') renderApiConfigs();
  if (typeof renderPrompts === 'function') renderPrompts();
  if (typeof renderHistory === 'function') renderHistory();
  if (typeof renderMessages === 'function') renderMessages();
};
