import { useEffect, useState } from 'react';
import { DEFAULT_MILESTONES } from '../data/milestones';

const STORAGE_KEY = 'qv-portfolio-milestones-v1';

// ===== Thứ tự ưu tiên dữ liệu (thấp → cao) =====
// 1. DEFAULT_MILESTONES  — nội dung mặc định trong code
// 2. public/journey.json — bản đã "Xuất dữ liệu" rồi deploy, ai truy cập cũng thấy
// 3. localStorage        — bản nháp đang chỉnh trên máy này, chỉ mình bạn thấy

const readLocalOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

// Đưa dữ liệu cũ (image đơn) về dạng mới (mảng images).
const normalize = (m) => {
  const { image, ...rest } = m;
  return { ...rest, images: m.images ?? (image ? [image] : []) };
};

const mergeById = (base, overridesById) =>
  base.map((m) => normalize({ ...m, ...(overridesById[m.id] || {}) }));

export function useMilestones() {
  const [milestones, setMilestones] = useState(() =>
    mergeById(DEFAULT_MILESTONES, readLocalOverrides())
  );

  // Nạp bản deploy (public/journey.json) nếu có, rồi phủ chỉnh sửa cục bộ lên trên.
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}journey.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((deployed) => {
        if (!Array.isArray(deployed)) return;
        const deployedById = Object.fromEntries(deployed.map((m) => [m.id, m]));
        setMilestones(
          mergeById(mergeById(DEFAULT_MILESTONES, deployedById), readLocalOverrides())
        );
      })
      .catch(() => {}); // không có journey.json → dùng mặc định
  }, []);

  const updateMilestone = (id, patch) => {
    setMilestones((prev) => {
      const next = prev.map((m) => (m.id === id ? normalize({ ...m, ...patch }) : m));
      try {
        // Chỉ lưu phần khác biệt so với mặc định để localStorage gọn nhất có thể.
        const overrides = {};
        next.forEach((m, i) => {
          const def = normalize(DEFAULT_MILESTONES[i]);
          const diff = {};
          Object.keys(m).forEach((k) => {
            if (JSON.stringify(m[k]) !== JSON.stringify(def[k])) diff[k] = m[k];
          });
          if (Object.keys(diff).length) overrides[m.id] = diff;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch {
        alert(
          'Không lưu được vào bộ nhớ trình duyệt (~5MB): tổng ảnh/âm thanh quá lớn. Nội dung vẫn hiển thị trong phiên này — hãy bớt ảnh, hoặc dùng link nhạc thay vì tải file lên.'
        );
      }
      return next;
    });
  };

  // Tải về journey.json — bỏ file này vào thư mục public/ rồi deploy lại
  // là mọi người truy cập trang đều thấy nội dung bạn đã chỉnh.
  const exportJourney = () => {
    setMilestones((current) => {
      const blob = new Blob([JSON.stringify(current, null, 2)], {
        type: 'application/json',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'journey.json';
      a.click();
      URL.revokeObjectURL(a.href);
      return current;
    });
  };

  const clearLocalEdits = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return { milestones, updateMilestone, exportJourney, clearLocalEdits };
}
