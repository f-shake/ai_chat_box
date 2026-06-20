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
    saveConversations();
  }

  const _pushedUser = !window._skipUserPush;
  if (_pushedUser) {
    currentConvMessages.push({ role: 'user', content: userContent });
    addMessageDOM('user', userContent, false, currentConvMessages.length - 1);
  }
  window._skipUserPush = false;
  // Persist immediately so user message isn't lost on crash/interrupt
  saveCurrentConversation();
  $('emptyState').classList.add('hidden');
  userInput.value = '';
  autoResize(userInput);

  // Clear pending files if we consumed them
  if (!isPrebuilt) clearPendingFiles();

  const msgId = addMessageDOM('assistant', '', true);

  const sys = replacePromptPlaceholders(systemPrompt.value.trim());
  const _searchEnabled = searchConfig && searchConfig.enabled && searchConfig.proxyUrl;

  // 联网搜索开启时，在系统提示词中告诉模型如何使用搜索工具
  let searchGuidance = '';
  if (_searchEnabled) {
    searchGuidance = '\n\n【联网搜索能力】\n'
      + '1. 你可以使用 web_search 搜索互联网获取最新信息。\n'
      + '2. 对于你知道的网站（如天气网站、财经网站等），可以直接用 web_fetch 获取内容，不必先搜索。\n'
      + '3. 如果搜索结果摘要中的信息不足，请用 web_fetch 打开最相关的链接获取完整内容。\n'
      + '4. 搜索结果同时来自搜狗、必应、360 等多个搜索引擎，每个引擎的结果分开返回，请综合多个来源的信息给出更准确的回答。';
  }

  const historyLimitVal = parseInt(historyLimit.value) || 20;
  const msgsForApi = [];
  if (sys) msgsForApi.push({ role: 'system', content: sys + searchGuidance });
  else if (searchGuidance) msgsForApi.push({ role: 'system', content: searchGuidance });
  // Use history slice excluding the last message (current user msg), then append current msg once
  const slice = historyLimitVal > 0 ? currentConvMessages.slice(-historyLimitVal * 2, -1) : [];
  for (const m of slice) {
    if (m.role === 'system-msg') continue; // 跳过仅用于展示的消息
    msgsForApi.push({ role: m.role, content: flattenContentForApi(m.content) });
  }
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
  if (reasonEl) {
    if (reasonEl.checked) {
      body.reasoning_effort = 'high';
      body.thinking = { type: 'enabled' };
      body.extra_body = { chat_template_kwargs: { enable_thinking: true } };
    } else {
      body.extra_body = { chat_template_kwargs: { enable_thinking: false } };
    }
  }

  // ===== 联网搜索：注入 tools 定义 =====
  if (_searchEnabled) {
    body.tools = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: '搜索互联网获取最新信息。结果来自搜狗、必应、360等多个搜索引擎。当用户询问实时新闻、最新事件、不确定的事实、需要查询资料等场景时使用。',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词，尽量简洁准确，使用中文搜索' },
              count: { type: 'number', description: '每个引擎返回几条结果，默认8条', default: 8 }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'web_fetch',
          description: '获取指定URL的详细页面内容。当搜索结果摘要信息不足时，用此工具获取完整页面内容。',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '要读取的完整网页地址' }
            },
            required: ['url']
          }
        }
      }
    ];
  }

  controller = new AbortController();
  isStreaming = true;
  sendBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  userInput.disabled = true;

  // Track streaming state so beforeunload can save partial content
  let _chunkCount = 0;
  let fullContent = '';
  let fullReasoning = '';
  const _pendingToolCalls = [];
  let _lastFinishReason = null;

  // Auto-save partial content every 3s so it survives crash/tab-close
  // Only save when there's actual content (fullContent), not just reasoning
  const _saveTimer = setInterval(() => {
    if (fullContent) {
      const conv = findConv(activeConvId);
      if (conv) {
        conv.messages = currentConvMessages;
        currentConvMessages.push({ role: 'assistant', content: fullContent, reasoning_content: fullReasoning });
        saveConversations();
        currentConvMessages.pop();
      }
    }
  }, 3000);

  // Save partial content when the page is closed/refreshed mid-stream
  // Only save actual content (fullContent), not just reasoning
  const _beforeUnloadHandler = () => {
    if (fullContent) {
      currentConvMessages.push({ role: 'assistant', content: fullContent });
      saveConversations();
      currentConvMessages.pop();
    }
  };
  window.addEventListener('beforeunload', _beforeUnloadHandler);

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
    fullContent = '';
    fullReasoning = '';
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

          // 收集 tool_calls（流式分块到达，按 index 合并）
          const toolCallsDelta = delta.tool_calls;
          if (toolCallsDelta && _searchEnabled) {
            for (const tc of toolCallsDelta) {
              const idx = tc.index;
              if (!_pendingToolCalls[idx]) {
                _pendingToolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) _pendingToolCalls[idx].id = tc.id;
              if (tc.type) _pendingToolCalls[idx].type = tc.type;
              if (tc.function) {
                if (tc.function.name) _pendingToolCalls[idx].function.name += tc.function.name;
                if (tc.function.arguments !== undefined) _pendingToolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          }

          // 记录 finish_reason（在最后一个 chunk 中出现）
          const finishReason = json.choices[0]?.finish_reason;
          if (finishReason) _lastFinishReason = finishReason;

          if (contentDelta || reasoningDelta) {
            _chunkCount++;
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

    // ===== 判断是否触发了工具调用（联网搜索） =====
    const hasToolCalls = _lastFinishReason === 'tool_calls' && _pendingToolCalls.length > 0;

    if (hasToolCalls) {
      // ---- 整轮对话是「一次回复」，所有内容累积到同一条消息展示 ----
      saveCurrentConversation();

      let displayContent = fullContent || '';

      // 更新/移除初始占位
      if (displayContent) {
        updateMessageContent(msgId, displayContent);
      } else {
        removeMessage(msgId);
      }

      // 保存第一轮 tool_calls（用于 API 上下文）
      currentConvMessages.push({
        role: 'assistant',
        content: fullContent || null,
        tool_calls: _pendingToolCalls.map(tc => ({
          id: tc.id, type: tc.type,
          function: { name: tc.function.name, arguments: tc.function.arguments }
        }))
      });

      // 两阶段状态：先显示搜索中，执行完再改为完成
      const _s0 = displayContent.length;
      displayContent += '\n\n' + _formatToolInProgress(_pendingToolCalls);
      updateMessageContent(msgId, displayContent);

      let toolResults = await executeToolCalls(_pendingToolCalls);
      for (const tr of toolResults) currentConvMessages.push(tr);

      // 回滚"搜索中"，替换为"搜索完成"
      displayContent = displayContent.slice(0, _s0);
      displayContent += '\n\n' + _formatToolResult(_pendingToolCalls, toolResults);
      updateMessageContent(msgId, displayContent);

      // === 多轮循环：无限制 ===
      while (true) {
        saveCurrentConversation();

        const roundResult = await streamToolRound(msgsForApi, toolResults, msgId, displayContent);

        if (roundResult.finishReason === 'tool_calls' && roundResult.toolCalls.length > 0) {
          // AI 本轮说的话 → 追加到展示
          if (roundResult.content) {
            displayContent += '\n\n' + roundResult.content;
            updateMessageContent(msgId, displayContent);
          }

          // 保存到 conv（API 上下文需要 assistant(tool_calls) 记录）
          currentConvMessages.push({
            role: 'assistant',
            content: roundResult.content || null,
            tool_calls: roundResult.toolCalls.map(tc => ({
              id: tc.id, type: tc.type,
              function: { name: tc.function.name, arguments: tc.function.arguments }
            }))
          });

          // 两阶段：先显示搜索中，执行完改为搜索完成
          const _s1 = displayContent.length;
          displayContent += '\n\n' + _formatToolInProgress(roundResult.toolCalls);
          updateMessageContent(msgId, displayContent);

          toolResults = await executeToolCalls(roundResult.toolCalls);
          for (const tr of toolResults) currentConvMessages.push(tr);

          displayContent = displayContent.slice(0, _s1);
          displayContent += '\n\n' + _formatToolResult(roundResult.toolCalls, toolResults);
          updateMessageContent(msgId, displayContent);
        } else {
          // 最终回答
          if (roundResult.content) {
            displayContent += '\n\n' + roundResult.content;
            updateMessageContent(msgId, displayContent);
          }

          // 保存最终回复
          currentConvMessages.push({
            role: 'assistant',
            content: displayContent,
            reasoning_content: roundResult.reasoning || ''
          });
          const convDirty = findConv(activeConvId);
          if (convDirty) convDirty.updatedAt = getNow();
          saveCurrentConversation();

          // 只在最终消息上一次操作按钮
          addMessageActions(msgId, currentConvMessages.length - 1);

          // 标题生成
          const userMsgCount = currentConvMessages.filter(m => m.role === 'user').length;
          if (userMsgCount <= 1) {
            setTimeout(() => generateConversationTitle(), 100);
          }
          break;
        }
      }

    } else {
      // ---- 正常完成：模型直接返回文本内容 ----
      if (isReasoningEnabled) {
        updateMessageWithReasoning(msgId, fullReasoning, fullContent);
      } else {
        updateMessageContent(msgId, fullContent);
      }
      currentConvMessages.push({ role: 'assistant', content: fullContent, reasoning_content: fullReasoning });
      const convDirty = findConv(activeConvId);
      if (convDirty) convDirty.updatedAt = getNow();
      saveCurrentConversation();
      addMessageActions(msgId, currentConvMessages.length - 1);
      // Async title generation — only for the first user message
      const userMsgCount = currentConvMessages.filter(m => m.role === 'user').length;
      if (userMsgCount <= 1) {
        setTimeout(() => generateConversationTitle(), 100);
      }
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      // Only save if there's actual content, not just reasoning/thinking
      if (fullContent) {
        currentConvMessages.push({ role: 'assistant', content: fullContent, reasoning_content: fullReasoning });
        const convDirty = findConv(activeConvId);
        if (convDirty) convDirty.updatedAt = getNow();
        saveCurrentConversation();
        addMessageActions(msgId, currentConvMessages.length - 1);
      } else {
        // Only reasoning content or nothing — discard the placeholder message
        removeMessage(msgId);
      }
      showToast('已停止生成', 'info');
    } else {
      // Network/API error — save partial content if any, otherwise clean up
      if (fullContent) {
        // Update DOM with partial content before adding actions
        const displayContent = fullContent + '\n\n*——回复被中断，以上为部分内容*';
        updateMessageContent(msgId, displayContent);
        currentConvMessages.push({ role: 'assistant', content: displayContent });
        const convDirty = findConv(activeConvId);
        if (convDirty) convDirty.updatedAt = getNow();
        saveCurrentConversation();
        addMessageActions(msgId, currentConvMessages.length - 1);
      } else {
        // No actual content — just remove the placeholder, keep user message
        removeMessage(msgId);
      }
      showToast('请求失败: ' + err.message, 'error');
    }
  } finally {
    clearInterval(_saveTimer);
    window.removeEventListener('beforeunload', _beforeUnloadHandler);
    isStreaming = false;
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
    $('userInput').placeholder = '输入消息… (Enter 发送, Shift+Enter 换行)';
    enableChat(true);
    if (typeof updateApiConfigStatus === 'function' && activeApiConfigId) {
      updateApiConfigStatus(activeApiConfigId, 'online');
    }
  } else {
    statusDot.className = 'status-dot offline';
    statusText.textContent = '连接失败';
    showToast('连接失败: ' + result.text, 'error');
    $('userInput').placeholder = '连接失败，请检查服务配置';
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
    $('userInput').placeholder = '输入消息… (Enter 发送, Shift+Enter 换行)';
    enableChat(true);
    if (typeof updateApiConfigStatus === 'function' && activeApiConfigId) {
      updateApiConfigStatus(activeApiConfigId, 'online');
    }
  } else {
    statusDot.className = 'status-dot offline';
    statusText.textContent = '自动连接失败，请检查配置';
    enableChat(false);
    $('userInput').placeholder = '连接失败，请检查服务配置';
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

// ==================== 联网搜索：执行工具调用 ====================

/**
 * 执行模型返回的 tool_calls（web_search / web_fetch）
 * @param {Array} toolCalls - 工具调用数组 [{id, type, function: {name, arguments}}]
 * @returns {Promise<Array<{role:string, tool_call_id:string, content:string}>>}
 */
async function executeToolCalls(toolCalls) {
  const results = [];
  for (const tc of toolCalls) {
    try {
      const args = JSON.parse(tc.function.arguments);
      let result;
      if (tc.function.name === 'web_search') {
        const query = args.query || '';
        const count = args.count || 8;
        if (!query) throw new Error('搜索关键词为空');
        result = await searchWeb(query, count);
      } else if (tc.function.name === 'web_fetch') {
        const url = args.url || '';
        if (!url) throw new Error('URL 为空');
        result = { content: await fetchWebpage(url) };
      } else {
        throw new Error('未知工具: ' + tc.function.name);
      }
      results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    } catch (e) {
      console.error('[search] 工具执行失败:', tc.function?.name, e);
      results.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: e.message }) });
    }
  }
  return results;
}

