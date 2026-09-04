/* ===================================================================
   静态站点数据层（GitHub Pages 方案）
   - 访客：fetch ./site.json（公开仓库，只读）
   - 管理员：用 GitHub Token 通过 Contents API 读写仓库里的 site.json / 图片
   注意：本站无后端服务器，所以「管理员密码」就是你的 GitHub Token。
   Token 只存在你浏览器的 localStorage，不会上传给任何人。
   =================================================================== */

const GH = {
  owner: 'fjiqi493-lgtm',
  repo: 'fjiqi493-lgtm.github.io',
  branch: 'main',
  sitePath: 'site.json',
};

// 把 raw.githubusercontent.com 的仓库内图片改写为同源 GitHub Pages 地址，
// 走 Pages(Fastly) CDN、复用同源连接、可被浏览器缓存；raw 域常被限流且跨域，是手机端图片加载慢的主因。
function imgUrl(u) {
  if (!u) return u;
  const m = String(u).match(/^https?:\/\/raw\.githubusercontent\.com\/[^\/]+\/[^\/]+\/(?:main|master)\/(.+)$/);
  return m ? location.origin + '/' + m[1] : u;
}

// 图片淡入：渲染后给所有 img 加 fz(透明)，加载完成再淡入，避免“残缺/白块”闪烁；
// 仅 JS 成功运行后才隐藏，JS 异常也不会导致图片永久不可见。
// 优化：淡入前先 decode()，确保位图解码完毕再开始过渡，避免「开始渐变时卡一帧」。
function fadeImages(scope) {
  (scope || document).querySelectorAll('img').forEach((im) => {
    if (im.classList.contains('fz')) return;
    if (im.closest('#lightbox')) return; // 灯箱大图由灯箱自己控制淡入，避免两套逻辑打架
    im.classList.add('fz');
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      const show = () => im.classList.add('loaded');
      // decode() 让浏览器提前完成解码，淡入动画才不会掉帧；不支持时直接显示
      if (typeof im.decode === 'function') im.decode().then(show, show);
      else show();
    };
    if (im.complete && im.naturalWidth > 0) done();
    else {
      im.addEventListener('load', done, { once: true });
      im.addEventListener('error', done, { once: true });
    }
  });
}

/* ---------- 图片预载（让图片请求尽量提前，缩短瀑布流）---------- */
// 记忆上次访问用过的关键图片地址，下次打开页面时在 <head> 阶段就 preload，
// 与 site.json 并行下载；重复访问时图片已在缓存，首图几乎零延迟。
const IMG_PRELOAD_KEY = 'site_img_preload_v1';

function pageKey() {
  return (location.pathname.split('/').pop() || 'index.html').split('#')[0];
}
function rememberImages(urls) {
  try {
    const list = (urls || []).filter(Boolean).slice(0, 4);
    if (!list.length) return;
    const store = JSON.parse(localStorage.getItem(IMG_PRELOAD_KEY) || '{}');
    store[pageKey()] = list;
    localStorage.setItem(IMG_PRELOAD_KEY, JSON.stringify(store));
  } catch (e) {}
}
function preloadRememberedImages() {
  try {
    const store = JSON.parse(localStorage.getItem(IMG_PRELOAD_KEY) || '{}');
    const list = store[pageKey()];
    if (!Array.isArray(list) || !list.length) return;
    list.slice(0, 4).forEach((u, i) => {
      if (typeof u !== 'string' || !u) return;
      const l = document.createElement('link');
      l.rel = 'preload';
      l.as = 'image';
      l.href = u;
      l.fetchPriority = i === 0 ? 'high' : 'low'; // 首图优先，其余不抢占带宽
      document.head.appendChild(l);
    });
  } catch (e) {}
}
// 页面脚本一加载就立刻预载（此时 HTML 刚解析完 <head>，能抢出一个 RTT）
preloadRememberedImages();

