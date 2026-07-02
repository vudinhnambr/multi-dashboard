# Shipment Check (NCR Ring Check) — thiết lập sau khi tích hợp vào hub

Tab **Shipment Check** đã được ghép vào hub: inspector nhập S/N bearing set → tra S/N
các ring lẻ → tra trạng thái NCR/SR → kết luận OK / CHƯA OK để xuất hàng.

- Giao diện: trang tĩnh `public/shipment-check/` (nhúng iframe, giống Auto MT/NCR).
- API: `/api/check`, `/api/parts` (Vercel serverless).
- Đăng nhập: **Supabase Auth chung** với CMM/NCR; kiểm quyền qua bảng `dashboard_access`
  với khóa **`shipment-check`**.
- Dữ liệu: đọc trực tiếp 3 file Google Drive bằng **service account** (file vẫn Restricted).

## 1. Cài lại dependencies (có thư viện mới)

`package.json` đã thêm `googleapis` + `google-auth-library`. Chạy local rồi commit lock file:

```bash
npm install
npm run build   # xác nhận build không lỗi
```

## 2. Tạo Google service account (đọc file Drive)

1. https://console.cloud.google.com → tạo project (hoặc dùng sẵn).
2. APIs & Services → Library → bật **Google Drive API**.
3. APIs & Services → Credentials → Create Credentials → **Service account** (bỏ qua phần role).
4. Mở service account → tab **Keys** → Add Key → Create new key → **JSON** (tải file .json về).

## 3. Đổi file JSON thành base64 (dán vào Vercel không lỗi xuống dòng)

PowerShell (tự lấy file .json mới nhất trong Downloads, copy base64 vào clipboard):

```powershell
$f = Get-ChildItem "$env:USERPROFILE\Downloads\*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
[Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName)) | Set-Clipboard
Write-Host "Da copy base64 cua file: $($f.Name)"
```

## 4. Share 3 file dữ liệu với service account

Mở Google Drive, chuột phải từng file → **Share** → dán email service account
(dạng `...@...iam.gserviceaccount.com`, xem trong file JSON ở trường `client_email`) →
quyền **Viewer**. File vẫn Restricted, chỉ thêm đúng service account được đọc.

Ba file:
- **Check SN ring from SN bearing set** (sheet `SN`) → biến `DRIVE_SN_FILE_ID`
- **Inspection Notice-NCR-SR Tracking** (sheet `LIST`) → biến `DRIVE_NCR_FILE_ID`
- **Standard Part Name** (sheet `Sheet2`) → biến `DRIVE_PARTS_FILE_ID` *(tùy chọn, cấp dropdown Part)*

Lấy File ID từ link: `.../spreadsheets/d/<FILE_ID>/edit`.

## 5. Khai báo Environment Variables trên Vercel

Settings → Environment Variables (Production), thêm:

- `GOOGLE_SERVICE_ACCOUNT_KEY_B64` = chuỗi base64 ở bước 3 (dán y nguyên, không ngoặc kép, không xuống dòng)
- `DRIVE_SN_FILE_ID`
- `DRIVE_NCR_FILE_ID`
- `DRIVE_PARTS_FILE_ID` *(tùy chọn)*
- `CACHE_TTL_SECONDS` *(tùy chọn, mặc định 300 = làm mới dữ liệu mỗi 5 phút)*

Đã thêm/sửa biến sau khi deploy → phải **Redeploy**.

> Không cần biến mới cho đăng nhập — dùng chung `AUTH_SUPABASE_URL` / `AUTH_SUPABASE_ANON_KEY`
> đã có (CMM/NCR).

## 6. Cấp quyền vào dashboard 'shipment-check'

Trong Supabase (project quyền chung) → SQL Editor, cấp cho từng người (đổi email):

```sql
insert into public.dashboard_access (user_id, dashboard, role)
select u.id, 'shipment-check', 'viewer'
from auth.users u
where u.email = 'vdnam@csbrg.com'
on conflict (user_id, dashboard) do update set role = excluded.role;
```

Ai chưa có dòng `shipment-check` sẽ đăng nhập được nhưng bị chặn ở tab này ("chưa được cấp quyền").

## 7. Deploy & kiểm tra

Commit + push → đợi Vercel Ready → mở hub, bấm tab **Shipment Check**:
- Hiện màn đăng nhập Supabase (hoặc vào thẳng nếu đã đăng nhập tab khác — phiên dùng chung).
- Đăng nhập tài khoản có quyền `shipment-check` → nhập S/N → Kiểm tra.
- Nếu lỗi, xem Vercel → Deployments → Logs, lọc route `/api/check` để biết thiếu biến gì.

## Mở rộng sau này (AI đọc ảnh Tag Name)
Có thể thêm route `/api/read-tag` nhận ảnh, gọi Claude (vision) đọc S/N khắc trên tag,
tự điền vào ô rồi gọi `/api/check` như thường. Phần lookup không phải đổi.
