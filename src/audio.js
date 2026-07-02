// ===== Âm thanh của hành trình =====
// Mỗi cột mốc có thể phát nhạc từ 3 nguồn (ưu tiên từ trên xuống):
//   1. audioUrl là link YouTube  → phát qua trình phát YouTube ẩn
//   2. audioUrl là link mp3      → phát qua phần tử <audio> dùng chung
//   3. audio là file mp3 tải lên → phát qua Web Audio (dataURL)
// Không có gì → tiếng "ding" mặc định.
//
// Trình duyệt chặn autoplay, nên unlockAudio() được gọi trong MỌI lần bấm nút:
// AudioContext được resume + phần tử <audio> phát thử một đoạn im lặng — sau đó
// các lần phát tự động (khi xe tới mốc vài giây sau) không còn bị chặn.

let ctx = null; // Web Audio context
let htmlAudio = null; // phần tử <audio> dùng chung cho link mp3
let bufferSource = null; // nguồn Web Audio đang phát (file tải lên)
let ytPlayer = null; // trình phát YouTube ẩn
let ytApiPromise = null;

// 1 mẫu WAV im lặng — dùng để "mở khóa" phần tử <audio> trong lần click đầu tiên.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === 'suspended') ctx.resume();

  if (!htmlAudio) {
    htmlAudio = new Audio(SILENT_WAV);
    htmlAudio.play().catch(() => {});
  }
}

// ===== Nguồn 3: tiếng "ding" mặc định =====
export function playDing() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc.start(t);
  osc.stop(t + 0.6);
}

// ===== Nguồn: file mp3 tải lên (dataURL) =====
export async function playDataUrl(dataUrl) {
  unlockAudio();
  if (!ctx) return;
  try {
    const buf = await (await fetch(dataUrl)).arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(buf);
    stopMusic();
    bufferSource = ctx.createBufferSource();
    bufferSource.buffer = audioBuf;
    bufferSource.connect(ctx.destination);
    bufferSource.start();
  } catch {
    playDing();
  }
}

// ===== Nguồn: link mp3 trực tiếp =====
function playUrl(url) {
  unlockAudio();
  if (!htmlAudio) return;
  htmlAudio.src = url;
  htmlAudio.play().catch(() => playDing());
}

// ===== Nguồn: YouTube =====
export function parseYouTubeId(url) {
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

function loadYtApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

async function playYouTube(videoId) {
  const YT = await loadYtApi();
  stopMusic();
  let holder = document.getElementById('yt-audio-holder');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'yt-audio-holder';
    holder.style.cssText =
      'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;overflow:hidden';
    document.body.appendChild(holder);
  }
  const target = document.createElement('div');
  holder.appendChild(target);
  ytPlayer = new YT.Player(target, {
    width: 1,
    height: 1,
    videoId,
    playerVars: { autoplay: 1, controls: 0 },
    events: {
      onReady: (e) => {
        e.target.setVolume(80);
        e.target.playVideo();
      },
    },
  });
}

// ===== Điều phối =====

// Dừng mọi nhạc đang phát (gọi khi đóng popup, xe chạy tiếp, hoặc reset).
export function stopMusic() {
  if (ytPlayer) {
    try {
      ytPlayer.destroy();
    } catch {
      /* player chưa sẵn sàng — bỏ qua */
    }
    ytPlayer = null;
  }
  if (htmlAudio) {
    htmlAudio.pause();
    htmlAudio.removeAttribute('src');
  }
  if (bufferSource) {
    try {
      bufferSource.stop();
    } catch {
      /* đã dừng rồi — bỏ qua */
    }
    bufferSource = null;
  }
}

// Phát nhạc của một cột mốc theo thứ tự ưu tiên: link YouTube → link mp3 → file tải lên → ding.
export function playMilestoneAudio(m) {
  if (m.audioUrl) {
    const videoId = parseYouTubeId(m.audioUrl);
    if (videoId) playYouTube(videoId);
    else playUrl(m.audioUrl);
    return;
  }
  if (m.audio) {
    playDataUrl(m.audio);
    return;
  }
  playDing();
}
