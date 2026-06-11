// ==================== Config persistence (params only) ====================
function saveConfigSilent() {
  const config = {
    systemPrompt: $('systemPrompt').value,
    temperature: $('temperature').value,
    maxTokens: $('maxTokens').value,
    topP: $('topP').value,
    frequencyPenalty: $('frequencyPenalty').value,
    presencePenalty: $('presencePenalty').value,
    historyLimit: $('historyLimit').value,
    reasoningEnabled: $('reasoningToggle') ? $('reasoningToggle').checked : false,
  };
  try { ls.setItem(CONFIG_KEY, JSON.stringify(config)); } catch (_) {}
}

function saveConfig() {
  saveConfigSilent();
  showToast('参数已保存', 'success');
}

function resetConfig() {
  if (!confirm('重置为默认参数？')) return;
  $('systemPrompt').value = '你是一个有用的助手';
  $('temperature').value = '0.7';
  $('tempValue').textContent = '0.7';
  $('maxTokens').value = '0';
  $('topP').value = '1';
  $('topPValue').textContent = '1.00';
  $('frequencyPenalty').value = '0';
  $('freqPValue').textContent = '0';
  $('presencePenalty').value = '0';
  $('presPValue').textContent = '0';
  $('historyLimit').value = '20';
  showToast('已重置为默认参数', 'info');
  saveConfigSilent();
}

function loadConfigFromStorage() {
  try {
    const raw = ls.getItem(CONFIG_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw);
    if (c.systemPrompt) $('systemPrompt').value = c.systemPrompt;
    if (c.temperature) { $('temperature').value = c.temperature; $('tempValue').textContent = c.temperature; }
    if (c.maxTokens !== undefined && c.maxTokens !== '') $('maxTokens').value = c.maxTokens;
    if (c.topP !== undefined) { $('topP').value = c.topP; $('topPValue').textContent = parseFloat(c.topP).toFixed(2); }
    if (c.frequencyPenalty !== undefined) { $('frequencyPenalty').value = c.frequencyPenalty; $('freqPValue').textContent = c.frequencyPenalty; }
    if (c.presencePenalty !== undefined) { $('presencePenalty').value = c.presencePenalty; $('presPValue').textContent = c.presencePenalty; }
    if (c.historyLimit) $('historyLimit').value = c.historyLimit;
    if (c.reasoningEnabled !== undefined && $('reasoningToggle')) $('reasoningToggle').checked = c.reasoningEnabled;
    return true;
  } catch (_) { return false; }
}

// ==================== API Config Management ====================

const DEFAULT_API_CONFIGS = [
  {
    id: 'api_default',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    status: 'unknown',
    statusError: '',
  },
];

let apiConfigs = [];
let activeApiConfigId = null;

function loadApiConfigs() {
  try {
    const raw = ls.getItem(API_CONFIGS_KEY);
    apiConfigs = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(apiConfigs)) apiConfigs = [];
  } catch (_) { apiConfigs = []; }

  // Migration: if no configs exist, try to create one from old saved config
  if (apiConfigs.length === 0) {
    const migrated = migrateFromOldConfig();
    if (migrated) {
      apiConfigs.push(migrated);
    } else {
      // Use default DeepSeek config
      apiConfigs.push({ ...DEFAULT_API_CONFIGS[0], id: 'api_' + genId() });
    }
    saveApiConfigs();
  }

  // Ensure all configs have status fields (migration from older versions)
  apiConfigs.forEach(c => {
    if (!c.status) c.status = 'unknown';
    if (!c.statusError) c.statusError = '';
  });
}

function migrateFromOldConfig() {
  try {
    const raw = ls.getItem(CONFIG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c.apiUrl && !c.apiKey && !c.model) return null;
    return {
      id: 'api_' + genId(),
      name: c.apiUrl ? new URL(c.apiUrl).hostname.replace(/^api\./, '').replace(/\.com$/, '') || '默认服务' : '默认服务',
      apiUrl: c.apiUrl || 'https://api.deepseek.com/v1',
      apiKey: c.apiKey || '',
      model: c.model || 'deepseek-chat',
      status: 'unknown',
      statusError: '',
    };
  } catch (_) { return null; }
}

