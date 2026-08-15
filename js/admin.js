/* 后台管理逻辑（GitHub Pages 方案：写操作通过 GitHub Token 提交到仓库） */
let site = null;
let editingId = null;
let editImages = [];
let editCover = '';

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
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    try {
      const url = await authFetch(() => API.upload(f));
      editImages.push(url);
      if (!editCover) editCover = url;
      renderThumbs();
    } catch (e) { alert('上传失败：' + e.message); }
  }
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
    <button class="btn btn-primary" id="h-save">保存</button>`;

  let avatarUrl = site.avatar || '';
  const renderAvatar = () => {
    const box = $('h-avatar-thumb');
    box.innerHTML = avatarUrl ? `<div class="t cover"><img src="${avatarUrl}"><button class="x">×</button></div>` : '';
    box.querySelector('.x') && box.querySelector('.x').addEventListener('click', () => { avatarUrl = ''; renderAvatar(); });
  };
  renderAvatar();

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
      },
    };
    try {
      await authFetch(() => API.saveSitePatch(patch));
      await loadData();
      alert('已保存');
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
    try { await authFetch(() => API.saveSitePatch(patch)); await loadData(); alert('已保存'); }
    catch (e) { alert(e.message); }
  });
}

/* ---------- 联系 ---------- */
function renderContactForm() {
  const c = site.contact || {};
  $('main').innerHTML = `
    <h2>联系编辑</h2>
    <p class="admin-tip">编辑邮箱、合作说明与社交平台（逗号分隔）。</p>
    <div class="field"><label>邮箱</label><input id="c-email" value="${c.email || ''}"></div>
    <div class="field"><label>合作说明</label><textarea id="c-note" rows="3">${c.note || ''}</textarea></div>
    <div class="field"><label>社交平台（逗号分隔）</label><input id="c-socials" value="${(c.socials || []).join('，')}"></div>
    <button class="btn btn-primary" id="c-save">保存</button>`;
  $('c-save').addEventListener('click', async () => {
    const patch = {
      contact: {
        email: $('c-email').value.trim(),
        note: $('c-note').value,
        socials: $('c-socials').value.split(/[，,]/).map((s) => s.trim()).filter(Boolean),
      },
    };
    try { await authFetch(() => API.saveSitePatch(patch)); await loadData(); alert('已保存'); }
    catch (e) { alert(e.message); }
  });
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
