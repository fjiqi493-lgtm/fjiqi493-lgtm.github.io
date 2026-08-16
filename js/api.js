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

const API = {
  token: localStorage.getItem('admin_token') || '',
  site: null,

  setToken(t) {
    this.token = t || '';
    if (t) localStorage.setItem('admin_token', t);
    else localStorage.removeItem('admin_token');
  },

  // 访客读取站点数据（公开）
  async getSite() {
    const r = await fetch('./site.json', { cache: 'no-store' });
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
  async _ghGet(path) {
    const r = await fetch(
      'https://api.github.com/repos/' + GH.owner + '/' + GH.repo + '/contents/' + path + '?ref=' + GH.branch,
      { headers: { Authorization: 'Bearer ' + this.token, Accept: 'application/vnd.github+json' } }
    );
    if (!r.ok) throw new Error('读取仓库失败 (' + r.status + ')');
    return r.json();
  },

  async _ghPut(path, contentB64, sha, message) {
    const body = { message, content: contentB64 };
    if (sha) body.sha = sha;
    const r = await fetch(
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

  async saveSite() {
    const cur = await this._ghGet(GH.sitePath);
    const content = strToB64(JSON.stringify(API.site, null, 2));
    await this._ghPut(GH.sitePath, content, cur.sha, '更新站点内容');
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

  // 图片上传：压缩 -> base64 -> 提交到仓库 uploads/ -> 返回 raw 直链
  async upload(file) {
    const dataUrl = await compressImage(file, 500000);
    const b64 = dataUrl.split(',')[1];
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const name = 'uploads/u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    await this._ghPut(name, b64, undefined, '上传图片 ' + name);
    return 'https://raw.githubusercontent.com/' + GH.owner + '/' + GH.repo + '/' + GH.branch + '/' + name;
  },
};

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

/* ---------- 通用 UI 工具（灯箱 / 淡入 / 页脚）---------- */
const $ = (id) => document.getElementById(id);
function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function renderFooter(data) {
  setText('footer-brand', data.brand);
  setText('footer-desc', data.home ? data.home.bio : '');
  setText('footer-copy', '© ' + new Date().getFullYear() + ' ' + data.brand + '. 保留所有权利。');
  setText('footer-seo', data.seo || '');

  const socials = (data.contact && data.contact.socials) || [];
  const fs = $('footer-socials');
  if (fs) {
    fs.innerHTML = '';
    socials.forEach((s) => {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = s;
      fs.appendChild(a);
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
    all.textContent = '查看全部 →';
    fw.appendChild(all);
  }
  const fe = $('f-email');
  if (fe && data.contact) {
    fe.textContent = data.contact.email;
    fe.href = 'mailto:' + data.contact.email;
  }
  setText('f-note', data.contact ? data.contact.note : '');
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
      // 精确匹配：纯页面链接必须文件名一致；锚点链接还需 hash 一致
      const parts = n.href.split('#');
      const targetPath = (parts[0] || '').split('/').pop() || 'index.html';
      const targetHash = parts[1] || '';
      const isHashLink = targetHash.length > 0;
      if (targetPath === curPath && (!isHashLink || targetHash === curHash)) {
        a.classList.add('active');
      }
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
  bindNavToggle();

  // 锚点切换时同步更新导航 active 状态（首页内点「关于」「联系」时加粗跟随）
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace(/^#/, '');
    Array.from(navEl.querySelectorAll('a')).forEach((a) => {
      const parts = a.href.split('#');
      const th = parts[1] || '';
      if (th.length > 0) { a.classList.toggle('active', th === h); }
      else { a.classList.toggle('active', !h); }
    });
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
  list.forEach((w) => {
    const a = document.createElement('a');
    a.className = 'work-card reveal';
    a.href = 'work.html?id=' + w.id;
    a.innerHTML = `
      <div class="thumb"><img src="${w.cover || (w.images && w.images[0]) || ''}" alt="${w.title}" loading="lazy" /></div>
      <div class="meta">
        <span class="title">${w.title}</span>
        <span class="cat">${w.category || ''} · ${w.year || ''}</span>
      </div>
      <div class="summary">${w.summary || ''}</div>`;
    container.appendChild(a);
  });
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
}

function initLightbox() {
  const box = $('lightbox');
  const img = $('lightbox-img');
  const close = () => box.classList.remove('open');
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-zoom]');
    if (t) {
      img.src = t.getAttribute('data-zoom');
      box.classList.add('open');
    }
  });
  box.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}
