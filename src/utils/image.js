// Nén ảnh trước khi lưu: thu nhỏ về tối đa maxDim px và chuyển sang JPEG.
// Ảnh chụp điện thoại ~4MB sẽ còn khoảng 200-400KB — thoải mái cho localStorage
// và file journey.json khi chia sẻ online.
export function compressImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được file ảnh'));
    };
    img.src = url;
  });
}
