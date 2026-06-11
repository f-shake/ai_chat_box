// ==================== Init ====================
loadConversations();
loadActiveId();
loadGroups();
loadPrompts();
loadApiConfigs();
loadActiveApiConfigId();

// Load config params
const hasSavedConfig = loadConfigFromStorage();

// Sync active API config to hidden form fields
const activeConfig = getActiveApiConfig();
if (activeConfig) {
  $('apiUrl').value = activeConfig.apiUrl || '';
  $('apiKey').value = activeConfig.apiKey || '';
  $('model').value = activeConfig.model || '';
}

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
renderApiConfigs();

// Auto-test connection if API URL is already saved
const savedApiUrl = $('apiUrl').value.trim();
if (savedApiUrl) {
  autoTestConnection();
} else {
  enableChat(false);
}
