# Inspection Notice — thiết lập sau khi tích hợp vào hub

Tab **Inspection Notice** đã ghép vào hub (tab thứ 5), gồm 2 tab con:
- **Inspection Notice** — sheet `LIST` (theo product/process/result).
- **Confirmed NCR** — sheet `Quality Status (HQ)` (xu hướng tỉ lệ lỗi, breakdown theo process).

Kiến trúc:
- Giao diện: **tab React native** trong hub (`src/pages/InspectionNotice.jsx`) — dùng recharts/xlsx sẵn có, **không thêm dependency**.
- API: `/api/inspection?file=in|ncr` (Vercel serverless) — proxy đọc Google Drive.
- Đăng nhập: **Supabase Auth chung** với CMM/NCR/Shipment Check; kiểm quyền khóa **`inspection-notice`** trong bảng `dashboard_access`.
- Dữ liệu: đọc Google Drive qua **service account** (dùng lại `lib/shipment/drive.js` của Shipment Check).

## 1. Nguồn dữ liệu 2 tab con

- **Inspection Notice** (sheet `LIST`) → **dùng chung** file "Inspection Notice-NCR-SR Tracking"
  với Shipment Check, tức biến **`DRIVE_NCR_FILE_ID`** (đã có sẵn).
- **Confirmed NCR** (sheet `Quality Status (HQ)`) → biến **`DRIVE_CONFIRMED_FILE_ID`**
  (giống kiểu 3 biến `DRIVE_*_FILE_ID` kia — code KHÔNG ghi cứng ID nữa).

Vì đọc qua service account, **hãy Share file Confirmed NCR** với email service account
(quyền Viewer) — giống cách đã share các file cho Shipment Check.
File của Inspection Notice đã share sẵn cho service account rồi (dùng chung với Shipment Check).

## 2. Env

Đã có sẵn từ Shipment Check (dùng lại): `GOOGLE_SERVICE_ACCOUNT_KEY_B64`, `DRIVE_NCR_FILE_ID`.

**Cần thêm 1 biến mới** trên Vercel (Production + Preview):
- `DRIVE_CONFIRMED_FILE_ID` = `1FiISpMW3eaIlyO1Nx2mTCskGGAFnSyQb`

Đăng nhập dùng `AUTH_SUPABASE_URL` / `AUTH_SUPABASE_ANON_KEY`. Mật khẩu JWT/`ACCESS_PASSWORD`
của bản standalone **không còn dùng**.

## 3. Cấp quyền vào dashboard 'inspection-notice'

Supabase (project quyền chung) → SQL Editor (đổi email):

```sql
insert into public.dashboard_access (user_id, dashboard, role)
select u.id, 'inspection-notice', 'viewer'
from auth.users u
where u.email = 'vdnam@csbrg.com'
on conflict (user_id, dashboard) do update set role = excluded.role;
```

Ai chưa có dòng `inspection-notice` sẽ đăng nhập được nhưng bị chặn ở tab này.

## 4. Deploy & kiểm tra

Commit + push → đợi Vercel Ready → mở hub, bấm tab **Inspection Notice**:
- Hiện màn đăng nhập Supabase (hoặc vào thẳng nếu đã đăng nhập tab khác — phiên dùng chung).
- Đăng nhập tài khoản có quyền `inspection-notice` → 2 tab con hiển thị biểu đồ.
- Lỗi thì xem Vercel → Deployments → Logs, lọc route `/api/inspection`.

## Ghi chú
- Nội dung tab này hiện **chỉ tiếng Anh** (như bản gốc). Nút VN/EN của hub chưa dịch phần
  bên trong tab — có thể i18n hóa sau nếu cần.
- Có thể xóa project Vercel `inspection-notice-tracking` lẻ sau khi xác nhận tab trong hub chạy tốt
  (giữ repo GitHub làm bản gốc).
