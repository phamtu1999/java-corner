# Thư viện và cộng đồng

Chạy `npm run db:migrate` trước khi khởi động phiên bản này. Các bảng mới đều bật RLS, không cấp quyền trực tiếp cho anon/authenticated; API kiểm tra session và quyền truy cập game.

- Yêu thích và đánh giá dùng khóa nhóm game. Mỗi người có một đánh giá mỗi nhóm và cần có lịch sử chơi phiên bản được đánh giá. Điểm tổng hợp cả nhóm, nhận xét giữ tên tệp phiên bản.
- Tiếp tục chơi lấy bốn game gần nhất, giữ ID phiên bản đã chơi.
- Tìm kiếm bỏ dấu tiếng Việt; lọc kết hợp thể loại, màn hình và hãng phát hành. Hãng được đọc từ MIDlet-Vendor của JAR; admin có thể sửa hàng loạt. `node --env-file-if-exists=.env scripts/backfill-publishers.js` bổ sung trường trống từ các JAR đã tải, không ghi đè chỉnh sửa admin.
- Báo lỗi gắn ID phiên bản; admin xem và đánh dấu xử lý hoặc mở lại.
- Bình luận thông báo cho tác giả và những người đã tham gia cùng chủ đề, trừ người vừa gửi. Mở danh sách sẽ đánh dấu những thông báo đang xem là đã đọc.
- Chỉnh sửa hàng loạt áp dụng cả nhóm phiên bản: thể loại, hãng, gộp nhóm, ẩn/hiện. Chọn cả trang chỉ chọn trang hiện tại. Các cập nhật chạy trong transaction. Ẩn game chặn truy cập qua API cho người dùng thường; JAR đã tải về và URL Storage công khai đã biết không bị thu hồi.
- Bản lưu tài khoản là snapshot ZIP toàn bộ thư viện/tiến trình do LauncherUtil xuất, tối đa 50 MB, lưu riêng trong PostgreSQL Supabase (cloud_saves và cloud_save_versions), tối đa 5 snapshot mỗi tài khoản. Đây là lưu/khôi phục thủ công, không tự đồng bộ khi thoát game. Khôi phục thay thế dữ liệu trên trình duyệt; nên xuất bản lưu hiện tại và đóng tab đang chơi trước. Revision chống ghi đè bản mới từ thiết bị khác; người dùng phải tải lại thông tin để xác nhận lại sau xung đột. Snapshot không được công khai qua Storage.

Kiểm thử: `npm test`. Test API tạo schema tạm riêng, không thay đổi game thật.

## Điều khiển, mốc lưu và quản lý nội dung

- Nút **Phím & cấu hình** trên màn chơi cho phép đổi phím riêng từng game, khôi phục mặc định, xuất/nhập JSON gồm phím, bố cục, âm lượng và thu/phóng. Cấu hình JSON không chứa tiến trình hoặc FPS.
- Bản lưu tài khoản hiện giữ **5 mốc gần nhất**, thay cho một snapshot: bản hiện tại trong `cloud_saves`, 4 bản trước trong `cloud_save_versions`. Mỗi mốc tối đa 50 MB, tổng tối đa 250 MB/tài khoản. Chọn ngày giờ rồi xác nhận để khôi phục. Lưu và khôi phục vẫn là thao tác thủ công.
- Hướng dẫn chơi nằm trong chi tiết từng phiên bản, admin chỉnh sửa. Diễn đàn có thẻ Chia sẻ/Hỏi đáp/Hướng dẫn; tác giả hoặc admin chọn một bình luận làm câu trả lời đã giải quyết.
- Thành viên báo cáo bài viết hoặc bình luận. Admin xem báo cáo diễn đàn, đánh dấu đã xử lý hoặc mở lại.
- Xóa game/bài viết đưa vào thùng rác, giữ tệp, bình luận và lịch sử. Nội dung không xuất hiện trong danh sách công khai. Admin khôi phục hoặc xác nhận xóa vĩnh viễn; không tự dọn thùng rác theo thời gian. Tệp JAR gốc trong Storage vẫn được giữ làm kho lưu trữ. Game riêng trong thùng rác vẫn tính dung lượng cho đến khi admin xóa vĩnh viễn.
- Tải JAR qua web kiểm tra SHA-256 với game công khai hoặc game của chính tài khoản; tệp trùng được báo và dẫn đến game hiện có. Không công khai thông tin game riêng của người khác. Các script nhập kho có quy trình riêng.

