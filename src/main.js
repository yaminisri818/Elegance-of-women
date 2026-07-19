// ============================================
// Elegance of Women — Main Application
// Vanilla JavaScript SPA
// ============================================

import { supabase } from './lib/supabase.js';
import { formatPrice, calculateDiscount, getFirstImage, generateOrderNumber } from './lib/utils.js';
import {
  adminState, renderAdmin, adminNavigate, initAdminPage,
  showNotif,
  uploadImageManagerFiles, deleteImageFile, copyImageUrl, replaceImage, filterImageBucket, searchImages,
  startProductEdit, cancelProductEdit, saveProduct, deleteProduct, uploadProductImages, removeProductImage,
  startCategoryEdit, cancelCategoryEdit, uploadCategoryImage, saveCategory,
  startBannerEdit, cancelBannerEdit, uploadBannerImage, saveBanner, deleteBanner, toggleBannerActive,
  uploadBrandAsset, deleteBrandAsset,
  updateFolderOptions,
} from './admin.js';
import {
  renderAIRecommendation, runAIRecommendation,
  renderVirtualTryOn, initVirtualTryOn, selectTryOnType, selectTryOnProduct, tryOnZoom, tryOnRotate, saveTryOn, downloadTryOn,
  renderGiftPlanner, runGiftPlanner,
  renderCoupleCollection, runCoupleMatch,
  renderExchangeJewellery, initExchangeJewellery, runExchangeValuation,
  renderDesignJewellery, initDesignJewellery, clearCanvas, changeCanvasColor, setCanvasBrush, submitCustomDesign,
  renderSurpriseGifts, initSurpriseGifts, submitGiftOrder,
  renderTrendingPage, initTrendingPage, filterTrending,
  viewRecHistory,
  openCamera,
} from './ai-features.js';

// ============================================
// State
// ============================================
const state = {
  cart: [],
  wishlist: [],
  recentlyViewed: [],
  user: null,
  session: null,
  darkMode: localStorage.getItem('darkMode') === 'true',
  searchOpen: false,
  mobileMenuOpen: false,
  filtersOpen: false,
  chatbotOpen: false,
  brandLogo: null,
  heroBanners: [],
  heroSlide: 0,
  showScrollTop: false,
  loginReturnPath: null,
};

// ============================================
// Cart persistence (localStorage)
// ============================================
const CART_KEY = 'eow_cart';

function loadCartFromStorage() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}

function saveCartToStorage(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  state.cart = cart;
}

async function fetchProductForCart(productId) {
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*), product_images(*)')
    .eq('id', productId)
    .maybeSingle();
  return data;
}

// ============================================
// Router
// ============================================
function getRoute() {
  const hash = location.hash.slice(1) || '/';
  const [pathPart, queryPart] = hash.split('?');
  const query = {};
  if (queryPart) new URLSearchParams(queryPart).forEach((v, k) => query[k] = v);
  return { path: pathPart || '/', query };
}

function navigate(path) {
  location.hash = path;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render());

// ============================================
// Auth
// ============================================
async function initAuth() {
  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  state.user = data.session?.user ?? null;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const prevUserId = state.user?.id;
    state.session = session;
    state.user = session?.user ?? null;
    if (state.user?.id !== prevUserId) {
      await loadUserData();
      render();
    }
  });
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  state.session = data.session;
  state.user = data.user;
  return null;
}

async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } },
  });
  if (error) return error.message;
  if (data.user) {
    state.session = data.session;
    state.user = data.user;
    await supabase.from('profiles').insert({ user_id: data.user.id, full_name: fullName });
  }
  return null;
}

async function signOut() {
  await supabase.auth.signOut();
  navigate('/');
}

// ============================================
// Cart & Wishlist
// ============================================
async function loadUserData() {
  state.cart = loadCartFromStorage();
  state.wishlist = [];
  if (state.user) {
    const { data: wishRes } = await supabase
      .from('wishlist')
      .select('*, product:products(*, category:categories(*), product_images(*))')
      .eq('user_id', state.user.id);
    state.wishlist = wishRes ?? [];
  }
}

async function addToCart(productId, quantity = 1, size, colour, opts = {}) {
  const cart = loadCartFromStorage();
  const existing = cart.find(i => i.product_id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    const product = await fetchProductForCart(productId);
    if (!product) { showNotif('Product not found.', 'error'); return; }
    cart.push({
      id: 'lc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      product_id: productId, quantity,
      selected_size: size || null, selected_colour: colour || null,
      product,
    });
    showNotif('Added to cart!');
  }
  saveCartToStorage(cart);
  if (!opts.skipRender) render();
}

async function updateCartQty(cartItemId, quantity) {
  if (quantity <= 0) { await removeFromCart(cartItemId); return; }
  const cart = loadCartFromStorage();
  const item = cart.find(i => i.id === cartItemId);
  if (item) { item.quantity = quantity; saveCartToStorage(cart); render(); }
}

async function removeFromCart(cartItemId) {
  const cart = loadCartFromStorage().filter(i => i.id !== cartItemId);
  saveCartToStorage(cart);
  render();
}

async function toggleWishlist(productId) {
  if (!state.user) { navigate('/login'); return; }
  const existing = state.wishlist.find(w => w.product_id === productId);
  if (existing) {
    await supabase.from('wishlist').delete().eq('id', existing.id);
  } else {
    await supabase.from('wishlist').insert({ user_id: state.user.id, product_id: productId });
  }
  await loadUserData();
  render();
}

function isWishlisted(productId) {
  return state.wishlist.some(w => w.product_id === productId);
}

function addRecentlyViewed(product) {
  state.recentlyViewed = state.recentlyViewed.filter(p => p.id !== product.id);
  state.recentlyViewed.unshift(product);
  state.recentlyViewed = state.recentlyViewed.slice(0, 8);
}

function getCartCount() { return state.cart.reduce((s, i) => s + i.quantity, 0); }
function getCartTotal() { return state.cart.reduce((s, i) => s + (i.product?.price ?? 0) * i.quantity, 0); }
function getUserName() {
  if (!state.user) return '';
  return state.user.user_metadata?.full_name || state.user.email?.split('@')[0] || 'User';
}

// ============================================
// Dark Mode
// ============================================
function toggleDarkMode() {
  state.darkMode = !state.darkMode;
  localStorage.setItem('darkMode', String(state.darkMode));
  if (state.darkMode) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  render();
}

// ============================================
// Render
// ============================================
function render() {
  const route = getRoute();
  const app = document.getElementById('app');

  let pageContent = '';
  let pageClass = 'animate-fade-in';

  const path = route.path;

  // Admin route — render without public navbar/footer
  if (path === '/admin' || path.startsWith('/admin/')) {
    window._adminUser = state.user;
    app.innerHTML = `<div id="admin-notif" class="admin-notif" style="display:none"></div>${renderAdmin()}`;
    attachEventListeners();
    if (state.user) initAdminPage();
    return;
  }

  if (path === '/' || path === '') pageContent = renderHome();
  else if (path === '/shop') pageContent = renderShop(route);
  else if (path.startsWith('/product/')) pageContent = renderProduct(path.replace('/product/', ''));
  else if (path === '/cart') pageContent = renderCart();
  else if (path === '/checkout') pageContent = renderCheckout();
  else if (path === '/login') pageContent = renderLogin();
  else if (path === '/account') pageContent = renderAccount();
  else if (path === '/wishlist') pageContent = renderWishlist();
  else if (path === '/about') pageContent = renderAbout();
  else if (path === '/contact') pageContent = renderContact();
  else if (path === '/faq') pageContent = renderFAQ();
  else if (path === '/track-order') pageContent = renderTrackOrder();
  else if (path === '/offers') pageContent = renderOffers();
  else if (path === '/collections') pageContent = renderCollections();
  else if (path.startsWith('/category/')) pageContent = renderCategory(path.replace('/category/', ''));
  else if (path === '/ai-recommendation') pageContent = renderAIRecommendation();
  else if (path === '/virtual-try-on') pageContent = renderVirtualTryOn();
  else if (path === '/gift-planner') pageContent = renderGiftPlanner();
  else if (path === '/couple-collection') pageContent = renderCoupleCollection();
  else if (path === '/exchange-jewellery') pageContent = renderExchangeJewellery();
  else if (path === '/design-jewellery') pageContent = renderDesignJewellery();
  else if (path === '/surprise-gifts') pageContent = renderSurpriseGifts();
  else if (path === '/trending') pageContent = renderTrendingPage();
  else if (['/shipping-policy', '/return-policy', '/refund-policy', '/privacy-policy', '/terms'].includes(path)) pageContent = renderPolicy(path.replace('/', ''));
  else pageContent = render404();

  app.innerHTML = `
    ${renderNavbar()}
    <main class="${pageClass}">${pageContent}</main>
    ${renderFooter()}
    ${renderChatbot()}
    ${renderWhatsApp()}
    <button class="scroll-top-btn" id="scroll-top-btn" onclick="scrollToTop()" title="Scroll to top"><i class="lucide-arrow-up"></i></button>
  `;

  attachEventListeners();
  loadPageData(route);
}

