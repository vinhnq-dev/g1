import { useCallback, useRef, useState } from 'react';
import JourneyCanvas from './components/JourneyCanvas';
import MilestonePopup from './components/MilestonePopup';
import EditModal from './components/EditModal';
import { useMilestones } from './hooks/useMilestones';
import { unlockAudio, playMilestoneAudio, stopMusic } from './audio';

export default function App() {
  const canvasCtl = useRef(null);
  const { milestones, updateMilestone, exportJourney, clearLocalEdits } = useMilestones();

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [popupId, setPopupId] = useState(null); // cột mốc đang mở thẻ thông tin
  const [editingId, setEditingId] = useState(null); // cột mốc đang chỉnh sửa

  const popupMilestone = milestones.find((m) => m.id === popupId);
  const editingMilestone = milestones.find((m) => m.id === editingId);
  const lastId = milestones[milestones.length - 1]?.id;

  // Xe vừa dừng tại một cột mốc: mở thẻ thông tin + phát nhạc của mốc đó.
  const handleReach = useCallback((m) => {
    setPopupId(m.id);
    playMilestoneAudio(m);
  }, []);

  // Bắt đầu lái bằng phím WASD: đóng popup, tắt nhạc mốc cũ.
  const handleManualStart = useCallback(() => {
    unlockAudio();
    stopMusic();
    setPopupId(null);
  }, []);

  // Cập nhật thanh tiến trình (bỏ qua thay đổi quá nhỏ để đỡ render thừa).
  const handleProgress = useCallback((frac) => {
    setProgress((p) => (Math.abs(p - frac) > 0.004 || frac === 0 || frac === 1 ? frac : p));
  }, []);

  // Mọi nút điều khiển đều unlock audio (yêu cầu của trình duyệt về autoplay)
  // và dừng nhạc của mốc trước đó.
  const drive = (action) => {
    unlockAudio();
    stopMusic();
    setPopupId(null);
    canvasCtl.current?.[action]();
  };

  const handleReset = () => {
    stopMusic();
    setPopupId(null);
    canvasCtl.current?.reset();
    setProgress(0);
  };

  const closePopup = () => {
    stopMusic();
    setPopupId(null);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🚗 Quang Vinh Portfolio</h1>
        <p>Hành trình qua những cột mốc đáng nhớ</p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <main className="stage">
        <JourneyCanvas
          ref={canvasCtl}
          milestones={milestones}
          onReach={handleReach}
          onPlayingChange={setPlaying}
          onProgress={handleProgress}
          onManualStart={handleManualStart}
          keysEnabled={!editingId}
          onMilestoneClick={(m) => {
            unlockAudio();
            stopMusic();
            setPopupId(null);
            // Xe đang đứng ngay tại mốc này → mở lại thẻ thông tin thay vì lái xe.
            if (canvasCtl.current?.isAtMilestone(m.id)) handleReach(m);
            else canvasCtl.current?.driveToMilestone(m.id);
          }}
        />

        {popupMilestone && (
          <MilestonePopup
            milestone={popupMilestone}
            isLast={popupMilestone.id === lastId}
            onClose={closePopup}
            onEdit={() => setEditingId(popupMilestone.id)}
            onContinue={() => drive('next')}
          />
        )}
      </main>

      <div className="controls">
        <button className="btn btn-arrow" onClick={() => drive('prev')} title="Mốc trước (S hoặc A)">
          &lt;
        </button>
        {playing ? (
          <button className="btn btn-primary" onClick={() => canvasCtl.current?.pause()}>
            ⏸ Tạm dừng
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => drive('next')}>
            ▶ {progress === 0 ? 'Bắt đầu' : 'Tiếp tục'}
          </button>
        )}
        <button className="btn btn-arrow" onClick={() => drive('next')} title="Mốc sau (W hoặc D)">
          &gt;
        </button>
        <button className="btn" onClick={handleReset}>
          ↺ Về đầu
        </button>
        <label className="speed-control">
          🏎️
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.25"
            value={speed}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSpeed(v);
              canvasCtl.current?.setSpeed(v);
            }}
          />
          <span>{speed}x</span>
        </label>
      </div>

      <footer className="footer">
        <p className="hint">
          🎮 Lái xe bằng phím <b>W</b>/<b>D</b> (tiến) và <b>S</b>/<b>A</b> (lùi) — xe tự dừng khi
          gặp cột mốc. Nhấn vào biển cột mốc để lái tới thẳng mốc đó.
        </p>
        <div className="footer-actions">
          <button className="btn btn-small" onClick={exportJourney}>
            💾 Xuất dữ liệu (journey.json)
          </button>
          <button
            className="btn btn-small"
            onClick={() => {
              if (confirm('Xóa mọi chỉnh sửa đã lưu trên máy này và quay về dữ liệu gốc?')) {
                clearLocalEdits();
              }
            }}
          >
            🗑 Xóa chỉnh sửa cục bộ
          </button>
        </div>
      </footer>

      {editingMilestone && (
        <EditModal
          milestone={editingMilestone}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            updateMilestone(editingMilestone.id, patch);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}