## Bộ sưu tập và trải nghiệm chơi

- Tải game hiển thị số byte/phần trăm nếu máy chủ cung cấp dung lượng; lỗi tải có nút thử lại. Nút chơi ưu tiên phiên bản đã chơi gần nhất của tài khoản.
- Thư viện máy có tìm tên không dấu, lọc chơi trong 7 ngày, sắp xếp gần nhất/dung lượng và chọn nhiều game để gỡ sau xác nhận. Mốc chơi gần nhất chỉ ghi từ khi tính năng được cài. Dung lượng từng game chỉ tính JAR; tổng dung lượng website là ước tính của trình duyệt.
- Chỉnh hồ sơ xem trước avatar và cảnh báo khi bỏ thay đổi chưa lưu.
- Thành viên theo dõi hoặc tắt thông báo từng chủ đề. Yêu cầu game có ba trạng thái Chờ xử lý/Đang tìm/Đã thêm; admin liên kết game công khai khi hoàn tất. Thành viên chỉ xem yêu cầu của mình.
- Chi tiết phiên bản hiển thị ngày thêm và tối đa 50 ghi chú cập nhật do admin nhập; không suy diễn lịch sử trước khi triển khai.

- Bộ sưu tập mặc định riêng tư, chủ sở hữu có thể công khai và chia sẻ `/games?collection=ID`. Chỉ thêm game công khai; game bị ẩn không xuất hiện cho khách.
- Hồ sơ `/forum?profile=ID` mặc định riêng tư. Người dùng tự bật công khai, sửa tên/giới thiệu và tải avatar ảnh tối đa 8 MB vào bucket media. Không công khai email. Khi công khai hiển thị tối đa 50 bài viết mới và các bộ sưu tập công khai.
- Nút trả lời ghi `reply_to` cùng bài viết, hiển thị trích đoạn. Thông báo gửi tác giả bài và người được trả lời; không gửi cho chính người viết. Xóa bình luận gốc giữ câu trả lời nhưng bỏ liên kết.
- Gợi ý phiên bản ưu tiên bản người dùng xác nhận chơi tốt, rồi hỗ trợ cảm ứng (admin xác nhận Có/Không/Chưa rõ), rồi khoảng cách kích thước màn hình. Đây là gợi ý, không phải kiểm định tương thích tự động.
- Bố cục, mức thu/phóng và âm lượng lưu trong localStorage theo app ID (có tài khoản và ID phiên bản đối với game cộng đồng). Giới hạn FPS lưu cùng cấu hình game trong LauncherUtil. FPS giới hạn nhịp khung hình, không thay đổi đồng hồ logic game. Các tùy chọn localStorage không nằm trong ZIP sao lưu tiến trình.
- Chụp ảnh từ canvas: tải PNG hoặc nhập tiêu đề/nội dung để đăng lên diễn đàn. Chỉ đăng khi bấm nút, ảnh dùng cùng luồng kiểm tra/media như bài viết bình thường.
- Kiểm tra game trong admin đọc từng 20 phiên bản, kiểm tra HEAD Storage hoặc tệp local, ảnh và thông tin màn hình. Lỗi mạng được báo là chưa kiểm tra được, không coi là mất tệp.
- Nhật ký quản trị ghi thay đổi game công khai kể từ khi cài migration: trước/sau, thời điểm và tài khoản thao tác. Trigger chạy cùng transaction với thay đổi. Tác vụ ngoài request ghi là Hệ thống. Nhật ký không thể dùng để tự khôi phục file game đã xóa.

## Tiện ích chơi và cộng đồng (18/09/2026)

