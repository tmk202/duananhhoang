# Hướng dẫn host free mãi + thêm sản phẩm online

## Vì sao GitHub Pages “không thêm được SP”?

GitHub Pages chỉ **phục vụ file tĩnh** (HTML/CSS/JS/JSON/ảnh).  
Trình duyệt **không được phép ghi** thẳng lên server.

→ Admin của project dùng **GitHub API**: khi bạn bấm Lưu, trang gửi file lên repo (cần Token).  
Pages tự build lại → sản phẩm hiện sau **1–2 phút**.  
**Miễn phí, dùng lâu dài** (theo gói free GitHub).

---

## Bước 1 — Đẩy code lên GitHub

Trên máy (PowerShell, trong thư mục project):

```powershell
cd D:\CODE\duan-anhoang
git init
git add .
git commit -m "VEX Filter landing + admin"
```

Trên GitHub.com: **New repository** (ví dụ `vex-filter`), **không** tick README.

```powershell
git branch -M main
git remote add origin https://github.com/TEN-CUA-BAN/vex-filter.git
git push -u origin main
```

## Bước 2 — Bật GitHub Pages

Repo → **Settings** → **Pages**:

- Source: **Deploy from a branch**
- Branch: **main** / folder **/** (root)
- Save

Vài phút sau mở:

`https://TEN-CUA-BAN.github.io/vex-filter/`

Admin:

`https://TEN-CUA-BAN.github.io/vex-filter/admin.html`

## Bước 3 — Tạo Personal Access Token

1. GitHub → avatar → **Settings**
2. **Developer settings** → **Personal access tokens**
3. Chọn một:

### Fine-grained (khuyên dùng)

- Repository access: **Only select** → chọn repo `vex-filter`
- Permissions → **Contents**: **Read and write**
- Generate → **copy token** (chỉ hiện 1 lần)

### Classic

- Scope tick **`repo`**
- Generate → copy

⚠️ **Không** commit token vào code. Admin chỉ lưu token trong **trình duyệt của bạn** (localStorage).

## Bước 4 — Bật lưu online trong Admin

1. Mở `.../admin.html`
2. PIN: `vex2026` (đổi sau trong Cài đặt)
3. Vào **Cài đặt**
4. Điền:
   - Owner: `TEN-CUA-BAN`
   - Repo: `vex-filter`
   - Branch: `main`
   - Token: dán token vừa copy
5. **Lưu & bật GitHub** → **Test kết nối** phải OK

Sidebar hiện: `● GitHub online`

## Bước 5 — Thêm sản phẩm

1. **+ Thêm sản phẩm**
2. Kéo thả ảnh (≤ 5MB)
3. Điền tên, SKU, giá, dòng xe…
4. **Lưu sản phẩm**
5. Đợi 1–2 phút → F5 trang **Sản phẩm** trên web

---

## Chạy trên máy (không cần Token)

```powershell
cd D:\CODE\duan-anhoang
python admin-server.py
```

- Site: http://127.0.0.1:8080/
- Admin: http://127.0.0.1:8080/admin.html  

Lưu file thẳng vào ổ cứng. Muốn lên web vẫn phải `git push` (hoặc dùng GitHub Token như trên).

---

## Chỗ host khác (nếu sau này cần)

| Nơi | Free “mãi”? | Thêm SP |
|-----|-------------|---------|
| **GitHub Pages + Token** (đang dùng) | Gần như mãi (free GH) | ✅ |
| Cloudflare Pages + D1/R2 | Free generous | Cần code thêm |
| Supabase + static host | Free tier | DB thật, phức tạp hơn |
| VPS ~$4–6/tháng | Có trả phí | Full quyền |

Với shop catalog lọc gió: **GitHub Pages + Admin Token** là đủ.

---

## Bảo mật

- Đổi `adminPin` trong Admin → Cài đặt (không để `vex2026` production)
- Token chỉ nhập trên máy/trình duyệt tin cậy
- Không gửi link Admin + PIN cho khách
- Admin đã `noindex` — vẫn nên coi URL admin là “bí mật tương đối”
