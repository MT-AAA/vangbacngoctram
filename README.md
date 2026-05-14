# NGỌC TRÂM — Dashboard Vàng Bạc Đá Quý

Mã nguồn mở cho ứng dụng quản lý cửa hàng vàng bạc đá quý: nhập dữ liệu bán hàng từ Excel, phân loại **Vàng ta**, **Vàng tây**, **Bạc**, quản lý tồn kho, giá vốn và tính **thuế GTGT theo phương pháp trực tiếp trên giá trị gia tăng**.

Dự án này phù hợp cho cửa hàng muốn tự triển khai hệ thống riêng trên Supabase/Vercel và tự kiểm soát dữ liệu của mình.

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cài đặt và chạy dự án](#cài-đặt-và-chạy-dự-án)
  - [Bước 1: Tạo Supabase project](#bước-1-tạo-supabase-project)
  - [Bước 2: Tạo database schema](#bước-2-tạo-database-schema)
  - [Cách 1: Chạy trên máy cá nhân](#cách-1-chạy-trên-máy-cá-nhân)
  - [Cách 2: Deploy lên Vercel](#cách-2-deploy-lên-vercel)
- [Tài khoản admin đầu tiên](#tài-khoản-admin-đầu-tiên)
- [Phân quyền người dùng](#phân-quyền-người-dùng)
- [Công thức thuế GTGT](#công-thức-thuế-gtgt)
- [Lưu ý về dữ liệu và quyền riêng tư](#lưu-ý-về-dữ-liệu-và-quyền-riêng-tư)
- [License](#license)

## Tính năng chính

- **Dashboard tổng quan**: doanh thu, giá vốn, chênh lệch GTGT, tồn kho và báo cáo hàng hóa.
- **Nhập Excel bán hàng**: import dữ liệu bán hàng, tự nhận diện lỗi trùng/sai/thiếu.
- **Phân loại hàng hóa**: tự phân loại Vàng ta, Vàng tây, Bạc theo bộ quy tắc.
- **Quản lý tồn kho**: theo dõi trọng lượng tồn, giá vốn và phát sinh nhập/xuất.
- **Mua hàng từ khách**: ghi nhận giao dịch mua vào để bổ sung tồn kho và giá vốn.
- **Tính thuế GTGT trực tiếp**: tính theo giá trị gia tăng, có xử lý âm chuyển kỳ sau trong năm.
- **Người dùng & phân quyền**: admin tạo tài khoản, phân quyền xem hoặc chỉnh sửa.
- **Nhật ký hệ thống**: lưu lại các thao tác quan trọng để kiểm tra sau này.

## Công nghệ sử dụng

- Next.js 14 App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Auth, Postgres, Storage
- Recharts
- XLSX

## Cài đặt và chạy dự án

Bạn cần có:

- Tài khoản GitHub
- Tài khoản Supabase
- Node.js 20 trở lên
- npm

---

## Bước 1: Tạo Supabase project

1. Vào https://supabase.com và đăng nhập.
2. Chọn **New Project**.
3. Tạo project mới và chờ Supabase khởi tạo xong.
4. Vào **Project Settings → API** và lưu lại:
   - `Project URL`
   - `anon public key`
   - `service_role key`
5. Vào **Project Settings → Database** và lưu lại connection string nếu muốn chạy migration bằng CLI.

> Không chia sẻ `service_role key` công khai. Key này chỉ được dùng ở server.

---

## Bước 2: Tạo database schema

Các file SQL nằm trong:

```txt
supabase/migrations/
```

Cách đơn giản nhất:

1. Vào Supabase Dashboard.
2. Mở **SQL Editor**.
3. Chạy lần lượt các file trong `supabase/migrations/` theo đúng thứ tự tên file, từ file đầu tiên đến file cuối cùng.

Ví dụ thứ tự bắt đầu:

```txt
20250506000001_init.sql
20250506000002_storage.sql
20250506000003_phase2a_invoice_identity.sql
...
```

Sau khi chạy xong migration, database đã sẵn sàng.

---

## Cách 1: Chạy trên máy cá nhân

1. Clone repo:

```bash
git clone https://github.com/MT-AAA/vangbacngoctram.git
cd vangbacngoctram
```

2. Cài thư viện:

```bash
npm install
```

3. Tạo file môi trường:

```bash
cp .env.example .env.local
```

Trên Windows PowerShell có thể dùng:

```powershell
Copy-Item .env.example .env.local
```

4. Mở `.env.local` và điền thông tin Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

5. Chạy dự án:

```bash
npm run dev
```

6. Mở trình duyệt:

```txt
http://localhost:3000
```

---

## Cách 2: Deploy lên Vercel

1. Fork hoặc clone repo này về GitHub của bạn.
2. Vào https://vercel.com và chọn **Add New Project**.
3. Import repo `vangbacngoctram`.
4. Thêm các biến môi trường:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

5. Nhấn **Deploy**.
6. Sau khi deploy xong, vào Supabase:
   - **Authentication → URL Configuration**
   - `Site URL`: URL Vercel của bạn
   - `Redirect URLs`: thêm URL Vercel của bạn, ví dụ:

```txt
https://your-app.vercel.app/**
```

Nếu chạy local, thêm thêm:

```txt
http://localhost:3000/**
```

---

## Tài khoản admin đầu tiên

Phiên bản hiện tại dùng tài khoản admin mặc định theo ID:

```txt
ID: Admin
Password: 1909
```

ID `Admin` được map tới email Supabase:

```txt
miton.tran.95@gmail.com
```

Nếu bạn tự triển khai cho cửa hàng khác, hãy sửa email admin trong file:

```txt
src/components/auth/login-form.tsx
```

Tìm dòng:

```ts
const ADMIN_EMAIL = "miton.tran.95@gmail.com";
```

Đổi thành email admin của bạn.

Sau đó trong Supabase **Authentication → Users**, tạo hoặc cập nhật user admin với email đó và đặt mật khẩu là `1909` hoặc mật khẩu bạn muốn dùng.

---

## Phân quyền người dùng

Hệ thống có 3 quyền:

1. **Admin**: toàn quyền, quản lý dữ liệu và tạo tài khoản người dùng.
2. **Quyền chỉnh sửa** (`staff`): được nhập liệu, chỉnh sửa dữ liệu nghiệp vụ.
3. **Quyền xem** (`viewer`): chỉ xem báo cáo và dữ liệu.

Admin có thể vào:

```txt
Cài đặt → Người dùng & phân quyền
```

để tạo tài khoản mới, đặt mật khẩu và chọn quyền cho từng người dùng.

---

## Công thức thuế GTGT

Ứng dụng tính thuế theo phương pháp trực tiếp trên giá trị gia tăng:

```txt
Giá trị gia tăng = Tổng bán ra - Tổng mua vào tương ứng
```

```txt
Thuế GTGT phải nộp = Giá trị gia tăng chịu thuế dương × thuế suất
```

Nếu giá trị gia tăng âm, phần âm được chuyển sang kỳ sau trong cùng năm dương lịch.

---

## Lưu ý về dữ liệu và quyền riêng tư

> Dự án này chỉ cung cấp mã nguồn. Repo GitHub không chứa dữ liệu bán hàng, dữ liệu khách hàng hoặc dữ liệu tồn kho thật.

- Dữ liệu phát sinh khi sử dụng sẽ nằm trong Supabase project do chính bạn tạo và quản lý.
- Tác giả repo không có quyền truy cập database Supabase của bạn.
- Không commit file `.env.local` hoặc bất kỳ file nào chứa key Supabase lên GitHub.
- Không đưa dữ liệu bán hàng thật, thông tin khách hàng thật hoặc sao lưu database thật vào repo.
- Nếu muốn chia sẻ repo công khai, chỉ chia sẻ source code và migration SQL.

## License

MIT License.
