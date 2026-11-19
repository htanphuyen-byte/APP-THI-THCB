# 💻 Ứng Dụng Web Luyện Thi Trắc Nghiệm Tin Học (10 Bộ Đề Cố Định)

Ứng dụng web học và luyện thi trắc nghiệm Tin học được xây dựng dựa trên 100% câu hỏi và bảng đáp án gốc từ 3 tệp đề thi:
- `2512.Ca1.pdf` (40 câu)
- `2512.Ca2.pdf` (40 câu)
- `2512.Ca3.pdf` (40 câu)

---

## ✨ Tính năng đúng theo yêu cầu của bạn

1. **Làm từng câu một (Xong 1 câu mới chuyển qua câu mới)**:
   - Nút **"Câu tiếp theo"** và các chấm câu hỏi phía sau sẽ bị khóa cho đến khi bạn tick chọn đáp án của câu hiện tại.
2. **Giải thích lý thuyết chi tiết ngay lập tức**:
   - Ngay khi bạn chọn 1 đáp án (dù chọn **Đúng** hay **Sai**), hệ thống sẽ tô màu đáp án đúng, đánh dấu đáp án bạn chọn và hiển thị ngay **khung Giải thích lý thuyết chi tiết** để bạn hiểu bản chất.
3. **Chia thành 10 Bộ Đề Cố Định (Mỗi đề 40 câu - Đầy đủ 100% câu hỏi của cả 3 bộ đề)**:
   - **Bộ Đề 01**: Chuẩn Gốc Ca 1 (40 câu nguyên bản `2512.Ca1.pdf`)
   - **Bộ Đề 02**: Chuẩn Gốc Ca 2 (40 câu nguyên bản `2512.Ca2.pdf`)
   - **Bộ Đề 03**: Chuẩn Gốc Ca 3 (40 câu nguyên bản `2512.Ca3.pdf`)
   - **Bộ Đề 04 → 07**: 4 bộ đề Tổng Hợp Toàn Diện (40 câu cố định/đề, chia đều và phủ kín 100% toàn bộ 120 câu hỏi của 3 ca thi)
   - **Bộ Đề 08**: Trọng Tâm MS Word & Kiến Thức Máy Tính - Mạng (40 câu cố định)
   - **Bộ Đề 09**: Trọng Tâm MS Excel & MS PowerPoint (40 câu cố định)
   - **Bộ Đề 10**: Đề Thi Thử Tổng Hợp Chuẩn Cấu Trúc (40 câu cố định: 10 Word + 10 Excel + 10 PowerPoint + 10 Máy tính)
   - Danh sách câu hỏi thuộc mỗi đề được lưu cố định vĩnh viễn trong `data/questions_db.json` để bất cứ khi nào bạn muốn ôn lại đề nào thì tập câu hỏi của đề đó vẫn giữ nguyên 100%.
4. **Tự động xáo thứ tự câu hỏi mỗi lần nhấn vào làm đề**:
   - Mỗi lần bạn nhấn **"Vào Làm Đề (Xáo Câu)"** hoặc **"Làm lại đề này"**, thứ tự 40 câu hỏi bên trong bộ đề đó sẽ được xáo trộn ngẫu nhiên mới.
   - Ngoài ra còn có nút tùy chọn **"Đảo cả vị trí đáp án A/B/C/D"** nếu bạn muốn chống học vẹt vị trí đáp án.
5. **Chế độ Ôn Câu Hay Sai & Tra cứu nhanh 120 câu**:
   - Tự động lưu lại những câu bạn làm sai vào mục **"🔥 Câu Hay Sai"** trên thanh menu để bạn luyện riêng.
   - Hỗ trợ phím tắt bàn phím cực nhạy: nhấn **`A, B, C, D`** (hoặc **`1, 2, 3, 4`**) để chọn đáp án, nhấn **`Enter`** hoặc **`Space`** để qua câu tiếp theo.

---

## 🚀 Cách khởi chạy Server trong VS Code (Rất đơn giản)

### Cách 1: Nhấn đúp chuột chạy ngay (Nhanh nhất)
- Nhấn đúp vào file **`KHOI_CHAY_WEB.bat`** trong thư mục này.
- Trình duyệt sẽ tự động mở địa chỉ: **http://localhost:3000**

### Cách 2: Chạy bằng Terminal trong VS Code
1. Mở thư mục `Trắc Nghiệm Tin Học` bằng **VS Code**.
2. Mở Terminal trong VS Code (`Ctrl + ~` hoặc `Ctrl + J`).
3. Gõ lệnh:
   ```bash
   npm start
   ```
   *(Hoặc `node server.js`)*
4. Mở trình duyệt truy cập: **http://localhost:3000**

### Cách 3: Nhấn phím `F5` trong VS Code
- Dự án đã được cấu hình sẵn `.vscode/launch.json`. Bạn chỉ cần nhấn **`F5`** (Run and Debug) trong VS Code là server tự động chạy!