function saveApiConfigs() {
  try { ls.setItem(API_CONFIGS_KEY, JSON.stringify(apiConfigs)); } catch (_) {}
}

function loadActiveApiConfigId() {
  try {
    activeApiConfigId = ls.getItem(ACTIVE_API_CONFIG_KEY) || null;
  } catch (_) { activeApiConfigId = null; }
  // Validate: if saved ID doesn't exist, use first config
  if (activeApiConfigId && !apiConfigs.find(c => c.id === activeApiConfigId)) {
    activeApiConfigId = null;
  }
  if (!activeApiConfigId && apiConfigs.length > 0) {
    activeApiConfigId = apiConfigs[0].id;
  }
}

function saveActiveApiConfigId() {
  if (activeApiConfigId) {
    try { ls.setItem(ACTIVE_API_CONFIG_KEY, activeApiConfigId); } catch (_) {}
  }
}

function getActiveApiConfig() {
  return apiConfigs.find(c => c.id === activeApiConfigId) || apiConfigs[0] || null;
}

function updateApiConfigStatus(id, status, errorMsg) {
  const config = apiConfigs.find(c => c.id === id);
  if (!config) return;
  config.status = status;
  config.statusError = errorMsg || '';
  saveApiConfigs();
  renderApiConfigs();
}

function applyApiConfig(id) {
  const config = apiConfigs.find(c => c.id === id);
  if (!config) { showToast('找不到该服务配置', 'error'); return; }

  activeApiConfigId = config.id;
  saveActiveApiConfigId();

  // Sync to hidden form fields (for existing code compatibility)
  $('apiUrl').value = config.apiUrl || '';
  $('apiKey').value = config.apiKey || '';
  $('model').value = config.model || '';

  renderApiConfigs();
  showToast(`已切换到「${config.name}」`, 'success');

  // Auto test connection
  autoTestConnection();
}

// ==================== Render API Configs ====================

function renderApiConfigs() {
  const container = $('apiConfigList');
  const query = ($('apiConfigSearch').value || '').trim().toLowerCase();

  let list = [...apiConfigs];
  if (query) {
    list = list.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.apiUrl.toLowerCase().includes(query) ||
      c.model.toLowerCase().includes(query)
    );
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="api-config-empty">' +
      (query ? '暂无匹配的服务' : '暂无服务配置，点击上方按钮添加') +
      '</div>';
    return;
  }

  container.innerHTML = list.map(c => renderApiConfigCard(c)).join('');
}

function renderApiConfigCard(config) {
  const isActive = config.id === activeApiConfigId;
  const isOffline = config.status === 'offline';
  const cardClasses = `api-config-card${isActive ? ' active' : ''}${isOffline ? ' offline' : ''}`;
  const cardTitle = isOffline && config.statusError
    ? '连接失败: ' + config.statusError
    : (isOffline ? '连接失败' : '');
  const maskedKey = config.apiKey
    ? config.apiKey.slice(0, 8) + '…' + config.apiKey.slice(-4)
    : '未设置';

  return `
    <div class="${cardClasses}" title="${escapeHtml(cardTitle)}">
      <div class="api-config-indicator">${isActive ? '▶' : '○'}</div>
      <div class="api-config-body">
        <div class="api-config-name">
          ${escapeHtml(config.name)}
          ${isActive ? '<span class="api-config-badge">当前</span>' : ''}
        </div>
        <div class="api-config-url" title="${escapeHtml(config.apiUrl)}">${escapeHtml(config.apiUrl)}</div>
        <div class="api-config-meta">
          <span class="api-config-model">${escapeHtml(config.model)}</span>
          <span class="api-config-key-hint">${maskedKey}</span>
        </div>
        <div class="api-config-actions">
          ${isActive
            ? '<button class="btn-outline btn-sm" disabled style="opacity:0.5">使用中</button>'
            : `<button class="btn-apply-sm" onclick="applyApiConfig('${config.id}')">使用</button>`
          }
          <button class="btn-edit-sm" onclick="editApiConfig('${config.id}')">编辑</button>
          <button class="btn-delete-sm" onclick="deleteApiConfig('${config.id}')">删除</button>
        </div>
      </div>
    </div>
  `;
}