const API = {
  token: localStorage.getItem('admin_token') || '',
  site: null,

  setToken(t) {
    this.token = t || '';
    if (t) localStorage.setItem('admin_token', t);
    else localStorage.removeItem('admin_token');
  },

  // 访客读取站点数据（公开）：加时间戳穿透 GitHub Pages / 浏览器缓存
  // 优化：HTML <head> 的内联脚本在解析阶段就发起了同一个请求（window.__sitePromise），
  // 与 css/js 并行下载，省掉「等 JS 下载完才开始请求数据」的一整轮 RTT；
  // 这里直接复用该 Promise，请求参数与之前完全一致，不改变任何缓存/新鲜度行为。
  async getSite() {
    if (window.__sitePromise) {
      const p = window.__sitePromise;
      window.__sitePromise = null; // 只消费一次
      try {
        const d = await p;
        if (d && typeof d === 'object' && !d.__failed) return d;
      } catch (e) { /* 失败则走下面的兜底请求 */ }
    }
    const r = await fetch('./site.json?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('加载站点数据失败 (' + r.status + ')');
    return r.json();
  },

  // 登录 = 校验 GitHub Token 是否有权读写本仓库
  async login(token) {
    const ok = await this._checkToken(token);
    if (!ok) throw new Error('Token 无效或无本仓库写权限');
    this.setToken(token);
    return { token };
  },

  async _checkToken(token) {
    try {
      const r = await fetch('https://api.github.com/repos/' + GH.owner + '/' + GH.repo, {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
      });
      return r.ok;
    } catch (e) {
      return false;
    }
  },

  logout() { this.setToken(''); },

  /* ---------- GitHub Contents 读写 ---------- */
  async _fetchWithRetry(url, options, retries = 2) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await fetch(url, options);
        return r;
      } catch (e) {
        lastErr = e;
        const isNetwork = String(e.message || '').toLowerCase().includes('failed to fetch') ||
                          String(e.name || '').includes('TypeError') ||
                          String(e.message || '').toLowerCase().includes('networkerror');
        if (!isNetwork || i === retries) throw e;
        await new Promise((res) => setTimeout(res, 300 * (i + 1)));
      }
    }
    throw lastErr;
  },

  async _ghGet(path) {
    // 用 URL 时间戳穿透浏览器/中间层缓存；注意 GitHub CORS 白名单不含 Cache-Control 请求头，
    // 若加 Cache-Control 会触发浏览器 CORS 预检失败 → TypeError: Failed to fetch
    const r = await this._fetchWithRetry(
      'https://api.github.com/repos/' + GH.owner + '/' + GH.repo + '/contents/' + path + '?ref=' + GH.branch + '&_t=' + Date.now(),
      {
        headers: {
          Authorization: 'Bearer ' + this.token,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    if (!r.ok) throw new Error('读取仓库失败 (' + r.status + ')');
    return r.json();
  },

  async _ghPut(path, contentB64, sha, message) {
    const body = { message, content: contentB64 };
    if (sha) body.sha = sha;
    const r = await this._fetchWithRetry(
      'https://api.github.com/repos/' + GH.owner + '/' + GH.repo + '/contents/' + path,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + this.token,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify(body),
      }
    );
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error((e.message || '提交失败') + ' (' + r.status + ')');
    }
    return r.json();
  },

  async saveSite(retryCount = 0) {
    const cur = await this._ghGet(GH.sitePath);
    const content = strToB64(JSON.stringify(API.site, null, 2));
    try {
      await this._ghPut(GH.sitePath, content, cur.sha, '更新站点内容');
    } catch (e) {
      // 409：SHA 不匹配（缓存/并发导致），重试最多 3 次
      if (String(e.message).includes('409') && retryCount < 3) {
        await new Promise((res) => setTimeout(res, 500));
        return this.saveSite(retryCount + 1);
      }
      throw e;
    }
  },

  async createWork(w) {
    w.id = w.id || 'w' + Date.now();
    API.site.works = API.site.works || [];
    API.site.works.push(w);
    await this.saveSite();
    return w;
  },

  async updateWork(id, w) {
    const i = (API.site.works || []).findIndex((x) => x.id === id);
    if (i >= 0) API.site.works[i] = Object.assign({}, API.site.works[i], w);
    await this.saveSite();
    return w;
  },

  async deleteWork(id) {
    API.site.works = (API.site.works || []).filter((x) => x.id !== id);
    await this.saveSite();
    return { ok: true };
  },

  // 图片上传：压缩 -> base64 -> 提交到仓库 uploads/ -> 等待 URL 可达后返回 raw 直链
  async upload(file) {
    const dataUrl = await compressImage(file, 500000);
    const b64 = dataUrl.split(',')[1];
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const name = 'uploads/u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    await this._ghPut(name, b64, undefined, '上传图片 ' + name);
    const url = 'https://raw.githubusercontent.com/' + GH.owner + '/' + GH.repo + '/' + GH.branch + '/' + name;
    // GitHub raw 地址提交后可能有几秒延迟才可用，轮询最多 10 秒，避免前台裂图
    await waitForUrl(url, 10000, 500);
    return url;
  },
};

