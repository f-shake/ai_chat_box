// ==================== Init ====================
loadConversations();
loadActiveId();
loadGroups();
loadPrompts();

// Load config
const hasSavedConfig = loadConfigFromStorage();

// Restore active conversation
if (activeConvId) {
  const conv = findConv(activeConvId);
  if (conv) {
    currentConvMessages = conv.messages || [];
    $('convTitle').textContent = getConvTitle(conv);
    // Restore the system prompt that was used in this conversation
    if (conv.systemPrompt) $('systemPrompt').value = conv.systemPrompt;
  } else {
    activeConvId = null;
    currentConvMessages = [];
  }
} else {
  currentConvMessages = [];
}

msgCounter = 0;
renderMessages();
renderHistory();

// Auto-test connection if API URL and Key are already saved
const savedApiUrl = $('apiUrl').value.trim();
const savedApiKey = $('apiKey').value.trim();
if (savedApiUrl && savedApiKey) {
  autoTestConnection();
} else {
  enableChat(false);
}
