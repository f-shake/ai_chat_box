// ==================== Conversations State ====================
let conversations = [];
let activeConvId = null;
let currentConvMessages = [];  // the messages array of the active conversation
let msgCounter = 0;
let controller = null;
let isStreaming = false;
let pendingFiles = []; // { name, size, mime, content, _type }[]
let editingMsgIdx = -1; // index in currentConvMessages being edited, -1 = none

// ==================== SVG icon paths ====================
const ICON_COPY = '<svg viewBox="0 0 1024 1024"><path d="M661.333333 234.666667A64 64 0 0 1 725.333333 298.666667v597.333333a64 64 0 0 1-64 64h-469.333333A64 64 0 0 1 128 896V298.666667a64 64 0 0 1 64-64z m-21.333333 85.333333H213.333333v554.666667h426.666667v-554.666667z m191.829333-256a64 64 0 0 1 63.744 57.856l0.256 6.144v575.701333a42.666667 42.666667 0 0 1-85.034666 4.992l-0.298667-4.992V149.333333H384a42.666667 42.666667 0 0 1-42.368-37.674666L341.333333 106.666667a42.666667 42.666667 0 0 1 37.674667-42.368L384 64h447.829333z" fill="currentColor"/></svg>';
const ICON_REGEN = '<svg viewBox="0 0 1024 1024"><path d="M910.848 307.84A448.192 448.192 0 0 0 78.976 396.544c-7.04 26.88 14.4 51.456 42.176 51.456 22.08 0 40.64-15.744 46.848-36.928a358.528 358.528 0 0 1 664.128-60.352l-79.424-21.312a44.8 44.8 0 0 0-23.168 86.592l173.056 46.336q23.04 6.208 43.712-5.76 20.672-11.904 26.88-34.944l46.336-173.12a44.8 44.8 0 1 0-86.528-23.168l-22.144 82.56zM52.864 600L6.4 773.12a44.8 44.8 0 0 0 86.528 23.168l20.992-78.4a448.192 448.192 0 0 0 830.976-90.432c7.168-26.88-14.336-51.456-42.112-51.456-22.08 0-40.64 15.744-46.848 36.928a358.592 358.592 0 0 1-665.792 56.96l83.072 22.336a44.8 44.8 0 0 0 23.168-86.592L123.392 559.36q-23.04-6.208-43.712 5.76-20.672 11.904-26.88 34.944z" fill="currentColor"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';

// ==================== File Upload Handling ====================

/**
 * Handle file selection from input/drop/paste.
 * Reads each file, compresses images, then renders previews.
 */
async function handleFileSelect(files) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/xml', 'text/xml',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_FILES = 10;

  const arr = Array.from(files);
  const total = pendingFiles.length + arr.length;
  if (total > MAX_FILES) {
    showToast(`最多同时上传 ${MAX_FILES} 个文件`, 'error');
    return;
  }

  for (const file of arr) {
    const ext = file.name.split('.').pop().toLowerCase();
    const isImage = file.type.startsWith('image/');
    const isText = file.type.startsWith('text/');
    const isDocx = ext === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Validate type
    if (!isImage && !isText && !isDocx && !file.type) {
      // Fallback: check extension for common text types
      const textExts = ['txt','md','csv','json','xml','js','py','html','css','yaml','yml','toml','sh','bat','log','ini','cfg','conf','env','ts','jsx','tsx','java','go','rs','rb','php','sql','r','m','swift','kt','gradle'];
      if (!textExts.includes(ext)) {
        showToast(`不支持的文件类型: ${file.name}`, 'error');
        continue;
      }
    }

    try {
      const content = await readFileAsContent(file);
      pendingFiles.push(content);
    } catch (err) {
      showToast(`${file.name}: ${err.message}`, 'error');
    }
  }
  renderFilePreviews();
}

function renderFilePreviews() {
  const strip = $('filePreviewStrip');
  if (pendingFiles.length === 0) {
    strip.innerHTML = '';
    return;
  }
  strip.innerHTML = pendingFiles.map((f, i) => `
    <div class="file-preview-card">
      <span class="fp-icon">${getFileIcon(f.name)}</span>
      <span class="fp-info">
        <span class="fp-name">${escapeHtml(f.name)}</span>
        <span class="fp-size">${formatFileSize(f.size)}</span>
      </span>
      <span class="fp-remove" onclick="removePendingFile(${i})" title="移除">×</span>
    </div>
  `).join('');
}

