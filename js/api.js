// ==================== Send message ====================
async function sendMessage(text) {
  const userInput = $('userInput');
  const apiUrl = $('apiUrl');
  const apiKey = $('apiKey');
  const model = $('model');
  const sendBtn = $('sendBtn');
  const stopBtn = $('stopBtn');
  const systemPrompt = $('systemPrompt');
  const temperature = $('temperature');
  const maxTokens = $('maxTokens');
  const historyLimit = $('historyLimit');

  // Determine user content: could be a string (plain text), array (from regenerate with files), or undefined (read from textarea)
  let userContent;
  let isPrebuilt = false;

  if (typeof text === 'string') {
    // Plain text passed (from regenerateMessage or manual send)
    const trimmed = text;
    const hasFiles = pendingFiles.length > 0;
    if (!trimmed && !hasFiles) return;
    if (isStreaming) return;

    if (hasFiles) {
      userContent = [];
      if (trimmed) userContent.push({ type: 'text', text: trimmed });
      for (const f of pendingFiles) {
        if (f._type === 'image') {
          userContent.push({ type: 'image_url', image_url: { url: f.content } });
        } else {
          userContent.push({ type: 'file', file: { name: f.name, content: f.content, size: f.size, mime: f.mime } });
        }
      }
    } else {
      userContent = trimmed;
    }
  } else if (Array.isArray(text)) {
    // Pre-built content array (from regenerateMessage with files)
    userContent = text;
    isPrebuilt = true;
  } else {
    // text === undefined — read from textarea + pendingFiles
    const trimmed = userInput.value.trim();
    const hasFiles = pendingFiles.length > 0;
    if (!trimmed && !hasFiles) return;
    if (isStreaming) return;

    if (hasFiles) {
      userContent = [];
      if (trimmed) userContent.push({ type: 'text', text: trimmed });
      for (const f of pendingFiles) {
        if (f._type === 'image') {
          userContent.push({ type: 'image_url', image_url: { url: f.content } });
        } else {
          userContent.push({ type: 'file', file: { name: f.name, content: f.content, size: f.size, mime: f.mime } });
        }
      }
    } else {
      userContent = trimmed;
    }
  }

  if (typeof userContent === 'string' && !userContent) return;
  if (isStreaming) return;

  // Handle edit mode: truncate messages at the edited index (after content is built, before pushing)
  if (editingMsgIdx >= 0) {
    currentConvMessages = currentConvMessages.slice(0, editingMsgIdx);
    msgCounter = 0;
    cancelEdit();
    renderMessages();
  }

  const url = apiUrl.value.trim().replace(/\/+$/, '');
  const key = apiKey.value.trim();
  const mdl = model.value.trim();
  if (!url || !mdl) {
    showToast('请先完成 API 配置并测试连接', 'error');
    return;
  }

  if (!activeConvId) {
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
    saveActiveId();
  }

  const _pushedUser = !window._skipUserPush;
  if (_pushedUser) {
    currentConvMessages.push({ role: 'user', content: userContent });
    addMessageDOM('user', userContent, false, currentConvMessages.length - 1);
  }
  window._skipUserPush = false;
  $('emptyState').classList.add('hidden');
  userInput.value = '';
  autoResize(userInput);

  // Clear pending files if we consumed them
  if (!isPrebuilt) clearPendingFiles();

  const msgId = addMessageDOM('assistant', '', true);

  const sys = systemPrompt.value.trim();
  const historyLimitVal = parseInt(historyLimit.value) || 20;
  const msgsForApi = [];
  if (sys) msgsForApi.push({ role: 'system', content: sys });
  // Use history slice excluding the last message (current user msg), then append current msg once
  const slice = historyLimitVal > 0 ? currentConvMessages.slice(-historyLimitVal * 2, -1) : [];
  for (const m of slice) msgsForApi.push({ role: m.role, content: flattenContentForApi(m.content) });
  msgsForApi.push({ role: 'user', content: flattenContentForApi(userContent) });

  const body = {
    model: mdl,
    messages: msgsForApi,
    temperature: parseFloat(temperature.value) || 0.7,
    stream: true,
  };

  const mt = parseInt(maxTokens.value);
  if (mt > 0) body.max_tokens = mt;
  const tp = parseFloat($('topP').value);
  if (tp !== undefined && tp !== 1.0) body.top_p = tp;
  const fp = parseFloat($('frequencyPenalty').value);
  if (fp !== undefined && fp !== 0) body.frequency_penalty = fp;
  const pp = parseFloat($('presencePenalty').value);
  if (pp !== undefined && pp !== 0) body.presence_penalty = pp;
  const reasonEl = $('reasoningToggle');
  if (reasonEl && reasonEl.checked) {
    body.reasoning_effort = 'high';
    body.thinking = { type: 'enabled' };
  }

  controller = new AbortController();
  isStreaming = true;
  sendBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  userInput.disabled = true;

  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const resp = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}${errBody ? ' — ' + errBody.slice(0, 300) : ''}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    const isReasoningEnabled = reasonEl && reasonEl.checked;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const t = line.trim();
        if (!t || t === 'data: [DONE]') continue;
        if (!t.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(t.slice(6));
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;

          const contentDelta = delta.content || '';
          const reasoningDelta = delta.reasoning_content || '';

          if (contentDelta) {
            fullContent += contentDelta;
          }
          if (reasoningDelta) {
            fullReasoning += reasoningDelta;
          }

          if (contentDelta || reasoningDelta) {
            if (isReasoningEnabled) {
              updateMessageWithReasoning(msgId, fullReasoning, fullContent);
            } else {
              if (contentDelta) {
                updateMessageContent(msgId, fullContent);
              }
            }
          }
        } catch (_) {}
      }
    }

    if (isReasoningEnabled) {
      updateMessageWithReasoning(msgId, fullReasoning, fullContent);
    } else {
      updateMessageContent(msgId, fullContent);
    }
    currentConvMessages.push({ role: 'assistant', content: fullContent });
    const convDirty = findConv(activeConvId);
    if (convDirty) convDirty.updatedAt = getNow();
    saveCurrentConversation();
    addMessageActions(msgId);
    // Async title generation — only for the first user message
    const userMsgCount = currentConvMessages.filter(m => m.role === 'user').length;
    if (userMsgCount <= 1) {
      setTimeout(() => generateConversationTitle(), 100);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      const partial = fullContent || getMessageContent(msgId);
      if (partial) {
        currentConvMessages.push({ role: 'assistant', content: partial });
        const convDirty = findConv(activeConvId);
        if (convDirty) convDirty.updatedAt = getNow();
        saveCurrentConversation();
        addMessageActions(msgId);
      }
      showToast('已停止生成', 'info');
    } else {
      showToast('请求失败: ' + err.message, 'error');
      removeMessage(msgId);
      if (_pushedUser) currentConvMessages.pop();
    }
  } finally {
    isStreaming = false;
    controller = null;
    sendBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    userInput.disabled = false;
    userInput.focus();
    autoResize(userInput);
  }
}

