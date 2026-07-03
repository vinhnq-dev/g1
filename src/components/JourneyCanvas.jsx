import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import carFrontUrl from '../assets/car.svg';
import carRearUrl from '../assets/car-rear.svg';

// ===== Các hằng số dễ chỉnh =====
const WORLD_H = 3800; // chiều dài hành trình (px), camera trượt dọc theo xe
const BASE_SPEED = 230; // tốc độ xe cơ bản (px/giây)
const ROAD_SEED = 7; // đổi số này để có một mạng đường quẹo khác
const ROAD_WIDTH = 46;
// Đường kiểu phố: chạy thẳng từng đoạn rồi quẹo vuông góc trái/phải.
const STRAIGHT_MIN = 240; // đoạn thẳng dọc ngắn nhất (px)
const STRAIGHT_MAX = 460; // đoạn thẳng dọc dài nhất (px)
const TURN_MIN = 130; // đoạn ngang ngắn nhất khi quẹo (px)
const TURN_MAX = 320; // đoạn ngang dài nhất khi quẹo (px)
const CORNER_R = 44; // bán kính bo tròn góc cua để xe ôm cua mượt

// Xe sprite (cáo lái, thỏ ngồi ghế phụ), xoay theo hướng đường:
// chạy TỚI thấy đuôi xe (đi xa dần), chạy LÙI thấy đầu xe (tiến về người xem).
const CAR_W = 76;
const CAR_H = (CAR_W * 360) / 480;
const carFrontImg = new Image();
carFrontImg.src = carFrontUrl;
const carRearImg = new Image();
carRearImg.src = carRearUrl;

// Phím điều khiển: W/D (hoặc ▲/▶) tiến — S/A (hoặc ▼/◀) lùi.
const FWD_KEYS = ['w', 'd', 'arrowup', 'arrowright'];
const BACK_KEYS = ['s', 'a', 'arrowdown', 'arrowleft'];

// Bộ sinh số ngẫu nhiên có seed — con đường "random" nhưng lần nào tải cũng giống nhau.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dựng con đường kiểu phố: khung xương là các đoạn vuông góc xen kẽ —
// đi thẳng lên một đoạn, quẹo ngang trái/phải một đoạn, rồi lại đi thẳng.
// Các góc cua được bo tròn (bezier bậc 2) để xe ôm cua mượt.
function buildPath(w) {
  const rnd = mulberry32(ROAD_SEED);
  const xMin = Math.max(60, w * 0.14);
  const xMax = Math.max(xMin + 80, Math.min(w - 60, w * 0.86));

  // 1) Sinh các góc cua (polyline vuông góc từ đáy lên đỉnh thế giới).
  let x = xMin + (xMax - xMin) * (0.3 + rnd() * 0.4);
  let y = WORLD_H - 90;
  const corners = [{ x, y }];
  while (y > 90) {
    y -= STRAIGHT_MIN + rnd() * (STRAIGHT_MAX - STRAIGHT_MIN);
    if (y < 90 + STRAIGHT_MIN * 0.5) y = 90; // đoạn chót chạy thẳng tới đích
    corners.push({ x, y });
    if (y <= 90) break;

    // Quẹo trái hoặc phải; nếu bên đó hết chỗ thì quẹo bên kia.
    let dir = rnd() < 0.5 ? -1 : 1;
    if ((dir > 0 ? xMax - x : x - xMin) < TURN_MIN) dir = -dir;
    const room = dir > 0 ? xMax - x : x - xMin;
    const len = Math.min(room, TURN_MIN + rnd() * (TURN_MAX - TURN_MIN));
    if (len >= 40) {
      x += dir * len;
      corners.push({ x, y });
    }
  }

  // 2) Bán kính bo góc tại từng góc cua (không vượt quá nửa đoạn kề).
  const segLen = [];
  for (let i = 0; i < corners.length - 1; i++) {
    segLen.push(Math.hypot(corners[i + 1].x - corners[i].x, corners[i + 1].y - corners[i].y));
  }
  const radii = corners.map((c, j) =>
    j === 0 || j === corners.length - 1
      ? 0
      : Math.min(CORNER_R, segLen[j - 1] / 2, segLen[j] / 2)
  );

  // 3) Lấy mẫu dày: đoạn thẳng + cung bo góc, để tính quãng đường chính xác.
  const pts = [];
  const push = (px, py) => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(px - last.x, py - last.y) > 0.5) pts.push({ x: px, y: py });
  };
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    const ux = (b.x - a.x) / segLen[i];
    const uy = (b.y - a.y) / segLen[i];
    // phần thẳng, chừa chỗ hai đầu cho cung bo góc
    const sx = a.x + ux * radii[i];
    const sy = a.y + uy * radii[i];
    const ex = b.x - ux * radii[i + 1];
    const ey = b.y - uy * radii[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(ex - sx, ey - sy) / 12));
    for (let k = 0; k <= n; k++) push(sx + ((ex - sx) * k) / n, sy + ((ey - sy) * k) / n);
    // cung bo góc tại b: bezier bậc 2 với điểm điều khiển là chính góc cua
    if (radii[i + 1] > 0) {
      const c = corners[i + 2];
      const len2 = segLen[i + 1];
      const qx = b.x + ((c.x - b.x) / len2) * radii[i + 1];
      const qy = b.y + ((c.y - b.y) / len2) * radii[i + 1];
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const mt = 1 - t;
        push(mt * mt * ex + 2 * mt * t * b.x + t * t * qx, mt * mt * ey + 2 * mt * t * b.y + t * t * qy);
      }
    }
  }

  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];

  // 4) Vị trí (0→1) của đỉnh từng khúc quẹo — nơi sẽ đặt cột mốc.
  const cornerFracs = [];
  for (let j = 1; j < corners.length - 1; j++) {
    if (radii[j] <= 0) continue;
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i].x - corners[j].x) ** 2 + (pts[i].y - corners[j].y) ** 2;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    cornerFracs.push(cum[bestI] / total);
  }

  return { pts, cum, total, cornerFracs, corners };
}