function removePendingFile(index) {
  pendingFiles.splice(index, 1);
  renderFilePreviews();
}

function clearPendingFiles() {
  pendingFiles = [];
  renderFilePreviews();
}

// ==================== CRUD ====================
function loadConversations() {
  try {
    const raw = ls.getItem(CONV_KEY);
    conversations = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(conversations)) conversations = [];
  } catch (_) { conversations = []; }
}

function saveConversations() {
  try {
    ls.setItem(CONV_KEY, JSON.stringify(conversations));
  } catch (_) {}
}

function loadActiveId() {
  try {
    activeConvId = ls.getItem(ACTIVE_KEY);
  } catch (_) { activeConvId = null; }
}

function saveActiveId() {
  if (activeConvId) {
    try { ls.setItem(ACTIVE_KEY, activeConvId); } catch (_) {}
  }
}

function findConv(id) {
  return conversations.find(c => c.id === id);
}

function getConvTitle(conv) {
  if (conv.title && conv.title !== '新对话') return conv.title;
  const firstUser = conv.messages.find(m => m.role === 'user');
  if (firstUser) {
    const t = extractTextParts(firstUser.content);
    if (!t) return '新对话';
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  }
  return '新对话';
}

function getConvPreview(conv) {
  if (conv.messages.length === 0) return '空对话';
  const last = conv.messages[conv.messages.length - 1];
  const prefix = last.role === 'user' ? 'Q: ' : 'A: ';
  const t = extractTextParts(last.content);
  return prefix + (t.length > 30 ? t.slice(0, 30) + '…' : t);
}