// ==================== API Config Dialog ====================

function showApiConfigDialog(configToEdit) {
  const isEdit = !!configToEdit;
  const cfg = configToEdit || { name: '', apiUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' };

  const overlay = document.createElement('div');
  overlay.className = 'prompt-dialog-overlay';
  overlay.innerHTML = `
    <div class="prompt-dialog" style="width:460px">
      <h3>${isEdit ? '编辑服务' : '新增服务'}</h3>
      <div class="form-group">
        <label for="dcName">服务名称</label>
        <input type="text" id="dcName" placeholder="例如：DeepSeek、OpenAI、本地 Ollama" value="${isEdit ? escapeHtml(cfg.name) : ''}">
      </div>
      <div class="form-group">
        <label for="dcUrl">API 地址</label>
        <input type="url" id="dcUrl" placeholder="https://api.deepseek.com/v1" value="${isEdit ? escapeHtml(cfg.apiUrl) : 'https://api.deepseek.com/v1'}">
        <span class="hint">支持任意 OpenAI 兼容端点</span>
      </div>
      <div class="form-group">
        <label for="dcKey">API Key</label>
        <input type="password" id="dcKey" placeholder="sk-..." autocomplete="off" value="${isEdit ? escapeHtml(cfg.apiKey) : ''}">
      </div>
      <div class="form-group">
        <label for="dcModel">模型名称</label>
        <input type="text" id="dcModel" placeholder="deepseek-chat" value="${isEdit ? escapeHtml(cfg.model) : 'deepseek-chat'}">
        <div class="dlg-model-list" style="margin-top:6px;display:none">
          <select id="dcModelSelect" style="width:100%;padding:6px 8px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px" onchange="document.getElementById('dcModel').value=this.value">
            <option value="">— 从列表选择模型 —</option>
          </select>
          <span class="hint">也可在上方手动输入模型名称</span>
        </div>
      </div>
      <div class="form-group" style="flex-direction:row;align-items:center;gap:8px;flex-wrap:wrap;padding-top:2px">
        <button type="button" class="btn-outline btn-sm dlg-test-btn">测试连接</button>
        <span class="dlg-test-status" style="font-size:12px;color:#888"></span>
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel">取消</button>
        <button class="btn-confirm">${isEdit ? '保存' : '添加'}</button>
      </div>
    </div>
  `;

  overlay.querySelector('.btn-cancel').onclick = () => overlay.remove();

  // Dialog test connection button
  const dlgTestBtn = overlay.querySelector('.dlg-test-btn');
  const dlgTestStatus = overlay.querySelector('.dlg-test-status');
  const dlgModelList = overlay.querySelector('.dlg-model-list');
  const dlgModelSelect = overlay.querySelector('#dcModelSelect');
  const dlgModelInput = overlay.querySelector('#dcModel');

  dlgTestBtn.onclick = async () => {
    const url = overlay.querySelector('#dcUrl').value.trim().replace(/\/+$/, '');
    const key = overlay.querySelector('#dcKey').value.trim();
    const model = overlay.querySelector('#dcModel').value.trim();

    if (!url) { dlgTestStatus.textContent = '请输入 API 地址'; dlgTestStatus.style.color = '#ef4444'; return; }
    if (!/^https?:\/\//.test(url)) { dlgTestStatus.textContent = 'API 地址格式不正确'; dlgTestStatus.style.color = '#ef4444'; return; }

    dlgTestBtn.disabled = true;
    dlgTestBtn.textContent = '测试中…';
    dlgTestStatus.textContent = '连接测试中…';
    dlgTestStatus.style.color = '#888';
    dlgModelList.style.display = 'none';

    const result = await tryTestConnection(url, key, model);

    if (result.success) {
      dlgTestStatus.textContent = result.text.replace('已连接', '✅ 已连接');
      dlgTestStatus.style.color = '#22c55e';
      // Populate model selector
      if (result.models && result.models.length > 0) {
        dlgModelSelect.innerHTML = '<option value="">— 选择模型 —</option>'
          + result.models.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.id)}</option>`).join('');
        dlgModelList.style.display = 'block';
      }
    } else {
      dlgTestStatus.textContent = `❌ 连接失败: ${result.text}`;
      dlgTestStatus.style.color = '#ef4444';
      dlgModelList.style.display = 'none';
    }
    dlgTestBtn.disabled = false;
    dlgTestBtn.textContent = '测试连接';
  };

  overlay.querySelector('.btn-confirm').onclick = () => {
    const name = overlay.querySelector('#dcName').value.trim();
    const apiUrl = overlay.querySelector('#dcUrl').value.trim();
    const apiKey = overlay.querySelector('#dcKey').value.trim();
    const model = overlay.querySelector('#dcModel').value.trim();

    if (!name) { showToast('请输入服务名称', 'error'); return; }
    if (!apiUrl) { showToast('请输入 API 地址', 'error'); return; }
    if (!/^https?:\/\//.test(apiUrl)) { showToast('API 地址格式不正确', 'error'); return; }
    if (!model) { showToast('请输入模型名称', 'error'); return; }

    if (isEdit) {
      configToEdit.name = name;
      configToEdit.apiUrl = apiUrl;
      configToEdit.apiKey = apiKey;
      configToEdit.model = model;
      saveApiConfigs();

      // If this is the active config, sync to hidden fields
      if (configToEdit.id === activeApiConfigId) {
        $('apiUrl').value = apiUrl;
        $('apiKey').value = apiKey;
        $('model').value = model;
      }

      showToast('服务已更新', 'success');
    } else {
      const newConfig = {
        id: 'api_' + genId(),
        name,
        apiUrl,
        apiKey,
        model,
      };
      apiConfigs.push(newConfig);
      saveApiConfigs();

      // Auto-switch to the new config if no active config
      if (!activeApiConfigId) {
        applyApiConfig(newConfig.id);
      }

      showToast('服务已添加', 'success');
    }
    overlay.remove();
    renderApiConfigs();
  };


  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('#dcName').focus(), 100);
}

function addApiConfig() { showApiConfigDialog(null); }

function editApiConfig(id) {
  const config = apiConfigs.find(c => c.id === id);
  if (!config) { showToast('找不到该服务配置', 'error'); return; }
  showApiConfigDialog(config);
}

function deleteApiConfig(id) {
  const config = apiConfigs.find(c => c.id === id);
  if (!config) return;
  if (apiConfigs.length <= 1) {
    showToast('至少保留一个服务配置', 'error');
    return;
  }
  if (!confirm(`确定删除服务「${config.name}」吗？`)) return;

  apiConfigs = apiConfigs.filter(c => c.id !== id);
  saveApiConfigs();

  // If deleted the active config, switch to the first available
  if (activeApiConfigId === id) {
    if (apiConfigs.length > 0) {
      applyApiConfig(apiConfigs[0].id);
    } else {
      activeApiConfigId = null;
      saveActiveApiConfigId();
      $('apiUrl').value = '';
      $('apiKey').value = '';
      $('model').value = '';
      enableChat(false);
    }
  }

  renderApiConfigs();
  showToast('服务已删除', 'info');
}

// ==================== Side tabs ====================
function switchSideTab(tab) {
  $('tabApi').classList.toggle('active', tab === 'api');
  $('tabParams').classList.toggle('active', tab === 'params');
  $('tabPrompts').classList.toggle('active', tab === 'prompts');
  $('panelApi').classList.toggle('hidden', tab !== 'api');
  $('panelParams').classList.toggle('hidden', tab !== 'params');
  $('panelPrompts').classList.toggle('hidden', tab !== 'prompts');
  if (tab === 'api') renderApiConfigs();
  if (tab === 'prompts') renderPrompts();
}

// ==================== Default config (shared with prompts) ====================
const defaultConfig = {
  systemPrompt: '你是一个有用的助手',
  temperature: 0.7,
  maxTokens: 0,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  historyLimit: 20,
  reasoningEnabled: false,
};