// ============================================
// Navbar
// ============================================
function renderNavbar() {
  const cartCount = getCartCount();
  const wishCount = state.wishlist.length;

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Shop', path: '/shop' },
    { label: 'Collections', path: '/collections' },
    { label: 'New Arrivals', path: '/shop?filter=new' },
    { label: 'Best Sellers', path: '/shop?filter=bestseller' },
    { label: 'Bridal', path: '/shop?filter=bridal' },
    { label: 'Offers', path: '/offers' },
    { label: 'AI Features', path: '/ai-recommendation', children: [
      { label: 'AI Recommendation', path: '/ai-recommendation' },
      { label: 'Virtual Try-On', path: '/virtual-try-on' },
      { label: 'Design Your Jewellery', path: '/design-jewellery' },
      { label: 'Gift Planner', path: '/gift-planner' },
      { label: 'Couple Collection', path: '/couple-collection' },
      { label: 'Exchange Jewellery', path: '/exchange-jewellery' },
      { label: 'Surprise Gifts', path: '/surprise-gifts' },
      { label: 'Trending', path: '/trending' },
    ]},
  ];

  return `
    <div class="announcement">Free Shipping on Orders Above ₹2,000 | Use Code WELCOME10 for 10% Off</div>
    <header class="navbar" id="navbar">
      <div class="container navbar-inner">
        <button class="mobile-menu-btn" data-action="open-mobile-menu" style="margin-left:-0.5rem;padding:0.5rem;color:var(--text)">
          <i class="lucide-menu" style="font-size:1.25rem"></i>
        </button>
        <a class="navbar-logo" href="#/" onclick="event.preventDefault();navigate('/')">
          ${state.brandLogo
            ? `<img src="${state.brandLogo}" alt="Elegance of Women" class="navbar-logo-img" />`
            : `<div class="logo-box"><span>E</span></div>`
          }
          <div class="logo-text">
            <h1>Elegance</h1><p>of Women</p>
          </div>
        </a>
        <nav class="navbar-links">
          ${navLinks.map(link => `
            <div class="navbar-dropdown">
              <a href="#${link.path}" onclick="event.preventDefault();navigate('${link.path}')">${link.label}</a>
              ${link.children ? `
                <div class="navbar-dropdown-menu">
                  ${link.children.map(c => `<a href="#${c.path}" onclick="event.preventDefault();navigate('${c.path}')">${c.label}</a>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </nav>
        <div class="navbar-actions">
          <button data-action="toggle-search" title="Search"><i class="lucide-search"></i></button>
          <a href="#/wishlist" onclick="event.preventDefault();navigate('/wishlist')" title="Wishlist" style="position:relative">
            <i class="lucide-heart"></i>
            ${wishCount > 0 ? `<span class="badge">${wishCount}</span>` : ''}
          </a>
          <a href="#/cart" onclick="event.preventDefault();navigate('/cart')" title="Cart" style="position:relative">
            <i class="lucide-shopping-bag"></i>
            ${cartCount > 0 ? `<span class="badge">${cartCount}</span>` : ''}
          </a>
          <button data-action="toggle-notifications" title="Notifications" style="position:relative">
            <i class="lucide-bell"></i>
            <span class="badge dot"></span>
          </button>
          <div class="navbar-account-dropdown">
            <button data-action="toggle-account-menu" title="My Account">
              <i class="lucide-user"></i>
              ${state.user ? `<span class="navbar-hello">Hello, ${getUserName()}</span>` : ''}
              <i class="lucide-chevron-down" style="font-size:0.7rem"></i>
            </button>
            <div class="account-dropdown-menu" id="account-dropdown">
              ${state.user ? `
                <a href="#/account" onclick="event.preventDefault();navigate('/account')"><i class="lucide-user"></i> Profile</a>
                <a href="#/account" onclick="event.preventDefault();navigate('/account')"><i class="lucide-package"></i> My Orders</a>
                <a href="#/wishlist" onclick="event.preventDefault();navigate('/wishlist')"><i class="lucide-heart"></i> Wishlist</a>
                <a href="#/account" onclick="event.preventDefault();navigate('/account')"><i class="lucide-map-pin"></i> Addresses</a>
                <a href="#/account" onclick="event.preventDefault();navigate('/account')"><i class="lucide-rotate-ccw"></i> Returns</a>
                ${state.user ? `<a href="#/admin" onclick="event.preventDefault();navigate('/admin')"><i class="lucide-shield"></i> Admin Panel</a>` : ''}
                <a href="#" onclick="event.preventDefault();signOut()"><i class="lucide-log-out"></i> Logout</a>
              ` : `
                <a href="#/login" onclick="event.preventDefault();navigate('/login')"><i class="lucide-log-in"></i> Login</a>
                <a href="#/login" onclick="event.preventDefault();navigate('/login')"><i class="lucide-user-plus"></i> Register</a>
              `}
            </div>
          </div>
        </div>
      </div>
      <div class="navbar-search ${state.searchOpen ? 'open' : ''}" id="search-panel">
        <div class="container navbar-search-inner">
          <i class="lucide-search navbar-search-icon"></i>
          <input type="text" id="search-input" placeholder="Search for jewellery..." oninput="handleSearch(this.value)" />
          <div class="search-results" id="search-results"></div>
        </div>
      </div>
    </header>
    ${renderMobileMenu()}
  `;
}

function renderMobileMenu() {
  const links = [
    { label: 'Home', path: '/' },
    { label: 'Shop', path: '/shop' },
    { label: 'Collections', path: '/collections' },
    { label: 'New Arrivals', path: '/shop?filter=new' },
    { label: 'Best Sellers', path: '/shop?filter=bestseller' },
    { label: 'Bridal Collection', path: '/shop?filter=bridal' },
    { label: 'Offers', path: '/offers' },
    { label: 'Trending', path: '/trending' },
    { label: 'AI Recommendation', path: '/ai-recommendation' },
    { label: 'Virtual Try-On', path: '/virtual-try-on' },
    { label: 'Design Your Jewellery', path: '/design-jewellery' },
    { label: 'Gift Planner', path: '/gift-planner' },
    { label: 'Couple Collection', path: '/couple-collection' },
    { label: 'Exchange Jewellery', path: '/exchange-jewellery' },
    { label: 'Surprise Gifts', path: '/surprise-gifts' },
  ];

  return `
    <div class="mobile-menu ${state.mobileMenuOpen ? 'open' : ''}" id="mobile-menu">
      <div class="mobile-menu-overlay" data-action="close-mobile-menu"></div>
      <div class="mobile-menu-panel">
        <div class="mobile-menu-header">
          <div class="mobile-menu-brand">
            ${state.brandLogo
              ? `<img src="${state.brandLogo}" alt="Elegance of Women" style="height:2.5rem;width:auto;object-fit:contain" />`
              : `<div class="logo-box"><span>E</span></div><div><h4>Elegance</h4><p>of Women</p></div>`
            }
          </div>
          <button data-action="close-mobile-menu"><i class="lucide-x"></i></button>
        </div>
        <nav>
          ${links.map(l => `<a href="#${l.path}" onclick="event.preventDefault();navigate('${l.path}');closeMobileMenu()">${l.label}</a>`).join('')}
          <div class="menu-divider">
            <a href="#/wishlist" onclick="event.preventDefault();navigate('/wishlist');closeMobileMenu()">Wishlist</a>
            <a href="#/cart" onclick="event.preventDefault();navigate('/cart');closeMobileMenu()">Cart</a>
            <a href="#${state.user ? '/account' : '/login'}" onclick="event.preventDefault();navigate('${state.user ? '/account' : '/login'}');closeMobileMenu()">${state.user ? 'My Account' : 'Login / Register'}</a>
            ${state.user ? `<a href="#/admin" onclick="event.preventDefault();navigate('/admin');closeMobileMenu()" style="color:var(--gold)"><i class="lucide-shield" style="vertical-align:-2px;margin-right:0.3rem"></i>Admin Panel</a>` : ''}
          </div>
          <div class="menu-divider">
            <a href="#/about" onclick="event.preventDefault();navigate('/about');closeMobileMenu()">About Us</a>
            <a href="#/contact" onclick="event.preventDefault();navigate('/contact');closeMobileMenu()">Contact</a>
            <a href="#/faq" onclick="event.preventDefault();navigate('/faq');closeMobileMenu()">FAQ</a>
            <a href="#/track-order" onclick="event.preventDefault();navigate('/track-order');closeMobileMenu()">Track Order</a>
          </div>
        </nav>
      </div>
    </div>
  `;
}

function closeMobileMenu() { state.mobileMenuOpen = false; render(); }

// ============================================
// Footer
// ============================================
function renderFooter() {
  return `
    <footer class="footer">
      <div class="footer-newsletter">
        <div class="container text-center">
          <h3>Join Our Newsletter</h3>
          <p>Subscribe for exclusive offers, new arrivals, and jewellery care tips.</p>
          <form onsubmit="handleSubscribe(event)">
            <input type="email" placeholder="Enter your email address" required />
            <button type="submit" class="btn-gold"><i class="lucide-send"></i> Subscribe</button>
          </form>
          <div id="newsletter-msg"></div>
        </div>
      </div>
      <div class="footer-main">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="logo-row">
                ${state.brandLogo
                  ? `<img src="${state.brandLogo}" alt="Elegance of Women" style="height:2.5rem;width:auto;object-fit:contain" />`
                  : `<div class="logo-box"><span>E</span></div><div><h4>Elegance</h4><p>of Women</p></div>`
                }
              </div>
              <p>Premium jewellery for the modern woman. Crafted with love, worn with elegance.</p>
              <div class="footer-social">
                <a href="#"><i class="lucide-instagram"></i></a>
                <a href="#"><i class="lucide-facebook"></i></a>
                <a href="#"><i class="lucide-twitter"></i></a>
                <a href="#"><i class="lucide-youtube"></i></a>
              </div>
            </div>
            <div class="footer-col">
              <h4>AI Features</h4>
              <ul>
                <li><a href="#/ai-recommendation" onclick="event.preventDefault();navigate('/ai-recommendation')">AI Recommendation</a></li>
                <li><a href="#/virtual-try-on" onclick="event.preventDefault();navigate('/virtual-try-on')">Virtual Try-On</a></li>
                <li><a href="#/design-jewellery" onclick="event.preventDefault();navigate('/design-jewellery')">Design Your Jewellery</a></li>
                <li><a href="#/gift-planner" onclick="event.preventDefault();navigate('/gift-planner')">Gift Planner</a></li>
                <li><a href="#/couple-collection" onclick="event.preventDefault();navigate('/couple-collection')">Couple Collection</a></li>
                <li><a href="#/exchange-jewellery" onclick="event.preventDefault();navigate('/exchange-jewellery')">Exchange Jewellery</a></li>
                <li><a href="#/surprise-gifts" onclick="event.preventDefault();navigate('/surprise-gifts')">Surprise Gifts</a></li>
                <li><a href="#/trending" onclick="event.preventDefault();navigate('/trending')">Trending</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="#/about" onclick="event.preventDefault();navigate('/about')">About Us</a></li>
                <li><a href="#/contact" onclick="event.preventDefault();navigate('/contact')">Contact Us</a></li>
                <li><a href="#/faq" onclick="event.preventDefault();navigate('/faq')">FAQ</a></li>
                <li><a href="#/track-order" onclick="event.preventDefault();navigate('/track-order')">Track Order</a></li>
                <li><a href="#/account" onclick="event.preventDefault();navigate('/account')">My Account</a></li>
                <li><a href="#/wishlist" onclick="event.preventDefault();navigate('/wishlist')">Wishlist</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Customer Support</h4>
              <ul>
                <li><a href="#/shipping-policy" onclick="event.preventDefault();navigate('/shipping-policy')">Shipping Policy</a></li>
                <li><a href="#/return-policy" onclick="event.preventDefault();navigate('/return-policy')">Return Policy</a></li>
                <li><a href="#/refund-policy" onclick="event.preventDefault();navigate('/refund-policy')">Refund Policy</a></li>
                <li><a href="#/privacy-policy" onclick="event.preventDefault();navigate('/privacy-policy')">Privacy Policy</a></li>
                <li><a href="#/terms" onclick="event.preventDefault();navigate('/terms')">Terms & Conditions</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Get in Touch</h4>
              <ul class="footer-contact">
                <li><i class="lucide-map-pin"></i><span>123 Jewellery Lane, Mumbai, India 400001</span></li>
                <li><i class="lucide-phone"></i><span>+91 98765 43210</span></li>
                <li><i class="lucide-mail"></i><span>care@eleganceofwomen.com</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container footer-bottom-inner">
          <p>&copy; ${new Date().getFullYear()} Elegance of Women. All rights reserved.</p>
          <div class="footer-payments">
            <span>We Accept:</span>
            ${['VISA','MC','UPI','RuPay','COD'].map(p => `<span class="pay-badge">${p}</span>`).join('')}
          </div>
        </div>
      </div>
    </footer>
  `;
}

// ============================================
// Chatbot
// ============================================
function renderChatbot() {
  return `
    <button class="chatbot-toggle" data-action="toggle-chatbot" title="Customer Support">
      <i class="lucide-${state.chatbotOpen ? 'x' : 'message-circle'}"></i>
    </button>
    <div class="chatbot-window ${state.chatbotOpen ? 'open' : ''}" id="chatbot">
      <div class="chatbot-header">
        <div class="avatar"><i class="lucide-bot"></i></div>
        <div>
          <div class="title">Customer Support</div>
          <div class="status"><span class="dot"></span> Online</div>
        </div>
      </div>
      <div class="chatbot-messages" id="chatbot-messages"></div>
      <div class="chatbot-quick" id="chatbot-quick">
        <button onclick="sendQuickMsg('What are the shipping options?')">Shipping options?</button>
        <button onclick="sendQuickMsg('How do I return a product?')">Return policy?</button>
        <button onclick="sendQuickMsg('What payment methods do you accept?')">Payment methods?</button>
        <button onclick="sendQuickMsg('Tell me about bridal collection')">Bridal collection?</button>
      </div>
      <div class="chatbot-input">
        <input type="text" id="chatbot-input-field" placeholder="Type your message..." onkeydown="if(event.key==='Enter')sendChatMsg()" />
        <button onclick="sendChatMsg()"><i class="lucide-send"></i></button>
      </div>
    </div>
  `;
}

function renderWhatsApp() {
  return `<a href="https://wa.me/919876543210" target="_blank" class="whatsapp-btn" title="Chat on WhatsApp"><i class="lucide-message-circle"></i></a>`;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Hero slider navigation
function heroNext() {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;
  state.heroSlide = (state.heroSlide + 1) % slides.length;
  updateHeroSlide();
}
function heroPrev() {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;
  state.heroSlide = (state.heroSlide - 1 + slides.length) % slides.length;
  updateHeroSlide();
}
function goToHeroSlide(i) {
  state.heroSlide = i;
  updateHeroSlide();
}
function updateHeroSlide() {
  document.querySelectorAll('.hero-slide').forEach((s, i) => s.classList.toggle('active', i === state.heroSlide));
  document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === state.heroSlide));
}

let _heroSlideTimer = null;
function startHeroAutoSlide() {
  clearInterval(_heroSlideTimer);
  _heroSlideTimer = setInterval(() => {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length > 1) heroNext();
  }, 5000);
}

// ============================================
// Home Page
// ============================================
function renderHeroBanner() {
  const banners = state.heroBanners.filter(b => b.banner_type === 'hero');
  const slides = banners.length > 0 ? banners : [
    { image_url: 'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=1920', title: 'Discover Timeless Elegance', subtitle: 'Premium Jewellery for Every Woman', button_text: 'Shop Now', button_link: '/shop' },
    { image_url: 'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?auto=compress&cs=tinysrgb&w=1920', title: 'Bridal Collection 2024', subtitle: 'Make Your Special Day Unforgettable', button_text: 'Explore Bridal', button_link: '/shop?filter=bridal' },
    { image_url: 'https://images.pexels.com/photos/3373736/pexels-photo-3373736.jpeg?auto=compress&cs=tinysrgb&w=1920', title: 'New Arrivals', subtitle: 'Fresh Designs Every Week', button_text: 'Shop New', button_link: '/shop?filter=new' },
  ];

  return `
    <section class="hero-slider" id="hero-slider">
      ${slides.map((b, i) => `
        <div class="hero-slide ${i === state.heroSlide ? 'active' : ''}" style="background-image:url('${b.image_url}')">
          <div class="hero-overlay"></div>
          <div class="container hero-content">
            ${b.subtitle ? `<p class="eyebrow">${b.subtitle}</p>` : ''}
            <h1>${b.title}</h1>
            <p class="hero-desc">Explore our handcrafted jewellery — where every piece tells a story of artistry, passion, and elegance.</p>
            <div class="hero-buttons">
              <button class="btn-gold" onclick="navigate('${b.button_link || '/shop'}')">${b.button_text || 'Shop Now'} <i class="lucide-arrow-right"></i></button>
              <button class="btn-outline-light" onclick="navigate('/collections')">Explore Collections</button>
            </div>
          </div>
        </div>
      `).join('')}
      <div class="hero-slider-dots">
        ${slides.map((_, i) => `<button class="hero-dot ${i === state.heroSlide ? 'active' : ''}" onclick="goToHeroSlide(${i})"></button>`).join('')}
      </div>
      <button class="hero-arrow prev" onclick="heroPrev()"><i class="lucide-chevron-left"></i></button>
      <button class="hero-arrow next" onclick="heroNext()"><i class="lucide-chevron-right"></i></button>
    </section>
  `;
}

function renderHome() {
  const aiFeatures = [
    { icon: 'sparkles', title: 'AI Jewellery Recommendation', desc: 'Get personalized jewellery suggestions based on your face shape & skin tone', path: '/ai-recommendation' },
    { icon: 'glasses', title: 'Virtual Try-On', desc: 'See how jewellery looks on you before you buy', path: '/virtual-try-on' },
    { icon: 'pen-tool', title: 'Design Your Jewellery', desc: 'Sketch your dream piece and our AI brings it to life', path: '/design-jewellery' },
    { icon: 'gift', title: 'Gift Planner', desc: 'Find the perfect gift for any occasion with AI', path: '/gift-planner' },
    { icon: 'heart', title: 'Couple Jewellery', desc: 'Create matching jewellery sets for you and your partner', path: '/couple-collection' },
    { icon: 'repeat', title: 'Old Jewellery Exchange', desc: 'Exchange old jewellery for store credit with AI valuation', path: '/exchange-jewellery' },
  ];

  return `
    ${renderHeroBanner()}

    <section class="section">
      <div class="container">
        <p class="section-subtitle">Explore</p>
        <h2 class="section-title">Shop by Category</h2>
        <div class="category-grid" id="home-categories" style="margin-top:2.5rem"></div>
      </div>
    </section>

    <section class="section bg-ink-50">
      <div class="container">
        <p class="section-subtitle">AI-Powered Shopping</p>
        <h2 class="section-title">Smart AI Shopping Experience</h2>
        <p class="section-desc">Discover jewellery like never before with our innovative AI-powered features</p>
        <div class="ai-features-grid" style="margin-top:2.5rem">
          ${aiFeatures.map(f => `
            <div class="ai-feature-card" onclick="navigate('${f.path}')">
              <div class="ai-feature-icon"><i class="lucide-${f.icon}"></i></div>
              <h3>${f.title}</h3>
              <p>${f.desc}</p>
              <button class="btn-gold-small">Try Now <i class="lucide-arrow-right" style="font-size:0.75rem"></i></button>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-header">
          <div><p class="section-subtitle" style="text-align:left">Hot Right Now</p><h2 class="section-title" style="text-align:left">Trending Now</h2></div>
          <a href="#/trending" onclick="event.preventDefault();navigate('/trending')" class="btn-ghost">View All <i class="lucide-arrow-right"></i></a>
        </div>
        <div class="product-grid" id="trending-grid" style="margin-top:2.5rem"></div>
      </div>
    </section>

    <section class="section bg-ink-50">
      <div class="container">
        <div class="section-header">
          <div><p class="section-subtitle" style="text-align:left">Customer Favorites</p><h2 class="section-title" style="text-align:left">Best Sellers</h2></div>
          <a href="#/shop?filter=bestseller" onclick="event.preventDefault();navigate('/shop?filter=bestseller')" class="btn-ghost">View All <i class="lucide-arrow-right"></i></a>
        </div>
        <div class="product-grid" id="best-sellers-grid" style="margin-top:2.5rem"></div>
      </div>
    </section>

    <section class="promo-banner-section">
      <div class="promo-banner-bg" style="background-image:url('https://images.pexels.com/photos/3373736/pexels-photo-3373736.jpeg?auto=compress&cs=tinysrgb&w=1920')"></div>
      <div class="promo-overlay"></div>
      <div class="container promo-content">
        <p class="promo-eyebrow">Limited Time</p>
        <h2>Festive Sale — Up to 50% OFF</h2>
        <p>Shop our exclusive festive collection at unbeatable prices. Premium jewellery, affordable luxury.</p>
        <button class="btn-gold" onclick="navigate('/offers')">Shop Offers <i class="lucide-arrow-right"></i></button>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-header">
          <div><p class="section-subtitle" style="text-align:left">Just In</p><h2 class="section-title" style="text-align:left">New Arrivals</h2></div>
          <a href="#/shop?filter=new" onclick="event.preventDefault();navigate('/shop?filter=new')" class="btn-ghost">View All <i class="lucide-arrow-right"></i></a>
        </div>
        <div class="product-grid" id="new-arrivals-grid" style="margin-top:2.5rem"></div>
      </div>
    </section>

    <section class="bridal-section">
      <div class="bg-deco"><img src="https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" /></div>
      <div class="container">
        <p class="section-subtitle">For Your Special Day</p>
        <h2 class="section-title">Bridal Collection</h2>
        <p class="section-desc">Make your wedding day unforgettable with our exquisite bridal jewellery. Handcrafted to perfection.</p>
        <div class="bridal-grid" id="bridal-grid" style="margin-top:2.5rem"></div>
        <div class="text-center" style="margin-top:2.5rem">
          <button class="btn-gold" onclick="navigate('/shop?filter=bridal')">Explore Bridal Collection</button>
        </div>
      </div>
    </section>

    <section class="section bg-ink-50">
      <div class="container">
        <p class="section-subtitle">Our Promise</p>
        <h2 class="section-title">Why Choose Us</h2>
        <div class="why-grid" style="margin-top:3rem">
          ${[
            { icon: 'award', title: 'Premium Quality', desc: 'Crafted with finest materials for lasting beauty' },
            { icon: 'badge-check', title: 'Certified Jewellery', desc: 'Hallmark certified & quality guaranteed' },
            { icon: 'shield-check', title: 'Secure Payments', desc: '100% secure and encrypted payment processing' },
            { icon: 'rotate-ccw', title: 'Easy Returns', desc: '7-day hassle-free return policy' },
            { icon: 'truck', title: 'Fast Delivery', desc: 'Free shipping on orders above ₹2,000' },
            { icon: 'headphones', title: '24/7 Customer Support', desc: 'Dedicated support team available round the clock' },
          ].map(item => `
            <div class="why-item">
              <div class="icon-box"><i class="lucide-${item.icon}"></i></div>
              <h3>${item.title}</h3>
              <p>${item.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="section-subtitle">Testimonials</p>
        <h2 class="section-title">Customer Reviews</h2>
        <div class="reviews-grid" style="margin-top:2.5rem">
          ${[
            { name: 'Priya Sharma', location: 'Mumbai', rating: 5, text: 'The bridal set I purchased was absolutely stunning. The craftsmanship is exceptional and I received countless compliments on my wedding day.' },
            { name: 'Anita Reddy', location: 'Bangalore', rating: 5, text: 'Beautiful jewellery at amazing prices. The pearl earrings are my favorite — elegant and lightweight. Fast delivery too!' },
            { name: 'Deepika Menon', location: 'Kochi', rating: 4, text: 'Great quality bangles. The gold plating looks rich and authentic. Would definitely recommend to friends and family.' },
            { name: 'Sneha Kapoor', location: 'Delhi', rating: 5, text: 'I ordered the solitaire ring for my engagement and it exceeded all expectations. The sparkle is incredible!' },
            { name: 'Meera Joshi', location: 'Pune', rating: 5, text: 'The Kundan chandelier earrings are a showstopper. Wore them to a wedding and everyone wanted to know where I got them.' },
            { name: 'Kavya Singh', location: 'Jaipur', rating: 5, text: 'Outstanding customer service and beautiful packaging. The maang tikka was perfect for my sister\'s wedding.' },
          ].map(r => `
            <div class="review-card">
              <i class="lucide-quote quote-icon"></i>
              <div class="stars">${[1,2,3,4,5].map(s => `<i class="lucide-star ${s <= r.rating ? 'filled' : ''}"></i>`).join('')}</div>
              <p class="text">"${r.text}"</p>
              <div class="author">
                <div class="avatar"><span>${r.name[0]}</span></div>
                <div><div class="name">${r.name}</div><div class="location">${r.location}</div></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="section bg-ink-50">
      <div class="container">
        <p class="section-subtitle">@eleganceofwomen</p>
        <h2 class="section-title">Follow Us on Instagram</h2>
        <div class="insta-grid" style="margin-top:2.5rem">
          ${[1,2,3,4,5,6].map(i => `
            <a href="#" class="insta-item">
              <img src="https://images.pexels.com/photos/${i % 2 === 0 ? '1191531' : '1454171'}/pexels-photo-${i % 2 === 0 ? '1191531' : '1454171'}.jpeg?auto=compress&cs=tinysrgb&w=400" alt="Instagram post" loading="lazy" />
              <div class="overlay"><i class="lucide-instagram"></i></div>
            </a>
          `).join('')}
        </div>
        <div class="text-center" style="margin-top:2.5rem">
          <button class="btn-ghost" onclick="window.open('https://instagram.com','_blank')">Explore More <i class="lucide-arrow-right"></i></button>
        </div>
      </div>
    </section>
  `;
}

// ============================================
// Product Card
// ============================================
function productCardHTML(product) {
  const discount = calculateDiscount(product.price, product.compare_at_price);
  const wished = isWishlisted(product.id);
  const image = getFirstImage(product);
  const stars = product.rating > 0 ? [1,2,3,4,5].map(s => `<i class="lucide-star star ${s <= Math.round(product.rating) ? 'filled' : ''}"></i>`).join('') : '';

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-card-image">
        <a href="#/product/${product.slug}" onclick="event.preventDefault();navigate('/product/${product.slug}')">
          <img src="${image}" alt="${product.name}" loading="lazy" />
        </a>
        <div class="product-badges">
          ${discount > 0 ? `<span class="badge-tag badge-discount">${discount}% Off</span>` : ''}
          ${product.is_new ? `<span class="badge-tag badge-new">New</span>` : ''}
          ${product.is_best_seller ? `<span class="badge-tag badge-best">Best Seller</span>` : ''}
        </div>
        <button class="product-wishlist-btn ${wished ? 'active' : ''}" onclick="toggleWishlist('${product.id}')">
          <i class="lucide-heart" style="font-size:1rem"></i>
        </button>
        <div class="product-hover-actions">
          <button class="quick-view" onclick="quickView('${product.slug}')"><i class="lucide-eye"></i> Quick View</button>
          <button class="add-cart" onclick="addToCart('${product.id}')"><i class="lucide-shopping-bag"></i> Add</button>
        </div>
        ${product.stock === 0 ? `<div class="product-out-of-stock"><span>Out of Stock</span></div>` : ''}
      </div>
      <div class="product-card-info">
        ${stars ? `<div class="product-rating">${stars}<span class="count">(${product.review_count})</span></div>` : ''}
        <a href="#/product/${product.slug}" onclick="event.preventDefault();navigate('/product/${product.slug}')">
          <h3>${product.name}</h3>
        </a>
        <div class="product-price">
          <span class="price">${formatPrice(product.price)}</span>
          ${product.compare_at_price && discount > 0 ? `<span class="compare-at">${formatPrice(product.compare_at_price)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function skeletonGrid(count = 4, cols = 4) {
  return `<div class="product-grid">${Array(count).fill('<div class="skeleton" style="aspect-ratio:3/4"></div>').join('')}</div>`;
}

// ============================================
// Shop Page
// ============================================
let shopState = {
  products: [],
  categories: [],
  loading: true,
  sortBy: 'featured',
  selectedCategories: [],
  priceMax: 25000,
  selectedColours: [],
  selectedMaterials: [],
  inStockOnly: false,
  newOnly: false,
  bestSellerOnly: false,
  discountOnly: false,
};

function renderShop(route) {
  return `
    <div class="page-header">
      <div class="container text-center">
        <p class="section-subtitle">Our Collection</p>
        <h1 class="section-title">Shop All Jewellery</h1>
        <div class="breadcrumb"><a href="#/" onclick="event.preventDefault();navigate('/')">Home</a><span>/</span><span>Shop</span></div>
      </div>
    </div>
    <div class="container section">
      <div class="shop-layout">
        <aside class="shop-sidebar" id="shop-sidebar">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem" class="md-only" style="display:none">
            <h3>Filters</h3>
            <button onclick="closeFilters()">Close</button>
          </div>
          <div class="filter-section">
            <h3 onclick="this.classList.toggle('collapsed');this.nextElement.classList.toggle('hidden')">Category <i class="lucide-chevron-down"></i></h3>
            <div class="filter-body" id="filter-categories"></div>
          </div>
          <div class="filter-section">
            <h3 onclick="this.classList.toggle('collapsed');this.nextElement.classList.toggle('hidden')">Price Range <i class="lucide-chevron-down"></i></h3>
            <div class="filter-body">
              <input type="range" min="0" max="25000" step="500" value="${shopState.priceMax}" oninput="shopState.priceMax=Number(this.value);document.getElementById('price-max-display').textContent='₹'+this.value.toLocaleString('en-IN');filterProducts()" style="width:100%;accent-color:var(--gold-500)" />
              <div class="price-display"><span>₹0</span><span id="price-max-display">₹${shopState.priceMax.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
          <div class="filter-section">
            <h3 onclick="this.classList.toggle('collapsed');this.nextElement.classList.toggle('hidden')">Colour <i class="lucide-chevron-down"></i></h3>
            <div class="filter-body" id="filter-colours"></div>
          </div>
          <div class="filter-section">
            <h3 onclick="this.classList.toggle('collapsed');this.nextElement.classList.toggle('hidden')">Material <i class="lucide-chevron-down"></i></h3>
            <div class="filter-body" id="filter-materials"></div>
          </div>
          <div class="filter-section">
            <h3 onclick="this.classList.toggle('collapsed');this.nextElement.classList.toggle('hidden')">Availability <i class="lucide-chevron-down"></i></h3>
            <div class="filter-body">
              <label><input type="checkbox" ${shopState.inStockOnly ? 'checked' : ''} onchange="shopState.inStockOnly=this.checked;filterProducts()" /> In Stock Only</label>
              <label><input type="checkbox" ${shopState.newOnly ? 'checked' : ''} onchange="shopState.newOnly=this.checked;filterProducts()" /> New Arrivals</label>
              <label><input type="checkbox" ${shopState.bestSellerOnly ? 'checked' : ''} onchange="shopState.bestSellerOnly=this.checked;filterProducts()" /> Best Sellers</label>
              <label><input type="checkbox" ${shopState.discountOnly ? 'checked' : ''} onchange="shopState.discountOnly=this.checked;filterProducts()" /> On Discount</label>
            </div>
          </div>
          <button class="btn-outline w-full" style="display:none" id="clear-filters-mobile" onclick="clearFilters()">Clear All</button>
        </aside>
        <div class="shop-main">
          <div class="shop-toolbar">
            <button class="filter-btn" data-action="open-filters"><i class="lucide-sliders-horizontal"></i> Filters</button>
            <span class="product-count" id="product-count"></span>
            <div class="sort-wrap">
              <span>Sort by:</span>
              <select onchange="shopState.sortBy=this.value;filterProducts()">
                <option value="featured">Featured</option>
                <option value="best-selling">Best Selling</option>
                <option value="newest">Newest</option>
                <option value="price-low-high">Price: Low to High</option>
                <option value="price-high-low">Price: High to Low</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>
          </div>
          <div id="shop-products"></div>
        </div>
      </div>
    </div>
  `;
}

function filterProducts() {
  let result = [...shopState.products];

  if (shopState.selectedCategories.length > 0) {
    result = result.filter(p => p.category && shopState.selectedCategories.includes(p.category.slug));
  }
  result = result.filter(p => p.price <= shopState.priceMax);
  if (shopState.selectedColours.length > 0) result = result.filter(p => p.colour && shopState.selectedColours.includes(p.colour));
  if (shopState.selectedMaterials.length > 0) result = result.filter(p => p.material && shopState.selectedMaterials.includes(p.material));
  if (shopState.inStockOnly) result = result.filter(p => p.stock > 0);
  if (shopState.newOnly) result = result.filter(p => p.is_new);
  if (shopState.bestSellerOnly) result = result.filter(p => p.is_best_seller);
  if (shopState.discountOnly) result = result.filter(p => p.compare_at_price && p.compare_at_price > p.price);

  switch (shopState.sortBy) {
    case 'best-selling': result.sort((a,b) => b.review_count - a.review_count); break;
    case 'newest': result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); break;
    case 'price-low-high': result.sort((a,b) => a.price - b.price); break;
    case 'price-high-low': result.sort((a,b) => b.price - a.price); break;
    case 'alphabetical': result.sort((a,b) => a.name.localeCompare(b.name)); break;
    default: result.sort((a,b) => a.sort_order - b.sort_order);
  }

  const grid = document.getElementById('shop-products');
  const count = document.getElementById('product-count');
  if (count) count.textContent = `${result.length} ${result.length === 1 ? 'product' : 'products'}`;

  if (result.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="lucide-package-x"></i><p>No products found matching your filters.</p><button class="btn-gold" onclick="clearFilters()">Clear Filters</button></div>`;
  } else {
    grid.innerHTML = `<div class="product-grid">${result.map(p => productCardHTML(p)).join('')}</div>`;
  }
}

function clearFilters() {
  shopState.selectedCategories = [];
  shopState.priceMax = 25000;
  shopState.selectedColours = [];
  shopState.selectedMaterials = [];
  shopState.inStockOnly = false;
  shopState.newOnly = false;
  shopState.bestSellerOnly = false;
  shopState.discountOnly = false;
  render();
}

function closeFilters() {
  document.getElementById('shop-sidebar').classList.remove('mobile-open');
}

// ============================================
// Product Detail Page
// ============================================
let productPageState = { product: null, reviews: [], related: [], loading: true, selectedImage: 0, quantity: 1, activeTab: 'description', showReviewForm: false };

function renderProduct(slug) {
  return `
    <div class="container" style="padding-top:1rem">
      <div class="breadcrumb" id="product-breadcrumb"></div>
    </div>
    <div class="container" style="padding-bottom:3rem">
      <div id="product-detail-content"></div>
    </div>
  `;
}

function renderProductDetail(product, reviews, related) {
  const discount = calculateDiscount(product.price, product.compare_at_price);
  const images = product.product_images || [];
  const wished = isWishlisted(product.id);

  return `
    <div class="product-detail">
      <div class="product-gallery">
        <div class="main-image">
          <img src="${images[productPageState.selectedImage]?.image_url ?? getFirstImage(product)}" alt="${product.name}" />
        </div>
        ${images.length > 1 ? `
          <div class="thumbs">
            ${images.map((img, i) => `<button class="${i === productPageState.selectedImage ? 'active' : ''}" onclick="productPageState.selectedImage=${i};render()"><img src="${img.image_url}" alt="${img.alt_text || product.name}" /></button>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="product-info">
        ${product.is_best_seller ? '<span class="badge-tag badge-best" style="margin-bottom:0.75rem">Best Seller</span>' : ''}
        ${product.is_new ? '<span class="badge-tag badge-new" style="margin-bottom:0.75rem;margin-left:0.5rem">New Arrival</span>' : ''}
        <h1>${product.name}</h1>
        ${product.rating > 0 ? `
          <div class="rating-row">
            <div class="stars">${[1,2,3,4,5].map(s => `<i class="lucide-star ${s <= Math.round(product.rating) ? 'filled' : ''}"></i>`).join('')}</div>
            <span class="rating-text">${product.rating} (${product.review_count} reviews)</span>
          </div>
        ` : ''}
        <div class="price-row">
          <span class="price">${formatPrice(product.price)}</span>
          ${product.compare_at_price && discount > 0 ? `<span class="compare-at">${formatPrice(product.compare_at_price)}</span><span class="discount-tag">${discount}% Off</span>` : ''}
        </div>
        <p class="description">${product.description || ''}</p>
        ${product.size ? `
          <div class="option-group">
            <p class="label">Size: <span>${product.size}</span></p>
            <span class="option-value active">${product.size}</span>
          </div>
        ` : ''}
        ${product.colour ? `
          <div class="option-group">
            <p class="label">Colour: <span>${product.colour}</span></p>
            <span class="option-value active">${product.colour}</span>
          </div>
        ` : ''}
        <div class="qty-selector">
          <div class="qty-box">
            <button onclick="productPageState.quantity=Math.max(1,productPageState.quantity-1);render()"><i class="lucide-minus"></i></button>
            <span>${productPageState.quantity}</span>
            <button onclick="productPageState.quantity++;render()"><i class="lucide-plus"></i></button>
          </div>
          ${product.stock > 0 ? `<span class="stock-info"><i class="lucide-check"></i> In Stock (${product.stock} available)</span>` : '<span class="stock-info out">Out of Stock</span>'}
        </div>
        <div class="product-actions">
          <button class="btn-gold" ${product.stock === 0 ? 'disabled' : ''} onclick="addToCart('${product.id}',productPageState.quantity,'${product.size || ''}','${product.colour || ''}')">
            <i class="lucide-shopping-bag"></i> Add to Cart
          </button>
          <button class="btn-outline" ${product.stock === 0 ? 'disabled' : ''} onclick="buyNow('${product.id}',productPageState.quantity,'${product.size || ''}','${product.colour || ''}')">Buy Now</button>
          <button class="icon-btn ${wished ? 'active' : ''}" onclick="toggleWishlist('${product.id}')"><i class="lucide-heart"></i></button>
          <button class="icon-btn" onclick="shareProduct()"><i class="lucide-share-2"></i></button>
        </div>
        <div class="trust-badges">
          <div class="tb"><i class="lucide-truck"></i><p>Free Shipping</p></div>
          <div class="tb"><i class="lucide-shield-check"></i><p>Secure Payment</p></div>
          <div class="tb"><i class="lucide-rotate-ccw"></i><p>7-Day Returns</p></div>
        </div>
        <div class="estimated-delivery">
          <strong>Estimated Delivery:</strong> ${new Date(Date.now() + 5*86400000).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})} - ${new Date(Date.now() + 7*86400000).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
        </div>
      </div>
    </div>

    <div class="product-tabs">
      <div class="tab-nav">
        ${['description','specs','care','reviews','faq'].map(t => {
          const labels = { description:'Description', specs:'Specifications', care:'Care Instructions', reviews:`Reviews (${reviews.length})`, faq:'FAQ' };
          return `<button class="${productPageState.activeTab === t ? 'active' : ''}" onclick="productPageState.activeTab='${t}';render()">${labels[t]}</button>`;
        }).join('')}
      </div>
      <div class="tab-content" id="tab-content"></div>
    </div>

    ${related.length > 0 ? `
      <div style="margin-top:4rem">
        <h2 class="section-title" style="margin-bottom:2rem">You May Also Like</h2>
        <div class="product-grid">${related.map(p => productCardHTML(p)).join('')}</div>
      </div>
    ` : ''}

    ${state.recentlyViewed.length > 1 ? `
      <div style="margin-top:4rem">
        <h2 class="section-title" style="margin-bottom:2rem">Recently Viewed</h2>
        <div class="product-grid">${state.recentlyViewed.filter(p => p.id !== product.id).slice(0,4).map(p => productCardHTML(p)).join('')}</div>
      </div>
    ` : ''}
  `;
}

function renderTabContent(product, reviews) {
  const tab = productPageState.activeTab;
  if (tab === 'description') {
    return `<p>${product.description || ''}</p><p style="margin-top:1rem">Each piece from Elegance of Women is crafted with meticulous attention to detail, using premium materials that ensure durability and lasting beauty. This ${product.name.toLowerCase()} is a testament to our commitment to quality and elegance.</p>`;
  }
  if (tab === 'specs') {
    const rows = [
      ['Material', product.material], ['Colour', product.colour], ['Size', product.size],
      ['SKU', product.sku], ['Category', product.category?.name], ['Stock', `${product.stock} units`],
    ];
    return `<table class="spec-table">${rows.map(([l,v]) => `<tr><td>${l}</td><td>${v || '-'}</td></tr>`).join('')}</table>`;
  }
  if (tab === 'care') {
    return ['Store your jewellery in a clean, dry place away from direct sunlight and moisture.',
      'Keep pieces separately to avoid scratches and tangling.',
      'Avoid contact with perfumes, lotions, and chemicals.',
      'Clean gently with a soft, dry cloth after each use.',
      'Remove jewellery before swimming, bathing, or exercising.',
      'For deep cleaning, use a mild soap solution and pat dry with a soft cloth.'].map(t => `<p>• ${t}</p>`).join('');
  }
  if (tab === 'reviews') {
    let html = '';
    if (reviews.length === 0) html += '<p style="color:var(--text-muted);margin-bottom:1rem">No reviews yet. Be the first to review!</p>';
    else {
      html += '<div style="margin-bottom:1.5rem">';
      reviews.forEach(rev => {
        html += `<div class="review-item">
          <div class="review-header">
            <div class="review-author">
              <div class="review-avatar"><span>${rev.author_name[0]}</span></div>
              <div><div class="review-name">${rev.author_name}</div>${rev.is_verified ? '<div class="review-verified"><i class="lucide-check"></i> Verified Purchase</div>' : ''}</div>
            </div>
            <div class="review-stars">${[1,2,3,4,5].map(s => `<i class="lucide-star ${s <= rev.rating ? 'filled' : ''}"></i>`).join('')}</div>
          </div>
          ${rev.title ? `<div class="review-title">${rev.title}</div>` : ''}
          <div class="review-body">${rev.body || ''}</div>
          <div class="review-date">${new Date(rev.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
        </div>`;
      });
      html += '</div>';
    }
    if (state.user) {
      html += `<button class="btn-outline" onclick="productPageState.showReviewForm=!productPageState.showReviewForm;render()">Write a Review</button>`;
      if (productPageState.showReviewForm) {
        html += `<form onsubmit="submitReview(event,'${product.id}')" style="border:1px solid var(--border);padding:1rem;margin-top:1rem">
          <label style="font-size:0.875rem;display:block;margin-bottom:0.5rem">Rating</label>
          <div style="display:flex;gap:0.25rem;margin-bottom:0.75rem">
            ${[1,2,3,4,5].map(s => `<button type="button" onclick="reviewRating=${s};this.parentElement.querySelectorAll('i').forEach((el,i)=>el.className='lucide-star '+(i<${s}?'filled':''))"><i class="lucide-star ${s <= 5 ? 'filled' : ''}"></i></button>`).join('')}
          </div>
          <input type="text" id="review-title-field" placeholder="Review title" class="input-field" style="margin-bottom:0.75rem" required />
          <textarea id="review-body-field" placeholder="Write your review..." rows="4" class="input-field" style="margin-bottom:0.75rem" required></textarea>
          <button type="submit" class="btn-gold">Submit Review</button>
        </form>`;
      }
    } else {
      html += `<p style="font-size:0.875rem;color:var(--text-muted)"><a href="#/login" onclick="event.preventDefault();navigate('/login')" style="color:var(--gold-500)">Login</a> to write a review.</p>`;
    }
    return html;
  }
  if (tab === 'faq') {
    const faqs = [
      ['Is this jewellery handmade?','Yes, all our jewellery is handcrafted by skilled artisans.'],
      ['What is the return policy?','We offer a 7-day easy return policy. Items must be unused and in original packaging.'],
      ['Is the gold plating durable?','Yes, our gold plating is done with high-quality materials and can last 1-2 years with proper care.'],
      ['Do you offer warranty?','Yes, all products come with a 6-month warranty against manufacturing defects.'],
    ];
    return faqs.map(([q,a]) => `<div class="faq-item"><button onclick="this.parentElement.classList.toggle('open')">${q}<i class="lucide-chevron-down"></i></button><div class="answer">${a}</div></div>`).join('');
  }
  return '';
}

let reviewRating = 5;

async function submitReview(e, productId) {
  e.preventDefault();
  if (!state.user) return;
  const title = document.getElementById('review-title-field').value;
  const body = document.getElementById('review-body-field').value;
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', state.user.id).maybeSingle();
  const authorName = profile?.full_name || state.user.email?.split('@')[0] || 'Anonymous';
  await supabase.from('reviews').insert({
    product_id: productId, user_id: state.user.id, author_name: authorName,
    rating: reviewRating, title, body,
  });
  productPageState.showReviewForm = false;
  loadPageData(getRoute());
}

async function buyNow(productId, qty, size, colour) {
  await addToCart(productId, qty, size, colour, { skipRender: true });
  navigate('/checkout');
}

function shareProduct() {
  if (navigator.share) navigator.share({ url: location.href });
  else navigator.clipboard.writeText(location.href);
}

async function quickView(slug) {
  const { data } = await supabase.from('products').select('*, category:categories(*), product_images(*)').eq('slug', slug).maybeSingle();
  if (!data) return;
  const p = data;
  const discount = calculateDiscount(p.price, p.compare_at_price);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(0,0,0,0.5)';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <div style="background:var(--card-bg);max-width:48rem;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:0;animation:scaleIn 0.3s ease" onclick="event.stopPropagation()">
      <div style="aspect-ratio:1;overflow:hidden"><img src="${getFirstImage(p)}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover" /></div>
      <div style="padding:2rem;display:flex;flex-direction:column;justify-content:center">
        <h2 style="font-size:1.5rem;margin-bottom:0.5rem">${p.name}</h2>
        <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1rem">
          <span style="font-size:1.25rem;font-weight:500">${formatPrice(p.price)}</span>
          ${p.compare_at_price && discount > 0 ? `<span style="color:var(--ink-400);text-decoration:line-through">${formatPrice(p.compare_at_price)}</span><span style="color:var(--gold-500);font-size:0.875rem">${discount}% Off</span>` : ''}
        </div>
        <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1rem">${(p.description || '').slice(0,150)}...</p>
        ${p.material ? `<p style="font-size:0.875rem;margin-bottom:0.25rem"><strong>Material:</strong> ${p.material}</p>` : ''}
        ${p.colour ? `<p style="font-size:0.875rem;margin-bottom:1rem"><strong>Colour:</strong> ${p.colour}</p>` : ''}
        <div style="display:flex;gap:0.75rem">
          <button class="btn-gold" style="flex:1" onclick="addToCart('${p.id}');this.closest('[style*=fixed]').remove()"><i class="lucide-shopping-bag"></i> Add to Cart</button>
          <a href="#/product/${p.slug}" onclick="event.preventDefault();navigate('/product/${p.slug}');this.closest('[style*=fixed]').remove()" class="btn-outline" style="flex:1;text-align:center">View Details</a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ============================================
// Cart Page
// ============================================
let cartPageState = { couponCode: '', appliedCoupon: null, couponError: '', shipping: 0 };

function renderCart() {
  if (state.cart.length === 0) {
    return `<div class="container empty-state"><i class="lucide-shopping-bag"></i><h2>Your Cart is Empty</h2><p>Discover our beautiful collection of premium jewellery.</p><button class="btn-gold" onclick="navigate('/shop')">Continue Shopping</button></div>`;
  }

  const cartTotal = getCartTotal();
  const discount = cartPageState.appliedCoupon ? (cartPageState.appliedCoupon.discount_type === 'percentage' ? Math.min(cartPageState.appliedCoupon.discount_value * cartTotal / 100, cartPageState.appliedCoupon.max_discount || Infinity) : cartPageState.appliedCoupon.discount_value) : 0;
  const shippingCost = cartPageState.shipping === 0 ? (cartTotal >= 2000 ? 0 : 99) : cartPageState.shipping;
  const total = cartTotal - discount + shippingCost;

  return `
    <div class="page-header"><div class="container text-center"><h1 class="section-title">Shopping Cart</h1></div></div>
    <div class="container section">
      <div class="cart-layout">
        <div>
          ${state.cart.map(item => {
            const p = item.product;
            if (!p) return '';
            const disc = calculateDiscount(p.price, p.compare_at_price);
            return `
              <div class="cart-item">
                <a href="#/product/${p.slug}" onclick="event.preventDefault();navigate('/product/${p.slug}')"><img src="${getFirstImage(p)}" alt="${p.name}" /></a>
                <div class="cart-item-info">
                  <div class="cart-item-top">
                    <div>
                      <a href="#/product/${p.slug}" onclick="event.preventDefault();navigate('/product/${p.slug}')"><h3>${p.name}</h3></a>
                      ${item.selected_size ? `<div class="cart-item-meta">Size: ${item.selected_size}</div>` : ''}
                      ${item.selected_colour ? `<div class="cart-item-meta">Colour: ${item.selected_colour}</div>` : ''}
                    </div>
                    <button onclick="removeFromCart('${item.id}')" style="color:var(--ink-400);padding:0.25rem"><i class="lucide-trash-2"></i></button>
                  </div>
                  <div class="cart-item-bottom">
                    <div class="cart-qty">
                      <button onclick="updateCartQty('${item.id}',${item.quantity - 1})"><i class="lucide-minus"></i></button>
                      <span>${item.quantity}</span>
                      <button onclick="updateCartQty('${item.id}',${item.quantity + 1})"><i class="lucide-plus"></i></button>
                    </div>
                    <div class="cart-item-price">
                      <div class="total">${formatPrice(p.price * item.quantity)}</div>
                      ${disc > 0 ? `<div class="compare">${formatPrice((p.compare_at_price || 0) * item.quantity)}</div>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
          <a href="#/shop" onclick="event.preventDefault();navigate('/shop')" style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.875rem;color:var(--gold-500);margin-top:1rem"><i class="lucide-arrow-right" style="transform:rotate(180deg)"></i> Continue Shopping</a>
        </div>
        <div>
          <div class="cart-summary">
            <h3>Order Summary</h3>
            <div class="cart-coupon">
              <label><i class="lucide-tag"></i> Coupon Code</label>
              <div class="coupon-row">
                <input type="text" id="coupon-input" placeholder="Enter coupon code" class="input-field" value="${cartPageState.couponCode}" oninput="cartPageState.couponCode=this.value" />
                <button class="btn-outline" onclick="applyCoupon()">Apply</button>
              </div>
              ${cartPageState.couponError ? `<p style="font-size:0.75rem;color:#ef4444;margin-top:0.25rem">${cartPageState.couponError}</p>` : ''}
              ${cartPageState.appliedCoupon ? `<p style="font-size:0.75rem;color:#16a34a;margin-top:0.25rem">Coupon "${cartPageState.appliedCoupon.code}" applied!</p>` : ''}
              <p style="font-size:0.75rem;color:var(--ink-400);margin-top:0.25rem">Try: WELCOME10, LUXURY500, BRIDAL15</p>
            </div>
            <div class="shipping-options">
              <label><input type="radio" name="shipping" value="0" ${cartPageState.shipping === 0 ? 'checked' : ''} onchange="cartPageState.shipping=0;render()" /> Standard (3-5 days) - ${cartTotal >= 2000 ? 'FREE' : '₹99'}</label>
              <label><input type="radio" name="shipping" value="100" ${cartPageState.shipping === 100 ? 'checked' : ''} onchange="cartPageState.shipping=100;render()" /> Express (1-2 days) - ₹100</label>
            </div>
            <div class="summary-row"><span>Subtotal</span><span>${formatPrice(cartTotal)}</span></div>
            ${discount > 0 ? `<div class="summary-row discount"><span>Discount</span><span>-${formatPrice(discount)}</span></div>` : ''}
            <div class="summary-row"><span>Shipping</span><span>${shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}</span></div>
            <div class="summary-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
            <button class="btn-gold w-full" style="margin-top:1.5rem" onclick="navigate('/checkout')">Proceed to Checkout <i class="lucide-arrow-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function applyCoupon() {
  if (!cartPageState.couponCode) return;
  const { data, error } = await supabase.from('coupons').select('*').eq('code', cartPageState.couponCode.toUpperCase()).eq('is_active', true).maybeSingle();
  if (error || !data) { cartPageState.couponError = 'Invalid or expired coupon code'; cartPageState.appliedCoupon = null; render(); return; }
  if (getCartTotal() < data.min_order) { cartPageState.couponError = `Minimum order of ${formatPrice(data.min_order)} required`; cartPageState.appliedCoupon = null; render(); return; }
  cartPageState.appliedCoupon = data;
  cartPageState.couponError = '';
  render();
}

// ============================================
// Checkout Page
// ============================================
let checkoutState = { guestMode: true, addresses: [], selectedAddressId: '', showNewAddress: true, deliveryOption: 'standard', paymentMethod: 'card', orderPlaced: false, orderNumber: '', loading: false, addrForm: { full_name:'', phone:'', email:'', address_line1:'', address_line2:'', city:'', state:'', postal_code:'', country:'India' } };

function renderCheckoutAddressSection() {
  let html = '<h3>Shipping Address</h3>';
  if (state.user && checkoutState.addresses.length > 0 && !checkoutState.showNewAddress) {
    html += `<div style="margin-bottom:1rem">
      ${checkoutState.addresses.map(addr => `
        <label style="display:flex;gap:0.75rem;padding:0.75rem;border:1px solid ${checkoutState.selectedAddressId === addr.id ? 'var(--gold-400)' : 'var(--border)'};cursor:pointer;margin-bottom:0.5rem">
          <input type="radio" name="address" ${checkoutState.selectedAddressId === addr.id ? 'checked' : ''} onchange="checkoutState.selectedAddressId='${addr.id}';render()" style="accent-color:var(--gold-500)" />
          <div style="font-size:0.875rem"><strong>${addr.full_name}</strong><br/><span style="color:var(--text-muted)">${addr.address_line1}, ${addr.city}, ${addr.state} - ${addr.postal_code}</span><br/><span style="color:var(--text-muted)">Phone: ${addr.phone}</span></div>
        </label>
      `).join('')}
      <button onclick="checkoutState.showNewAddress=true;render()" style="font-size:0.875rem;color:var(--gold-500)">+ Add new address</button>
    </div>`;
  }
  if (checkoutState.showNewAddress || checkoutState.addresses.length === 0) {
    html += `<div class="checkout-form-grid">
      <input type="text" placeholder="Full Name *" class="input-field" value="${checkoutState.addrForm.full_name}" oninput="checkoutState.addrForm.full_name=this.value" required />
      <input type="tel" placeholder="Mobile Number *" class="input-field" value="${checkoutState.addrForm.phone}" oninput="checkoutState.addrForm.phone=this.value" required />
      <input type="email" placeholder="Email *" class="input-field full" value="${checkoutState.addrForm.email}" oninput="checkoutState.addrForm.email=this.value" required />
      <input type="text" placeholder="Address Line 1 *" class="input-field full" value="${checkoutState.addrForm.address_line1}" oninput="checkoutState.addrForm.address_line1=this.value" required />
      <input type="text" placeholder="Address Line 2" class="input-field full" value="${checkoutState.addrForm.address_line2}" oninput="checkoutState.addrForm.address_line2=this.value" />
      <input type="text" placeholder="City *" class="input-field" value="${checkoutState.addrForm.city}" oninput="checkoutState.addrForm.city=this.value" required />
      <input type="text" placeholder="State *" class="input-field" value="${checkoutState.addrForm.state}" oninput="checkoutState.addrForm.state=this.value" required />
      <input type="text" placeholder="PIN Code *" class="input-field" value="${checkoutState.addrForm.postal_code}" oninput="checkoutState.addrForm.postal_code=this.value" required />
      <input type="text" placeholder="Country" class="input-field" value="${checkoutState.addrForm.country}" oninput="checkoutState.addrForm.country=this.value" />
    </div>`;
  }
  return html;
}

function renderCheckout() {
  if (checkoutState.orderPlaced) {
    return `<div class="container order-confirmation">
      <div class="invoice-logo">
        ${state.brandLogo
          ? `<img src="${state.brandLogo}" alt="Elegance of Women" style="height:3rem;width:auto;object-fit:contain;margin:0 auto" />`
          : `<div class="logo-box"><span>E</span></div><div><h4 style="font-family:var(--font-serif);font-size:1.25rem">Elegance of Women</h4></div>`
        }
      </div>
      <div class="check-icon"><i class="lucide-check"></i></div>
      <h2>Order Confirmed!</h2>
      <p>Thank you for your purchase.</p>
      <p>Your order number is <span class="order-num">${checkoutState.orderNumber}</span></p>
      <p>Estimated delivery: ${new Date(Date.now() + (checkoutState.deliveryOption === 'express' ? 2 : 5) * 86400000).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
      <button class="btn-gold" style="margin-top:1.5rem" onclick="checkoutState.orderPlaced=false;navigate('/shop')">Continue Shopping</button>
    </div>`;
  }

  if (state.cart.length === 0) {
    return `<div class="container empty-state"><p style="font-size:1.125rem;color:var(--text-muted)">Your cart is empty.</p><button class="btn-gold" onclick="navigate('/shop')">Shop Now</button></div>`;
  }

  const cartTotal = getCartTotal();
  const shippingCost = checkoutState.deliveryOption === 'express' ? 100 : (cartTotal >= 2000 ? 0 : 99);
  const total = cartTotal + shippingCost;

  return `
    <div class="page-header"><div class="container text-center">
      ${state.brandLogo ? `<img src="${state.brandLogo}" alt="Elegance of Women" style="height:2.5rem;width:auto;object-fit:contain;margin:0 auto 0.5rem" />` : ''}
      <h1 class="section-title">Checkout</h1>
    </div></div>
    <div class="container section">
      <div class="checkout-layout">
        <div>
          ${!state.user ? `
            <div class="checkout-section">
              <h3>Account</h3>
              <div class="auth-toggle">
                <button class="${checkoutState.guestMode ? 'active' : ''}" onclick="checkoutState.guestMode=true;render()">Guest Checkout</button>
                <a href="#/login" onclick="event.preventDefault();navigate('/login')" class="${!checkoutState.guestMode ? 'active' : ''}" style="text-align:center;display:flex;align-items:center;justify-content:center;padding:0.75rem">Login</a>
              </div>
            </div>
          ` : ''}

          <div class="checkout-section" id="checkout-address-section">${renderCheckoutAddressSection()}</div>

          <div class="checkout-section">
            <h3>Delivery Options</h3>
            <label class="delivery-option ${checkoutState.deliveryOption === 'standard' ? 'active' : ''}">
              <input type="radio" ${checkoutState.deliveryOption === 'standard' ? 'checked' : ''} onchange="checkoutState.deliveryOption='standard';render()" />
              <div class="info"><p>Standard Delivery</p><span>3-5 business days</span></div>
              <span class="price">${cartTotal >= 2000 ? 'FREE' : '₹99'}</span>
            </label>
            <label class="delivery-option ${checkoutState.deliveryOption === 'express' ? 'active' : ''}">
              <input type="radio" ${checkoutState.deliveryOption === 'express' ? 'checked' : ''} onchange="checkoutState.deliveryOption='express';render()" />
              <div class="info"><p>Express Delivery</p><span>1-2 business days</span></div>
              <span class="price">₹100</span>
            </label>
          </div>

          <div class="checkout-section">
            <h3>Payment Method</h3>
            ${[
              { key: 'upi', icon: 'smartphone', label: 'UPI Payment' },
              { key: 'credit-card', icon: 'credit-card', label: 'Credit Card' },
              { key: 'debit-card', icon: 'credit-card', label: 'Debit Card' },
              { key: 'netbanking', icon: 'banknote', label: 'Net Banking' },
              { key: 'cod', icon: 'banknote', label: 'Cash on Delivery' },
            ].map(p => `
              <label class="payment-option ${checkoutState.paymentMethod === p.key ? 'active' : ''}">
                <input type="radio" ${checkoutState.paymentMethod === p.key ? 'checked' : ''} onchange="checkoutState.paymentMethod='${p.key}';render()" />
                <div class="info"><p>${p.label}</p></div>
                <i class="lucide-${p.icon}" style="color:var(--gold-500)"></i>
              </label>
            `).join('')}
            <p style="font-size:0.75rem;color:var(--ink-400);margin-top:0.75rem;display:flex;align-items:center;gap:0.25rem"><i class="lucide-lock"></i> All payments are secure and encrypted</p>
          </div>
        </div>

        <div>
          <div class="checkout-summary">
            <h3>Order Summary</h3>
            <div style="max-height:16rem;overflow-y:auto;margin-bottom:1rem">
              ${state.cart.map(item => `
                <div class="checkout-summary-item">
                  <img src="${item.product ? getFirstImage(item.product) : ''}" alt="${item.product?.name || ''}" />
                  <div class="info">
                    <p>${item.product?.name || ''}</p>
                    <span class="qty">Qty: ${item.quantity}</span>
                    <span class="price">${formatPrice((item.product?.price || 0) * item.quantity)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="summary-row"><span>Subtotal</span><span>${formatPrice(cartTotal)}</span></div>
            <div class="summary-row"><span>Shipping</span><span>${shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}</span></div>
            <div class="summary-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
            <button class="btn-gold w-full" style="margin-top:1.5rem" ${checkoutState.loading ? 'disabled' : ''} onclick="placeOrder()">${checkoutState.loading ? 'Placing Order...' : `Place Order - ${formatPrice(total)}`}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function placeOrder() {
  if (!state.user) { state.loginReturnPath = '/checkout'; navigate('/login'); return; }
  const f = checkoutState.addrForm;
  if (!f.full_name || !f.phone || !f.email || !f.address_line1 || !f.city || !f.state || !f.postal_code) {
    showNotif('Please fill in all required address fields.', 'error');
    return;
  }
  checkoutState.loading = true; render();
  const ordNum = generateOrderNumber();
  const cartTotal = getCartTotal();
  const shippingCost = checkoutState.deliveryOption === 'express' ? 100 : (cartTotal >= 2000 ? 0 : 99);
  const total = cartTotal + shippingCost;

  const { data: orderData } = await supabase.from('orders').insert({
    user_id: state.user.id, order_number: ordNum, status: 'confirmed',
    total, subtotal: cartTotal, shipping: shippingCost,
    payment_method: checkoutState.paymentMethod,
    payment_status: checkoutState.paymentMethod === 'cod' ? 'pending' : 'paid',
    shipping_address: checkoutState.addrForm,
    estimated_delivery: new Date(Date.now() + (checkoutState.deliveryOption === 'express' ? 2 : 5) * 86400000).toISOString().split('T')[0],
  }).select().single();

  if (orderData) {
    const items = state.cart.map(item => ({
      order_id: orderData.id, product_id: item.product_id,
      product_name: item.product?.name || '', product_image: item.product ? getFirstImage(item.product) : null,
      price: item.product?.price || 0, quantity: item.quantity,
      selected_size: item.selected_size, selected_colour: item.selected_colour,
    }));
    await supabase.from('order_items').insert(items);
  }

  saveCartToStorage([]);
  checkoutState.loading = false;
  checkoutState.orderPlaced = true;
  checkoutState.orderNumber = ordNum;
  render();
}

// ============================================
// Login Page
// ============================================
let loginState = { mode: 'login', email: '', password: '', fullName: '', showPassword: false, error: '', loading: false, remember: false, forgotMode: false, resetEmail: '', resetSent: false };

function renderLogin() {
  if (loginState.forgotMode) return renderForgotPassword();
  return `
    <div class="login-page">
      <div class="login-box">
        <div class="logo-center">
          ${state.brandLogo
            ? `<img src="${state.brandLogo}" alt="Elegance of Women" style="height:3rem;width:auto;object-fit:contain;margin:0 auto" />`
            : `<div class="navbar-logo"><div class="logo-box"><span>E</span></div></div>`
          }
        </div>
        <h1>${loginState.mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
        <p class="subtitle">${loginState.mode === 'login' ? 'Sign in to your account to continue' : 'Join us for a premium jewellery experience'}</p>
        <div class="login-form">
          <form onsubmit="handleAuth(event)">
            ${loginState.mode === 'signup' ? `
              <div class="field">
                <label>Full Name</label>
                <div class="input-wrap">
                  <i class="lucide-user"></i>
                  <input type="text" class="input-field" placeholder="Enter your full name" value="${loginState.fullName}" oninput="loginState.fullName=this.value" required />
                </div>
              </div>
            ` : ''}
            <div class="field">
              <label>Email Address</label>
              <div class="input-wrap">
                <i class="lucide-mail"></i>
                <input type="email" class="input-field" placeholder="Enter your email" value="${loginState.email}" oninput="loginState.email=this.value" required />
              </div>
            </div>
            <div class="field">
              <label>Password</label>
              <div class="input-wrap">
                <i class="lucide-lock"></i>
                <input type="${loginState.showPassword ? 'text' : 'password'}" class="input-field" placeholder="Enter your password" value="${loginState.password}" oninput="loginState.password=this.value" required minlength="6" />
                <button type="button" class="toggle-pw" onclick="loginState.showPassword=!loginState.showPassword;render()"><i class="lucide-${loginState.showPassword ? 'eye-off' : 'eye'}"></i></button>
              </div>
            </div>
            ${loginState.error ? `<div class="error-msg">${loginState.error}</div>` : ''}
            ${loginState.mode === 'login' ? `
              <div class="form-footer">
                <label><input type="checkbox" ${loginState.remember ? 'checked' : ''} onchange="loginState.remember=this.checked" style="accent-color:var(--gold-500)" /> Remember me</label>
                <button type="button" onclick="loginState.forgotMode=true;loginState.error='';render()">Forgot Password?</button>
              </div>
            ` : ''}
            <button type="submit" class="btn-gold w-full" ${loginState.loading ? 'disabled' : ''}>${loginState.loading ? 'Please wait...' : loginState.mode === 'login' ? 'Sign In' : 'Create Account'}</button>
          </form>
          <div class="login-divider"><span>or</span></div>
          <button type="button" class="btn-google w-full" onclick="signInWithGoogle()">
            <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
          <div class="login-switch">
            ${loginState.mode === 'login' ? "Don't have an account? <button onclick=\"loginState.mode='signup';loginState.error='';render()\">Sign Up</button>" : 'Already have an account? <button onclick=\"loginState.mode=\'login\';loginState.error=\'\';render()\">Sign In</button>'}
          </div>
        </div>
        <p class="login-terms">By continuing, you agree to our <a href="#/terms" onclick="event.preventDefault();navigate('/terms')">Terms</a> and <a href="#/privacy-policy" onclick="event.preventDefault();navigate('/privacy-policy')">Privacy Policy</a></p>
      </div>
    </div>
  `;
}

async function handleAuth(e) {
  e.preventDefault();
  loginState.loading = true; loginState.error = '';
  render();
  let err;
  if (loginState.mode === 'login') {
    err = await signIn(loginState.email, loginState.password);
  } else {
    err = await signUp(loginState.email, loginState.password, loginState.fullName);
  }
  loginState.loading = false;
  if (err) {
    loginState.error = err;
    render();
  } else {
    await loadUserData();
    const ret = state.loginReturnPath;
    state.loginReturnPath = null;
    navigate(ret || '/account');
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  loginState.loading = true; loginState.error = '';
  const { error } = await supabase.auth.resetPasswordForEmail(loginState.resetEmail, {
    redirectTo: `${window.location.origin}/#/login`,
  });
  loginState.loading = false;
  if (error) { loginState.error = error.message; }
  else { loginState.resetSent = true; }
  render();
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/#/account` },
  });
  if (error) { loginState.error = error.message; render(); }
}

function renderForgotPassword() {
  return `
    <div class="login-page">
      <div class="login-box">
        <div class="logo-center">
          ${state.brandLogo
            ? `<img src="${state.brandLogo}" alt="Elegance of Women" style="height:3rem;width:auto;object-fit:contain;margin:0 auto" />`
            : `<div class="navbar-logo"><div class="logo-box"><span>E</span></div></div>`
          }
        </div>
        <h1>Reset Password</h1>
        <p class="subtitle">Enter your email and we'll send you a reset link</p>
        <div class="login-form">
          ${loginState.resetSent ? `
            <div class="success-msg"><i class="lucide-check-circle"></i> Reset link sent to <strong>${loginState.resetEmail}</strong>. Check your inbox.</div>
          ` : `
            <form onsubmit="handleForgotPassword(event)">
              <div class="field">
                <label>Email Address</label>
                <div class="input-wrap">
                  <i class="lucide-mail"></i>
                  <input type="email" class="input-field" placeholder="Enter your email" value="${loginState.resetEmail}" oninput="loginState.resetEmail=this.value" required />
                </div>
              </div>
              ${loginState.error ? `<div class="error-msg">${loginState.error}</div>` : ''}
              <button type="submit" class="btn-gold w-full" ${loginState.loading ? 'disabled' : ''}>${loginState.loading ? 'Sending...' : 'Send Reset Link'}</button>
            </form>
          `}
          <div class="login-switch"><button onclick="loginState.forgotMode=false;loginState.resetSent=false;loginState.error='';render()">Back to Login</button></div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Account Page
// ============================================
let accountState = { tab: 'profile', orders: [], addresses: [], profile: null, showAddressForm: false, addrForm: { full_name:'', phone:'', address_line1:'', address_line2:'', city:'', state:'', postal_code:'', country:'India' } };

function renderAccount() {
  if (!state.user) { navigate('/login'); return ''; }

  const tabs = [
    { key: 'profile', label: 'Profile', icon: 'user' },
    { key: 'orders', label: 'Orders', icon: 'package' },
    { key: 'wishlist', label: 'Wishlist', icon: 'heart' },
    { key: 'addresses', label: 'Addresses', icon: 'map-pin' },
    { key: 'returns', label: 'Returns', icon: 'settings' },
  ];

  return `
    <div class="page-header"><div class="container text-center"><h1 class="section-title">My Account</h1><p style="font-size:0.875rem;color:var(--text-muted);margin-top:0.5rem">Welcome, ${accountState.profile?.full_name || state.user.email}</p></div></div>
    <div class="container section">
      <div class="account-layout">
        <aside class="account-sidebar">
          <div class="account-user">
            <div class="avatar"><span>${(accountState.profile?.full_name || state.user.email || 'U')[0].toUpperCase()}</span></div>
            <div style="min-width:0"><div class="name">${accountState.profile?.full_name || 'User'}</div><div class="email">${state.user.email}</div></div>
          </div>
          <nav class="account-nav">
            ${tabs.map(t => `
              <button class="${accountState.tab === t.key ? 'active' : ''}" onclick="accountState.tab='${t.key}';render()">
                <i class="lucide-${t.icon}"></i> ${t.label}
                ${t.key === 'wishlist' && state.wishlist.length > 0 ? `<span class="nav-badge">${state.wishlist.length}</span>` : ''}
                ${t.key === 'orders' && accountState.orders.length > 0 ? `<span class="nav-badge">${accountState.orders.length}</span>` : ''}
              </button>
            `).join('')}
            <button class="sign-out" onclick="signOut()"><i class="lucide-log-out"></i> Sign Out</button>
          </nav>
        </aside>
        <div class="account-content" id="account-content"></div>
      </div>
    </div>
  `;
}

function renderAccountContent() {
  const tab = accountState.tab;
  if (tab === 'profile') {
    return `<h2>Profile Information</h2>
      <div class="account-form-grid">
        <div><label style="font-size:0.875rem;font-weight:500;margin-bottom:0.375rem;display:block">Full Name</label><input type="text" class="input-field" value="${accountState.profile?.full_name || ''}" placeholder="Your full name" /></div>
        <div><label style="font-size:0.875rem;font-weight:500;margin-bottom:0.375rem;display:block">Email</label><input type="email" class="input-field" value="${state.user?.email || ''}" disabled style="opacity:0.6" /></div>
        <div><label style="font-size:0.875rem;font-weight:500;margin-bottom:0.375rem;display:block">Phone</label><input type="text" class="input-field" value="${accountState.profile?.phone || ''}" placeholder="Your phone number" /></div>
      </div>
      <button class="btn-gold" style="margin-top:1rem">Update Profile</button>`;
  }
  if (tab === 'orders') {
    if (accountState.orders.length === 0) return `<h2>Order History</h2><div style="text-align:center;padding:3rem 0"><i class="lucide-package" style="font-size:3rem;color:var(--ink-200)"></i><p style="font-size:0.875rem;color:var(--text-muted);margin:1rem 0">You haven't placed any orders yet.</p><button class="btn-gold" onclick="navigate('/shop')">Start Shopping</button></div>`;
    return `<h2>Order History</h2>${accountState.orders.map(o => `
      <div class="order-card">
        <div class="order-header">
          <div><div class="order-num">Order #${o.order_number}</div><div class="order-date">${new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div></div>
          <div style="display:flex;align-items:center;gap:0.75rem">
            <span class="order-status ${o.status}">${o.status}</span>
            <span class="order-total">${formatPrice(o.total)}</span>
          </div>
        </div>
        ${o.order_items?.map(item => `
          <div class="order-item-row">
            <img src="${item.product_image || ''}" alt="${item.product_name}" />
            <span>${item.product_name}</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">Qty: ${item.quantity}</span>
            <span class="item-price">${formatPrice(item.price * item.quantity)}</span>
          </div>
        `).join('')}
      </div>
    `).join('')}`;
  }
  if (tab === 'wishlist') {
    if (state.wishlist.length === 0) return `<h2>My Wishlist</h2><div style="text-align:center;padding:3rem 0"><i class="lucide-heart" style="font-size:3rem;color:var(--ink-200)"></i><p style="font-size:0.875rem;color:var(--text-muted);margin:1rem 0">Your wishlist is empty.</p><button class="btn-gold" onclick="navigate('/shop')">Browse Products</button></div>`;
    return `<h2>My Wishlist</h2><div class="product-grid">${state.wishlist.map(w => w.product ? productCardHTML(w.product) : '').join('')}</div>`;
  }
  if (tab === 'addresses') {
    let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem"><h2>Saved Addresses</h2><button class="btn-outline" style="font-size:0.875rem;padding:0.5rem 1rem" onclick="accountState.showAddressForm=!accountState.showAddressForm;render()"><i class="lucide-plus"></i> Add New</button></div>`;
    if (accountState.showAddressForm) {
      html += `<form onsubmit="saveAddress(event)" style="border:1px solid var(--border);padding:1rem;margin-bottom:1rem">
        <div class="checkout-form-grid">
          <input type="text" placeholder="Full Name *" class="input-field" value="${accountState.addrForm.full_name}" oninput="accountState.addrForm.full_name=this.value" required />
          <input type="text" placeholder="Phone *" class="input-field" value="${accountState.addrForm.phone}" oninput="accountState.addrForm.phone=this.value" required />
          <input type="text" placeholder="Address Line 1 *" class="input-field full" value="${accountState.addrForm.address_line1}" oninput="accountState.addrForm.address_line1=this.value" required />
          <input type="text" placeholder="Address Line 2" class="input-field full" value="${accountState.addrForm.address_line2}" oninput="accountState.addrForm.address_line2=this.value" />
          <input type="text" placeholder="City *" class="input-field" value="${accountState.addrForm.city}" oninput="accountState.addrForm.city=this.value" required />
          <input type="text" placeholder="State *" class="input-field" value="${accountState.addrForm.state}" oninput="accountState.addrForm.state=this.value" required />
          <input type="text" placeholder="Postal Code *" class="input-field" value="${accountState.addrForm.postal_code}" oninput="accountState.addrForm.postal_code=this.value" required />
        </div>
        <button type="submit" class="btn-gold" style="margin-top:0.75rem">Save Address</button>
      </form>`;
    }
    if (accountState.addresses.length === 0 && !accountState.showAddressForm) {
      html += `<div style="text-align:center;padding:3rem 0"><i class="lucide-map-pin" style="font-size:3rem;color:var(--ink-200)"></i><p style="font-size:0.875rem;color:var(--text-muted);margin-top:1rem">No saved addresses yet.</p></div>`;
    } else {
      html += `<div class="grid-2">${accountState.addresses.map(a => `
        <div class="address-card">
          <div class="addr-top">
            <div><div class="addr-name">${a.full_name}</div><div class="addr-text">${a.address_line1}${a.address_line2 ? ', ' + a.address_line2 : ''}<br/>${a.city}, ${a.state} - ${a.postal_code}<br/>Phone: ${a.phone}</div></div>
            <button onclick="deleteAddress('${a.id}')" style="color:var(--ink-400);padding:0.25rem"><i class="lucide-trash-2"></i></button>
          </div>
        </div>
      `).join('')}</div>`;
    }
    return html;
  }
  if (tab === 'returns') {
    return `<h2>Returns & Refunds</h2><div style="border:1px solid var(--border);padding:1.5rem"><p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1rem">We offer a 7-day easy return policy. If you're not satisfied with your purchase, you can initiate a return from this section.</p><p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1rem">No active return requests.</p><button class="btn-outline" onclick="navigate('/return-policy')">View Return Policy</button></div>`;
  }
  return '';
}

async function saveAddress(e) {
  e.preventDefault();
  if (!state.user) return;
  await supabase.from('addresses').insert({ ...accountState.addrForm, user_id: state.user.id });
  const { data } = await supabase.from('addresses').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false });
  accountState.addresses = data || [];
  accountState.showAddressForm = false;
  accountState.addrForm = { full_name:'', phone:'', address_line1:'', address_line2:'', city:'', state:'', postal_code:'', country:'India' };
  render();
}

async function deleteAddress(id) {
  await supabase.from('addresses').delete().eq('id', id);
  accountState.addresses = accountState.addresses.filter(a => a.id !== id);
  render();
}

// ============================================
// Static Pages
// ============================================
function renderAbout() {
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Our Story</p><h1 class="section-title">About Elegance of Women</h1></div></div>
    <div class="container section">
      <div style="max-width:48rem;margin:0 auto">
        <div style="aspect-ratio:16/9;margin-bottom:2rem;overflow:hidden;background:var(--ink-100)"><img src="https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Our workshop" style="width:100%;height:100%;object-fit:cover" /></div>
        <p style="color:var(--text-muted);line-height:1.6;margin-bottom:1rem">Elegance of Women was born from a passion for timeless beauty and a commitment to craftsmanship. Founded with the vision of making luxury jewellery accessible to every woman, we have grown into a trusted name in the world of fine jewellery.</p>
        <p style="color:var(--text-muted);line-height:1.6;margin-bottom:1rem">Each piece in our collection is handcrafted by skilled artisans who bring decades of experience and an eye for detail. From intricate Kundan work to delicate pearl strands, we celebrate the artistry of Indian jewellery-making while embracing contemporary designs.</p>
        <p style="color:var(--text-muted);line-height:1.6;margin-bottom:2rem">Our mission is simple: to help every woman feel elegant, confident, and beautiful. Whether it's for your wedding day, a festive celebration, or everyday elegance, we have the perfect piece for you.</p>
        <div class="grid-3" style="margin-top:3rem">
          ${[{icon:'award',t:'Quality First',d:'Premium materials and rigorous quality checks'},{icon:'hand',t:'Handcrafted',d:'Every piece made by skilled artisans'},{icon:'sparkles',t:'Affordable Luxury',d:'Luxury jewellery at accessible prices'}].map(i => `<div style="text-align:center"><div class="why-item"><div class="icon-box"><i class="lucide-${i.icon}"></i></div><h3>${i.t}</h3><p>${i.d}</p></div></div>`).join('')}
        </div>
      </div>
    </div>`;
}

function renderContact() {
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Get in Touch</p><h1 class="section-title">Contact Us</h1></div></div>
    <div class="container section">
      <div style="display:grid;grid-template-columns:1fr;gap:2rem;max-width:64rem;margin:0 auto" class="contact-grid">
        <div>
          <h2 style="font-size:1.25rem;margin-bottom:1.5rem">Contact Information</h2>
          ${[{icon:'map-pin',l:'Address',v:'123 Jewellery Lane, Mumbai, India 400001'},{icon:'phone',l:'Phone',v:'+91 98765 43210'},{icon:'mail',l:'Email',v:'care@eleganceofwomen.com'},{icon:'clock',l:'Hours',v:'Mon - Sat: 9 AM - 8 PM IST'}].map(i => `
            <div style="display:flex;gap:0.75rem;margin-bottom:1rem"><div style="width:2.5rem;height:2.5rem;border:1px solid var(--gold-300);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="lucide-${i.icon}" style="color:var(--gold-500)"></i></div><div><p style="font-size:0.875rem;font-weight:500">${i.l}</p><p style="font-size:0.875rem;color:var(--text-muted)">${i.v}</p></div></div>
          `).join('')}
        </div>
        <div>
          <h2 style="font-size:1.25rem;margin-bottom:1.5rem">Send a Message</h2>
          <form onsubmit="handleContact(event)" style="display:flex;flex-direction:column;gap:1rem">
            <input type="text" placeholder="Your Name" class="input-field" required />
            <input type="email" placeholder="Your Email" class="input-field" required />
            <input type="text" placeholder="Subject" class="input-field" required />
            <textarea placeholder="Your Message" rows="5" class="input-field" required></textarea>
            <button type="submit" class="btn-gold"><i class="lucide-send"></i> Send Message</button>
            <div id="contact-msg"></div>
          </form>
        </div>
      </div>
    </div>`;
}

function handleContact(e) {
  e.preventDefault();
  const msg = document.getElementById('contact-msg');
  msg.innerHTML = '<p style="color:#16a34a;font-size:0.875rem">Message sent! We\'ll get back to you soon.</p>';
  e.target.reset();
  setTimeout(() => msg.innerHTML = '', 3000);
}

function renderFAQ() {
  const faqs = [
    ['How do I place an order?','Simply browse our collection, add items to your cart, and proceed to checkout. You can check out as a guest or create an account.'],
    ['What payment methods do you accept?','We accept all major credit/debit cards (VISA, Mastercard, RuPay), UPI payments, Net Banking, and Cash on Delivery.'],
    ['How long does delivery take?','Standard delivery takes 3-5 business days. Express delivery is available for 1-2 business days at an additional cost of ₹100.'],
    ['Do you offer free shipping?','Yes, we offer free standard shipping on all orders above ₹2,000.'],
    ['What is your return policy?','We offer a 7-day easy return policy. Items must be unused and in original packaging. Refunds are processed within 5-7 business days.'],
    ['How do I track my order?','You can track your order by visiting the Track Order page and entering your order number. You\'ll also receive email updates.'],
    ['Are your products handmade?','Yes, all our jewellery is handcrafted by skilled artisans using premium materials.'],
    ['Do you offer warranty?','Yes, all products come with a 6-month warranty against manufacturing defects.'],
    ['Can I modify or cancel my order?','Orders can be modified or cancelled within 2 hours of placing them. Please contact us immediately at care@eleganceofwomen.com.'],
    ['Do you ship internationally?','Currently, we only ship within India. International shipping is coming soon.'],
  ];
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Help Center</p><h1 class="section-title">Frequently Asked Questions</h1></div></div>
    <div class="container section"><div style="max-width:48rem;margin:0 auto">${faqs.map(([q,a],i) => `<div class="faq-item ${i === 0 ? 'open' : ''}"><button onclick="this.parentElement.classList.toggle('open')">${q}<i class="lucide-chevron-down"></i></button><div class="answer">${a}</div></div>`).join('')}</div></div>`;
}

let trackState = { orderNumber: '', order: null, searched: false };

function renderTrackOrder() {
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Order Status</p><h1 class="section-title">Track Your Order</h1></div></div>
    <div class="container section"><div style="max-width:42rem;margin:0 auto">
      <form onsubmit="trackOrder(event)" style="display:flex;gap:0.5rem;margin-bottom:2rem">
        <div style="position:relative;flex:1">
          <i class="lucide-search" style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:var(--ink-400)"></i>
          <input type="text" placeholder="Enter your order number" class="input-field" style="padding-left:2.75rem" value="${trackState.orderNumber}" oninput="trackState.orderNumber=this.value" required />
        </div>
        <button type="submit" class="btn-gold"><i class="lucide-search"></i> Track</button>
      </form>
      <div id="track-results"></div>
    </div></div>`;
}

async function trackOrder(e) {
  e.preventDefault();
  const { data } = await supabase.from('orders').select('*, order_items(*)').eq('order_number', trackState.orderNumber.toUpperCase()).maybeSingle();
  trackState.order = data;
  trackState.searched = true;
  renderTrackResults();
}

function renderTrackResults() {
  const container = document.getElementById('track-results');
  if (!container) return;
  if (!trackState.order) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;border:1px solid var(--border)"><i class="lucide-package" style="font-size:3rem;color:var(--ink-200)"></i><p style="font-size:0.875rem;color:var(--text-muted);margin-top:1rem">No order found with that number. Please check and try again.</p></div>`;
    return;
  }
  const o = trackState.order;
  const steps = ['pending','confirmed','shipped','delivered'];
  const currentStep = steps.indexOf(o.status);
  const progress = currentStep >= 0 ? (currentStep / (steps.length - 1)) * 100 : 0;

  container.innerHTML = `
    <div style="border:1px solid var(--border);padding:1.5rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
        <div><p style="font-size:0.875rem;font-weight:500">Order #${o.order_number}</p><p style="font-size:0.75rem;color:var(--ink-400)">${new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p></div>
        <span style="font-size:0.875rem;font-weight:500;color:var(--gold-500)">${formatPrice(o.total)}</span>
      </div>
      <div style="position:relative;margin-bottom:1.5rem">
        <div style="position:absolute;top:1rem;left:0;right:0;height:2px;background:var(--ink-100)"></div>
        <div style="position:absolute;top:1rem;left:0;height:2px;background:var(--gold-500);width:${progress}%"></div>
        <div style="display:flex;justify-content:space-between;position:relative">
          ${steps.map((s,i) => `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:2rem;height:2rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;background:${i <= currentStep ? 'var(--gold-500)' : 'var(--ink-100)'};color:${i <= currentStep ? 'var(--white)' : 'var(--ink-400)'}">${i < currentStep ? '<i class="lucide-check" style="font-size:0.875rem"></i>' : i+1}</div><span style="font-size:0.75rem;text-transform:capitalize;color:var(--text-muted);margin-top:0.25rem">${s}</span></div>`).join('')}
        </div>
      </div>
      <div>${o.order_items?.map(item => `<div style="display:flex;align-items:center;gap:0.75rem;font-size:0.875rem;margin-bottom:0.5rem"><img src="${item.product_image || ''}" alt="" style="width:3rem;height:3rem;object-fit:cover" /><div style="flex:1"><p>${item.product_name}</p><p style="font-size:0.75rem;color:var(--ink-400)">Qty: ${item.quantity}</p></div><span style="color:var(--gold-500)">${formatPrice(item.price * item.quantity)}</span></div>`).join('')}</div>
      ${o.estimated_delivery ? `<div class="estimated-delivery" style="margin-top:1rem"><i class="lucide-truck" style="color:var(--gold-500)"></i> Estimated Delivery: ${new Date(o.estimated_delivery).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>` : ''}
    </div>`;
}

function renderCategory(slug) {
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Collection</p><h1 class="section-title" id="category-title">${slug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</h1><div class="breadcrumb"><a href="#/" onclick="event.preventDefault();navigate('/')">Home</a><span>/</span><a href="#/shop" onclick="event.preventDefault();navigate('/shop')">Shop</a><span>/</span><span id="category-crumb">${slug}</span></div></div></div>
    <div class="container section"><div id="category-products"></div></div>`;
}

function renderWishlist() {
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Saved Items</p><h1 class="section-title">My Wishlist</h1></div></div>
    <div class="container section"><div id="wishlist-content"></div></div>`;
}

function renderOffers() {
  return `<div style="background:var(--ink-900);color:var(--white);padding:3rem 0" class="page-header-alt">
      <div class="container text-center"><p style="color:var(--gold-400);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:0.75rem">Special Deals</p><h1 class="section-title" style="color:var(--white)">Offers & Discounts</h1><p style="color:var(--ink-300);margin-top:1rem;max-width:36rem;margin-left:auto;margin-right:auto">Save big on our premium jewellery collection. Limited time offers!</p></div>
    </div>
    <div class="container" style="padding-top:2rem">
      <div class="grid-3">
        ${[{code:'WELCOME10',desc:'10% off your first order',bg:'var(--gold-500)'},{code:'LUXURY500',desc:'Flat ₹500 off above ₹5,000',bg:'var(--ink-800)'},{code:'BRIDAL15',desc:'15% off bridal collection',bg:'#16a34a'}].map(c => `<div style="background:${c.bg};color:var(--white);padding:1.5rem;text-align:center"><p style="font-family:var(--font-serif);font-size:1.5rem;margin-bottom:0.25rem">${c.code}</p><p style="font-size:0.875rem;opacity:0.9">${c.desc}</p></div>`).join('')}
      </div>
    </div>
    <div class="container section"><div id="offers-products"></div></div>`;
}

function renderCollections() {
  const collections = [
    {name:'New Arrivals',desc:'The latest additions to our jewellery collection',slug:'new',img:'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=800'},
    {name:'Best Sellers',desc:'Our most loved and popular pieces',slug:'bestseller',img:'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?auto=compress&cs=tinysrgb&w=800'},
    {name:'Bridal Collection',desc:'Complete your wedding day look',slug:'bridal',img:'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=800'},
    {name:'Trending Now',desc:'What everyone is talking about',slug:'trending',img:'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?auto=compress&cs=tinysrgb&w=800'},
  ];
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Curated Selections</p><h1 class="section-title">Our Collections</h1></div></div>
    <div class="container section">
      <div class="grid-2">
        ${collections.map(c => `
          <a href="#/shop?filter=${c.slug}" onclick="event.preventDefault();navigate('/shop?filter=${c.slug}')" style="position:relative;aspect-ratio:16/10;overflow:hidden;display:block;background:var(--ink-100)">
            <img src="${c.img}" alt="${c.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform 0.5s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" />
            <div style="position:absolute;inset:0;background:rgba(14,15,18,0.4);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--white);padding:1.5rem">
              <h2 style="font-size:1.5rem;margin-bottom:0.5rem">${c.name}</h2>
              <p style="font-size:0.875rem;color:var(--ink-200);max-width:24rem">${c.desc}</p>
              <span style="margin-top:1rem;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.2em;color:var(--gold-400);border-bottom:1px solid var(--gold-400);padding-bottom:0.125rem">Explore</span>
            </div>
          </a>
        `).join('')}
      </div>
    </div>`;
}

function renderPolicy(type) {
  const policies = {
    'shipping-policy': { title:'Shipping Policy', content:[
      ['Processing Time','Orders are processed within 24-48 hours of placement. You will receive a confirmation email with tracking details once your order is shipped.'],
      ['Domestic Shipping','We offer free standard shipping on all orders above ₹2,000. Standard delivery takes 3-5 business days. Express delivery (1-2 days) is available for ₹100.'],
      ['Shipping Partners','We partner with trusted courier services including Delhivery, BlueDart, and India Post to ensure safe and timely delivery.'],
      ['Order Tracking','You can track your order anytime using the Track Order feature on our website. Enter your order number to see real-time status.'],
    ]},
    'return-policy': { title:'Return Policy', content:[
      ['7-Day Return Window','We offer a 7-day return policy from the date of delivery. Items must be unused, unworn, and in their original packaging with all tags intact.'],
      ['How to Initiate a Return','Login to your account, go to Orders, select the order and click "Return". Alternatively, email us at care@eleganceofwomen.com with your order number.'],
      ['Refund Processing','Refunds are processed within 5-7 business days after we receive and inspect the returned item. The amount will be credited to your original payment method.'],
      ['Non-Returnable Items','Customized or personalized jewellery, items on clearance sale, and gift cards cannot be returned.'],
    ]},
    'refund-policy': { title:'Refund Policy', content:[
      ['Refund Eligibility','Refunds are issued for returned items that meet our return policy criteria, cancelled orders before shipping, and in cases of damaged or defective products.'],
      ['Refund Timeline','Refunds are processed within 5-7 business days. For card payments, it may take an additional 3-5 days to reflect in your account.'],
      ['Refund Method','Refunds are credited back to the original payment method. For COD orders, refunds are processed via bank transfer or UPI.'],
      ['Partial Refunds','In case of partial returns, the refund will be processed for the returned items only, excluding shipping charges.'],
    ]},
    'privacy-policy': { title:'Privacy Policy', content:[
      ['Information We Collect','We collect information you provide directly to us, such as name, email, phone number, shipping address, and payment information when you place an order or create an account.'],
      ['How We Use Your Information','We use your information to process orders, communicate with you about your orders, provide customer support, and send promotional emails (with your consent).'],
      ['Data Security','We use industry-standard encryption and security measures to protect your personal information. Payment details are processed through secure payment gateways and are not stored on our servers.'],
      ['Third-Party Sharing','We do not sell or rent your personal information. We may share data with trusted partners for order fulfillment, payment processing, and analytics purposes only.'],
    ]},
    'terms': { title:'Terms & Conditions', content:[
      ['Acceptance of Terms','By accessing and using this website, you accept and agree to be bound by these Terms & Conditions. If you do not agree, please do not use our website.'],
      ['Product Information','We strive to display product images and descriptions accurately. However, actual colours may vary due to monitor settings. Product weights and dimensions are approximate.'],
      ['Pricing','All prices are listed in Indian Rupees (₹) and include applicable taxes. We reserve the right to change prices without notice. Orders are subject to availability.'],
      ['Limitation of Liability','Elegance of Women shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or website.'],
    ]},
  };
  const p = policies[type] || policies['terms'];
  return `<div class="page-header"><div class="container text-center"><p class="section-subtitle">Legal</p><h1 class="section-title">${p.title}</h1></div></div>
    <div class="container section"><div style="max-width:48rem;margin:0 auto">
      ${p.content.map(([h,t]) => `<div style="margin-bottom:1.5rem"><h2 style="font-size:1.125rem;margin-bottom:0.5rem">${h}</h2><p style="font-size:0.875rem;color:var(--text-muted);line-height:1.6">${t}</p></div>`).join('')}
      <p style="font-size:0.75rem;color:var(--ink-400);padding-top:1rem;border-top:1px solid var(--border)">Last updated: ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
    </div></div>`;
}

function render404() {
  return `<div class="container empty-state"><h1 style="font-size:3rem">404</h1><p style="color:var(--text-muted)">Page not found</p><button class="btn-gold" style="margin-top:1rem" onclick="navigate('/')">Back to Home</button></div>`;
}

// ============================================
// Data Loading
// ============================================
async function loadPageData(route) {
  const path = route.path;

  if (path === '/' || path === '') {
    const [newRes, bestRes, bridalRes, trendingRes, catRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(*), product_images(*)').eq('is_new', true).eq('is_active', true).limit(4),
      supabase.from('products').select('*, category:categories(*), product_images(*)').eq('is_best_seller', true).eq('is_active', true).limit(8),
      supabase.from('products').select('*, category:categories(*), product_images(*)').eq('is_bridal', true).eq('is_active', true).limit(4),
      supabase.from('products').select('*, category:categories(*), product_images(*)').eq('is_trending', true).eq('is_active', true).limit(4),
      supabase.from('categories').select('*').order('sort_order'),
    ]);

    const catGrid = document.getElementById('home-categories');
    if (catGrid) {
      const cats = catRes.data || [];
      const fallbackImages = ['https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=600','https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?auto=compress&cs=tinysrgb&w=600'];
      catGrid.innerHTML = cats.slice(0,10).map((c,i) => `
        <a href="${c.slug === 'new-arrivals' ? '#/shop?filter=new' : '#/category/' + c.slug}" onclick="event.preventDefault();navigate('${c.slug === 'new-arrivals' ? '/shop?filter=new' : '/category/' + c.slug}')" class="category-card">
          <img src="${c.image_url || fallbackImages[i % 2]}" alt="${c.name}" loading="lazy" />
          <div class="overlay"></div>
          <div class="label">${c.name}</div>
        </a>
      `).join('');
    }

    const newGrid = document.getElementById('new-arrivals-grid');
    if (newGrid) newGrid.innerHTML = (newRes.data || []).map(p => productCardHTML(p)).join('');

    const bestGrid = document.getElementById('best-sellers-grid');
    if (bestGrid) bestGrid.innerHTML = (bestRes.data || []).slice(0,4).map(p => productCardHTML(p)).join('');

    const bridalGrid = document.getElementById('bridal-grid');
    if (bridalGrid) bridalGrid.innerHTML = (bridalRes.data || []).map(p => `
      <a href="#/product/${p.slug}" onclick="event.preventDefault();navigate('/product/${p.slug}')" class="bridal-card">
        <div class="img-wrap"><img src="${getFirstImage(p)}" alt="${p.name}" loading="lazy" /><div class="img-overlay"></div><div class="img-info"><h3>${p.name}</h3><p>${formatPrice(p.price)}</p></div></div>
      </a>
    `).join('');

    const trendingGrid = document.getElementById('trending-grid');
    if (trendingGrid) trendingGrid.innerHTML = (trendingRes.data || []).map(p => productCardHTML(p)).join('');
  }

  else if (path === '/shop') {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(*), product_images(*)').eq('is_active', true),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    shopState.products = prodRes.data || [];
    shopState.categories = catRes.data || [];
    shopState.loading = false;

    const filterParam = route.query.filter;
    if (filterParam === 'new') shopState.newOnly = true;
    if (filterParam === 'bestseller') shopState.bestSellerOnly = true;
    if (filterParam === 'bridal') shopState.selectedCategories = ['bridal-jewellery'];
    if (filterParam === 'trending') shopState.sortBy = 'best-selling';

    const catFilter = document.getElementById('filter-categories');
    if (catFilter) catFilter.innerHTML = shopState.categories.map(c => `<label><input type="checkbox" ${shopState.selectedCategories.includes(c.slug) ? 'checked' : ''} onchange="toggleArrayFilter('selectedCategories','${c.slug}')" /> ${c.name}</label>`).join('');

    const colours = [...new Set(shopState.products.map(p => p.colour).filter(Boolean))];
    const colourFilter = document.getElementById('filter-colours');
    if (colourFilter) colourFilter.innerHTML = colours.map(c => `<label><input type="checkbox" ${shopState.selectedColours.includes(c) ? 'checked' : ''} onchange="toggleArrayFilter('selectedColours','${c}')" /> ${c}</label>`).join('');

    const materials = [...new Set(shopState.products.map(p => p.material).filter(Boolean))];
    const matFilter = document.getElementById('filter-materials');
    if (matFilter) matFilter.innerHTML = materials.map(m => `<label><input type="checkbox" ${shopState.selectedMaterials.includes(m) ? 'checked' : ''} onchange="toggleArrayFilter('selectedMaterials','${m}')" /> ${m}</label>`).join('');

    filterProducts();
  }

  else if (path.startsWith('/product/')) {
    const slug = path.replace('/product/', '');
    const { data: prod } = await supabase.from('products').select('*, category:categories(*), product_images(*)').eq('slug', slug).maybeSingle();
    if (prod) {
      productPageState.product = prod;
      addRecentlyViewed(prod);
      const { data: revData } = await supabase.from('reviews').select('*').eq('product_id', prod.id).order('created_at', { ascending: false });
      productPageState.reviews = revData || [];
      if (prod.category_id) {
        const { data: relData } = await supabase.from('products').select('*, category:categories(*), product_images(*)').eq('category_id', prod.category_id).neq('id', prod.id).limit(4);
        productPageState.related = relData || [];
      }
    }
    productPageState.loading = false;

    const breadcrumb = document.getElementById('product-breadcrumb');
    if (breadcrumb && prod) breadcrumb.innerHTML = `<a href="#/" onclick="event.preventDefault();navigate('/')">Home</a><span>/</span><a href="#/shop" onclick="event.preventDefault();navigate('/shop')">Shop</a><span>/</span><span>${prod.name}</span>`;

    const content = document.getElementById('product-detail-content');
    if (content) {
      if (productPageState.product) {
        content.innerHTML = renderProductDetail(productPageState.product, productPageState.reviews, productPageState.related);
        const tabContent = document.getElementById('tab-content');
        if (tabContent) tabContent.innerHTML = renderTabContent(productPageState.product, productPageState.reviews);
      } else {
        content.innerHTML = `<div class="empty-state"><p style="font-size:1.125rem;color:var(--text-muted)">Product not found.</p><button class="btn-gold" onclick="navigate('/shop')">Back to Shop</button></div>`;
      }
    }
  }

  else if (path === '/checkout') {
    if (state.user) {
      const { data: addrData } = await supabase.from('addresses').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false });
      checkoutState.addresses = addrData || [];
      if (checkoutState.addresses.length > 0) {
        checkoutState.selectedAddressId = checkoutState.addresses[0].id;
        checkoutState.showNewAddress = false;
        const sec = document.getElementById('checkout-address-section');
        if (sec) sec.innerHTML = renderCheckoutAddressSection();
      }
    }
  }

  else if (path === '/account') {
    if (state.user) {
      const [ordersRes, addrRes, profRes] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').eq('user_id', state.user.id).order('created_at', { ascending: false }),
        supabase.from('addresses').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('user_id', state.user.id).maybeSingle(),
      ]);
      accountState.orders = ordersRes.data || [];
      accountState.addresses = addrRes.data || [];
      accountState.profile = profRes.data || null;
      const content = document.getElementById('account-content');
      if (content) content.innerHTML = renderAccountContent();
    }
  }

  else if (path.startsWith('/category/')) {
    const slug = path.replace('/category/', '');
    const { data: cat } = await supabase.from('categories').select('*').eq('slug', slug).maybeSingle();
    if (cat) {
      const { data: prods } = await supabase.from('products').select('*, category:categories(*), product_images(*)').eq('category_id', cat.id).eq('is_active', true);
      const titleEl = document.getElementById('category-title');
      if (titleEl) titleEl.textContent = cat.name;
      const crumb = document.getElementById('category-crumb');
      if (crumb) crumb.textContent = cat.name;
      const grid = document.getElementById('category-products');
      if (grid) {
        if (!prods || prods.length === 0) {
          grid.innerHTML = `<div class="empty-state"><p style="color:var(--text-muted)">No products in this category yet.</p><button class="btn-gold" onclick="navigate('/shop')">Browse All Products</button></div>`;
        } else {
          grid.innerHTML = `<div class="product-grid">${prods.map(p => productCardHTML(p)).join('')}</div>`;
        }
      }
    }
  }

  else if (path === '/wishlist') {
    const content = document.getElementById('wishlist-content');
    if (content) {
      if (state.wishlist.length === 0) {
        content.innerHTML = `<div class="empty-state"><i class="lucide-heart"></i><h2>Your wishlist is empty.</h2><p>Save your favourite pieces here for later.</p><button class="btn-gold" onclick="navigate('/shop')">Discover Jewellery</button></div>`;
      } else {
        content.innerHTML = `<div class="product-grid">${state.wishlist.map(w => w.product ? productCardHTML(w.product) : '').join('')}</div>`;
      }
    }
  }

  else if (path === '/offers') {
    const { data } = await supabase.from('products').select('*, category:categories(*), product_images(*)').not('compare_at_price', 'is', null).eq('is_active', true);
    const grid = document.getElementById('offers-products');
    if (grid) grid.innerHTML = `<div class="product-grid">${(data || []).map(p => productCardHTML(p)).join('')}</div>`;
  }
}

function toggleArrayFilter(arrName, value) {
  const arr = shopState[arrName];
  if (arr.includes(value)) shopState[arrName] = arr.filter(v => v !== value);
  else shopState[arrName] = [...arr, value];
  filterProducts();
}

// ============================================
// Search
// ============================================
let searchTimer;
const SEARCH_CATEGORY_MAP = {
  bridal: { filter: { is_bridal: true }, label: 'Bridal Collection' },
  trending: { filter: { is_trending: true }, label: 'Trending Jewellery' },
  necklace: { catSlug: 'necklaces', label: 'Necklaces' },
  necklaces: { catSlug: 'necklaces', label: 'Necklaces' },
  earrings: { catSlug: 'earrings', label: 'Earrings' },
  rings: { catSlug: 'rings', label: 'Rings' },
  bangles: { catSlug: 'bangles', label: 'Bangles' },
  bracelet: { catSlug: 'bracelets', label: 'Bracelets' },
};

async function handleSearch(query) {
  clearTimeout(searchTimer);
  const results = document.getElementById('search-results');
  if (!results) return;
  if (query.length < 2) { results.innerHTML = ''; return; }
  searchTimer = setTimeout(async () => {
    const q = query.trim();
    const lower = q.toLowerCase();
    const catMatch = SEARCH_CATEGORY_MAP[lower];
    let data = [];
    if (catMatch) {
      let q = supabase.from('products').select('*, category:categories(*), product_images(*)').eq('is_active', true);
      if (catMatch.filter) q = q.match(catMatch.filter);
      if (catMatch.catSlug) q = q.eq('category.slug', catMatch.catSlug);
      const { data: d } = await q.order('sort_order').limit(8);
      data = d || [];
      if (data.length) {
        results.innerHTML = `<p style="font-size:0.75rem;color:var(--gold-500);padding:0.5rem 0.25rem;text-transform:uppercase;letter-spacing:0.05rem">${catMatch.label}</p>` + data.map(p => `
          <div class="search-result-item" onclick="navigate('/product/${p.slug}');state.searchOpen=false;render()">
            <img src="${getFirstImage(p)}" alt="${p.name}" />
            <div><div class="name">${p.name}</div><div class="price">${formatPrice(p.price)}</div></div>
          </div>
        `).join('');
        return;
      }
    }
    const { data: nameData } = await supabase.from('products').select('*, product_images(*)').eq('is_active', true).ilike('name', `%${q}%`).limit(5);
    data = nameData || [];
    if (data.length === 0) {
      results.innerHTML = `<div style="padding:1rem 0.5rem;text-align:center"><i class="lucide-search-x" style="font-size:1.5rem;color:var(--ink-300);display:block;margin-bottom:0.5rem"></i><p style="font-size:0.875rem;color:var(--text-muted)">No results found for "${q}"</p><p style="font-size:0.75rem;color:var(--ink-300);margin-top:0.25rem">Try: necklace, earrings, rings, bangles, bridal, trending</p></div>`;
    } else {
      results.innerHTML = data.map(p => `
        <div class="search-result-item" onclick="navigate('/product/${p.slug}');state.searchOpen=false;render()">
          <img src="${getFirstImage(p)}" alt="${p.name}" />
          <div><div class="name">${p.name}</div><div class="price">${formatPrice(p.price)}</div></div>
        </div>
      `).join('');
    }
  }, 300);
}

// ============================================
// Newsletter
// ============================================
function handleSubscribe(e) {
  e.preventDefault();
  const msg = document.getElementById('newsletter-msg');
  if (msg) msg.innerHTML = '<p style="color:var(--gold-400);font-size:0.875rem;margin-top:0.75rem">Thank you for subscribing!</p>';
  e.target.reset();
  setTimeout(() => { if (msg) msg.innerHTML = ''; }, 3000);
}

// ============================================
// Chatbot Logic
// ============================================
let chatbotMessages = [{ role: 'bot', text: "Welcome to Elegance of Women! I'm your virtual assistant. How can I help you today?" }];

const botResponses = [
  { keywords: ['hello','hi','hey','greetings'], reply: 'Hello! Welcome to Elegance of Women. How can I help you today? You can ask about our products, shipping, returns, or any other questions.' },
  { keywords: ['shipping','delivery','ship'], reply: 'We offer free shipping on all orders above ₹2,000. Standard delivery takes 3-5 business days. Express delivery is available for ₹100 extra (1-2 days). You can track your order from the Track Order page.' },
  { keywords: ['return','refund','exchange'], reply: 'We offer a 7-day easy return policy. Items must be unused and in original packaging. Refunds are processed within 5-7 business days. Please visit our Return Policy page for details.' },
  { keywords: ['payment','pay','card','upi','cod'], reply: 'We accept all major credit/debit cards (VISA, Mastercard, RuPay), UPI payments (Google Pay, PhonePe, Paytm), Net Banking, and Cash on Delivery. All payments are secure and encrypted.' },
  { keywords: ['bridal','wedding'], reply: 'Our Bridal Collection features exquisite Kundan and pearl sets, including necklace sets, bangles, earrings, and maang tikkas. Visit the Bridal Collection under Collections to explore our full range!' },
  { keywords: ['price','cost','how much'], reply: 'Our prices range from ₹999 to ₹19,999. We offer regular discounts and have a dedicated Offers section. Use code WELCOME10 for 10% off your first order!' },
  { keywords: ['coupon','discount','offer'], reply: 'We have several active offers:\n• WELCOME10 - 10% off your first order\n• LUXURY500 - Flat ₹500 off on orders above ₹5,000\n• BRIDAL15 - 15% off bridal collection' },
  { keywords: ['size','measurement'], reply: 'Most of our rings are adjustable. For bangles, please check the size chart on each product page. If you need help with sizing, feel free to contact us at care@eleganceofwomen.com.' },
  { keywords: ['track','order status','where is my order'], reply: "You can track your order by visiting the Track Order page and entering your order number. You'll also receive email updates at each stage of delivery." },
  { keywords: ['contact','support','help','email','phone'], reply: 'You can reach us at:\n• Email: care@eleganceofwomen.com\n• Phone: +91 98765 43210\n• Hours: 9 AM - 8 PM IST, Mon-Sat\nOr fill out the Contact form on our website.' },
  { keywords: ['quality','material','gold','silver'], reply: 'All our jewellery is crafted with premium materials including gold-plated brass, silver, Kundan stones, and genuine pearls. Each piece undergoes quality checks before shipping.' },
  { keywords: ['whatsapp'], reply: 'You can also chat with us on WhatsApp at +91 98765 43210 during business hours (9 AM - 8 PM IST, Mon-Sat).' },
];

function getBotResponse(input) {
  const lower = input.toLowerCase();
  for (const item of botResponses) {
    if (item.keywords.some(kw => lower.includes(kw))) return item.reply;
  }
  return "I'm sorry, I didn't quite understand that. You can ask me about shipping, returns, payments, bridal collection, offers, or contact details. For complex queries, please email us at care@eleganceofwomen.com.";
}

function renderChatbotMessages() {
  const container = document.getElementById('chatbot-messages');
  if (!container) return;
  container.innerHTML = chatbotMessages.map(m => `<div class="chat-msg ${m.role}">${m.text.replace(/\n/g,'<br/>')}</div>`).join('');
  container.scrollTop = container.scrollHeight;
}

function sendChatMsg() {
  const input = document.getElementById('chatbot-input-field');
  const text = input.value.trim();
  if (!text) return;
  chatbotMessages.push({ role: 'user', text });
  input.value = '';
  renderChatbotMessages();

  const typingEl = document.createElement('div');
  typingEl.className = 'chat-typing';
  typingEl.id = 'chat-typing';
  typingEl.innerHTML = '<span></span><span></span><span></span>';
  document.getElementById('chatbot-messages').appendChild(typingEl);

  setTimeout(() => {
    typingEl.remove();
    chatbotMessages.push({ role: 'bot', text: getBotResponse(text) });
    renderChatbotMessages();
  }, 800);
}

function sendQuickMsg(msg) {
  document.getElementById('chatbot-input-field').value = msg;
  sendChatMsg();
}

// ============================================
// Event Listeners
// ============================================
function attachEventListeners() {
  // Scroll effect on navbar + scroll-to-top button
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
      if (window.scrollY > 20) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    }
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    if (scrollTopBtn) {
      if (window.scrollY > 500) scrollTopBtn.classList.add('show');
      else scrollTopBtn.classList.remove('show');
    }
  }, { passive: true });

  // Start hero auto-slider if on homepage
  if (getRoute().path === '/' || getRoute().path === '') startHeroAutoSlide();

  // AI page initializations
  const path = getRoute().path;
  if (path === '/virtual-try-on') initVirtualTryOn();
  else if (path === '/exchange-jewellery') initExchangeJewellery();
  else if (path === '/design-jewellery') initDesignJewellery();
  else if (path === '/surprise-gifts') initSurpriseGifts();
  else if (path === '/trending') initTrendingPage();

  // Show logo text on larger screens
  const logoText = document.getElementById('logo-text');
  if (logoText) {
    if (window.innerWidth >= 640) logoText.style.display = 'block';
    else logoText.style.display = 'none';
  }

  // Data-action buttons
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = el.dataset.action;
      if (action === 'toggle-search') { state.searchOpen = !state.searchOpen; render(); }
      else if (action === 'toggle-dark') toggleDarkMode();
      else if (action === 'open-mobile-menu') { state.mobileMenuOpen = true; render(); }
      else if (action === 'close-mobile-menu') closeMobileMenu();
      else if (action === 'open-filters') document.getElementById('shop-sidebar').classList.add('mobile-open');
      else if (action === 'toggle-chatbot') { state.chatbotOpen = !state.chatbotOpen; render(); }
      else if (action === 'toggle-account-menu') {
        const dd = document.getElementById('account-dropdown');
        if (dd) dd.classList.toggle('open');
      }
      else if (action === 'toggle-notifications') {
        showNotif('No new notifications. Check back later!');
      }
    });
  });

  // Render chatbot messages if open
  if (state.chatbotOpen) renderChatbotMessages();

  // Render track results if searched
  if (getRoute().path === '/track-order' && trackState.searched) renderTrackResults();

  // Render account content
  if (getRoute().path === '/account' && state.user) {
    const content = document.getElementById('account-content');
    if (content) content.innerHTML = renderAccountContent();
  }
}

