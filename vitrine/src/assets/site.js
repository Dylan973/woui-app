const menu = document.querySelector('.menu-button');
const links = document.querySelector('#nav-links');

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  links.classList.toggle('open', open);
}

menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
links.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});

const demoButtons = document.querySelectorAll('[data-demo]');
for (const button of demoButtons) {
  button.addEventListener('click', () => {
    for (const choice of demoButtons) {
      const active = choice === button;
      choice.setAttribute('aria-pressed', String(active));
      document.getElementById(choice.getAttribute('aria-controls')).hidden = !active;
    }
  });
}

const billingButtons = document.querySelectorAll('[data-billing]');
const formatPrice = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
for (const button of billingButtons) {
  button.addEventListener('click', () => {
    const mode = button.dataset.billing;
    for (const choice of billingButtons) choice.setAttribute('aria-pressed', String(choice === button));
    for (const price of document.querySelectorAll('.price strong')) price.textContent = formatPrice.format(Number(price.dataset[mode]));
    for (const note of document.querySelectorAll('[data-price-note]')) note.textContent = note.dataset[mode];
  });
}

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('motion');
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('awaiting');
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -22px' });

  for (const element of document.querySelectorAll('.reveal')) {
    if (element.getBoundingClientRect().top >= innerHeight + 20) {
      element.classList.add('awaiting');
      reveal.observe(element);
    }
  }

  const hero = document.querySelector('.hero');
  if (hero) {
    const observer = new IntersectionObserver(([entry]) => {
      hero.classList.toggle('spread', entry.boundingClientRect.top < 0 && entry.intersectionRatio < .88);
    }, { threshold: [0, .88, 1] });
    observer.observe(hero);
  }
}

// Défilement fluide (Lenis), désactivé si l'utilisateur préfère réduire les animations.
let lenis = null;
if (window.Lenis && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  const navOffset = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href*="#"]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    const target = url.hash === '#' ? document.body : document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target, { offset: -navOffset() });
    history.pushState(null, '', url.hash);
  });
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) addEventListener('load', () => lenis.scrollTo(target, { offset: -navOffset(), immediate: true }));
  }
}

// Vidéo « Comment ça marche » dans une fenêtre.
const videoLinks = document.querySelectorAll('[data-video]');
if (videoLinks.length && typeof HTMLDialogElement === 'function') {
  const dialog = document.createElement('dialog');
  dialog.className = 'video-modal';
  dialog.setAttribute('aria-label', 'Vidéo : comment fonctionne Woui');
  dialog.innerHTML = '<button type="button" class="video-close" aria-label="Fermer la vidéo">Fermer ✕</button><video controls playsinline preload="none"></video>';
  document.body.append(dialog);
  const video = dialog.querySelector('video');
  const close = () => dialog.close();

  dialog.querySelector('.video-close').addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    video.pause();
    lenis?.start();
  });

  for (const link of videoLinks) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (video.getAttribute('src') !== link.dataset.video) {
        video.src = link.dataset.video;
        if (link.dataset.poster) video.poster = link.dataset.poster;
      }
      lenis?.stop();
      dialog.showModal();
      video.currentTime = 0;
      video.play().catch(() => {});
    });
  }
}
