# Deploy Java Corner lên Vercel

Bản này có điểm vào `api/index.js`, cấu hình `vercel.json` và build tài nguyên tĩnh riêng.
Vercel tự quản lý HTTP listener; không chạy `npm start` hoặc Docker trong Vercel.

## Cấu hình Import Project

- Repository: `phamtu1999/java-corner`, branch `main`.
- Framework Preset: **Other**; Root Directory: `./`.
- Build Command: `npm run vercel-build`.
- Output Directory: `public`.
- Install Command: `npm ci`.
- Node.js: **22.x**.

Thêm Environment Variables ở **Production**:

| Biến | Giá trị |
| --- | --- |
| `NODE_ENV` | `production` |
| `SITE_ORIGIN` | URL HTTPS chính xác của website, không có `/` cuối, ví dụ `https://java-corner.vercel.app` |
| `DATABASE_URL` | Supabase **Session pooler**, cổng **5432**, có mật khẩu database |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SECRET_KEY` | Secret key phía server, không dùng tiền tố `PUBLIC` hay `NEXT_PUBLIC` |
| `SUPABASE_STORAGE_BUCKET` | Bucket JAR công khai hiện có, thường là `game` |
| `SUPABASE_PRIVATE_STORAGE_BUCKET` | Bucket riêng, ví dụ `game-private`, **Public OFF** |
| `SUPABASE_MEDIA_BUCKET` | Bucket ảnh/video hiện có, thường là `media`, Public ON |

Không cần đặt `PORT`, `DATA_DIR`, hoặc `GAME_STORAGE` trên Vercel. JAR mới được lưu
trên Supabase tự động; `/tmp` chỉ dùng khi xác thực tệp. Các migration chạy riêng
bằng `npm run db:migrate` từ máy quản trị, không chạy trong build mỗi deployment.
Giữ chế độ session pooler vì ứng dụng đặt ngữ cảnh người dùng trên connection.

Preview cần `SITE_ORIGIN` riêng khớp URL preview; dùng database/bucket thử nghiệm
nếu cần thử thay đổi dữ liệu. Không đặt `TRUST_PROXY=true` tùy tiện; rate limit
hiện tại trong bộ nhớ chỉ áp dụng từng instance, chưa là giới hạn toàn deployment.

## Giới hạn phải biết

- Vercel giới hạn request/response Function 4,5 MB. Giao diện chặn multipart
  trên **4 MB tổng cộng** để chừa phần bao gói. Giới hạn này áp dụng JAR, media,
  avatar và upload bản lưu. Bản lưu lớn hơn 4 MB không tải qua Function; dùng
  máy chủ Docker hoặc xuất bản lưu trình duyệt. Chưa có luồng upload trực tiếp
  bằng signed upload URL để giữ giới hạn 20/50 MB như Docker.
- Vercel hiện hỗ trợ WebSocket beta nhưng kết nối bị đóng khi Function hết thời
  gian. Cấu hình Hobby này tối đa **300 giây**. Relay TCP game không thể nối lại
  trong suốt một phiên TCP cũ. Để chơi online lâu dài, triển khai backend trên
  máy chủ chạy liên tục; bản Vercel này không thay thế backend đó.
- Cache, rate limit và semaphore upload nằm trong từng instance. Không coi các
  số giới hạn đó là quota tổng cho nhiều instance Vercel.
- JAR cũ chỉ có trong `data/uploads` không được đưa lên Git và không tự chuyển
  lên Supabase. Cần chuyển các tệp đó trước khi dùng bản Vercel; JAR catalog đã
  có `storage_object` tiếp tục tải từ Supabase. Không xóa dữ liệu Docker cũ.

Nguồn: [giới hạn Functions](https://vercel.com/docs/functions/limitations),
[WebSockets và thời gian kết nối](https://vercel.com/docs/functions/websockets).

## Kiểm tra sau deploy

1. `/api/deployment` trả `uploadLimit: 4194304`, `relayMaxSeconds: 300`.
2. `/games`, `/library`, `/play` và CSS/JS/Wasm tải được; không có 404 tài nguyên.
3. Đăng nhập/đăng xuất thành công (nếu 403, kiểm tra `SITE_ORIGIN`).
4. Tải một JAR nhỏ lên kho riêng: chủ sở hữu tải được, tài khoản khác nhận 404.
5. Mở game offline và xác nhận tiến trình vẫn lưu trong trình duyệt.
6. Kiểm tra log Vercel khi API lỗi; không đưa secret key hoặc DATABASE_URL vào ảnh chụp.

Build cục bộ và kiểm thử API không chứng minh deployment Vercel đã chạy. Phải
hoàn tất các bước trên sau khi nhập biến môi trường và bấm Deploy.