function getConvTime(conv) {
  const d = new Date(conv.updatedAt || conv.createdAt);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff/60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)} 天前`;
  return d.toLocaleDateString('zh-CN');
}

// ==================== Render history ====================
function renderHistory() {
  const list = $('historyList');
  const count = $('convCount');

  const sorted = [...conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (sorted.length === 0) {
    list.innerHTML = '<div class="history-empty">暂无对话记录<br>发送消息后自动创建</div>';
    count.textContent = '0';
    return;
  }

  count.textContent = sorted.length;
  list.innerHTML = '';

  for (const conv of sorted) {
    const div = document.createElement('div');
    div.className = `history-item${conv.id === activeConvId ? ' active' : ''}`;
    div.dataset.convId = conv.id;
    div.innerHTML = `
      <div class="item-content">
        <div class="item-title">${escapeHtml(getConvTitle(conv))}</div>
        <div class="item-meta">${getConvTime(conv)} · ${conv.messages.length} 条</div>
      </div>
      <button class="item-delete" onclick="event.stopPropagation();deleteConversation('${conv.id}')" title="删除">×</button>
    `;
    div.addEventListener('click', () => switchConversation(conv.id));
    list.appendChild(div);
  }
}

// ==================== Conversation CRUD ====================
function newConversation() {
  if (isStreaming) { showToast('请先停止当前生成', 'error'); return; }

  saveCurrentConversation();

  const conv = {
    id: genId(),
    title: '新对话',
    messages: [],
    createdAt: getNow(),
    updatedAt: getNow(),
  };
  conversations.push(conv);
  activeConvId = conv.id;
  currentConvMessages = [];
  msgCounter = 0;
  saveConversations();
  saveActiveId();
  renderHistory();
  renderMessages();
  $('convTitle').textContent = '新对话';
  $('userInput').focus();
  showToast('已创建新对话', 'success');
}

function switchConversation(id) {
  if (isStreaming) { showToast('请先停止当前生成', 'error'); return; }
  if (id === activeConvId) return;

  saveCurrentConversation();

  activeConvId = id;
  saveActiveId();
  const conv = findConv(id);
  if (conv) {
    currentConvMessages = conv.messages || [];
    $('convTitle').textContent = getConvTitle(conv);
    if (conv.systemPrompt) $('systemPrompt').value = conv.systemPrompt;
  } else {
    currentConvMessages = [];
    $('convTitle').textContent = '新对话';
  }
  msgCounter = 0;
  renderHistory();
  renderMessages();
}

function deleteConversation(id) {
  if (isStreaming) { showToast('请先停止当前生成', 'error'); return; }
  if (!confirm('确定要删除此对话吗？')) return;

  conversations = conversations.filter(c => c.id !== id);
  saveConversations();

  if (activeConvId === id) {
    if (conversations.length > 0) {
      const sorted = [...conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      activeConvId = sorted[0].id;
      currentConvMessages = sorted[0].messages || [];
      $('convTitle').textContent = getConvTitle(sorted[0]);
    } else {
      activeConvId = null;
      currentConvMessages = [];
      $('convTitle').textContent = '新对话';
    }
    msgCounter = 0;
    saveActiveId();
    renderMessages();
  }

  renderHistory();
  showToast('对话已删除', 'info');
}

function clearAllConversations() {
  if (isStreaming) { showToast('请先停止当前生成', 'error'); return; }
  if (conversations.length === 0) { showToast('没有可删除的对话', 'info'); return; }
  if (!confirm(`确定要删除全部 ${conversations.length} 个对话吗？此操作不可恢复。`)) return;

  conversations = [];
  activeConvId = null;
  currentConvMessages = [];
  msgCounter = 0;
  saveConversations();
  saveActiveId();
  renderHistory();
  renderMessages();
  $('convTitle').textContent = '新对话';
  showToast('已清空所有对话', 'info');
}

function renameConversation() {
  const conv = findConv(activeConvId);
  if (!conv) return;
  const title = prompt('重命名对话：', conv.title || '');
  if (title === null) return;
  const trimmed = title.trim();
  conv.title = trimmed || '新对话';
  conv.updatedAt = getNow();
  saveConversations();
  renderHistory();
  $('convTitle').textContent = getConvTitle(conv);
}

function saveCurrentConversation() {
  if (!activeConvId) return;
  const conv = findConv(activeConvId);
  if (!conv) return;

  conv.messages = currentConvMessages;
  conv.systemPrompt = $('systemPrompt').value;

  if (conv.title === '新对话') {
    const firstUser = currentConvMessages.find(m => m.role === 'user');
    if (firstUser) {
      const t = extractTextParts(firstUser.content);
      if (t) {
        conv.title = t.length > 15 ? t.slice(0, 15) + '…' : t;
        $('convTitle').textContent = conv.title;
      }
    }
  }

  saveConversations();
  renderHistory();
}

// ==================== Smart title generation ====================
async function generateConversationTitle() {
  if (!activeConvId) return;
  const conv = findConv(activeConvId);
  if (!conv) return;
  // Only generate for conversations still using auto-title
  if (!conv.title || conv.title === '新对话') return;

  const firstUser = currentConvMessages.find(m => m.role === 'user');
  const firstAssistant = currentConvMessages.find(m => m.role === 'assistant');
  if (!firstUser) return;

  const apiUrl = $('apiUrl')?.value.trim().replace(/\/+$/, '');
  const apiKey = $('apiKey')?.value.trim();
  const model = $('model')?.value.trim();
  if (!apiUrl || !model) return;

  const userText = extractTextParts(firstUser.content);
  const assistantText = firstAssistant ? extractTextParts(firstAssistant.content) : '';
  const promptText = `为以下对话生成一个简短的中文标题（不超过15个字），直接返回标题文本，不要引号，不要多余内容。

