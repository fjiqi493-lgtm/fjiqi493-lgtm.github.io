/* 作品详情页渲染 */
(async function () {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const data = await API.getSite();
  const w = (data.works || []).find((x) => x.id === id);

  renderChrome(data);

  setText('brand', data.brand);

  if (!w) {
    $('d-title').textContent = '作品不存在';
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
    ['类别', w.category || '—'],
    ['年份', w.year || '—'],
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

  // 图集（点击放大）
  const gal = $('d-gallery');
  gal.innerHTML = '';
  (w.images || []).forEach((src) => {
    const d = document.createElement('div');
    d.className = 'g-img';
    d.setAttribute('data-zoom', src);
    d.innerHTML = '<img src="' + src + '" alt="' + w.title + '" loading="lazy" />';
    gal.appendChild(d);
  });

  renderFooter(data);
  initReveal();
  initLightbox();
})();
