// ==================== Prompt Management ====================

// --- Placeholders ---
// Replace {{current_time}} in prompt text with the current date/time string
function replacePromptPlaceholders(text) {
  if (!text || !text.includes('{{')) return text;
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return text
    .replace(/\{\{current_time\}\}/g, `${dateStr} ${timeStr}`)
    .replace(/\{\{timezone\}\}/g, tz);
}

// --- Groups ---
const DEFAULT_PROMPT_GROUPS = [
  { key: 'chat', name: '聊天', builtIn: true },
  { key: 'content-transformation', name: '内容转换', builtIn: true },
  { key: 'expression-optimization', name: '表达优化', builtIn: true },
  { key: 'structural-adjustment', name: '结构调整', builtIn: true },
  { key: 'text-correction', name: '文本修正', builtIn: true },
  { key: 'text-evaluation', name: '文本评估', builtIn: true },
];

let promptGroups = [];
let userPrompts = [];
let hiddenPresetIds = [];

// --- Presets loaded from data/presets.json ---
let PRESET_PROMPTS = [];

async function loadPresetPrompts() {
  try {
    const resp = await fetch('data/presets.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    PRESET_PROMPTS = await resp.json();
  } catch (e) {
    console.error('加载预设提示词失败:', e);
    PRESET_PROMPTS = [];
  }
}

// ========== Groups CRUD ==========
function loadGroups() {
  try {
    const raw = ls.getItem(GROUPS_KEY);
    promptGroups = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(promptGroups)) promptGroups = [];
    for (const dg of DEFAULT_PROMPT_GROUPS) {
      if (!promptGroups.find(g => g.key === dg.key)) {
        promptGroups.push({ ...dg });
      }
    }
  } catch (_) { promptGroups = [...DEFAULT_PROMPT_GROUPS]; }
  saveGroups();
}

function saveGroups() {
  try { ls.setItem(GROUPS_KEY, JSON.stringify(promptGroups)); } catch (_) {}
}

function showGroupManager() {
  const overlay = document.createElement('div');
  overlay.className = 'prompt-dialog-overlay';
  overlay.innerHTML = `
    <div class="prompt-dialog">
      <h3>管理分组</h3>
      <div class="group-mgr-list" id="gmList">
        ${renderGroupManagerList()}
      </div>
      <div class="dialog-actions">
        <button class="btn-primary btn-sm" onclick="this.closest('.prompt-dialog-overlay').querySelector('#gmAddForm').style.display='block';this.closest('.prompt-dialog-overlay').querySelector('#gmNewName').focus()">+ 添加分组</button>
        <button class="btn-cancel" onclick="this.closest('.prompt-dialog-overlay').remove()">关闭</button>
      </div>
      <div style="margin-top:8px;display:none" id="gmAddForm">
        <hr style="border:none;border-top:1px solid #eee;margin:6px 0">
        <div class="form-group">
          <label>分组名称</label>
          <input type="text" id="gmNewName" placeholder="输入分组名称">
        </div>
        <div class="dialog-actions" style="margin-top:6px">
          <button class="btn-cancel" onclick="document.getElementById('gmAddForm').style.display='none'">取消</button>
          <button class="btn-confirm" id="gmAddBtn">添加</button>
        </div>
      </div>
    </div>
  `;

  overlay.querySelector('#gmAddBtn').onclick = () => {
    const name = overlay.querySelector('#gmNewName').value.trim();
    if (!name) { showToast('请输入分组名称', 'error'); return; }
    const key = 'group_' + genId();
    promptGroups.push({ key, name, builtIn: false });
    saveGroups();
    overlay.querySelector('#gmList').innerHTML = renderGroupManagerList();
    overlay.querySelector('#gmNewName').value = '';
    overlay.querySelector('#gmAddForm').style.display = 'none';
    showToast('分组已添加', 'success');
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function renderGroupManagerList() {
  if (promptGroups.length === 0) return '<div class="group-mgr-empty">暂无分组</div>';
  return promptGroups.map(g => `
    <div class="group-mgr-item">
      <div class="gm-left">
        <span class="gm-name">${escapeHtml(g.name)}</span>
        ${g.builtIn ? '<span class="gm-badge">内置</span>' : '<span class="gm-badge user-badge">自定义</span>'}
      </div>
      <div class="gm-actions">
        <button class="gm-edit" onclick="editGroupName('${g.key}')">编辑</button>
        <button class="gm-delete" onclick="deleteGroup('${g.key}')">删除</button>
      </div>
    </div>
  `).join('');
}

function editGroupName(key) {
  const g = promptGroups.find(x => x.key === key);
  if (!g) return;
  const name = prompt('重命名分组：', g.name);
  if (name === null) return;
  const t = name.trim();
  if (!t) { showToast('名称不能为空', 'error'); return; }
  g.name = t;
  saveGroups();
  const list = document.getElementById('gmList');
  if (list) list.innerHTML = renderGroupManagerList();
  renderPrompts();
  showToast('分组已重命名', 'success');
}

function deleteGroup(key) {
  const g = promptGroups.find(x => x.key === key);
  if (!g) return;
  if (!confirm(`确定删除分组「${g.name}」吗？\n该分组下的所有智能体也会被删除。`)) return;

  // Delete all prompts in this group
  const removedPresetRefs = [];
  userPrompts = userPrompts.filter(p => {
    if (p.groupKey === key) {
      if (p.presetRef) removedPresetRefs.push(p.presetRef);
      return false;
    }
    return true;
  });
  // Hide presets in this group that weren't overridden
  for (const p of PRESET_PROMPTS) {
    if (p.groupKey === key && !hiddenPresetIds.includes(p.id) && !removedPresetRefs.includes(p.id)) {
      hiddenPresetIds.push(p.id);
    }
  }
  savePrompts();
  saveHiddenPresets();

  promptGroups = promptGroups.filter(x => x.key !== key);
  saveGroups();
  const list = document.getElementById('gmList');
  if (list) list.innerHTML = renderGroupManagerList();
  renderPrompts();
  showToast(`分组「${g.name}」及所含智能体已删除`, 'info');
}

// ========== Prompts CRUD ==========
function loadPrompts() {
  try {
    const raw = ls.getItem(PROMPTS_KEY);
    userPrompts = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(userPrompts)) userPrompts = [];
  } catch (_) { userPrompts = []; }
  try {
    const raw = ls.getItem(HIDDEN_PROMPTS_KEY);
    hiddenPresetIds = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(hiddenPresetIds)) hiddenPresetIds = [];
  } catch (_) { hiddenPresetIds = []; }
}

