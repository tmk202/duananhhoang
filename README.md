# VEX Filter — Landing page tĩnh (GitHub Pages)

Landing + danh mục sản phẩm **lọc gió điều hòa than hoạt tính** cho xe điện **VinFast** (thị trường Việt Nam, đối tượng ~30–50 tuổi).

## Tính năng demo

- Trang chủ chuyển đổi (hero, pain, chọn dòng xe, cấu tạo, so sánh, FAQ, CTA Zalo)
- Danh mục / chi tiết sản phẩm từ **JSON tĩnh** (`data/`)
- Lọc theo category (`?cat=vinfast`) hoặc dòng xe (`?vehicle=VF5`)
- Chi tiết: `san-pham.html?slug=loc-gio-vinfast-vf3`
- Host GitHub Pages, không cần backend

## Cấu trúc

```
├── index.html              # Landing
├── san-pham.html           # Catalog + chi tiết (?slug=)
├── css/style.css
├── js/app.js
├── data/
│   ├── products.json       # DB sản phẩm
│   ├── categories.json     # Danh mục
│   └── site.json           # Hotline, Zalo, Shopee
└── public/images/          # Ảnh marketing + SKU
```

## Host free mãi + thêm sản phẩm online

GitHub Pages **không có server ghi file**. Admin dùng **GitHub API** (Personal Access Token) để commit JSON + ảnh → Pages tự cập nhật. **Miễn phí, lâu dài.**

### 1) Deploy Pages

1. Push repo lên GitHub  
2. **Settings → Pages** → branch `main`, folder `/ (root)`  
3. Mở `https://<user>.github.io/<repo>/admin.html`

### 2) Bật “thêm SP online”

1. GitHub → **Settings → Developer settings → Personal access tokens**  
   - Fine-grained: repo của bạn + **Contents: Read and write**  
   - hoặc Classic: scope **`repo`**
2. Vào Admin → **Cài đặt** → điền:
   - Owner (username)
   - Repo name
   - Branch (`main`)
   - Token → **Lưu & bật GitHub**
3. Token chỉ lưu **trên trình duyệt** (localStorage), không commit vào code

### 3) Thêm sản phẩm

**+ Thêm sản phẩm** → upload ảnh → Lưu → đợi 1–2 phút → F5 shop.

---

## Chạy local (tùy chọn)

```bash
python admin-server.py
```

| URL | Việc |
|-----|------|
| http://127.0.0.1:8080/ | Landing |
| http://127.0.0.1:8080/san-pham.html | Shop |
| http://127.0.0.1:8080/admin.html | Admin |

PIN mặc định: `vex2026` (`data/site.json` → `adminPin`).

Local server ghi file máy; không cần token. Online trên Pages thì dùng GitHub Token.

## Deploy GitHub Pages

1. Tạo repo, push toàn bộ thư mục này.
2. **Settings → Pages → Source**: Deploy from branch `main` / folder `/ (root)`.
3. Đợi 1–2 phút, mở `https://<user>.github.io/<repo>/`.

### Nếu site nằm ở subpath (`/ten-repo/`)

Đường dẫn ảnh/CSS đã relative — hoạt động tốt. Chỉ cần đảm bảo không dùng absolute path từ root domain.

## Thêm / sửa sản phẩm

Sửa `data/products.json`:

```json
{
  "id": "vex-xxx",
  "slug": "loc-gio-vinfast-xxx",
  "sku": "VEX-XXX",
  "name": "Lọc gió …",
  "category": "vinfast",
  "vehicle": "VF5",
  "price": 199000,
  "image": "public/images/sku/vf5.png",
  ...
}
```

Sửa Zalo / Shopee / hotline trong `data/site.json`.

## Thương hiệu (từ asset)

- **VEX Automotive / VEX Filter**
- Slogan: *Bảo vệ sức khỏe – Nâng tầm trải nghiệm*
- Lọc 3 lớp + than hoạt tính gáo dừa, PM2.5, ~15.000 km
- Dòng xe: VF3, VF5, VF6/VF7, VF8/VF9, Limo Green / MPV7

## Việc bạn nên cập nhật trước go-live

- [ ] Số Zalo / Shopee / hotline thật trong `data/site.json`
- [ ] Giá thật từng SKU trong `products.json`
- [ ] Review khách thật (thay block demo trên `index.html`)
- [ ] Favicon + OG image absolute URL khi có domain
- [ ] Chính sách đổi trả / ship rõ ràng

---

Demo phục vụ pitch & test UI — không phải shop thanh toán online đầy đủ.