// ============================================
// Init
// ============================================
async function init() {
  if (state.darkMode) document.documentElement.setAttribute('data-theme', 'dark');
  await initAuth();
  await loadUserData();
  // Load brand logo + hero banners so they're available on first render
  await Promise.all([loadBrandLogo(), loadHeroBanners()]);
  render();
}

async function loadBrandLogo() {
  const { data } = await supabase.from('brand_settings').select('value').eq('key', 'logo').maybeSingle();
  if (data?.value) state.brandLogo = data.value;
}

async function loadHeroBanners() {
  const { data } = await supabase.from('banners').select('*').eq('is_active', true).order('sort_order');
  state.heroBanners = data || [];
}

init();

// ============================================
// Expose functions to global scope (required for inline onclick handlers in ES modules)
// ============================================
window.navigate = navigate;
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.toggleWishlist = toggleWishlist;
window.quickView = quickView;
window.sendChatMsg = sendChatMsg;
window.sendQuickMsg = sendQuickMsg;
window.handleSearch = handleSearch;
window.handleSubscribe = handleSubscribe;
window.handleContact = handleContact;
window.filterProducts = filterProducts;
window.clearFilters = clearFilters;
window.closeFilters = closeFilters;
window.toggleArrayFilter = toggleArrayFilter;
window.applyCoupon = applyCoupon;
window.placeOrder = placeOrder;
window.handleAuth = handleAuth;
window.handleForgotPassword = handleForgotPassword;
window.signInWithGoogle = signInWithGoogle;
window.saveAddress = saveAddress;
window.deleteAddress = deleteAddress;
window.submitReview = submitReview;
window.trackOrder = trackOrder;
window.buyNow = buyNow;
window.shareProduct = shareProduct;
window.signOut = signOut;
window.closeMobileMenu = closeMobileMenu;
window.render = render;
window.productPageState = productPageState;
window.shopState = shopState;
window.loginState = loginState;
window.checkoutState = checkoutState;
window.accountState = accountState;
window.trackState = trackState;
window.cartPageState = cartPageState;
window.state = state;
Object.defineProperty(window, 'reviewRating', {
  get: () => reviewRating,
  set: (v) => { reviewRating = v; },
});

