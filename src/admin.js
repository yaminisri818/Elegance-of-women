// ============================================
// Admin Dashboard — Elegance of Women
// Image & Media Management System
// ============================================

import { supabase } from './lib/supabase.js';
import { validateImageFile, optimizeImage, formatFileSize, MAX_FILE_SIZE } from './lib/imageUtils.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ============================================
// Admin State
// ============================================
export const adminState = {
  tab: 'dashboard',        // dashboard | images | products | categories | banners | brand
  loading: false,
  notification: null,
  notifTimer: null,
  // Image Manager
  imageManagerBucket: 'all',
  imageManagerSearch: '',
  imageManagerFiles: [],
  imageManagerLoading: false,
  // Product Manager
  products: [],
  productEdit: null,       // null = list, {} = new, {...} = editing
  productUploading: false,
  productUploadProgress: 0,
  // Category Manager
  categories: [],
  categoryEdit: null,
  catUploading: false,
  // Banner Manager
  banners: [],
  bannerEdit: null,
  bannerUploading: false,
  // Brand Assets
  brandSettings: {},
  brandUploading: {},
};

// ============================================
// Helpers
// ============================================
function getPublicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function showNotif(msg, type = 'success') {
  clearTimeout(adminState.notifTimer);
  adminState.notification = { msg, type };
  // Direct DOM update — no full re-render needed
  const el = document.getElementById('admin-notif');
  if (el) {
    el.innerHTML = notifHTML();
    el.style.display = 'flex';
  }
  adminState.notifTimer = setTimeout(() => {
    adminState.notification = null;
    const el2 = document.getElementById('admin-notif');
    if (el2) el2.style.display = 'none';
  }, 3500);
}

function notifHTML() {
  if (!adminState.notification) return '';
  const { msg, type } = adminState.notification;
  const icon = type === 'success' ? 'check-circle' : 'alert-circle';
  return `<i class="lucide-${icon}"></i><span>${msg}</span>`;
}

// ============================================
// Render Admin Shell
// ============================================
export function renderAdmin() {
  if (!window._adminUser) {
    return `
      <div class="admin-auth-wall">
        <div class="admin-auth-card">
          <div class="admin-logo"><div class="logo-box"><span>E</span></div><h2>Admin Panel</h2></div>
          <p>You must be signed in to access the admin dashboard.</p>
          <button class="btn-gold" onclick="navigate('/login')">Sign In</button>
        </div>
      </div>
    `;
  }

  const tabs = [
    { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'images',    icon: 'image',             label: 'Image Manager' },
    { id: 'products',  icon: 'package',            label: 'Products' },
    { id: 'categories',icon: 'grid-2x2',           label: 'Categories' },
    { id: 'banners',   icon: 'layout',             label: 'Banners' },
    { id: 'brand',     icon: 'star',               label: 'Brand Assets' },
  ];

  return `
    <div class="admin-wrap">
      <aside class="admin-sidebar">
        <div class="admin-sidebar-logo">
          <div class="logo-box"><span>E</span></div>
          <div><div class="brand-name">Elegance</div><div class="brand-sub">Admin Panel</div></div>
        </div>
        <nav class="admin-nav">
          ${tabs.map(t => `
            <button class="admin-nav-item ${adminState.tab === t.id ? 'active' : ''}"
              onclick="adminNavigate('${t.id}')">
              <i class="lucide-${t.icon}"></i>
              <span>${t.label}</span>
            </button>
          `).join('')}
        </nav>
        <div class="admin-sidebar-footer">
          <button class="admin-nav-item" onclick="navigate('/')"><i class="lucide-external-link"></i><span>View Website</span></button>
          <button class="admin-nav-item" onclick="signOut()"><i class="lucide-log-out"></i><span>Sign Out</span></button>
        </div>
      </aside>

      <div class="admin-main">
        <div class="admin-notif" id="admin-notif" style="display:none">${notifHTML()}</div>
        <div class="admin-content" id="admin-content">
          ${renderAdminTab()}
        </div>
      </div>
    </div>
  `;
}

function renderAdminTab() {
  switch (adminState.tab) {
    case 'dashboard':  return renderAdminDashboard();
    case 'images':     return renderAdminImageManager();
    case 'products':   return renderAdminProducts();
    case 'categories': return renderAdminCategories();
    case 'banners':    return renderAdminBanners();
    case 'brand':      return renderAdminBrand();
    default:           return renderAdminDashboard();
  }
}

