/* 首页渲染 */
let __homeRaw = null;
function renderHome() {
  const data = localized(__homeRaw);

  renderChrome(data);

  // 品牌
  setText('brand', data.brand);

  // Hero
  setText('home-kicker', data.home.kicker);
  setText('home-name', data.home.name);
  setText('home-title', data.home.title);
  setText('home-bio', data.home.bio);

  // 头像：有图用图，否则显示名字首字
  const avatar = $('avatar');
  if (data.avatar) {
    avatar.innerHTML = '<img src="' + data.avatar + '" alt="头像" />';
  } else {
    avatar.textContent = (data.home.name || data.brand || '?').trim().charAt(0);
  }

  // 视觉大图：后台设置的 heroImage 优先，否则取第一件作品的封面作为代表作
  const heroImg = $('home-visual-img');
  const first = data.works[0];
  const heroSrc = data.home.heroImage || (first && (first.cover || (first.images && first.images[0]))) || '';
  heroImg.src = heroSrc;
  heroImg.alt = (data.home.heroImage && '代表作') || (first ? first.title : '代表作');

  // 精选作品（取前 6 件）
  renderWorksGrid(data.works, $('works-grid'), 6);

  // 项目过程（3D 透视滚动条带 + 软件图标）
  renderProcess(data.process || {});

  // 设计理念（后台可编辑）
  const ph = data.philosophy || {};
  setText('philo-en', ph.en);
  setText('philo-title', ph.title);
  const phGrid = $('philosophy-grid');
  if (phGrid) {
    phGrid.innerHTML = '';
    (ph.items || []).forEach((it) => {
      const card = document.createElement('div');
      card.className = 'philo-card';
      card.innerHTML =
        '<span class="philo-num">' + (it.num || '') + '</span>' +
        '<h3 class="philo-title">' + (it.title || '') + '</h3>' +
        '<p class="philo-text">' + (it.text || '') + '</p>';
      phGrid.appendChild(card);
    });
  }
  const phQuote = $('philo-quote');
  if (phQuote) phQuote.innerHTML = ph.quote ? '<p>' + ph.quote + '</p>' : '';

  // 联系
  const email = $('contact-email');
  email.textContent = data.contact.email;
  email.href = 'mailto:' + data.contact.email;
  setText('contact-note', data.contact.note);
  const socials = $('socials');
  socials.innerHTML = '';
  (data.contact.socials || []).forEach((s) => {
    const item = typeof s === 'string' ? { name: s, url: '' } : s;
    const el = document.createElement(item.url ? 'a' : 'span');
    if (item.url) {
      el.href = item.url;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    el.textContent = item.name || '';
    el.className = 'social-link' + (item.url ? '' : ' is-text');
    socials.appendChild(el);
  });

  renderFooter(data);
  initReveal();
  initLightbox();
}

(async function () {
  __homeRaw = await API.getSite();
  renderHome();
  window.addEventListener('lang:change', () => withLangFade(renderHome));
})();

/* ---- 项目过程：3D 透视旋转木马 + 软件图标 ---- */
function renderProcess(p) {
  setText('s-process-en', p.en || 'PROJECT PROCESS');
  setText('s-process-title', p.title || '项目过程');
  const track = $('process-track');
  if (!track) return;
  const imgs = p.images || [];
  track.innerHTML = '';
  imgs.forEach((src) => {
    const it = document.createElement('div');
    it.className = 'process-item';
    const im = document.createElement('img');
    im.src = src;
    im.alt = '';
    im.loading = 'lazy';
    it.appendChild(im);
    track.appendChild(it);
  });
  initProcessCarousel(track);
  renderSoftware($('process-software'), p.software || []);
}

let __carouselRAF = 0;
function initProcessCarousel(track) {
  const items = Array.from(track.children);
  const n = items.length;
  if (n === 0) return;
  if (__carouselRAF) cancelAnimationFrame(__carouselRAF);
  const ANGLE = 34, DEPTH = 120, SPEED = 0.006;
  const spacing = window.matchMedia('(max-width: 1024px)').matches ? 140 : 220;
  let progress = 0;
  // 系统开启“减弱动效”时不做自动旋转（无障碍），仅静态布局一次
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 离开视口即暂停，进入视口恢复；不响应鼠标悬停（保持常驻滚动）
  let visible = true;
  function layout() {
    for (let i = 0; i < n; i++) {
      let off = i - progress;
      if (off > n / 2) off -= n;
      else if (off < -n / 2) off += n;
      const abs = Math.abs(off);
      const x = off * spacing;
      const ry = off * -ANGLE;
      const tz = -abs * DEPTH;
      const scale = 1 - Math.min(abs, 3) * 0.14;
      const op = abs > 3 ? 0 : 1 - abs * 0.22;
      const el = items[i];
      el.style.transform =
        'perspective(1100px) translateX(' + x + 'px) translateZ(' + tz +
        'px) rotateY(' + ry + 'deg) scale(' + scale + ')';
      el.style.opacity = op;
      el.style.zIndex = String(100 - Math.round(abs * 10));
    }
  }
  function tick() {
    if (visible && !reduceMotion) {
      progress += SPEED;
      if (progress >= n) progress -= n;
      layout();
    }
    __carouselRAF = requestAnimationFrame(tick);
  }
  layout();
  const stage = document.getElementById('process-stage');
  if (stage && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { visible = en.isIntersecting; }),
      { threshold: 0.05 }
    );
    io.observe(stage);
  }
  __carouselRAF = requestAnimationFrame(tick);
}