/* ---------- 多语言（中英切换）---------- */
let SiteLang = (localStorage.getItem('siteLang') === 'en') ? 'en' : 'zh';
document.documentElement.lang = (SiteLang === 'en') ? 'en' : 'zh-CN';

/* ---------- 明暗主题 ---------- */
let SiteTheme = 'light';
try {
  SiteTheme = localStorage.getItem('siteTheme') || 'light';
  if (SiteTheme !== 'dark' && SiteTheme !== 'light') SiteTheme = 'light';
} catch (e) {}
if (SiteTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

// 硬编码 UI 字符串（不在 site.json 内的中文）
const UI = {
  zh: { viewWorks: '查看作品', contact: '合作联系', viewAll: '查看全部 →', admin: '管理', openMenu: '打开菜单', rights: '保留所有权利。', count: ' 件作品', notFound: '作品不存在', ovCat: '类别', ovYear: '年份', back: '← 返回作品列表' },
  en: { viewWorks: 'View Works', contact: 'Contact', viewAll: 'View All →', admin: 'Admin', openMenu: 'Open menu', rights: 'All rights reserved.', count: ' works', notFound: 'Work not found', ovCat: 'Category', ovYear: 'Year', back: '← Back to Works' }
};
function UIT(k) { return (UI[SiteLang] && UI[SiteLang][k] != null) ? UI[SiteLang][k] : UI.zh[k]; }

// 判断是否为「带 id 的对象」（用于按 id 合并的对象数组，如 works）
function _isItemWithId(x) {
  return x && typeof x === 'object' && !Array.isArray(x) && x.id != null;
}

// 将英文镜像整树合并到中文数据上，得到当前语言版本的数据（不修改原数据，后台只改中文源）
function deepMerge(src, ov) {
  if (Array.isArray(ov)) {
    // 含 id 的对象数组（如 works）：以中文源为基准，按 id 合并，英文镜像只覆盖同名作品的翻译字段。
    // 中文新增的作品（en 镜像尚未收录）自动出现在英文模式，待翻译前显示中文原文，图片/参数等内容始终保留。
    if (Array.isArray(src) && src.length && ov.length &&
        _isItemWithId(src[0]) && _isItemWithId(ov[0])) {
      const ovById = {};
      ov.forEach((it) => { if (it && it.id != null) ovById[it.id] = it; });
      // 作品：以中文源为基准。仅标题/类别/简介/描述可被英文镜像覆盖（文字翻译）；
      // 图片/封面/年份/参数等内容字段始终取自中文，确保「翻译文字」与「作品内容」彻底解耦——
      // 后台新增或编辑任意作品都会立即中英同步，未翻译的作品在英文模式显示中文原文。
      const TXT = ['title', 'category', 'summary', 'description'];
      return src.map((it) => {
        const m = it && it.id != null ? ovById[it.id] : null;
        if (!m) return it;
        const out = Object.assign({}, it);
        TXT.forEach((k) => { if (m[k] != null && m[k] !== '') out[k] = m[k]; });
        return out;
      });
    }
    return ov; // 普通数组（字符串列表等）整体替换
  }
  if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
    const out = {};
    const keys = new Set([...(src ? Object.keys(src) : []), ...Object.keys(ov)]);
    keys.forEach((k) => {
      const sv = src ? src[k] : undefined;
      const ovv = ov[k];
      if (ovv === undefined) out[k] = sv;
      else out[k] = deepMerge(sv, ovv); // 统一交给 deepMerge：对象递归合并、数组按 id 合并、普通数组替换、标量覆盖
    });
    return out;
  }
  return ov === undefined ? src : ov;
}
function localized(data) {
  return (SiteLang === 'en' && data && data.en) ? deepMerge(data, data.en) : data;
}

