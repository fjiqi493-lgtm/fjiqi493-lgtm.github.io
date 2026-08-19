/* 首页渲染 */
(async function () {
  const data = await API.getSite();

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

function initProcessCarousel(track) {
  const items = Array.from(track.children);
  const n = items.length;
  if (n === 0) return;
  const ANGLE = 34, DEPTH = 120, SPEED = 0.006;
  const spacing = window.matchMedia('(max-width: 1024px)').matches ? 96 : 150;
  let progress = 0;
  let paused = false;
  const stage = $('process-stage');
  if (stage) {
    stage.addEventListener('mouseenter', () => (paused = true));
    stage.addEventListener('mouseleave', () => (paused = false));
  }
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
    if (!paused) {
      progress += SPEED;
      if (progress >= n) progress -= n;
      layout();
    }
    requestAnimationFrame(tick);
  }
  layout();
  requestAnimationFrame(tick);
}

const SW_ICON = {
  'rhino': '', 'blender': 'blender', 'keyshot': '', 'photoshop': 'adobephotoshop',
  'illustrator': 'adobeillustrator', 'fusion 360': 'autodesk', 'fusion360': 'autodesk',
  'autocad': 'autodesk', 'autodesk': 'autodesk', 'zbrush': 'zbrush',
  'sketchup': 'sketchup', 'cinema 4d': 'cinema4d', 'figma': 'figma',
  'premiere': 'adobepremierepro', 'after effects': 'adobeaftereffects'
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
    const slug = SW_ICON[name.toLowerCase()] || '';
    if (slug) {
      const letter = document.createElement('span');
      letter.className = 'sw-letter';
      letter.textContent = initials(name);
      letter.style.display = 'none';
      const img = document.createElement('img');
      img.className = 'sw-ico';
      img.alt = name;
      img.onerror = () => { img.remove(); letter.style.display = ''; };
      img.src = 'https://cdn.simpleicons.org/' + slug;
      pill.appendChild(letter);
      pill.appendChild(img);
    } else {
      const letter = document.createElement('span');
      letter.className = 'sw-letter';
      letter.textContent = initials(name);
      pill.appendChild(letter);
    }
    const label = document.createElement('span');
    label.textContent = name;
    pill.appendChild(label);
    box.appendChild(pill);
  });
}
