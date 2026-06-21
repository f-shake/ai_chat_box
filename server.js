/**
 * server.js — AI Chat Box 联网搜索代理
 *
 * 零依赖 Node.js 服务，提供多搜索引擎搜索 + 网页抓取功能。
 * 引擎降级链：搜狗 → 必应 → 360 搜索
 *
 * 使用方法:
 *   node server.js
 *   curl http://localhost:3456/api/search?q=你好
 *   curl http://localhost:3456/api/fetch?url=https://example.com
 */

import http from 'node:http';
import { URL } from 'node:url';

const PORT = 3456;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const TIMEOUT_MS = 8000;

// ==================== 工具函数 ====================

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

function extractByRegex(html, pattern, limit) {
  const matches = [];
  let m;
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  while ((m = re.exec(html)) !== null && matches.length < (limit || 10)) {
    matches.push(m);
  }
  return matches;
}

function ensureAbsoluteUrl(href, base) {
  if (!href || href.startsWith('http://') || href.startsWith('https://')) return href || '';
  if (href.startsWith('//')) return 'https:' + href;
  try {
    return new URL(href, base).href;
  } catch { return href || ''; }
}

// ==================== 搜索引擎解析器 ====================

const ENGINES = {
  // ---- 搜狗搜索 ----
  sogou: {
    name: '搜狗搜索',
    buildUrl: (q) => `https://www.sogou.com/web?query=${encodeURIComponent(q)}`,
    parse: (html, baseUrl) => {
      const results = [];
      // 搜狗结果块：<div class="vrwrap"> ... </div>
      const blocks = html.match(/<div\s+class="[^"]*vr(?:wrap|5_wrap)[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
      for (const block of blocks) {
        const link = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        const sn = block.match(/<p\s+class="str_info"[^>]*>([\s\S]*?)<\/p>/i) ||
                  block.match(/<div\s+class="str_text"[^>]*>([\s\S]*?)<\/div>/i) ||
                  block.match(/<p\s+class="[^"]*str-[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        if (link) {
          const url = ensureAbsoluteUrl(link[1], baseUrl);
          const title = stripTags(link[2]);
          const snippet = sn ? stripTags(sn[1]) : '';
          if (title && url && !url.startsWith('#') && !url.includes('sogou.com')) {
            results.push({ title, url, snippet });
          }
        }
      }
      return results;
    }
  },

  // ---- 百度搜索 ----
  baidu: {
    name: '百度搜索',
    buildUrl: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
    parse: (html, baseUrl) => {
      const results = [];
      // 百度结果块：<div class="result">...</div> 或 <div class="c-container">...</div>
      let blocks = html.match(/<div\s+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || [];
      if (blocks.length === 0) {
        blocks = html.match(/<div\s+class="[^"]*c-container[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || [];
      }
      for (const block of blocks) {
        const link = block.match(/<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!link) continue;
        // 跳过百度自家链接
        const url = link[1];
        if (url.includes('baidu.com/link') || url.includes('baidu.com/s?')) continue;
        const title = stripTags(link[2]);
        const sn = block.match(/<span\s+class="[^"]*content-[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
                  block.match(/<div\s+class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                  block.match(/<span\s+class="[^"]*abstract[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const snippet = sn ? stripTags(sn[1]) : '';
        if (title && url) {
          results.push({ title, url, snippet });
        }
      }
      return results;
    }
  },

  // ---- 必应搜索 ----
  bing: {
    name: '必应搜索',
    buildUrl: (q) => `https://cn.bing.com/search?q=${encodeURIComponent(q)}`,
    parse: (html, baseUrl) => {
      const results = [];
      // 必应结果块：<li class="b_algo"> ... </li>
      const blocks = html.match(/<li\s+class="[^"]*\bb_algo\b[^"]*"[\s\S]*?<\/li>/gi) || [];
      for (const block of blocks) {
        const link = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        // 摘要可能在 <p> 或 <div class="b_caption">
        const sn = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        if (link) {
          const url = ensureAbsoluteUrl(link[1], baseUrl);
          const title = stripTags(link[2]);
          const snippet = sn ? stripTags(sn[1]) : '';
          if (title && url && !url.startsWith('#') && !url.includes('bing.com')) {
            results.push({ title, url, snippet });
          }
        }
      }
      return results;
    }
  },

  // ---- 360 搜索 ----
  so360: {
    name: '360搜索',
    buildUrl: (q) => `https://www.so.com/s?fr=360sou_newhome&src=home_www&q=${encodeURIComponent(q)}`,
    parse: (html, baseUrl) => {
      const results = [];
      // 360结果块：<li class="res-list">...</li> 或 <div class="res-item">...
      let blocks = html.match(/<li\s+class="[^"]*res-list[^"]*"[\s\S]*?<\/li>/gi) || [];
      if (blocks.length === 0) {
        blocks = html.match(/<div\s+class="[^"]*res-item[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || [];
      }
      if (blocks.length === 0) {
        // 备用：匹配常规结果
        blocks = html.match(/<div\s+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || [];
      }

      for (const block of blocks) {
        const link = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        const sn = block.match(/<p\s+class="[^"]*res-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                  block.match(/<div\s+class="[^"]*res-desc[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                  block.match(/<p\s+class="str_text"[^>]*>([\s\S]*?)<\/p>/i);
        if (link) {
          const url = ensureAbsoluteUrl(link[1], baseUrl);
          const title = stripTags(link[2]);
          const snippet = sn ? stripTags(sn[1]) : '';
          if (title && url && !url.startsWith('#') && !url.includes('so.com') && !url.includes('360.cn')) {
            results.push({ title, url, snippet });
          }
        }
      }
      return results;
    }
  }
};

// ==================== 搜索核心逻辑 ====================

async function searchEngine(name, query) {
  const engine = ENGINES[name];
  if (!engine) throw new Error(`未知搜索引擎: ${name}`);

  const url = engine.buildUrl(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const results = engine.parse(html, url);
    // 过滤掉明显不相关的结果
    return results.filter(r => r.title && r.url);
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function searchWithFallback(query, preferredEngine) {
  // 没有指定引擎 或 engine=all：并行搜索所有引擎，全量返回
  if (!preferredEngine || preferredEngine === 'all') {
    return searchAllEngines(query);
  }

  // 指定了特定引擎：只搜该引擎，不降级
  if (!ENGINES[preferredEngine]) {
    return { engine: null, results: [], errors: [{ engine: preferredEngine, error: '未知引擎' }] };
  }

  try {
    const results = await searchEngine(preferredEngine, query);
    return {
      engine: preferredEngine,
      results: results,
    };
  } catch (e) {
    return {
      engine: null,
      results: [],
      errors: [{ engine: preferredEngine, error: e.message || String(e) }],
    };
  }
}

/**
 * 并行搜索所有引擎，合并去重后返回
 * 使用 Promise.allSettled 确保一个引擎失败不影响其他引擎
 */
async function searchAllEngines(query) {
  const engineNames = Object.keys(ENGINES);

  const settled = await Promise.allSettled(
    engineNames.map(name =>
      searchEngine(name, query).then(results => ({
        engine: name,
        results: results,
      }))
    )
  );

  const merged = [];
  const seenUrls = new Set();
  const engines = [];
  const errors = [];
  const engineResults = {}; // 按引擎分组的结果

  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.results.length > 0) {
      const engineName = result.value.engine;
      engines.push(engineName);
      engineResults[engineName] = result.value.results;
      for (const item of result.value.results) {
        // 去掉 URL 的参数部分用于去重比较
        const key = item.url.replace(/[?#].*$/, '');
        if (!seenUrls.has(key)) {
          seenUrls.add(key);
          merged.push({
            title: item.title,
            url: item.url,
            snippet: item.snippet,
            source: engineName,
          });
        }
      }
    } else if (result.status === 'rejected') {
      errors.push({
        engine: result.reason?.engine || 'unknown',
        error: result.reason?.message || String(result.reason),
      });
    }
  }

  return {
    engine: 'combined',
    engines,                              // 成功返回结果的引擎列表
    engineResults,                        // 按引擎分组：{ sogou: [...], bing: [...] }
    results: merged.slice(0, 20),         // 合并去重结果（方便模型快速浏览）
    totalResults: merged.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ==================== 页面抓取 ====================

async function fetchPage(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,text/plain',
      },
      signal: controller.signal,
      redirect: 'follow',
      timeout: 15000,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const contentType = resp.headers.get('content-type') || '';
    let content;
    if (contentType.includes('text/html') || contentType.includes('text/plain') || contentType.includes('application/json') || contentType.includes('application/xml') || contentType.includes('text/markdown')) {
      content = await resp.text();
      // 剥离 HTML 标签
      content = content
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      content = `[无法解析的内容类型: ${contentType}]`;
    }
    return { content: content.slice(0, 10000) };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ==================== HTTP 服务 ====================

const server = http.createServer((req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let path, query;
  try {
    const parsed = new URL(req.url, `http://localhost:${PORT}`);
    path = parsed.pathname;
    query = parsed.searchParams;
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: '无效的请求 URL' }));
    return;
  }

  // ---- 路由 ----
  if (path === '/api/search') {
    const q = query.get('q');
    if (!q || !q.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少搜索关键词参数 q' }));
      return;
    }
    const engine = query.get('engine') || '';
    searchWithFallback(q.trim(), engine).then(data => {
      // 如果所有引擎都失败，返回错误但不要崩溃
      const allFailed = data.engine === 'combined'
        ? (!data.engines || data.engines.length === 0)
        : !data.engine;
      if (allFailed) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '所有搜索引擎均不可用', details: data.errors }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

  } else if (path === '/api/fetch') {
    const targetUrl = query.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少 url 参数' }));
      return;
    }
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'URL 必须以 http:// 或 https:// 开头' }));
      return;
    }
    fetchPage(targetUrl).then(data => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }).catch(err => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

  } else if (path === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      port: PORT,
      engines: Object.keys(ENGINES),
      defaultOrder: ['sogou', 'bing', 'so360'],
    }));

  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path }));
  }
});

server.listen(PORT, () => {
  console.log(`🔍 AI Chat Box 搜索代理已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   搜索引擎: ${Object.keys(ENGINES).join(', ')}`);
  console.log(`   降级策略: 依次尝试，自动跳过不可用的引擎`);
  console.log(`   超时设置: 每个引擎 ${TIMEOUT_MS / 1000}s`);
});
