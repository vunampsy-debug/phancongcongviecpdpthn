PDP TASK MANAGER - HƯỚNG DẪN TRIỂN KHAI
=======================================

I. CẤU TRÚC DATABASE GOOGLE SPREADSHEET
--------------------------------------
1. Mỗi tab/sheet tương ứng với 1 tuần.
2. Hàng 2 là hàng tiêu đề/header.
3. Dữ liệu công việc bắt đầu từ hàng 3.
4. Cột B cố định là: Họ và tên.
5. Cột C cố định là: Hạng mục công việc.
6. Header chuẩn đề xuất:
   A. STT
   B. Họ và tên
   C. Hạng mục công việc
   D. Chi tiết công việc
   E. Ngày hoàn thành
   F. Số ngày còn lại
   G. Mức độ ưu tiên
   H. Trạng thái công việc
   I. Nhân sự phối hợp
   J. Link minh chứng
   K. Kết quả công việc của tuần trước
   L. Công việc của tuần sau
   M. Ghi chú

Website có mục "Thiết lập bảng" để ghi lại hàng 2 cho một tab hoặc toàn bộ tab.

II. TẠO API TỪ GOOGLE SHEET BẰNG GOOGLE APPS SCRIPT
---------------------------------------------------
1. Mở Google Spreadsheet thật mà Nam muốn dùng làm database.
2. Vào Extensions > Apps Script.
3. Xóa code mặc định và dán toàn bộ nội dung file Code.gs.
4. Nếu Apps Script được mở trực tiếp từ spreadsheet đó, có thể để:
   const SPREADSHEET_ID = "";
5. Nếu tạo Apps Script độc lập, lấy ID trong URL Google Sheet:
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   rồi dán vào:
   const SPREADSHEET_ID = "ID_CUA_SHEET";
6. Bấm Save.
7. Bấm Run thử hàm doGet hoặc một hàm bất kỳ để cấp quyền lần đầu.
8. Deploy > New deployment.
9. Chọn type: Web app.
10. Execute as: Me.
11. Who has access: Anyone with link hoặc giới hạn trong domain FPT nếu tài khoản Workspace cho phép.
12. Deploy và copy Web App URL dạng /exec.

III. KẾT NỐI WEBSITE
--------------------
Cách 1 - nhanh nhất:
1. Mở website.
2. Vào chức năng "Nhúng URL" ở menu bên trái.
3. Dán URL /exec vào ô "Google Apps Script Web App URL".
4. Bấm "Lưu URL".
5. Bấm "Kiểm tra kết nối".

Cách 2 - cấu hình cố định:
1. Mở file app.js.
2. Dán URL /exec vào dòng:
   const DEFAULT_API_URL = "";
3. Ví dụ:
   const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
4. Save và deploy lại website.

IV. DEPLOY WEBSITE LÊN NETLIFY
------------------------------
1. Đăng nhập Netlify.
2. Add new site > Deploy manually.
3. Kéo thả thư mục chứa 3 file index.html, styles.css, app.js.
4. Sau khi deploy xong, mở website và dán URL /exec của Apps Script.

V. CÁCH SỬ DỤNG
---------------
1. Tab Tổng quan: xem số lượng công việc, việc sắp đến hạn, ưu tiên cao, hoàn thành. Mục "Phân bố theo nhân sự" có bộ chọn tuần để xem riêng từng tab/sheet.
2. Tab Công việc: lọc theo tuần, nhân sự, hạng mục, ưu tiên, trạng thái; sửa công việc trực tiếp.
3. Nút "Tạo nhãn công việc": thêm một dòng công việc mới vào tab tuần tương ứng.
4. Tab Thiết lập bảng: chuẩn hóa hàng 2 và thêm hạng mục công việc vào sheet ẩn _PDP_Config.
5. Tab Nhúng URL: lưu hoặc kiểm tra URL Google Apps Script Web App. Chức năng này được tách riêng, không nằm ở giao diện chính.

VI. LƯU Ý BẢO MẬT
-----------------
Nếu Deploy Apps Script ở chế độ "Anyone with link", ai có link API đều có thể ghi dữ liệu vào spreadsheet nếu biết cấu trúc request.
Để dùng nội bộ an toàn hơn, nên:
1. Chọn quyền truy cập trong domain/tổ chức nếu Google Workspace cho phép.
2. Không công khai URL /exec.
3. Có thể bổ sung API token trong Code.gs nếu cần kiểm soát chặt hơn.

