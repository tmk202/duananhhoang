#!/usr/bin/env python3
"""
VEX Filter — local admin server
- Serves static site
- API ghi products.json / categories.json / site.json
- Upload ảnh vào public/images/uploads/

Chạy:  python admin-server.py
Mở:    http://127.0.0.1:8080/admin.html
"""

from __future__ import annotations

import json
import mimetypes
import os
import re
import secrets
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8080"))
UPLOAD_DIR = ROOT / "public" / "images" / "uploads"
DATA_DIR = ROOT / "data"

ALLOWED_JSON = {
    "products": DATA_DIR / "products.json",
    "categories": DATA_DIR / "categories.json",
    "site": DATA_DIR / "site.json",
}

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB


def load_admin_pin() -> str:
    try:
        site = json.loads((DATA_DIR / "site.json").read_text(encoding="utf-8"))
        return str(site.get("adminPin") or "vex2026")
    except Exception:
        return "vex2026"


def slugify(text: str) -> str:
    text = (text or "").strip().lower()
    # keep ascii-ish for filenames
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text or "image"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # CORS for local admin tooling
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _json(self, code: int, payload: dict | list):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        return self.rfile.read(length)

    def _check_pin(self) -> bool:
        pin = self.headers.get("X-Admin-Pin") or ""
        return secrets.compare_digest(pin, load_admin_pin())

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self._json(200, {
                "ok": True,
                "write": True,
                "message": "Admin API sẵn sàng ghi file",
            })
        if parsed.path == "/api/status":
            return self._json(200, {
                "ok": True,
                "write": True,
                "root": str(ROOT),
                "uploadDir": str(UPLOAD_DIR.relative_to(ROOT)).replace("\\", "/"),
            })
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not path.startswith("/api/"):
            self.send_error(404)
            return

        if not self._check_pin():
            return self._json(401, {"ok": False, "error": "Sai mã PIN admin"})

        try:
            if path == "/api/products":
                return self._save_json("products")
            if path == "/api/categories":
                return self._save_json("categories")
            if path == "/api/site":
                return self._save_json("site")
            if path == "/api/upload":
                return self._upload_image()
            if path == "/api/product":
                return self._upsert_product()
            if path == "/api/product/delete":
                return self._delete_product()
            return self._json(404, {"ok": False, "error": "API không tồn tại"})
        except Exception as e:
            return self._json(500, {"ok": False, "error": str(e)})

    def _save_json(self, key: str):
        target = ALLOWED_JSON[key]
        raw = self._read_body()
        data = json.loads(raw.decode("utf-8"))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        count = len(data) if isinstance(data, list) else 1
        return self._json(200, {
            "ok": True,
            "saved": key,
            "count": count,
            "path": str(target.relative_to(ROOT)).replace("\\", "/"),
        })

    def _load_products(self) -> list:
        p = ALLOWED_JSON["products"]
        if not p.exists():
            return []
        return json.loads(p.read_text(encoding="utf-8"))

    def _write_products(self, products: list):
        ALLOWED_JSON["products"].write_text(
            json.dumps(products, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _upsert_product(self):
        body = json.loads(self._read_body().decode("utf-8"))
        product = body.get("product") or body
        if not product.get("id") or not product.get("slug"):
            return self._json(400, {"ok": False, "error": "Thiếu id hoặc slug"})

        products = self._load_products()
        idx = next((i for i, p in enumerate(products) if p.get("id") == product["id"] or p.get("slug") == product["slug"]), None)
        if idx is None:
            products.append(product)
            action = "created"
        else:
            products[idx] = product
            action = "updated"
        self._write_products(products)
        return self._json(200, {
            "ok": True,
            "action": action,
            "product": product,
            "total": len(products),
        })

    def _delete_product(self):
        body = json.loads(self._read_body().decode("utf-8"))
        pid = body.get("id") or body.get("slug")
        if not pid:
            return self._json(400, {"ok": False, "error": "Thiếu id/slug"})
        products = self._load_products()
        new_list = [p for p in products if p.get("id") != pid and p.get("slug") != pid]
        if len(new_list) == len(products):
            return self._json(404, {"ok": False, "error": "Không tìm thấy sản phẩm"})
        self._write_products(new_list)
        return self._json(200, {"ok": True, "deleted": pid, "total": len(new_list)})

    def _upload_image(self):
        """
        Accepts either:
        1) application/json { filename, dataUrl }  (base64)
        2) multipart/form-data with field 'file'
        """
        content_type = self.headers.get("Content-Type", "")
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        if "application/json" in content_type:
            body = json.loads(self._read_body().decode("utf-8"))
            data_url = body.get("dataUrl") or body.get("data")
            filename = body.get("filename") or "upload.png"
            if not data_url or "," not in data_url:
                return self._json(400, {"ok": False, "error": "Thiếu dataUrl base64"})
            header, b64 = data_url.split(",", 1)
            import base64
            raw = base64.b64decode(b64)
            if len(raw) > MAX_UPLOAD_BYTES:
                return self._json(400, {"ok": False, "error": "Ảnh quá lớn (max 8MB)"})
            ext = Path(filename).suffix.lower() or ".png"
            if ext not in ALLOWED_IMAGE_EXT:
                ext = ".png"
            safe = f"{int(time.time())}-{slugify(Path(filename).stem)}{ext}"
            dest = UPLOAD_DIR / safe
            dest.write_bytes(raw)
            rel = str(dest.relative_to(ROOT)).replace("\\", "/")
            return self._json(200, {"ok": True, "path": rel, "url": "/" + rel, "bytes": len(raw)})

        return self._json(400, {
            "ok": False,
            "error": "Gửi JSON: { filename, dataUrl } (base64). Content-Type: application/json",
        })

    def log_message(self, fmt, *args):
        print(f"[admin] {self.address_string()} {fmt % args}")


def main():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print("=" * 56)
    print("  VEX Filter Admin Server")
    print(f"  Site:  http://localhost:{PORT}/")
    print(f"  Admin: http://localhost:{PORT}/admin.html")
    print("  Google OAuth: dùng localhost (không dùng 127.0.0.1)")
    print(f"  PIN:   xem data/site.json → adminPin")
    print("=" * 56)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        httpd.server_close()


if __name__ == "__main__":
    main()
