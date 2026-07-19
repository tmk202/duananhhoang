/* VEX Filter — static data helpers + UI */
const DATA_BASE = "data";

function formatPrice(n) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Không tải được " + path);
  return res.json();
}

async function loadAllData() {
  const [products, categories, site] = await Promise.all([
    loadJSON(`${DATA_BASE}/products.json`),
    loadJSON(`${DATA_BASE}/categories.json`),
    loadJSON(`${DATA_BASE}/site.json`),
  ]);
  return { products, categories, site };
}

function getQuery(name) {
  return new URLSearchParams(location.search).get(name);
}

function productCard(p, base = "") {
  const img = base + p.image;
  const badge = p.badge
    ? `<span class="badge${p.badge === "Tiết kiệm" ? " warn" : ""}">${p.badge}</span>`
    : "";
  return `
  <article class="product-card" data-category="${p.category}" data-vehicle="${p.vehicle}">
    <div class="thumb">
      ${badge}
      <img src="${img}" alt="${p.name}" loading="lazy" width="280" height="180">
    </div>
    <div class="product-body">
      <div class="vehicle-tag">${p.vehicle}</div>
      <h3><a href="${base}san-pham.html?slug=${encodeURIComponent(p.slug)}">${p.shortName}</a></h3>
      <p class="summary">${p.summary}</p>
      <div class="price-row">
        <span class="price">${formatPrice(p.price)}</span>
        ${p.compareAt ? `<span class="price-old">${formatPrice(p.compareAt)}</span>` : ""}
      </div>
      <div class="product-actions">
        <a class="btn btn-secondary" href="${base}san-pham.html?slug=${encodeURIComponent(p.slug)}">Chi tiết</a>
        <a class="btn btn-primary" href="#lien-he" data-zalo-product="${p.sku}">Đặt hàng</a>
      </div>
    </div>
  </article>`;
}

function initMobileNav() {
  const btn = qs("#menuBtn");
  const nav = qs("#mainNav");
  if (!btn || !nav) return;
  btn.addEventListener("click", () => {
    nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", nav.classList.contains("open"));
  });
  // close menu when a link is tapped
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

/** Sticky header shadow while scrolling */
function initHeaderScroll() {
  const header = qs(".header");
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/**
 * Scroll-reveal + stagger for landing cards.
 * Re-run after dynamic product grids render.
 */
let revealObserver = null;

function ensureRevealObserver() {
  if (revealObserver) return revealObserver;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  return revealObserver;
}

function observeReveal(el) {
  if (!el || el.dataset.revealObserved === "1") return;
  const obs = ensureRevealObserver();
  if (!obs) {
    el.classList.add("is-visible");
    return;
  }
  el.dataset.revealObserved = "1";
  obs.observe(el);
}

function markReveal(el, type = "", stagger = false) {
  if (!el) return;
  if (!el.hasAttribute("data-reveal")) {
    el.setAttribute("data-reveal", type);
  }
  if (stagger) el.setAttribute("data-stagger", "");
  observeReveal(el);
}

function initScrollReveal() {
  // Section heads & major blocks
  qsa(".section-head, .compare-wrap, .cta-band .container").forEach((el) =>
    markReveal(el)
  );
  qsa(".feature-split").forEach((split) => {
    [...split.children].forEach((el, i) =>
      markReveal(el, i % 2 === 0 ? "left" : "right")
    );
  });

  // Grids with staggered children
  [
    ".pain-grid",
    ".vehicle-grid",
    ".steps",
    ".quote-grid",
    ".faq-list",
  ].forEach((sel) => {
    qsa(sel).forEach((grid) => markReveal(grid, "", true));
  });

  // Standalone cards not in marked grids
  qsa(".pain-card, .vehicle-card, .step-card, .quote-card, .faq-item").forEach(
    (card) => {
      if (!card.closest("[data-stagger]")) markReveal(card);
    }
  );

  // Images under vehicle / compare sections
  qsa(".vehicles .center img, #so-sanh .center img").forEach((img) =>
    markReveal(img, "zoom")
  );
}

/** Call after product cards are injected into a grid */
function animateProductGrid(grid) {
  if (!grid) return;
  // restart card entrance by forcing reflow
  qsa(".product-card", grid).forEach((card, i) => {
    card.style.animation = "none";
    // eslint-disable-next-line no-unused-expressions
    card.offsetHeight;
    card.style.animation = "";
    card.style.animationDelay = `${0.04 + i * 0.06}s`;
  });
  markReveal(grid, "", false);
  grid.classList.add("is-visible");
}

function wireZaloCTAs(site) {
  const zalo = site?.zalo || "https://zalo.me/";
  qsa("[data-zalo], [data-zalo-product], [data-zalo-partner]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const sku = el.getAttribute("data-zalo-product");
      const isPartner = el.hasAttribute("data-zalo-partner");
      if (sku || isPartner) {
        e.preventDefault();
        const text = isPartner
          ? "Chào VEX, mình muốn hợp tác sỉ lọc gió (gara/xưởng độ). Tên xưởng: … · Khu vực: … · SL/tháng dự kiến: …"
          : `Chào shop, mình muốn tư vấn/đặt lọc gió VEX mã ${sku}. Xe mình là: `;
        window.open(zalo, "_blank", "noopener");
        try {
          navigator.clipboard?.writeText(text);
        } catch (_) {}
      }
    });
  });
  qsa("a[data-zalo]").forEach((a) => {
    if (!a.getAttribute("href") || a.getAttribute("href") === "#") {
      a.setAttribute("href", zalo);
    }
  });
}