- Bố cục, âm lượng, kích thước và bật/tắt mạng được nhớ theo game trên trình duyệt. Liên kết có `network=0/1` được ưu tiên. Mục **Tiếp tục chơi** mở lại phiên bản đã chơi.
- Nút **Hỗ trợ game** (biểu tượng thông tin) kiểm tra đăng nhập/kết nối website, hiển thị trạng thái kết nối game và cho xem toàn bộ nội dung trước khi gửi báo lỗi. Chỉ giữ 8 thông báo mạng gần nhất; không ghi nội dung bàn phím, mật khẩu hay toàn bộ console. Website truy cập được không đồng nghĩa máy chủ game đang hoạt động.
- Bật nút **T** để gõ trực tiếp hoặc nhập/dán vào ô chữ rồi chọn **Gửi vào game**. Chọn ô đích trong game trước. Nội dung mặc định được che, xóa sau khi gửi và không lưu. Ký tự ngoài BMP như emoji bị bỏ qua; mức hỗ trợ tiếng Việt tùy từng game.
- Mỗi phiên bản game có phản hồi **Chơi tốt / Lỗi hình / Lỗi kết nối / Không khởi động**, thống kê số người và cho thay đổi lựa chọn. Mỗi tài khoản chỉ có một lựa chọn cho mỗi phiên bản. Đây là phản hồi cộng đồng, không phải chứng nhận tương thích.
- **Bản lưu tài khoản** giữ 5 mốc có thời gian/dung lượng. Có thể khôi phục toàn thư viện hoặc chỉ RMS của một game đã cài và có trong bản lưu. Khôi phục riêng không thay JAR, cấu hình hay game khác; không khôi phục tiến trình trên máy chủ game. Đóng các tab game trước khi lưu/khôi phục. Giữ bản xuất dự phòng trước thao tác thay dữ liệu.
- Bài viết, sửa bài và bình luận có bản nháp theo tài khoản/chủ đề, khôi phục theo lựa chọn và xem trước văn bản. Tệp đính kèm không được lưu trong bản nháp. Đăng thành công mới xóa bản nháp. Trình duyệt dùng chung vẫn lưu bản nháp trên máy đó.
- Chủ đề có tìm kiếm trong các bình luận đã tải. Chọn thành viên trong chủ đề để nhắc tên (tối đa 10); tắt thông báo chủ đề vẫn được tôn trọng.

### Giới hạn đã đánh giá

Khôi phục RMS là khôi phục dữ liệu mà game đã ghi, không phải lưu tức thời toàn bộ RAM/luồng Java. Bộ chạy hiện chưa có API chụp/khôi phục trạng thái máy ảo trong tích hợp này. Chơi hoàn toàn ngoại tuyến cũng chưa bật: trang vẫn tải CheerpJ từ CDN; game online còn cần máy chủ từ xa. Không hiển thị nút hứa hẹn hai khả năng này khi chưa triển khai và kiểm thử.

Kiểm thử: `npm test`; `sh scripts/build-emulator-network.sh` (gồm TCP/HTTP và khôi phục RMS chọn lọc, chống đường dẫn vượt thư mục). Chạy `npm run db:migrate` trước khi triển khai API tương thích mới.

## Nâng cao: bản lưu, điều khiển và diễn đàn

