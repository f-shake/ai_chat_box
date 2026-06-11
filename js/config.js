// ==================== Config persistence ====================
function saveConfigSilent() {
  const config = {
    apiUrl: $('apiUrl').value,
    apiKey: $('apiKey').value,
    model: $('model').value,
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
  showToast('配置已保存', 'success');
}

function resetConfig() {
  if (!confirm('重置为默认配置？')) return;
  $('apiUrl').value = 'https://api.deepseek.com/v1';
  $('apiKey').value = '';
  $('model').value = 'deepseek-chat';
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
  showToast('已重置为默认配置', 'info');
}

function loadConfigFromStorage() {
  try {
    const raw = ls.getItem(CONFIG_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw);
    if (c.apiUrl) $('apiUrl').value = c.apiUrl;
    if (c.apiKey) $('apiKey').value = c.apiKey;
    if (c.model) $('model').value = c.model;
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

// ==================== Model presets ====================
function setModel(name) {
  $('model').value = name;
}

// ==================== Side tabs ====================
function switchSideTab(tab) {
  $('tabApi').classList.toggle('active', tab === 'api');
  $('tabParams').classList.toggle('active', tab === 'params');
  $('tabPrompts').classList.toggle('active', tab === 'prompts');
  $('panelApi').classList.toggle('hidden', tab !== 'api');
  $('panelParams').classList.toggle('hidden', tab !== 'params');
  $('panelPrompts').classList.toggle('hidden', tab !== 'prompts');
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