// 整页淡入淡出，保证中英切换流畅
function withLangFade(fn) {
  const els = [document.querySelector('main'), document.querySelector('.site-footer')].filter(Boolean);
  els.forEach((e) => e.classList.add('lang-fade'));
  setTimeout(() => {
    fn();
    requestAnimationFrame(() => els.forEach((e) => e.classList.remove('lang-fade')));
  }, 140);
}

function updateLangToggleUI() {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  btn.querySelectorAll('[data-lang]').forEach((s) => s.classList.toggle('on', s.getAttribute('data-lang') === SiteLang));
  btn.setAttribute('aria-label', SiteLang === 'en' ? '切换到中文' : 'Switch to English');
}
function applyLang(lang) {
  SiteLang = lang === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('siteLang', SiteLang); } catch (e) {}
  document.documentElement.lang = SiteLang === 'en' ? 'en' : 'zh-CN';
  updateLangToggleUI();
  window.dispatchEvent(new Event('lang:change'));
}
function initLangToggle() {
  const btn = document.getElementById('lang-toggle');
  if (!btn || btn.dataset.langBound) return;
  btn.dataset.langBound = '1';
  updateLangToggleUI();
  btn.addEventListener('click', () => applyLang(SiteLang === 'en' ? 'zh' : 'en'));
}

function updateThemeToggleUI() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.setAttribute('aria-label', SiteTheme === 'dark' ? '切换到浅色' : '切换到深色');
}
function applyTheme(theme) {
  SiteTheme = theme === 'dark' ? 'dark' : 'light';
  try { localStorage.setItem('siteTheme', SiteTheme); } catch (e) {}
  document.documentElement.setAttribute('data-theme', SiteTheme);
  updateThemeToggleUI();
}
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn || btn.dataset.themeBound) return;
  btn.dataset.themeBound = '1';
  updateThemeToggleUI();
  btn.addEventListener('click', () => applyTheme(SiteTheme === 'dark' ? 'light' : 'dark'));
}
initThemeToggle();

/* ---------- 工具 ---------- */
function b64ToStr(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
function strToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// 客户端压缩：最长边 1600px，JPEG，目标 < maxBytes（避免超过 GitHub API 单文件上限）
function compressImage(file, maxBytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let q = 0.85;
        let out = canvas.toDataURL('image/jpeg', q);
        while (out.length * 0.75 > maxBytes && q > 0.5) {
          q -= 0.07;
          out = canvas.toDataURL('image/jpeg', q);
        }
        resolve(out);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 轮询等待图片 URL 可访问（GitHub raw 提交后有几秒延迟）
function waitForUrl(url, maxMs, intervalMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryFetch = () => {
      fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
        .then((r) => { if (r.ok || r.status === 0) resolve(); })
        .catch(() => {});
      if (Date.now() - start < maxMs) setTimeout(tryFetch, intervalMs);
      else resolve(); // 超时也不阻塞，让前台自己重试
    };
    tryFetch();
  });
}