function initCatalog(products, categories, site) {
  const grid = qs("#productGrid");
  const filters = qs("#categoryFilters");
  if (!grid) return;

  if (filters) {
    const allBtn = `<button type="button" class="filter-btn active" data-filter="all">Tất cả</button>`;
    const cats = categories
      .sort((a, b) => a.order - b.order)
      .map(
        (c) =>
          `<button type="button" class="filter-btn" data-filter="${c.id}">${c.name}</button>`
      )
      .join("");
    filters.innerHTML = allBtn + cats;
  }

  const render = (filter = "all") => {
    const list =
      filter === "all"
        ? products
        : products.filter((p) => p.category === filter);
    grid.innerHTML = list.map((p) => productCard(p)).join("") ||
      `<p class="muted center">Chưa có sản phẩm trong danh mục này.</p>`;
    wireZaloCTAs(site);
    animateProductGrid(grid);
  };

  render("all");

  filters?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    qsa(".filter-btn", filters).forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    render(btn.dataset.filter);
  });

  // vehicle deep-link: ?vehicle=VF3 or ?cat=vinfast
  const cat = getQuery("cat");
  const vehicle = getQuery("vehicle");
  if (cat) {
    const btn = qs(`.filter-btn[data-filter="${cat}"]`, filters);
    if (btn) btn.click();
  }
  if (vehicle) {
    const filtered = products.filter((p) =>
      p.vehicle.toLowerCase().includes(vehicle.toLowerCase())
    );
    if (filtered.length) {
      grid.innerHTML = filtered.map((p) => productCard(p)).join("");
      wireZaloCTAs(site);
      animateProductGrid(grid);
    }
  }
}