用户：${userText.slice(0, 100)}${userText.length > 100 ? '…' : ''}${assistantText ? '\n\nAI：' + assistantText.slice(0, 200) + (assistantText.length > 200 ? '…' : '') : ''}`;
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const resp = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: '你是一个对话标题生成器。根据对话内容生成简短标题，不超过15个字，直接返回标题文本。' },
          { role: 'user', content: promptText },
        ],
        temperature: 0.3,
        max_tokens: 30,
        stream: false,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
      }),
    });

    if (!resp.ok) return;
    const data = await resp.json();
    const title = data.choices?.[0]?.message?.content?.trim().replace(/^["「『]+|["」』]+$/g, '') || '';
    if (title && title.length <= 20 && title !== conv.title) {
      conv.title = title;
      saveConversations();
      renderHistory();
      $('convTitle').textContent = title;
    }
  } catch (_) {
    // Silent fail — keep the auto-title
  }
}

// ==================== Render messages ====================
function renderMessages() {
  const container = $('messageContainer');
  const empty = $('emptyState');

  const msgs = container.querySelectorAll('.message');
  msgs.forEach(el => el.remove());

  const sysContent = $('systemPrompt').value.trim();
  if (sysContent) {
    empty.classList.add('hidden');
    addMessageDOM('system-prompt', sysContent, false);
  }

  if (currentConvMessages.length === 0) {
    if (!sysContent) empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  currentConvMessages.forEach((msg, i) => {
    addMessageDOM(msg.role, msg.content, false, i);
  });
  container.scrollTop = container.scrollHeight;
}

/**
 * Render message content (string or array) to HTML.
 * String: regular markdown rendering via formatContent.
 * Array: text parts (markdown) + file attachments + images.
 */
function renderMessageContent(content, msgId) {
  if (typeof content === 'string') return formatContent(content);

  let html = '';
  for (let i = 0; i < content.length; i++) {
    const part = content[i];
    if (part.type === 'text' && part.text.trim()) {
      html += formatContent(part.text);
    } else if (part.type === 'file') {
      const efName = escapeHtml(part.file.name);
      const efSize = formatFileSize(part.file.size);
      const icon = getFileIcon(part.file.name);
      const fcId = `fc-${msgId}-${i}`;
      // Show first 5000 chars, collapse the rest
      const fileContent = part.file.content || '';
      const isLong = fileContent.length > 5000;
      const displayContent = escapeHtml(isLong ? fileContent.slice(0, 5000) + '\n… (内容已截断，完整内容已发送给 AI)' : fileContent);
      html += `<div class="msg-file">
          <span class="msg-file-icon">${icon}</span>
          <span class="msg-file-info">
            <span class="msg-file-name">${efName}</span>
            <span class="msg-file-size">${efSize}</span>
          </span>
          <button class="msg-file-toggle" onclick="toggleFileContent('${fcId}')">展开 ▾</button>
        </div>
        <div class="msg-file-content collapsed" id="${fcId}">${displayContent}</div>`;
    } else if (part.type === 'image_url') {
      html += `<div class="msg-image"><img src="${escapeHtml(part.image_url.url)}" alt="图片" loading="lazy"></div>`;
    }
  }
  return html;
}

function toggleFileContent(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const btn = el.previousElementSibling?.querySelector('.msg-file-toggle');
  if (el.classList.toggle('collapsed')) {
    if (btn) btn.textContent = '展开 ▾';
  } else {
    if (btn) btn.textContent = '收起 ▴';
  }
}

function addMessageDOM(role, content, isPlaceholder = false, msgIdx = -1) {
  const id = `msg-${++msgCounter}`;
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.id = id;

  const avatarMap = { user: 'U', assistant: 'A', 'system-prompt': 'S', 'system-msg': 'i' };
  const avatarChar = avatarMap[role] || 'i';

  if (role === 'system-msg') {
    div.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>`;
  } else if (role === 'system-prompt') {
    const formatted = formatContent(content);
    const needsCollapse = !isPlaceholder && content.length > COLLAPSE_LENGTH;

    let bubbleInner, footerHtml = '';
    if (isPlaceholder) {
      bubbleInner = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else if (needsCollapse) {
      msgFullContent[id] = formatted;
      bubbleInner = `<div class="bubble-label">系统提示词</div>
        <div class="msg-body collapsed"></div>`;
      footerHtml = `<div class="bubble-footer">
        <button class="collapse-toggle" onclick="toggleMessageCollapse('${id}')">展开 ▾</button>
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
      </div>`;
    } else {
      bubbleInner = `<div class="bubble-label">系统提示词</div>
        <div class="msg-body">${formatted}</div>`;
    }

    div.innerHTML = `
      <div class="avatar">${avatarChar}</div>
      <div class="bubble">${bubbleInner}${footerHtml}</div>`;

    if (needsCollapse) {
      const body = div.querySelector('.msg-body');
      body.dataset.truncated = '';
    }
  } else {
    // user or assistant
    const isArrayContent = Array.isArray(content);
    const textForLength = isArrayContent ? extractTextParts(content) : content;
    const formatted = isPlaceholder ? '' : renderMessageContent(content, id);
    const needsCollapse = !isPlaceholder && role === 'user' && textForLength.length > COLLAPSE_LENGTH;

    let bubbleInner;
    if (isPlaceholder) {
      bubbleInner = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else if (needsCollapse && !isArrayContent) {
      msgFullContent[id] = formatted;
      const preview = textForLength.slice(0, COLLAPSE_LENGTH) + '…';
      bubbleInner = `<div class="msg-body collapsed">${escapeHtml(preview)}</div>`;
    } else {
      bubbleInner = `<div class="msg-body">${formatted}</div>`;
    }

    // Always wrap timestamp + actions in .bubble-footer for consistent row layout
    let footerHtml = '<div class="bubble-footer">';
    if (needsCollapse && !isArrayContent && !isPlaceholder) {
      footerHtml += `<button class="collapse-toggle" onclick="toggleMessageCollapse('${id}')">展开 ▾</button>`;
    }
    footerHtml += `<span class="timestamp">${new Date().toLocaleTimeString()}</span>`;
    if (!isPlaceholder) {
      footerHtml += `<span class="msg-actions">
          <button class="msg-action-btn" onclick="copyMessage('${id}')" title="复制">${ICON_COPY}</button>
          ${role === 'user' && msgIdx >= 0 ? `<button class="msg-action-btn" onclick="editMessage(${msgIdx})" title="编辑">${ICON_EDIT}</button>` : ''}
          ${role === 'assistant' ? `<button class="msg-action-btn" onclick="regenerateMessage()" title="重新生成">${ICON_REGEN}</button>` : ''}
        </span>`;
    }
    footerHtml += '</div>';

    div.innerHTML = `
      <div class="avatar">${avatarChar}</div>
      <div class="bubble">
        ${bubbleInner}
        ${footerHtml}
      </div>`;

    if (needsCollapse && !isArrayContent) {
      const body = div.querySelector('.msg-body');
      body.dataset.truncated = textForLength.slice(0, COLLAPSE_LENGTH) + '…';
    }
  }

  $('messageContainer').appendChild(div);
  $('messageContainer').scrollTop = $('messageContainer').scrollHeight;
  return id;
}

function addMessageActions(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const bubble = el.querySelector('.bubble');
  if (!bubble) return;
  if (bubble.querySelector('.msg-actions')) return;  // already present

  const isAssistant = el.classList.contains('assistant');
  const actions = document.createElement('span');
  actions.className = 'msg-actions';
  actions.innerHTML = `
    <button class="msg-action-btn" onclick="copyMessage('${id}')" title="复制">${ICON_COPY}</button>
    ${isAssistant ? `<button class="msg-action-btn" onclick="regenerateMessage()" title="重新生成">${ICON_REGEN}</button>` : ''}
  `;
  // Place inside .bubble-footer if present, otherwise append to bubble
  const footer = bubble.querySelector('.bubble-footer');
  if (footer) {
    footer.appendChild(actions);
  } else {
    bubble.appendChild(actions);
  }
}

function copyMessage(id) {
  const text = getMessageContent(id);
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('已复制到剪贴板', 'success');
  });
}

