// ============================================
// Image Optimization Utility
// Canvas-based resize + compress before upload
// ============================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
const ACCEPTED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'svg'];

// Max dimensions per upload type
const MAX_DIMS = {
  'product-images': 1200,   // max 1200px on longest side
  'category-images': 800,
  'banners': 1920,
  'brand-assets': 400,
  'logos': 400,
};

/**
 * Validates a file — returns { ok, error }.
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' };

  const ext = file.name.split('.').pop()?.toLowerCase();
  const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTS.includes(ext);
  if (!typeOk) {
    return { ok: false, error: `${file.name}: Unsupported format. Use JPG, PNG, WebP, or SVG.` };
  }

  // SVGs are not canvas-resizable — check size only
  if (ext === 'svg' || file.type === 'image/svg+xml') {
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, error: `${file.name}: SVG exceeds 5MB limit (${(file.size/1024/1024).toFixed(1)}MB).` };
    }
    return { ok: true, isSvg: true };
  }

  if (file.size > MAX_FILE_SIZE) {
    // We'll try to compress — but warn if it's way too big (>15MB)
    if (file.size > 15 * 1024 * 1024) {
      return { ok: false, error: `${file.name}: File is too large (${(file.size/1024/1024).toFixed(1)}MB). Max 5MB after compression.` };
    }
  }

  return { ok: true };
}

/**
 * Resize and compress an image using canvas.
 * Returns a Promise<Blob> (for raster) or the original File (for SVG).
 *
 * @param {File} file
 * @param {string} bucket — determines max dimension
 * @param {number} quality — 0.1 to 1.0 (default 0.82)
 * @returns {Promise<{ blob: Blob, name: string }>}
 */
export async function optimizeImage(file, bucket, quality = 0.82) {
  // SVGs can't be canvas-processed
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'svg' || file.type === 'image/svg+xml') {
    return { blob: file, name: file.name };
  }

  const maxDim = MAX_DIMS[bucket] || 1200;

  const img = await loadImage(file);
  let { width, height } = img;

  // Resize if exceeds max dimension (preserve aspect ratio)
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height / width) * maxDim);
      width = maxDim;
    } else {
      width = Math.round((width / height) * maxDim);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Determine output format
  // PNG stays PNG (for transparency), everything else → JPEG for smaller size
  // WebP stays WebP
  let outputType = 'image/jpeg';
  let outputExt = 'jpg';
  if (ext === 'png' || file.type === 'image/png') {
    outputType = 'image/png';
    outputExt = 'png';
  } else if (ext === 'webp' || file.type === 'image/webp') {
    outputType = 'image/webp';
    outputExt = 'webp';
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Canvas compression failed')),
      outputType,
      quality
    );
  });

  // Generate clean filename
  const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
  const name = `${baseName}-${width}x${height}.${outputExt}`;

  return { blob, name };
}

/**
 * Loads a File into an HTMLImageElement.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not load image: ${file.name}`)); };
    img.src = url;
  });
}

/**
 * Formats bytes into human-readable string.
 */
export function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export { MAX_FILE_SIZE, ACCEPTED_TYPES };
