const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const PRIMARY_DOMAIN = 'https://mycima.bike';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgxxpdmahcupysrgrhwt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CATEGORY_ORDER = [
  { path: '/', category: 'latest', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/', category: 'movies_english', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%b9%d8%b1%d8%a8%d9%8a/', category: 'movies_arabic', type: 'movie' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/', category: 'series_english', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%b9%d8%b1%d8%a8%d9%8a/', category: 'series_arabic', type: 'series' }
];

async function db(endpoint, options = {}) {
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${endpoint}`;
  const headers = Object.assign({
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }, options.headers || {});

  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DB Error (${res.status}): ${txt}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function run() {
  console.log('🚀 [v3 - حفظ مباشر وفحص السيرفرات] بدء التشغيل...');

  let state = (await db('scraper_state?id=eq.1&select=*'))?.[0];
  if (!state) {
    const defaultState = [{ id: 1, target_index: 0, current_page: 1, initial_archive_done: 0 }];
    await db('scraper_state', { method: 'POST', body: JSON.stringify(defaultState) });
    state = defaultState[0];
  }

  let targetIndex = state.target_index % CATEGORY_ORDER.length;
  let page = state.current_page;
  const target = CATEGORY_ORDER[targetIndex];

  const targetUrl = target.path === '/' 
    ? (page === 1 ? `${PRIMARY_DOMAIN}/` : `${PRIMARY_DOMAIN}/page/${page}/`)
    : `${PRIMARY_DOMAIN}${target.path}`.replace(/\/+$/, '') + (page === 1 ? '/' : `/page/${page}/`);

  console.log(`🌐 الرابط المستهدف: ${targetUrl} (قسم: ${target.category} | صفحة: ${page})`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  const pageTab = await browser.newPage();
  await pageTab.setViewport({ width: 1920, height: 1080 });
  await pageTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

  await pageTab.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await pageTab.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  let title = await pageTab.title();
  let retries = 0;
  while ((title.includes('Just a moment') || title.includes('Cloudflare') || title.includes('Attention Required')) && retries < 8) {
    console.log(`⏳ جاري تخطي Cloudflare... (محاولة ${retries + 1}/8)`);
    await new Promise(r => setTimeout(r, 4000));
    title = await pageTab.title();
  }

  // استخراج البطاقات بدون تكرار
  const rawItems = await pageTab.evaluate(() => {
    const list = [];
    const elements = document.querySelectorAll('.Thumb--GridItem');

    elements.forEach(el => {
      const linkEl = el.querySelector('a');
      if (!linkEl) return;
      const rawHref = linkEl.getAttribute('href') || '';
      const path = rawHref.replace(/^https?:\/\/[^\/]+/, '');
      if (!path || path.startsWith('/category/') || path.startsWith('/tag/') || path === '/') return;

      const titleEl = el.querySelector('strong, .title, h2');
      const title = titleEl ? titleEl.innerText.trim() : (linkEl.getAttribute('title') || '');
      if (!title) return;

      const style = el.getAttribute('style') || '';
      const posterMatch = style.match(/--image:\s*url\(([^)]+)\)/i) || style.match(/src=["']([^"']+)["']/i);
      const img = el.querySelector('img');
      const poster = posterMatch ? posterMatch[1].replace(/['"]/g, '') : (img ? (img.getAttribute('data-src') || img.src) : '');

      const yearMatch = el.innerText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
      const isSeries = path.includes('مسلسل') || path.includes('حلقة');

      list.push({ path, title, poster, year, isSeries });
    });
    return list;
  });

  // تصفية العناصر المكررة حسب المسار (path)
  const uniqueMap = new Map();
  for (const it of rawItems) {
    if (!uniqueMap.has(it.path)) uniqueMap.set(it.path, it);
  }
  const items = Array.from(uniqueMap.values());

  console.log(`📦 العناصر الفريدة المستخرجة: ${items.length} عنصر.`);

  // معالجة أول 10 عناصر
  for (const item of items.slice(0, 10)) {
    try {
      console.log(`🔍 جلب صفحة: ${item.title}`);
      const detailTab = await browser.newPage();
      await detailTab.goto(`${PRIMARY_DOMAIN}${item.path}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await new Promise(r => setTimeout(r, 2500));

      const pageData = await detailTab.evaluate(() => {
        const servers = [];
        
        // 1. فحص قوائم المشاهدة المعتادة
        document.querySelectorAll('ul#watch li, ul.WatchServersList li, .servers--list li').forEach(li => {
          const url = li.getAttribute('data-watch') || li.getAttribute('data-url') || li.querySelector('a')?.getAttribute('href');
          const name = li.innerText.trim() || 'سيرفر';
          if (url && !url.startsWith('#')) servers.push({ name, url });
        });

        // 2. فحص أزرار المشاهدة المباشرة
        if (servers.length === 0) {
          document.querySelectorAll('a.btn--watch, a[href*="/watch/"]').forEach(a => {
            const url = a.getAttribute('href');
            if (url) servers.push({ name: 'مشاهدة مباشرة', url });
          });
        }

        // 3. استخراج أسماء الأزرار المتاحة في حال عدم وجود سيرفرات لتشخيص الهيكل
        const sampleButtons = Array.from(document.querySelectorAll('a, button, ul li'))
          .map(e => e.innerText.trim())
          .filter(t => t.includes('سيرفر') || t.includes('مشاهدة') || t.includes('تحميل'))
          .slice(0, 5);

        return { servers, sampleButtons };
      });

      await detailTab.close();

      console.log(`📡 عدد السيرفرات المكتشفة لـ (${item.title}): ${pageData.servers.length}`);
      if (pageData.servers.length === 0 && pageData.sampleButtons.length > 0) {
        console.log(`ℹ️ أزرار المشاهدة المتوفرة في الصفحة: ${pageData.sampleButtons.join(' | ')}`);
      }

      // حفظ المحتوى في Supabase
      const primaryStreamUrl = pageData.servers[0]?.url || `${PRIMARY_DOMAIN}${item.path}`;
      
      await db('contents?on_conflict=page_url', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify([{
          title: item.title,
          type: item.isSeries ? 'series' : 'movie',
          category: target.category,
          year: item.year,
          poster_url: item.poster,
          stream_url: primaryStreamUrl,
          page_url: item.path,
          extra_data: { servers: pageData.servers },
          updated_at: new Date().toISOString()
        }])
      });

      console.log(`✅ تم الحفظ في قاعدة البيانات: ${item.title}`);

    } catch (err) {
      console.log(`⚠️ تخطي ${item.title}: ${err.message}`);
    }
  }

  await browser.close();

  // الانتقال للصفحة التالية
  let nextIndex = targetIndex;
  let nextPage = page + 1;
  if (items.length === 0 || page >= 30) {
    nextPage = 1;
    nextIndex = (targetIndex + 1) % CATEGORY_ORDER.length;
  }

  await db('scraper_state?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({ target_index: nextIndex, current_page: nextPage })
  });

  console.log(`🎉 اكتملت الدورة. الانتقال القادم: قسم ${nextIndex} صفحة ${nextPage}`);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