function initProductDetail(products, site) {
  const root = qs("#productDetail");
  if (!root) return;
  const slug = getQuery("slug");
  if (!slug) return;
  const p = products.find((x) => x.slug === slug);
  if (!p) {
    root.innerHTML = `<p>Không tìm thấy sản phẩm. <a href="san-pham.html">Quay lại danh mục</a></p>`;
    return;
  }

  document.title = `${p.name} | VEX Filter`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", p.summary);

  const gallery = p.gallery?.length ? p.gallery : [p.image];
  const specsRows = Object.entries(p.specs || {})
    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
    .join("");
  const features = (p.features || [])
    .map((f) => `<li>${f}</li>`)
    .join("");

  root.innerHTML = `
    <nav class="breadcrumb container">
      <a href="index.html">Trang chủ</a> ·
      <a href="san-pham.html">Sản phẩm</a> ·
      <span>${p.shortName}</span>
    </nav>
    <div class="container pd-layout">
      <div class="pd-gallery">
        <img class="main-img" id="mainImg" src="${gallery[0]}" alt="${p.name}" width="520" height="520">
        <div class="thumbs" id="thumbs">
          ${gallery
            .map(
              (g, i) =>
                `<button type="button" class="${i === 0 ? "active" : ""}" data-src="${g}"><img src="${g}" alt="Ảnh ${i + 1}"></button>`
            )
            .join("")}
        </div>
      </div>
      <div class="pd-info">
        <div class="pd-meta">
          <span class="chip">${p.vehicle}</span>
          <span class="chip">SKU: ${p.sku}</span>
          ${p.badge ? `<span class="chip">${p.badge}</span>` : ""}
          <span class="chip">${p.inStock ? "Còn hàng" : "Liên hệ"}</span>
        </div>
        <h1>${p.name}</h1>
        <div class="pd-price">
          <span class="price">${formatPrice(p.price)}</span>
          ${p.compareAt ? `<span class="price-old">${formatPrice(p.compareAt)}</span>` : ""}
        </div>
        <p class="pd-desc">${p.description}</p>
        <ul class="checklist">${features}</ul>
        <div class="pd-buy">
          <a class="btn btn-primary btn-lg btn-block" href="${site.zalo}" data-zalo-product="${p.sku}" target="_blank" rel="noopener">Tư vấn / Đặt qua Zalo</a>
          <a class="btn btn-secondary btn-block" href="${site.shopee}" target="_blank" rel="noopener">Mua trên Shopee</a>
          <p class="muted center mb-0" style="font-size:0.88rem">Gọi hotline: <strong>${site.phone}</strong> · Giao toàn quốc</p>
        </div>
        <table class="specs-table"><tbody>${specsRows}</tbody></table>
      </div>
    </div>`;

  const thumbs = qs("#thumbs");
  const main = qs("#mainImg");
  thumbs?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-src]");
    if (!btn) return;
    main.src = btn.dataset.src;
    qsa("button", thumbs).forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });

  wireZaloCTAs(site);
}

function initHomeProducts(products, site) {
  const grid = qs("#homeProducts");
  if (!grid) return;
  const featured = products.filter((p) => p.category === "vinfast").slice(0, 6);
  grid.innerHTML = featured.map((p) => productCard(p)).join("");
  wireZaloCTAs(site);
  animateProductGrid(grid);
}

function initSiteLinks(site) {
  qsa("[data-phone]").forEach((el) => {
    el.textContent = site.phone;
    if (el.tagName === "A") el.href = "tel:" + site.phone.replace(/\s/g, "");
  });
  qsa("a[data-zalo]").forEach((a) => {
    a.href = site.zalo;
  });
  qsa("a[data-messenger]").forEach((a) => {
    if (site.messenger) a.href = site.messenger;
  });
  qsa("a[data-shopee]").forEach((a) => {
    a.href = site.shopee;
  });
}