// ==================== Stop ====================
function stopStream() {
  if (controller) controller.abort();
}

// ==================== Test connection ====================

/**
 * Try to reach the API. First attempts GET /models (OpenAI standard),
 * then falls back to POST /chat/completions (compatible with many local servers).
 * Returns { success, text } where text is a display label for the status bar.
 */
async function tryTestConnection(url, key, modelHint) {
  // Only include auth header if key is provided
  function authHeaders() {
    const h = {};
    if (key) h['Authorization'] = `Bearer ${key}`;
    return h;
  }

  // GET /models — standard OpenAI endpoint
  try {
    console.log('[conn] testing GET /models …');
    // Use cache-busting to avoid 304 (Not Modified) on repeat tests
    const resp = await fetch(`${url}/models?_=${Date.now()}`, {
      headers: authHeaders(),
    });
    if (resp.ok || resp.status === 304) {
      if (resp.status === 304) {
        // 304 means the server is reachable and endpoint exists (browser cache)
        console.log('[conn] /models 304 (server reachable)');
        return { success: true, text: '已连接（服务器可达）', models: [] };
      }
      const data = await resp.json();
      const models = data.data || [];
      const count = models.length || '?';
      console.log('[conn] /models OK');
      return { success: true, text: `已连接（${count} 个模型）`, models };
    }
    const body = await resp.text().catch(() => '');
    return { success: false, text: `HTTP ${resp.status}${body ? ': ' + body.slice(0, 200) : ''}` };
  } catch (e) {
    console.log('[conn] /models error', e.message);
    return { success: false, text: e.message || '无法连接到服务' };
  }
}

