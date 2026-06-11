// ==================== Init ====================
(async function init() {
  await initDB();
  initTheme();
  initSidebar();

loadConversations();
loadActiveId();
loadGroups();
loadPrompts();
loadApiConfigs();
loadActiveApiConfigId();

// Parse shared config from URL query params (must be after configs loaded)
if (parseSharedConfig()) {
  showToast('已应用共享配置，URL 已自动清理', 'success');
}

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

// File input change handler
$('fileInput').addEventListener('change', function(e) {
  if (this.files.length > 0) handleFileSelect(this.files);
  this.value = ''; // reset so same file can be selected again
});

// Paste image/file support
$('userInput').addEventListener('paste', function(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  const imageFiles = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  if (imageFiles.length > 0) {
    e.preventDefault();
    handleFileSelect(imageFiles);
  }
});

// Drag & drop support on input area
const inputArea = document.querySelector('.input-area');
let dragCounter = 0;

inputArea.addEventListener('dragover', e => {
  e.preventDefault();
  e.stopPropagation();
  inputArea.classList.add('drag-over');
});

inputArea.addEventListener('dragenter', e => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;
  inputArea.classList.add('drag-over');
});

inputArea.addEventListener('dragleave', e => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter--;
  if (dragCounter === 0) inputArea.classList.remove('drag-over');
});

inputArea.addEventListener('drop', e => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;
  inputArea.classList.remove('drag-over');
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) handleFileSelect(files);
});

// Auto-test connection if API URL is already saved
const savedApiUrl = $('apiUrl').value.trim();
if (savedApiUrl) {
  autoTestConnection();
} else {
  enableChat(false);
}
})();
