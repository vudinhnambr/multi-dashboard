# Bảo mật — Nâng cấp ngắn hạn (đã áp dụng)

Tài liệu này ghi lại các thay đổi bảo mật vừa thực hiện và các bước bạn cần làm
trên Vercel + Supabase để hoàn tất.

## 1. Những gì đã sửa trong code

| File | Thay đổi |
|------|----------|
| `api/sheets.js` | Thêm **allowlist ID**. Endpoint chỉ proxy các Google Sheet nằm trong danh sách cho phép → hết cảnh "open-proxy" (trước đây ai cũng tải được mọi sheet). CMM vẫn mở tự do, không cần đăng nhập. |
| `api/ncr.js` | Bỏ hardcode `"CSBearing"`. Mật mã nay đọc từ env **`NCR_AUTH_KEY`**, so sánh **timing-safe**. Thiếu biến → trả 500 (không fallback về mật mã cũ). |
| `public/supplier-ncr/app.js` | Bỏ `MASTER_PASSWORD` khỏi client (trước đây lộ ngay trong JS). Đăng nhập nay được **server xác thực** qua `/api/ncr`. |
| `vercel.json` | Thêm **security headers**: CSP, HSTS, X-Frame-Options (SAMEORIGIN), X-Content-Type-Options, Referrer-Policy, Permissions-Policy. |

## 2. Việc bạn PHẢI làm trên Vercel (bắt buộc, nếu không sẽ lỗi)

Vào **Vercel → Project → Settings → Environment Variables**, thêm:

- **`NCR_AUTH_KEY`** — mật mã mới cho Supplier NCR. Đặt một chuỗi mạnh, khác
  `CSBearing` (vì chuỗi cũ đã nằm trong lịch sử git → coi như đã lộ). Ví dụ tạo
  bằng: `openssl rand -base64 24`.
  > Chưa đặt biến này → trang Supplier NCR sẽ báo "Server not configured".

- **`SHEETS_ALLOWED_IDS`** *(tùy chọn)* — nếu sau này CMM/endpoint dùng thêm
  Google Sheet mới, thêm ID vào đây, phân tách bằng dấu phẩy. ID mặc định của
  CMM (`11pT3Oi21Q5qmXZ6Jhn09ZR2q-G9C7EJj`) đã được nhúng sẵn trong code nên
  CMM chạy ngay không cần khai báo.

Các biến cũ vẫn giữ nguyên: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NCR_XLSX_URL`.

Sau khi thêm biến → **Redeploy** để có hiệu lực.

## 3. Xác minh RLS trên Supabase (QUAN TRỌNG NHẤT)

Anon key nằm công khai trong `auto-mt.html` chỉ **an toàn khi RLS bật đúng**.
Nếu RLS tắt → bất kỳ ai cũng đọc/ghi/xóa được toàn bộ `production_records`.

Kiểm tra trong **Supabase → Table Editor** và **Authentication → Policies**:

1. **RLS đã bật** trên `production_records` và `profiles`
   (SQL kiểm tra: chạy trong SQL Editor)
   ```sql
   select relname, relrowsecurity
   from pg_class
   where relname in ('production_records', 'profiles');
   -- relrowsecurity phải = true cho cả hai
   ```

2. **Các policy tồn tại đúng vai trò** (theo mô tả trong `api/*.js`):
   - `production_records`: SELECT cho user đã đăng nhập; INSERT cho
     `inspector`/`admin`; DELETE chỉ `admin`.
   - `profiles`: mỗi user chỉ đọc được dòng của chính mình.
   ```sql
   select tablename, policyname, cmd, roles
   from pg_policies
   where tablename in ('production_records', 'profiles');
   ```

3. **Không dùng service role key ở client hay trong `/api`.** (Đã xác nhận: code
   hiện chỉ dùng anon key + forward JWT của user — đúng.)

4. **Test thực tế**: đăng nhập bằng tài khoản `viewer` rồi thử ghi/xóa — phải bị
   từ chối (401/403 hoặc xóa 0 dòng).

## 4. Nên làm sớm sau đợt này (nhắc lại)

- Xoay (rotate) mật mã NCR và cân nhắc **gộp đăng nhập Supabase Auth** cho cả 3
  dashboard, bỏ hẳn lớp mật mã tĩnh.
- Rate-limit hiện dùng `Map` trong RAM → **không hiệu quả trên serverless**.
  Chuyển sang Vercel KV / Upstash Redis.
- Thêm **SRI** hoặc self-host cho script CDN; bỏ `cdn.tailwindcss.com` bản dev.
- Nâng cấp **`xlsx@0.18.5`** (có CVE prototype-pollution / ReDoS).

## 5. Lưu ý về CSP

CSP đã whitelist đúng các CDN đang dùng (`cdn.tailwindcss.com`,
`cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `esm.sh`) và domain Supabase. Nếu
sau này thêm thư viện/CDN mới mà thấy trang trắng hoặc lỗi trong Console
("refused to load ... Content Security Policy"), thêm domain đó vào đúng directive
(`script-src` / `style-src` / `connect-src`) trong `vercel.json`.
