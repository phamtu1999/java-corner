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

## Resource protection

Single-process limits: 4 live sockets/user, 60 handshake attempts/user/minute, 1,000 live sockets/process, 16 MiB bidirectional traffic/socket/minute. Login session revocation closes sockets immediately in this process; a 30-second validation loop also checks active sessions. Mail/infrastructure ports are blocked for both TCP and HTTP. GAME_ALLOWED_HOSTS optionally restricts exact hostnames; an empty list still permits other public destinations for JAR browser compatibility. This is not an abuse-proof public proxy.

TRUST_PROXY accepts explicit trusted proxy addresses/CIDRs for HTTP client IP rate limits. Leave empty for direct access; do not trust arbitrary forwarded headers. Multi-instance deployment needs shared concurrency/quota enforcement and cross-process revocation.

Uploads: one request/account per upload category, at most 2 cloud-save uploads or 4 game/media/avatar uploads per category in this process. Cloud saves spool to temporary disk before bounded processing; 50 MiB maximum remains. Forum media has a 200 MiB/account quota including soft-deleted posts; admission reserves 40 MiB before receiving attachments. At the boundary, removing existing attachments through edit can be refused; permanent deletion frees capacity.
