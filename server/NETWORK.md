# Mạng ứng dụng Java qua Docker

Trang chơi dùng WebSocket → TCP và cầu nối HTTP/HTTPS, không dùng Tailscale. Phải đăng nhập tài khoản website. Kết nối đi qua Internet của máy chạy Docker (hoặc VPS khi triển khai).

## Hỗ trợ

- Socket TCP tới IPv4/IPv6 hoặc hostname Internet công khai, cổng 1–65535.
- HTTP/HTTPS: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS; dữ liệu nhị phân; trả mã trạng thái, header và nội dung về ứng dụng.
- Header được chuyển tiếp: Accept, Accept-Language, Content-Type, User-Agent, Authorization, Cookie, Range, If-Modified-Since và X-*. Cookie từ website không được gửi tới máy chủ bên ngoài.
- HTTP redirect trả về ứng dụng xử lý; server không tự theo redirect. Mỗi yêu cầu tiếp theo đều kiểm tra DNS lại và ghim IP đã kiểm tra vào kết nối.
- Nút tắt mạng đóng TCP đang mở và chặn yêu cầu mới; bật lại không tải trang. HTTP đang thực hiện có thể hoàn tất trước khi timeout.

## Giới hạn

Chặn localhost, IP mạng nội bộ, link-local, multicast, reserved và IPv4-mapped private. Tối đa 4 TCP/tài khoản; timeout kết nối 15 giây, idle 120 giây, bộ đệm 1 MB. HTTP 30 yêu cầu/phút/tài khoản; body base64 tối đa 32.000 ký tự (khoảng 24 KB), response tối đa 4 MB, timeout 15 giây.

Chưa hỗ trợ UDP/datagram, TLS socket `ssl://`, thông tin chứng chỉ qua HttpsConnection, hay tự động giữ cookie giữa các yêu cầu game. Không đảm bảo các ứng dụng có máy chủ đã ngừng hoạt động hoặc yêu cầu API Java ME khác sẽ chạy được. Army, Ngọc Rồng và UC Browser cần kiểm tra đăng nhập riêng; mở giao thức mạng không đồng nghĩa đã xác minh từng game.

## Build và kiểm tra

```sh
sh scripts/build-emulator-network.sh
node --test tests/game-network.test.js tests/network-recovery.test.js
docker compose up -d --build
```

Runtime hiện tại: `web/emulator/freej2me-web-relay-v2.jar`. Mã GPL bổ sung ở `web/emulator/network-src`; natives ở `web/emulator/src/relay.js`; chính sách IP ở `server/network-policy.js`. Nguồn và runtime FreeJ2ME gốc vẫn được giữ.
