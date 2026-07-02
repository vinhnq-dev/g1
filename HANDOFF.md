# HANDOFF — quang-vinh-portfolio (phiên 2026-07-02)

Ghi chú bàn giao để tiếp tục công việc trên máy khác vào ngày mai.

## Bối cảnh dự án

- **Dự án:** `quang-vinh-portfolio` — portfolio dạng "hành trình lái xe": chiếc xe canvas 2D chạy dọc bản đồ từ dưới lên, dừng ở các cột mốc sự nghiệp (milestones) hiện popup + nhạc.
- **Công nghệ:** React 18 + Vite 5, vẽ bằng Canvas 2D thuần trong `src/components/JourneyCanvas.jsx`.
- Người dùng trao đổi với Claude bằng **tiếng Việt**.

## Việc đã làm hôm nay (2026-07-02)

1. **Yêu cầu:** "cho chiếc xe đi thẳng và quẹo các con đường qua trái qua phải chứ đừng đi 1 đường thẳng" — trước đó đường sinh bằng Catmull-Rom qua các điểm ngẫu nhiên, nhìn gần như một đường thẳng dọc.
2. **Đã viết lại thuật toán sinh đường** trong `src/components/JourneyCanvas.jsx`:
   - Xóa hàm `catmullRom` và `roadXAt` cũ.
   - `buildPath(w)` mới: sinh "khung xương" đường kiểu phố — các đoạn dọc đi thẳng lên xen kẽ các đoạn ngang quẹo vuông góc trái/phải (ngẫu nhiên theo seed `ROAD_SEED = 7`, dùng PRNG `mulberry32` nên lần nào tải cũng ra cùng một con đường), góc cua bo tròn bằng bezier bậc 2 với bán kính `CORNER_R`.
   - Hằng số mới dễ chỉnh ở đầu file (giá trị hiện tại):
     | Hằng số | Giá trị | Ý nghĩa |
     |---|---|---|
     | `STRAIGHT_MIN` / `STRAIGHT_MAX` | 240 / 460 | độ dài đoạn thẳng dọc (px) |
     | `TURN_MIN` / `TURN_MAX` | 130 / 320 | độ dài đoạn ngang khi quẹo (px) |
     | `CORNER_R` | 44 | bán kính bo cua để xe ôm cua mượt |
     | `ROAD_SEED` | 7 | đổi số này để có mạng đường khác |
   - Hằng `WAYPOINT_GAP` cũ đã bị **xóa**.
   - `buildScenery` viết lại: rải cây/bụi/hoa quanh đường bằng rejection sampling với hàm mới `distToPath` (vì đường giờ có cả đoạn ngang nên cách cũ dựa trên tung độ y không dùng được nữa).
   - Các phần khác (`pointAt`, camera, xe, cột mốc, click) **giữ nguyên** — chúng hoạt động trên mảng điểm mẫu `pts` nên không cần sửa.
3. **Đã kiểm tra logic** bằng script Node (mô phỏng `buildPath` ở các bề rộng 360/720/1280/1920px): kết quả ~10 khúc quẹo (5 trái, 5 phải), không NaN, không tràn biên, không điểm trùng.

## Việc còn lại cho ngày mai

- [ ] Chạy `npm run dev` và xem bằng mắt trên trình duyệt: xe ôm cua có mượt không, biển cột mốc có bị đè lên đoạn đường ngang gần đó không (hiếm nhưng có thể xảy ra), cây cối phân bố có đẹp không.
- [ ] Tinh chỉnh nếu cần (tất cả hằng số ở đầu `src/components/JourneyCanvas.jsx`):
  - Muốn đường quẹo **nhiều/ít hơn**: chỉnh `STRAIGHT_MIN` / `STRAIGHT_MAX`.
  - Muốn khúc quẹo **dài hơn**: chỉnh `TURN_MIN` / `TURN_MAX`.
  - Muốn cua **gắt/mượt hơn**: chỉnh `CORNER_R`.
  - Muốn **hình dáng đường khác**: đổi `ROAD_SEED`.
- [ ] Cân nhắc tăng `WORLD_H` (hiện là `3800`) nếu muốn hành trình dài hơn — tổng quãng đường thực tế (tính cả các đoạn ngang) hiện ~5300–5700px tùy bề rộng màn hình.

## Cách chạy

Lệnh lấy từ `package.json` (scripts):

```bash
npm install        # lần đầu trên máy mới
npm run dev        # chạy dev server (vite)
npm run build      # build production (vite build)
npm run preview    # xem thử bản build (vite preview)
```

**Lưu ý:** Dự án **KHÔNG** phải git repo — nằm trong OneDrive (`C:\Users\vinhn\OneDrive\Documents\Claude\quang-vinh-portfolio`) nên tự đồng bộ giữa các máy. Nhớ chờ OneDrive sync xong trước khi mở trên máy khác.