// Mỗi cột mốc được gán vào một khúc quẹo ngẫu nhiên (theo seed), trải đều từ
// đầu tới cuối đường: chia danh sách khúc quẹo thành N nhóm, bốc 1 quẹo mỗi nhóm.
function computeMilestoneFracs(path, count) {
  const corners = path.cornerFracs;
  if (corners.length < count) {
    // dự phòng khi đường quá ít khúc quẹo: chia đều quãng đường
    return Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));
  }
  const rnd = mulberry32(ROAD_SEED + 2);
  const fracs = [];
  const bucket = corners.length / count;
  for (let i = 0; i < count; i++) {
    const lo = Math.floor(i * bucket);
    const hi = Math.max(lo, Math.floor((i + 1) * bucket) - 1);
    fracs.push(corners[lo + Math.floor(rnd() * (hi - lo + 1))]);
  }
  return fracs;
}

// Điểm (và hướng đường) tại quãng đường d — tra cứu nhị phân trên mảng cộng dồn.
function pointAt(path, d) {
  const { pts, cum } = path;
  const dd = Math.max(0, Math.min(d, cum[cum.length - 1]));
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < dd) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const t = (dd - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const p0 = pts[i - 1];
  const p1 = pts[i];
  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    ang: Math.atan2(p1.y - p0.y, p1.x - p0.x),
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Khoảng cách từ một điểm tới tim đường (duyệt thưa mảng điểm mẫu — đủ chính xác).
function distToPath(path, x, y) {
  let best = Infinity;
  const { pts } = path;
  for (let i = 0; i < pts.length; i += 2) {
    const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// Khoảng cách từ một điểm tới một đoạn thẳng (dùng cho kênh nước).
function distToSeg(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
}

// Cảnh vật hai bên đường: cây, bụi hoa — sinh theo seed, rải gần đường
// nhưng loại bỏ vị trí đè lên mặt đường (đường có cả đoạn ngang) hoặc đè lên địa danh.
function buildScenery(path, w, landmarks) {
  const rnd = mulberry32(ROAD_SEED + 1);
  const items = [];
  const clear = ROAD_WIDTH / 2 + 26; // khoảng cách tối thiểu tới tim đường
  const nearLandmark = (x, y) =>
    landmarks.some((lm) =>
      lm.kind === 'canal'
        ? distToSeg(x, y, lm.x1, lm.y1, lm.x2, lm.y2) < 36
        : Math.hypot(lm.x - x, lm.y - y) < LM_RADIUS[lm.kind] + 16
    );
  let guard = 0;
  while (items.length < 65 && guard++ < 500) {
    const p = path.pts[Math.floor(rnd() * path.pts.length)];
    const ang = rnd() * Math.PI * 2;
    const dist = clear + 14 + rnd() * 140;
    const x = clamp(p.x + Math.cos(ang) * dist, 24, w - 24);
    const y = clamp(p.y + Math.sin(ang) * dist, 60, WORLD_H - 60);
    if (distToPath(path, x, y) <= clear) continue; // dính mặt đường → bỏ, thử vị trí khác
    if (nearLandmark(x, y)) continue; // đè lên địa danh → bỏ
    const type = rnd();
    items.push({
      x,
      y,
      kind: type < 0.5 ? 'tree' : type < 0.8 ? 'bush' : 'flower',
      s: 0.7 + rnd() * 0.6,
    });
  }
  return items;
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

function drawScenery(ctx, item) {
  const { x, y, s } = item;
  if (item.kind === 'tree') {
    ctx.fillStyle = 'rgba(0,0,0,.1)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 4, 17 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8f4f';
    ctx.beginPath();
    ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fa35f';
    ctx.beginPath();
    ctx.arc(x - 5 * s, y - 5 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.kind === 'bush') {
    ctx.fillStyle = '#5fae6b';
    ctx.beginPath();
    ctx.arc(x, y, 9 * s, 0, Math.PI * 2);
    ctx.arc(x + 8 * s, y + 2 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = ['#f78fb3', '#f5cd79', '#fff'][Math.floor((x + y) % 3)];
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Địa danh Sài Gòn dọc hành trình =====
// Tên đường gán lần lượt từ điểm xuất phát (dưới) lên đích (trên):
// đoạn chạy dọc lấy tên đường lớn, đoạn quẹo ngang lấy tên đường cắt ngang.
const V_STREETS = [
  'Nguyễn Đình Chính', 'Hoàng Sa', 'Hai Bà Trưng', 'Nam Kỳ Khởi Nghĩa', 'Pasteur',
  'Nguyễn Huệ', 'Đồng Khởi', 'Trường Sa', 'Điện Biên Phủ', 'Cách Mạng Tháng 8',
];
const H_STREETS = [
  'Sương Nguyệt Anh', 'Nguyễn Thị Minh Khai', 'Võ Thị Sáu', 'Nguyễn Đình Chiểu',
  'Hàn Thuyên', 'Lý Tự Trọng', 'Lê Thánh Tôn', 'Trần Cao Vân', 'Alexandre de Rhodes',
];

// Mỗi địa danh gắn với một tên đường; `at` = vị trí tương đối (0→1) trên đoạn đó.
const LANDMARK_DEFS = [
  { street: 'Lê Duẩn', name: 'Nhà thờ Đức Bà', kind: 'cathedral', at: 0.3 },
  { street: 'Lê Duẩn', name: 'Dinh Độc Lập', kind: 'palace', at: 0.72 },
  { street: 'Hoàng Sa', name: 'Kênh Nhiêu Lộc', kind: 'canal', at: 0.5 },
  { street: 'Hai Bà Trưng', name: 'Nhà thờ Tân Định', kind: 'pinkChurch', at: 0.33 },
  { street: 'Hai Bà Trưng', name: 'Chợ Tân Định', kind: 'market', at: 0.74 },
  { street: 'Nam Kỳ Khởi Nghĩa', name: 'Chợ Bến Thành', kind: 'benThanh', at: 0.45 },
  { street: 'Pasteur', name: 'Hồ Con Rùa', kind: 'turtleLake', at: 0.5 },
  { street: 'Nguyễn Huệ', name: 'Bitexco', kind: 'tower', at: 0.5 },
  { street: 'Đồng Khởi', name: 'Bưu điện Thành phố', kind: 'post', at: 0.5 },
];

// Bán kính "chiếm chỗ" của từng loại địa danh — để canh lề và dọn cây cỏ mọc đè lên.
const LM_RADIUS = {
  cathedral: 52, palace: 54, post: 46, pinkChurch: 46, benThanh: 50,
  market: 38, park: 58, turtleLake: 40, tower: 45, canal: 36,
};
// Vị trí nhãn tên (px dưới tâm địa danh).
const LM_LABEL_DY = {
  cathedral: 40, palace: 32, post: 33, pinkChurch: 40, benThanh: 34,
  market: 28, park: 44, turtleLake: 46, tower: 54,
};

// Gán tên đường cho từng đoạn của khung xương (bỏ qua đoạn quá ngắn).
function buildStreets(path) {
  const { corners } = path;
  const segs = [];
  let vi = 0;
  let hi = 0;
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    const vertical = Math.abs(a.x - b.x) < 1;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let name = null;
    if (len >= 150) {
      if (vertical && vi < V_STREETS.length) name = V_STREETS[vi++];
      else if (!vertical && hi < H_STREETS.length) name = H_STREETS[hi++];
    }
    segs.push({ a, b, vertical, len, name });
  }
  return segs;
}

// Đặt địa danh cạnh đúng con đường của nó: thử bên rộng trước, kẹt thì đổi bên,
// cả hai bên đều đụng đường khác / mép bản đồ thì bỏ qua địa danh đó.
function buildLandmarks(path, streets, w) {
  const items = [];
  for (const def of LANDMARK_DEFS) {
    const seg = streets.find((s) => s.name === def.street);
    if (!seg) continue;
    const ux = (seg.b.x - seg.a.x) / seg.len;
    const uy = (seg.b.y - seg.a.y) / seg.len;
    const nx = -uy; // pháp tuyến của đoạn đường
    const ny = ux;
    const px = seg.a.x + (seg.b.x - seg.a.x) * def.at;
    const py = seg.a.y + (seg.b.y - seg.a.y) * def.at;

    if (def.kind === 'canal') {
      // Kênh nước chạy song song mặt đường (như kênh Nhiêu Lộc dọc Hoàng Sa),
      // chừa hai đầu cho khúc quẹo.
      const trim = Math.max(50, seg.len * 0.15);
      const off = ROAD_WIDTH / 2 + 32;
      for (const side of [1, -1]) {
        const x1 = seg.a.x + ux * trim + nx * side * off;
        const y1 = seg.a.y + uy * trim + ny * side * off;
        const x2 = seg.b.x - ux * trim + nx * side * off;
        const y2 = seg.b.y - uy * trim + ny * side * off;
        if (Math.min(x1, x2) < 40 || Math.max(x1, x2) > w - 40) continue;
        items.push({
          kind: 'canal', name: def.name,
          x1, y1, x2, y2,
          x: (x1 + x2) / 2 + nx * side * 34, // vị trí nhãn: lệch ra xa đường thêm chút
          y: (y1 + y2) / 2 + ny * side * 34,
        });
        break;
      }
      continue;
    }

    const off = ROAD_WIDTH / 2 + 18 + LM_RADIUS[def.kind] * 0.85;
    const prefer = px < w / 2 ? 1 : -1; // ưu tiên phía còn nhiều chỗ trong khung
    for (const side of [prefer, -prefer]) {
      const x = px + nx * side * off;
      const y = py + ny * side * off;
      if (x < 55 || x > w - 55 || y < 80 || y > WORLD_H - 80) continue;
      if (distToPath(path, x, y) < ROAD_WIDTH / 2 + LM_RADIUS[def.kind] * 0.55) continue;
      items.push({ kind: def.kind, name: def.name, x, y });
      break;
    }
  }
  return items;
}

// Tên đường ghi trên mặt đường (kiểu bản đồ), xoay dọc theo đoạn đường.
function drawStreetNames(ctx, streets) {
  ctx.font = 'italic 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const s of streets) {
    if (!s.name) continue;
    if (ctx.measureText(s.name).width > s.len - 50) continue; // đoạn ngắn quá thì thôi
    ctx.save();
    ctx.translate((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2);
    if (s.vertical) ctx.rotate(-Math.PI / 2);
    ctx.fillText(s.name, 0, -12); // lệch khỏi vạch kẻ giữa đường
    ctx.restore();
  }
}

// Đổ bóng chung cho khối nhà — tạo cảm giác 2.5D nổi trên nền cỏ.
function blockShadow(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,.13)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -h / 2 + 6, w, h, 6);
  ctx.fill();
}

// Nhà thờ Đức Bà: gạch đỏ, hai tháp chuông chóp xám, cửa sổ hoa hồng.
function drawCathedral(ctx) {
  blockShadow(ctx, 84, 60);
  ctx.fillStyle = '#b3573a';
  ctx.beginPath();
  ctx.roundRect(-32, -8, 64, 36, 3);
  ctx.fill();
  ctx.fillStyle = '#c06246';
  ctx.fillRect(-40, -18, 16, 46);
  ctx.fillRect(24, -18, 16, 46);
  ctx.fillStyle = '#6b7683';
  ctx.beginPath();
  ctx.moveTo(-40, -18); ctx.lineTo(-32, -34); ctx.lineTo(-24, -18);
  ctx.moveTo(24, -18); ctx.lineTo(32, -34); ctx.lineTo(40, -18);
  ctx.fill();
  ctx.fillStyle = '#f4e9dc';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5, 12, 10, 16);
  ctx.strokeStyle = '#f4e9dc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-32, -40); ctx.lineTo(-32, -34); ctx.moveTo(-35, -38); ctx.lineTo(-29, -38);
  ctx.moveTo(32, -40); ctx.lineTo(32, -34); ctx.moveTo(29, -38); ctx.lineTo(35, -38);
  ctx.stroke();
}

// Dinh Độc Lập: khối ngang màu kem, rèm lam dọc, cờ đỏ sao vàng trên nóc.
function drawPalace(ctx) {
  blockShadow(ctx, 96, 40);
  ctx.fillStyle = '#efe7cf';
  ctx.beginPath();
  ctx.roundRect(-48, -20, 96, 40, 3);
  ctx.fill();
  ctx.fillStyle = '#d9cfae';
  ctx.fillRect(-48, -20, 96, 7);
  ctx.strokeStyle = '#c8bd97';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -40; i <= 40; i += 8) {
    ctx.moveTo(i, -10);
    ctx.lineTo(i, 6);
  }
  ctx.stroke();
  ctx.fillStyle = '#b7ab84';
  ctx.fillRect(-10, 6, 20, 14);
  ctx.strokeStyle = '#8a8f96';
  ctx.beginPath();
  ctx.moveTo(0, -20); ctx.lineTo(0, -38);
  ctx.stroke();
  ctx.fillStyle = '#d1352b';
  ctx.fillRect(0, -38, 14, 9);
  ctx.fillStyle = '#ffd84d';
  ctx.beginPath();
  ctx.arc(7, -33.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

// Bưu điện Thành phố: mặt tiền vàng, dãy cửa vòm trắng, đồng hồ giữa.
function drawPost(ctx) {
  blockShadow(ctx, 80, 42);
  ctx.fillStyle = '#eab648';
  ctx.beginPath();
  ctx.roundRect(-40, -13, 80, 34, 3);
  ctx.fill();
  ctx.fillStyle = '#93ac8c';
  ctx.beginPath();
  ctx.roundRect(-40, -21, 80, 10, [5, 5, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#fdf4e0';
  for (const dx of [-30, -18, 18, 30]) {
    ctx.beginPath();
    ctx.roundRect(dx - 4, 0, 8, 14, [4, 4, 0, 0]);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.roundRect(-9, -6, 18, 27, [9, 9, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = '#5b6770';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
  ctx.moveTo(0, 1); ctx.lineTo(0, -2.5);
  ctx.moveTo(0, 1); ctx.lineTo(2.5, 1);
  ctx.stroke();
}

// Nhà thờ Tân Định: màu hồng đặc trưng, tháp giữa cao viền trắng.
function drawPinkChurch(ctx) {
  blockShadow(ctx, 70, 56);
  ctx.fillStyle = '#f2a5c1';
  ctx.beginPath();
  ctx.roundRect(-31, 0, 62, 28, 3);
  ctx.fill();
  ctx.fillStyle = '#f6bacf';
  ctx.fillRect(-9, -30, 18, 58);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-9, -22, 18, 3);
  ctx.fillRect(-9, -8, 18, 3);
  ctx.fillStyle = '#d986aa';
  ctx.beginPath();
  ctx.moveTo(-11, -30); ctx.lineTo(0, -46); ctx.lineTo(11, -30);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -52); ctx.lineTo(0, -45);
  ctx.moveTo(-3, -49.5); ctx.lineTo(3, -49.5);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(-4, 14, 8, 14, [4, 4, 0, 0]);
  ctx.fill();
  for (const dx of [-20, 20]) {
    ctx.beginPath();
    ctx.roundRect(dx - 3, 6, 6, 10, [3, 3, 0, 0]);
    ctx.fill();
  }
}

// Chợ Bến Thành: nhà lồng mái ngói + tháp đồng hồ cổng nam.
function drawBenThanh(ctx) {
  blockShadow(ctx, 88, 44);
  ctx.fillStyle = '#eee0ba';
  ctx.fillRect(-44, -2, 88, 24);
  ctx.fillStyle = '#c96f4a';
  ctx.beginPath();
  ctx.roundRect(-44, -14, 88, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#a3906c';
  for (const dx of [-32, 32]) ctx.fillRect(dx - 4, 10, 8, 12);
  ctx.fillStyle = '#f2e6c4';
  ctx.fillRect(-11, -26, 22, 48);
  ctx.fillStyle = '#c96f4a';
  ctx.beginPath();
  ctx.moveTo(-13, -26); ctx.lineTo(0, -36); ctx.lineTo(13, -26);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -16, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5b6770';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -16); ctx.lineTo(0, -20);
  ctx.moveTo(0, -16); ctx.lineTo(3, -16);
  ctx.stroke();
  ctx.fillStyle = '#7a6446';
  ctx.beginPath();
  ctx.roundRect(-5, 8, 10, 14, [5, 5, 0, 0]);
  ctx.fill();
}

// Chợ Tân Định: chợ nhỏ mái hiên sọc đỏ trắng.
function drawMarket(ctx) {
  blockShadow(ctx, 64, 32);
  ctx.fillStyle = '#f0e4cd';
  ctx.beginPath();
  ctx.roundRect(-32, -12, 64, 28, 3);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#fff' : '#d64949';
    ctx.fillRect(-32 + i * 8, -17, 8, 9);
  }
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-14, -6, 28, 6);
  ctx.fillStyle = '#9c7c52';
  for (const dx of [-20, 0, 20]) ctx.fillRect(dx - 5, 4, 10, 12);
}

// Công viên Tao Đàn: thảm cỏ đậm, lối đi dạo, cụm cổ thụ.
function drawPark(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.beginPath();
  ctx.ellipse(4, 5, 52, 33, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#57a465';
  ctx.beginPath();
  ctx.ellipse(0, 0, 52, 33, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#65b573';
  ctx.beginPath();
  ctx.ellipse(0, 0, 45, 27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e7dbb6';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-40, 8);
  ctx.quadraticCurveTo(0, 22, 40, -4);
  ctx.stroke();
  for (const [dx, dy, r] of [[-26, -8, 11], [-4, -14, 9], [20, -6, 12], [8, 8, 8]]) {
    ctx.fillStyle = '#3c8a4d';
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c9c5c';
    ctx.beginPath();
    ctx.arc(dx - r * 0.3, dy - r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Hồ Con Rùa: vành bê tông tròn, mặt nước, đài hoa bê tông giữa hồ + chú rùa.
function drawTurtleLake(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,.1)';
  ctx.beginPath();
  ctx.arc(4, 4, 33, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cdd0c6';
  ctx.beginPath();
  ctx.arc(0, 0, 33, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6ab2dc';
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0.4, 1.6);
  ctx.stroke();
  ctx.strokeStyle = '#9aa096';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
  }
  ctx.stroke();
  ctx.fillStyle = '#8c9390';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f7d4a';
  ctx.beginPath();
  ctx.ellipse(12, 12, 4.5, 3.2, 0.6, 0, Math.PI * 2);
  ctx.fill();
}

// Bitexco: tháp kính thon dần lên đỉnh, sân đậu trực thăng chìa ra.
function drawTower(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath();
  ctx.ellipse(10, 40, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7fbede';
  ctx.beginPath();
  ctx.moveTo(-14, 42);
  ctx.quadraticCurveTo(-17, -8, -4, -42);
  ctx.lineTo(4, -42);
  ctx.quadraticCurveTo(17, -8, 14, 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.moveTo(-7, 42);
  ctx.quadraticCurveTo(-9, -8, -2, -40);
  ctx.lineTo(1, -40);
  ctx.quadraticCurveTo(-2, -8, -1, 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#aeb6bd';
  ctx.beginPath();
  ctx.ellipse(-13, -18.5, 9, 4, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9d1d8';
  ctx.beginPath();
  ctx.ellipse(-13, -20, 9, 4, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8f979e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(0, -52);
  ctx.stroke();
}

// Kênh Nhiêu Lộc: dải nước xanh song song đường, gợn sóng + thuyền nhỏ.
function drawCanal(ctx, lm) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5aa7d6';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(lm.x1, lm.y1);
  ctx.lineTo(lm.x2, lm.y2);
  ctx.stroke();
  ctx.strokeStyle = '#7cc0e6';
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 16]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#8a5b34';
  ctx.beginPath();
  ctx.ellipse(
    (lm.x1 + lm.x2) / 2, (lm.y1 + lm.y2) / 2,
    9, 3.5, Math.atan2(lm.y2 - lm.y1, lm.x2 - lm.x1), 0, Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

const LM_DRAW = {
  cathedral: drawCathedral, palace: drawPalace, post: drawPost,
  pinkChurch: drawPinkChurch, benThanh: drawBenThanh, market: drawMarket,
  park: drawPark, turtleLake: drawTurtleLake, tower: drawTower,
};

// Nhãn tên địa danh: viên thuốc trắng chữ xám, giống nhãn cột mốc nhưng nhỏ hơn.
function drawLmLabel(ctx, text, x, y) {
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.beginPath();
  ctx.roundRect(x - tw / 2 - 5, y - 9, tw + 10, 18, 7);
  ctx.fill();
  ctx.fillStyle = '#41525f';
  ctx.fillText(text, x, y + 0.5);
}

function drawLandmark(ctx, lm) {
  if (lm.kind === 'canal') {
    drawCanal(ctx, lm);
    drawLmLabel(ctx, lm.name, lm.x, lm.y);
    return;
  }
  ctx.save();
  ctx.translate(lm.x, lm.y);
  LM_DRAW[lm.kind](ctx);
  ctx.restore();
  drawLmLabel(ctx, lm.name, lm.x, lm.y + LM_LABEL_DY[lm.kind]);
}

// Vị trí biển cột mốc: nằm lệch sang một bên đường, luân phiên trái/phải.
function markerPos(path, frac, index) {
  const p = pointAt(path, frac * path.total);
  const side = index % 2 === 0 ? 1 : -1;
  const nx = -Math.sin(p.ang) * side;
  const ny = Math.cos(p.ang) * side;
  const off = ROAD_WIDTH / 2 + 42;
  return { road: p, x: p.x + nx * off, y: p.y + ny * off, side };
}

function drawMilestone(ctx, path, m, frac, index, reached) {
  const { road, x, y, side } = markerPos(path, frac, index);

  // vạch dừng nhỏ trên mặt đường
  ctx.fillStyle = reached ? '#ffd166' : '#ffffff';
  ctx.beginPath();
  ctx.arc(road.x, road.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // đường nối mảnh từ đường tới biển
  ctx.strokeStyle = 'rgba(60,70,80,.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(road.x, road.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // biển tròn chứa icon
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.beginPath();
  ctx.arc(x + 3, y + 4, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fillStyle = reached ? '#ffd166' : '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = reached ? '#e8960c' : '#9aa3ad';
  ctx.stroke();
  ctx.font = '21px "Segoe UI Emoji", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(m.icon, x, y + 1);

  // nhãn năm + tiêu đề, đặt phía ngoài biển
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = side > 0 ? 'left' : 'right';
  const label = `${m.year} · ${m.title}`;
  const lx = x + side * 30;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const tw = ctx.measureText(label).width;
  ctx.beginPath();
  ctx.roundRect(side > 0 ? lx - 6 : lx - tw - 6, y - 11, tw + 12, 22, 8);
  ctx.fill();
  ctx.fillStyle = '#2f3b46';
  ctx.fillText(label, lx, y + 1);
}

// Xe xoay theo hướng di chuyển trên đường:
// - chạy tới  → sprite ĐUÔI xe, mũi xe hướng theo chiều đi (xa dần người xem)
// - chạy lùi → sprite ĐẦU xe, cáo & thỏ nhìn về phía người xem
function drawCar(ctx, p, facing) {
  const img = facing >= 0 ? carRearImg : carFrontImg;
  if (!img.complete || !img.naturalWidth) return;
  // Góc của hướng đang di chuyển (đảo chiều tangent khi lùi).
  const motionAng = facing >= 0 ? p.ang : p.ang + Math.PI;
  // Sprite đuôi "chạy lên trên" (-90°), sprite đầu "chạy xuống dưới" (+90°) —
  // xoay thêm cho khớp hướng di chuyển thực tế.
  const rot = motionAng + (facing >= 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rot);
  ctx.drawImage(img, -CAR_W / 2, -CAR_H * 0.6, CAR_W, CAR_H);
  ctx.restore();
}

const JourneyCanvas = forwardRef(function JourneyCanvas(
  { milestones, onReach, onPlayingChange, onProgress, onMilestoneClick, onManualStart, keysEnabled = true },
  ref
) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const st = useRef({
    frac: 0,
    playing: false, // đang tự lái tới target
    manualDir: 0, // đang giữ phím WASD: 1 tiến, -1 lùi, 0 đứng yên
    dir: 1,
    facing: 1,
    targetFrac: null,
    speedMul: 1,
    camY: WORLD_H,
    path: null,
    scenery: [],
    streets: [], // các đoạn đường đã gán tên phố Sài Gòn
    landmarks: [], // địa danh 2.5D dọc đường
    milestones: [],
    mFracs: [], // vị trí thực của từng cột mốc trên đường (gán vào các khúc quẹo)
  }).current;
  st.milestones = milestones;
  if (st.path && st.mFracs.length !== milestones.length) {
    st.mFracs = computeMilestoneFracs(st.path, milestones.length);
  }

  const cbs = useRef({});
  cbs.current = { onReach, onPlayingChange, onProgress, onMilestoneClick, onManualStart, keysEnabled };

  const setPlaying = (v) => {
    st.playing = v;
    cbs.current.onPlayingChange?.(v);
  };

  const reachIndex = (idx) => {
    st.frac = st.mFracs[idx];
    cbs.current.onProgress?.(st.frac);
    cbs.current.onReach?.(st.milestones[idx]);
  };

  const driveTo = (frac) => {
    if (Math.abs(frac - st.frac) < 0.001) return;
    st.manualDir = 0;
    st.dir = frac > st.frac ? 1 : -1;
    st.facing = st.dir;
    st.targetFrac = frac;
    setPlaying(true);
  };

  useImperativeHandle(ref, () => ({
    next() {
      const nxt = st.mFracs.find((f) => f > st.frac + 0.001);
      driveTo(nxt ?? 1);
    },
    prev() {
      const pv = [...st.mFracs].reverse().find((f) => f < st.frac - 0.001);
      driveTo(pv ?? 0);
    },
    pause() {
      setPlaying(false);
      st.targetFrac = null;
      st.manualDir = 0;
    },
    reset() {
      setPlaying(false);
      st.targetFrac = null;
      st.manualDir = 0;
      st.frac = 0;
      st.facing = 1;
      cbs.current.onProgress?.(0);
    },
    driveTo,
    driveToMilestone(id) {
      const i = st.milestones.findIndex((m) => m.id === id);
      if (i >= 0) driveTo(st.mFracs[i]);
    },
    isAtMilestone(id) {
      const i = st.milestones.findIndex((m) => m.id === id);
      return i >= 0 && Math.abs(st.mFracs[i] - st.frac) < 0.002;
    },
    setSpeed(v) {
      st.speedMul = v;
    },
  }));

  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = cv.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      st.path = buildPath(w);
      st.streets = buildStreets(st.path);
      st.landmarks = buildLandmarks(st.path, st.streets, w);
      st.scenery = buildScenery(st.path, w, st.landmarks);
      st.mFracs = computeMilestoneFracs(st.path, st.milestones.length);
      draw(); // vẽ ngay một frame (tab ẩn không chạy requestAnimationFrame)
    };

    const draw = () => {
      if (!st.path) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.width / dpr;
      const h = cv.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const car = pointAt(st.path, st.frac * st.path.total);
      // camera bám theo xe: xe nằm ở ~62% chiều cao khung nhìn
      const targetCam = clamp(car.y - h * 0.62, 0, WORLD_H - h);
      st.camY += (targetCam - st.camY) * 0.12;

      // thảm cỏ
      const grass = ctx.createLinearGradient(0, 0, 0, h);
      grass.addColorStop(0, '#9ed98f');
      grass.addColorStop(1, '#7cc776');
      ctx.fillStyle = grass;
      ctx.fillRect(0, 0, w, h);

      // ===== lớp thế giới (trượt theo camera dọc) =====
      ctx.save();
      ctx.translate(0, -st.camY);

      // cảnh vật (chỉ vẽ phần trong khung nhìn)
      for (const item of st.scenery) {
        if (item.y > st.camY - 40 && item.y < st.camY + h + 40) drawScenery(ctx, item);
      }

      // kênh nước (vẽ trước lớp đường để mép kênh nằm gọn dưới lề)
      for (const lm of st.landmarks) {
        if (lm.kind !== 'canal') continue;
        if (Math.max(lm.y1, lm.y2) > st.camY - 60 && Math.min(lm.y1, lm.y2) < st.camY + h + 60) {
          drawLandmark(ctx, lm);
        }
      }

      // lề đường + mặt đường + vạch kẻ
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#c9b28a';
      ctx.lineWidth = ROAD_WIDTH + 10;
      tracePath(ctx, st.path.pts);
      ctx.stroke();
      ctx.strokeStyle = '#555a63';
      ctx.lineWidth = ROAD_WIDTH;
      tracePath(ctx, st.path.pts);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 16]);
      tracePath(ctx, st.path.pts);
      ctx.stroke();
      ctx.setLineDash([]);

      // tên đường ghi trên mặt đường + địa danh Sài Gòn hai bên
      drawStreetNames(ctx, st.streets);
      for (const lm of st.landmarks) {
        if (lm.kind === 'canal') continue;
        if (lm.y > st.camY - 160 && lm.y < st.camY + h + 160) drawLandmark(ctx, lm);
      }

      // điểm xuất phát và đích
      const start = pointAt(st.path, 0);
      const end = pointAt(st.path, st.path.total);
      ctx.font = '26px "Segoe UI Emoji", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏠', start.x - ROAD_WIDTH, start.y - 6);
      ctx.fillText('🏁', end.x + ROAD_WIDTH * 0.9, end.y);

      // các cột mốc (đặt tại các khúc quẹo)
      st.milestones.forEach((m, i) => {
        drawMilestone(ctx, st.path, m, st.mFracs[i], i, st.frac >= st.mFracs[i] - 0.0005);
      });

      // chiếc xe
      drawCar(ctx, car, st.facing);

      ctx.restore();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    // sprite xe tải xong sau frame đầu → vẽ lại để xe hiện ngay cả khi tab đang ẩn
    const redraw = () => draw();
    carFrontImg.addEventListener('load', redraw);
    carRearImg.addEventListener('load', redraw);

    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const step = st.path ? (BASE_SPEED * st.speedMul * dt) / st.path.total : 0;

      if (st.manualDir !== 0 && st.path) {
        // ===== lái bằng phím WASD =====
        const prev = st.frac;
        st.frac = clamp(prev + step * st.manualDir, 0, 1);
        st.facing = st.manualDir;
        cbs.current.onProgress?.(st.frac);
        // chạy ngang qua cột mốc → dừng lại tại mốc đó
        const crossed = st.mFracs.findIndex((f) =>
          st.manualDir > 0 ? f > prev && f <= st.frac : f < prev && f >= st.frac
        );
        if (crossed >= 0) {
          st.manualDir = 0;
          reachIndex(crossed);
        }
      } else if (st.playing && st.path) {
        // ===== tự lái tới target =====
        st.frac = clamp(st.frac + step * st.dir, 0, 1);
        cbs.current.onProgress?.(st.frac);

        const reachedTarget =
          st.targetFrac != null &&
          ((st.dir > 0 && st.frac >= st.targetFrac) || (st.dir < 0 && st.frac <= st.targetFrac));
        if (reachedTarget) {
          st.frac = st.targetFrac;
          st.targetFrac = null;
          setPlaying(false);
          const idx = st.mFracs.findIndex((f) => Math.abs(f - st.frac) < 1e-6);
          if (idx >= 0) reachIndex(idx);
        } else if ((st.frac >= 1 && st.dir > 0) || (st.frac <= 0 && st.dir < 0)) {
          st.targetFrac = null;
          setPlaying(false);
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // click vào biển cột mốc → lái xe tới đó
    const onClick = (e) => {
      if (!st.path) return;
      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top + st.camY;
      for (let i = 0; i < st.milestones.length; i++) {
        const mp = markerPos(st.path, st.mFracs[i], i);
        if (Math.hypot(x - mp.x, y - mp.y) < 27) {
          cbs.current.onMilestoneClick?.(st.milestones[i]);
          return;
        }
      }
    };
    cv.addEventListener('click', onClick);

    // ===== phím WASD / mũi tên =====
    const keys = new Set();
    const dirFromKeys = () =>
      FWD_KEYS.some((k) => keys.has(k)) ? 1 : BACK_KEYS.some((k) => keys.has(k)) ? -1 : 0;

    const onKeyDown = (e) => {
      if (!cbs.current.keysEnabled) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (!FWD_KEYS.includes(k) && !BACK_KEYS.includes(k)) return;
      e.preventDefault();
      // Bỏ qua keydown lặp khi giữ phím: nhờ vậy xe dừng ở cột mốc sẽ đứng yên
      // dù người chơi vẫn đang giữ W — muốn đi tiếp thì nhả ra bấm lại.
      if (e.repeat || keys.has(k)) return;
      keys.add(k);
      const dir = dirFromKeys();
      if (dir !== 0 && st.manualDir !== dir) {
        const wasIdle = st.manualDir === 0 && !st.playing;
        st.targetFrac = null;
        if (st.playing) setPlaying(false);
        st.manualDir = dir;
        st.facing = dir;
        cbs.current.onManualStart?.(wasIdle);
      }
    };
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (!keys.delete(k)) return;
      st.manualDir = dirFromKeys();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      carFrontImg.removeEventListener('load', redraw);
      carRearImg.removeEventListener('load', redraw);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
});

export default JourneyCanvas;
