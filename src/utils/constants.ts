// Storage keys
export const CONFIG_KEY = 'ai_chat_config_params'
export const FORMAT_KEY = 'ai_chat_format_config'
export const CONV_KEY = 'ai_chat_conversations'
export const ACTIVE_KEY = 'ai_chat_active_conv'
export const PROMPTS_KEY = 'ai_chat_prompts'
export const GROUPS_KEY = 'ai_chat_groups'
export const HIDDEN_PROMPTS_KEY = 'ai_chat_hidden_prompts'
export const API_CONFIGS_KEY = 'ai_chat_api_configs'
export const ACTIVE_API_CONFIG_KEY = 'ai_chat_active_api_config'
export const SEARCH_CONFIG_KEY = 'ai_chat_search_config'
export const ACTIVE_PRESET_KEY = 'ai_chat_active_preset'
export const THEME_KEY = 'ai_chat_theme'
export const SIDEBAR_KEY = 'ai_chat_sidebar'
export const WELCOME_DONE_KEY = 'ai_chat_welcome_done'

// Limits
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10MB
export const MAX_IMAGE_DIMENSION = 2048
export const IMAGE_QUALITY = 0.8
export const COLLAPSE_LENGTH = 200
export const SAVE_INTERVAL = 3000

// Default config (global tool toggles only; preset params live in promptStore)
export const DEFAULT_CONFIG_PARAMS = {
  calculatorEnabled: true,
  timeEnabled: true,
  randomEnabled: true,
  uuidEnabled: true,
  fetchPageEnabled: true,
}

export const DEFAULT_FORMAT_CONFIG = {
  fontSize: 16,
  lineHeight: 1.85,
  msgGap: 16,
  paraGap: 6,
  indent: false,
}

export const DEFAULT_API_CONFIGS = [
  {
    id: 'default',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-v4-flash',
  },
]