/** Floating contact icons — bottom-right (skip admin pages) */
function injectFloatContact(site = {}) {
  if (document.getElementById("floatContact")) return;
  if (/admin\.html/i.test(location.pathname)) return;

  const phone = (site.phone || "0983 047 842").replace(/\s/g, "");
  const phoneLabel = site.phone || "0983 047 842";
  const zalo = site.zalo || "https://zalo.me/0983047842";
  const messenger = site.messenger || "https://m.me/";
  const shopee = site.shopee || "https://shopee.vn/";

  const root = document.createElement("div");
  root.id = "floatContact";
  root.className = "float-contact";
  root.setAttribute("aria-label", "Liên hệ nhanh");
  root.innerHTML = `
    <div class="float-contact__list" id="floatContactList" hidden>
      <a class="float-btn float-btn--zalo" href="${zalo}" target="_blank" rel="noopener" data-zalo title="Chat Zalo">
        <span class="float-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="28" height="28" fill="none"><circle cx="24" cy="24" r="24" fill="#0068FF"/><path fill="#fff" d="M14.5 18.2c0-3.4 3.9-6.2 8.7-6.2s8.7 2.8 8.7 6.2-3.9 6.2-8.7 6.2c-.6 0-1.2 0-1.8-.1l-3.2 2v-2.6c-2.2-1.1-3.7-3-3.7-5.5zm4.2.3h1.7l2.1 2.8 2.1-2.8h1.7l-2.9 3.7v2.5h-1.8v-2.5l-2.9-3.7zm9.6 6.8c0 2.6-3.1 4.8-7 5.3l-.2 2.1 2.4-1.4c3.8-.2 6.8-2.5 6.8-5.4 0-1.3-.7-2.5-1.8-3.4.1.5.1.9.1 1.4 0 .5-.1.9-.3 1.4z"/></svg>
        </span>
        <span class="float-btn__label">Zalo</span>
      </a>
      <a class="float-btn float-btn--msg" href="${messenger}" target="_blank" rel="noopener" data-messenger title="Messenger">
        <span class="float-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="24" fill="#0084FF"/><path fill="#fff" d="M24 12.5c-6.9 0-12.5 5.2-12.5 11.6 0 3.6 1.8 6.9 4.7 9l.4 3.3 3.5-1.9c1.2.3 2.5.5 3.9.5 6.9 0 12.5-5.2 12.5-11.6S30.9 12.5 24 12.5zm1.3 15.6-3.2-3.4-6.2 3.4 6.8-7.2 3.3 3.4 6.1-3.4-6.8 7.2z"/></svg>
        </span>
        <span class="float-btn__label">Messenger</span>
      </a>
      <a class="float-btn float-btn--phone" href="tel:${phone}" title="Gọi ${phoneLabel}">
        <span class="float-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="24" fill="#22c55e"/><path fill="#fff" d="M31.8 28.4c-.5-.3-2.9-1.4-3.3-1.6-.5-.2-.8-.3-1.1.3-.3.5-1.3 1.6-1.6 1.9-.3.3-.6.4-1.1.1-.5-.3-2.1-.8-4-2.5-1.5-1.3-2.5-2.9-2.8-3.4-.3-.5 0-.7.2-1 .2-.2.5-.6.7-.9.2-.3.3-.5.4-.8.1-.3 0-.6 0-.8 0-.3-1.1-2.7-1.5-3.7-.4-1-.8-.8-1.1-.8h-.9c-.3 0-.8.1-1.2.6-.4.5-1.6 1.6-1.6 3.8s1.6 4.4 1.9 4.7c.2.3 3.2 4.9 7.7 6.8 1.1.5 1.9.7 2.6 1 .9.2 1.8.2 2.4.1.7-.1 2.9-1.2 3.3-2.3.4-1.1.4-2.1.3-2.3 0-.2-.4-.4-.9-.6z"/></svg>
        </span>
        <span class="float-btn__label">Gọi ngay</span>
      </a>
      <a class="float-btn float-btn--shopee" href="${shopee}" target="_blank" rel="noopener" data-shopee title="Shopee">
        <span class="float-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="28" height="28"><circle cx="24" cy="24" r="24" fill="#ee4d2d"/><path fill="#fff" d="M17 20.5h14v12.2c0 1.3-1 2.3-2.3 2.3H19.3c-1.3 0-2.3-1-2.3-2.3V20.5zm3.2-3.2c0-2.1 1.7-3.8 3.8-3.8s3.8 1.7 3.8 3.8v1.6h-2.1v-1.6c0-1-.8-1.7-1.7-1.7s-1.7.8-1.7 1.7v1.6h-2.1v-1.6z"/></svg>
        </span>
        <span class="float-btn__label">Shopee</span>
      </a>
    </div>
    <button type="button" class="float-contact__toggle" id="floatContactToggle" aria-expanded="false" aria-controls="floatContactList" title="Liên hệ">
      <span class="float-contact__toggle-open" aria-hidden="true">💬</span>
      <span class="float-contact__toggle-close" aria-hidden="true">✕</span>
      <span class="float-contact__pulse" aria-hidden="true"></span>
    </button>
  `;
  document.body.appendChild(root);

  const toggle = root.querySelector("#floatContactToggle");
  const list = root.querySelector("#floatContactList");
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    root.classList.toggle("is-open", !open);
    list.hidden = open;
  });
}

async function boot() {
  initMobileNav();
  initHeaderScroll();
  // Reveal static sections immediately (works even if data fetch fails)
  initScrollReveal();
  // Float bar with defaults first, then refresh links when site.json loads
  injectFloatContact();
  try {
    const { products, categories, site } = await loadAllData();
    window.VEX = { products, categories, site };
    initSiteLinks(site);
    // Rebuild float with real links from site.json
    document.getElementById("floatContact")?.remove();
    injectFloatContact(site);
    initHomeProducts(products, site);
    initCatalog(products, categories, site);
    initProductDetail(products, site);
    wireZaloCTAs(site);
  } catch (err) {
    console.error(err);
    const grid = qs("#productGrid") || qs("#homeProducts");
    if (grid) {
      grid.innerHTML = `<p class="muted">Không tải được dữ liệu sản phẩm. Hãy chạy bằng local server hoặc GitHub Pages (không mở file:// trực tiếp).</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", boot);
