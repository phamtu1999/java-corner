# Mạng ứng dụng Java qua Docker

Trang chơi dùng WebSocket → TCP và cầu nối HTTP/HTTPS, không dùng Tailscale. Phải đăng nhập tài khoản website. Kết nối đi qua Internet của máy chạy Docker (hoặc VPS khi triển khai).

## Hỗ trợ

- Socket TCP và HTTP chỉ tới endpoint công khai được quản trị viên duyệt cho từng JAR.
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

PostgreSQL-shared limit: 60 handshake attempts/user/minute. Single-process limits: 4 live sockets/user, 1,000 live sockets/process, 16 MiB bidirectional traffic/socket/minute. Login session revocation closes sockets immediately in this process; a 30-second validation loop also checks active sessions. Mail/infrastructure ports are blocked for both TCP and HTTP. GAME_NETWORK_ENDPOINTS is mandatory for outbound traffic: a JSON object mapping JAR SHA-256 to arrays of exact protocol://host:port endpoints. Unconfigured games are denied. The server obtains the hash from an accessible, non-hidden, non-deleted game record, never from the request. GAME_ALLOWED_HOSTS remains an additional restriction, not a replacement. The browser passes game_id from its community app ID. Locally imported JARs must be uploaded to the account catalog and opened from there to use an approved network policy. General browsing to arbitrary sites is intentionally unavailable. HTTP redirects are returned, not followed; subsequent requests are checked again.

TRUST_PROXY accepts explicit trusted proxy addresses/CIDRs for HTTP client IP rate limits. Leave empty for direct access; do not trust arbitrary forwarded headers. Multi-instance deployment needs shared concurrency/quota enforcement and cross-process revocation.

Uploads: one request/account per upload category, at most 2 cloud-save uploads or 4 game/media/avatar uploads per category in this process. Cloud saves spool to temporary disk before bounded processing; 50 MiB maximum remains. Forum media has a 200 MiB/account quota including soft-deleted posts; admission reserves 40 MiB before receiving attachments. At the boundary, removing existing attachments through edit can be refused; permanent deletion frees capacity.

## Security rollout

1. Run `npm run db:migrate` before starting/deploying this version. This creates `rate_limits` with RLS and no anon/authenticated grants. PostgreSQL atomic upserts enforce all existing HTTP rate buckets across instances. Store failures deny requests with 503; there is no in-memory fallback. Counters use hashed identifiers, database time and bounded cleanup of entries expired for over one day.
2. Set `GAME_NETWORK_ENDPOINTS` using actual `games.sha256` values and reviewed endpoints, e.g. `{"<sha256>":["tcp://game.example:14444","https://login.example:443"]}`. Do not infer trust from a title, wildcard or client-provided endpoint. New JAR versions require a reviewed entry.
3. Deploy server and emulator JS together. The network bridge now sends game_id. Private bucket metadata is checked both before upload and signing.
4. Verify login/upload/report and an allowed game endpoint on staging before production. Concurrency and bandwidth caps remain per socket/process; request/handshake rate counters are distributed. This is not a global bandwidth billing quota.

CSP applies only to community HTML. Inline bootstrap is hash-approved, script attributes/eval/objects are blocked. Supabase media origin is derived from SUPABASE_URL. Emulator pages retain their existing policy because CheerpJ needs its runtime scripts and WASM.
