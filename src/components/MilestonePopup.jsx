import { useEffect, useState } from 'react';

// Thẻ thông tin hiện ra khi xe dừng tại một cột mốc.
// Ảnh hiển thị từng tấm một, chuyển qua lại bằng hai mũi tên ‹ ›; bấm vào ảnh để phóng to.
export default function MilestonePopup({ milestone, isLast, onClose, onEdit, onContinue }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // Sang cột mốc khác → quay về ảnh đầu tiên.
  useEffect(() => {
    setIdx(0);
    setLightbox(false);
  }, [milestone.id]);

  const imgs = milestone.images;
  const many = imgs.length > 1;
  const prevImg = () => setIdx((i) => (i - 1 + imgs.length) % imgs.length);
  const nextImg = () => setIdx((i) => (i + 1) % imgs.length);

  return (
    <>
      <div className="popup" role="dialog" aria-label={milestone.title}>
        <button className="popup-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <div className="popup-icon">{milestone.icon}</div>
        <div className="popup-year">{milestone.year}</div>
        <h2 className="popup-title">{milestone.title}</h2>
        <p className="popup-desc">{milestone.desc}</p>

        {imgs.length > 0 && (
          <div className="carousel">
            {many && (
              <button className="carousel-btn" onClick={prevImg} aria-label="Ảnh trước">
                ‹
              </button>
            )}
            <div className="carousel-frame">
              <img
                src={imgs[idx]}
                alt={`${milestone.title} - ảnh ${idx + 1}`}
                onClick={() => setLightbox(true)}
              />
              {many && (
                <span className="carousel-count">
                  {idx + 1}/{imgs.length}
                </span>
              )}
            </div>
            {many && (
              <button className="carousel-btn" onClick={nextImg} aria-label="Ảnh sau">
                ›
              </button>
            )}
          </div>
        )}

        <div className="popup-actions">
          <button className="btn" onClick={onEdit}>
            ✏️ Chỉnh sửa
          </button>
          <button className="btn btn-primary" onClick={onContinue}>
            {isLast ? 'Về đích 🏁' : 'Tiếp tục ▶'}
          </button>
        </div>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(false)}>
          <img src={imgs[idx]} alt="Ảnh phóng to" />
        </div>
      )}
    </>
  );
}
