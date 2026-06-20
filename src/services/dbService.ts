const DB_NAME = 'ai_chat_box_db'
const DB_VERSION = 2
const STORE_NAME = 'kv'

let _db: IDBDatabase | null = null
let _dbReady = false
const _cache = new Map<string, string>()

async function _openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const d = (e.target as IDBOpenDBRequest).result
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: 'k' })
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

async function _getAllRecords(): Promise<Array<{ k: string; v: string }>> {
  if (!_db) return []
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

async function _putRecord(key: string, value: string): Promise<void> {
  if (!_db) return
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ k: key, v: value })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function _deleteRecord(key: string): Promise<void> {
  if (!_db) return
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function _clearAllRecords(): Promise<void> {
  if (!_db) return
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function initDB(): Promise<void> {
  if (_dbReady) return
  try {
    _db = await _openDB()
    const records = await _getAllRecords()
    for (const { k, v } of records) {
      _cache.set(k, v)
    }
    // Migrate from localStorage if cache is empty
    if (_cache.size === 0) {
      let hasChatData = false
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('ai_chat_')) {
          _cache.set(k, localStorage.getItem(k)!)
          hasChatData = true
        }
      }
      if (hasChatData) {
        const tx = _db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        for (const [k, v] of _cache) store.put({ k, v })
        await new Promise<void>((resolve) => { tx.oncomplete = () => resolve() })
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith('ai_chat_')) localStorage.removeItem(k)
        }
        console.log('[db] Migrated data from localStorage to IndexedDB')
      }
    }
    _dbReady = true
    console.log('[db] IndexedDB ready, cache size:', _cache.size)
  } catch (e) {
    console.warn('[db] IndexedDB init failed, using localStorage:', e)
    _dbReady = true
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (!_dbReady) await initDB()
  if (_cache.has(key)) return _cache.get(key) || null
  // Fallback to localStorage for keys that haven't been migrated
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  _cache.set(key, value)
  if (_db) {
    try {
      await _putRecord(key, value)
    } catch (e) {
      console.warn('[db] Failed to write to IndexedDB, falling back to localStorage:', e)
      localStorage.setItem(key, value)
    }
  } else {
    localStorage.setItem(key, value)
  }
}

export async function removeItem(key: string): Promise<void> {
  _cache.delete(key)
  if (_db) {
    try {
      await _deleteRecord(key)
    } catch {
      localStorage.removeItem(key)
    }
  } else {
    localStorage.removeItem(key)
  }
}

export async function clearAll(): Promise<void> {
  _cache.clear()
  if (_db) {
    try {
      await _clearAllRecords()
    } catch {
      // fallback
    }
  }
}
