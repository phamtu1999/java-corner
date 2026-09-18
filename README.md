# Java Corner · Java Emulator Web

Cộng đồng game Java ME chạy trên trình duyệt: kho game công khai, tài khoản thành viên, game riêng, lịch sử chơi và diễn đàn. Giả lập sử dụng FreeJ2ME Web + CheerpJ; giữ các bố cục màn hình lớn, phím hai bên, phím bên dưới và Nokia cổ điển.

## Chạy trên máy

Cần **Node.js 24.x** (kết nối PostgreSQL trên Supabase):

```sh
npm ci
# Điền DATABASE_URL trong .env trước khi chạy
npm run db:migrate
npm start
```

Mở **http://localhost:3000**. Nếu còn server `serve` của phiên bản cũ trên cổng 3000, dừng server cũ rồi chạy lại `npm start`. Có thể chọn cổng khác bằng `PORT=3001 npm start`, nhưng bản lưu trình duyệt gắn với địa chỉ/cổng cũ.

Website nay có máy chủ và cơ sở dữ liệu, không còn triển khai chỉ bằng thư mục web tĩnh. Trang cộng đồng không tải bộ Java; CheerpJ chỉ tải khi mở trình giả lập. Lần khởi động game đầu tiên cần Internet và có thể chờ lâu.

## Chạy bằng Docker

Cần Docker Engine và Docker Compose. Dùng `.env` hiện tại; nếu chưa có thì sao chép `.env.example` sang `.env` rồi điền kết nối Supabase.

```sh
docker compose build
# Chỉ chạy migration khi tạo database mới hoặc cập nhật schema:
docker compose run --rm web node scripts/migrate-database.js
docker compose up -d
```

Mở http://localhost:3000. Dừng tiến trình `npm start` đang dùng cổng 3000 trước khi chạy container. Để thử song song: `WEB_PORT=3001 docker compose up -d` và đặt `SITE_ORIGIN=http://localhost:3001` trong `.env` cho cổng thử đó.

```sh
docker compose logs -f web
docker compose ps
docker compose down
# Sau khi sửa mã nguồn:
docker compose up -d --build
# Cấp quyền admin:
docker compose exec web node server/admin.js email@example.com
```

Container dùng Supabase hiện tại, giữ tệp local trong thư mục `./data` và chạy dưới UID 1000 (user node). Nếu thư mục này thuộc user khác, cấp quyền ghi cho UID 1000 trước khi khởi động. `.env`, dữ liệu và thư mục tải game không được đóng vào image. Giá trị `NODE_ENV` từ `.env` được giữ lại để HTTP localhost hoạt động; khi triển khai HTTPS đặt `NODE_ENV=production` và `SITE_ORIGIN` đúng tên miền.

Mặc định chỉ mở cổng trên localhost. Để truy cập qua LAN, đặt `WEB_BIND_ADDRESS=0.0.0.0` và cập nhật `SITE_ORIGIN` theo địa chỉ truy cập.

Mạng game dùng cầu nối WebSocket → TCP trong container website, không cần Docker Tailscale riêng. Xem [cấu hình mạng](server/NETWORK.md).

## Tài khoản và admin

1. Chọn **Đăng ký**, nhập tên hiển thị, email và mật khẩu ít nhất 10 ký tự.
2. Để cấp quyền quản trị cho tài khoản đã đăng ký, chạy tại thư mục dự án:

   ```sh
   npm run admin -- email-cua-ban@example.com
   ```

3. Tải lại trang, mở **Quản trị** → thêm thể loại → **Thêm game** và chọn JAR.

Không có mật khẩu admin mặc định; tài khoản đăng ký luôn là thành viên. Chỉ người vận hành có quyền chạy lệnh trên máy chủ mới cấp được admin. Có thể đổi mật khẩu trong nút tên tài khoản. Chưa có gửi email xác minh hoặc khôi phục mật khẩu qua email.

## Các chức năng

- **Kho game:** xem/tìm game công khai, lọc thể loại, mở chi tiết và chơi ngay; khách chưa đăng nhập cũng có thể chơi game công khai.
- **Đã chơi:** lịch sử game theo tài khoản, ghi khi màn hình giả lập khởi động. Nhấn Chơi ngay để mở lại cùng dữ liệu game trên trình duyệt đó.
- **Game của tôi:** tải game riêng lên máy chủ; chỉ chủ tài khoản xem metadata, tải tệp và chơi được. Admin cũng không truy cập game riêng của tài khoản khác qua API. Giới hạn 20 MB/game và 200 MB/kho cá nhân.
- **Diễn đàn:** bài viết chung hoặc thảo luận tại trang của từng game công khai, bình luận. Chủ nội dung và admin có thể xóa bài/bình luận. Nội dung là văn bản thuần, không chạy HTML.
- **Quản trị:** thêm/đổi tên/xóa thể loại, thêm/sửa thông tin/xóa game công khai, xóa nội dung thảo luận. Thể loại còn game phải chuyển game sang thể loại khác trước khi xóa.
- **Giả lập cũ:** `/emulator/index.html` vẫn mở game và bản lưu đã có trên trình duyệt, hỗ trợ chọn JAR trực tiếp không cần tài khoản. Game thêm bằng cách này chỉ nằm trên máy, không thuộc kho tài khoản và không có lịch sử trên máy chủ.

