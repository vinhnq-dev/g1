import { useState } from 'react';
import { playMilestoneAudio, stopMusic, unlockAudio } from '../audio';
import { compressImage } from '../utils/image';

const PRESET_ICONS = ['🎓', '💼', '🚀', '🏆', '🌟', '❤️', '💍', '🏠', '👶', '✈️', '🎯', '🥇'];

const MAX_IMAGES = 8;
const MAX_AUDIO_MB = 2.5; // giới hạn file nhạc tải lên để còn lưu được trong trình duyệt

// Hộp thoại chỉnh sửa một cột mốc: icon, năm, tiêu đề, mô tả, bộ ảnh và nhạc.
export default function EditModal({ milestone, onSave, onClose }) {
  const [form, setForm] = useState({
    icon: milestone.icon,
    year: milestone.year,
    title: milestone.title,
    desc: milestone.desc,
    images: milestone.images,
    audio: milestone.audio,
    audioUrl: milestone.audioUrl || '',
  });
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const addImages = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = MAX_IMAGES - form.images.length;
      if (files.length > room) {
        alert(`Mỗi cột mốc tối đa ${MAX_IMAGES} ảnh — chỉ thêm được ${room} ảnh nữa.`);
      }
      const picked = [...files].slice(0, room);
      const compressed = await Promise.all(picked.map((f) => compressImage(f)));
      setForm((f) => ({ ...f, images: [...f.images, ...compressed] }));
    } catch {
      alert('Có file ảnh không đọc được, hãy thử file khác.');
    } finally {
      setBusy(false);
    }
  };

  const removeImage = (index) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));

  const readAudioFile = (file) => {
    if (!file) return;
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      alert(
        `File nhạc quá lớn (tối đa ~${MAX_AUDIO_MB}MB để lưu được trong trình duyệt). Mẹo: dán link YouTube thay vì tải file lên — không tốn dung lượng.`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('audio', reader.result);
    reader.readAsDataURL(file);
  };

  const previewAudio = () => {
    unlockAudio();
    playMilestoneAudio({ audioUrl: form.audioUrl.trim() || null, audio: form.audio });
  };

  const handleSave = () => {
    stopMusic();
    onSave({ ...form, audioUrl: form.audioUrl.trim() || null });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">✏️ Chỉnh sửa cột mốc</h2>

        <label className="field">
          <span>Icon</span>
          <div className="icon-row">
            {PRESET_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={`icon-btn ${form.icon === ic ? 'active' : ''}`}
                onClick={() => set('icon', ic)}
              >
                {ic}
              </button>
            ))}
            <input
              className="icon-input"
              value={form.icon}
              onChange={(e) => set('icon', e.target.value)}
              maxLength={4}
              title="Hoặc gõ emoji tùy ý"
            />
          </div>
        </label>

        <div className="field-row">
          <label className="field field-small">
            <span>Năm</span>
            <input value={form.year} onChange={(e) => set('year', e.target.value)} />
          </label>
          <label className="field">
            <span>Tiêu đề</span>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>Mô tả</span>
          <textarea rows={3} value={form.desc} onChange={(e) => set('desc', e.target.value)} />
        </label>

        <label className="field">
          <span>
            Hình ảnh ({form.images.length}/{MAX_IMAGES}) — chọn được nhiều ảnh, tự nén cho nhẹ
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(e) => {
              addImages(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        {busy && <p className="modal-note">Đang nén ảnh…</p>}
        {form.images.length > 0 && (
          <div className="thumb-grid">
            {form.images.map((src, i) => (
              <div key={i} className="thumb">
                <img src={src} alt={`Ảnh ${i + 1}`} />
                <button
                  type="button"
                  className="thumb-remove"
                  onClick={() => removeImage(i)}
                  aria-label={`Xóa ảnh ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="field">
          <span>Nhạc — dán link YouTube hoặc link mp3</span>
          <input
            placeholder="https://www.youtube.com/watch?v=... hoặc https://.../nhac.mp3"
            value={form.audioUrl}
            onChange={(e) => set('audioUrl', e.target.value)}
          />
        </label>

        <label className="field">
          <span>Hoặc tải file mp3 lên (tối đa ~{MAX_AUDIO_MB}MB)</span>
          <input type="file" accept="audio/*" onChange={(e) => readAudioFile(e.target.files[0])} />
        </label>

        <div className="preview-row">
          <button type="button" className="btn btn-small" onClick={previewAudio}>
            🔊 Nghe thử
          </button>
          <button type="button" className="btn btn-small" onClick={stopMusic}>
            ⏹ Dừng
          </button>
          {form.audio && (
            <button type="button" className="btn btn-small" onClick={() => set('audio', null)}>
              🗑 Xóa file nhạc
            </button>
          )}
        </div>
        <p className="modal-note">
          Nếu điền cả hai thì link được ưu tiên. Chỉnh sửa lưu trong trình duyệt của bạn — muốn
          bạn bè cũng thấy, bấm «💾 Xuất dữ liệu» rồi đặt file <code>journey.json</code> vào thư
          mục <code>public/</code> và deploy lại.
        </p>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
            💾 Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