/* ---------- 通用 UI 工具（灯箱 / 淡入 / 页脚）---------- */
const $ = (id) => document.getElementById(id);
function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function renderFooter(data) {
  setText('footer-brand', data.brand);
  setText('footer-desc', data.home ? data.home.bio : '');
  setText('footer-copy', '© ' + new Date().getFullYear() + ' ' + data.brand + '. ' + UIT('rights'));
  setText('footer-seo', data.seo || '');

  const socials = (data.contact && data.contact.socials) || [];
  const fs = $('footer-socials');
  if (fs) {
    fs.innerHTML = '';
    socials.forEach((s) => {
      const item = typeof s === 'string' ? { name: s, url: '' } : s;
      const el = document.createElement(item.url ? 'a' : 'span');
      if (item.url) {
        el.href = item.url;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
      el.textContent = item.name || '';
      el.className = 'social-link' + (item.url ? '' : ' is-text');
      fs.appendChild(el);
    });
  }
  const fw = $('footer-works');
  if (fw) {
    fw.innerHTML = '';
    (data.works || []).slice(0, 5).forEach((w) => {
      const a = document.createElement('a');
      a.href = 'work.html?id=' + w.id;
      a.textContent = w.title;
      fw.appendChild(a);
    });
    const all = document.createElement('a');
    all.href = 'works.html';
    all.textContent = UIT('viewAll');
    fw.appendChild(all);
  }
  // footer 联系栏目已移除：邮箱已显示在顶部 #contact，避免重复
  setText('brand', data.brand);
}

/* 渲染全站「文字类」内容：顶部/页脚导航、区块标题、页脚栏目名（均来自 site.json） */
function renderChrome(data) {
  const nav = data.nav || [];
  // 当前页面文件名（不含 hash）+ 当前 hash
  const curPath = (location.pathname.split('/').pop() || 'index.html').split('#')[0];
  const curHash = (location.hash || '').replace(/^#/, '');

  const navEl = $('nav');
  if (navEl) {
    navEl.innerHTML = '';
    nav.forEach((n) => {
      const a = document.createElement('a');
      a.href = n.href;
      a.textContent = n.label;
      navEl.appendChild(a);
    });
  }

  const fnl = $('footer-nav-links');
  if (fnl) {
    fnl.innerHTML = '';
    nav.forEach((n) => {
      const a = document.createElement('a');
      a.href = n.href;
      a.textContent = n.label;
      fnl.appendChild(a);
    });
  }

  const sec = data.sections || {};
  setText('s-works-en', (sec.works && sec.works.en) || '');
  setText('s-works-title', (sec.works && sec.works.title) || '');
  setText('s-about-en', (sec.about && sec.about.en) || '');
  setText('s-about-title', (sec.about && sec.about.title) || '');
  setText('s-contact-en', (sec.contact && sec.contact.en) || '');
  setText('s-contact-title', (sec.contact && sec.contact.title) || '');
  setText('s-all-en', (sec.allWorks && sec.allWorks.en) || '');
  setText('s-all-title', (sec.allWorks && sec.allWorks.title) || '');

  const ft = data.footer || {};
  setText('f-col-nav', ft.colNav || '');
  setText('f-col-works', ft.colWorks || '');
  setText('f-col-contact', ft.colContact || '');
  // 同步静态页眉文案（中英文切换）
  setText('cta-works', UIT('viewWorks'));
  setText('cta-contact', UIT('contact'));
  setText('cta-viewall', UIT('viewAll'));
  setText('admin-link', UIT('admin'));
  const nt = document.querySelector('.nav-toggle');
  if (nt) nt.setAttribute('aria-label', UIT('openMenu'));

  bindNavToggle();
  initLangToggle();

  // 统一更新导航高亮：根据当前 URL 计算并只点亮唯一匹配项
  setNavActive();
  bindNavActiveEvents();
}

/* 根据当前 URL 计算应高亮的导航 key */
function currentNavKey() {
  const curPath = (location.pathname.split('/').pop() || 'index.html').split('#')[0];
  const curHash = (location.hash || '').replace(/^#/, '');
  if (curHash === 'about' || curHash === 'contact') return curHash;
  if (curPath === 'works.html' || curPath === 'work.html') return 'works';
  return 'index';
}

/* 统一更新导航高亮：先清除全部，再点亮唯一匹配项（从根本上杜绝多个加粗并存） */
function setNavActive() {
  const navEl = $('nav');
  if (!navEl) return;
  const key = currentNavKey();
  navEl.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const hash = href.split('#')[1] || '';
    const base = (href.split('#')[0] || '').split('/').pop() || 'index.html';
    let match = false;
    if (key === 'about' || key === 'contact') match = hash === key;
    else if (key === 'works') match = base === 'works.html';
    else match = base === 'index.html' && hash === '';
    a.classList.toggle('active', match);
  });
}

/* 监听 hashchange 与导航点击，实时更新高亮（只注册一次） */
function bindNavActiveEvents() {
  if (window.__navActiveBound) return;
  window.__navActiveBound = true;
  window.addEventListener('hashchange', setNavActive);
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('#nav a');
    if (a) setTimeout(setNavActive, 0); // 同页锚点跳转后等 hash 落定再计算
  });
}