function savePrompts() {
  try { ls.setItem(PROMPTS_KEY, JSON.stringify(userPrompts)); } catch (_) {}
}

function saveHiddenPresets() {
  try { ls.setItem(HIDDEN_PROMPTS_KEY, JSON.stringify(hiddenPresetIds)); } catch (_) {}
}

function getAllPrompts() {
  const overrideMap = new Map(
    userPrompts.filter(p => p.presetRef).map(p => [p.presetRef, p])
  );
  const result = [];
  for (const p of PRESET_PROMPTS) {
    if (hiddenPresetIds.includes(p.id)) continue;
    if (overrideMap.has(p.id)) {
      result.push(overrideMap.get(p.id));
    } else {
      result.push(p);
    }
  }
  for (const p of userPrompts) {
    if (!p.presetRef) result.push(p);
  }
  return result;
}

function findPromptById(id) {
  const u = userPrompts.find(p => p.id === id);
  if (u) return u;
  return PRESET_PROMPTS.find(p => p.id === id);
}

function getGroupName(key) {
  const g = promptGroups.find(x => x.key === key);
  return g ? g.name : key;
}

// ========== Render ==========
function renderPrompts() {
  const container = $('promptsGroups');
  const query = ($('promptsSearch').value || '').trim().toLowerCase();

  let all = getAllPrompts();

  if (query) {
    all = all.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.config.systemPrompt.toLowerCase().includes(query)
    );
  }

  if (all.length === 0) {
    container.innerHTML = '<div class="prompts-empty">暂无匹配的智能体</div>';
    return;
  }

  const grouped = {};
  for (const p of all) {
    const gk = p.groupKey || 'custom';
    if (!grouped[gk]) grouped[gk] = [];
    grouped[gk].push(p);
  }

  container.innerHTML = '';
  for (const [gk, items] of Object.entries(grouped)) {
    const groupName = getGroupName(gk);
    const section = document.createElement('div');
    section.className = 'prompt-group-section';

    section.innerHTML = `
      <div class="prompt-group-header" onclick="toggleGroupSection(this)">
        <span class="group-arrow collapsed">▾</span>
        <span class="group-name">${escapeHtml(groupName)}</span>
        <span class="group-count">${items.length}</span>
      </div>
      <div class="prompt-group-body hidden">
        ${items.map(p => renderPromptCard(p)).join('')}
      </div>
    `;
    container.appendChild(section);
  }
}

