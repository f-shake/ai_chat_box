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

  if (text === undefined) text = userInput.value.trim();
  if (!text) return;
  if (isStreaming) return;

  const url = apiUrl.value.trim().replace(/\/+$/, '');
  const key = apiKey.value.trim();
  const mdl = model.value.trim();
  if (!url || !key || !mdl) {
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
    currentConvMessages.push({ role: 'user', content: text });
    addMessageDOM('user', text);
  }
  window._skipUserPush = false;
  $('emptyState').classList.add('hidden');
  userInput.value = '';
  autoResize(userInput);

  const msgId = addMessageDOM('assistant', '', true);

  const sys = systemPrompt.value.trim();
  const historyLimitVal = parseInt(historyLimit.value) || 20;
  const msgsForApi = [];
  if (sys) msgsForApi.push({ role: 'system', content: sys });
  const slice = historyLimitVal > 0 ? currentConvMessages.slice(-historyLimitVal * 2) : [];
  for (const m of slice) msgsForApi.push({ role: m.role, content: m.content });
  msgsForApi.push({ role: 'user', content: text });

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
    const resp = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
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
    // Async title generation — non-blocking
    setTimeout(() => generateConversationTitle(), 100);

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
async function testConnection() {
  const apiUrl = $('apiUrl');
  const apiKey = $('apiKey');
  const statusDot = $('statusDot');
  const statusText = $('statusText');
  const testBtn = $('testBtn');
  const userInput = $('userInput');
  const sendBtn = $('sendBtn');

  const url = apiUrl.value.trim().replace(/\/+$/, '');
  const key = apiKey.value.trim();
  if (!url) { showToast('请输入 API 地址', 'error'); return; }
  if (!key) { showToast('请输入 API Key', 'error'); return; }
  if (!/^https?:\/\//.test(url)) { showToast('API 地址格式不正确', 'error'); return; }

  testBtn.disabled = true;
  testBtn.textContent = '测试中…';
  statusDot.className = 'status-dot checking';
  statusText.textContent = '连接测试中…';

  try {
    const resp = await fetch(`${url}/models`, {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}${body ? ': ' + body.slice(0, 200) : ''}`);
    }
    const data = await resp.json();
    statusDot.className = 'status-dot online';
    statusText.textContent = `已连接（${data.data?.length ?? '?'} 个模型）`;
    showToast('连接成功！', 'success');
    enableChat(true);
  } catch (err) {
    statusDot.className = 'status-dot offline';
    statusText.textContent = '连接失败';
    showToast('连接失败: ' + err.message, 'error');
    enableChat(false);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
  }
}

function enableChat(on) {
  $('userInput').disabled = !on;
  $('sendBtn').disabled = !on;
  if (on) $('userInput').focus();
}

async function autoTestConnection() {
  const apiUrl = $('apiUrl').value.trim().replace(/\/+$/, '');
  const apiKey = $('apiKey').value.trim();
  if (!apiUrl || !apiKey) return;

  const statusDot = $('statusDot');
  const statusText = $('statusText');

  statusDot.className = 'status-dot checking';
  statusText.textContent = '自动检测中…';

  try {
    const resp = await fetch(`${apiUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    statusDot.className = 'status-dot online';
    statusText.textContent = `已连接（${data.data?.length ?? '?'} 个模型）`;
    enableChat(true);
  } catch (_) {
    statusDot.className = 'status-dot offline';
    statusText.textContent = '自动连接失败，请检查配置';
    enableChat(false);
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
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
