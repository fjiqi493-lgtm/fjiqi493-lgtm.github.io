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
  const spacing = window.matchMedia('(max-width: 1024px)').matches ? 140 : 220;
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
  // Devicon slug（优先从 jsDelivr 加载，国内稳定）
  'blender': 'blender', 'photoshop': 'photoshop', 'illustrator': 'illustrator',
  'premiere': 'premierepro', 'premiere pro': 'premierepro',
  'after effects': 'aftereffects', 'aftereffects': 'aftereffects',
  'figma': 'figma', 'autodesk': 'autodesk', 'fusion 360': 'autodesk', 'fusion360': 'autodesk',
  'autocad': 'autodesk',
  // 没有公开 CDN 图标的：走内嵌 SVG 或首字母兜底
  'rhino': '', 'keyshot': '', 'siemens nx': '', 'nx': '', 'siemens': '',
  'zbrush': '', 'sketchup': '', 'cinema 4d': '', 'cinema4d': ''
};
// Simple Icons 兜底映射（Devicon 失败后尝试）
const SW_SIMPLE = {
  'blender': 'blender', 'photoshop': 'adobephotoshop', 'illustrator': 'adobeillustrator',
  'premiere': 'adobepremierepro', 'premiere pro': 'adobepremierepro',
  'after effects': 'adobeaftereffects', 'aftereffects': 'adobeaftereffects',
  'figma': 'figma', 'autodesk': 'autodesk', 'fusion 360': 'autodesk', 'fusion360': 'autodesk',
  'autocad': 'autodesk'
};
// 内嵌 SVG：没有 CDN 图标的软件用简洁标志
const SW_SVG = {
  'rhino': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.7 9.8c-.4-1.6-1.8-2.9-3.5-3.3-.9-.2-1.7-.4-2.6-.4-1.6 0-3 .4-4.2 1.4-1.3 1-1.9 2.6-1.6 4.2.2 1 .8 1.9 1.6 2.5l-.9 2.7 2.9-1c.8.2 1.6.4 2.4.4 2.9 0 5.5-2.1 5.9-5 .1-.8.1-1.3 0-1.5zM9.5 8.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/></svg>',
  'keyshot': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="M12 6v2M12 16v2M6 12h2M16 12h2"/></svg>',
  'siemens nx': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l8 5v10l-8 5-8-5V7z"/><path d="M12 12l8-5M12 12l-8-5M12 12v10"/></svg>',
  'nx': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l8 5v10l-8 5-8-5V7z"/><path d="M12 12l8-5M12 12l-8-5M12 12v10"/></svg>',
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
    const slug = SW_ICON[key] || '';
    const simple = SW_SIMPLE[key] || '';
    const svgHtml = SW_SVG[key] || '';

    if (svgHtml) {
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
