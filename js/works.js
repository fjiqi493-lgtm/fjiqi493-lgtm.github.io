/* 作品列表页渲染 */
let __worksRaw = null;
function renderWorksPage() {
  const data = localized(__worksRaw);

  renderChrome(data);

  setText('brand', data.brand);
  setText('count', (data.works || []).length + UIT('count'));

  const grid = $('works-grid');
  if (!data.works || data.works.length === 0) {
    $('empty').style.display = 'block';
  } else {
    renderWorksGrid(data.works, grid);
  }

  renderFooter(data);
  initReveal();
  initLightbox();
  fadeImages();
}
(async function () {
  __worksRaw = await API.getSite();
  renderWorksPage();
  window.addEventListener('lang:change', () => withLangFade(renderWorksPage));
})();
