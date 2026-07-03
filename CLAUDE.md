# Quang Vinh Portfolio — Context cho Claude

Portfolio dạng game 2D canvas: chiếc xe (cáo lái, thỏ ngồi ghế phụ — sprite nhìn trực diện)
chạy từ dưới lên trên bản đồ, đường kiểu phố **đi thẳng rồi quẹo vuông góc trái/phải ngẫu nhiên**,
**mỗi cột mốc được đặt tại một khúc quẹo**. Giao tiếp với user và toàn bộ UI bằng **tiếng Việt**.

## Quyết định đã chốt với user (đừng làm ngược lại)

- **Không backend.** Host static (Vercel/Netlify/GitHub Pages) cho bạn bè user xem.
- Góc nhìn **top-down**, xe đi từ dưới lên; user đã bác bỏ phương án side-view cuộn ngang.
- Đường **thẳng + quẹo vuông góc bo tròn góc** (không phải đường cong sin uốn lượn — đã bỏ).
- Xe là **SVG sprite** hai mặt, xoay theo hướng đường: chạy TỚI thấy **đuôi xe**
  (`src/assets/car-rear.svg` — cáo & thỏ quay lưng, tự vẽ phái sinh), chạy LÙI thấy
  **đầu xe** (`src/assets/car.svg` — file gốc của user, đã bỏ motion streaks).
  User đã bác bỏ phương án sprite trực diện cố định ("trông như xe đi lùi").
- Giữ phím W qua cột mốc: xe vẫn dừng (bỏ qua keydown auto-repeat) — nhả phím bấm lại để đi tiếp.
- Điều khiển: nút ▶/⏸, hai mũi tên `<` `>` (không dùng chữ "Mốc trước/Mốc sau"),
  **WASD + phím mũi tên** để tự lái (W/D tiến, S/A lùi, xe tự dừng khi cán qua cột mốc).
- Popup cột mốc: ảnh hiển thị **một tấm một** với hai mũi tên ‹ › (không phải lưới ảnh).
- Code phải **clean, dễ chỉnh sửa**, comment tiếng Việt.

## Luồng dữ liệu (quan trọng nhất)

Ưu tiên thấp → cao: `src/data/milestones.js` (mặc định) → `public/journey.json`
(bản deploy, ai cũng thấy) → localStorage (nháp trên máy user, key `qv-portfolio-milestones-v1`).

- Chỉnh sửa trên trang (EditModal) ghi localStorage, chỉ lưu diff so với mặc định.
- Nút "💾 Xuất dữ liệu" tải `journey.json` (ảnh/nhạc nhúng dataURL) → user bỏ vào `public/`
  và deploy lại để chia sẻ. Đây là cách duy nhất để bạn bè thấy nội dung đã chỉnh.
- Ảnh: nhiều ảnh/mốc (tối đa 8), tự nén về 1280px JPEG khi import (`src/utils/image.js`).
- Video mỗi mốc: `videoUrls` (tối đa 4 **link** YouTube/mp4 — KHÔNG upload file video,
  giữ journey.json/localStorage nhẹ vì host static). Hiện chung carousel với ảnh trong popup;
  lướt tới mục video thì nhạc nền tự tắt (`stopMusic`) để không chồng tiếng.
- Nhạc mỗi mốc: `audioUrl` (link YouTube → iframe ẩn, hoặc link mp3) ưu tiên hơn `audio`
  (file mp3 upload, dataURL). Tất cả qua `src/audio.js`; Web Audio + audio element được
  "unlock" trong mọi click/keydown để né autoplay-block. Nhạc dừng khi đóng popup/lái tiếp.

## Kiến trúc

- `src/components/JourneyCanvas.jsx` — toàn bộ canvas: sinh đường (seeded, `ROAD_SEED = 7`,
  đổi seed là đổi bản đồ), cảnh vật, cột mốc tại khúc quẹo (`computeMilestoneFracs` —
  chia khúc quẹo thành N nhóm, bốc ngẫu nhiên 1 quẹo/nhóm theo seed), xe, camera dọc,
  phím WASD, click biển mốc. Expose qua ref: `next/prev/pause/reset/driveTo/driveToMilestone/isAtMilestone/setSpeed`.
  Trường `frac` trong data KHÔNG còn quyết định vị trí mốc (vị trí thật là `st.mFracs`).
- `src/App.jsx` — ghép nối, thanh điều khiển, popup/edit state.
- `src/hooks/useMilestones.js` — merge 3 nguồn dữ liệu + export journey.json.
- `src/components/MilestonePopup.jsx` — popup + carousel 1 ảnh + lightbox.
- `src/components/EditModal.jsx` — chỉnh icon/năm/tiêu đề/mô tả/ảnh/nhạc.
- `src/styles.css` — bố cục. Kích thước màn hình chính do 2 hằng: `.app { max-width }`
  (bề ngang, hiện `1500px`) và `.canvas-wrap { height }` (chiều cao khung canvas, hiện
  `min(84vh, 960px)`). Canvas tự co giãn theo khung qua `ResizeObserver` trong JourneyCanvas —
  chỉ cần đổi 2 hằng này để phóng to/thu nhỏ, không đụng JS. Mobile: `@media (max-width:560px)`.

## Môi trường & vận hành

- Windows 11; Node 24 LTS cài qua winget (2026-07-02) tại `C:\Program Files\nodejs` —
  shell cũ có thể thiếu PATH: `$env:Path = "C:\Program Files\nodejs;$env:Path"`.
- Dev server: config "portfolio" trong `.claude/launch.json` (cmd wrapper set PATH), port 5173.
- Preview tab bị throttle rAF nên xe chạy chậm khi test — trên tab thật thì mượt.
- Lịch sử đầy đủ hơn trong memory của Claude Code (file `quang-vinh-portfolio-project.md`).