function regenerateMessage() {
  if (isStreaming) { showToast('请先停止当前生成', 'error'); return; }
  const lastUserIdx = currentConvMessages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
  if (lastUserIdx === undefined) { showToast('没有可重新生成的消息', 'info'); return; }

  const lastAssistantIdx = currentConvMessages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
  if (lastAssistantIdx !== undefined && lastAssistantIdx > lastUserIdx) {
    currentConvMessages.splice(lastAssistantIdx, 1);
  }

  msgCounter = 0;
  renderMessages();

  window._skipUserPush = true;
  // Pass the content directly — sendMessage already handles both string and array
  sendMessage(currentConvMessages[lastUserIdx].content);
}

function _appendToFooter(bubble, ts, actions) {
  if (!ts && !actions) return;
  let footer = bubble.querySelector('.bubble-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'bubble-footer';
    bubble.appendChild(footer);
  }
  if (ts) footer.appendChild(ts);
  if (actions) footer.appendChild(actions);
}

function updateMessageContent(id, content) {
  const el = document.getElementById(id);
  if (!el) return;
  const bubble = el.querySelector('.bubble');
  if (!bubble) return;
  const ts = bubble.querySelector('.timestamp');
  const actions = bubble.querySelector('.msg-actions');
  bubble.innerHTML = renderMessageContent(content, id);
  _appendToFooter(bubble, ts, actions);
  const container = $('messageContainer');
  if (!container._userScrolledAway) {
    container.scrollTop = container.scrollHeight;
  }
}