/**
 * 格式化工具调用结果为纯文本（> 会被 marked 渲染为 blockquote）
 * @returns {string} 格式化的状态文本
 */
/** 工具执行前的状态：搜索中/抓取中，显示关键词或URL */
function _formatToolInProgress(toolCalls) {
  const lines = [];
  for (const tc of toolCalls) {
    try {
      const args = JSON.parse(tc.function.arguments);
      if (tc.function.name === 'web_search') {
        lines.push('> 搜索中: ' + (args.query || ''));
      } else if (tc.function.name === 'web_fetch') {
        lines.push('> 抓取中: ' + (args.url || ''));
      }
    } catch {
      lines.push('> 执行中...');
    }
  }
  return lines.join('\n');
}

/** 工具执行后的结果状态 */
function _formatToolResult(toolCalls, toolResults) {
  const lines = [];
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const tr = toolResults[i];
    if (!tr) continue;
    try {
      const args = JSON.parse(tc.function.arguments);
      const result = JSON.parse(tr.content);
      if (tc.function.name === 'web_search') {
        const query = args.query || '';
        if (Array.isArray(result)) {
          lines.push('> 搜索完成（共 ' + result.length + ' 条结果）: ' + query);
        } else if (result && result.error) {
          lines.push('> 搜索失败: ' + query + ' — ' + result.error.slice(0, 50));
        }
      } else if (tc.function.name === 'web_fetch') {
        const url = args.url || '';
        if (result && result.content) {
          lines.push('> 页面已获取（约 ' + result.content.length + ' 字）: ' + url);
        } else if (result && result.error) {
          lines.push('> 抓取失败: ' + url + ' — ' + result.error.slice(0, 50));
        }
      }
    } catch (_) {}
  }
  return lines.join('\n');
}