VII. LOGIC CÔNG VIỆC CẦN CHÚ Ý
--------------------------------
Mục "Công việc cần chú ý" chỉ hiển thị công việc chưa hoàn thành và chưa quá deadline.
Cụ thể:
1. Công việc có hạn còn từ 0 đến 2 ngày sẽ được tính là sắp đến hạn.
2. Công việc ưu tiên Cao sẽ được đưa vào danh sách cần chú ý nếu chưa hoàn thành và chưa quá deadline.
3. Công việc có Số ngày còn lại < 0 hoặc Ngày hoàn thành đã qua sẽ bị bỏ qua trong mục cần chú ý.
4. Nếu cột "Số ngày còn lại" trên sheet bị cũ, website sẽ ưu tiên tự tính lại từ cột "Ngày hoàn thành".


URL Google Apps Script Web App đã được nhúng sẵn trong app.js:
https://script.google.com/macros/s/AKfycbxw_V9fW5EwP_dZvwl113ewDqYHdDX-yurb2FH8OgxIlHYnzVvU-OyVtRRf8RUjYU19iw/exec

Khi mở website, mục Nhúng URL sẽ tự điền URL này. Có thể thay URL khác trong giao diện nếu đổi sang Web App mới.

VIII. TỐI ƯU TỐC ĐỘ ĐỒNG BỘ
----------------------------
Bản này đã tối ưu cơ chế đọc dữ liệu so với bản trước:
1. Website dùng action=bootstrap để lấy meta + task trong một request duy nhất, thay vì gọi riêng meta và tasks.
2. Code.gs chỉ quét toàn bộ workbook một lượt khi tải lần đầu hoặc bấm "Làm mới dữ liệu".
3. Sau khi tạo/sửa/xóa một công việc, website chỉ đọc lại tab/sheet vừa thay đổi, không đọc lại toàn bộ spreadsheet.
4. Nút "Làm mới dữ liệu" vẫn ép đồng bộ toàn bộ workbook khi Nam chỉnh dữ liệu trực tiếp trên Google Sheet.

Quan trọng: Vì Code.gs đã thay đổi, cần cập nhật lại Apps Script:
1. Mở Apps Script đang kết nối với spreadsheet.
2. Dán lại toàn bộ file Code.gs mới.
3. Bấm Save.
4. Vào Deploy > Manage deployments.
5. Chọn biểu tượng bút chì ở deployment hiện tại.
6. Version chọn New version.
7. Bấm Deploy.

Nếu chỉ deploy lại Netlify nhưng không cập nhật Code.gs, website vẫn chạy được nhờ cơ chế fallback, nhưng tốc độ sẽ chưa được cải thiện rõ.

Gợi ý để spreadsheet chạy nhanh hơn:
1. Không để quá nhiều dòng trống có định dạng màu/viền trong từng tab tuần.
2. Không dùng công thức quá nặng trong toàn bộ hàng/cột.
3. Với các tuần đã kết thúc, có thể ẩn tab hoặc chuyển sang file lưu trữ riêng nếu số lượng tab tăng quá lớn.
4. Khi chỉ cần cập nhật một công việc từ website, ưu tiên sửa trực tiếp trên website để hệ thống đồng bộ một tab thay vì toàn bộ workbook.

IX. QUY TẮC HIỂN THỊ NHÃN CÔNG VIỆC TỪ GOOGLE SHEET
------------------------------------------------------
Bản này dùng cột B - "Họ và tên" làm điều kiện bắt buộc để tạo nhãn công việc trên website.

Quy tắc cụ thể:
1. Dòng trắng hoàn toàn sẽ không hiển thị thành nhãn công việc.
2. Dòng có dữ liệu ở các cột khác nhưng không có tên người thực hiện ở cột B cũng không hiển thị.
3. Dòng có tên người thực hiện ở cột B sẽ hiển thị thành nhãn công việc, kể cả khi cột C - Hạng mục công việc đang trống.
4. Khi tạo hoặc sửa công việc trên website, trường "Tên người thực hiện" là bắt buộc; trường "Hạng mục công việc" có thể để trống.
5. Khi xóa nhãn công việc trên website, hệ thống sẽ xóa toàn bộ nội dung dòng đó, bao gồm cả tên người thực hiện, để dòng đó không tiếp tục xuất hiện lại thành nhãn công việc.

Sau khi cập nhật bản này, cần thay lại cả website trên Netlify và Code.gs trong Apps Script, sau đó deploy Apps Script thành New version.