// ============================================
// Navigate Admin Tab
// ============================================
export async function adminNavigate(tab) {
  adminState.tab = tab;
  adminState.productEdit = null;
  adminState.categoryEdit = null;
  adminState.bannerEdit = null;

  // Load data for the tab
  if (tab === 'images') await loadImageManagerFiles();
  if (tab === 'products') await loadAdminProducts();
  if (tab === 'categories') await loadAdminCategories();
  if (tab === 'banners') await loadAdminBanners();
  if (tab === 'brand') await loadBrandSettings();
  if (tab === 'dashboard') await loadAdminDashboardStats();

  const content = document.getElementById('admin-content');
  if (content) {
    content.innerHTML = renderAdminTab();
    bindAdminEvents();
  }

  // Update sidebar active state
  document.querySelectorAll('.admin-nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${tab}'`));
  });
}

function bindAdminEvents() {
  // Drag-drop on all upload zones
  document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const fileInput = document.getElementById(zone.dataset.inputId);
      if (fileInput && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    zone.addEventListener('click', () => {
      const fileInput = document.getElementById(zone.dataset.inputId);
      if (fileInput) fileInput.click();
    });
  });
}

// ============================================
// Dashboard Stats
// ============================================
let dashStats = { products: 0, categories: 0, banners: 0 };

async function loadAdminDashboardStats() {
  const [pRes, cRes, bRes] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('categories').select('id', { count: 'exact', head: true }),
    supabase.from('banners').select('id', { count: 'exact', head: true }),
  ]);
  dashStats = { products: pRes.count || 0, categories: cRes.count || 0, banners: bRes.count || 0 };
}

function renderAdminDashboard() {
  return `
    <div class="admin-page-header">
      <h1>Dashboard</h1>
      <p>Welcome back! Manage your jewellery store from here.</p>
    </div>
    <div class="admin-stat-grid">
      ${[
        { icon: 'package',    label: 'Total Products',  val: dashStats.products,   tab: 'products'  },
        { icon: 'grid-2x2',   label: 'Categories',      val: dashStats.categories, tab: 'categories'},
        { icon: 'layout',     label: 'Active Banners',  val: dashStats.banners,    tab: 'banners'   },
        { icon: 'image',      label: 'Image Manager',   val: '→',                  tab: 'images'    },
      ].map(s => `
        <div class="admin-stat-card" onclick="adminNavigate('${s.tab}')">
          <div class="stat-icon"><i class="lucide-${s.icon}"></i></div>
          <div class="stat-info"><div class="stat-value">${s.val}</div><div class="stat-label">${s.label}</div></div>
        </div>
      `).join('')}
    </div>
    <div class="admin-quick-actions">
      <h2>Quick Actions</h2>
      <div class="quick-action-grid">
        <button class="quick-action-btn" onclick="adminNavigate('products');setTimeout(()=>startProductEdit({}),100)">
          <i class="lucide-plus-circle"></i><span>Add Product</span>
        </button>
        <button class="quick-action-btn" onclick="adminNavigate('banners');setTimeout(()=>startBannerEdit({}),100)">
          <i class="lucide-plus-circle"></i><span>Add Banner</span>
        </button>
        <button class="quick-action-btn" onclick="adminNavigate('images')">
          <i class="lucide-image-plus"></i><span>Upload Images</span>
        </button>
        <button class="quick-action-btn" onclick="adminNavigate('brand')">
          <i class="lucide-star"></i><span>Update Logo</span>
        </button>
      </div>
    </div>
  `;
}

// ============================================
// Image Manager
// ============================================
const BUCKETS = ['product-images', 'category-images', 'brand-assets', 'banners'];

const PRODUCT_FOLDERS = [
  { value: '', label: 'General (root)' },
  { value: 'rings/', label: 'Rings' },
  { value: 'earrings/', label: 'Earrings' },
  { value: 'necklaces/', label: 'Necklaces' },
  { value: 'bangles/', label: 'Bangles' },
  { value: 'bracelets/', label: 'Bracelets' },
  { value: 'hair-accessories/', label: 'Hair Accessories' },
];

const BRAND_FOLDERS = [
  { value: 'logo/', label: 'Logo' },
  { value: 'favicon/', label: 'Favicon' },
  { value: 'footer/', label: 'Footer Logo' },
  { value: '', label: 'General' },
];

// Map of product image bucket_paths → product name (for search)
let imagePathToProduct = {};

async function loadImageManagerFiles() {
  adminState.imageManagerLoading = true;

  // Load product→image mapping for product-name search
  const { data: prods } = await supabase.from('products').select('name, product_images(image_url, bucket_path)');
  imagePathToProduct = {};
  (prods || []).forEach(p => {
    (p.product_images || []).forEach(img => {
      if (img.bucket_path) imagePathToProduct[`${img.bucket_path}`] = p.name;
      if (img.image_url) imagePathToProduct[img.image_url] = p.name;
    });
  });

  const bucketsToLoad = adminState.imageManagerBucket === 'all' ? BUCKETS : [adminState.imageManagerBucket];
  const all = [];

  for (const bucket of bucketsToLoad) {
    // List root files
    const { data: rootFiles } = await supabase.storage.from(bucket).list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (rootFiles) {
      rootFiles.forEach(f => {
        if (f.name === '.emptyFolderPlaceholder') return;
        if (!f.name) return;
        // Skip folders (metadata shows no size for folders)
        all.push({ ...f, bucket, folder: '', fullPath: f.name, publicUrl: getPublicUrl(bucket, f.name) });
      });
    }

    // List subfolders for product-images and brand-assets
    if (bucket === 'product-images') {
      for (const folder of PRODUCT_FOLDERS) {
        if (!folder.value) continue;
        const { data: subFiles } = await supabase.storage.from(bucket).list(folder.value, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
        if (subFiles) {
          subFiles.forEach(f => {
            if (f.name === '.emptyFolderPlaceholder') return;
            const fullPath = folder.value + f.name;
            all.push({ ...f, bucket, folder: folder.value, fullPath, publicUrl: getPublicUrl(bucket, fullPath) });
          });
        }
      }
    }
    if (bucket === 'brand-assets') {
      for (const folder of BRAND_FOLDERS) {
        if (!folder.value) continue;
        const { data: subFiles } = await supabase.storage.from(bucket).list(folder.value, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
        if (subFiles) {
          subFiles.forEach(f => {
            if (f.name === '.emptyFolderPlaceholder') return;
            const fullPath = folder.value + f.name;
            all.push({ ...f, bucket, folder: folder.value, fullPath, publicUrl: getPublicUrl(bucket, fullPath) });
          });
        }
      }
    }
  }

  adminState.imageManagerFiles = all;
  adminState.imageManagerLoading = false;
}

function renderAdminImageManager() {
  const filtered = filterImageManagerFiles();
  const selectedBucket = adminState.imageManagerBucket === 'all' ? 'product-images' : adminState.imageManagerBucket;

  // Folder options depend on selected bucket
  let folderOptions = [{ value: '', label: 'Root' }];
  if (selectedBucket === 'product-images') folderOptions = PRODUCT_FOLDERS;
  else if (selectedBucket === 'brand-assets') folderOptions = BRAND_FOLDERS;

  return `
    <div class="admin-page-header">
      <h1>Image Manager</h1>
      <p>Upload, view, and manage all media across your store. Images are automatically optimized.</p>
    </div>

    <div class="image-manager-toolbar">
      <div class="bucket-tabs">
        ${['all', ...BUCKETS].map(b => `
          <button class="bucket-tab ${adminState.imageManagerBucket === b ? 'active' : ''}"
            onclick="filterImageBucket('${b}')">${b === 'all' ? 'All Images' : b}</button>
        `).join('')}
      </div>
      <input class="admin-search-input" type="text" placeholder="Search by filename or product name..." value="${adminState.imageManagerSearch}"
        oninput="searchImages(this.value)" />
    </div>

    <div class="image-upload-panel">
      <h3>Upload New Image</h3>
      <div class="upload-config-row">
        <div class="upload-config-item">
          <label>Bucket:</label>
          <select id="upload-bucket-select" class="admin-select" onchange="updateFolderOptions()">
            ${BUCKETS.map(b => `<option value="${b}" ${b === selectedBucket ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="upload-config-item" id="folder-select-wrap">
          <label>Folder:</label>
          <select id="upload-folder-select" class="admin-select">
            ${folderOptions.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="upload-zone" id="image-upload-zone" data-input-id="image-manager-file-input">
        <i class="lucide-cloud-upload"></i>
        <p>Drag &amp; drop images here, or <span>click to browse</span></p>
        <p class="upload-hint">JPG, PNG, WebP, SVG — Max 5MB — Multiple files allowed — Auto-optimized</p>
        <input type="file" id="image-manager-file-input" accept="image/jpeg,image/png,image/webp,image/svg+xml" multiple style="display:none"
          onchange="uploadImageManagerFiles(this.files)" />
      </div>
      <div class="upload-progress-wrap" id="image-upload-progress" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="upload-progress-fill"></div></div>
        <span id="upload-progress-label">Optimizing &amp; uploading…</span>
      </div>
    </div>

    ${adminState.imageManagerLoading ? '<div class="admin-loading"><i class="lucide-loader-2 spin"></i> Loading images…</div>' : ''}

    ${filtered.length === 0 && !adminState.imageManagerLoading ? `
      <div class="admin-empty"><i class="lucide-image-off"></i><p>No images found. Upload your first image above.</p></div>
    ` : ''}

    <div class="image-gallery-grid" id="image-gallery">
      ${filtered.map(f => imageCardHTML(f)).join('')}
    </div>
  `;
}

function filterImageManagerFiles() {
  const search = adminState.imageManagerSearch.toLowerCase().trim();
  return adminState.imageManagerFiles.filter(f => {
    if (!search) return true;
    // Search by filename
    if (f.name.toLowerCase().includes(search)) return true;
    // Search by product name (for product-images)
    const productName = imagePathToProduct[f.fullPath] || imagePathToProduct[f.publicUrl];
    if (productName && productName.toLowerCase().includes(search)) return true;
    return false;
  });
}

export function updateFolderOptions() {
  const bucket = document.getElementById('upload-bucket-select')?.value;
  const folderWrap = document.getElementById('folder-select-wrap');
  if (!folderWrap) return;
  let folders = [{ value: '', label: 'Root' }];
  if (bucket === 'product-images') folders = PRODUCT_FOLDERS;
  else if (bucket === 'brand-assets') folders = BRAND_FOLDERS;
  folderWrap.innerHTML = `<label>Folder:</label><select id="upload-folder-select" class="admin-select">${folders.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}</select>`;
}

function imageCardHTML(f) {
  const isImage = /\.(jpe?g|png|webp|svg|gif)$/i.test(f.name);
  const productName = imagePathToProduct[f.fullPath] || imagePathToProduct[f.publicUrl];
  const folderLabel = f.folder ? f.folder.replace(/\/$/, '') : 'root';
  return `
    <div class="image-card">
      <div class="image-card-thumb" style="object-fit:cover">
        ${isImage ? `<img src="${f.publicUrl}" alt="${f.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover" />` : `<div class="no-thumb"><i class="lucide-file"></i></div>`}
        <div class="image-card-overlay">
          <button title="Copy URL" onclick="copyImageUrl('${f.publicUrl}')"><i class="lucide-copy"></i></button>
          <button title="Replace" onclick="replaceImage('${f.bucket}','${f.fullPath}')"><i class="lucide-refresh-cw"></i></button>
          <a href="${f.publicUrl}" target="_blank" title="Open in new tab"><i class="lucide-external-link"></i></a>
          <button title="Delete" class="delete-btn" onclick="deleteImageFile('${f.bucket}','${f.fullPath}')"><i class="lucide-trash-2"></i></button>
        </div>
      </div>
      <div class="image-card-info">
        <div class="img-name" title="${f.fullPath}">${f.name.length > 22 ? f.name.slice(0,20)+'…' : f.name}</div>
        ${productName ? `<div class="img-product" title="${productName}"><i class="lucide-package" style="font-size:0.65rem;vertical-align:-1px"></i> ${productName.length > 20 ? productName.slice(0,18)+'…' : productName}</div>` : ''}
        <div class="img-meta">
          <span class="bucket-badge">${folderLabel}</span>
          <span>${formatFileSize(f.metadata?.size)}</span>
        </div>
        <div class="img-date">${formatDate(f.created_at)}</div>
      </div>
    </div>
  `;
}

export async function uploadImageManagerFiles(files) {
  if (!files || files.length === 0) return;
  const bucket = document.getElementById('upload-bucket-select')?.value || 'product-images';
  const folder = document.getElementById('upload-folder-select')?.value || '';
  const progressWrap = document.getElementById('image-upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressLabel = document.getElementById('upload-progress-label');
  if (progressWrap) progressWrap.style.display = 'flex';

  let done = 0;
  let failed = 0;
  for (const file of Array.from(files)) {
    // Validate
    const validation = validateImageFile(file);
    if (!validation.ok) {
      showNotif(validation.error, 'error');
      failed++;
      continue;
    }

    try {
      // Optimize (resize + compress)
      if (progressLabel) progressLabel.textContent = `Optimizing ${done + 1}/${files.length}: ${file.name.slice(0, 25)}…`;
      const { blob, name: optName } = await optimizeImage(file, bucket);

      // Build upload path with folder
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${optName}`;
      const path = folder ? `${folder}${safeName}` : safeName;

      const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: false, contentType: blob.type });
      done++;
      const pct = Math.round((done / files.length) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressLabel) progressLabel.textContent = `Uploading ${done}/${files.length}…`;
      if (error) { showNotif(`Failed: ${file.name} — ${error.message}`, 'error'); failed++; }
    } catch (err) {
      showNotif(`Error processing ${file.name}: ${err.message}`, 'error');
      failed++;
    }
  }

  if (progressWrap) setTimeout(() => { progressWrap.style.display = 'none'; if (progressFill) progressFill.style.width = '0'; }, 1500);
  if (done > 0) showNotif(`${done} image${done > 1 ? 's' : ''} uploaded & optimized!${failed ? ` (${failed} failed)` : ''}`);
  await loadImageManagerFiles();
  const gallery = document.getElementById('image-gallery');
  if (gallery) gallery.innerHTML = filterImageManagerFiles().map(f => imageCardHTML(f)).join('');
}

export async function deleteImageFile(bucket, fullPath) {
  if (!confirm(`Delete "${fullPath}" from ${bucket}? This cannot be undone.`)) return;
  const { error } = await supabase.storage.from(bucket).remove([fullPath]);
  if (error) { showNotif('Delete failed: ' + error.message, 'error'); return; }
  showNotif('Image deleted.');
  adminState.imageManagerFiles = adminState.imageManagerFiles.filter(f => !(f.bucket === bucket && f.fullPath === fullPath));
  const gallery = document.getElementById('image-gallery');
  if (gallery) gallery.innerHTML = filterImageManagerFiles().map(f => imageCardHTML(f)).join('');
}

export function copyImageUrl(url) {
  navigator.clipboard.writeText(url).then(() => showNotif('URL copied to clipboard!'));
}

export async function replaceImage(bucket, oldPath) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/svg+xml';
  input.onchange = async () => {
    if (!input.files.length) return;
    const file = input.files[0];

    const validation = validateImageFile(file);
    if (!validation.ok) { showNotif(validation.error, 'error'); return; }

    try {
      const { blob, name: optName } = await optimizeImage(file, bucket);
      await supabase.storage.from(bucket).remove([oldPath]);
      // Keep same path so DB URLs don't break
      const { error } = await supabase.storage.from(bucket).upload(oldPath, blob, { upsert: true, contentType: blob.type });
      if (error) { showNotif('Replace failed: ' + error.message, 'error'); return; }
      showNotif('Image replaced & optimized!');
      await loadImageManagerFiles();
      const gallery = document.getElementById('image-gallery');
      if (gallery) gallery.innerHTML = filterImageManagerFiles().map(f => imageCardHTML(f)).join('');
    } catch (err) {
      showNotif('Replace error: ' + err.message, 'error');
    }
  };
  input.click();
}

export function filterImageBucket(bucket) {
  adminState.imageManagerBucket = bucket;
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminImageManager();
  loadImageManagerFiles().then(() => {
    const gallery = document.getElementById('image-gallery');
    if (gallery) gallery.innerHTML = filterImageManagerFiles().map(f => imageCardHTML(f)).join('');
  });
  bindAdminEvents();
}

export function searchImages(val) {
  adminState.imageManagerSearch = val;
  const gallery = document.getElementById('image-gallery');
  if (!gallery) return;
  gallery.innerHTML = filterImageManagerFiles().map(f => imageCardHTML(f)).join('');
}

// ============================================
// Product Manager
// ============================================
async function loadAdminProducts() {
  const { data } = await supabase.from('products').select('*, category:categories(*), product_images(*)').order('created_at', { ascending: false });
  adminState.products = data || [];
}

function renderAdminProducts() {
  if (adminState.productEdit !== null) return renderProductForm();
  return `
    <div class="admin-page-header">
      <div>
        <h1>Products</h1>
        <p>Manage your jewellery catalogue and product images.</p>
      </div>
      <button class="btn-gold" onclick="startProductEdit({})"><i class="lucide-plus"></i> Add Product</button>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${adminState.products.map(p => `
            <tr>
              <td><div class="table-thumb"><img src="${getProductThumb(p)}" alt="${p.name}" /></div></td>
              <td><div class="table-name">${p.name}</div><div class="table-slug">${p.slug}</div></td>
              <td>${p.category?.name || '—'}</td>
              <td>₹${Number(p.price).toLocaleString('en-IN')}</td>
              <td><span class="stock-badge ${p.stock > 0 ? 'in' : 'out'}">${p.stock > 0 ? p.stock : 'Out'}</span></td>
              <td><span class="status-badge ${p.is_active ? 'active' : 'inactive'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
              <td class="table-actions">
                <button onclick="startProductEdit(${JSON.stringify(p).replace(/"/g,'&quot;')})" title="Edit"><i class="lucide-pencil"></i></button>
                <button onclick="deleteProduct('${p.id}')" title="Delete" class="danger-btn"><i class="lucide-trash-2"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${adminState.products.length === 0 ? '<div class="admin-empty"><i class="lucide-package-open"></i><p>No products yet. Add your first product.</p></div>' : ''}
    </div>
  `;
}

function getProductThumb(p) {
  if (p.product_images?.length > 0) return p.product_images[0].image_url;
  if (p.image_url) return p.image_url;
  return 'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=200';
}

function renderProductForm() {
  const p = adminState.productEdit;
  const isNew = !p.id;
  const cats = adminState.categories;

  const images = p.product_images || [];

  return `
    <div class="admin-form-header">
      <button class="back-btn" onclick="cancelProductEdit()"><i class="lucide-arrow-left"></i> Back to Products</button>
      <h1>${isNew ? 'Add New Product' : 'Edit Product'}</h1>
    </div>
    <form class="admin-form" onsubmit="saveProduct(event)">
      <div class="form-grid-2">
        <div class="form-group">
          <label>Product Name *</label>
          <input type="text" name="name" value="${p.name || ''}" required class="admin-input" />
        </div>
        <div class="form-group">
          <label>Slug (URL) *</label>
          <input type="text" name="slug" value="${p.slug || ''}" required class="admin-input" />
        </div>
        <div class="form-group">
          <label>Price (₹) *</label>
          <input type="number" name="price" value="${p.price || ''}" required class="admin-input" min="0" />
        </div>
        <div class="form-group">
          <label>Compare At Price (₹)</label>
          <input type="number" name="compare_at_price" value="${p.compare_at_price || ''}" class="admin-input" min="0" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <select name="category_id" class="admin-select">
            <option value="">— Select Category —</option>
            ${cats.map(c => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Stock Quantity</label>
          <input type="number" name="stock" value="${p.stock ?? 10}" class="admin-input" min="0" />
        </div>
        <div class="form-group">
          <label>Material</label>
          <input type="text" name="material" value="${p.material || ''}" class="admin-input" placeholder="e.g. Gold Plated, Silver" />
        </div>
        <div class="form-group">
          <label>Weight</label>
          <input type="text" name="weight" value="${p.weight || ''}" class="admin-input" placeholder="e.g. 10g" />
        </div>
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea name="description" class="admin-textarea" rows="4">${p.description || ''}</textarea>
      </div>

      <div class="form-flags">
        ${[
          ['is_active','Active (visible on site)','true'],
          ['is_new','New Arrival'],
          ['is_best_seller','Best Seller'],
          ['is_trending','Trending'],
          ['is_bridal','Bridal Collection'],
          ['is_featured','Featured'],
        ].map(([name, label]) => `
          <label class="check-flag">
            <input type="checkbox" name="${name}" ${p[name] ? 'checked' : ''} />
            <span>${label}</span>
          </label>
        `).join('')}
      </div>

      <div class="form-group">
        <label>Product Images</label>
        ${images.length > 0 ? `
          <div class="product-images-preview">
            ${images.map((img, idx) => `
              <div class="preview-thumb ${idx === 0 ? 'primary' : ''}">
                <img src="${img.image_url}" alt="Product image" />
                ${idx === 0 ? '<div class="primary-badge">Primary</div>' : ''}
                <button type="button" class="remove-img-btn" onclick="removeProductImage('${img.id}','${img.bucket_path || ''}')">
                  <i class="lucide-x"></i>
                </button>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="upload-zone" id="product-upload-zone" data-input-id="product-img-input">
          <i class="lucide-image-plus"></i>
          <p>Drag &amp; drop or <span>click to upload</span> product images</p>
          <p class="upload-hint">JPG, PNG, WebP, SVG — Multiple images — Max 5MB — Auto-optimized</p>
          <input type="file" id="product-img-input" accept="image/*" multiple style="display:none"
            onchange="uploadProductImages(this.files)" />
        </div>
        <div class="upload-progress-wrap" id="product-upload-progress" style="display:none">
          <div class="progress-bar"><div class="progress-fill" id="product-progress-fill"></div></div>
          <span id="product-progress-label">Uploading…</span>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn-ghost" onclick="cancelProductEdit()">Cancel</button>
        <button type="submit" class="btn-gold">
          <i class="lucide-save"></i> ${isNew ? 'Create Product' : 'Save Changes'}
        </button>
      </div>
    </form>
  `;
}

export function startProductEdit(p) {
  adminState.productEdit = p;
  if (!p.id) loadAdminCategories(); // preload cats for select
  const content = document.getElementById('admin-content');
  if (content) {
    content.innerHTML = renderAdminProducts();
    bindAdminEvents();
  }
}

export function cancelProductEdit() {
  adminState.productEdit = null;
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminProducts();
}

export async function saveProduct(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p = adminState.productEdit;

  const payload = {
    name: fd.get('name'),
    slug: fd.get('slug'),
    price: Number(fd.get('price')),
    compare_at_price: fd.get('compare_at_price') ? Number(fd.get('compare_at_price')) : null,
    category_id: fd.get('category_id') || null,
    stock: Number(fd.get('stock') ?? 0),
    material: fd.get('material') || null,
    weight: fd.get('weight') || null,
    description: fd.get('description') || null,
    is_active: fd.get('is_active') === 'on',
    is_new: fd.get('is_new') === 'on',
    is_best_seller: fd.get('is_best_seller') === 'on',
    is_trending: fd.get('is_trending') === 'on',
    is_bridal: fd.get('is_bridal') === 'on',
    is_featured: fd.get('is_featured') === 'on',
  };

  let error;
  if (p.id) {
    ({ error } = await supabase.from('products').update(payload).eq('id', p.id));
  } else {
    const { data, error: err } = await supabase.from('products').insert(payload).select().maybeSingle();
    error = err;
    if (data) adminState.productEdit = data; // need id for image upload
  }

  if (error) { showNotif('Save failed: ' + error.message, 'error'); return; }
  showNotif(`Product ${p.id ? 'updated' : 'created'} successfully!`);
  await loadAdminProducts();
  adminState.productEdit = null;
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminProducts();
}

export async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  // Delete associated product_images records (storage files stay for safety)
  await supabase.from('product_images').delete().eq('product_id', id);
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) { showNotif('Delete failed: ' + error.message, 'error'); return; }
  showNotif('Product deleted.');
  await loadAdminProducts();
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminProducts();
}

export async function uploadProductImages(files) {
  if (!files || files.length === 0) return;
  const productId = adminState.productEdit?.id;
  if (!productId) {
    showNotif('Please save the product first, then upload images.', 'error');
    return;
  }
  // Determine category slug for folder
  const product = adminState.productEdit;
  const category = adminState.categories.find(c => c.id === product.category_id);
  const catSlug = category?.slug || '';
  const folder = catSlug ? `${catSlug}/` : '';

  const progressWrap = document.getElementById('product-upload-progress');
  const progressFill = document.getElementById('product-progress-fill');
  const progressLabel = document.getElementById('product-progress-label');
  if (progressWrap) progressWrap.style.display = 'flex';

  let done = 0;
  for (const file of Array.from(files)) {
    const validation = validateImageFile(file);
    if (!validation.ok) { showNotif(validation.error, 'error'); continue; }

    try {
      if (progressLabel) progressLabel.textContent = `Optimizing ${done + 1}/${files.length}…`;
      const { blob, name: optName } = await optimizeImage(file, 'product-images');
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${optName}`;
      const path = folder ? `${folder}${safeName}` : safeName;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, blob, { upsert: false, contentType: blob.type });
      if (upErr) { showNotif(`Upload failed: ${upErr.message}`, 'error'); continue; }
      const publicUrl = getPublicUrl('product-images', path);
      const { error: dbErr } = await supabase.from('product_images').insert({
        product_id: productId,
        image_url: publicUrl,
        bucket_path: path,
        sort_order: done,
      });
      if (dbErr) { showNotif(`DB save failed: ${dbErr.message}`, 'error'); }
      done++;
      const pct = Math.round((done / files.length) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressLabel) progressLabel.textContent = `Uploading ${done}/${files.length}…`;
    } catch (err) {
      showNotif(`Error: ${file.name} — ${err.message}`, 'error');
    }
  }

  if (progressWrap) setTimeout(() => { progressWrap.style.display = 'none'; }, 1500);

  // Reload images for this product
  const { data } = await supabase.from('product_images').select('*').eq('product_id', productId).order('sort_order');
  adminState.productEdit = { ...adminState.productEdit, product_images: data || [] };
  showNotif(`${done} image${done > 1 ? 's' : ''} uploaded!`);
  const content = document.getElementById('admin-content');
  if (content) { content.innerHTML = renderAdminProducts(); bindAdminEvents(); }
}

export async function removeProductImage(imageId, bucketPath) {
  if (!confirm('Remove this image?')) return;
  if (bucketPath) await supabase.storage.from('product-images').remove([bucketPath]);
  await supabase.from('product_images').delete().eq('id', imageId);
  // Refresh current product images
  const productId = adminState.productEdit?.id;
  if (productId) {
    const { data } = await supabase.from('product_images').select('*').eq('product_id', productId).order('sort_order');
    adminState.productEdit = { ...adminState.productEdit, product_images: data || [] };
  }
  showNotif('Image removed.');
  const content = document.getElementById('admin-content');
  if (content) { content.innerHTML = renderAdminProducts(); bindAdminEvents(); }
}

// ============================================
// Category Manager
// ============================================
async function loadAdminCategories() {
  const { data } = await supabase.from('categories').select('*').order('sort_order');
  adminState.categories = data || [];
}

function renderAdminCategories() {
  if (adminState.categoryEdit !== null) return renderCategoryForm();
  return `
    <div class="admin-page-header">
      <h1>Categories</h1>
      <p>Manage jewellery categories and their display images.</p>
    </div>
    <div class="admin-cards-grid">
      ${adminState.categories.map(c => `
        <div class="admin-cat-card">
          <div class="cat-img-wrap">
            <img src="${c.image_url || 'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=400'}" alt="${c.name}" />
            <div class="cat-img-overlay">
              <button onclick="startCategoryEdit(${JSON.stringify(c).replace(/"/g,'&quot;')})"><i class="lucide-pencil"></i> Edit</button>
            </div>
          </div>
          <div class="cat-info">
            <div class="cat-name">${c.name}</div>
            <div class="cat-slug">${c.slug}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCategoryForm() {
  const c = adminState.categoryEdit;
  return `
    <div class="admin-form-header">
      <button class="back-btn" onclick="cancelCategoryEdit()"><i class="lucide-arrow-left"></i> Back to Categories</button>
      <h1>Edit Category: ${c.name}</h1>
    </div>
    <form class="admin-form" onsubmit="saveCategory(event)">
      <div class="form-grid-2">
        <div class="form-group">
          <label>Category Name *</label>
          <input type="text" name="name" value="${c.name || ''}" required class="admin-input" />
        </div>
        <div class="form-group">
          <label>Slug *</label>
          <input type="text" name="slug" value="${c.slug || ''}" required class="admin-input" />
        </div>
        <div class="form-group">
          <label>Sort Order</label>
          <input type="number" name="sort_order" value="${c.sort_order ?? 0}" class="admin-input" />
        </div>
        <div class="form-group">
          <label>Is Featured?</label>
          <label class="check-flag"><input type="checkbox" name="is_featured" ${c.is_featured ? 'checked' : ''} /><span>Show on Homepage</span></label>
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea name="description" class="admin-textarea" rows="3">${c.description || ''}</textarea>
      </div>

      <div class="form-group">
        <label>Category Image</label>
        ${c.image_url ? `
          <div class="current-image-preview">
            <img src="${c.image_url}" alt="${c.name}" />
            <span>Current image</span>
          </div>
        ` : ''}
        <div class="upload-zone" id="cat-upload-zone" data-input-id="cat-img-input">
          <i class="lucide-image-plus"></i>
          <p>Drag &amp; drop or <span>click to upload</span> category image</p>
          <p class="upload-hint">JPG, PNG, WebP, SVG — Max 5MB — Auto-optimized</p>
          <input type="file" id="cat-img-input" accept="image/jpeg,image/png,image/webp,image/svg+xml" style="display:none"
            onchange="uploadCategoryImage(this.files[0])" />
        </div>
        <div class="upload-progress-wrap" id="cat-upload-progress" style="display:none">
          <div class="progress-bar"><div class="progress-fill" id="cat-progress-fill"></div></div>
          <span>Uploading…</span>
        </div>
        <input type="hidden" name="image_url" id="cat-image-url-hidden" value="${c.image_url || ''}" />
      </div>

      <div class="form-actions">
        <button type="button" class="btn-ghost" onclick="cancelCategoryEdit()">Cancel</button>
        <button type="submit" class="btn-gold"><i class="lucide-save"></i> Save Category</button>
      </div>
    </form>
  `;
}

export function startCategoryEdit(c) {
  adminState.categoryEdit = c;
  const content = document.getElementById('admin-content');
  if (content) { content.innerHTML = renderAdminCategories(); bindAdminEvents(); }
}

export function cancelCategoryEdit() {
  adminState.categoryEdit = null;
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminCategories();
}

export async function uploadCategoryImage(file) {
  if (!file) return;
  const validation = validateImageFile(file);
  if (!validation.ok) { showNotif(validation.error, 'error'); return; }

  const progressWrap = document.getElementById('cat-upload-progress');
  const progressFill = document.getElementById('cat-progress-fill');
  if (progressWrap) progressWrap.style.display = 'flex';
  if (progressFill) progressFill.style.width = '30%';

  try {
    const { blob, name: optName } = await optimizeImage(file, 'category-images');
    if (progressFill) progressFill.style.width = '60%';
    const path = `${adminState.categoryEdit.id || 'temp'}-${Date.now()}-${optName}`;
    const { error } = await supabase.storage.from('category-images').upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) { showNotif('Upload failed: ' + error.message, 'error'); return; }

    const publicUrl = getPublicUrl('category-images', path);
    if (progressFill) progressFill.style.width = '100%';

    // Update category in DB immediately
    if (adminState.categoryEdit.id) {
      await supabase.from('categories').update({ image_url: publicUrl }).eq('id', adminState.categoryEdit.id);
    }

    adminState.categoryEdit = { ...adminState.categoryEdit, image_url: publicUrl };
    const hidden = document.getElementById('cat-image-url-hidden');
    if (hidden) hidden.value = publicUrl;

    // Show preview
    const previewZone = document.getElementById('cat-upload-zone');
    if (previewZone) {
      previewZone.insertAdjacentHTML('beforebegin', `
        <div class="current-image-preview">
          <img src="${publicUrl}" alt="Uploaded" style="max-height:100px;border-radius:8px;margin-bottom:0.5rem" />
          <span>Uploaded &amp; optimized!</span>
        </div>
      `);
    }

    if (progressWrap) setTimeout(() => { progressWrap.style.display = 'none'; }, 1200);
    showNotif('Category image uploaded & optimized!');
  } catch (err) {
    showNotif('Upload error: ' + err.message, 'error');
    if (progressWrap) progressWrap.style.display = 'none';
  }
}

export async function saveCategory(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const c = adminState.categoryEdit;
  const payload = {
    name: fd.get('name'),
    slug: fd.get('slug'),
    description: fd.get('description') || null,
    sort_order: Number(fd.get('sort_order') ?? 0),
    is_featured: fd.get('is_featured') === 'on',
    image_url: fd.get('image_url') || c.image_url || null,
  };
  const { error } = await supabase.from('categories').update(payload).eq('id', c.id);
  if (error) { showNotif('Save failed: ' + error.message, 'error'); return; }
  showNotif('Category updated!');
  await loadAdminCategories();
  adminState.categoryEdit = null;
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminCategories();
}

// ============================================
// Banner Manager
// ============================================
async function loadAdminBanners() {
  const { data } = await supabase.from('banners').select('*').order('sort_order');
  adminState.banners = data || [];
}

function renderAdminBanners() {
  if (adminState.bannerEdit !== null) return renderBannerForm();
  return `
    <div class="admin-page-header">
      <div>
        <h1>Banners</h1>
        <p>Manage homepage hero banners and promotional slides.</p>
      </div>
      <button class="btn-gold" onclick="startBannerEdit({})"><i class="lucide-plus"></i> Add Banner</button>
    </div>
    <div class="admin-banner-list">
      ${adminState.banners.length === 0 ? `<div class="admin-empty"><i class="lucide-image-off"></i><p>No banners yet.</p></div>` : ''}
      ${adminState.banners.map(b => `
        <div class="admin-banner-card ${!b.is_active ? 'inactive' : ''}">
          <div class="banner-thumb">
            <img src="${b.image_url}" alt="${b.title}" />
            <span class="banner-type-badge">${b.banner_type}</span>
          </div>
          <div class="banner-details">
            <div class="banner-title">${b.title}</div>
            <div class="banner-sub">${b.subtitle || '—'}</div>
            <div class="banner-meta">
              <span>Order: ${b.sort_order}</span>
              <span class="status-badge ${b.is_active ? 'active' : 'inactive'}">${b.is_active ? 'Active' : 'Hidden'}</span>
            </div>
          </div>
          <div class="banner-actions">
            <button onclick="toggleBannerActive('${b.id}',${!b.is_active})" title="${b.is_active ? 'Hide' : 'Show'}">
              <i class="lucide-${b.is_active ? 'eye-off' : 'eye'}"></i>
            </button>
            <button onclick="startBannerEdit(${JSON.stringify(b).replace(/"/g,'&quot;')})" title="Edit">
              <i class="lucide-pencil"></i>
            </button>
            <button onclick="deleteBanner('${b.id}','${b.bucket_path || ''}')" title="Delete" class="danger-btn">
              <i class="lucide-trash-2"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBannerForm() {
  const b = adminState.bannerEdit;
  const isNew = !b.id;
  return `
    <div class="admin-form-header">
      <button class="back-btn" onclick="cancelBannerEdit()"><i class="lucide-arrow-left"></i> Back to Banners</button>
      <h1>${isNew ? 'Add New Banner' : 'Edit Banner'}</h1>
    </div>
    <form class="admin-form" onsubmit="saveBanner(event)">
      <div class="form-grid-2">
        <div class="form-group">
          <label>Banner Title *</label>
          <input type="text" name="title" value="${b.title || ''}" required class="admin-input" placeholder="e.g. New Bridal Collection" />
        </div>
        <div class="form-group">
          <label>Banner Type</label>
          <select name="banner_type" class="admin-select">
            ${['hero','promotional','offer'].map(t => `<option value="${t}" ${b.banner_type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Subtitle</label>
          <input type="text" name="subtitle" value="${b.subtitle || ''}" class="admin-input" />
        </div>
        <div class="form-group">
          <label>Sort Order</label>
          <input type="number" name="sort_order" value="${b.sort_order ?? 0}" class="admin-input" />
        </div>
        <div class="form-group">
          <label>Button Text</label>
          <input type="text" name="button_text" value="${b.button_text || ''}" class="admin-input" placeholder="e.g. Shop Now" />
        </div>
        <div class="form-group">
          <label>Button Link</label>
          <input type="text" name="button_link" value="${b.button_link || ''}" class="admin-input" placeholder="e.g. /shop or /category/bangles" />
        </div>
      </div>

      <div class="form-group">
        <label class="check-flag">
          <input type="checkbox" name="is_active" ${b.is_active !== false ? 'checked' : ''} />
          <span>Active (display on website)</span>
        </label>
      </div>

      <div class="form-group">
        <label>Banner Image *</label>
        ${b.image_url ? `
          <div class="current-image-preview">
            <img src="${b.image_url}" alt="${b.title}" />
            <span>Current banner image</span>
          </div>
        ` : ''}
        <div class="upload-zone" id="banner-upload-zone" data-input-id="banner-img-input">
          <i class="lucide-image-plus"></i>
          <p>Drag &amp; drop or <span>click to upload</span> banner image</p>
          <p class="upload-hint">JPG, PNG, WebP, SVG — Recommended: 1920×600px — Max 5MB — Auto-optimized</p>
          <input type="file" id="banner-img-input" accept="image/jpeg,image/png,image/webp,image/svg+xml" style="display:none"
            onchange="uploadBannerImage(this.files[0])" />
        </div>
        <div class="upload-progress-wrap" id="banner-upload-progress" style="display:none">
          <div class="progress-bar"><div class="progress-fill" id="banner-progress-fill"></div></div>
          <span>Uploading…</span>
        </div>
        <input type="hidden" name="image_url" id="banner-image-url-hidden" value="${b.image_url || ''}" />
        <input type="hidden" name="bucket_path" id="banner-bucket-path-hidden" value="${b.bucket_path || ''}" />
      </div>

      <div class="form-actions">
        <button type="button" class="btn-ghost" onclick="cancelBannerEdit()">Cancel</button>
        <button type="submit" class="btn-gold"><i class="lucide-save"></i> ${isNew ? 'Create Banner' : 'Save Changes'}</button>
      </div>
    </form>
  `;
}

export function startBannerEdit(b) {
  adminState.bannerEdit = b;
  const content = document.getElementById('admin-content');
  if (content) { content.innerHTML = renderAdminBanners(); bindAdminEvents(); }
}

export function cancelBannerEdit() {
  adminState.bannerEdit = null;
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminBanners();
}

export async function uploadBannerImage(file) {
  if (!file) return;
  const validation = validateImageFile(file);
  if (!validation.ok) { showNotif(validation.error, 'error'); return; }

  const progressWrap = document.getElementById('banner-upload-progress');
  const progressFill = document.getElementById('banner-progress-fill');
  if (progressWrap) progressWrap.style.display = 'flex';
  if (progressFill) progressFill.style.width = '30%';

  try {
    const { blob, name: optName } = await optimizeImage(file, 'banners');
    if (progressFill) progressFill.style.width = '60%';
    const path = `banner-${Date.now()}-${optName}`;
    const { error } = await supabase.storage.from('banners').upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) { showNotif('Upload failed: ' + error.message, 'error'); return; }

    const publicUrl = getPublicUrl('banners', path);
    if (progressFill) progressFill.style.width = '100%';
    adminState.bannerEdit = { ...adminState.bannerEdit, image_url: publicUrl, bucket_path: path };
    document.getElementById('banner-image-url-hidden').value = publicUrl;
    document.getElementById('banner-bucket-path-hidden').value = path;

    const previewZone = document.getElementById('banner-upload-zone');
    if (previewZone) {
      previewZone.insertAdjacentHTML('beforebegin', `
        <div class="current-image-preview">
          <img src="${publicUrl}" style="max-height:120px;border-radius:8px;margin-bottom:0.5rem" />
          <span>Banner uploaded &amp; optimized!</span>
        </div>
      `);
    }
    if (progressWrap) setTimeout(() => { progressWrap.style.display = 'none'; }, 1200);
    showNotif('Banner image uploaded & optimized!');
  } catch (err) {
    showNotif('Upload error: ' + err.message, 'error');
    if (progressWrap) progressWrap.style.display = 'none';
  }
}

export async function saveBanner(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const imageUrl = fd.get('image_url');
  if (!imageUrl) { showNotif('Please upload a banner image first.', 'error'); return; }

  const payload = {
    title: fd.get('title'),
    subtitle: fd.get('subtitle') || null,
    button_text: fd.get('button_text') || null,
    button_link: fd.get('button_link') || null,
    image_url: imageUrl,
    bucket_path: fd.get('bucket_path') || null,
    banner_type: fd.get('banner_type') || 'hero',
    sort_order: Number(fd.get('sort_order') ?? 0),
    is_active: fd.get('is_active') === 'on',
  };

  const b = adminState.bannerEdit;
  let error;
  if (b.id) {
    ({ error } = await supabase.from('banners').update(payload).eq('id', b.id));
  } else {
    ({ error } = await supabase.from('banners').insert(payload));
  }

  if (error) { showNotif('Save failed: ' + error.message, 'error'); return; }
  showNotif(`Banner ${b.id ? 'updated' : 'created'}!`);
  await loadAdminBanners();
  adminState.bannerEdit = null;
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminBanners();
}

export async function deleteBanner(id, bucketPath) {
  if (!confirm('Delete this banner?')) return;
  if (bucketPath) await supabase.storage.from('banners').remove([bucketPath]);
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) { showNotif('Delete failed: ' + error.message, 'error'); return; }
  showNotif('Banner deleted.');
  await loadAdminBanners();
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminBanners();
}

export async function toggleBannerActive(id, value) {
  await supabase.from('banners').update({ is_active: value }).eq('id', id);
  await loadAdminBanners();
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminBanners();
}

// ============================================
// Brand Assets
// ============================================
async function loadBrandSettings() {
  const { data } = await supabase.from('brand_settings').select('*');
  adminState.brandSettings = {};
  (data || []).forEach(row => { adminState.brandSettings[row.key] = row; });
}

function renderAdminBrand() {
  const logoRow = adminState.brandSettings['logo'];
  const logoUrl = logoRow?.value || '';
  const logoUploading = adminState.brandUploading['logo'];

  const otherAssets = [
    { key: 'footer_logo',  label: 'Footer Logo',  desc: 'Logo shown in website footer. Can match header logo or be a white/light variant.' },
    { key: 'favicon',      label: 'Favicon',      desc: 'Browser tab icon. Must be a square PNG or ICO file (32×32px or 64×64px).' },
    { key: 'loading_logo', label: 'Loading Logo', desc: 'Shown during page loads. Recommended: Small square logo, 200×200px.' },
  ];

  return `
    <div class="admin-page-header">
      <h1>Brand Settings</h1>
      <p>Upload and manage your logo and brand imagery. The logo appears instantly across the entire website.</p>
    </div>

    <div class="logo-manager-card">
      <div class="logo-manager-header">
        <h2><i class="lucide-image"></i> Website Logo</h2>
        <p>Displayed in the header (60px), mobile menu (45px), footer, login, checkout, and invoices.</p>
      </div>
      <div class="logo-manager-body">
        <div class="logo-manager-preview">
          ${logoUrl
            ? `<img src="${logoUrl}" alt="Website Logo" id="logo-preview-img" />`
            : `<div class="logo-placeholder"><div class="logo-box"><span>E</span></div><p>Elegance of Women</p></div>`}
          ${logoUploading ? '<div class="brand-uploading"><i class="lucide-loader-2 spin"></i></div>' : ''}
        </div>
        <div class="logo-manager-actions">
          <p class="logo-formats"><i class="lucide-info"></i> Supported: PNG, JPG, JPEG, SVG, WEBP — Max 5 MB</p>
          <div class="logo-action-buttons">
            ${logoUrl ? `
              <label class="btn-gold brand-upload-label">
                <i class="lucide-refresh-cw"></i> Replace Logo
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" style="display:none"
                  onchange="uploadBrandAsset('logo', this.files[0])" />
              </label>
              <button class="btn-ghost danger-btn" onclick="deleteBrandAsset('logo')"><i class="lucide-trash-2"></i> Delete Logo</button>
            ` : `
              <label class="btn-gold brand-upload-label">
                <i class="lucide-upload"></i> Upload Logo
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" style="display:none"
                  onchange="uploadBrandAsset('logo', this.files[0])" />
              </label>
            `}
          </div>
          ${logoUrl ? `
            <div class="brand-asset-url">
              <input type="text" value="${logoUrl}" readonly class="admin-input url-input" />
              <button onclick="copyImageUrl('${logoUrl}')" title="Copy URL"><i class="lucide-copy"></i></button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="admin-page-header" style="margin-top:2.5rem">
      <h2 style="font-size:1.25rem">Other Brand Assets</h2>
    </div>
    <div class="brand-assets-grid">
      ${otherAssets.map(a => {
        const row = adminState.brandSettings[a.key];
        const currentUrl = row?.value || '';
        const uploading = adminState.brandUploading[a.key];
        return `
          <div class="brand-asset-card">
            <div class="brand-asset-preview">
              ${currentUrl ? `<img src="${currentUrl}" alt="${a.label}" />` : `<div class="no-brand-img"><i class="lucide-image"></i><span>No image</span></div>`}
              ${uploading ? '<div class="brand-uploading"><i class="lucide-loader-2 spin"></i></div>' : ''}
            </div>
            <div class="brand-asset-info">
              <h3>${a.label}</h3>
              <p>${a.desc}</p>
              ${currentUrl ? `
                <div class="brand-asset-url">
                  <input type="text" value="${currentUrl}" readonly class="admin-input url-input" />
                  <button onclick="copyImageUrl('${currentUrl}')" title="Copy URL"><i class="lucide-copy"></i></button>
                </div>
              ` : ''}
              <div class="brand-asset-actions">
                <label class="btn-gold brand-upload-label">
                  <i class="lucide-upload"></i> ${currentUrl ? 'Replace' : 'Upload'} Image
                  <input type="file" accept="image/*" style="display:none"
                    onchange="uploadBrandAsset('${a.key}', this.files[0])" />
                </label>
                ${currentUrl ? `<button class="btn-ghost danger-btn" onclick="deleteBrandAsset('${a.key}')"><i class="lucide-trash-2"></i> Remove</button>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="brand-note">
      <i class="lucide-info"></i>
      <p>After uploading brand assets, they will automatically appear throughout the website. The header logo replaces the default "E" monogram, and the footer logo updates in the footer section.</p>
    </div>
  `;
}

export async function uploadBrandAsset(key, file) {
  if (!file) return;
  const validation = validateImageFile(file);
  if (!validation.ok) { showNotif(validation.error, 'error'); return; }

  adminState.brandUploading = { ...adminState.brandUploading, [key]: true };
  const contentEl = document.getElementById('admin-content');
  if (contentEl) contentEl.innerHTML = renderAdminBrand();

  try {
    const bucket = key === 'logo' ? 'logos' : 'brand-assets';
    const { blob, name: optName } = await optimizeImage(file, bucket);
    // Use subfolder per key
    const subfolder = key === 'logo' ? '' : key === 'favicon' ? 'favicon/' : key === 'footer_logo' ? 'footer/' : '';
    const path = `${subfolder}${key}-${Date.now()}-${optName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) { showNotif('Upload failed: ' + error.message, 'error'); adminState.brandUploading[key] = false; return; }

    const publicUrl = getPublicUrl(bucket, path);

    // Delete old file from storage if exists
    const old = adminState.brandSettings[key];
    if (old?.bucket_path) await supabase.storage.from(bucket).remove([old.bucket_path]);

    await supabase.from('brand_settings').upsert({ key, value: publicUrl, bucket_path: path, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    adminState.brandSettings[key] = { key, value: publicUrl, bucket_path: path };
    adminState.brandUploading[key] = false;
    showNotif(`${key} uploaded & optimized!`);
    if (contentEl) contentEl.innerHTML = renderAdminBrand();
  } catch (err) {
    showNotif('Upload error: ' + err.message, 'error');
    adminState.brandUploading[key] = false;
    if (contentEl) contentEl.innerHTML = renderAdminBrand();
  }
}

export async function deleteBrandAsset(key) {
  if (!confirm('Remove this brand asset?')) return;
  const row = adminState.brandSettings[key];
  const bucket = key === 'logo' ? 'logos' : 'brand-assets';
  if (row?.bucket_path) await supabase.storage.from(bucket).remove([row.bucket_path]);
  await supabase.from('brand_settings').update({ value: '', bucket_path: null }).eq('key', key);
  adminState.brandSettings[key] = { ...row, value: '', bucket_path: null };
  showNotif('Brand asset removed.');
  const content = document.getElementById('admin-content');
  if (content) content.innerHTML = renderAdminBrand();
}

// ============================================
// Init Admin Page Data
// ============================================
export async function initAdminPage() {
  await Promise.all([loadAdminDashboardStats(), loadAdminCategories()]);
}
