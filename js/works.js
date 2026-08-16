/* 作品列表页渲染 */
(async function () {
  const data = await API.getSite();

  renderChrome(data);

  setText('brand', data.brand);
  setText('count', (data.works || []).length + ' 件作品');

  const grid = $('works-grid');
  if (!data.works || data.works.length === 0) {
    $('empty').style.display = 'block';
  } else {
    renderWorksGrid(data.works, grid);
  }

  renderFooter(data);
  initReveal();
  initLightbox();
})();
