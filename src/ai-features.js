// ============================================
// AI Features Module — Elegance of Women
// 8 AI-powered pages powered by Google Gemini
// ============================================

import { supabase } from './lib/supabase.js';
import { validateImageFile, optimizeImage } from './lib/imageUtils.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/gemini-ai`;

// ============================================
// Shared helpers
// ============================================

function getPublicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function aiNotif(msg, type = 'success') {
  const el = document.getElementById('ai-notif');
  if (!el) return;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  const color = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#D4A437';
  el.innerHTML = `<div class="ai-notif-inner ${type}"><i class="lucide-${icon}"></i><span>${msg}</span></div>`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function authGate() {
  if (!window.state?.user) {
    aiNotif('Please log in to use this feature.', 'error');
    setTimeout(() => window.navigate('/login'), 1500);
    return false;
  }
  return true;
}

function showLoading(btn, text = 'Processing...') {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.originalHTML = btn.innerHTML;
  btn.innerHTML = `<i class="lucide-loader-2 spin"></i> ${text}`;
}

function hideLoading(btn) {
  if (!btn) return;
  btn.disabled = false;
  if (btn.dataset.originalHTML) btn.innerHTML = btn.dataset.originalHTML;
}

function showProgress(container, percent) {
  if (!container) return;
  const bar = container.querySelector('.ai-progress-fill');
  const label = container.querySelector('.ai-progress-label');
  if (bar) bar.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}%`;
}

function showProgressContainer(target) {
  if (!target) return null;
  target.innerHTML = `
    <div class="ai-processing">
      <div class="ai-processing-spinner"><i class="lucide-loader-2 spin"></i></div>
      <p class="ai-processing-text">AI is analyzing your request...</p>
      <div class="ai-progress-bar"><div class="ai-progress-fill" style="width:0%"></div></div>
      <span class="ai-progress-label">0%</span>
    </div>
  `;
  return target;
}

async function simulateProgress(target) {
  let pct = 0;
  const interval = setInterval(() => {
    pct = Math.min(pct + Math.random() * 12, 90);
    showProgress(target, Math.round(pct));
  }, 300);
  return () => { clearInterval(interval); showProgress(target, 100); };
}

async function uploadToBucket(bucket, file, folder = '') {
  const validation = validateImageFile(file);
  if (!validation.ok) { aiNotif(validation.error, 'error'); return null; }
  const { blob, name } = await optimizeImage(file, bucket);
  const path = folder ? `${folder}${Date.now()}-${name}` : `${Date.now()}-${name}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: false, contentType: blob.type });
  if (error) { aiNotif('Upload failed: ' + error.message, 'error'); return null; }
  return { path, url: getPublicUrl(bucket, path) };
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callGeminiAI(payload) {
  const headers = {
    'Content-Type': 'application/json',
  };
  // Attach auth token if available
  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.access_token) {
    headers['Authorization'] = `Bearer ${session.session.access_token}`;
  } else {
    headers['apikey'] = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
    throw new Error(errBody.error || `Request failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'AI request failed');
  return data;
}

function pageHero(icon, title, subtitle) {
  return `
    <div class="ai-page-hero">
      <div class="container">
        <div class="ai-hero-icon"><i class="lucide-${icon}"></i></div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
    </div>
  `;
}

function uploadZoneHTML(inputId, label = 'Drag & drop or click to upload') {
  return `
    <div class="ai-upload-zone" id="${inputId}-zone" data-input-id="${inputId}">
      <i class="lucide-cloud-upload"></i>
      <p>${label}</p>
      <span>JPG, PNG, WEBP — Max 5MB</span>
      <input type="file" id="${inputId}" accept="image/jpeg,image/png,image/webp" style="display:none" />
    </div>
  `;
}

function bindUploadZone(zoneId, callback) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  const input = document.getElementById(zone.dataset.inputId);
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; callback(input.files); }
  });
  input.addEventListener('change', () => { if (input.files.length) callback(input.files); });
}

// ============================================
// 1. AI Jewellery Recommendation
// ============================================
export function renderAIRecommendation() {
  return `
    ${pageHero('sparkles', 'AI Jewellery Recommendation', 'Upload a selfie and let Gemini AI find the perfect jewellery for your face shape and skin tone')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="ai-feature-layout">
        <div class="ai-feature-panel">
          <h3>Step 1: Upload Your Photo</h3>
          ${uploadZoneHTML('rec-selfie-input', 'Upload a selfie or use your camera')}
          <div class="ai-camera-row">
            <button class="btn-ghost" onclick="openCamera('rec-selfie-input')"><i class="lucide-camera"></i> Use Camera</button>
          </div>
          <div id="rec-preview" class="ai-preview-area"></div>

          <h3 style="margin-top:1.5rem">Step 2: Your Preferences</h3>
          <div class="ai-form-grid">
            <select id="rec-gender" class="ai-select"><option value="">Gender (optional)</option><option>Female</option><option>Male</option></select>
            <select id="rec-style" class="ai-select"><option value="">Preferred Style</option><option>Traditional</option><option>Modern</option><option>Minimalist</option><option>Bridal</option><option>Fusion</option></select>
            <input id="rec-dress-color" class="ai-input" placeholder="Dress color (e.g. Red, Blue)" />
          </div>
          <button class="btn-gold" style="width:100%;margin-top:1rem" id="rec-submit-btn" onclick="runAIRecommendation(event)">
            <i class="lucide-sparkles"></i> Get Recommendations
          </button>
        </div>
        <div class="ai-feature-results" id="rec-results">
          <div class="ai-results-placeholder">
            <i class="lucide-sparkles"></i>
            <p>Your AI-powered recommendations will appear here</p>
          </div>
        </div>
      </div>
      <div id="rec-history" class="ai-history-section"></div>
    </div>
  `;
}

export async function runAIRecommendation(ev) {
  if (!authGate()) return;
  const fileInput = document.getElementById('rec-selfie-input');
  if (!fileInput.files.length) { aiNotif('Please upload a selfie first.', 'error'); return; }

  const btn = ev?.target?.closest('button') || document.getElementById('rec-submit-btn');
  const resultsDiv = document.getElementById('rec-results');
  showLoading(btn, 'Analyzing photo...');
  const progressTarget = showProgressContainer(resultsDiv);
  const stopProgress = await simulateProgress(progressTarget);

  try {
    const file = fileInput.files[0];
    const imageBase64 = await fileToBase64(file);
    const gender = (document.getElementById('rec-gender')).value;
    const style = (document.getElementById('rec-style')).value;
    const dressColor = (document.getElementById('rec-dress-color')).value;

    // Upload to storage for history
    const uploaded = await uploadToBucket('brand-assets', file, 'ai-recommendations/');

    const result = await callGeminiAI({
      feature: 'recommendation', imageBase64, mimeType: file.type, gender, style, dressColor, });

    stopProgress();

    // Save to database
    if (uploaded) {
      await supabase.from('ai_recommendations').insert({
        user_id: window.state.user.id, selfie_url: uploaded.url, bucket_path: uploaded.path, face_shape: result.analysis?.face_shape, skin_tone: result.analysis?.skin_tone, dress_color: dressColor, preferred_style: style, gender, match_results: result, });
    }

    const recs = result.recommendations || {};
    const analysis = result.analysis || {};

    resultsDiv.innerHTML = `
      <div class="ai-analysis-summary">
        <h3>AI Analysis</h3>
        <div class="ai-analysis-tags">
          ${analysis.face_shape ? `<span class="ai-tag">Face Shape: ${analysis.face_shape}</span>` : ''}
          ${analysis.skin_tone ? `<span class="ai-tag">Skin Tone: ${analysis.skin_tone}</span>` : ''}
          ${analysis.hair_color ? `<span class="ai-tag">Hair: ${analysis.hair_color}</span>` : ''}
          ${dressColor ? `<span class="ai-tag">Dress: ${dressColor}</span>` : ''}
          ${style ? `<span class="ai-tag">Style: ${style}</span>` : ''}
        </div>
        ${analysis.overall_style ? `<p class="ai-analysis-style">${analysis.overall_style}</p>` : ''}
      </div>
      ${result.summary ? `<p class="ai-rec-summary">${result.summary}</p>` : ''}
      <div class="ai-rec-detailed">
        ${Object.entries(recs).map(([type, detail]) => `
          <div class="ai-rec-detail-card">
            <div class="ai-rec-detail-header">
              <i class="lucide-${type === 'earrings' ? 'ear' : type === 'necklace' ? 'circle' : type === 'bangles' ? 'circle-dot' : type === 'rings' ? 'ring' : 'link'}"></i>
              <h4>${type.charAt(0).toUpperCase() + type.slice(1)}</h4>
            </div>
            <p class="ai-rec-type"><strong>Recommended:</strong> ${detail.type}</p>
            <p class="ai-rec-reason">${detail.reason}</p>
          </div>
        `).join('')}
      </div>
    `;
    aiNotif('Recommendations generated & saved to your account!');
    loadRecHistory();
  } catch (err) {
    stopProgress();
    resultsDiv.innerHTML = `<div class="ai-error-state"><i class="lucide-alert-circle"></i><p>${err.message}</p><button class="btn-ghost" onclick="runAIRecommendation()">Try Again</button></div>`;
    aiNotif('Error: ' + err.message, 'error');
  } finally {
    hideLoading(btn);
  }
}

async function loadRecHistory() {
  if (!window.state?.user) return;
  const { data } = await supabase.from('ai_recommendations').select('*').eq('user_id', window.state.user.id).order('created_at', { ascending: false }).limit(5);
  const div = document.getElementById('rec-history');
  if (!div || !data?.length) return;
  div.innerHTML = `
    <h3 style="margin-top:2rem">Your Recommendation History</h3>
    <div class="ai-history-grid">
      ${data.map(r => `
        <div class="ai-history-card" onclick="viewRecHistory('${r.id}')">
          <img src="${r.selfie_url}" alt="Selfie" />
          <div><p>${r.face_shape || 'N/A'} • ${r.skin_tone || 'N/A'}</p><p class="ai-history-date">${new Date(r.created_at).toLocaleDateString('en-IN')}</p></div>
        </div>
      `).join('')}
    </div>
  `;
}

export function viewRecHistory(id) {
  // Will be populated from DB
}

// ============================================
// 2. Virtual Try-On
// ============================================
let tryOnState = { photoUrl: null, photoFile: null, type: null, product: null, zoom: 1, rotation: 0 };

export function renderVirtualTryOn() {
  return `
    ${pageHero('glasses', 'Virtual Try-On', 'See how jewellery looks on you before you buy — upload your photo and try any piece')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="ai-feature-layout">
        <div class="ai-feature-panel">
          <h3>Upload Your Photo</h3>
          ${uploadZoneHTML('tryon-photo-input', 'Upload your photo or use camera')}
          <div class="ai-camera-row"><button class="btn-ghost" onclick="openCamera('tryon-photo-input')"><i class="lucide-camera"></i> Use Camera</button></div>
          <div id="tryon-preview" class="ai-preview-area"></div>

          <h3 style="margin-top:1.5rem">Choose Jewellery Type</h3>
          <div class="ai-type-selector">
            ${['Necklaces','Earrings','Rings','Bangles','Bracelets'].map(t => `
              <button class="ai-type-btn" onclick="selectTryOnType('${t}', this)">${t}</button>
            `).join('')}
          </div>

          <h3 style="margin-top:1.5rem">Select a Product</h3>
          <div id="tryon-products" class="ai-product-mini-grid"></div>

          <div class="ai-tryon-controls" id="tryon-controls" style="display:none">
            <button class="btn-ghost" onclick="tryOnZoom(1.2)"><i class="lucide-zoom-in"></i></button>
            <button class="btn-ghost" onclick="tryOnZoom(0.8)"><i class="lucide-zoom-out"></i></button>
            <button class="btn-ghost" onclick="tryOnRotate(15)"><i class="lucide-rotate-cw"></i></button>
            <button class="btn-gold-small" onclick="saveTryOn()"><i class="lucide-heart"></i> Save Look</button>
            <button class="btn-ghost" onclick="downloadTryOn()"><i class="lucide-download"></i> Download</button>
          </div>
        </div>
        <div class="ai-feature-results" id="tryon-canvas-area">
          <div class="ai-results-placeholder">
            <i class="lucide-glasses"></i>
            <p>Upload your photo and select jewellery to see the try-on preview</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function initVirtualTryOn() {
  const { data } = await supabase.from('products').select('*, product_images(*)').eq('is_active', true).limit(12);
  const grid = document.getElementById('tryon-products');
  if (grid && data) {
    grid.innerHTML = data.map(p => `
      <div class="ai-product-mini" onclick="selectTryOnProduct('${p.id}', this)">
        <img src="${p.product_images?.[0]?.image_url || 'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=200'}" alt="${p.name}" />
        <span>${p.name}</span>
      </div>
    `).join('');
  }
  bindUploadZone('tryon-photo-input-zone', async (files) => {
    const file = files[0];
    tryOnState.photoFile = file;
    const uploaded = await uploadToBucket('brand-assets', file, 'tryon-photos/');
    if (uploaded) {
      tryOnState.photoUrl = uploaded.url;
      document.getElementById('tryon-preview').innerHTML = `<img src="${uploaded.url}" alt="Your photo" class="ai-preview-img" />`;
      renderTryOnPreview();
    }
  });
}

export function selectTryOnType(type, btn) {
  document.querySelectorAll('.ai-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tryOnState.type = type;
  renderTryOnPreview();
}

export async function selectTryOnProduct(productId, el) {
  document.querySelectorAll('.ai-product-mini').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  const { data } = await supabase.from('products').select('*, product_images(*)').eq('id', productId).maybeSingle();
  tryOnState.product = data;
  renderTryOnPreview();
}

function renderTryOnPreview() {
  const area = document.getElementById('tryon-canvas-area');
  const controls = document.getElementById('tryon-controls');
  if (!tryOnState.photoUrl || !tryOnState.product) {
    area.innerHTML = `<div class="ai-results-placeholder"><i class="lucide-glasses"></i><p>Upload your photo and select jewellery to see the try-on preview</p></div>`;
    controls.style.display = 'none';
    return;
  }
  controls.style.display = 'flex';
  const jewelleryImg = tryOnState.product.product_images?.[0]?.image_url;
  area.innerHTML = `
    <div class="ai-tryon-canvas">
      <img src="${tryOnState.photoUrl}" alt="User" class="ai-tryon-user-photo" />
      <img src="${jewelleryImg}" alt="Jewellery" class="ai-tryon-jewellery-overlay"
        style="transform: translateX(-50%) scale(${tryOnState.zoom}) rotate(${tryOnState.rotation}deg)" />
    </div>
    <p class="ai-tryon-hint">This is a preview overlay. For a true virtual try-on, drag the jewellery to position it. Use controls to zoom and rotate.</p>
    <p class="ai-tryon-disclaimer"><i class="lucide-info"></i> This is a realistic overlay preview. AI-powered virtual try-on generation will be available soon.</p>
  `;
}

export function tryOnZoom(factor) { tryOnState.zoom *= factor; renderTryOnPreview(); }
export function tryOnRotate(deg) { tryOnState.rotation += deg; renderTryOnPreview(); }

export async function saveTryOn() {
  if (!authGate()) return;
  if (!tryOnState.product) { aiNotif('Select a product first.', 'error'); return; }
  const { error } = await supabase.from('virtual_tryons').insert({
    user_id: window.state.user.id, user_photo_url: tryOnState.photoUrl, product_id: tryOnState.product.id, jewellery_type: tryOnState.type || 'General', });
  if (error) { aiNotif('Save failed: ' + error.message, 'error'); return; }
  aiNotif('Look saved to your favourites!');
}

export function downloadTryOn() {
  aiNotif('Right-click the preview image and select "Save image as" to download.');
}

// ============================================
// 3. Gift Planner
// ============================================
export function renderGiftPlanner() {
  return `
    ${pageHero('gift', 'Occasion-Based Gift Planner', 'Find the perfect jewellery gift for any occasion with Gemini AI gift planner')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="ai-gift-planner-layout">
        <div class="ai-gift-form-card">
          <h3>Tell Us About Your Gift</h3>
          <div class="ai-form-grid">
            <div class="ai-form-group">
              <label>Occasion *</label>
              <select id="gp-occasion" class="ai-select">
                <option value="">Select Occasion</option>
                <option>Birthday</option><option>Wedding</option><option>Anniversary</option>
                <option>Engagement</option><option>Valentine's Day</option><option>Festival</option>
                <option>Graduation</option><option>Mother's Day</option><option>Friendship Day</option>
              </select>
            </div>
            <div class="ai-form-group">
              <label>Recipient</label>
              <select id="gp-recipient" class="ai-select">
                <option value="">Select Recipient</option><option>Wife</option><option>Girlfriend</option>
                <option>Mother</option><option>Sister</option><option>Daughter</option><option>Friend</option><option>Bride</option>
              </select>
            </div>
            <div class="ai-form-group">
              <label>Budget Range</label>
              <select id="gp-budget" class="ai-select">
                <option value="0-500">Under ₹500</option>
                <option value="500-1000">₹500 – ₹1,000</option>
                <option value="1000-2000">₹1,000 – ₹2,000</option>
                <option value="2000-5000">₹2,000 – ₹5,000</option>
              </select>
            </div>
            <div class="ai-form-group">
              <label>Jewellery Type</label>
              <select id="gp-jewellery-type" class="ai-select">
                <option value="">Any Type</option><option>Earrings</option><option>Necklaces</option>
                <option>Rings</option><option>Bangles</option><option>Bracelets</option>
              </select>
            </div>
            <div class="ai-form-group">
              <label>Preferred Metal</label>
              <select id="gp-metal" class="ai-select">
                <option value="">Any Metal</option><option>Gold</option><option>Silver</option>
                <option>Rose Gold</option><option>Platinum</option>
              </select>
            </div>
          </div>
          <button class="btn-gold" style="width:100%" id="gp-submit-btn" onclick="runGiftPlanner(event)">
            <i class="lucide-sparkles"></i> Get Gift Recommendations
          </button>
        </div>
        <div id="gp-results" class="ai-gift-results">
          <div class="ai-results-placeholder">
            <i class="lucide-gift"></i>
            <p>Your personalized gift recommendations will appear here</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function runGiftPlanner(ev) {
  if (!authGate()) return;
  const occasion = (document.getElementById('gp-occasion')).value;
  if (!occasion) { aiNotif('Please select an occasion.', 'error'); return; }

  const btn = ev?.target?.closest('button') || document.getElementById('gp-submit-btn');
  const resultsDiv = document.getElementById('gp-results');
  showLoading(btn, 'Finding gifts...');
  const progressTarget = showProgressContainer(resultsDiv);
  const stopProgress = await simulateProgress(progressTarget);

  try {
    const budget = (document.getElementById('gp-budget')).value.split('-');
    const budgetMin = Number(budget[0]) || 0;
    const budgetMax = Number(budget[1]) || 999999;
    const jewelleryType = (document.getElementById('gp-jewellery-type')).value;
    const metal = (document.getElementById('gp-metal')).value;
    const recipient = (document.getElementById('gp-recipient')).value;

    const result = await callGeminiAI({
      feature: 'gift-planner', occasion, budgetMin, budgetMax, recipient, jewelleryType, metal });

    stopProgress();

    await supabase.from('gift_planner_requests').insert({
      user_id: window.state.user.id, occasion, budget_min: budgetMin, budget_max: budgetMax, recipient, jewellery_type: jewelleryType, preferred_metal: metal, recommendations: result });

    const recs = result.recommendations || [];
    resultsDiv.innerHTML = `
      ${result.occasion_advice ? `<div class="ai-gift-advice"><i class="lucide-info"></i><p>${result.occasion_advice}</p></div>` : ''}
      <h3>Top Picks for ${occasion}</h3>
      <div class="ai-gift-options">
        ${recs.map((r, i) => `
          <div class="ai-gift-card ${i === 0 ? 'top-pick' : ''}">
            ${i === 0 ? '<span class="ai-top-pick-badge">Top Pick</span>' : ''}
            <div class="ai-gift-card-body">
              <h4>${r.name}</h4>
              <p class="ai-gift-type">${r.type}</p>
              <p class="ai-gift-price">₹${Number(r.estimated_price).toLocaleString('en-IN')}</p>
              <p class="ai-gift-reason">${r.reason}</p>
              <p class="ai-gift-appeal"><i class="lucide-heart"></i> ${r.gift_appeal}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    aiNotif('Gift recommendations generated & saved!');
  } catch (err) {
    stopProgress();
    resultsDiv.innerHTML = `<div class="ai-error-state"><i class="lucide-alert-circle"></i><p>${err.message}</p><button class="btn-ghost" onclick="runGiftPlanner()">Try Again</button></div>`;
    aiNotif('Error: ' + err.message, 'error');
  } finally {
    hideLoading(btn);
  }
}

// ============================================
// 4. Couple Matching Jewellery
// ============================================
export function renderCoupleCollection() {
  return `
    ${pageHero('heart', 'Couple Matching Jewellery', 'Create beautiful matching jewellery sets for you and your partner with AI suggestions')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="ai-feature-layout">
        <div class="ai-feature-panel">
          <h3>Couple Details</h3>
          <div class="ai-form-grid">
            <input id="cp-bride" class="ai-input" placeholder="Bride's Name" />
            <input id="cp-groom" class="ai-input" placeholder="Groom's Name" />
            <input id="cp-initials" class="ai-input" placeholder="Couple Initials (e.g. A&R)" maxlength="6" />
          </div>
          <div class="ai-form-group">
            <label>Jewellery Type</label>
            <select id="cp-type" class="ai-select">
              <option value="rings">Couple Rings</option>
              <option value="pendants">Couple Pendants</option>
              <option value="bracelets">Couple Bracelets</option>
              <option value="necklaces">Matching Necklaces</option>
            </select>
          </div>
          <div class="ai-form-group">
            <label>Metal Preference</label>
            <select id="cp-metal" class="ai-select">
              <option>Gold</option><option>Silver</option><option>Rose Gold</option><option>Platinum</option>
            </select>
          </div>
          <div class="ai-form-group">
            <label>Engraving Text (optional)</label>
            <input id="cp-engraving" class="ai-input" placeholder="e.g. Forever Yours" maxlength="30" />
          </div>
          <button class="btn-gold" style="width:100%" id="cp-submit-btn" onclick="runCoupleMatch(event)">
            <i class="lucide-heart"></i> Find Matching Jewellery
          </button>
        </div>
        <div id="cp-results" class="ai-feature-results">
          <div class="ai-results-placeholder">
            <i class="lucide-heart"></i>
            <p>Enter your details to see matching couple jewellery</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function runCoupleMatch(ev) {
  if (!authGate()) return;
  const bride = (document.getElementById('cp-bride')).value;
  const groom = (document.getElementById('cp-groom')).value;
  if (!bride || !groom) { aiNotif('Please enter both names.', 'error'); return; }

  const btn = ev?.target?.closest('button') || document.getElementById('cp-submit-btn');
  const resultsDiv = document.getElementById('cp-results');
  showLoading(btn, 'Matching...');
  const progressTarget = showProgressContainer(resultsDiv);
  const stopProgress = await simulateProgress(progressTarget);

  try {
    const type = (document.getElementById('cp-type')).value;
    const metal = (document.getElementById('cp-metal')).value;
    const initials = (document.getElementById('cp-initials')).value;
    const engraving = (document.getElementById('cp-engraving')).value;

    const result = await callGeminiAI({
      feature: 'couple-match', brideName: bride, groomName: groom, initials, jewelleryType: type, metal, engraving });

    stopProgress();

    await supabase.from('couple_orders').insert({
      user_id: window.state.user.id, bride_name: bride, groom_name: groom, initials, jewellery_type: type, metal_preference: metal, engraving_text: engraving });

    const suggestions = result.suggestions || [];
    const engravings = result.engraving_suggestions || [];

    resultsDiv.innerHTML = `
      <div class="ai-couple-header">
        <h3>${bride} & ${groom}</h3>
        ${initials ? `<div class="ai-initials-preview">${initials}</div>` : ''}
        ${result.summary ? `<p class="ai-engraving-preview">${result.summary}</p>` : ''}
      </div>
      ${engravings.length ? `
        <div class="ai-engraving-suggestions">
          <h4>Engraving Ideas</h4>
          <div class="ai-engraving-chips">
            ${engravings.map(e => `<span class="ai-metal-chip">${e}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <div class="ai-couple-products">
        ${suggestions.map((s) => `
          <div class="ai-couple-card">
            <div class="ai-couple-card-body">
              <h4>${s.name}</h4>
              <div class="ai-couple-pieces">
                <div><strong>Bride:</strong> ${s.bride_piece}</div>
                <div><strong>Groom:</strong> ${s.groom_piece}</div>
              </div>
              <p class="ai-couple-design">${s.design_description}</p>
              <p class="ai-couple-symbolism"><i class="lucide-heart"></i> ${s.symbolism}</p>
              <p class="ai-gift-price">₹${Number(s.estimated_price).toLocaleString('en-IN')}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    aiNotif('Couple jewellery suggestions ready!');
  } catch (err) {
    stopProgress();
    resultsDiv.innerHTML = `<div class="ai-error-state"><i class="lucide-alert-circle"></i><p>${err.message}</p><button class="btn-ghost" onclick="runCoupleMatch()">Try Again</button></div>`;
    aiNotif('Error: ' + err.message, 'error');
  } finally {
    hideLoading(btn);
  }
}

// ============================================
// 5. Old Jewellery Exchange
// ============================================
let exchangePhotos = [];

export function renderExchangeJewellery() {
  return `
    ${pageHero('repeat', 'Old Jewellery Exchange', 'Exchange your old jewellery with AI-powered valuation. Upload a photo for instant estimates.')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="ai-feature-layout">
        <div class="ai-feature-panel">
          <h3>Item Details</h3>
          ${uploadZoneHTML('ex-photo-input', 'Upload photos of your jewellery')}
          <div id="ex-preview" class="ai-preview-area"></div>

          <div class="ai-form-grid" style="margin-top:1rem">
            <div class="ai-form-group">
              <label>Metal Type *</label>
              <select id="ex-metal" class="ai-select"><option>Gold</option><option>Silver</option><option>Platinum</option><option>Other</option></select>
            </div>
            <div class="ai-form-group">
              <label>Weight (grams)</label>
              <input id="ex-weight" type="number" class="ai-input" placeholder="e.g. 10" min="0" step="0.1" />
            </div>
          </div>
          <div class="ai-form-group">
            <label>Description</label>
            <textarea id="ex-description" class="ai-textarea" rows="3" placeholder="Describe condition, age, any damages..."></textarea>
          </div>
          <button class="btn-gold" style="width:100%" id="ex-submit-btn" onclick="runExchangeValuation(event)">
            <i class="lucide-calculator"></i> Estimate Exchange Value
          </button>
        </div>
        <div id="ex-results" class="ai-feature-results">
          <div class="ai-results-placeholder">
            <i class="lucide-repeat"></i>
            <p>Upload your jewellery photos and details to get an AI exchange valuation</p>
          </div>
        </div>
      </div>
      <div id="ex-history" class="ai-history-section"></div>
    </div>
  `;
}

export async function initExchangeJewellery() {
  exchangePhotos = [];
  bindUploadZone('ex-photo-input-zone', async (files) => {
    const preview = document.getElementById('ex-preview');
    preview.innerHTML = '';
    for (const file of Array.from(files).slice(0, 5)) {
      const uploaded = await uploadToBucket('brand-assets', file, 'exchange-items/');
      if (uploaded) {
        exchangePhotos.push(uploaded);
        preview.innerHTML += `<img src="${uploaded.url}" alt="Item" class="ai-preview-img" />`;
      }
    }
  });
  loadExchangeHistory();
}

export async function runExchangeValuation(ev) {
  if (!authGate()) return;
  if (exchangePhotos.length === 0) { aiNotif('Please upload at least one photo.', 'error'); return; }

  const btn = ev?.target?.closest('button') || document.getElementById('ex-submit-btn');
  const resultsDiv = document.getElementById('ex-results');
  showLoading(btn, 'Valuing jewellery...');
  const progressTarget = showProgressContainer(resultsDiv);
  const stopProgress = await simulateProgress(progressTarget);

  try {
    // Use the first photo for AI analysis
    const firstPhoto = exchangePhotos[0];
    // Fetch the image and convert to base64
    const imgRes = await fetch(firstPhoto.url);
    const imgBlob = await imgRes.blob();
    const reader = new FileReader();
    const imageBase64 = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(imgBlob);
    });

    const weight = (document.getElementById('ex-weight')).value;
    const metalType = (document.getElementById('ex-metal')).value;
    const description = (document.getElementById('ex-description')).value;

    const result = await callGeminiAI({
      feature: 'exchange', imageBase64, mimeType: imgBlob.type, weight, metalType, description });

    stopProgress();

    const val = result.valuation || {};
    const assessment = result.assessment || {};

    await supabase.from('exchange_requests').insert({
      user_id: window.state.user.id, photo_urls: exchangePhotos.map(p => p.url),
      bucket_paths: exchangePhotos.map(p => p.path),
      weight_grams: weight ? Number(weight) : null,
      metal_type: metalType,
      description,
      ai_estimated_value: val.estimated_value || 0,
      purity_estimate: assessment.estimated_purity || null,
      buyback_value: val.buyback_value || 0,
      bonus_offer: val.bonus_offer || 0,
    });

    resultsDiv.innerHTML = `
      <div class="ai-valuation-card">
        <h3>AI Exchange Valuation</h3>
        <div class="ai-valuation-assessment">
          ${assessment.metal_type ? `<div class="ai-valuation-row"><span>Metal Type</span><strong>${assessment.metal_type}</strong></div>` : ''}
          ${assessment.estimated_purity ? `<div class="ai-valuation-row"><span>Estimated Purity</span><strong>${assessment.estimated_purity}</strong></div>` : ''}
          ${assessment.condition ? `<div class="ai-valuation-row"><span>Condition</span><strong>${assessment.condition}</strong></div>` : ''}
          ${assessment.design_era ? `<div class="ai-valuation-row"><span>Design Era</span><strong>${assessment.design_era}</strong></div>` : ''}
        </div>
        <div class="ai-valuation-values">
          <div class="ai-valuation-row highlight">
            <span>Estimated Exchange Value</span>
            <strong>₹${Number(val.estimated_value || 0).toLocaleString('en-IN')}</strong>
          </div>
          <div class="ai-valuation-row">
            <span>Buyback Value</span><strong>₹${Number(val.buyback_value || 0).toLocaleString('en-IN')}</strong>
          </div>
          <div class="ai-valuation-row bonus">
            <span>Bonus Offer</span><strong>+₹${Number(val.bonus_offer || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>
        <div class="ai-valuation-total">
          <p>Total Store Credit</p>
          <h2>₹${(Number(val.estimated_value || 0) + Number(val.bonus_offer || 0)).toLocaleString('en-IN')}</h2>
        </div>
        ${result.recommendations ? `<p class="ai-valuation-recommendations">${result.recommendations}</p>` : ''}
        <div class="ai-valuation-disclaimer">
          <i class="lucide-alert-triangle"></i>
          <p>${val.disclaimer || 'This is an AI-estimated value. Final valuation will be determined after physical inspection.'}</p>
        </div>
        <button class="btn-gold" style="width:100%" onclick="navigate('/shop')">
          <i class="lucide-shopping-bag"></i> Shop with Exchange Credit
        </button>
      </div>
    `;
    aiNotif('Valuation generated! Request submitted for approval.');
    loadExchangeHistory();
  } catch (err) {
    stopProgress();
    resultsDiv.innerHTML = `<div class="ai-error-state"><i class="lucide-alert-circle"></i><p>${err.message}</p><button class="btn-ghost" onclick="runExchangeValuation()">Try Again</button></div>`;
    aiNotif('Error: ' + err.message, 'error');
  } finally {
    hideLoading(btn);
  }
}

async function loadExchangeHistory() {
  if (!window.state?.user) return;
  const { data } = await supabase.from('exchange_requests').select('*').eq('user_id', window.state.user.id).order('created_at', { ascending: false }).limit(5);
  const div = document.getElementById('ex-history');
  if (!div || !data?.length) return;
  div.innerHTML = `
    <h3 style="margin-top:2rem">Your Exchange Requests</h3>
    <div class="ai-history-grid">
      ${data.map(r => `
        <div class="ai-history-card">
          <img src="${r.photo_urls?.[0] || ''}" alt="Item" />
          <div>
            <p>${r.metal_type} • ${r.weight_grams || '?'}g</p>
            <p class="ai-history-date">${new Date(r.created_at).toLocaleDateString('en-IN')}</p>
            <span class="ai-status-badge ${r.status}">${r.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// 6. Design Your Jewellery (Flagship)
// ============================================
let canvasCtx = null;
let canvasDrawing = false;
let canvasColor = '#D4A437';
let canvasBrush = 5;
let designSketch = null;

export function renderDesignJewellery() {
  return `
    ${pageHero('pen-tool', 'Design Your Jewellery', 'Sketch your dream jewellery and Gemini AI will analyze it, describe the design, and estimate costs')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="ai-design-layout">
        <div class="ai-feature-panel">
          <h3>Option 1: Upload Your Sketch</h3>
          ${uploadZoneHTML('design-sketch-input', 'Upload a hand-drawn sketch or concept image')}
          <div id="design-preview" class="ai-preview-area"></div>

          <h3 style="margin-top:1.5rem">Option 2: Draw on Canvas</h3>
          <div class="ai-canvas-wrap">
            <canvas id="design-canvas" width="400" height="300"></canvas>
            <div class="ai-canvas-tools">
              <button class="btn-ghost" onclick="clearCanvas()"><i class="lucide-eraser"></i> Clear</button>
              <input type="color" id="canvas-color" value="#D4A437" onchange="changeCanvasColor(this.value)" />
              <button class="btn-ghost" onclick="setCanvasBrush(2)">Thin</button>
              <button class="btn-ghost" onclick="setCanvasBrush(5)">Medium</button>
              <button class="btn-ghost" onclick="setCanvasBrush(10)">Thick</button>
            </div>
          </div>

          <h3 style="margin-top:1.5rem">Preferences</h3>
          <div class="ai-form-grid">
            <div class="ai-form-group">
              <label>Preferred Metal</label>
              <select id="design-metal" class="ai-select"><option>Gold</option><option>Silver</option><option>Rose Gold</option><option>Platinum</option></select>
            </div>
            <div class="ai-form-group">
              <label>Additional Notes</label>
              <input id="design-notes" class="ai-input" placeholder="Any specific requirements..." />
            </div>
          </div>
          <button class="btn-gold" style="width:100%" id="design-submit-btn" onclick="submitCustomDesign(event)">
            <i class="lucide-send"></i> Generate Design Analysis
          </button>
        </div>
        <div id="design-results" class="ai-feature-results">
          <div class="ai-results-placeholder">
            <i class="lucide-pen-tool"></i>
            <p>Upload a sketch or draw on the canvas, then submit to get an AI-generated design analysis with estimated pricing</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initDesignJewellery() {
  const canvas = document.getElementById('design-canvas');
  if (!canvas) return;
  canvasCtx = canvas.getContext('2d');
  if (canvasCtx) {
    canvasCtx.fillStyle = '#fff';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineCap = 'round';
    canvasCtx.strokeStyle = canvasColor;
    canvasCtx.lineWidth = canvasBrush;
  }

  let lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', e => { canvasDrawing = true; [lastX, lastY] = [e.offsetX, e.offsetY]; });
  canvas.addEventListener('mousemove', e => {
    if (!canvasDrawing || !canvasCtx) return;
    canvasCtx.beginPath();
    canvasCtx.moveTo(lastX, lastY);
    canvasCtx.lineTo(e.offsetX, e.offsetY);
    canvasCtx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });
  canvas.addEventListener('mouseup', () => { canvasDrawing = false; });
  canvas.addEventListener('mouseleave', () => { canvasDrawing = false; });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    canvasDrawing = true;
    lastX = t.clientX - r.left;
    lastY = t.clientY - r.top;
  });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!canvasDrawing || !canvasCtx) return;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    canvasCtx.beginPath();
    canvasCtx.moveTo(lastX, lastY);
    canvasCtx.lineTo(t.clientX - r.left, t.clientY - r.top);
    canvasCtx.stroke();
    lastX = t.clientX - r.left;
    lastY = t.clientY - r.top;
  });
  canvas.addEventListener('touchend', () => { canvasDrawing = false; });

  bindUploadZone('design-sketch-input-zone', async (files) => {
    const uploaded = await uploadToBucket('brand-assets', files[0], 'custom-designs/');
    if (uploaded) {
      designSketch = { ...uploaded, file: files[0] };
      document.getElementById('design-preview').innerHTML = `<img src="${uploaded.url}" alt="Sketch" class="ai-preview-img" />`;
    }
  });
}

export function clearCanvas() {
  if (canvasCtx) { canvasCtx.fillStyle = '#fff'; canvasCtx.fillRect(0, 0, 400, 300); }
}
export function changeCanvasColor(color) { canvasColor = color; if (canvasCtx) canvasCtx.strokeStyle = color; }
export function setCanvasBrush(size) { canvasBrush = size; if (canvasCtx) canvasCtx.lineWidth = size; }

export async function submitCustomDesign(ev) {
  if (!authGate()) return;
  const canvas = document.getElementById('design-canvas');
  const hasSketch = !!designSketch;
  const hasCanvas = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 0 && v !== 255);

  if (!hasSketch && !hasCanvas) { aiNotif('Please upload a sketch or draw on the canvas.', 'error'); return; }

  const btn = ev?.target?.closest('button') || document.getElementById('design-submit-btn');
  const resultsDiv = document.getElementById('design-results');
  showLoading(btn, 'Generating design analysis...');
  const progressTarget = showProgressContainer(resultsDiv);
  const stopProgress = await simulateProgress(progressTarget);

  try {
    let imageBase64;
    let mimeType;

    if (hasSketch) {
      imageBase64 = await fileToBase64(designSketch.file);
      mimeType = designSketch.file.type;
    } else {
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      mimeType = 'image/png';
    }

    const metal = (document.getElementById('design-metal')).value;
    const notes = (document.getElementById('design-notes')).value;

    const result = await callGeminiAI({
      feature: 'design', imageBase64, mimeType, metal });

    stopProgress();

    const costs = result.estimated_costs || {};
    const materials = result.materials || {};

    await supabase.from('custom_design_requests').insert({
      user_id: window.state.user.id, sketch_url: hasSketch ? designSketch.url : null, concept_image_url: hasCanvas ? canvas.toDataURL() : null,
      canvas_data: hasCanvas ? canvas.toDataURL() : null,
      metal_preference: metal,
      estimated_price: costs.selling_price || 0,
      estimated_delivery_days: result.estimated_delivery_days || 30,
      notes,
    });

    resultsDiv.innerHTML = `
      <div class="ai-design-result">
        <h3>${result.design_name || 'AI Design Analysis'}</h3>
        <p class="ai-design-style">${result.style || ''}</p>
        <div class="ai-design-description">
          <h4>Design Description</h4>
          <p>${result.design_description}</p>
        </div>
        ${result.customization_suggestions ? `
          <div class="ai-design-suggestions">
            <h4>Customization Suggestions</h4>
            <p>${result.customization_suggestions}</p>
          </div>
        ` : ''}
        <div class="ai-design-materials">
          <h4>Recommended Materials</h4>
          ${materials.primary_metal ? `<p><strong>Metal:</strong> ${materials.primary_metal}</p>` : ''}
          ${materials.gemstones?.length ? `<p><strong>Gemstones:</strong> ${materials.gemstones.join(', ')}</p>` : ''}
          ${materials.embellishments?.length ? `<p><strong>Embellishments:</strong> ${materials.embellishments.join(', ')}</p>` : ''}
        </div>
        <div class="ai-design-details">
          <div class="ai-design-detail-row"><span>Manufacturing Cost</span><strong>₹${Number(costs.manufacturing_cost || 0).toLocaleString('en-IN')}</strong></div>
          <div class="ai-design-detail-row"><span>Material Cost</span><strong>₹${Number(costs.material_cost || 0).toLocaleString('en-IN')}</strong></div>
          <div class="ai-design-detail-row highlight"><span>Estimated Selling Price</span><strong>₹${Number(costs.selling_price || 0).toLocaleString('en-IN')}</strong></div>
          <div class="ai-design-detail-row"><span>Estimated Delivery</span><strong>${result.estimated_delivery_days || 30} days</strong></div>
        </div>
        ${result.craftsmanship_notes ? `<p class="ai-craftsmanship-notes"><i class="lucide-info"></i> ${result.craftsmanship_notes}</p>` : ''}
        <button class="btn-gold" style="width:100%" id="custom-order-btn" onclick="navigate('/shop')">
          <i class="lucide-shopping-bag"></i> Place Custom Order
        </button>
        <p class="ai-valuation-note">Our admin team will review your design and contact you within 48 hours.</p>
      </div>
    `;
    aiNotif('Design analysis generated & saved!');
  } catch (err) {
    stopProgress();
    resultsDiv.innerHTML = `<div class="ai-error-state"><i class="lucide-alert-circle"></i><p>${err.message}</p><button class="btn-ghost" onclick="submitCustomDesign()">Try Again</button></div>`;
    aiNotif('Error: ' + err.message, 'error');
  } finally {
    hideLoading(btn);
  }
}

// ============================================
// 7. Surprise Gift Mode
// ============================================
export function renderSurpriseGifts() {
  return `
    ${pageHero('gift', 'Surprise Gift Mode', 'Send a beautiful surprise gift with AI-generated personal messages and gift wrapping suggestions')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="ai-gift-planner-layout">
        <div class="ai-gift-form-card">
          <h3>Gift Details</h3>
          <div class="ai-form-group">
            <label>Select Product *</label>
            <select id="sg-product" class="ai-select">
              <option value="">Choose a product...</option>
            </select>
          </div>
          <div class="ai-form-grid">
            <div class="ai-form-group">
              <label>Recipient Name *</label>
              <input id="sg-recipient" class="ai-input" placeholder="Recipient's name" />
            </div>
            <div class="ai-form-group">
              <label>Relationship</label>
              <select id="sg-relationship" class="ai-select">
                <option value="">Select</option><option>Wife</option><option>Girlfriend</option>
                <option>Mother</option><option>Sister</option><option>Friend</option><option>Colleague</option>
              </select>
            </div>
          </div>
          <div class="ai-form-group">
            <label>Occasion</label>
            <select id="sg-occasion" class="ai-select">
              <option value="">Select Occasion</option><option>Birthday</option><option>Anniversary</option>
              <option>Wedding</option><option>Surprise</option><option>Valentine's Day</option>
            </select>
          </div>
          <button class="btn-gold" style="width:100%" id="sg-submit-btn" onclick="submitGiftOrder(event)">
            <i class="lucide-gift"></i> Generate Gift Suggestions
          </button>
        </div>
        <div id="sg-preview" class="ai-gift-results">
          <div class="ai-gift-preview-card">
            <h3>Gift Preview</h3>
            <div class="ai-gift-preview-box">
              <i class="lucide-gift" style="font-size:4rem;color:var(--gold-400)"></i>
              <p>Your beautiful gift will be packaged with care and delivered with a personal touch</p>
              <ul class="ai-gift-features">
                <li><i class="lucide-check"></i> AI-generated personal message</li>
                <li><i class="lucide-check"></i> Gift wrapping recommendations</li>
                <li><i class="lucide-check"></i> Delivery date suggestions</li>
                <li><i class="lucide-check"></i> Premium packaging</li>
                <li><i class="lucide-check"></i> Hidden pricing option</li>
                <li><i class="lucide-check"></i> Gift tracking number</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function initSurpriseGifts() {
  const { data } = await supabase.from('products').select('id, name, price').eq('is_active', true).order('name');
  const select = document.getElementById('sg-product');
  if (select && data) {
    select.innerHTML = '<option value="">Choose a product...</option>' + data.map(p => `<option value="${p.id}">${p.name} — ₹${Number(p.price).toLocaleString('en-IN')}</option>`).join('');
  }
}

export async function submitGiftOrder(ev) {
  if (!authGate()) return;
  const productId = (document.getElementById('sg-product')).value;
  const recipient = (document.getElementById('sg-recipient')).value;
  if (!productId || !recipient) { aiNotif('Please select a product and enter recipient name.', 'error'); return; }

  const btn = ev?.target?.closest('button') || document.getElementById('sg-submit-btn');
  const resultsDiv = document.getElementById('sg-preview');
  showLoading(btn, 'Generating gift suggestions...');
  const progressTarget = showProgressContainer(resultsDiv);
  const stopProgress = await simulateProgress(progressTarget);

  try {
    const occasion = (document.getElementById('sg-occasion')).value;
    const relationship = (document.getElementById('sg-relationship')).value;
    const productSelect = document.getElementById('sg-product');
    const productName = productSelect.options[productSelect.selectedIndex].text.split(' — ')[0];
    const productPrice = productSelect.options[productSelect.selectedIndex].text.match(/₹([\d,]+)/)?.[1]?.replace(/,/g, '');

    const result = await callGeminiAI({
      feature: 'surprise-gift', productName, recipientName: recipient, occasion, budget: productPrice, relationship, });

    stopProgress();

    const wrapping = result.gift_wrapping_recommendation || {};
    const delivery = result.delivery_suggestion || {};
    const tips = result.presentation_tips || [];

    // Save gift order
    await supabase.from('gift_orders').insert({
      user_id: window.state.user.id, product_id: productId, recipient_name: recipient, personal_message: result.gift_message, greeting_card: occasion, gift_wrap: true, premium_packaging: true, });

    resultsDiv.innerHTML = `
      <div class="ai-gift-success">
        <h3>AI-Generated Gift Experience</h3>
        <div class="ai-gift-message-box">
          <h4><i class="lucide-message-circle"></i> Personal Gift Message</h4>
          <p class="ai-gift-message">${result.gift_message}</p>
        </div>
        <div class="ai-gift-wrapping">
          <h4><i class="lucide-gift"></i> Gift Wrapping Recommendation</h4>
          ${wrapping.style ? `<p><strong>Style:</strong> ${wrapping.style}</p>` : ''}
          ${wrapping.color_theme ? `<p><strong>Color Theme:</strong> ${wrapping.color_theme}</p>` : ''}
          ${wrapping.ribbon_type ? `<p><strong>Ribbon:</strong> ${wrapping.ribbon_type}</p>` : ''}
          ${wrapping.card_style ? `<p><strong>Card Style:</strong> ${wrapping.card_style}</p>` : ''}
        </div>
        <div class="ai-gift-delivery">
          <h4><i class="lucide-calendar"></i> Delivery Suggestion</h4>
          ${delivery.ideal_date ? `<p><strong>Ideal Date:</strong> ${delivery.ideal_date}</p>` : ''}
          ${delivery.delivery_method ? `<p><strong>Method:</strong> ${delivery.delivery_method}</p>` : ''}
          ${delivery.surprise_element ? `<p><strong>Surprise Idea:</strong> ${delivery.surprise_element}</p>` : ''}
        </div>
        ${tips.length ? `
          <div class="ai-gift-tips">
            <h4><i class="lucide-lightbulb"></i> Presentation Tips</h4>
            <ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>
          </div>
        ` : ''}
        <button class="btn-gold" onclick="navigate('/shop')">
          <i class="lucide-check"></i> Confirm & Place Gift Order
        </button>
      </div>
    `;
    aiNotif('Gift suggestions generated!');
  } catch (err) {
    stopProgress();
    resultsDiv.innerHTML = `<div class="ai-error-state"><i class="lucide-alert-circle"></i><p>${err.message}</p><button class="btn-ghost" onclick="submitGiftOrder()">Try Again</button></div>`;
    aiNotif('Error: ' + err.message, 'error');
  } finally {
    hideLoading(btn);
  }
}

// ============================================
// 8. Trending Page
// ============================================
export function renderTrendingPage() {
  return `
    ${pageHero('trending-up', 'Trending Jewellery', 'Discover AI-generated trending jewellery recommendations and what\'s hot right now')}
    <div class="container section">
      <div id="ai-notif" class="ai-notif-container"></div>
      <div class="trending-tabs">
        ${['All Trends','Viral','High Trend','Rising','Seasonal','Celebrity Inspired'].map((t, i) => `
          <button class="trending-tab ${i === 0 ? 'active' : ''}" onclick="filterTrending('${t}', this)">${t}</button>
        `).join('')}
      </div>
      <div id="trending-products-grid" class="ai-trending-container"></div>
    </div>
  `;
}

let trendingData = [];

export async function initTrendingPage() {
  const container = document.getElementById('trending-products-grid');
  if (!container) return;
  container.innerHTML = `<div class="ai-processing"><div class="ai-processing-spinner"><i class="lucide-loader-2 spin"></i></div><p>Loading trending jewellery...</p></div>`;

  try {
    const result = await callGeminiAI({ feature: 'trending' });
    trendingData = result.trends || [];
    renderTrendingProducts(trendingData);
  } catch (err) {
    container.innerHTML = `<div class="ai-error-state"><i class="lucide-alert-circle"></i><p>${err.message}</p><button class="btn-ghost" onclick="initTrendingPage()">Try Again</button></div>`;
  }
}

function renderTrendingProducts(trends) {
  const grid = document.getElementById('trending-products-grid');
  if (!grid) return;
  if (!trends.length) {
    grid.innerHTML = '<div class="ai-results-placeholder"><i class="lucide-trending-up"></i><p>No trending products found.</p></div>';
    return;
  }
  grid.innerHTML = `
    ${trends[0]?.seasonal_insights ? `<div class="ai-seasonal-insights"><i class="lucide-info"></i><p>${trends[0].seasonal_insights}</p></div>` : ''}
    <div class="ai-trending-grid">
      ${trends.map((t) => `
        <div class="ai-trending-card" data-trend-level="${t.trend_level || ''}" data-celebrity="${t.celebrity_inspired}">
          <div class="ai-trending-badge ${t.trend_level?.toLowerCase().replace(/\s+/g, '-')}">${t.trend_level || 'Trending'}</div>
          ${t.celebrity_inspired ? '<div class="ai-trending-celeb"><i class="lucide-star"></i> Celebrity Inspired</div>' : ''}
          <div class="ai-trending-body">
            <h4>${t.name}</h4>
            <p class="ai-trending-type">${t.type}</p>
            <p class="ai-trending-reason">${t.trend_reason}</p>
            <div class="ai-trending-footer">
              <span class="ai-trending-price">₹${Number(t.estimated_price || 0).toLocaleString('en-IN')}</span>
            </div>
            <p class="ai-trending-tip"><i class="lucide-lightbulb"></i> ${t.style_tip}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export function filterTrending(filter, btn) {
  document.querySelectorAll('.trending-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (filter === 'All Trends') {
    renderTrendingProducts(trendingData);
    return;
  }
  const filtered = trendingData.filter(t => {
    if (filter === 'Celebrity Inspired') return t.celebrity_inspired;
    const level = (t.trend_level || '').toLowerCase().replace(/\s+/g, '-');
    return level === filter.toLowerCase().replace(/\s+/g, '-');
  });
  renderTrendingProducts(filtered);
}

// ============================================
// Camera Helper (shared)
// ============================================
export function openCamera(inputId) {
  const video = document.createElement('video');
  video.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:10000;width:90%;max-width:500px;border-radius:12px;box-shadow:0 8px 32px rgba(0, 0, 0, 0.3)';
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
    video.autoplay = true;
    document.body.appendChild(video);
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Capture';
    closeBtn.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:10001;padding:0.75rem 2rem;background:var(--gold-400);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem';
    document.body.appendChild(closeBtn);
    closeBtn.onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        const input = document.getElementById(inputId);
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, 'image/jpeg', 0.9);
      stream.getTracks().forEach(t => t.stop());
      video.remove();
      closeBtn.remove();
    };
  }).catch(() => aiNotif('Camera access denied or not available.', 'error'));
}