Chỉ nhận game **Java ME .jar** có lớp Java và khai báo MIDlet trong manifest; không hỗ trợ mã nguồn `.java` hay Java desktop. Máy chủ kiểm tra gói, không thực thi hay giải nén JAR vào filesystem. Game cần JAD riêng hoặc thiếu manifest có thể thử qua trình quản lý cũ.

## Bản lưu và quyền riêng tư

Danh sách game riêng và lịch sử chơi lưu trong cơ sở dữ liệu máy chủ, truy cập lại được khi đăng nhập trên máy khác. **Tiến trình trong game (RMS) vẫn lưu trong trình duyệt**, chưa đồng bộ lên tài khoản.

Game từ cộng đồng có thư mục giả lập tách theo tài khoản và ID game. Game cùng tên không ghi đè nhau. Lần chơi đầu dưới tài khoản mới dùng bản lưu mới; bản lưu của chế độ khách không tự chuyển vào tài khoản. Game cũ trên máy vẫn giữ nguyên.

Mở **Game & bản lưu trên máy** → **Xuất bản lưu** trước khi đổi máy, đổi địa chỉ/cổng hoặc xóa dữ liệu trình duyệt. Nhập ZIP bản lưu sẽ **thay thế** dữ liệu hiện có; đóng các tab đang chơi trước khi nhập. Bản xuất chứa toàn bộ dữ liệu giả lập của trình duyệt, có thể gồm game từ nhiều tài khoản đã dùng trên máy đó. Không chia sẻ bản xuất nếu có game riêng; dùng hồ sơ trình duyệt riêng trên máy dùng chung. Xóa game trên máy chủ không tự xóa bản đã tải trong trình duyệt; có thể gỡ tại trình quản lý cũ.

## Điều khiển

- Mũi tên: di chuyển. Enter hoặc 5: xác nhận.
- Q/W hoặc F1/F2: phím trái/phải. E/R: */#. 0–9: phím số.
- Esc: cài đặt giả lập. Phím L/R trên màn hình: phím chức năng trái/phải.
- Hộp chọn **Bố cục** đổi màn hình lớn, phím hai bên, phím bên dưới, Nokia cổ điển ngay khi chơi.

Nếu chưa có tiếng, nhấn phím hoặc chạm vào game để trình duyệt cho phép âm thanh.

## Dữ liệu và triển khai

Dữ liệu quan hệ nằm trên Supabase. Tệp local nằm trong `data/`, được loại khỏi Git:

- Database chính nằm trên **Supabase PostgreSQL**, gồm `users`, `sessions`, `categories`, `games`, `history`, `posts`, `comments`.
- Bản SQLite cũ nếu có chỉ là bản sao dự phòng, không còn được ứng dụng mở hoặc ghi.
- `uploads/`: tệp JAR ngoài thư mục public, trả về qua API có kiểm tra quyền.
- `tmp/`: tệp đang upload/kiểm tra.

Biến môi trường:

| Biến | Mặc định | Công dụng |
| --- | --- | --- |
| `PORT` | `3000` | Cổng HTTP |
| `DATA_DIR` | `data/` tại gốc dự án | Thư mục tệp JAR và upload tạm |
| `DATABASE_URL` | Bắt buộc | URI PostgreSQL Supabase Session pooler |
| `NODE_ENV` | development | Đặt `production` khi triển khai |
| `SITE_ORIGIN` | Origin của request ở localhost | Production bắt buộc `https://ten-mien`, không dấu `/` cuối |

Triển khai một tiến trình Node sau reverse proxy HTTPS, gắn ổ dữ liệu bền vững, chuyển tiếp đúng Host và mọi đường dẫn `/api`, `/emulator`. Ví dụ:

```sh
NODE_ENV=production SITE_ORIGIN=https://game.example.com DATA_DIR=/var/lib/java-corner PORT=3000 npm start
```

Production dùng cookie Secure; localhost dùng HTTP. Mật khẩu băm bằng scrypt; token phiên ngẫu nhiên chỉ lưu bản băm trong PostgreSQL, cookie HttpOnly/SameSite=Strict, hết hạn sau 7 ngày. API ghi dữ liệu yêu cầu đúng Origin và header của ứng dụng. Có giới hạn tần suất đăng nhập, đăng ký, upload và thảo luận. Mặc định không tin `X-Forwarded-For`; sau reverse proxy các khách chưa đăng nhập chia sẻ giới hạn theo địa chỉ proxy, cần cấu hình proxy tin cậy theo hạ tầng thực tế nếu mở rộng.

Sao lưu database qua Supabase hoặc `pg_dump`, đồng thời sao lưu `data/uploads/` vì tệp JAR vẫn lưu local. Chỉ sao chép `DATA_DIR` không đủ để sao lưu tài khoản/bài viết. Chưa chuyển JAR sang Storage trong đợt thay Database này.

