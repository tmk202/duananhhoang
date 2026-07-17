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
  qsa("[data-zalo], [data-zalo-product]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const sku = el.getAttribute("data-zalo-product");
      if (sku) {
        e.preventDefault();
        const msg = encodeURIComponent(
          `Chào shop, mình muốn tư vấn/đặt lọc gió VEX mã ${sku}. Xe mình là: `
        );
        // Zalo web often ignores prefill; open zalo + copy helper
        window.open(zalo, "_blank", "noopener");
        try {
          navigator.clipboard?.writeText(
            `Chào shop, mình muốn tư vấn/đặt lọc gió VEX mã ${sku}. Xe mình là: `
          );
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

async function boot() {
  initMobileNav();
  initHeaderScroll();
  // Reveal static sections immediately (works even if data fetch fails)
  initScrollReveal();
  try {
    const { products, categories, site } = await loadAllData();
    window.VEX = { products, categories, site };
    initSiteLinks(site);
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
