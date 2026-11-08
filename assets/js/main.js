/* ==========================================================================
   The Sticky Kind — site behaviour
   Cart (localStorage), cart drawer, nav, countdown, cookie banner, toasts.
   Exposes window.TSK for checkout.js.
   ========================================================================== */
(function () {
  "use strict";
  const C = window.STICKY;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const money = (cents) =>
    new Intl.NumberFormat(C.locale, { style: "currency", currency: C.currency }).format(cents / 100);

  const catalog = {};
  Object.entries(C.products).forEach(([id, p]) => (catalog[id] = { id, type: "product", ...p }));
  Object.entries(C.plans).forEach(([id, p]) => (catalog[id] = { id, type: "plan", ...p }));

  /* ---- Cart ------------------------------------------------------------ */
  const KEY = "tsk_cart_v1";
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  const Cart = {
    items() {
      return store.get(KEY, []).filter((i) => catalog[i.id] && i.qty > 0);
    },
    save(items) {
      store.set(KEY, items);
      document.dispatchEvent(new CustomEvent("cart:change"));
    },
    add(id, qty = 1) {
      const item = catalog[id];
      if (!item) return;
      let items = this.items();
      if (item.type === "plan") {
        // One membership per order — a new plan replaces the old one.
        items = items.filter((i) => catalog[i.id].type !== "plan");
        items.unshift({ id, qty: 1 });
      } else {
        const found = items.find((i) => i.id === id);
        if (found) found.qty = Math.min(found.qty + qty, 20);
        else items.push({ id, qty });
      }
      this.save(items);
    },
    setQty(id, qty) {
      let items = this.items();
      if (qty <= 0) items = items.filter((i) => i.id !== id);
      else items = items.map((i) => (i.id === id ? { ...i, qty: Math.min(qty, 20) } : i));
      this.save(items);
    },
    remove(id) { this.setQty(id, 0); },
    clear() { this.save([]); },
    count() { return this.items().reduce((n, i) => n + i.qty, 0); },
    lines() {
      return this.items().map((i) => ({ ...catalog[i.id], qty: i.qty, total: catalog[i.id].price * i.qty }));
    },
    plan() { return this.lines().find((l) => l.type === "plan") || null; },
    totals(region = "US") {
      const lines = this.lines();
      const plan = lines.find((l) => l.type === "plan");
      const productsSubtotal = lines.filter((l) => l.type === "product").reduce((s, l) => s + l.total, 0);
      const subtotal = lines.reduce((s, l) => s + l.total, 0);
      const r = C.shipping.regions[region] || C.shipping.regions.US;
      let shipping = 0;
      if (productsSubtotal > 0 && !(plan && C.shipping.freeWithClub)) {
        shipping = productsSubtotal >= r.freeOver ? 0 : r.flat;
      }
      return { lines, plan, subtotal, productsSubtotal, shipping, total: subtotal + shipping, region: r };
    },
  };

  /* ---- Toast ----------------------------------------------------------- */
  let toastTimer;
  function toast(msg, img) {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.innerHTML = (img ? `<img src="${img}" alt="">` : "") + `<span></span>`;
    t.querySelector("span").textContent = msg;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---- Cart drawer ----------------------------------------------------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function lineHTML(l, { compact = false } = {}) {
    const meta = l.type === "plan"
      ? `Renews every ${esc(l.interval)} · cancel anytime`
      : `${money(l.price)} each`;
    const controls = l.type === "plan"
      ? `<button class="line-remove" data-remove="${l.id}">Remove</button>`
      : `<div class="qty" role="group" aria-label="Quantity for ${esc(l.name)}">
           <button type="button" data-qty="${l.id}" data-delta="-1" aria-label="Decrease">−</button>
           <span aria-live="polite">${l.qty}</span>
           <button type="button" data-qty="${l.id}" data-delta="1" aria-label="Increase">+</button>
         </div>`;
    return `<div class="line">
      <div class="line-img"><img src="${l.img}" alt=""></div>
      <div>
        <div class="line-name">${esc(l.name)}</div>
        <div class="line-meta">${meta}</div>
        ${compact ? (l.type === "plan" ? "" : `<div class="line-meta">Qty ${l.qty}</div>`) : controls}
      </div>
      <div class="line-price">${money(l.total)}${l.type === "plan" ? `<div class="line-meta">/${esc(l.interval)}</div>` : ""}</div>
    </div>`;
  }

  function renderDrawer() {
    const body = $("[data-cart-body]");
    const foot = $("[data-cart-foot]");
    if (!body) return;
    const t = Cart.totals();
    if (!t.lines.length) {
      body.innerHTML = `<div class="drawer-empty">
        <img class="stk" src="assets/img/stickers/cinnamon.png" alt="" style="--r:-6deg">
        <h3>Your bag is empty</h3>
        <p class="muted">Nothing sticky in here yet.</p>
        <div class="btn-row" style="justify-content:center">
          <a class="btn btn-sm" href="club.html">Join the club</a>
          <a class="btn btn-sm btn-ghost" href="shop.html">Shop singles</a>
        </div></div>`;
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    body.innerHTML = t.lines.map((l) => lineHTML(l)).join("") +
      (t.plan ? "" : `<div class="drawer-upsell">✶ <strong>Club members</strong> get a new themed sheet every month and free shipping. <a href="club.html">Join from $8/mo →</a></div>`);
    $("[data-cart-subtotal]").textContent = money(t.subtotal);
    $("[data-cart-note]").textContent = t.plan
      ? "Everything ships free with your first club sheet."
      : t.productsSubtotal >= C.shipping.regions.US.freeOver
        ? "You've unlocked free US shipping!"
        : `Free US shipping over ${money(C.shipping.regions.US.freeOver)}. Taxes & shipping at checkout.`;
  }

  function renderCount() {
    const n = Cart.count();
    $$("[data-cart-count]").forEach((el) => {
      el.textContent = n;
      el.dataset.empty = n === 0 ? "true" : "false";
    });
  }

  let lastFocus;
  function openDrawer() {
    lastFocus = document.activeElement;
    renderDrawer();
    $(".drawer")?.classList.add("open");
    $(".overlay")?.classList.add("open");
    $(".drawer")?.setAttribute("aria-hidden", "false");
    setTimeout(() => $(".drawer [data-cart-close]")?.focus(), 50);
  }
  function closeDrawer() {
    $(".drawer")?.classList.remove("open");
    $(".overlay")?.classList.remove("open");
    $(".drawer")?.setAttribute("aria-hidden", "true");
    lastFocus?.focus?.();
  }

  /* ---- Global click handling ------------------------------------------ */
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      e.preventDefault();
      const id = add.dataset.add;
      const item = catalog[id];
      if (!item) return;
      Cart.add(id);
      if (add.dataset.go === "checkout") {
        window.location.href = "checkout.html";
        return;
      }
      add.classList.add("added");
      setTimeout(() => add.classList.remove("added"), 900);
      const c = $("[data-cart-count]");
      if (c) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
      toast(item.type === "plan" ? "Club membership added ✶" : `${item.name} added to your bag`, item.img);
      if (add.dataset.open !== "false") setTimeout(openDrawer, 250);
      return;
    }
    if (e.target.closest("[data-cart-open]")) { e.preventDefault(); openDrawer(); return; }
    if (e.target.closest("[data-cart-close]") || e.target.classList.contains("overlay")) { closeDrawer(); return; }
    const q = e.target.closest("[data-qty]");
    if (q) {
      const id = q.dataset.qty;
      const cur = Cart.items().find((i) => i.id === id);
      Cart.setQty(id, (cur ? cur.qty : 0) + Number(q.dataset.delta));
      return;
    }
    const rm = e.target.closest("[data-remove]");
    if (rm) { Cart.remove(rm.dataset.remove); return; }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($(".drawer.open")) closeDrawer();
      if ($(".nav.open")) toggleNav(false);
    }
  });

  document.addEventListener("cart:change", () => {
    renderCount();
    if ($(".drawer.open")) renderDrawer();
  });
  // keep tabs in sync
  window.addEventListener("storage", (e) => { if (e.key === KEY) document.dispatchEvent(new CustomEvent("cart:change")); });

  /* ---- Mobile nav ----------------------------------------------------- */
  const menuBtn = $(".menu-btn");
  const nav = $("#site-nav");
  function toggleNav(force) {
    if (!nav || !menuBtn) return;
    const open = force ?? !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("nav-open", open);
  }
  menuBtn?.addEventListener("click", () => toggleNav());
  nav?.addEventListener("click", (e) => { if (e.target.closest("a")) toggleNav(false); });

  // Current page highlight
  const page = document.body.dataset.page;
  $$(`[data-nav="${page}"]`).forEach((a) => a.setAttribute("aria-current", "page"));

  // Header shadow on scroll
  const header = $(".site-header");
  const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Countdown ------------------------------------------------------ */
  const cutoff = new Date(C.drop.cutoff).getTime();
  function tick() {
    const left = cutoff - Date.now();
    $$("[data-countdown]").forEach((el) => {
      if (left <= 0) { el.textContent = "Next month's sheet is open"; return; }
      const d = Math.floor(left / 864e5);
      const h = Math.floor((left % 864e5) / 36e5);
      const m = Math.floor((left % 36e5) / 6e4);
      const s = Math.floor((left % 6e4) / 1e3);
      el.textContent = d > 0 ? `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    });
  }
  if ($("[data-countdown]")) { tick(); setInterval(tick, 1000); }

  // Fill money placeholders from config: <span data-price="club-monthly"></span>
  $$("[data-price]").forEach((el) => {
    const item = catalog[el.dataset.price];
    if (item) el.textContent = money(el.dataset.per === "month" ? item.perMonth : item.price);
  });

  /* ---- Shop filters --------------------------------------------------- */
  const chips = $$("[data-filter]");
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      $$("[data-tags]").forEach((card) => {
        card.hidden = f !== "all" && !card.dataset.tags.split(" ").includes(f);
      });
    })
  );

  /* ---- Sticky mobile CTA --------------------------------------------- */
  const mcta = $(".mobile-cta");
  if (mcta) {
    document.body.classList.add("has-mobile-cta");
    // Show once the hero CTA has scrolled away; hide while a section that
    // already has its own buttons ([data-cta-hide]) is on screen.
    const trigger = $("[data-cta-trigger]");
    const hiders = $$("[data-cta-hide]");
    if (trigger && "IntersectionObserver" in window) {
      let past = false;
      const covering = new Set();
      const update = () => mcta.classList.toggle("show", past && covering.size === 0);
      new IntersectionObserver(([en]) => { past = !en.isIntersecting && en.boundingClientRect.top < 0; update(); }).observe(trigger);
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => (en.isIntersecting ? covering.add(en.target) : covering.delete(en.target)));
        update();
      });
      hiders.forEach((h) => io.observe(h));
    } else mcta.classList.add("show");
  }

  /* ---- Forms (newsletter / contact) — placeholders ------------------- */
  $$("form[data-newsletter]").forEach((f) =>
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      // TODO: send to your email provider (Mailchimp, ConvertKit, Klaviyo…)
      f.reset();
      toast("You're on the list — see you next drop ✶");
    })
  );
  $$("form[data-contact]").forEach((f) =>
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      // TODO: wire to Formspree / Netlify Forms / your inbox.
      f.reset();
      toast("Thanks! We'll write back within 2 business days.");
    })
  );

  /* ---- Cookie banner -------------------------------------------------- */
  const CONSENT = "tsk_consent_v1";
  const cookie = $(".cookie");
  if (cookie) {
    if (!store.get(CONSENT, null)) cookie.hidden = false;
    cookie.addEventListener("click", (e) => {
      const b = e.target.closest("[data-consent]");
      if (!b) return;
      store.set(CONSENT, { analytics: b.dataset.consent === "all", at: new Date().toISOString() });
      cookie.hidden = true;
      // TODO: if analytics === true, load your analytics script here.
    });
  }
  $$("[data-cookie-settings]").forEach((b) => b.addEventListener("click", () => { if (cookie) cookie.hidden = false; }));

  /* ---- Reveal on scroll ---------------------------------------------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach((el) => io.observe(el));
  } else $$(".reveal").forEach((el) => el.classList.add("in"));

  // Point every "manage membership" link at the Stripe customer portal.
  $$("[data-portal]").forEach((a) => (a.href = C.stripe.customerPortalUrl));

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  renderCount();
  window.TSK = { Cart, money, catalog, toast, lineHTML, esc };
})();