async function testConnection() {
  const apiUrl = $('apiUrl');
  const apiKey = $('apiKey');
  const statusDot = $('statusDot');
  const statusText = $('statusText');
  const testBtn = $('testBtn');

  const url = apiUrl.value.trim().replace(/\/+$/, '');
  const key = apiKey.value.trim();
  if (!url) { showToast('请输入 API 地址', 'error'); return; }
  if (!/^https?:\/\//.test(url)) { showToast('API 地址格式不正确', 'error'); return; }

  testBtn.disabled = true;
  testBtn.textContent = '测试中…';
  statusDot.className = 'status-dot checking';
  statusText.textContent = '连接测试中…';

  const mdl = $('model').value.trim();
  const result = await tryTestConnection(url, key, mdl);

  if (result.success) {
    statusDot.className = 'status-dot online';
    statusText.textContent = result.text;
    showToast('连接成功！', 'success');
    enableChat(true);
    if (typeof updateApiConfigStatus === 'function' && activeApiConfigId) {
      updateApiConfigStatus(activeApiConfigId, 'online');
    }
  } else {
    statusDot.className = 'status-dot offline';
    statusText.textContent = '连接失败';
    showToast('连接失败: ' + result.text, 'error');
    enableChat(false);
    if (typeof updateApiConfigStatus === 'function' && activeApiConfigId) {
      updateApiConfigStatus(activeApiConfigId, 'offline', result.text);
    }
  }

  testBtn.disabled = false;
  testBtn.textContent = '测试连接';
}

function enableChat(on) {
  $('userInput').disabled = !on;
  $('sendBtn').disabled = !on;
  const uploadLabel = $('uploadLabel');
  if (uploadLabel) {
    uploadLabel.classList.toggle('disabled', !on);
    const inp = uploadLabel.querySelector('input[type="file"]');
    if (inp) inp.disabled = !on;
  }
  if (on) $('userInput').focus();
}

async function autoTestConnection() {
  const apiUrl = $('apiUrl').value.trim().replace(/\/+$/, '');
  const apiKey = $('apiKey').value.trim();
  if (!apiUrl) return;

  const statusDot = $('statusDot');
  const statusText = $('statusText');

  statusDot.className = 'status-dot checking';
  statusText.textContent = '自动检测中…';

  const mdl = $('model').value.trim();
  const result = await tryTestConnection(apiUrl, apiKey, mdl);

  if (result.success) {
    statusDot.className = 'status-dot online';
    statusText.textContent = result.text;
    enableChat(true);
    if (typeof updateApiConfigStatus === 'function' && activeApiConfigId) {
      updateApiConfigStatus(activeApiConfigId, 'online');
    }
  } else {
    statusDot.className = 'status-dot offline';
    statusText.textContent = '自动连接失败，请检查配置';
    enableChat(false);
    if (typeof updateApiConfigStatus === 'function' && activeApiConfigId) {
      updateApiConfigStatus(activeApiConfigId, 'offline', result.text);
    }
  }
}

// ==================== Clear & Export ====================
function clearMessages() {
  if (isStreaming) { showToast('请先停止当前生成', 'error'); return; }
  if (!activeConvId) { showToast('没有活跃对话', 'info'); return; }
  if (!confirm('确定清空当前对话的所有消息吗？')) return;

  const conv = findConv(activeConvId);
  if (conv) {
    conv.messages = [];
    conv.updatedAt = getNow();
    saveConversations();
  }
  currentConvMessages = [];
  msgCounter = 0;
  renderMessages();
  $('convTitle').textContent = '新对话';
  renderHistory();
  showToast('对话已清空', 'info');
}

function exportChat() {
  if (currentConvMessages.length === 0) {
    showToast('没有可导出的消息', 'info');
    return;
  }

  const rows = [['时间', '角色', '内容']];
  const msgEls = $('messageContainer').querySelectorAll('.message');
  msgEls.forEach(el => {
    const role = el.classList.contains('user') ? '用户' : el.classList.contains('assistant') ? 'AI' : '系统';
    const bubble = el.querySelector('.bubble');
    const ts = el.querySelector('.timestamp');
    const time = ts ? ts.textContent.trim() : '';
    const content = bubble ? bubble.textContent.replace(ts ? ts.textContent : '', '').trim() : '';
    rows.push([time, role, content]);
  });

  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('已导出为 CSV', 'success');
}

// ==================== Key handler ====================
function handleKeyDown(e) {
  if (e.key === 'Escape' && editingMsgIdx >= 0) {
    e.preventDefault();
    cancelEdit();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
