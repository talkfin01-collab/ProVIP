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

// دالة تنقل ذكية تنتظر فك حظر Cloudflare
async function safeNavigate(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  let title = await page.title();
  let retries = 0;

  while ((title.includes('Just a moment') || title.includes('Cloudflare') || title.includes('Attention Required')) && retries < 10) {
    console.log(`⏳ انتظار حل فحص Cloudflare تلقائياً (محاولة ${retries + 1}/10)...`);
    await new Promise(r => setTimeout(r, 3000));
    title = await page.title();
    retries++;
  }
  return title;
}

async function run() {
  console.log('🚀 [v6 - Session Warmup & Unified Browser] بدء التشغيل...');

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

  // 1. مرحلة تهيئة الجلسة وحصد الكوكيز من الصفحة الرئيسية أولاً
  console.log('🔑 تهيئة الجلسة والحصول على ترخيص Cloudflare عبر الصفحة الرئيسية...');
  const rootTitle = await safeNavigate(pageTab, `${PRIMARY_DOMAIN}/`);
  console.log(`🌐 تم تأكيد الجلسة بنجاح: "${rootTitle}"`);

  // 2. التوجه مباشرة إلى القسم والصفحة المطلوبة
  console.log(`🎯 الانتقال للهدف: ${targetUrl} (قسم: ${target.category} | صفحة: ${page})`);
  const targetTitle = await safeNavigate(pageTab, targetUrl);
  console.log(`📄 عنوان صفحة القسم: "${targetTitle}"`);

  // 3. استخراج عناصر الصفحة
  const rawItems = await pageTab.evaluate(() => {
    const list = [];
    document.querySelectorAll('.Thumb--GridItem').forEach(el => {
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

  const uniqueMap = new Map();
  for (const it of rawItems) {
    if (!uniqueMap.has(it.path)) uniqueMap.set(it.path, it);
  }
  const items = Array.from(uniqueMap.values());

  console.log(`📦 العناصر الفريدة المستخرجة: ${items.length} عنصر.`);

  // 4. معالجة عناصر الصفحة واستخراج السيرفرات
  for (const item of items.slice(0, 8)) {
    try {
      console.log(`🔍 جلب تفاصيل: ${item.title}`);
      const detailUrl = `${PRIMARY_DOMAIN}${item.path}`;
      await safeNavigate(pageTab, detailUrl);

      // نقر تبويب المشاهدة إن وجد لتفعيل السيرفرات في الـ DOM
      await pageTab.evaluate(() => {
        const watchBtn = document.querySelector('.Watch--Btn, .btn--watch, a[href*="#watch"], [data-tab="watch"]');
        if (watchBtn) watchBtn.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      const pageData = await pageTab.evaluate(() => {
        const servers = [];
        const selectors = [
          'ul#watch li',
          'ul.WatchServersList li',
          '.servers--list li',
          '.Watch--Servers--List li',
          'ul.List--Download--Wecima--Single li a',
          '[data-watch]',
          '[data-url]'
        ];

        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const url = el.getAttribute('data-watch') || el.getAttribute('data-url') || el.getAttribute('href');
            const name = el.innerText.trim() || el.getAttribute('title') || 'سيرفر';
            if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
              servers.push({ name, url });
            }
          });
        });

        document.querySelectorAll('iframe').forEach(iframe => {
          const src = iframe.getAttribute('src') || iframe.getAttribute('data-src');
          if (src && !src.includes('google') && !src.includes('ad')) {
            servers.push({ name: 'مشغل مدمج', url: src });
          }
        });

        return { servers };
      });

      const uniqueServers = [];
      const seenUrls = new Set();
      for (const s of pageData.servers) {
        if (!seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          uniqueServers.push(s);
        }
      }

      console.log(`📡 عدد السيرفرات لـ (${item.title}): ${uniqueServers.length}`);
      const primaryStreamUrl = uniqueServers[0]?.url || detailUrl;

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
          extra_data: { servers: uniqueServers },
          updated_at: new Date().toISOString()
        }])
      });

      console.log(`✅ تم الحفظ في Supabase: ${item.title}`);
    } catch (err) {
      console.log(`⚠️ تخطي ${item.title}: ${err.message}`);
    }
  }

  await browser.close();

  // تحديث المؤشر للصفحة القادمة
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
