# Supabase Auth + phân quyền theo từng dashboard

Mục tiêu: một **project Supabase chung** làm trung tâm đăng nhập & phân quyền cho
các dashboard. Mỗi user được **gán vào những dashboard cụ thể** (kèm role riêng cho
mỗi dashboard). Thêm dashboard mới sau này = thêm một "khóa" mới, KHÔNG đổi cấu trúc.

Phạm vi hiện tại:
- **CMM** và **Supplier NCR** → dùng project chung này (dữ liệu vẫn đọc từ Google Drive).
- **Auto MT** → tạm giữ đăng nhập + project riêng (vì dữ liệu `production_records`
  nằm ở project đó). Sẽ tích hợp sau nếu muốn.

> Bạn làm phần 1→6. Xong, gửi tôi **Project URL** + **anon key** (phần 6) — tôi ráp
> code cho CMM trước, chạy ổn rồi tới NCR.

---

## 1. Tạo project

1. **supabase.com → New project**. Đặt tên (vd `dashboards-auth`), Region gần
   (Singapore), đặt Database Password (lưu lại).
2. Đợi ~1–2 phút cho project khởi tạo xong.

## 2. Bật đăng nhập bằng email

1. **Authentication → Sign In / Providers → Email**: bật **Enable Email provider**.
2. **Tắt "Confirm email"** (dùng nội bộ, tự tạo tài khoản, không cần xác nhận mail).

## 3. Tạo tài khoản cho từng người

**Authentication → Users → Add user → Create new user**: nhập email + password,
tích **Auto Confirm User**. Lặp cho từng người.

## 4. Tạo bảng phân quyền theo dashboard (dán SQL)

**SQL Editor → New query**, dán rồi **Run**:

```sql
-- Mỗi dòng = "user X được vào dashboard Y" (kèm role riêng cho dashboard đó)
create table if not exists public.dashboard_access (
  user_id    uuid references auth.users(id) on delete cascade,
  dashboard  text not null,               -- 'cmm' | 'supplier-ncr' | 'auto-mt' | (khóa mới sau này)
  role       text not null default 'viewer',  -- 'viewer' | 'editor' | 'admin' ... (dùng dần)
  granted_at timestamptz default now(),
  primary key (user_id, dashboard)
);

alter table public.dashboard_access enable row level security;

-- Mỗi user chỉ đọc được quyền của chính mình (server dựa vào đây để gác cổng)
drop policy if exists "read own access" on public.dashboard_access;
create policy "read own access"
  on public.dashboard_access for select
  using (auth.uid() = user_id);
```

> Danh sách khóa dashboard là quy ước dùng trong code:
> `cmm`, `supplier-ncr`, `auto-mt`. Thêm dashboard mới → đặt một khóa mới (vd
> `oee`), rồi tôi thêm 1 dòng kiểm tra ở API của dashboard đó.

## 5. Gán user vào dashboard

**Cấp quyền** cho một user vào vài dashboard (thay email; sửa danh sách trong `values`):

```sql
insert into public.dashboard_access (user_id, dashboard, role)
select u.id, d.dashboard, 'viewer'
from auth.users u
cross join (values ('cmm'), ('supplier-ncr')) as d(dashboard)
where u.email = 'nguoinao@congty.com'
on conflict (user_id, dashboard) do nothing;
```

**Đổi role** của một user ở một dashboard:

```sql
update public.dashboard_access set role = 'editor'
where dashboard = 'cmm'
  and user_id = (select id from auth.users where email = 'nguoinao@congty.com');
```

**Thu hồi** quyền vào một dashboard:

```sql
delete from public.dashboard_access
where dashboard = 'cmm'
  and user_id = (select id from auth.users where email = 'nguoinao@congty.com');
```

**Xem ai đang có quyền gì:**

```sql
select u.email, a.dashboard, a.role
from public.dashboard_access a
join auth.users u on u.id = a.user_id
order by u.email, a.dashboard;
```

## 6. Lấy khóa để gửi cho tôi

**Project Settings → API**:
- **Project URL** — `https://xxxxxxxx.supabase.co`
- **anon / public key** — khóa CÔNG KHAI (an toàn ở frontend). KHÔNG gửi `service_role`.

Gửi tôi 2 giá trị này. Trên Vercel sẽ khai báo (tôi nhắc lại đúng lúc):
- `AUTH_SUPABASE_URL` = Project URL
- `AUTH_SUPABASE_ANON_KEY` = anon key

---

## Cách gác cổng hoạt động (để bạn hình dung)
- Người dùng đăng nhập bằng email/mật khẩu (Supabase Auth) → nhận token phiên.
- Mỗi API dashboard (vd `/api/sheets` cho CMM, `/api/ncr` cho NCR) sẽ hỏi Supabase:
  "user này có dòng `dashboard_access` cho dashboard tương ứng không?" — có thì cho
  vào, không thì chặn (403). RLS đảm bảo user chỉ thấy quyền của chính mình.
- Vì vậy: **muốn cho ai vào dashboard nào → thêm 1 dòng ở bước 5.** Không cần sửa code.

## Ghi chú
- Mật khẩu `CMM_AUTH_KEY` và mật khẩu NCR cũ sẽ **gỡ bỏ** khi chuyển sang Supabase Auth.
- Phiên đăng nhập được nhớ giữa các lần tải trang; sẽ có nút Đăng xuất.
- Cột `role` hiện chưa siết (CMM/NCR chỉ cần "có quyền vào"); để sẵn cho sau này
  phân quyền ghi/sửa trên từng dashboard.
