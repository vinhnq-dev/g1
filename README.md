# 🚗 Quang Vinh Portfolio

Portfolio dạng hành trình: chiếc ô tô (nhìn từ trên xuống) chạy dọc con đường uốn lượn
ngẫu nhiên, dừng lại tại từng cột mốc sự nghiệp. Làm bằng **React + Vite + Canvas 2D**,
**không cần backend**.

## Chạy thử trên máy

```bash
npm install
npm run dev     # mở http://localhost:5173
```

## Chỉnh nội dung

### Cách 1 — Sửa code (khuyên dùng cho nội dung "gốc")

Mở [src/data/milestones.js](src/data/milestones.js): mỗi cột mốc có `icon`, `year`,
`title`, `desc` và `frac` (vị trí trên đường, 0 → 1). Thêm/bớt phần tử trong mảng là
thêm/bớt cột mốc.

Muốn con đường uốn lượn kiểu khác? Đổi `ROAD_SEED` trong
[src/components/JourneyCanvas.jsx](src/components/JourneyCanvas.jsx).

### Cách 2 — Chỉnh ngay trên trang

Bấm **✏️ Chỉnh sửa** trong thẻ thông tin của cột mốc:

- **Ảnh**: chọn nhiều ảnh cùng lúc (tối đa 8/mốc) — ảnh được tự nén về 1280px cho nhẹ.
  Trong popup, bấm vào ảnh để phóng to.
- **Nhạc**: dán **link YouTube** (phát qua trình phát ẩn) hoặc **link mp3 trực tiếp**,
  hoặc tải file mp3 lên (≤2.5MB). Nếu điền cả hai thì link được ưu tiên.
  Nhạc tự dừng khi đóng popup hoặc xe chạy tiếp.

Chỉnh sửa được lưu trong **trình duyệt của bạn** (localStorage).

Muốn **bạn bè cũng thấy** nội dung đã chỉnh:

1. Bấm **💾 Xuất dữ liệu (journey.json)** ở cuối trang.
2. Chép file `journey.json` vừa tải về vào thư mục `public/` của project.
3. Deploy lại. Trang sẽ tự nạp `public/journey.json` cho mọi người xem.

Thứ tự ưu tiên dữ liệu: mặc định trong code → `public/journey.json` → localStorage.

## Deploy (miễn phí)

Trang là static site thuần nên deploy đâu cũng được:

- **Vercel / Netlify**: import repo, framework chọn Vite — build command `npm run build`,
  output `dist`. Xong.
- **GitHub Pages**: thêm `base: '/<tên-repo>/'` vào `vite.config.js`, build rồi đẩy
  thư mục `dist` lên nhánh `gh-pages`.

## Cấu trúc

```
src/
├── data/milestones.js        # ✏️ Nội dung cột mốc mặc định — sửa ở đây
├── hooks/useMilestones.js    # Gộp dữ liệu: mặc định + journey.json + localStorage
├── audio.js                  # Web Audio: tiếng "ding" + phát file người dùng tải lên
├── components/
│   ├── JourneyCanvas.jsx     # Canvas: đường đi, xe, cột mốc, camera, cảnh vật
│   ├── MilestonePopup.jsx    # Thẻ thông tin khi xe dừng tại mốc
│   └── EditModal.jsx         # Hộp thoại chỉnh sửa cột mốc
├── App.jsx                   # Ghép nối + thanh điều khiển
└── styles.css
```
