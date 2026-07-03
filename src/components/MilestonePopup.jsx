import { useEffect, useState } from 'react';
import { parseYouTubeId, stopMusic } from '../audio';

// Thẻ thông tin hiện ra khi xe dừng tại một cột mốc.
// Ảnh và video hiển thị chung một carousel, từng mục một, chuyển bằng hai mũi tên ‹ ›.
// Bấm vào ảnh để phóng to; video là link YouTube (iframe) hoặc link mp4 (<video>).
export default function MilestonePopup({ milestone, isLast, onClose, onEdit, onContinue }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // Sang cột mốc khác → quay về mục đầu tiên.
  useEffect(() => {
    setIdx(0);
    setLightbox(false);
  }, [milestone.id]);

  // Ảnh trước, video sau — mỗi mục có type để biết cách hiển thị.
  const media = [
    ...milestone.images.map((src) => ({ type: 'image', src })),
    ...(milestone.videoUrls || []).map((url) => ({ type: 'video', url })),
  ];
  const many = media.length > 1;
  const item = media[idx];
  const prevItem = () => setIdx((i) => (i - 1 + media.length) % media.length);
  const nextItem = () => setIdx((i) => (i + 1) % media.length);

  // Lướt tới mục video → tắt nhạc nền của cột mốc để không chồng tiếng.
  useEffect(() => {
    if (item?.type === 'video') stopMusic();
  }, [item?.type]);

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

        {media.length > 0 && (
          <div className="carousel">
            {many && (
              <button className="carousel-btn" onClick={prevItem} aria-label="Mục trước">
                ‹
              </button>
            )}
            <div className="carousel-frame">
              {item.type === 'image' ? (
                <img
                  src={item.src}
                  alt={`${milestone.title} - ảnh ${idx + 1}`}
                  onClick={() => setLightbox(true)}
                />
              ) : (
                <CarouselVideo url={item.url} />
              )}
              {many && (
                <span className="carousel-count">
                  {idx + 1}/{media.length}
                </span>
              )}
            </div>
            {many && (
              <button className="carousel-btn" onClick={nextItem} aria-label="Mục sau">
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

      {lightbox && item?.type === 'image' && (
        <div className="lightbox" onClick={() => setLightbox(false)}>
          <img src={item.src} alt="Ảnh phóng to" />
        </div>
      )}
    </>
  );
}

// Một mục video trong carousel: link YouTube → iframe nhúng, link khác → thẻ <video>.
function CarouselVideo({ url }) {
  const ytId = parseYouTubeId(url);
  if (ytId) {
    return (
      <iframe
        className="carousel-video"
        src={`https://www.youtube.com/embed/${ytId}`}
        title="Video cột mốc"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return <video className="carousel-video" src={url} controls playsInline onPlay={stopMusic} />;
}