- Thư viện có **Bản lưu** ở mỗi game: xuất ZIP tiến trình RMS, nhập lại cho đúng game đã cài và hoàn tác lần khôi phục gần nhất. Trước khi thay RMS, hệ thống tự giữ một bản `.last-restore.zip` trong thư mục game của trình duyệt. Bản này mất khi gỡ game/xóa dữ liệu trình duyệt; hãy xuất ZIP để lưu lâu dài. Không chứa JAR. Bản ZIP theo định danh game/tài khoản hiện tại, không tự chuyển đổi sang phiên bản game khác.
- Thời gian xuất và lời nhắc ở thư viện dựa trên lần chơi sau lần xuất; không khẳng định game đã ghi tiến trình mới. Lời nhắc không phải sao lưu định kỳ lên tài khoản.
- Nút tay cầm trong màn chơi hỗ trợ W3C Standard Gamepad: D-pad/cần trái, A/OK, B/phải, X/trái, Y/5, L/*, R/#. Chỉ nhận khi màn hình game có focus; nhả phím khi đổi tab, mở dialog hay tháo tay cầm. Tay cầm không có ánh xạ chuẩn được báo chưa hỗ trợ. Có nút toàn màn hình; ánh xạ bàn phím riêng từng game vẫn trong **Phím & cấu hình**.
- Diễn đàn lọc theo tác giả, bài của tôi, chưa trả lời và sắp xếp mới/cũ/nhiều trả lời. Tìm kiếm nội dung bỏ dấu tiếng Việt. Bài của tôi dùng quyền tài khoản hiện tại; thao tác sửa/xóa vẫn kiểm tra quyền tại API.
- Chuông thông báo cho tìm tên/chủ đề, chỉ chưa đọc và đánh dấu tất cả đã đọc. Mở danh sách không tự đánh dấu cả danh sách; mở thông báo thông thường đánh dấu riêng mục đó.
- Kiểm tra ánh xạ tay cầm dùng sự kiện mô phỏng trong Chromium; chưa kiểm chứng trên tay cầm vật lý. Tham chiếu chuẩn: https://www.w3.org/TR/gamepad/#remapping.


### Bổ sung tiến trình và điều khiển
- Bấm liên kết về thư viện trong trang chơi tạo mốc RMS, giữ 5 mốc gần nhất trong trình duyệt. Không chạy khi đóng tab, không phải savestate; dữ liệu game chưa ghi RMS không nằm trong mốc.
- Trong Bản lưu từng game, chọn mốc và xác nhận để khôi phục; vẫn có bản dự phòng trước khi thay dữ liệu.
- Bản lưu tài khoản ghi nhớ phiên bản đã đồng bộ theo tài khoản và cảnh báo khi phiên bản trên máy chủ khác. Xung đột HTTP 409 tải lại danh sách và yêu cầu xác nhận lại, không tự ghi đè.
- Tay cầm: ánh xạ nút riêng theo app, tắt từng nút, vùng chết analog 0.15–0.85, khôi phục mặc định. Lưu cấu hình trên trình duyệt.
- Hỗ trợ game hiển thị giai đoạn khởi động gần nhất; không tự kết luận nguyên nhân ứng dụng thoát, không thu thập nội dung nhập.
- Kiểm tra kho: liệt kê tệp trùng SHA-256, kiểm tra cấu trúc JAR lưu cục bộ. Với Supabase, nút Kiểm tra JAR tải từng tệp tối đa 50 MB, đối chiếu SHA-256 và cấu trúc MIDlet, giới hạn 5 lượt/phút.


### Công cụ bổ sung
- Bản mới trong thư viện: liệt kê bản cùng nhóm được đăng sau, cài riêng giữ nguyên bản cũ. Thời gian đăng không đảm bảo phiên bản phần mềm mới hơn.
- Cấu hình tốt: người dùng lưu và áp dụng cấu hình đã thử riêng từng app; không chứa tiến trình.
- Chỉnh phím cảm ứng: kéo tối đa 60 px, kích thước 70–120%, độ rõ 30–100%; Lưu/Hủy/Mặc định.
- Bản lưu game hiển thị dung lượng JAR, RMS, mốc và dự phòng. Dọn mốc có xác nhận và giữ RMS cùng bản hoàn tác.
- Phản hồi tương thích có mô tả cấu hình tối đa 300 ký tự, hiển thị 10 phản hồi cấu hình gần nhất.
- Hỗ trợ game xuất báo cáo .txt từ thông tin được xem trước.
- Chơi hoàn toàn offline chưa được triển khai: trang chơi vẫn cần CDN CheerpJ và API xác thực game. Không đánh dấu game đã sẵn sàng offline.

### Public catalog cache

Anonymous GET requests to games (public scope only), categories, publishers and game-screens share a per-process cache for 10 seconds, bounded to 100 entries. Concurrent identical requests share the pending response. Authenticated requests bypass this cache. Any completed API mutation invalidates it, including failed mutations that may have partially written data. Direct database/import changes and other server processes are reflected within the TTL. Browser responses remain no-store.

Repeat the read-only 50-client benchmark with `node scripts/load-web.mjs reports/load-50-users-cached.json`; this measures local anonymous HTTP, not emulator execution or game sockets.