const SW_ICON = {
  // Devicon slug（优先从 jsDelivr 加载，国内稳定）
  'blender': 'blender', 'photoshop': 'photoshop', 'illustrator': 'illustrator',
  'premiere': 'premierepro', 'premiere pro': 'premierepro',
  'after effects': 'aftereffects', 'aftereffects': 'aftereffects',
  'figma': 'figma',
  // 没有公开 CDN 图标的：走本地文件、内嵌 SVG 或首字母兜底
  'rhino': '', 'keyshot': '', 'siemens nx': '', 'nx': '', 'siemens': '',
  'fusion 360': '', 'fusion360': '',
  'zbrush': '', 'sketchup': '', 'cinema 4d': '', 'cinema4d': '',
  'creo': '', 'creo parametric': ''
};
// 本地图标文件：质量最高、不依赖网络，优先使用
const SW_LOCAL = {
  'rhino': 'images/icons/rhino.png?v=20260820g',
  'keyshot': 'images/icons/keyshot.png?v=20260820g',
  'siemens nx': 'images/icons/siemens-nx.png?v=20260820g',
  'nx': 'images/icons/siemens-nx.png?v=20260820g',
  'siemens': 'images/icons/siemens-nx.png?v=20260820g',
  'fusion 360': 'images/icons/fusion360.png?v=20260820g',
  'fusion360': 'images/icons/fusion360.png?v=20260820g',
  'geomagic wrap': 'images/icons/geomagic-wrap.png?v=20260820g',
  'geomagicwrap': 'images/icons/geomagic-wrap.png?v=20260820g',
  'wrap': 'images/icons/geomagic-wrap.png?v=20260820g',
  'geomagic design x': 'images/icons/geomagic-design-x.png?v=20260820g',
  'geomagic designx': 'images/icons/geomagic-design-x.png?v=20260820g',
  'design x': 'images/icons/geomagic-design-x.png?v=20260820g',
  'designx': 'images/icons/geomagic-design-x.png?v=20260820g',
  'autocad': 'images/icons/autocad.png?v=20260820g',
  'auto cad': 'images/icons/autocad.png?v=20260820g',
  'rizomuv': 'images/icons/rizomuv.png?v=20260820g',
  'rizom uv': 'images/icons/rizomuv.png?v=20260820g',
  'spaceclaim': 'images/icons/spaceclaim.png?v=20260820g',
  '3dsmax': 'images/icons/3dsmax.png?v=20260820g',
  '3ds max': 'images/icons/3dsmax.png?v=20260820g',
  '3d studio max': 'images/icons/3dsmax.png?v=20260820g',
  'zbrush': 'images/icons/zbrush.png?v=20260820g',
  'pixplant': 'images/icons/pixplant.png?v=20260820g',
  'creo': 'images/icons/creo.png?v=20260820g',
  'creo parametric': 'images/icons/creo.png?v=20260820g'
};
// Simple Icons 兜底映射（Devicon 失败后尝试）
const SW_SIMPLE = {
  'blender': 'blender', 'photoshop': 'adobephotoshop', 'illustrator': 'adobeillustrator',
  'premiere': 'adobepremierepro', 'premiere pro': 'adobepremierepro',
  'after effects': 'adobeaftereffects', 'aftereffects': 'adobeaftereffects',
  'figma': 'figma', 'autodesk': 'autodesk', 'fusion 360': 'autodesk', 'fusion360': 'autodesk',
  'autocad': 'autodesk'
};
// 内嵌 SVG：没有稳定 CDN 或国内访问失败的软件，使用真实品牌 SVG
const SW_SVG = {
  // Rhino：Simple Icons (rhinoceros)
  'rhino': '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Rhino</title><path fill="currentColor" d="M6.823 3.103c-.1 0-.213.006-.34.017-.511.044-1.25.18-1.802.329a6.269 6.269 0 0 0-1.15.42c-.231.112-.33.178-.354.273-.023.094.028.217.16.436s.346.533.535.961c.19.428.356.97.361 1.651.006.68-.149 1.5-.245 1.962-.096.462-.133.568-.227.618-.094.05-.245.044-.525-.021-.281-.065-.69-.187-1.1-.259-.41-.072-.819-.093-1.122-.038-.304.056-.504.189-.645.369-.14.18-.224.406-.282.75A6.957 6.957 0 0 0 0 11.687c.005.317.047.49.136.584.088.094.223.109.492.054s.672-.18 1.224-.215a6.302 6.302 0 0 1 1.94.202c.685.182 1.353.49 1.95.93.598.438 1.127 1.007 1.566 1.593.438.586.787 1.189 1.004 1.541.217.353.304.455.372.42.068-.035.117-.207.145-.417a3.141 3.141 0 0 0-.02-.848 7.467 7.467 0 0 0-.32-1.365 5.617 5.617 0 0 0-.495-1.018c-.146-.247-.241-.408-.245-.51-.004-.103.085-.148.51-.315.424-.167 1.185-.457 1.958-.808.772-.351 1.556-.764 2.042-1.106.486-.341.674-.61.724-.937.05-.326-.039-.71-.16-1.076a6.93 6.93 0 0 0-.529-1.193A13.696 13.696 0 0 0 11.28 5.6a9.187 9.187 0 0 0-1.1-1.236c-.282-.255-.421-.31-.51-.29-.09.02-.131.115-.168.47-.037.356-.07.973-.144 1.559a7.468 7.468 0 0 1-.432 1.773 12.543 12.543 0 0 1-.99 1.982c-.388.64-.803 1.212-1.054 1.462-.25.25-.336.18-.477.064l-.486-.4c-.15-.125-.253-.213-.273-.293-.02-.08.045-.15.27-.448.227-.299.615-.825.96-1.478a7.75 7.75 0 0 0 .796-2.282 10.1 10.1 0 0 0 .095-2.338c-.044-.564-.124-.77-.306-.896-.137-.095-.332-.146-.638-.146zm6.48 7.034h-.012c-.084.01-.192.112-.415.294a6.86 6.86 0 0 1-1.017.7c-.458.257-1.038.507-1.51.734-.47.226-.831.429-1.004.712-.172.283-.155.648.04.85.194.204.566.246.883.259.318.013.58-.002.826.087.246.09.475.285.764.516.288.23.637.498.925.561.289.063.518-.079.766-.202.249-.124.516-.23.888-.225.371.005.847.12 1.318.37.47.248.938.63 1.184.866.247.236.272.327.245.362-.028.036-.108.018-.304-.14-.196-.157-.508-.454-.917-.688-.41-.234-.916-.404-1.4-.391-.482.013-.94.21-1.23.55-.29.34-.412.822-.546 1.164-.133.341-.28.543-.47.617-.19.074-.424.02-.703-.099-.28-.12-.604-.307-.874-.442-.269-.136-.484-.22-.62-.353-.136-.132-.195-.31-.203-.571-.01-.26.032-.6.05-.853.02-.25.018-.413-.038-.56a1.079 1.079 0 0 0-.232-.35c-.07-.07-.099-.075-.113-.058-.014.017-.012.058.01.158.023.1.067.26.05.581-.019.321-.098.803-.16 1.17-.062.366-.107.618-.02.808.087.191.306.322.707.54.4.22.982.527 1.518.855.537.327 1.027.673 1.562 1.089.534.415 1.112.9 1.5 1.238.39.339.588.532.742.59.154.059.264-.018.307-.138.044-.12.023-.285-.014-.429a1.174 1.174 0 0 0-.24-.46 4.92 4.92 0 0 0-.68-.704c-.287-.243-.614-.463-.803-.614-.19-.151-.242-.233-.212-.259.03-.026.14.004.302.108.162.103.375.28.612.459.237.178.499.356.733.584.235.228.443.506.583.706.14.201.214.324.294.372.08.049.165.022.277-.05a3.03 3.03 0 0 0 .426-.355c.178-.169.398-.393.551-.633.154-.24.242-.496.299-.772.056-.276.08-.572.247-.862.167-.29.476-.574.994-1.025.518-.451 1.244-1.07 1.891-1.664.648-.595 1.216-1.165 1.696-1.802.479-.638.87-1.342 1.067-1.743.199-.4.205-.498.14-.526-.063-.027-.198.015-.61.313-.414.297-1.106.849-1.886 1.43-.781.58-1.65 1.19-2.336 1.569-.686.378-1.19.524-1.55.562-.361.037-.58-.034-.724-.11-.143-.077-.21-.158-.224-.241-.013-.084.03-.17.135-.275.106-.106.277-.232.447-.392.17-.16.338-.354.468-.556.13-.202.22-.411.261-.592.042-.181.034-.333-.04-.376-.074-.043-.215.023-.376.11-.162.086-.343.192-.593.3a2.683 2.683 0 0 1-.92.235 1.626 1.626 0 0 1-1.088-.313c-.343-.26-.635-.71-.866-1.147-.23-.438-.398-.865-.512-1.12-.108-.242-.168-.33-.246-.33zm-2.215 4.075a.422.422 0 0 0-.294.115c-.094.086-.145.2-.034.338.112.137.385.297.636.469.252.172.481.357.666.42.184.064.323.006.402-.096.08-.102.1-.247-.003-.404-.103-.157-.327-.325-.564-.481-.238-.157-.488-.302-.681-.346a.574.574 0 0 0-.128-.015zm.252.208c.025 0 .053.003.083.01.118.026.272.115.418.211.145.096.283.2.333.289.05.089.014.163-.048.216a.255.255 0 0 1-.247.053c-.1-.031-.216-.126-.36-.219-.145-.093-.319-.184-.387-.268-.068-.084-.031-.162.029-.218a.26.26 0 0 1 .18-.074zm4.778 3.728c.211-.008.42.06.602.24.183.178.34.467.383.732.042.265-.03.505-.125.692a1.58 1.58 0 0 1-.289.397c-.074.074-.109.095-.14.095h-.003c-.033-.001-.062-.023-.208-.171a7.39 7.39 0 0 1-.573-.642c-.165-.22-.232-.383-.263-.568-.032-.185-.027-.39.082-.536.109-.146.323-.23.534-.239zm.093 1.111a.258.258 0 0 0-.153.046c-.058.041-.105.113-.093.185.012.073.085.146.174.255.089.11.195.255.264.335.068.08.1.093.127.091.029-.002.054-.018.086-.048a.349.349 0 0 0 .094-.157.518.518 0 0 0 .002-.316.668.668 0 0 0-.218-.282.476.476 0 0 0-.283-.109z"/></svg>',
  // KeyShot：来自 keyshot.com 官方 favicon，转 currentColor
  'keyshot': '<svg viewBox="0 0 458.19 456.5" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M352.06,421.8c39.93-25.66,72.1-64.09,89.62-112.11.68-1.86,1.28-3.73,1.89-5.61-1.08-2.11-2.22-4.26-3.4-6.41l-142.1,101.42,53.98,22.71Z"/><path fill="currentColor" opacity="0.7" d="M298.07,399.08l61.63-13.01-7.65,35.72-53.98-22.71Z"/><path fill="currentColor" opacity="0.89" d="M359.7,386.08l81.31-86.87c-.27-.51-.56-1.03-.84-1.54l-142.1,101.42,61.63-13.01Z"/><path fill="currentColor" d="M122.96,431.51c42.18,21.74,91.55,30.41,141.9,21.57,1.96-.34,3.88-.76,5.8-1.16,1.3-1.99,2.58-4.05,3.86-6.15l-158.89-72.36,7.32,58.11h0Z"/><path fill="currentColor" opacity="0.7" d="M115.64,373.4l42.08,46.87-34.76,11.24-7.32-58.11Z"/><path fill="currentColor" opacity="0.89" d="M157.72,420.27l115.89,26.99c.31-.49.61-1,.92-1.5l-158.89-72.36,42.08,46.87h0Z"/><path fill="currentColor" d="M0,237.96c2.26,47.41,19.45,94.49,52.28,133.67,1.27,1.52,2.59,2.98,3.9,4.44,2.37.13,4.81.2,7.26.26l-16.78-173.77L0,237.96Z"/><path fill="currentColor" opacity="0.7" d="M46.66,202.56l-19.55,59.88L0,237.96l46.66-35.4Z"/><path fill="currentColor" opacity="0.89" d="M27.11,262.44l34.58,113.85c.58.02,1.16.03,1.75.04l-16.78-173.77-19.55,59.88h0Z"/><path fill="currentColor" d="M106.14,34.71c-39.92,25.66-72.11,64.08-89.63,112.11-.68,1.86-1.28,3.73-1.9,5.61,1.08,2.11,2.23,4.26,3.4,6.42L160.13,57.43l-53.99-22.72Z"/><path fill="currentColor" opacity="0.7" d="M160.13,57.43l-61.63,13.01,7.64-35.72,53.99,22.72Z"/><path fill="currentColor" opacity="0.89" d="M98.5,70.44L17.19,157.31c.27.51.55,1.03.83,1.54L160.13,57.43l-61.63,13.01h0Z"/><path fill="currentColor" d="M335.22,24.99C293.03,3.24,243.67-5.42,193.32,3.43c-1.96.34-3.88.76-5.8,1.16-1.29,1.99-2.57,4.05-3.85,6.15l158.88,72.35-7.32-58.11h0Z"/><path fill="currentColor" opacity="0.7" d="M342.55,83.1l-42.08-46.88,34.75-11.24,7.32,58.11Z"/><path fill="currentColor" opacity="0.89" d="M300.47,36.22l-115.89-26.98c-.31.49-.61,1-.92,1.5l158.88,72.35-42.08-46.88h0Z"/><path fill="currentColor" d="M458.19,218.54c-2.26-47.41-19.44-94.49-52.28-133.67-1.27-1.52-2.59-2.98-3.9-4.44-2.37-.13-4.81-.2-7.27-.26l16.77,173.78,46.67-35.4h0Z"/><path fill="currentColor" opacity="0.7" d="M411.52,253.94l19.55-59.88,27.12,24.48-46.67,35.4Z"/><path fill="currentColor" opacity="0.89" d="M431.07,194.07l-34.58-113.86c-.58-.02-1.17-.03-1.74-.04l16.77,173.78,19.55-59.88h0Z"/></svg>',
  // Siemens NX：Siemens 文字标来自 Simple Icons；NX 本身无公开单色图标，用 Siemens 标兜底
  'siemens nx': '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Siemens NX</title><path fill="currentColor" d="M1.478 10.016c.24 0 .59.046 1.046.14v.726a2.465 2.465 0 0 0-.946-.213c-.41 0-.615.118-.615.354 0 .088.041.16.124.216.069.045.258.14.568.286.446.208.743.388.89.541.176.182.264.417.264.705 0 .415-.172.73-.516.949-.279.176-.64.264-1.085.264-.375 0-.753-.046-1.133-.139v-.755c.41.135.774.203 1.09.203.437 0 .655-.121.655-.362a.302.302 0 0 0-.095-.227c-.065-.065-.232-.155-.5-.27-.481-.208-.795-.384-.94-.53a.999.999 0 0 1-.284-.73c0-.377.137-.666.413-.864.272-.196.626-.294 1.064-.294zm21.19 0c.246 0 .565.04.956.123l.09.016v.727a2.471 2.471 0 0 0-.948-.213c-.409 0-.612.118-.612.354 0 .088.04.16.123.216.066.043.256.139.57.286.443.208.74.388.889.541.176.182.264.417.264.705 0 .415-.172.73-.514.949-.28.176-.643.264-1.087.264-.376 0-.754-.046-1.134-.139v-.755c.407.135.77.203 1.09.203.437 0 .655-.121.655-.362 0-.09-.03-.166-.092-.227-.066-.065-.233-.155-.503-.27-.48-.206-.793-.382-.94-.53a.997.997 0 0 1-.284-.732c0-.376.137-.664.413-.862.272-.196.627-.294 1.064-.294zm-12.674.066l.92 2.444.942-2.444h1.257v3.825h-.968v-2.708l-1.072 2.747h-.632l-1.052-2.747v2.708H8.67v-3.825zm-5.587 0v3.825H3.386v-3.825zm3.554 0v.692H6.327v.864H7.75v.63H6.327v.908h1.677v.73h-2.66v-3.824zm8.707 0v.692h-1.634v.864h1.422v.63h-1.422v.908h1.677v.73H14.05v-3.824zm1.898 0l1.255 2.56v-2.56h.719v3.825h-1.15l-1.288-2.595v2.595h-.72v-3.825z"/></svg>',
  'nx': '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>NX</title><path fill="currentColor" d="M1.478 10.016c.24 0 .59.046 1.046.14v.726a2.465 2.465 0 0 0-.946-.213c-.41 0-.615.118-.615.354 0 .088.041.16.124.216.069.045.258.14.568.286.446.208.743.388.89.541.176.182.264.417.264.705 0 .415-.172.73-.516.949-.279.176-.64.264-1.085.264-.375 0-.753-.046-1.133-.139v-.755c.41.135.774.203 1.09.203.437 0 .655-.121.655-.362a.302.302 0 0 0-.095-.227c-.065-.065-.232-.155-.5-.27-.481-.208-.795-.384-.94-.53a.999.999 0 0 1-.284-.73c0-.377.137-.666.413-.864.272-.196.626-.294 1.064-.294zm21.19 0c.246 0 .565.04.956.123l.09.016v.727a2.471 2.471 0 0 0-.948-.213c-.409 0-.612.118-.612.354 0 .088.04.16.123.216.066.043.256.139.57.286.443.208.74.388.889.541.176.182.264.417.264.705 0 .415-.172.73-.514.949-.28.176-.643.264-1.087.264-.376 0-.754-.046-1.134-.139v-.755c.407.135.77.203 1.09.203.437 0 .655-.121.655-.362 0-.09-.03-.166-.092-.227-.066-.065-.233-.155-.503-.27-.48-.206-.793-.382-.94-.53a.997.997 0 0 1-.284-.732c0-.376.137-.664.413-.862.272-.196.627-.294 1.064-.294zm-12.674.066l.92 2.444.942-2.444h1.257v3.825h-.968v-2.708l-1.072 2.747h-.632l-1.052-2.747v2.708H8.67v-3.825zm-5.587 0v3.825H3.386v-3.825zm3.554 0v.692H6.327v.864H7.75v.63H6.327v.908h1.677v.73h-2.66v-3.824zm8.707 0v.692h-1.634v.864h1.422v.63h-1.422v.908h1.677v.73H14.05v-3.824zm1.898 0l1.255 2.56v-2.56h.719v3.825h-1.15l-1.288-2.595v2.595h-.72v-3.825z"/></svg>',
  'zbrush': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v4H8v4h10v4H8v4h12v4H4V4z"/></svg>',
  'sketchup': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12L3 7M12 12l9-5"/></svg>',
  'cinema 4d': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 4c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6z"/></svg>',
  'cinema4d': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 4c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6z"/></svg>'
};
function initials(name) {
  const p = name.trim().split(/\s+/);
  if (p.length > 1) return (p[0][0] + p[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}
function renderSoftware(box, names) {
  if (!box) return;
  box.innerHTML = '';
  (names || []).forEach((raw) => {
    const name = String(raw).trim();
    if (!name) return;
    const pill = document.createElement('div');
    pill.className = 'sw-pill';
    const letter = document.createElement('span');
    letter.className = 'sw-letter';
    letter.textContent = initials(name);
    letter.style.display = 'none';
    pill.appendChild(letter);

    const key = name.toLowerCase();
    const localPath = SW_LOCAL[key] || '';
    const slug = SW_ICON[key] || '';
    const simple = SW_SIMPLE[key] || '';
    const svgHtml = SW_SVG[key] || '';

    if (localPath) {
      // 本地图标文件，质量最高、不依赖网络
      const img = document.createElement('img');
      img.className = 'sw-ico sw-local';
      img.alt = name;
      img.src = localPath;
      img.onerror = function () { this.remove(); letter.style.display = ''; };
      pill.appendChild(img);
    } else if (svgHtml) {
      // 内嵌 SVG，不依赖网络
      const wrap = document.createElement('span');
      wrap.className = 'sw-ico';
      wrap.innerHTML = svgHtml;
      const svg = wrap.querySelector('svg');
      if (svg) { svg.setAttribute('aria-label', name); svg.setAttribute('role', 'img'); }
      pill.appendChild(wrap);
    } else if (slug) {
      const img = document.createElement('img');
      img.className = 'sw-ico';
      img.alt = name;
      // Devicon 优先；部分图标只有 -plain 没有 -original
      img.src = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/' + slug + '/' + slug + '-original.svg';
      img.onerror = function () {
        if (simple) {
          this.onerror = function () { this.remove(); letter.style.display = ''; };
          this.src = 'https://cdn.simpleicons.org/' + simple;
        } else {
          this.remove(); letter.style.display = '';
        }
      };
      pill.appendChild(img);
    } else if (simple) {
      // 没有 Devicon 但有 Simple Icons
      const img = document.createElement('img');
      img.className = 'sw-ico'; img.alt = name;
      img.onerror = () => { img.remove(); letter.style.display = ''; };
      img.src = 'https://cdn.simpleicons.org/' + simple;
      pill.appendChild(img);
    } else {
      letter.style.display = '';
    }

    const label = document.createElement('span');
    label.textContent = name;
    pill.appendChild(label);
    box.appendChild(pill);
  });
}