function bindNavToggle() {
  const nav = $('nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle || nav.dataset.toggleBound) return;
  const close = () => {
    nav.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = nav.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) close();
  });
  nav.dataset.toggleBound = '1';
}

function renderWorksGrid(works, container, limit) {
  container.innerHTML = '';
  const list = limit ? works.slice(0, limit) : works;
  const urls = [];
  list.forEach((w, i) => {
    const a = document.createElement('a');
    a.className = 'work-card reveal';
    a.href = 'work.html?id=' + w.id;
    const src = imgUrl(w.cover || (w.images && w.images[0])) || '';
    if (src) urls.push(src);
    // 首屏前 3 张立即加载（lazy 会让首屏图被推迟到布局计算后才开始请求）；
    // 其余仍 lazy，避免一次性拉取全部图片。
    const loadAttr = i < 3 ? 'loading="eager" fetchpriority="auto"' : 'loading="lazy"';
    a.innerHTML = `
      <div class="thumb"><img src="${src}" alt="${w.title}" ${loadAttr} decoding="async" /></div>
      <div class="meta">
        <span class="title">${w.title}</span>
        <span class="cat">${w.category || ''} · ${w.year || ''}</span>
      </div>
      <div class="summary">${w.summary || ''}</div>`;
    container.appendChild(a);
  });
  fadeImages(container);
  rememberImages(urls);
}

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((e) => io.observe(e));
  // 兜底：若 1.5s 后仍有未显示的元素（JS 异常/观察器未触发），强制显示，避免内容永久不可见
  setTimeout(() => {
    document.querySelectorAll('.reveal:not(.in)').forEach((e) => e.classList.add('in'));
  }, 1500);
}

function initLightbox() {
  if (window.__lightboxBound) return;   // 重新渲染时不重复绑定全局监听
  window.__lightboxBound = true;
  const box = $('lightbox');
  const img = $('lightbox-img');

  // 图片就位后再淡入，避免「黑屏 → 突然弹出」的割裂感；未就绪时显示极简加载指示。
  const markReady = () => {
    img.classList.add('lb-ready');
    box.classList.remove('is-loading');
  };
  const markLoading = () => {
    img.classList.remove('lb-ready');
    box.classList.add('is-loading');
  };
  img.addEventListener('load', markReady);
  img.addEventListener('error', () => box.classList.remove('is-loading'));

  const close = () => {
    box.classList.remove('open');
    box.classList.remove('is-loading');
  };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-zoom]');
    if (!t) return;
    const full = t.getAttribute('data-zoom');
    if (!full) return;
    // 详情页的展示图与放大图是同一个地址：已在缓存里时 complete 立即为真，
    // 可以做到「点开即见」；尚未下完时先出加载指示，下完再淡入，全程不黑屏。
    if (img.getAttribute('src') === full && img.complete && img.naturalWidth > 0) {
      img.classList.add('lb-ready');
      box.classList.remove('is-loading');
    } else {
      markLoading();
      img.src = full;
      if (img.complete && img.naturalWidth > 0) markReady();
    }
    box.classList.add('open');
  });

  box.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // 鼠标悬停/手指按下时提前拉取大图（地址与展示图一致，不产生额外流量），
  // 点击时基本已就位，点开即清晰。
  const warm = (e) => {
    const t = e.target && e.target.closest && e.target.closest('[data-zoom]');
    if (!t || t.dataset.warmed) return;
    t.dataset.warmed = '1';
    const im = new Image();
    im.decoding = 'async';
    im.src = t.getAttribute('data-zoom');
  };
  document.addEventListener('mouseover', warm, { passive: true });
  document.addEventListener('touchstart', warm, { passive: true });
}
