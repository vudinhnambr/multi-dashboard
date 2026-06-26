# Quality Management Hub — CMM + Auto MT + Supplier NCR

Một web duy nhất, một lần deploy Vercel, chứa cả 3 dashboard. Thanh menu trên
cùng để chuyển qua lại.

- **CMM Dashboard** — React (Vite), đọc dữ liệu trực tiếp từ Google Sheets.
  Không cần backend, không cần đăng nhập.
- **Auto MT Dashboard** — file HTML tĩnh (`public/auto-mt.html`), dùng Supabase
  (đọc/ghi/xóa) qua các serverless function trong `/api`, có đăng nhập Supabase Auth.
  Được nhúng vào khung chung bằng iframe nên chạy y hệt bản gốc.
- **Supplier NCR Dashboard** — bộ web tĩnh trong `public/supplier-ncr/`
  (HTML/CSS/JS thuần + Chart.js). Lấy dữ liệu qua serverless function
  `/api/ncr`, hàm này đọc một file Google Sheets/Excel và trả về JSON.
  Có lớp nhập mật mã để truy cập. Cũng được nhúng vào khung chung bằng iframe.

## Cấu trúc

```
production-hub/
├── api/                  # Serverless functions (Vercel tự build)
│   ├── data.js           #   Auto MT: đọc production_records (Supabase)
│   ├── insert.js         #   Auto MT: ghi (inspector/admin)
│   ├── delete.js         #   Auto MT: xóa (admin)
│   └── ncr.js            #   Supplier NCR: đọc file Sheets/Excel → JSON
├── public/
│   ├── auto-mt.html      # Toàn bộ Auto MT dashboard (HTML/JS thuần)
│   ├── favicon.svg
│   └── supplier-ncr/     # Toàn bộ Supplier NCR dashboard (tĩnh)
│       ├── index.html
│       ├── app.js
│       └── styles.css
├── src/                  # Khung shell + CMM dashboard (React)
│   ├── pages/CMM.jsx      #   nội dung CMM
│   ├── App.jsx            #   top-nav + chuyển tab (cmm / auto-mt / supplier-ncr)
│   ├── app-shell.css
│   ├── data.js, config.js, sampleData.js, dashboard.css, index.css
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Chạy local

```bash
npm install
npm run dev
```

Lưu ý: khi chạy `npm run dev` thuần Vite, các tab Auto MT (`/auto-mt.html`) và
Supplier NCR (`/supplier-ncr/index.html`) mở được, nhưng các API `/api/*`
(Supabase, Google Sheets/Excel) **chỉ chạy trên Vercel**. Muốn test API ở local
thì dùng `vercel dev` (cài `npm i -g vercel`).

## Deploy lên Vercel

1. Đẩy thư mục này lên một repo GitHub mới.
2. Vào Vercel → New Project → import repo đó. Framework để **Vite** (đã có sẵn
   trong `vercel.json`).
3. Khai báo Environment Variables:
   - `SUPABASE_URL` — dùng cho `/api/data`, `/api/insert`, `/api/delete` (Auto MT).
   - `SUPABASE_ANON_KEY` — như trên.
   - `NCR_XLSX_URL` — link Google Sheets/Excel nguồn của Supplier NCR (dùng cho `/api/ncr`).
4. Deploy.

### Điều hướng sau khi deploy

- `/`               → mở thẳng vào CMM (mặc định).
- `/#cmm`           → CMM.
- `/#auto-mt`       → Auto MT (iframe tới `/auto-mt.html`).
- `/#supplier-ncr`  → Supplier NCR (iframe tới `/supplier-ncr/index.html`).
- `/api/data`, `/api/insert`, `/api/delete`, `/api/ncr` → các API serverless.

## Cấu hình nguồn dữ liệu

- **CMM**: sửa `GSHEET_ID` trong `src/config.js`.
- **Auto MT**: `SUPABASE_URL` / `SUPABASE_ANON_KEY` đang hardcode trong
  `public/auto-mt.html` (phần `<script>` đầu file) — giống bản gốc. Các API server
  đọc từ Environment Variables trên Vercel.
- **Supplier NCR**: nguồn dữ liệu lấy từ biến môi trường `NCR_XLSX_URL` trên
  Vercel (link Google Sheets/Excel). Mật mã truy cập được kiểm tra trong
  `api/ncr.js` (header `x-auth-key`).

## Còn để làm sau (login chung cho cả ba)

Hiện Auto MT có đăng nhập Supabase Auth, Supplier NCR có lớp mật mã riêng, còn
CMM thì mở tự do. Khi muốn gộp đăng nhập: chuyển CMM sang gọi `/api/data`
(Supabase) thay vì Google Sheets, rồi bọc cả khung shell bằng một lớp kiểm tra
session Supabase ở `App.jsx`. Đây là việc lớn hơn, nên tách riêng.