function toggleGroupSection(header) {
  const arrow = header.querySelector('.group-arrow');
  const body = header.nextElementSibling;
  arrow.classList.toggle('collapsed');
  body.classList.toggle('hidden');
}

function renderPromptCard(p) {
  const cfg = p.config || defaultConfig;
  const isOverride = p.presetRef && !p.builtIn;
  const badge = p.builtIn
    ? '<span class="prompt-badge">预设</span>'
    : isOverride
      ? '<span class="prompt-badge" style="background:#fef3c7;color:#d97706">已修改</span>'
      : '<span class="prompt-badge user-badge">自定义</span>';

  const chips = [];
  if (cfg.temperature !== undefined && cfg.temperature !== 0.7) chips.push(`🌡 ${cfg.temperature}`);
  if (cfg.maxTokens > 0) chips.push(`📄 ${cfg.maxTokens}`);
  if (cfg.topP !== undefined && cfg.topP !== 1.0) chips.push(`P ${cfg.topP}`);
  if (cfg.frequencyPenalty !== undefined && cfg.frequencyPenalty !== 0) chips.push(`F ${cfg.frequencyPenalty}`);
  if (cfg.presencePenalty !== undefined && cfg.presencePenalty !== 0) chips.push(`Pp ${cfg.presencePenalty}`);

  const chipHtml = chips.length > 0
    ? `<div class="prompt-config-chips">${chips.map(c => `<span class="chip highlight">${c}</span>`).join('')}</div>`
    : '';

  return `
    <div class="prompt-card">
      <div class="prompt-title">${escapeHtml(p.title)} ${badge}</div>
      ${p.description ? `<div class="prompt-desc">${escapeHtml(p.description)}</div>` : ''}
      ${chipHtml}
      <div class="prompt-actions">
        <button class="btn-apply" onclick="applyPrompt('${p.id}')">使用</button>
        <button class="btn-edit" onclick="editPrompt('${p.id}')">编辑</button>
        <button class="btn-delete" onclick="deletePrompt('${p.id}')">删除</button>
      </div>
    </div>
  `;
}

// ========== Apply ==========
function applyPrompt(id) {
  const all = getAllPrompts();
  const p = all.find(x => x.id === id);
  if (!p) return;
  const cfg = p.config || defaultConfig;

  if (currentConvMessages.length > 0) {
    newConversation();
  } else {
    msgCounter = 0;
  }

  $('systemPrompt').value = cfg.systemPrompt || '';
  $('temperature').value = cfg.temperature ?? 0.7;
  $('tempValue').textContent = cfg.temperature ?? 0.7;
  $('maxTokens').value = cfg.maxTokens ?? 0;
  $('topP').value = cfg.topP ?? 1.0;
  $('topPValue').textContent = (cfg.topP ?? 1.0).toFixed(2);
  $('frequencyPenalty').value = cfg.frequencyPenalty ?? 0;
  $('freqPValue').textContent = cfg.frequencyPenalty ?? 0;
  $('presencePenalty').value = cfg.presencePenalty ?? 0;
  $('presPValue').textContent = cfg.presencePenalty ?? 0;
  $('historyLimit').value = cfg.historyLimit ?? 20;

  renderMessages();
  saveConfigSilent();

  $('statusText').textContent = `已应用: ${p.title}`;
  showToast(`已应用配置「${p.title}」`, 'success');
  $('statusText').scrollIntoView({ block: 'nearest' });
}

