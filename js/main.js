/* =========================================================
   Grosfeld Interieurbouw & Trappen, demo v2
   Gedeeld gedrag voor alle pagina's. Elk onderdeel controleert
   eerst of de markup op de pagina staat. Zie COMPONENTEN.md.
   ========================================================= */
(function () {
  'use strict';

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var doc = document;
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function safe(name, fn) { try { fn(); } catch (err) { if (window.console) console.warn('[' + name + ']', err); } }

  /* Tab blijft binnen een open venster */
  function trapTab(e, box) {
    if (e.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled]), [tabindex="0"]', box).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Reveal bij scrollen (met vangnet) ---------- */
  function showAllReveals() { $$('.reveal').forEach(function (el) { el.classList.add('is-visible'); }); }
  safe('reveal', function () {
    var items = $$('.reveal');
    window.__revealOK = true;
    if (reduce || !('IntersectionObserver' in window)) { showAllReveals(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.01 });
    items.forEach(function (el) { io.observe(el); });
    /* Vangnet: alles wat al in of boven beeld staat meteen tonen */
    var check = function () {
      var h = window.innerHeight;
      $$('.reveal:not(.is-visible)').forEach(function (el) {
        if (el.getBoundingClientRect().top < h) { el.classList.add('is-visible'); io.unobserve(el); }
      });
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('load', check);
    setTimeout(check, 600);
    check();
  });

  /* ---------- Actieve pagina in de navigatie ---------- */
  safe('nav-actief', function () {
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (file === '' || file.indexOf('.') === -1) file = 'index.html';
    var setByHand = $('.nav a[aria-current="page"]');
    var current = setByHand ? setByHand.getAttribute('href').split('#')[0].split('?')[0].toLowerCase() : file;
    $$('.nav a, .drawer nav a, .footer__nav a').forEach(function (a) {
      var href = (a.getAttribute('href') || '');
      if (href.indexOf('#') > -1 || /^(tel|mailto|https?):/i.test(href)) return;
      var target = href.split('?')[0].toLowerCase();
      if (target === current) a.setAttribute('aria-current', 'page');
      else if (a.getAttribute('aria-current') === 'page' && a !== setByHand) a.removeAttribute('aria-current');
    });
  });

  /* ---------- Header: zwevende balk, blijft altijd zichtbaar ---------- */
  safe('header', function () {
    var header = $('.site-header');
    if (!header) return;
    var ticking = false;
    function onScroll() {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  });

  /* ---------- Mobiel menu (drawer) ---------- */
  var setMenu = function () {};
  safe('menu', function () {
    var burger = $('.burger');
    var drawer = $('#drawer');
    var overlay = $('.overlay');
    if (!burger || !drawer) return;
    var closeBtn = $('.drawer__close', drawer);
    setMenu = function (open) {
      var was = drawer.classList.contains('is-open');
      if (was === open) return;
      drawer.classList.toggle('is-open', open);
      if (overlay) overlay.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) drawer.removeAttribute('inert'); else drawer.setAttribute('inert', '');
      doc.body.style.overflow = open ? 'hidden' : '';
      if (open) { setTimeout(function () { if (closeBtn) closeBtn.focus(); }, 50); }
      else if (drawer.contains(doc.activeElement) || doc.activeElement === doc.body) { burger.focus({ preventScroll: true }); }
    };
    drawer.addEventListener('keydown', function (e) { trapTab(e, drawer); });
    burger.addEventListener('click', function () { setMenu(!drawer.classList.contains('is-open')); });
    if (overlay) overlay.addEventListener('click', function () { setMenu(false); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1220) setMenu(false); });
  });

  /* ---------- Lightbox (vast fotovlak, pijltjes, toetsenbord, teller) ---------- */
  var Lightbox = null;
  function buildLightbox() {
    var lb = $('.lightbox');
    if (!lb) {
      lb = doc.createElement('div');
      lb.className = 'lightbox';
      lb.hidden = true;
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.setAttribute('aria-label', 'Foto bekijken');
      lb.innerHTML =
        '<button type="button" class="lb-btn lb-close" aria-label="Sluiten">&times;</button>' +
        '<figure><div class="lb-stage"><div class="lb-frame"><img alt=""></div></div><figcaption></figcaption>' +
        '<div class="lb-nav">' +
        '<button type="button" class="lb-btn" data-dir="-1" aria-label="Vorige foto">&larr;</button>' +
        '<span class="lb-count" aria-live="polite"></span>' +
        '<button type="button" class="lb-btn" data-dir="1" aria-label="Volgende foto">&rarr;</button>' +
        '</div></figure>';
      doc.body.appendChild(lb);
    }
    var img = $('img', lb), frame = $('.lb-frame', lb), stage = $('.lb-stage', lb), cap = $('figcaption', lb), count = $('.lb-count', lb);
    var lastSize = null, renderToken = 0, list = [], current = 0, lastFocus = null, timer = null, swapTimer = null;

    function render(i, animate) {
      current = (i + list.length) % list.length;
      var it = list[current];
      var token = ++renderToken;
      clearTimeout(swapTimer);
      /* Kader op de juiste maat zetten zodra de foto bekend is (binnen het vaste podium) */
      var fit = function (w, h) {
        var sw = stage.clientWidth, sh = stage.clientHeight;
        if (!w || !h || !sw || !sh) { frame.style.width = ''; frame.style.height = ''; return; }
        var s = Math.min(sw / w, sh / h);
        frame.style.width = Math.round(w * s) + 'px';
        frame.style.height = Math.round(h * s) + 'px';
      };
      var pre = new Image();
      var show = function () {
        if (token !== renderToken) return;
        if (!animate) frame.style.transition = 'none';
        fit(pre.naturalWidth, pre.naturalHeight);
        lastSize = [pre.naturalWidth, pre.naturalHeight];
        img.src = it.src; img.alt = it.alt; cap.textContent = it.caption;
        if (!animate) { void frame.offsetWidth; frame.style.transition = ''; }
        /* buren alvast laden, dan is volgende/vorige direct klaar */
        [current + 1, current - 1].forEach(function (k) { var n = list[(k + list.length) % list.length]; if (n) { var p = new Image(); p.src = n.src; } });
      };
      /* oude foto blijft staan tot de nieuwe geladen en gedecodeerd is: geen leeg moment */
      var done = false;
      var go = function () { if (done) return; done = true; show(); };
      var ready = function () {
        if (pre.decode) { pre.decode().then(go, go); setTimeout(go, 120); }
        else go();
      };
      pre.onload = ready; pre.onerror = go;
      pre.src = it.src;
      if (pre.complete && pre.naturalWidth) { pre.onload = null; ready(); }
      count.textContent = list.length > 1 ? (current + 1) + ' van ' + list.length : '';
      lb.classList.toggle('is-single', list.length < 2);
    }
    function open(items, index) {
      if (!items.length) return;
      list = items;
      lastFocus = doc.activeElement;
      clearTimeout(timer);
      render(Math.max(0, index), false);
      lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add('is-open'); });
      doc.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    }
    function close() {
      if (lb.hidden) return;
      lb.classList.remove('is-open');
      doc.body.style.overflow = '';
      timer = setTimeout(function () { lb.hidden = true; img.removeAttribute('src'); }, reduce ? 0 : 300);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    $('.lb-close', lb).addEventListener('click', close);
    window.addEventListener('resize', function () {
      if (lb.hidden || !lastSize) return;
      var sw = stage.clientWidth, sh = stage.clientHeight, s = Math.min(sw / lastSize[0], sh / lastSize[1]);
      frame.style.width = Math.round(lastSize[0] * s) + 'px'; frame.style.height = Math.round(lastSize[1] * s) + 'px';
    });
    $$('[data-dir]', lb).forEach(function (b) {
      b.addEventListener('click', function () { if (list.length > 1) render(current + Number(b.getAttribute('data-dir')), true); });
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === stage || e.target.tagName === 'FIGURE') close(); });
    lb.addEventListener('keydown', function (e) { trapTab(e, lb); });
    /* Vegen op telefoon */
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null || list.length < 2) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) render(current + (dx < 0 ? 1 : -1), true);
    }, { passive: true });
    doc.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight' && list.length > 1) render(current + 1, true);
      else if (e.key === 'ArrowLeft' && list.length > 1) render(current - 1, true);
    });
    return { open: open, close: close, isOpen: function () { return !lb.hidden; } };
  }
  function itemFrom(el) {
    var im = $('img', el.closest('.shot') || el) || $('img', el);
    var fig = el.closest('figure');
    var fc = fig ? $('figcaption', fig) : null;
    return {
      el: el,
      src: el.getAttribute('data-full') || (im ? im.getAttribute('src') : ''),
      alt: im ? im.alt : '',
      caption: el.getAttribute('data-caption') || (fc ? fc.textContent.trim() : (im ? im.alt : ''))
    };
  }
  function lightbox() { if (!Lightbox) Lightbox = buildLightbox(); return Lightbox; }

  /* ---------- Fotogalerij: filters, meer laden, lightbox ---------- */
  safe('galerij', function () {
    $$('.gallery').forEach(function (gallery, gi) {
      var shots = $$('.shot', gallery);
      if (!shots.length) return;
      if (!gallery.id) gallery.id = 'galerij-' + (gi + 1);
      var limit = parseInt(gallery.getAttribute('data-limit'), 10) || 0;
      var shown = limit;
      var filterVal = 'alles';
      var filterBox = $('.filters[data-for="' + gallery.id + '"]');
      if (!filterBox) {
        var sec = gallery.closest('section') || doc;
        var cand = $('.filters:not([data-for])', sec);
        if (cand) filterBox = cand;
      }
      var chips = filterBox ? $$('.filter', filterBox) : [];
      var more = null, moreBtn = null, moreCount = null;

      function cats(s) { return (s.getAttribute('data-cat') || '').split(/\s+/); }
      function matches(s, f) { return f === 'alles' || cats(s).indexOf(f) > -1; }
      function inFilter() { return shots.filter(function (s) { return matches(s, filterVal); }); }

      if (limit) {
        more = doc.createElement('div');
        more.className = 'gallery-more';
        more.innerHTML = '<p class="gallery-more__count" aria-live="polite"></p><button type="button" class="btn btn--dark">Toon meer foto&#39;s</button>';
        gallery.parentNode.insertBefore(more, gallery.nextSibling);
        moreBtn = $('button', more);
        moreCount = $('.gallery-more__count', more);
      }

      /* Toont de juiste foto's; animate = zachte overgang */
      function apply(animate) {
        var set = inFilter();
        var visibleNow = shots.filter(function (s) { return !s.classList.contains('is-hidden'); });
        var target = set.filter(function (s, i) { return !limit || i < shown; });
        var leaving = visibleNow.filter(function (s) { return target.indexOf(s) === -1; });
        var entering = target.filter(function (s) { return s.classList.contains('is-hidden'); });

        function finish() {
          shots.forEach(function (s) {
            var on = target.indexOf(s) > -1;
            s.classList.remove('is-leaving');
            s.classList.toggle('is-hidden', !on);
          });
          (animate ? target : entering).forEach(function (s) {
            s.classList.add('is-visible');
            s.classList.remove('is-in');
            if (animate && !reduce) { void s.offsetWidth; s.classList.add('is-in'); }
          });
          if (more) {
            more.hidden = set.length <= shown;
            moreCount.textContent = Math.min(shown, set.length) + ' van ' + set.length + " foto's";
          }
        }
        if (animate && !reduce && leaving.length) {
          leaving.forEach(function (s) { s.classList.add('is-leaving'); });
          clearTimeout(gallery.__t);
          gallery.__t = setTimeout(finish, 200);
        } else finish();
      }

      if (chips.length) {
        if (filterBox.hasAttribute('data-counts')) {
          chips.forEach(function (c) {
            var f = c.getAttribute('data-filter');
            var n = shots.filter(function (s) { return matches(s, f); }).length;
            var span = doc.createElement('span');
            span.className = 'filter__n';
            span.textContent = n;
            c.appendChild(span);
          });
        }
        var startChip = chips.filter(function (c) { return c.classList.contains('is-active'); })[0];
        if (startChip) filterVal = startChip.getAttribute('data-filter');
        chips.forEach(function (btn) {
          btn.setAttribute('aria-pressed', btn.classList.contains('is-active') ? 'true' : 'false');
          btn.addEventListener('click', function () {
            var f = btn.getAttribute('data-filter');
            if (f === filterVal) return;
            filterVal = f;
            shown = limit;
            chips.forEach(function (b) { var on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
            apply(true);
          });
        });
      }
      if (moreBtn) moreBtn.addEventListener('click', function () {
        var before = inFilter().filter(function (s, i) { return i < shown; }).length;
        shown += limit;
        apply(false);
        var set = inFilter();
        set.slice(before, shown).forEach(function (s) {
          s.classList.add('is-visible');
          if (!reduce) { s.classList.remove('is-in'); void s.offsetWidth; s.classList.add('is-in'); }
        });
        var firstNew = set[before];
        if (firstNew) { var b = $('button', firstNew); if (b) b.focus({ preventScroll: true }); }
      });
      apply(false);

      /* Lightbox: bladert door de foto's die in het filter vallen */
      shots.forEach(function (s) {
        var b = $('button', s);
        if (!b) return;
        b.addEventListener('click', function () {
          var set = inFilter();
          lightbox().open(set.map(function (x) { return itemFrom($('button', x) || x); }), set.indexOf(s));
        });
      });
    });
  });

  /* ---------- Losse foto's openen in de lightbox: <button class="zoom" data-zoom="groep"> ---------- */
  safe('zoom', function () {
    var zooms = $$('[data-zoom]');
    zooms.forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var group = el.getAttribute('data-zoom') || '';
        var set = group ? zooms.filter(function (z) { return z.getAttribute('data-zoom') === group; }) : [el];
        lightbox().open(set.map(itemFrom), set.indexOf(el));
      });
    });
  });

  /* ---------- FAQ-accordeon (vloeiend open en dicht) ---------- */
  safe('faq', function () {
    $$('.faq__item').forEach(function (item) {
      var summary = $('summary', item);
      var body = $('.faq__body', item);
      if (!summary || !body) return;
      var anim = null, safety = null;
      function animate(from, to, done) {
        if (anim) { anim.onfinish = null; anim.cancel(); anim = null; }
        clearTimeout(safety);
        if (reduce || !body.animate) { done(); return; }
        var a = body.animate([{ height: from + 'px', opacity: from ? 1 : 0 }, { height: to + 'px', opacity: to ? 1 : 0 }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)' });
        anim = a;
        var finished = false;
        var end = function () {
          if (finished || anim !== a) return;
          finished = true; anim = null; clearTimeout(safety);
          a.cancel();
          done();
        };
        a.onfinish = end;
        /* Vangnet als de animatie niet afloopt (achtergrondtab, oude browser) */
        safety = setTimeout(end, 450);
      }
      function openItem() {
        var group = item.closest('.faq');
        if (group && group.hasAttribute('data-single')) {
          $$('.faq__item[open]', group).forEach(function (o) { if (o !== item && o.__close) o.__close(); });
        }
        var from = item.classList.contains('is-closing') ? body.offsetHeight : 0;
        item.classList.remove('is-closing');
        item.open = true;
        var h = body.scrollHeight;
        animate(from, h, function () {});
      }
      function closeItem() {
        var h = body.offsetHeight;
        item.classList.add('is-closing');
        animate(h, 0, function () { item.open = false; item.classList.remove('is-closing'); });
      }
      item.__close = closeItem;
      summary.addEventListener('click', function (e) {
        e.preventDefault();
        if (item.open && !item.classList.contains('is-closing')) closeItem(); else openItem();
      });
    });
  });

  /* ---------- Eigen keuzelijst (vervangt het standaard select-menu) ---------- */
  safe('dropdown', function () {
    var ddUid = 0;
    var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
    var params = null;
    try { params = new URLSearchParams(location.search); } catch (e) {}

    $$('.field select, select[data-dd]').forEach(function (sel) {
      if (sel.closest('.dd')) return;
      /* Voorselectie via de link, bijv. contact.html?soort=Trap#offerte */
      if (params && sel.name && params.get(sel.name)) {
        var want = params.get(sel.name).toLowerCase();
        Array.prototype.forEach.call(sel.options, function (o, i) {
          if ((o.value || o.text).toLowerCase() === want || o.text.toLowerCase() === want) sel.selectedIndex = i;
        });
      }
      var id = 'dd' + (++ddUid);
      var wrap = doc.createElement('div');
      wrap.className = 'dd';
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel);
      sel.tabIndex = -1;
      sel.setAttribute('aria-hidden', 'true');
      var label = sel.id ? $('label[for="' + sel.id + '"]') : null;
      if (label) label.id = label.id || id + '-label';

      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'dd__btn';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', id + '-list');
      if (label) btn.setAttribute('aria-labelledby', label.id + ' ' + id + '-val');
      btn.innerHTML = '<span id="' + id + '-val"></span>' + CHEV;
      var valEl = btn.firstChild;

      var list = doc.createElement('ul');
      list.className = 'dd__list';
      list.id = id + '-list';
      list.setAttribute('role', 'listbox');
      list.tabIndex = -1;
      if (label) list.setAttribute('aria-labelledby', label.id);

      var placeholder = '';
      var opts = [];
      Array.prototype.forEach.call(sel.options, function (o, i) {
        if (o.value === '' && i === 0) { placeholder = o.text; return; }
        var li = doc.createElement('li');
        li.className = 'dd__opt';
        li.id = id + '-o' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.dataset.index = i;
        li.innerHTML = '<span></span>' + TICK;
        li.firstChild.textContent = o.text;
        list.appendChild(li);
        opts.push(li);
      });
      wrap.insertBefore(btn, sel);
      wrap.appendChild(list);

      var active = -1;
      function sync() {
        var o = sel.options[sel.selectedIndex];
        var empty = !o || o.value === '';
        valEl.textContent = empty ? placeholder : o.text;
        btn.classList.toggle('is-placeholder', empty);
        opts.forEach(function (li) { li.setAttribute('aria-selected', String(+li.dataset.index === sel.selectedIndex)); });
      }
      function setActive(n) {
        if (!opts.length) return;
        active = (n + opts.length) % opts.length;
        opts.forEach(function (li, k) { li.classList.toggle('is-active', k === active); });
        list.setAttribute('aria-activedescendant', opts[active].id);
        var li = opts[active];
        if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 6;
        else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 6;
      }
      function open() {
        if (wrap.classList.contains('is-open')) return;
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        var cur = -1;
        opts.forEach(function (li, k) { if (+li.dataset.index === sel.selectedIndex) cur = k; });
        setActive(cur < 0 ? 0 : cur);
        list.focus({ preventScroll: true });
        /* lijst helemaal in beeld schuiven, ook boven de mobiele belbalk */
        try {
          var bottom = btn.getBoundingClientRect().bottom + list.offsetHeight + 12;
          var bar = $('.mobilebar');
          var bh = bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight + 12 : 12;
          if (bottom > window.innerHeight - bh) window.scrollBy({ top: bottom - window.innerHeight + bh, behavior: reduce ? 'auto' : 'smooth' });
        } catch (e) {}
      }
      function close(focusBtn) {
        if (!wrap.classList.contains('is-open')) return;
        wrap.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        opts.forEach(function (li) { li.classList.remove('is-active'); });
        if (focusBtn) btn.focus({ preventScroll: true });
      }
      function choose(k) {
        sel.selectedIndex = +opts[k].dataset.index;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
        close(true);
      }

      btn.addEventListener('click', function () { if (wrap.classList.contains('is-open')) close(true); else open(); });
      btn.addEventListener('keydown', function (e) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].indexOf(e.key) > -1) { e.preventDefault(); open(); }
      });
      list.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (active > -1) choose(active); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
        else if (e.key === 'Tab') { close(false); }
        else if (e.key.length === 1) {
          var ch = e.key.toLowerCase();
          for (var s = 1; s <= opts.length; s++) {
            var k = (active + s) % opts.length;
            if (opts[k].textContent.trim().toLowerCase().indexOf(ch) === 0) { setActive(k); break; }
          }
        }
      });
      opts.forEach(function (li, k) {
        li.addEventListener('mousemove', function () { if (active !== k) setActive(k); });
        li.addEventListener('click', function () { choose(k); });
      });
      doc.addEventListener('pointerdown', function (e) { if (!wrap.contains(e.target)) close(false); });
      list.addEventListener('focusout', function (e) { if (!wrap.contains(e.relatedTarget)) close(false); });
      /* Label-klik en foutmelding-focus gaan naar de nieuwe knop */
      sel.addEventListener('focus', function () { btn.focus(); });
      if (label) label.addEventListener('click', function (e) { e.preventDefault(); btn.focus(); });
      sel.addEventListener('change', sync);
      sync();
    });
  });

  /* ---------- Formuliervalidatie (demo, er wordt niets verzonden) ---------- */
  safe('formulier', function () {
    $$('form[data-validate]').forEach(function (form) {
      var notice = $('.notice', form);
      var fields = $$('input, select, textarea', form).filter(function (el) {
        return el.type !== 'submit' && el.type !== 'button' && el.type !== 'hidden';
      });
      function errEl(el) {
        var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/);
        for (var i = 0; i < ids.length; i++) {
          var e = ids[i] && doc.getElementById(ids[i]);
          if (e && e.classList.contains('error')) return e;
        }
        var f = el.closest('.field');
        return f ? $('.error', f) : null;
      }
      function message(el) {
        var v = el.type === 'checkbox' ? el.checked : (el.value || '').trim();
        var custom = el.getAttribute('data-msg');
        if (el.required && !v) {
          if (custom) return custom;
          if (el.type === 'checkbox') return 'Geef toestemming om verder te gaan.';
          if (el.tagName === 'SELECT') return 'Maak een keuze.';
          if (el.type === 'email') return 'Vul uw e-mailadres in.';
          return 'Dit veld is verplicht.';
        }
        if (v && el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Vul een geldig e-mailadres in.';
        if (v && el.type === 'tel' && (!/^[0-9+()\-\s]+$/.test(v) || v.replace(/\D/g, '').length < 10)) return 'Vul een geldig telefoonnummer in.';
        if (el.type === 'file' && el.files && el.files[0] && el.getAttribute('data-max-mb')) {
          var max = parseFloat(el.getAttribute('data-max-mb'));
          if (el.files[0].size > max * 1024 * 1024) return 'Het bestand is te groot (maximaal ' + max + ' MB).';
        }
        return '';
      }
      function mark(el, msg) {
        var e = errEl(el);
        if (e) e.textContent = msg;
        var f = el.closest('.field');
        if (f) f.classList.toggle('has-error', !!msg);
        el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      }
      fields.forEach(function (el) {
        var evt = (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'file') ? 'change' : 'input';
        el.addEventListener(evt, function () {
          var f = el.closest('.field');
          if (f && f.classList.contains('has-error')) mark(el, message(el));
        });
        if (el.type === 'email' || el.type === 'tel') el.addEventListener('blur', function () { if (el.value.trim()) mark(el, message(el)); });
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var first = null;
        fields.forEach(function (el) {
          var msg = message(el);
          mark(el, msg);
          if (msg && !first) first = el;
        });
        if (notice) notice.classList.remove('is-shown');
        if (first) { first.focus(); return; }
        if (notice) { void notice.offsetWidth; notice.classList.add('is-shown'); }
      });
    });
  });

  /* ---------- Escape sluit het menu ---------- */
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !(Lightbox && Lightbox.isOpen())) setMenu(false);
  });

  /* Laatste vangnet: als er toch iets misging, alles tonen */
  setTimeout(function () {
    if (!$('.reveal.is-visible') && $$('.reveal').length) showAllReveals();
  }, 3000);
})();
