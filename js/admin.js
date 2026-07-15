/* VEX Filter Admin — CRUD + upload
 * Chế độ lưu (ưu tiên):
 * 1) Local admin-server.py  → ghi file máy
 * 2) GitHub API             → host GitHub Pages mãi mãi, thêm SP online
 * 3) Tải file JSON          → fallback
 */
(function () {
  const STORAGE_PIN = "vex_admin_pin";
  const STORAGE_GH = "vex_github_cfg";

  const state = {
    pin: sessionStorage.getItem(STORAGE_PIN) || "",
    writeMode: false, // local python server
    githubMode: false,
    products: [],
    categories: [],
    site: null,
    editingId: null,
    gallery: [],
    imagePath: "",
    github: loadGithubCfg(),
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function loadGithubCfg() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_GH) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveGithubCfg(cfg) {
    state.github = cfg;
    localStorage.setItem(STORAGE_GH, JSON.stringify(cfg));
    refreshModes();
  }

  function toast(msg, type = "success") {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast show " + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 4000);
  }

  function formatPrice(n) {
    return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "₫";
  }

  function slugify(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  function makeId(slug) {
    return "vex-" + (slug || "item").replace(/^loc-gio-/, "").replace(/[^a-z0-9-]/g, "").slice(0, 40);
  }

  function canWrite() {
    return state.writeMode || state.githubMode;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Local API ───────────────────────────────────────────
  async function api(path, options = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {},
      state.pin ? { "X-Admin-Pin": state.pin } : {}
    );
    const res = await fetch(path, { ...options, headers });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = { ok: false, error: "Phản hồi không phải JSON" };
    }
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ─── GitHub Contents API ─────────────────────────────────
  function ghReady() {
    const g = state.github || {};
    return !!(g.token && g.owner && g.repo);
  }

  function ghHeaders() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + state.github.token,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  function ghContentUrl(path) {
    const g = state.github;
    const branch = g.branch || "main";
    const clean = path.replace(/^\/+/, "");
    return `https://api.github.com/repos/${g.owner}/${g.repo}/contents/${clean}?ref=${encodeURIComponent(branch)}`;
  }

  function ghPutUrl(path) {
    const g = state.github;
    const clean = path.replace(/^\/+/, "");
    return `https://api.github.com/repos/${g.owner}/${g.repo}/contents/${clean}`;
  }

  function toBase64Utf8(str) {
    // UTF-8 safe base64
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  function dataUrlToBase64(dataUrl) {
    const i = dataUrl.indexOf(",");
    return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  }

  async function ghGetSha(path) {
    const res = await fetch(ghContentUrl(path), { headers: ghHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) {
      const t = await res.text();
      throw new Error("GitHub GET " + path + ": " + res.status + " " + t.slice(0, 200));
    }
    const j = await res.json();
    return j.sha || null;
  }

  async function ghPutFile(path, contentBase64, message) {
    const sha = await ghGetSha(path);
    const body = {
      message: message || `chore(admin): update ${path}`,
      content: contentBase64,
      branch: state.github.branch || "main",
    };
    if (sha) body.sha = sha;

    const res = await fetch(ghPutUrl(path), {
      method: "PUT",
      headers: ghHeaders(),
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j.message || "GitHub PUT failed " + res.status);
    }
    return j;
  }

  async function ghPutJSON(path, data, message) {
    const text = JSON.stringify(data, null, 2) + "\n";
    return ghPutFile(path, toBase64Utf8(text), message);
  }

  async function ghUploadImage(file, dataUrl) {
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const name = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, "")) || "img"}.${ext}`;
    const path = `public/images/uploads/${name}`;
    const b64 = dataUrlToBase64(dataUrl);
    await ghPutFile(path, b64, `feat(admin): upload image ${name}`);
    return path;
  }

  async function testGithub() {
    if (!ghReady()) throw new Error("Chưa đủ Owner / Repo / Token");
    const res = await fetch(
      `https://api.github.com/repos/${state.github.owner}/${state.github.repo}`,
      { headers: ghHeaders() }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || "Không truy cập được repo (kiểm tra token + quyền Contents: Write)");
    }
    const repo = await res.json();
    return repo.full_name;
  }

  // ─── Unified save ────────────────────────────────────────
  async function persistJSON(key, data, message) {
    // key: products | categories | site
    const path = `data/${key}.json`;

    if (state.writeMode) {
      await api(`/api/${key}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return { mode: "local", path };
    }

    if (state.githubMode) {
      await ghPutJSON(path, data, message || `chore(admin): update ${path}`);
      return { mode: "github", path };
    }

    downloadJSON(data, `${key}.json`);
    return { mode: "download", path };
  }

  async function persistImage(file) {
    if (!file) throw new Error("Chưa chọn file");
    if (!file.type.startsWith("image/")) throw new Error("Chỉ nhận file ảnh");
    if (file.size > 5 * 1024 * 1024) throw new Error("Ảnh tối đa 5MB (GitHub API ổn định hơn)");

    const dataUrl = await readAsDataURL(file);

    if (state.writeMode) {
      const res = await api("/api/upload", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      return res.path;
    }

    if (state.githubMode) {
      toast("Đang upload ảnh lên GitHub…");
      return ghUploadImage(file, dataUrl);
    }

    throw Object.assign(new Error("NO_WRITE"), {
      previewUrl: URL.createObjectURL(file),
    });
  }

  async function checkWriteMode() {
    state.writeMode = false;
    try {
      const h = await fetch("/api/health");
      if (h.ok) {
        const j = await h.json();
        state.writeMode = !!j.write;
      }
    } catch {
      state.writeMode = false;
    }
    refreshModes();
  }

  function refreshModes() {
    state.githubMode = !state.writeMode && ghReady();
    updateModeBadge();
    fillGithubForm();
  }

  function updateModeBadge() {
    const el = $("#modeBadge");
    if (!el) return;
    if (state.writeMode) {
      el.innerHTML =
        '<span class="ok">● Local server</span><br>Ghi file máy (admin-server.py).';
    } else if (state.githubMode) {
      el.innerHTML = `<span class="ok">● GitHub online</span><br>Lưu vào <code>${escapeHtml(
        state.github.owner
      )}/${escapeHtml(state.github.repo)}</code> — Pages cập nhật ~1–2 phút.`;
    } else {
      el.innerHTML =
        '<span class="warn">● Chưa bật lưu online</span><br>Vào <strong>Cài đặt</strong> → điền GitHub Token để thêm SP mãi mãi trên Pages.';
    }
  }

  async function loadData() {
    const bust = "?t=" + Date.now();
    const [products, categories, site] = await Promise.all([
      fetch("data/products.json" + bust).then((r) => r.json()),
      fetch("data/categories.json" + bust).then((r) => r.json()),
      fetch("data/site.json" + bust).then((r) => r.json()),
    ]);
    state.products = products;
    state.categories = categories;
    state.site = site;

    // Prefill github owner/repo from site if localStorage empty
    if (!state.github.owner && site.github?.owner) {
      state.github = {
        ...state.github,
        owner: site.github.owner,
        repo: site.github.repo || "",
        branch: site.github.branch || "main",
      };
    }

    fillCategorySelects();
    renderProductTable();
    renderCategoryList();
    fillSiteForm();
    fillGithubForm();
    refreshModes();
  }

  function fillCategorySelects() {
    const sel = $("#fCategory");
    if (!sel) return;
    sel.innerHTML = state.categories
      .map((c) => `<option value="${c.id}">${c.icon || ""} ${c.name}</option>`)
      .join("");
  }

  function renderProductTable() {
    const tbody = $("#productTableBody");
    if (!tbody) return;
    if (!state.products.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Chưa có sản phẩm. Bấm «Thêm sản phẩm».</td></tr>`;
      return;
    }
    tbody.innerHTML = state.products
      .map((p) => {
        const img = p.image || "public/images/product-hero.png";
        return `<tr data-id="${p.id}">
          <td><img class="thumb" src="${img}" alt="" onerror="this.style.opacity=.3"></td>
          <td>
            <strong>${escapeHtml(p.shortName || p.name)}</strong><br>
            <span class="badge-soft">${escapeHtml(p.sku || "")}</span>
            ${p.badge ? ` <span class="badge-soft">${escapeHtml(p.badge)}</span>` : ""}
          </td>
          <td>${escapeHtml(p.vehicle || "—")}<br><small>${escapeHtml(p.category || "")}</small></td>
          <td>${formatPrice(p.price)}</td>
          <td>${p.inStock !== false ? "✅" : "❌"}</td>
          <td class="actions">
            <button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}">Sửa</button>
            <button type="button" class="btn btn-danger btn-sm" data-del="${p.id}">Xóa</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  function showPanel(name) {
    $$(".admin-panel").forEach((p) => p.classList.remove("active"));
    $$(".nav-item").forEach((n) => n.classList.remove("active"));
    const panel = $(`#panel-${name}`);
    const nav = $(`.nav-item[data-panel="${name}"]`);
    if (panel) panel.classList.add("active");
    if (nav) nav.classList.add("active");
    const titles = {
      products: "Sản phẩm",
      form: state.editingId ? "Sửa sản phẩm" : "Thêm sản phẩm",
      categories: "Danh mục",
      settings: "Cài đặt & GitHub",
    };
    $("#pageTitle").textContent = titles[name] || "Admin";
  }

  function resetForm() {
    state.editingId = null;
    state.gallery = [];
    state.imagePath = "";
    $("#productForm").reset();
    $("#fId").value = "";
    $("#fInStock").checked = true;
    $("#fSlug").dataset.locked = "";
    $("#imagePreview").innerHTML = "<span>Chưa có ảnh</span>";
    $("#galleryList").innerHTML = "";
    $("#fFeatures").value =
      "Lọc bụi mịn PM2.5\nThan hoạt tính khử mùi\n3 lớp tiêu chuẩn\nLắp vừa khung xe\nĐộ bền ~15.000 km\nKhông giảm lưu lượng gió";
    $("#fSpecs").value =
      "Lớp lọc: 3 lớp + than hoạt tính\nVật liệu: Giấy lọc + than gáo dừa\nTương thích: VinFast\nTuổi thọ: ~15.000 km\nXuất xứ: VEX Automotive";
  }

  function fillForm(p) {
    state.editingId = p.id;
    state.imagePath = p.image || "";
    state.gallery = Array.isArray(p.gallery) ? [...p.gallery] : p.image ? [p.image] : [];
    $("#fId").value = p.id;
    $("#fName").value = p.name || "";
    $("#fShortName").value = p.shortName || "";
    $("#fSlug").value = p.slug || "";
    $("#fSku").value = p.sku || "";
    $("#fCategory").value = p.category || "vinfast";
    $("#fVehicle").value = p.vehicle || "";
    $("#fPrice").value = p.price ?? "";
    $("#fCompareAt").value = p.compareAt ?? "";
    $("#fBadge").value = p.badge || "";
    $("#fInStock").checked = p.inStock !== false;
    $("#fSummary").value = p.summary || "";
    $("#fDescription").value = p.description || "";
    $("#fTags").value = (p.tags || []).join(", ");
    $("#fFeatures").value = (p.features || []).join("\n");
    $("#fSpecs").value = Object.entries(p.specs || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    $("#fImagePath").value = p.image || "";
    renderImagePreview(p.image);
    renderGalleryChips();
  }

  function renderImagePreview(path) {
    const box = $("#imagePreview");
    if (!path) {
      box.innerHTML = "<span>Chưa có ảnh</span>";
      return;
    }
    box.innerHTML = `<img src="${path}" alt="preview">`;
  }

  function renderGalleryChips() {
    const list = $("#galleryList");
    list.innerHTML = state.gallery
      .map(
        (g, i) => `<div class="gallery-chip">
          <img src="${g}" alt="">
          <span title="${escapeHtml(g)}">${escapeHtml(String(g).split("/").pop())}</span>
          <button type="button" data-rm-gallery="${i}" title="Xóa">×</button>
        </div>`
      )
      .join("");
  }

  function parseFeatures(text) {
    return String(text || "")
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function parseSpecs(text) {
    const specs = {};
    String(text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return;
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) specs[k] = v;
      });
    return specs;
  }

  function parseTags(text) {
    return String(text || "")
      .split(/,|;/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  function collectFormProduct() {
    const slug = $("#fSlug").value.trim() || slugify($("#fName").value);
    const id = $("#fId").value.trim() || makeId(slug);
    const image =
      $("#fImagePath").value.trim() || state.imagePath || "public/images/product-hero.png";
    let gallery = state.gallery.length ? [...state.gallery] : [image];
    if (!gallery.includes(image)) gallery = [image, ...gallery];

    return {
      id,
      slug,
      sku: $("#fSku").value.trim() || "VEX-NEW",
      name: $("#fName").value.trim(),
      shortName: $("#fShortName").value.trim() || $("#fName").value.trim(),
      category: $("#fCategory").value,
      vehicle: $("#fVehicle").value.trim(),
      price: Number($("#fPrice").value) || 0,
      compareAt: Number($("#fCompareAt").value) || 0,
      badge: $("#fBadge").value.trim(),
      inStock: $("#fInStock").checked,
      image,
      gallery,
      summary: $("#fSummary").value.trim(),
      description: $("#fDescription").value.trim(),
      features: parseFeatures($("#fFeatures").value),
      specs: parseSpecs($("#fSpecs").value),
      tags: parseTags($("#fTags").value),
    };
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function saveProduct(e) {
    e.preventDefault();
    const product = collectFormProduct();
    if (!product.name) return toast("Nhập tên sản phẩm", "error");
    if (!product.price) return toast("Nhập giá bán", "error");
    if (product.image.startsWith("blob:") || product.image.startsWith("(")) {
      return toast("Chưa upload ảnh thành công. Bật GitHub trong Cài đặt hoặc dùng admin-server.", "error");
    }

    const idx = state.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) state.products[idx] = product;
    else state.products.push(product);

    try {
      const res = await persistJSON(
        "products",
        state.products,
        `feat(admin): ${idx >= 0 ? "update" : "add"} product ${product.sku}`
      );
      if (res.mode === "github") {
        toast("Đã lưu lên GitHub! Pages sẽ hiện SP mới sau ~1–2 phút.");
      } else if (res.mode === "local") {
        toast(idx >= 0 ? "Đã cập nhật (local)" : "Đã thêm sản phẩm (local)");
      } else {
        toast("Đã tải products.json — bật GitHub trong Cài đặt để lưu online");
      }
      renderProductTable();
      showPanel("products");
      resetForm();
    } catch (err) {
      toast(err.message || "Lưu thất bại", "error");
    }
  }

  async function deleteProduct(id) {
    if (!confirm("Xóa sản phẩm này?")) return;
    state.products = state.products.filter((p) => p.id !== id);
    try {
      const res = await persistJSON("products", state.products, `chore(admin): delete product ${id}`);
      toast(res.mode === "download" ? "Đã tải JSON sau xóa" : "Đã xóa sản phẩm");
      renderProductTable();
    } catch (err) {
      toast(err.message || "Xóa thất bại", "error");
    }
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderCategoryList() {
    const el = $("#categoryList");
    if (!el) return;
    el.innerHTML = state.categories
      .map(
        (c) => `<div class="admin-card" style="padding:0.9rem 1rem">
          <strong>${c.icon || ""} ${escapeHtml(c.name)}</strong>
          <div class="hint" style="color:var(--muted);font-size:0.9rem;margin-top:0.25rem">${escapeHtml(
            c.description || ""
          )}</div>
          <code style="font-size:0.8rem">id: ${escapeHtml(c.id)}</code>
        </div>`
      )
      .join("");
  }

  function fillSiteForm() {
    if (!state.site) return;
    if ($("#sPhone")) $("#sPhone").value = state.site.phone || "";
    if ($("#sZalo")) $("#sZalo").value = state.site.zalo || "";
    if ($("#sShopee")) $("#sShopee").value = state.site.shopee || "";
    if ($("#sEmail")) $("#sEmail").value = state.site.email || "";
    if ($("#sPin")) $("#sPin").value = state.site.adminPin || "";
  }

  function fillGithubForm() {
    const g = state.github || {};
    if ($("#ghOwner")) $("#ghOwner").value = g.owner || state.site?.github?.owner || "";
    if ($("#ghRepo")) $("#ghRepo").value = g.repo || state.site?.github?.repo || "";
    if ($("#ghBranch")) $("#ghBranch").value = g.branch || state.site?.github?.branch || "main";
    if ($("#ghToken")) $("#ghToken").value = g.token || "";
    const st = $("#ghStatus");
    if (st) {
      if (state.writeMode) st.textContent = "Đang dùng local server (ưu tiên hơn GitHub).";
      else if (ghReady()) st.innerHTML = '<span style="color:#065f46;font-weight:700">● Đã cấu hình GitHub — thêm SP online được</span>';
      else st.textContent = "Chưa đủ token/owner/repo — chưa lưu online được.";
    }
  }

  async function saveSite(e) {
    e.preventDefault();
    state.site = {
      ...state.site,
      phone: $("#sPhone").value.trim(),
      zalo: $("#sZalo").value.trim(),
      shopee: $("#sShopee").value.trim(),
      email: $("#sEmail").value.trim(),
      adminPin: $("#sPin").value.trim() || state.site.adminPin,
      github: {
        owner: ($("#ghOwner")?.value || "").trim(),
        repo: ($("#ghRepo")?.value || "").trim(),
        branch: ($("#ghBranch")?.value || "main").trim(),
      },
    };
    // strip token from site.json always
    try {
      const res = await persistJSON("site", state.site, "chore(admin): update site settings");
      if ($("#sPin").value.trim()) {
        state.pin = $("#sPin").value.trim();
        sessionStorage.setItem(STORAGE_PIN, state.pin);
      }
      toast(res.mode === "github" ? "Đã lưu cài đặt lên GitHub" : "Đã lưu cài đặt");
    } catch (err) {
      toast(err.message || "Lưu thất bại", "error");
    }
  }

  async function saveGithub(e) {
    e.preventDefault();
    const cfg = {
      owner: $("#ghOwner").value.trim(),
      repo: $("#ghRepo").value.trim(),
      branch: $("#ghBranch").value.trim() || "main",
      token: $("#ghToken").value.trim(),
    };
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      return toast("Điền đủ Owner, Repo và Token", "error");
    }
    saveGithubCfg(cfg);
    try {
      const name = await testGithub();
      toast("Kết nối OK: " + name + " — giờ thêm sản phẩm được online!");
      // also save owner/repo (no token) into site if possible
      if (state.site) {
        state.site.github = { owner: cfg.owner, repo: cfg.repo, branch: cfg.branch };
      }
    } catch (err) {
      toast(err.message || "Token/repo không hợp lệ", "error");
    }
  }

  async function saveCategory(e) {
    e.preventDefault();
    const id = slugify($("#cId").value || $("#cName").value);
    const cat = {
      id,
      slug: id,
      name: $("#cName").value.trim(),
      description: $("#cDesc").value.trim(),
      icon: $("#cIcon").value.trim() || "📦",
      order: state.categories.length + 1,
    };
    if (!cat.name) return toast("Nhập tên danh mục", "error");
    if (state.categories.some((c) => c.id === id)) return toast("ID danh mục đã tồn tại", "error");
    state.categories.push(cat);
    try {
      const res = await persistJSON("categories", state.categories, `feat(admin): add category ${id}`);
      toast(res.mode === "download" ? "Đã tải categories.json" : "Đã thêm danh mục");
      fillCategorySelects();
      renderCategoryList();
      $("#categoryForm").reset();
    } catch (err) {
      toast(err.message || "Lỗi", "error");
    }
  }

  function showApp() {
    $("#loginScreen").style.display = "none";
    $("#adminApp").style.display = "grid";
  }

  async function tryLogin(pin) {
    state.pin = pin;
    sessionStorage.setItem(STORAGE_PIN, pin);
    showApp();
    await checkWriteMode();
    await loadData();
    if (state.site?.adminPin && state.site.adminPin !== pin) {
      toast("PIN khác site.json — vẫn vào được; local server có thể chặn lưu", "error");
    } else if (!canWrite()) {
      toast("Đăng nhập OK. Vào Cài đặt → GitHub để bật thêm SP online (free mãi).");
    } else {
      toast("Đăng nhập thành công — sẵn sàng thêm sản phẩm");
    }
  }

  function bindEvents() {
    $("#loginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pin = $("#loginPin").value.trim();
      if (!pin) return toast("Nhập PIN", "error");
      await tryLogin(pin);
    });

    $$(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.dataset.panel;
        if (panel === "form" && !state.editingId) resetForm();
        showPanel(panel);
      });
    });

    $("#btnNewProduct")?.addEventListener("click", () => {
      resetForm();
      showPanel("form");
    });

    $("#btnExport")?.addEventListener("click", () => {
      downloadJSON(state.products, "products.json");
      toast("Đã tải products.json");
    });

    $("#productForm")?.addEventListener("submit", saveProduct);
    $("#btnCancelForm")?.addEventListener("click", () => {
      resetForm();
      showPanel("products");
    });

    $("#productTableBody")?.addEventListener("click", (e) => {
      const edit = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (edit) {
        const p = state.products.find((x) => x.id === edit.dataset.edit);
        if (p) {
          fillForm(p);
          showPanel("form");
        }
      }
      if (del) deleteProduct(del.dataset.del);
    });

    $("#fName")?.addEventListener("input", () => {
      if (state.editingId) return;
      if (!$("#fSlug").dataset.locked) {
        $("#fSlug").value = slugify($("#fName").value);
      }
    });
    $("#fSlug")?.addEventListener("input", () => {
      $("#fSlug").dataset.locked = "1";
    });

    const fileInput = $("#fImageFile");
    const drop = $("#dropzone");

    async function handleFiles(files) {
      const file = files?.[0];
      if (!file) return;
      try {
        const path = await persistImage(file);
        state.imagePath = path;
        $("#fImagePath").value = path;
        if (!state.gallery.includes(path)) state.gallery.unshift(path);
        renderImagePreview(path);
        renderGalleryChips();
        toast("Đã upload: " + path);
      } catch (err) {
        if (err.message === "NO_WRITE") {
          state.imagePath = err.previewUrl;
          $("#fImagePath").value = "(cần bật GitHub hoặc admin-server)";
          renderImagePreview(err.previewUrl);
          toast("Chưa bật lưu online. Vào Cài đặt → GitHub Token.", "error");
          showPanel("settings");
        } else {
          toast(err.message || "Upload lỗi", "error");
        }
      }
    }

    fileInput?.addEventListener("change", () => handleFiles(fileInput.files));
    drop?.addEventListener("click", () => fileInput?.click());
    drop?.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("dragover");
    });
    drop?.addEventListener("dragleave", () => drop.classList.remove("dragover"));
    drop?.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("dragover");
      handleFiles(e.dataTransfer.files);
    });

    $("#btnAddGallery")?.addEventListener("click", async () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.onchange = async () => {
        try {
          const path = await persistImage(inp.files[0]);
          if (!state.gallery.includes(path)) state.gallery.push(path);
          renderGalleryChips();
          toast("Đã thêm ảnh gallery");
        } catch (err) {
          toast(err.message === "NO_WRITE" ? "Cần bật GitHub trong Cài đặt" : err.message, "error");
        }
      };
      inp.click();
    });

    $("#galleryList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rm-gallery]");
      if (!btn) return;
      state.gallery.splice(Number(btn.dataset.rmGallery), 1);
      renderGalleryChips();
    });

    $("#siteForm")?.addEventListener("submit", saveSite);
    $("#githubForm")?.addEventListener("submit", saveGithub);
    $("#btnTestGithub")?.addEventListener("click", async () => {
      // pull current form values
      saveGithubCfg({
        owner: $("#ghOwner").value.trim(),
        repo: $("#ghRepo").value.trim(),
        branch: $("#ghBranch").value.trim() || "main",
        token: $("#ghToken").value.trim(),
      });
      try {
        const name = await testGithub();
        toast("OK — " + name);
      } catch (err) {
        toast(err.message, "error");
      }
    });
    $("#btnClearGithub")?.addEventListener("click", () => {
      if (!confirm("Xóa token GitHub khỏi trình duyệt này?")) return;
      localStorage.removeItem(STORAGE_GH);
      state.github = {};
      refreshModes();
      toast("Đã xóa cấu hình GitHub trên máy này");
    });
    $("#categoryForm")?.addEventListener("submit", saveCategory);

    $("#btnLogout")?.addEventListener("click", () => {
      sessionStorage.removeItem(STORAGE_PIN);
      location.reload();
    });
  }

  async function boot() {
    bindEvents();
    await checkWriteMode();
    const saved = sessionStorage.getItem(STORAGE_PIN);
    if (saved) await tryLogin(saved);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