Giữ HTTP Range (`206`) cho JAR/WASM và MIME WASM. Không bật clean URLs làm mất query `?app=...`. Không mở bằng `file://`.

## Kiểm tra

```sh
npm test
```

Kiểm tra tài khoản/phiên, đổi mật khẩu, bảo vệ Origin, phân quyền admin, JAR riêng tư, upload lỗi, lịch sử, lọc kho game, thảo luận và quyền xóa; kiểm tra thêm HTTP Range, ánh xạ phím, bố cục và lỗi hàng đợi điều khiển. Các test tích hợp dùng PostgreSQL thật qua `DATABASE_URL`, tạo schema `test_<uuid>` riêng và xóa schema đó khi xong; không ghi vào các bảng `public`. Cần quyền tạo schema trên database kiểm thử. Tệp upload kiểm thử nằm trong thư mục tạm. Có thể chạy với database kiểm thử khác bằng biến môi trường `DATABASE_URL`; giá trị ngoài môi trường ưu tiên hơn `.env`. Gameplay cần kiểm tra thêm trong trình duyệt có Internet.

## Nguồn

- [FreeJ2ME Web](https://github.com/zb3/freej2me-web), commit `c19416e75cbc15f9a27f7e967ee81cb108761e30`. Giấy phép và source upstream: `web/emulator/LICENSE.txt`, `web/emulator/upstream-source.zip`.
- [CheerpJ](https://cheerpj.com/): runtime tải từ CDN; không đóng gói trong dự án. Xem điều khoản nhà cung cấp khi triển khai thương mại.
- Upload dùng [Multer](https://expressjs.com/en/resources/middleware/multer/), giới hạn dung lượng và số tệp ở từng route.

Dự án không kèm game mẫu. `web/emulator/freej2me-web.jar` là runtime bắt buộc, không được xóa. Các chức năng SMS/dịch vụ điện thoại cũ không được chuyển thành dịch vụ web.

## Supabase Database đang sử dụng

Ứng dụng chỉ kết nối PostgreSQL qua `DATABASE_URL`; đã bỏ kết nối SQLite và không có fallback về database local. Khi Database không sẵn sàng, server báo lỗi và không khởi động thay vì dùng dữ liệu khác.

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@POOLER_HOST:5432/postgres
```

Lấy URI tại **Supabase → Connect → Session pooler**, thay mật khẩu đã URL-encode. Server đọc `.env`; file này bị loại khỏi Git. `.env.example` không chứa mật khẩu/key.

```sh
npm run supabase:check  # kiểm tra API, Storage và SELECT 1 trên PostgreSQL
npm run db:migrate     # tạo schema, index và quyền truy cập, chạy lại an toàn
npm start
```

Kết nối dùng pool tối đa 5 kết nối, TLS xác minh chứng chỉ và hostname. CA Supabase được đóng gói tại `server/certs/supabase-ca.crt`, tải từ [chứng chỉ CA do Supabase phân phối](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). Không dùng `rejectUnauthorized: false` hoặc tắt SSL; các lựa chọn SSL trong URI được thay bằng cấu hình xác minh của ứng dụng.

Schema tạo tại `public`, hiển thị trong Table Editor. RLS bật trên cả 7 bảng và quyền trực tiếp của `anon`/`authenticated` bị thu hồi. Frontend gọi Express API, không gọi bảng trực tiếp qua Supabase JS. Server dùng tài khoản PostgreSQL trong URI để kiểm tra phiên đăng nhập/quyền ứng dụng. Tài khoản thành viên vẫn dùng cơ chế đăng nhập của Java Corner, không tự chuyển sang Supabase Auth.

Admin được cấp bằng `npm run admin -- email@example.com`; lệnh cập nhật PostgreSQL.

### Storage

`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=game` và `SUPABASE_PRIVATE_STORAGE_BUCKET=game-private` đã được giữ lại để kiểm tra kết nối. **API upload/download game hiện vẫn dùng `data/uploads/`**, chưa dùng Storage. Bộ tải giaitri321 cũng vẫn ghi vào `downloads/giaitri321/`.

### Chuyển đổi ngày 16/09/2026

Kiểm tra trước chuyển đổi: cả 7 bảng SQLite không có bản ghi, Supabase `public` chưa có bảng. Không có tài khoản/game/bài viết cần chuyển. SQLite cũ được giữ tại `data/backups/` để đối chiếu; ứng dụng không sử dụng nó. Database mới không cần dữ liệu mẫu.

Rollback trước khi có dữ liệu mới: dừng server, khôi phục phiên bản ứng dụng SQLite trước chuyển đổi cùng bản backup local. Sau khi Supabase có dữ liệu mới, phải xuất và chuyển dữ liệu về trước khi rollback để tránh mất dữ liệu. Không xóa schema Supabase trong quá trình rollback; giữ lại để đối chiếu.

## Vercel

Xem [hướng dẫn triển khai Vercel](server/VERCEL.md) để cấu hình build, biến môi trường và Supabase Storage. Bản Vercel giới hạn upload 4 MB và relay Hobby tối đa 5 phút; game online chơi lâu cần backend chạy liên tục.
