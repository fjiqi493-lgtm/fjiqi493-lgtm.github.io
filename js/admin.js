/* 后台管理逻辑（GitHub Pages 方案：写操作通过 GitHub Token 提交到仓库） */
let site = null;
let editingId = null;
let editImages = [];
let editCover = '';

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showShell() { $('login-wrap').style.display = 'none'; $('shell').classList.add('show'); }
function showLogin() { $('shell').classList.remove('show'); $('login-wrap').style.display = 'flex'; }

$('login-btn').addEventListener('click', doLogin);
$('pwd').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  $('login-err').textContent = '';
  try {
    await API.login($('pwd').value.trim());
    showShell();
    await loadData();
    switchTab('dashboard');
  } catch (err) {
    $('login-err').textContent = err.message;
  }
}

$('logout-btn').addEventListener('click', async () => {
  API.logout();
  showLogin();
});

// 任何受保护请求返回 401 都退回登录
async function authFetch(fn) {
  try {
    return await fn();
  } catch (e) {
    if (String(e.message).includes('401') || String(e.message).includes('无效')) {
      API.setToken('');
      showLogin();
    }
    throw e;
  }
}

async function loadData() {
  site = await API.getSite();
  API.site = site; // 供 API 写回仓库
}

/* ---------- 标签切换 ---------- */
document.querySelectorAll('.admin-sidebar a').forEach((a) => {
  a.addEventListener('click', () => switchTab(a.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll('.admin-sidebar a').forEach((a) =>
    a.classList.toggle('active', a.dataset.tab === tab)
  );
  if (tab === 'dashboard') renderDashboard();
  else if (tab === 'works') renderWorks();
  else if (tab === 'home') renderHomeForm();
  else if (tab === 'about') renderAboutForm();
  else if (tab === 'contact') renderContactForm();
  else if (tab === 'philosophy') renderPhilosophyForm();
  else if (tab === 'texts') renderTextsForm();
}

/* ---------- 仪表盘 ---------- */
function renderDashboard() {
  const works = site.works || [];
  $('main').innerHTML = `
    <h2>仪表盘</h2>
    <p class="admin-tip">所有修改保存后提交到 GitHub 仓库，约 10–60 秒自动同步到前台；任何设备打开链接都能看到最新内容。</p>
    <div class="stats">
      <div class="stat"><div class="n">${works.length}</div><div class="l">作品数量</div></div>
      <div class="stat"><div class="n">${(site.contact && site.contact.email) || '—'}</div><div class="l">联系邮箱</div></div>
      <div class="stat"><div class="n">${site.brand}</div><div class="l">站点品牌</div></div>
    </div>
    <button class="btn btn-primary" id="go-works">管理作品 →</button>`;
  $('go-works').addEventListener('click', () => switchTab('works'));
}

/* ---------- 作品管理 ---------- */
function renderWorks() {
  const works = site.works || [];
  let rows = works
    .map(
      (w) => `
      <div class="row">
        <div class="thumb"><img src="${w.cover || (w.images && w.images[0]) || ''}" alt=""></div>
        <span class="rt">${w.title}</span>
        <span class="rm">${w.category || ''} · ${w.year || ''}</span>
        <div class="acts">
          <button class="mini-btn" data-edit="${w.id}">编辑</button>
          <button class="mini-btn danger" data-del="${w.id}">删除</button>
        </div>
      </div>`
    )
    .join('');
  $('main').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>作品管理</h2>
      <button class="btn btn-primary" id="new-work">+ 新建作品</button>
    </div>
    <p class="admin-tip">点「编辑」可替换标题、简介与图片；点「删除」移除作品。</p>
    <div class="list-rows">${rows || '<p style="color:var(--muted)">还没有作品，点右上角新建。</p>'}</div>`;

  $('new-work').addEventListener('click', () => openModal(null));
  $('main').querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openModal(b.dataset.edit))
  );
  $('main').querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('确定删除该作品？')) return;
      try {
        await authFetch(() => API.deleteWork(b.dataset.del));
        await loadData();
        renderWorks();
      } catch (e) { alert(e.message); }
    })
  );
}

/* ---------- 作品编辑弹窗 ---------- */
function openModal(id) {
  editingId = id;
  const w = id ? (site.works || []).find((x) => x.id === id) : null;
  editImages = w ? (w.images || []).slice() : [];
  editCover = w ? (w.cover || (w.images && w.images[0]) || '') : '';

  $('modal-title').textContent = id ? '编辑作品' : '新建作品';
  $('f-title').value = w ? w.title : '';
  $('f-category').value = w ? w.category : '';
  $('f-year').value = w ? w.year : '';
  $('f-summary').value = w ? w.summary : '';
  $('f-description').value = w ? w.description : '';
  renderThumbs();
  renderParams(w ? w.params || [] : []);
  $('modal').classList.add('open');
}

function closeModal() { $('modal').classList.remove('open'); }

function renderThumbs() {
  const box = $('thumbs');
  box.innerHTML = '';
  editImages.forEach((url, i) => {
    const t = document.createElement('div');
    t.className = 't' + (url === editCover ? ' cover' : '');
    t.innerHTML = `<img src="${url}" alt=""><button class="x" data-i="${i}">×</button>` +
      (url === editCover ? '<span class="badge">封面</span>' : '');
    t.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) {
        editImages.splice(i, 1);
        if (editCover === url) editCover = editImages[0] || '';
      } else {
        editCover = url;
      }
      renderThumbs();
    });
    box.appendChild(t);
  });
}

function renderParams(list) {
  const box = $('params-edit');
  box.innerHTML = '';
  list.forEach((p) => addParamRow(p.k, p.v));
  if (list.length === 0) addParamRow('', '');
}

function addParamRow(k, v) {
  const row = document.createElement('div');
  row.className = 'prow';
  row.innerHTML = `<input placeholder="参数名" value="${k || ''}"><input placeholder="参数值" value="${v || ''}"><button class="mini-btn" type="button">×</button>`;
  row.querySelector('button').addEventListener('click', () => row.remove());
  $('params-edit').appendChild(row);
}

function collectParams() {
  return Array.from($('params-edit').querySelectorAll('.prow'))
    .map((r) => ({ k: r.children[0].value.trim(), v: r.children[1].value.trim() }))
    .filter((p) => p.k && p.v);
}

/* 图片上传（拖拽 / 点击） */
const dz = $('dropzone');
const fileInput = $('file-input');
dz.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => uploadFiles(fileInput.files));
['dragenter', 'dragover'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); })
);
['dragleave', 'drop'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); })
);
dz.addEventListener('drop', (e) => uploadFiles(e.dataTransfer.files));

async function uploadFiles(files) {
  const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) return;
  dz.textContent = '正在上传到 GitHub，请稍候…';
  dz.style.pointerEvents = 'none';
  dz.style.opacity = '0.6';
  for (const f of imgs) {
    try {
      const url = await authFetch(() => API.upload(f));
      editImages.push(url);
      if (!editCover) editCover = url;
      renderThumbs();
    } catch (e) { alert('上传失败：' + e.message); }
  }
  dz.textContent = '把图片拖到这里，或点击选择';
  dz.style.pointerEvents = '';
  dz.style.opacity = '';
  fileInput.value = '';
}

$('add-param').addEventListener('click', () => addParamRow('', ''));
$('modal-cancel').addEventListener('click', closeModal);
$('modal-save').addEventListener('click', async () => {
  const payload = {
    title: $('f-title').value.trim() || '未命名作品',
    category: $('f-category').value.trim(),
    year: $('f-year').value.trim(),
    summary: $('f-summary').value.trim(),
    description: $('f-description').value,
    images: editImages,
    cover: editCover,
    params: collectParams(),
  };
  try {
    if (editingId) await authFetch(() => API.updateWork(editingId, payload));
    else await authFetch(() => API.createWork(payload));
    closeModal();
    await loadData();
    renderWorks();
    switchTab('works');
  } catch (e) { alert(e.message); }
});

/* ---------- 首页内容 ---------- */
function renderHomeForm() {
  const h = site.home || {};
  $('main').innerHTML = `
    <h2>首页内容</h2>
    <p class="admin-tip">编辑品牌名、头像与首页个人介绍。</p>
    <div class="field"><label>品牌名</label><input id="h-brand" value="${site.brand || ''}"></div>
    <div class="field"><label>头像（拖拽/点击上传，留空显示名字首字）</label>
      <div class="dropzone" id="h-avatar-dz">点击或拖拽上传头像</div>
      <input type="file" id="h-avatar-input" accept="image/*" hidden>
      <div class="thumbs" id="h-avatar-thumb"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>英文标签</label><input id="h-kicker" value="${h.kicker || ''}"></div>
      <div class="field"><label>姓名</label><input id="h-name" value="${h.name || ''}"></div>
    </div>
    <div class="field"><label>职位标题</label><input id="h-title" value="${h.title || ''}"></div>
    <div class="field"><label>自我介绍</label><textarea id="h-bio" rows="4">${h.bio || ''}</textarea></div>
    <div class="field"><label>首页右侧代表作大图（拖拽/点击上传，留空自动取第一件作品封面）</label>
      <div class="dropzone" id="h-hero-dz">点击或拖拽上传大图</div>
      <input type="file" id="h-hero-input" accept="image/*" hidden>
      <div class="thumbs" id="h-hero-thumb"></div>
    </div>
    <button class="btn btn-primary" id="h-save">保存</button>`;

  let avatarUrl = site.avatar || '';
  let heroUrl = (site.home && site.home.heroImage) || '';
  const renderAvatar = () => {
    const box = $('h-avatar-thumb');
    box.innerHTML = avatarUrl ? `<div class="t cover"><img src="${avatarUrl}"><button class="x">×</button></div>` : '';
    box.querySelector('.x') && box.querySelector('.x').addEventListener('click', () => { avatarUrl = ''; renderAvatar(); });
  };
  renderAvatar();

  const renderHero = () => {
    const box = $('h-hero-thumb');
    box.innerHTML = heroUrl ? `<div class="t cover"><img src="${heroUrl}"><button class="x">×</button></div>` : '';
    box.querySelector('.x') && box.querySelector('.x').addEventListener('click', () => { heroUrl = ''; renderHero(); });
  };
  renderHero();

  const dzH = $('h-hero-dz');
  const fiH = $('h-hero-input');
  dzH.addEventListener('click', () => fiH.click());
  fiH.addEventListener('change', async () => {
    if (fiH.files[0]) {
      try { heroUrl = await authFetch(() => API.upload(fiH.files[0])); renderHero(); }
      catch (e) { alert(e.message); }
    }
  });
  ['dragover'].forEach((ev) => dzH.addEventListener(ev, (e) => e.preventDefault()));
  dzH.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      try { heroUrl = await authFetch(() => API.upload(e.dataTransfer.files[0])); renderHero(); }
      catch (err) { alert(err.message); }
    }
  });

  const dzA = $('h-avatar-dz');
  const fiA = $('h-avatar-input');
  dzA.addEventListener('click', () => fiA.click());
  fiA.addEventListener('change', async () => {
    if (fiA.files[0]) {
      try { avatarUrl = await authFetch(() => API.upload(fiA.files[0])); renderAvatar(); }
      catch (e) { alert(e.message); }
    }
  });
  ['dragover'].forEach((ev) => dzA.addEventListener(ev, (e) => e.preventDefault()));
  dzA.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      try { avatarUrl = await authFetch(() => API.upload(e.dataTransfer.files[0])); renderAvatar(); }
      catch (err) { alert(err.message); }
    }
  });

  $('h-save').addEventListener('click', async () => {
    const patch = {
      brand: $('h-brand').value.trim(),
      avatar: avatarUrl,
      home: {
        kicker: $('h-kicker').value.trim(),
        name: $('h-name').value.trim(),
        title: $('h-title').value.trim(),
        bio: $('h-bio').value,
        heroImage: heroUrl,
      },
    };
    try {
      await authFetch(() => API.saveSitePatch(patch));
      await loadData();
      alert('已保存并提交到 GitHub。由于 GitHub Pages 部署需要约 10–60 秒，请稍后刷新前台查看。');
    } catch (e) { alert(e.message); }
  });
}

// 通用：局部更新站点字段后整体保存
API.saveSitePatch = async function (patch) {
  Object.assign(API.site, patch);
  await API.saveSite();
};

/* ---------- 关于 ---------- */
function renderAboutForm() {
  const a = site.about || {};
  $('main').innerHTML = `
    <h2>关于编辑</h2>
    <p class="admin-tip">编辑个人简介与技能标签（标签用逗号分隔）。</p>
    <div class="field"><label>简介</label><textarea id="a-bio" rows="5">${a.bio || ''}</textarea></div>
    <div class="field"><label>技能标签（逗号分隔）</label><input id="a-skills" value="${(a.skills || []).join('，')}"></div>
    <button class="btn btn-primary" id="a-save">保存</button>`;
  $('a-save').addEventListener('click', async () => {
    const patch = {
      about: {
        bio: $('a-bio').value,
        skills: $('a-skills').value.split(/[，,]/).map((s) => s.trim()).filter(Boolean),
      },
    };
    try { await authFetch(() => API.saveSitePatch(patch)); await loadData(); alert('已保存并提交到 GitHub。由于 GitHub Pages 部署需要约 10–60 秒，请稍后刷新前台查看。'); }
    catch (e) { alert(e.message); }
  });
}

/* ---------- 联系 ---------- */
function renderContactForm() {
  const c = site.contact || {};
  // 兼容旧字符串数组格式
  const socials = (c.socials || []).map((s) =>
    typeof s === 'string' ? { name: s, url: '' } : Object.assign({}, s)
  );

  const renderSocialRows = () => socials.map((s, i) => `
    <div class="social-row" data-idx="${i}" style="display:grid;grid-template-columns:1fr 1.6fr 32px;gap:8px;margin-bottom:8px;align-items:start;">
      <input class="s-name" placeholder="名称，如 Instagram" value="${escapeHtml(s.name || '')}">
      <input class="s-url" placeholder="链接 https://...（留空为文本标签）" value="${escapeHtml(s.url || '')}">
      <button type="button" class="mini-btn s-del" title="删除">×</button>
    </div>
  `).join('');

  $('main').innerHTML = `
    <h2>联系编辑</h2>
    <p class="admin-tip">编辑邮箱、合作说明与社交平台。链接留空则前台显示为文本标签，填写后自动变为可点击链接。</p>
    <div class="field"><label>邮箱</label><input id="c-email" value="${escapeHtml(c.email || '')}"></div>
    <div class="field"><label>合作说明</label><textarea id="c-note" rows="3">${escapeHtml(c.note || '')}</textarea></div>
    <div class="field">
      <label style="display:flex;justify-content:space-between;align-items:center;">社交平台 <button type="button" class="mini-btn" id="c-add-social">+ 添加</button></label>
      <div id="c-socials">${renderSocialRows()}</div>
    </div>
    <button class="btn btn-primary" id="c-save">保存</button>`;

  $('c-add-social').addEventListener('click', () => {
    const box = $('c-socials');
    const div = document.createElement('div');
    div.className = 'social-row';
    div.style.cssText = 'display:grid;grid-template-columns:1fr 1.6fr 32px;gap:8px;margin-bottom:8px;align-items:start;';
    div.innerHTML = '<input class="s-name" placeholder="名称，如 Instagram" value=""><input class="s-url" placeholder="链接 https://...（留空为文本标签）" value=""><button type="button" class="mini-btn s-del" title="删除">×</button>';
    box.appendChild(div);
  });
  $('c-socials').addEventListener('click', (e) => {
    if (e.target.classList.contains('s-del')) e.target.closest('.social-row').remove();
  });

  $('c-save').addEventListener('click', async () => {
    const rows = [...$('c-socials').querySelectorAll('.social-row')];
    const newSocials = rows
      .map((row) => ({
        name: row.querySelector('.s-name').value.trim(),
        url: row.querySelector('.s-url').value.trim(),
      }))
      .filter((s) => s.name);
    const patch = {
      contact: {
        email: $('c-email').value.trim(),
        note: $('c-note').value,
        socials: newSocials,
      },
    };
    try { await authFetch(() => API.saveSitePatch(patch)); await loadData(); alert('已保存并提交到 GitHub。由于 GitHub Pages 部署需要约 10–60 秒，请稍后刷新前台查看。'); }
    catch (e) { alert(e.message); }
  });
}

/* ---------- 设计理念 ---------- */
function renderPhilosophyForm() {
  const p = site.philosophy || {};
  $('main').innerHTML = `
    <h2>设计理念编辑</h2>
    <p class="admin-tip">编辑理念区的英文标签、标题、条目与底部引言。条目可任意增删，保存后约 10–60 秒同步到前台。</p>
    <div class="grid2">
      <div class="field"><label>英文标签</label><input id="p-en" value="${p.en || ''}"></div>
      <div class="field"><label>标题</label><input id="p-title" value="${p.title || ''}"></div>
    </div>
    <div class="field"><label>条目（编号 / 标题 / 内容，可多行增删）</label>
      <div class="philo-edit" id="philo-edit"></div>
      <button class="mini-btn" id="add-philo" type="button">+ 添加条目</button>
    </div>
    <div class="field"><label>底部引言</label><textarea id="p-quote" rows="3">${p.quote || ''}</textarea></div>
    <button class="btn btn-primary" id="p-save">保存</button>`;

  const renderItems = (list) => {
    const box = $('philo-edit');
    box.innerHTML = '';
    list.forEach((it) => addPhiloRow(it.num, it.title, it.text));
    if (list.length === 0) addPhiloRow('', '', '');
  };
  renderItems(p.items || []);

  $('add-philo').addEventListener('click', () => addPhiloRow('', '', ''));
  $('p-save').addEventListener('click', async () => {
    const patch = {
      philosophy: {
        en: $('p-en').value.trim(),
        title: $('p-title').value.trim(),
        items: collectPhilo(),
        quote: $('p-quote').value.trim(),
      },
    };
    try { await authFetch(() => API.saveSitePatch(patch)); await loadData(); alert('已保存并提交到 GitHub。由于 GitHub Pages 部署需要约 10–60 秒，请稍后刷新前台查看。'); }
    catch (e) { alert(e.message); }
  });
}

function addPhiloRow(num, title, text) {
  const row = document.createElement('div');
  row.className = 'prow philo-row';
  row.innerHTML =
    '<input placeholder="编号" value="' + (num || '') + '" style="max-width:72px">' +
    '<input placeholder="标题" value="' + (title || '') + '">' +
    '<textarea placeholder="内容" rows="2">' + (text || '') + '</textarea>' +
    '<button class="mini-btn" type="button">×</button>';
  row.querySelector('button').addEventListener('click', () => row.remove());
  $('philo-edit').appendChild(row);
}

function collectPhilo() {
  return Array.from($('philo-edit').querySelectorAll('.philo-row'))
    .map((r) => ({
      num: r.children[0].value.trim(),
      title: r.children[1].value.trim(),
      text: r.children[2].value.trim(),
    }))
    .filter((p) => p.title || p.text);
}

/* ---------- 文字设置（导航 / 区块标题 / 页脚 / SEO）---------- */
function renderTextsForm() {
  const s = site;
  const nav = s.nav || [];
  const sec = s.sections || {};
  const ft = s.footer || {};
  const wl = s.workLabels || {};
  $('main').innerHTML = `
    <h2>文字设置</h2>
    <p class="admin-tip">编辑顶部导航与页脚导航、各区块标题（中英对照）、页脚栏目名与页脚 SEO 文案。保存后约 10–60 秒同步到前台。</p>

    <h3 style="margin:22px 0 6px;font-size:14px;font-weight:700;color:#1a1a1a;">导航（顶部与页脚共用）</h3>
    <p class="admin-tip">label 为显示文字，href 为链接（页面如 works.html，或锚点如 index.html#about）。</p>
    <div class="field"><div class="nav-edit" id="nav-edit"></div>
      <button class="mini-btn" id="add-nav" type="button">+ 添加导航项</button></div>

    <h3 style="margin:22px 0 6px;font-size:14px;font-weight:700;color:#1a1a1a;">区块标题</h3>
    <div class="grid2">
      <div class="field"><label>精选作品 · 英文</label><input id="sec-works-en" value="${(sec.works && sec.works.en) || ''}"></div>
      <div class="field"><label>精选作品 · 中文</label><input id="sec-works-title" value="${(sec.works && sec.works.title) || ''}"></div>
      <div class="field"><label>关于 · 英文</label><input id="sec-about-en" value="${(sec.about && sec.about.en) || ''}"></div>
      <div class="field"><label>关于 · 中文</label><input id="sec-about-title" value="${(sec.about && sec.about.title) || ''}"></div>
      <div class="field"><label>联系 · 英文</label><input id="sec-contact-en" value="${(sec.contact && sec.contact.en) || ''}"></div>
      <div class="field"><label>联系 · 中文</label><input id="sec-contact-title" value="${(sec.contact && sec.contact.title) || ''}"></div>
      <div class="field"><label>全部作品 · 英文</label><input id="sec-all-en" value="${(sec.allWorks && sec.allWorks.en) || ''}"></div>
      <div class="field"><label>全部作品 · 中文</label><input id="sec-all-title" value="${(sec.allWorks && sec.allWorks.title) || ''}"></div>
    </div>

    <h3 style="margin:22px 0 6px;font-size:14px;font-weight:700;color:#1a1a1a;">页脚栏目名</h3>
    <div class="grid2">
      <div class="field"><label>导航栏目</label><input id="ft-colnav" value="${ft.colNav || ''}"></div>
      <div class="field"><label>作品栏目</label><input id="ft-colworks" value="${ft.colWorks || ''}"></div>
      <div class="field"><label>联系栏目</label><input id="ft-colcontact" value="${ft.colContact || ''}"></div>
    </div>

    <h3 style="margin:22px 0 6px;font-size:14px;font-weight:700;color:#1a1a1a;">页脚 SEO 文案</h3>
    <div class="field"><textarea id="t-seo" rows="2">${s.seo || ''}</textarea></div>

    <h3 style="margin:22px 0 6px;font-size:14px;font-weight:700;color:#1a1a1a;">作品详情标签</h3>
    <p class="admin-tip">作品详情页里的小标签（英文项目名 / 概览 / 参数），统一在此修改。</p>
    <div class="grid2">
      <div class="field"><label>项目区（英文）</label><input id="wl-project" value="${(wl && wl.project) || ''}"></div>
      <div class="field"><label>概览</label><input id="wl-overview" value="${(wl && wl.overview) || ''}"></div>
      <div class="field"><label>参数</label><input id="wl-params" value="${(wl && wl.params) || ''}"></div>
    </div>

    <button class="btn btn-primary" id="t-save">保存</button>`;

  const renderNav = (list) => {
    const box = $('nav-edit');
    box.innerHTML = '';
    list.forEach((n) => addNavRow(n.label, n.href));
    if (list.length === 0) addNavRow('', '');
  };
  renderNav(nav);
  $('add-nav').addEventListener('click', () => addNavRow('', ''));

  $('t-save').addEventListener('click', async () => {
    const patch = {
      nav: collectNav(),
      sections: {
        works: { en: $('sec-works-en').value.trim(), title: $('sec-works-title').value.trim() },
        about: { en: $('sec-about-en').value.trim(), title: $('sec-about-title').value.trim() },
        contact: { en: $('sec-contact-en').value.trim(), title: $('sec-contact-title').value.trim() },
        allWorks: { en: $('sec-all-en').value.trim(), title: $('sec-all-title').value.trim() },
      },
      footer: {
        colNav: $('ft-colnav').value.trim(),
        colWorks: $('ft-colworks').value.trim(),
        colContact: $('ft-colcontact').value.trim(),
      },
      workLabels: {
        project: $('wl-project').value.trim() || 'PROJECT',
        overview: $('wl-overview').value.trim() || '概览',
        params: $('wl-params').value.trim() || '参数',
      },
      seo: $('t-seo').value.trim(),
    };
    try { await authFetch(() => API.saveSitePatch(patch)); await loadData(); alert('已保存并提交到 GitHub。由于 GitHub Pages 部署需要约 10–60 秒，请稍后刷新前台查看。'); }
    catch (e) { alert(e.message); }
  });
}

function addNavRow(label, href) {
  const row = document.createElement('div');
  row.className = 'prow';
  row.innerHTML = '<input placeholder="显示文字" value="' + (label || '') + '"><input placeholder="链接 href" value="' + (href || '') + '"><button class="mini-btn" type="button">×</button>';
  row.querySelector('button').addEventListener('click', () => row.remove());
  $('nav-edit').appendChild(row);
}

function collectNav() {
  return Array.from($('nav-edit').querySelectorAll('.prow'))
    .map((r) => ({ label: r.children[0].value.trim(), href: r.children[1].value.trim() }))
    .filter((n) => n.label && n.href);
}

/* ---------- 启动 ---------- */
(async function init() {
  if (API.token) {
    try {
      await loadData();
      showShell();
      switchTab('dashboard');
      return;
    } catch (e) { API.setToken(''); }
  }
  showLogin();
})();
