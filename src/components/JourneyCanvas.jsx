import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import carSpriteUrl from '../assets/car.svg';

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

// Xe sprite (cáo lái, thỏ ngồi ghế phụ) — luôn nhìn trực diện về phía người xem.
const CAR_W = 76;
const CAR_H = (CAR_W * 360) / 480;
const carImg = new Image();
carImg.src = carSpriteUrl;

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

  return { pts, cum, total, cornerFracs };
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

// Cảnh vật hai bên đường: cây, bụi hoa — sinh theo seed, rải gần đường
// nhưng loại bỏ vị trí đè lên mặt đường (đường có cả đoạn ngang).
function buildScenery(path, w) {
  const rnd = mulberry32(ROAD_SEED + 1);
  const items = [];
  const clear = ROAD_WIDTH / 2 + 26; // khoảng cách tối thiểu tới tim đường
  let guard = 0;
  while (items.length < 65 && guard++ < 500) {
    const p = path.pts[Math.floor(rnd() * path.pts.length)];
    const ang = rnd() * Math.PI * 2;
    const dist = clear + 14 + rnd() * 140;
    const x = clamp(p.x + Math.cos(ang) * dist, 24, w - 24);
    const y = clamp(p.y + Math.sin(ang) * dist, 60, WORLD_H - 60);
    if (distToPath(path, x, y) <= clear) continue; // dính mặt đường → bỏ, thử vị trí khác
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

// Xe sprite nhìn trực diện: không xoay theo đường, chỉ nghiêng nhẹ khi
// đang chạy trên đoạn ngang (quẹo trái/phải) cho có cảm giác chuyển động.
function drawCar(ctx, p, facing, moving) {
  if (!carImg.complete || !carImg.naturalWidth) return;
  const lean = moving ? Math.cos(p.ang) * facing * 0.12 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(lean);
  ctx.drawImage(carImg, -CAR_W / 2, -CAR_H * 0.6, CAR_W, CAR_H);
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
      st.scenery = buildScenery(st.path, w);
      st.mFracs = computeMilestoneFracs(st.path, st.milestones.length);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

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
      drawCar(ctx, car, st.facing, st.playing || st.manualDir !== 0);

      ctx.restore();
    };

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
