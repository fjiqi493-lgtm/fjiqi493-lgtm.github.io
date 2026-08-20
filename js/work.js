/* 作品详情页渲染 */
let __workRaw = null;
let __workId = null;
function renderWork() {
  const data = API.localized(__workRaw);
  const w = (data.works || []).find((x) => x.id === __workId);

  renderChrome(data);

  setText('brand', data.brand);

  // 作品详情小标签（可在后台「文字设置 → 作品详情标签」中编辑）
  const wl = data.workLabels || {};
  setText('w-label-project', wl.project || 'PROJECT');
  setText('w-label-overview', wl.overview || 'Overview');
  setText('w-label-params', wl.params || 'Parameters');
  setText('detail-back', UIT('back'));

  if (!w) {
    $('d-title').textContent = UIT('notFound');
    return;
  }

  setText('d-title', w.title);
  setText('d-cat', (w.category || '') + (w.year ? ' · ' + w.year : ''));

  // 封面（点击放大）
  const cover = $('d-cover-img');
  cover.src = w.cover || (w.images && w.images[0]) || '';
  cover.alt = w.title;
  $('d-cover').setAttribute('data-zoom', cover.src);

  // 描述（按换行分段）
  const desc = $('d-desc');
  desc.innerHTML = '';
  (w.description || '').split('\n').forEach((p) => {
    if (p.trim()) {
      const el = document.createElement('p');
      el.textContent = p.trim();
      desc.appendChild(el);
    }
  });

  // 概览
  const ov = $('d-overview');
  ov.innerHTML = '';
  [
    [UIT('ovCat'), w.category || '—'],
    [UIT('ovYear'), w.year || '—'],
  ].forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'param-row';
    row.innerHTML = '<span class="k">' + k + '</span><span class="v">' + v + '</span>';
    ov.appendChild(row);
  });

  // 参数
  const ps = $('d-params');
  ps.innerHTML = '';
  (w.params || []).forEach((p) => {
    const row = document.createElement('div');
    row.className = 'param-row';
    row.innerHTML = '<span class="k">' + p.k + '</span><span class="v">' + p.v + '</span>';
    ps.appendChild(row);
  });

  // 图集（点击放大；图片若因 GitHub 延迟 404，自动重试 3 次）
  const gal = $('d-gallery');
  gal.innerHTML = '';
  (w.images || []).forEach((src) => {
    const d = document.createElement('div');
    d.className = 'g-img';
    d.setAttribute('data-zoom', src);
    const img = document.createElement('img');
    img.alt = w.title;
    img.loading = 'lazy';
    let retries = 0;
    img.onerror = () => {
      if (retries < 3) {
        retries++;
        setTimeout(() => { img.src = src + (src.includes('?') ? '&' : '?') + '_retry=' + retries; }, 2000 * retries);
      }
    };
    img.src = src;
    d.appendChild(img);
    gal.appendChild(d);
  });

  renderFooter(data);
  initReveal();
  initLightbox();
}
(async function () {
  const params = new URLSearchParams(location.search);
  __workId = params.get('id');
  __workRaw = await API.getSite();
  renderWork();
  window.addEventListener('lang:change', () => withLangFade(renderWork));
})();
