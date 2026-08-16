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

  // 视觉大图：取第一件作品的封面作为代表作
  const heroImg = $('home-visual-img');
  const first = data.works[0];
  if (first) heroImg.src = first.cover || (first.images && first.images[0]) || '';
  heroImg.alt = first ? first.title : '代表作';

  // 精选作品（取前 6 件）
  renderWorksGrid(data.works, $('works-grid'), 6);

  // 关于
  setText('about-bio', data.about.bio);
  const skills = $('skills');
  skills.innerHTML = '';
  (data.about.skills || []).forEach((s) => {
    const el = document.createElement('span');
    el.style.cssText = 'padding:7px 15px;border:1px solid var(--line-strong);border-radius:var(--radius-pill);font-size:13px;color:var(--muted);';
    el.textContent = s;
    skills.appendChild(el);
  });

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
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = s;
    a.style.cssText = 'font-size:14px;color:var(--muted);';
    socials.appendChild(a);
  });

  renderFooter(data);
  initReveal();
  initLightbox();
})();