function updateMessageWithReasoning(id, reasoning, content) {
  const el = document.getElementById(id);
  if (!el) return;
  const bubble = el.querySelector('.bubble');
  if (!bubble) return;
  const ts = bubble.querySelector('.timestamp');
  const actions = bubble.querySelector('.msg-actions');

  // Preserve details open state across streaming updates
  const existingDetails = bubble.querySelector('.reasoning-block');
  const detailsWasOpen = existingDetails ? existingDetails.open : false;

  let html = '';
  if (reasoning && !content) {
    // Only reasoning received so far — show inline with streaming indicator
    html += `<div class="reasoning-streaming">
        <span>${formatContent(reasoning)}</span>
      </div>`;
  } else if (reasoning && content) {
    // Both reasoning and content available
    html += `<details class="reasoning-block">
        <summary class="reasoning-summary">思考过程</summary>
        <div class="reasoning-content">${formatContent(reasoning)}</div>
      </details>`;
    html += formatContent(content);
  } else {
    // No reasoning, just content
    html = formatContent(content);
  }

  bubble.innerHTML = html;
  // Restore details open state so manual expand/collapse survives streaming updates
  if (detailsWasOpen) {
    const newDetails = bubble.querySelector('.reasoning-block');
    if (newDetails) newDetails.open = true;
  }
  _appendToFooter(bubble, ts, actions);
  const container = $('messageContainer');
  if (!container._userScrolledAway) {
    container.scrollTop = container.scrollHeight;
  }
}

// ==================== Edit message ====================

function editMessage(idx) {
  if (idx < 0 || idx >= currentConvMessages.length) return;
  if (isStreaming) { showToast('请先停止当前生成', 'error'); return; }

  const msg = currentConvMessages[idx];
  if (msg.role !== 'user') return;

  // Extract text and file content
  const text = extractTextParts(msg.content);

  // Restore files/images to pendingFiles if present
  clearPendingFiles();
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'file') {
        pendingFiles.push({
          name: part.file.name,
          size: part.file.size,
          mime: part.file.mime,
          content: part.file.content,
          _type: 'text',
        });
      } else if (part.type === 'image_url') {
        pendingFiles.push({
          name: 'pasted_image.jpg',
          size: Math.round(part.image_url.url.length * 3 / 4),
          mime: 'image/jpeg',
          content: part.image_url.url,
          _type: 'image',
        });
      }
    }
    renderFilePreviews();
  }

  // Set editing state
  editingMsgIdx = idx;

  // Populate textarea
  const input = $('userInput');
  input.value = text;
  autoResize(input);

  // Show editing indicator
  const indicator = $('editingIndicator');
  if (indicator) indicator.classList.remove('hidden');
  input.placeholder = '编辑消息…';
  input.focus();
}

function cancelEdit() {
  if (editingMsgIdx < 0) return;
  editingMsgIdx = -1;
  clearPendingFiles();
  const input = $('userInput');
  input.value = '';
  input.placeholder = '输入消息… (Enter 发送, Shift+Enter 换行)';
  autoResize(input);
  const indicator = $('editingIndicator');
  if (indicator) indicator.classList.add('hidden');
}

function getMessageContent(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  const bubble = el.querySelector('.bubble');
  if (!bubble) return '';
  const clone = bubble.cloneNode(true);
  const ts = clone.querySelector('.timestamp');
  if (ts) ts.remove();
  const toggle = clone.querySelector('.collapse-toggle');
  if (toggle) toggle.remove();
  return clone.textContent.trim();
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