// ── Admin functions exposed to window ──
window.adminNavigate = adminNavigate;
window.startProductEdit = startProductEdit;
window.cancelProductEdit = cancelProductEdit;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.uploadProductImages = uploadProductImages;
window.removeProductImage = removeProductImage;
window.startCategoryEdit = startCategoryEdit;
window.cancelCategoryEdit = cancelCategoryEdit;
window.uploadCategoryImage = uploadCategoryImage;
window.saveCategory = saveCategory;
window.startBannerEdit = startBannerEdit;
window.cancelBannerEdit = cancelBannerEdit;
window.uploadBannerImage = uploadBannerImage;
window.saveBanner = saveBanner;
window.deleteBanner = deleteBanner;
window.toggleBannerActive = toggleBannerActive;
window.uploadBrandAsset = uploadBrandAsset;
window.deleteBrandAsset = deleteBrandAsset;
window.uploadImageManagerFiles = uploadImageManagerFiles;
window.deleteImageFile = deleteImageFile;
window.copyImageUrl = copyImageUrl;
window.replaceImage = replaceImage;
window.filterImageBucket = filterImageBucket;
window.searchImages = searchImages;
window.updateFolderOptions = updateFolderOptions;

// ── AI feature functions exposed to window ──
window.runAIRecommendation = runAIRecommendation;
window.openCamera = openCamera;
window.initVirtualTryOn = initVirtualTryOn;
window.selectTryOnType = selectTryOnType;
window.selectTryOnProduct = selectTryOnProduct;
window.tryOnZoom = tryOnZoom;
window.tryOnRotate = tryOnRotate;
window.saveTryOn = saveTryOn;
window.downloadTryOn = downloadTryOn;
window.runGiftPlanner = runGiftPlanner;
window.runCoupleMatch = runCoupleMatch;
window.initExchangeJewellery = initExchangeJewellery;
window.runExchangeValuation = runExchangeValuation;
window.initDesignJewellery = initDesignJewellery;
window.clearCanvas = clearCanvas;
window.changeCanvasColor = changeCanvasColor;
window.setCanvasBrush = setCanvasBrush;
window.submitCustomDesign = submitCustomDesign;
window.initSurpriseGifts = initSurpriseGifts;
window.submitGiftOrder = submitGiftOrder;
window.initTrendingPage = initTrendingPage;
window.filterTrending = filterTrending;
window.viewRecHistory = viewRecHistory;
window.scrollToTop = scrollToTop;