X. SỐ NGÀY CÒN LẠI VÀ DROPDOWN TRONG GOOGLE SHEET
------------------------------------------------------
Bản này cập nhật thêm tự động hóa trực tiếp trong Google Sheet:

1. Cột F - "Số ngày còn lại" không lưu số tĩnh nữa. Khi website tạo/sửa công việc, Apps Script sẽ ghi công thức tự động dựa trên cột E - "Ngày hoàn thành".
2. Logic công thức tương đương với spreadsheet dùng locale Việt Nam:
   =IF(E3="";"Chưa có deadline";IF(E3<TODAY();"Hết hạn";IF(E3=TODAY();"Hôm nay là deadline";"Còn "&(E3-TODAY())&" ngày")))
3. Code.gs tự nhận locale của Spreadsheet. Nếu file dùng locale Việt Nam hoặc các locale dùng dấu chấm phẩy, công thức sẽ dùng dấu ;. Nếu file dùng locale tiếng Anh/Mỹ, công thức sẽ dùng dấu ,.
4. Nếu cột "Số ngày còn lại" đang báo #ERROR! do bản cũ đã ghi công thức sai dấu phân tách, hãy cập nhật Code.gs mới, deploy Apps Script thành New version, sau đó bấm "Làm mới dữ liệu" trên website để ghi lại công thức đúng.
5. Nếu dùng Apps Script, hệ thống sẽ tự tạo công thức đúng theo vị trí cột "Ngày hoàn thành", kể cả khi header bị dịch khỏi cột E/F nhưng vẫn giữ đúng tên header.
6. Cột G - "Mức độ ưu tiên" được thiết lập dropdown gồm: Thấp, Trung Bình, Cao.
7. Cột H - "Trạng thái công việc" được thiết lập dropdown gồm: 0%, 25%, 50%, 75%, Hoàn thành.
8. Với công việc mới hoặc công việc được sửa từ website, công thức và dropdown sẽ được áp dụng ngay cho dòng đó.
9. Với dữ liệu cũ đang có sẵn trong spreadsheet, sau khi cập nhật Code.gs, có thể bấm "Làm mới dữ liệu" trên website một lần để ép chuẩn hóa lại công thức/dropdown, hoặc vào "Thiết lập bảng" > chọn "Tất cả tab" > "Lưu hàng 2".
10. Website cũng tự tính lại số ngày còn lại từ "Ngày hoàn thành" khi hiển thị, nên nhãn trên web không phụ thuộc vào việc công thức trong sheet đã kịp cập nhật hay chưa.


XI. PHẦN MỞ RỘNG TRONG NHÃN CÔNG VIỆC
-----------------------------------------
Bản này bổ sung thêm 3 trường vào nhãn công việc và lưu trực tiếp về Google Sheet:

1. Link minh chứng: lưu ở cột J. Có thể dùng link Google Drive, ảnh, tài liệu, file sản phẩm hoặc đường dẫn liên quan.
2. Kết quả công việc của tuần trước: lưu ở cột K, dùng để theo dõi việc đã hoàn thành, sản phẩm đầu ra hoặc vấn đề còn tồn.
3. Công việc của tuần sau: lưu ở cột L, dùng để chuyển tiếp nhiệm vụ sang tuần tiếp theo.

Trong form tạo/sửa công việc, 3 trường này nằm trong mục "Phần mở rộng: minh chứng và chuyển giao tuần" để không làm rối giao diện chính.
Trong bảng danh sách công việc, bấm "Mở rộng" ở từng nhãn để xem 3 thông tin này. Nếu có URL hợp lệ bắt đầu bằng http:// hoặc https://, website sẽ hiển thị nút "Mở minh chứng".

Lưu ý cập nhật:
1. Cần deploy lại website lên Netlify bằng index.html, styles.css và app.js mới.
2. Cần thay toàn bộ Code.gs trong Apps Script bằng bản mới.
3. Vào Deploy > Manage deployments > Edit > Version: New version > Deploy.
4. Sau đó bấm "Làm mới dữ liệu" trên website một lần.

UPDATE BUTTON FILE GỐC
-----------------------
Bản này đã thêm nút "Mở file Excel gốc" ở thanh trên cùng của website. Nút này mở trực tiếp Google Spreadsheet gốc tại:
https://docs.google.com/spreadsheets/d/1PVkSOs1RirIPAgKSUFm0ZJk_Lebw9lGh3zpTf6Or8nU/edit?usp=sharing

Nếu muốn đổi sang file Spreadsheet khác, mở index.html và thay giá trị href của thẻ có id="openSourceSheetBtn".