// ========== Dialog ==========
function showPromptDialog(promptToEdit) {
  const isEdit = !!promptToEdit;
  const cfg = promptToEdit ? (promptToEdit.config || defaultConfig) : { ...defaultConfig };

  const groupOptions = promptGroups.map(g =>
    `<option value="${g.key}" ${(promptToEdit && promptToEdit.groupKey === g.key) ? 'selected' : ''}>${escapeHtml(g.name)}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'prompt-dialog-overlay';
  overlay.innerHTML = `
    <div class="prompt-dialog" style="width:480px">
      <h3>${isEdit ? '编辑智能体' : '新增智能体'}</h3>
      <div class="form-group">
        <label for="dpTitle">标题</label>
        <input type="text" id="dpTitle" placeholder="给智能体取个名字" value="${isEdit ? escapeHtml(promptToEdit.title) : ''}">
      </div>
      <div class="form-group">
        <label for="dpDesc">描述（选填）</label>
        <input type="text" id="dpDesc" placeholder="简短描述用途" value="${isEdit ? escapeHtml(promptToEdit.description || '') : ''}">
      </div>
      <div class="form-group">
        <label for="dpGroup">分组</label>
        <select id="dpGroup">${groupOptions}</select>
      </div>
      <div class="form-group">
        <label for="dpSystemPrompt">系统提示词</label>
        <textarea id="dpSystemPrompt" rows="4" placeholder="输入系统提示词…">${isEdit ? escapeHtml(cfg.systemPrompt || '') : ''}</textarea>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:100px">
          <label for="dpTemp">温度</label>
          <input type="number" id="dpTemp" step="0.1" min="0" max="2" value="${cfg.temperature ?? 0.7}">
        </div>
        <div class="form-group" style="flex:1;min-width:100px">
          <label for="dpMaxTokens">最大Token (0=不限)</label>
          <input type="number" id="dpMaxTokens" min="0" value="${cfg.maxTokens ?? 0}">
        </div>
        <div class="form-group" style="flex:1;min-width:100px">
          <label for="dpTopP">Top-P</label>
          <input type="number" id="dpTopP" step="0.05" min="0" max="1" value="${cfg.topP ?? 1.0}">
        </div>
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel">取消</button>
        <button class="btn-confirm">${isEdit ? '保存' : '添加'}</button>
      </div>
    </div>
  `;

  overlay.querySelector('.btn-cancel').onclick = () => overlay.remove();
  overlay.querySelector('.btn-confirm').onclick = () => {
    const title = overlay.querySelector('#dpTitle').value.trim();
    const desc = overlay.querySelector('#dpDesc').value.trim();
    const groupKey = overlay.querySelector('#dpGroup').value;
    const systemPrompt = overlay.querySelector('#dpSystemPrompt').value.trim();
    if (!title) { showToast('请输入标题', 'error'); return; }
    if (!systemPrompt) { showToast('请输入提示词内容', 'error'); return; }

    const config = {
      systemPrompt,
      temperature: parseFloat(overlay.querySelector('#dpTemp').value) || 0.7,
      maxTokens: parseInt(overlay.querySelector('#dpMaxTokens').value) || 0,
      topP: parseFloat(overlay.querySelector('#dpTopP').value) || 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      historyLimit: 20,
    };

    if (isEdit) {
      promptToEdit.title = title;
      promptToEdit.description = desc;
      promptToEdit.groupKey = groupKey;
      promptToEdit.config = config;
      savePrompts();
      showToast('智能体已更新', 'success');
    } else {
      userPrompts.push({
        id: 'user_' + genId(),
        groupKey,
        title,
        description: desc,
        builtIn: false,
        config,
      });
      savePrompts();
      showToast('智能体已添加', 'success');
    }
    overlay.remove();
    renderPrompts();
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('#dpTitle').focus(), 100);
}

function addPrompt() { showPromptDialog(null); }

function editPrompt(id) {
  let p = userPrompts.find(x => x.id === id);
  if (p) { showPromptDialog(p); return; }

  const preset = PRESET_PROMPTS.find(x => x.id === id);
  if (!preset) { showToast('找不到该智能体', 'error'); return; }

  let override = userPrompts.find(u => u.presetRef === preset.id);
  if (!override) {
    override = {
      id: 'user_' + genId(),
      presetRef: preset.id,
      groupKey: preset.groupKey,
      title: preset.title,
      description: preset.description || '',
      builtIn: false,
      config: { ...preset.config },
    };
    userPrompts.push(override);
    savePrompts();
  }
  showPromptDialog(override);
}

function deletePrompt(id) {
  const userIdx = userPrompts.findIndex(x => x.id === id);
  if (userIdx >= 0) {
    const p = userPrompts[userIdx];
    if (!confirm(`确定删除「${p.title}」吗？`)) return;
    userPrompts.splice(userIdx, 1);
    savePrompts();
    renderPrompts();
    showToast('已删除', 'info');
    return;
  }

  const preset = PRESET_PROMPTS.find(x => x.id === id);
  if (!preset) return;
  if (!confirm(`确定隐藏预设「${preset.title}」吗？可在「重置预设」中恢复。`)) return;
  hiddenPresetIds.push(preset.id);
  saveHiddenPresets();
  renderPrompts();
  showToast('预设已隐藏', 'info');
}

function resetAllPresets() {
  if (!confirm('确定重置所有预设到初始状态吗？\n这将恢复所有被隐藏和修改的预设，并删除自定义智能体。')) return;
  userPrompts = [];
  hiddenPresetIds = [];
  savePrompts();
  saveHiddenPresets();
  renderPrompts();
  showToast('已重置所有预设', 'success');
}