/**
 * 流式请求 + 收集工具调用（供多轮循环使用）
 * 发起到模型的流式请求（带 tools），解析 SSE，返回内容+工具调用结果
 * 可指定 existingMsgId 将流式内容直接写入已有消息，避免视觉跳跃
 * @param {Array} originalMessages - 原始请求的 messages
 * @param {Array} toolResults - 最近一轮的工具执行结果
 * @param {string} [existingMsgId] - 可指定已有消息 ID，流式内容将写入此消息（显示累积内容）
 * @param {string} [baseContent] - 配合 existingMsgId，已有消息中已显示的内容起始值
 * @returns {Promise<{msgId:string, content:string, reasoning:string, finishReason:string|null, toolCalls:Array}>}
 */
async function streamToolRound(originalMessages, toolResults, existingMsgId, baseContent) {
  const apiUrl = $('apiUrl');
  const apiKey = $('apiKey');
  const model = $('model');
  const reasonEl = $('reasoningToggle');

  // 构建本轮请求的消息列表：从原始消息开始，追加所有工具调用相关消息
  const roundMessages = [...originalMessages];

  // 从 currentConvMessages 中找出所有工具调用消息追加进去
  // 这些包括 assistant(tool_calls) 和 tool(结果) 角色
  for (const m of currentConvMessages) {
    if (m.role === 'assistant' && m.tool_calls) {
      roundMessages.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.tool_calls.map(tc => ({
          id: tc.id, type: tc.type,
          function: { name: tc.function.name, arguments: tc.function.arguments }
        }))
      });
    } else if (m.role === 'tool') {
      roundMessages.push({
        role: 'tool',
        tool_call_id: m.tool_call_id,
        content: m.content,
      });
    }
  }

  const body = {
    model: model.value.trim(),
    messages: roundMessages,
    temperature: parseFloat($('temperature').value) || 0.7,
    stream: true,
  };

  // 带上 tools 定义，允许模型继续调用工具
  const _searchEnabled = searchConfig && searchConfig.enabled && searchConfig.proxyUrl;
  if (_searchEnabled) {
    body.tools = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: '搜索互联网获取最新信息。结果来自搜狗、必应、360等多个搜索引擎。当用户询问实时新闻、最新事件、不确定的事实、需要查询资料等场景时使用。',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词，尽量简洁准确，使用中文搜索' },
              count: { type: 'number', description: '每个引擎返回几条结果，默认8条', default: 8 }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'web_fetch',
          description: '获取指定URL的详细页面内容。当搜索结果摘要信息不足时，用此工具获取完整页面内容。',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '要读取的完整网页地址' }
            },
            required: ['url']
          }
        }
      }
    ];
  }

  const mt = parseInt($('maxTokens').value);
  if (mt > 0) body.max_tokens = mt;
  const tp = parseFloat($('topP').value);
  if (tp !== undefined && tp !== 1.0) body.top_p = tp;
  const fp = parseFloat($('frequencyPenalty').value);
  if (fp !== undefined && fp !== 0) body.frequency_penalty = fp;
  const pp = parseFloat($('presencePenalty').value);
  if (pp !== undefined && pp !== 0) body.presence_penalty = pp;
  if (reasonEl) {
    if (reasonEl.checked) {
      body.reasoning_effort = 'high';
      body.thinking = { type: 'enabled' };
      body.extra_body = { chat_template_kwargs: { enable_thinking: true } };
    } else {
      body.extra_body = { chat_template_kwargs: { enable_thinking: false } };
    }
  }

  // 使用已有消息或创建新占位
  const msgId = existingMsgId || addMessageDOM('assistant', '', true);

  const url = apiUrl.value.trim().replace(/\/+$/, '');
  const key = apiKey.value.trim();
  if (!url || !model.value.trim()) {
    removeMessage(msgId);
    showToast('API 配置不完整', 'error');
    return { msgId, content: '', reasoning: '', finishReason: null, toolCalls: [] };
  }

  controller = new AbortController();

  // 使用已有消息时，DOM 更新保持已有内容可见
  const _initialContent = baseContent || '';
  const _displayContent = () => {
    if (_initialContent && fullContent) return _initialContent + '\n\n' + fullContent;
    return _initialContent || fullContent;
  };
  let fullContent = '';
  let fullReasoning = '';
  const isReasoningEnabled = reasonEl && reasonEl.checked;
  const toolCalls = [];
  let finishReason = null;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const resp = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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

          if (contentDelta) fullContent += contentDelta;
          if (reasoningDelta) fullReasoning += reasoningDelta;

          // 收集 tool_calls
          const toolCallsDelta = delta.tool_calls;
          if (toolCallsDelta && _searchEnabled) {
            for (const tc of toolCallsDelta) {
              const idx = tc.index;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.type) toolCalls[idx].type = tc.type;
              if (tc.function) {
                if (tc.function.name) toolCalls[idx].function.name += tc.function.name;
                if (tc.function.arguments !== undefined) toolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          }

          // 记录 finish_reason
          const fr = json.choices[0]?.finish_reason;
          if (fr) finishReason = fr;

          if (contentDelta || reasoningDelta) {
            if (isReasoningEnabled) {
              updateMessageWithReasoning(msgId, fullReasoning, _displayContent());
            } else if (contentDelta) {
              updateMessageContent(msgId, _displayContent());
            }
          }
        } catch (_) {}
      }
    }

    // 流结束，最终更新
    return {
      msgId,
      content: fullContent,
      reasoning: fullReasoning,
      finishReason,
      toolCalls: toolCalls.filter(Boolean),
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      if (fullContent) {
        const displayContent = fullContent + '\n\n*——生成已停止*';
        updateMessageContent(msgId, displayContent);
        return { msgId, content: displayContent, reasoning: fullReasoning, finishReason: null, toolCalls: [] };
      }
      removeMessage(msgId);
      return { msgId, content: '', reasoning: '', finishReason: null, toolCalls: [] };
    } else {
      if (fullContent) {
        const displayContent = fullContent + '\n\n*——请求失败，以上为部分内容*';
        updateMessageContent(msgId, displayContent);
      } else {
        removeMessage(msgId);
      }
      showToast('请求失败: ' + err.message, 'error');
      return { msgId, content: fullContent, reasoning: fullReasoning, finishReason: null, toolCalls: [] };
    }
  }
}
