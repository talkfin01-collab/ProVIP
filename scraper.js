const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// احتواء أخطاء إغلاق النوافذ المفاجئة من قِبل إعلانات الموقع
process.on('unhandledRejection', (reason) => {
  if (reason && reason.message && reason.message.includes('Target closed')) return;
  console.log('⚠️ [تحذير تم احتواؤه]:', reason?.message || reason);
});

const PRIMARY_DOMAIN = 'https://mycima.bike';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgxxpdmahcupysrgrhwt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// القائمة الكاملة لأقسام وتصنيفات الموقع (18 قسماً)
const CATEGORY_ORDER = [
  { path: '/', category: 'latest', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/', category: 'movies_english', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%b9%d8%b1%d8%a8%d9%8a/', category: 'movies_arabic', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d9%87%d9%86%d8%af%d9%8a/', category: 'movies_indian', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%aa%d8%b1%d9%83%d9%8a%d8%a9/', category: 'movies_turkish', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d8%b3%d9%8a%d9%88%d9%8a%d8%a9/', category: 'movies_asian', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d9%86%d9%85%d9%8a/', category: 'movies_anime', type: 'movie' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%b1%d9%85%d8%b6%d8%a7%d9%86-2026/', category: 'ramadan_2026', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/', category: 'series_english', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%b9%d8%b1%d8%a8%d9%8a/', category: 'series_arabic', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%aa%d8%b1%d9%83%d9%8a%d8%a9/', category: 'series_turkish', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d8%b3%d9%8a%d9%88%d9%8a%d8%a9/', category: 'series_asian', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%87%d9%86%d8%af%d9%8a%d8%a9/', category: 'series_indian', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d9%86%d9%85%d9%8a/', category: 'series_anime', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%85%d8%af%d8%a8%d9%84%d8%ac%d8%a9/', category: 'series_dubbed', type: 'series' },
  { path: '/category/%d8%a8%d8%b1%d8%a7%d9%85%d8%ac-%d8%aa%d9%84%d9%81%d8%b2%d9%8a%d9%88%d9%86%d9%8a%d8%a9/', category: 'tv_shows', type: 'series' },
  { path: '/category/%d8%b9%d8%b1%d9%88%d8%b6-%d9%85%d8%b5%d8%a7%d8%b1%d8%b9%d8%a9/', category: 'wrestling', type: 'wrestling' },
  { path: '/category/%d9%85%d8%b3%d8%b1%d8%ad%d9%8a%d8%a7%d8%aa-%d8%b9%d8%b1%d8%a8%d9%8a%d8%a9/', category: 'theater', type: 'theater' }
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

// دالة تخطي مربع التحقق Cloudflare Turnstile
async function solveTurnstileIfPresent(page) {
  try {
    const frames = page.frames();
    for (const frame of frames) {
      if (frame.url().includes('cloudflare') || frame.url().includes('challenge-platform')) {
        const checkbox = await frame.$('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage');
        if (checkbox) {
          console.log('👆 جاري النقر على مربع Turnstile داخل الإطار...');
          await checkbox.click();
          await new Promise(r => setTimeout(r, 2000));
          return true;
        }
      }
    }
    const challengeBox = await page.$('#challenge-stage, iframe[src*="cloudflare"], iframe[src*="turnstile"]');
    if (challengeBox) {
      const rect = await challengeBox.boundingBox();
      if (rect) {
        console.log('👆 النقر على إحداثيات نافذة التحقق...');
        await page.mouse.click(rect.x + 30, rect.y + rect.height / 2);
        await new Promise(r => setTimeout(r, 2000));
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// دالة تنقل آمنة تدعم التحقق والترويسة المرجعية
async function safeNavigate(page, url, referer = '') {
  const options = { waitUntil: 'domcontentloaded', timeout: 60000 };
  if (referer) options.referer = referer;
  
  await page.goto(url, options);
  let title = await page.title();
  let retries = 0;

  while ((title.includes('Just a moment') || title.includes('Cloudflare') || title.includes('Attention Required')) && retries < 8) {
    console.log(`⏳ فحص Cloudflare نشط... انتظار الحل (محاولة ${retries + 1}/8)...`);
    await solveTurnstileIfPresent(page);
    await new Promise(r => setTimeout(r, 3000));
    title = await page.title();
    retries++;
  }
  return title;
}

async function run() {
  console.log('🚀 [v13 - Full Deep Metadata & Resilient Scraper] بدء التشغيل...');

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

  console.log(`🌐 الهدف: ${targetUrl} (القسم: ${target.category} [${targetIndex + 1}/${CATEGORY_ORDER.length}] | الصفحة: ${page})`);

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

  // تحييد النوافذ المنبثقة والإعلانات إجبارياً من الجذور
  await pageTab.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.open = function () { return null; };
    window.alert = function () {};
    window.confirm = function () { return true; };
    window.prompt = function () { return null; };
  });

  let directPlayUrl = '';
  const capturedEmbeds = [];
  const seenUrls = new Set();

  // تتبع حركة الشبكة لاصطياد روابط الفيديو والبث المباشر
  pageTab.on('request', (req) => {
    const u = req.url();
    if (u.includes('govid.live/video-') || u.includes('govid.live/play/') || u.includes('.m3u8') || u.includes('.mp4')) {
      if (!directPlayUrl) {
        directPlayUrl = u;
        console.log(`🔥 [صيد مباشر - Stream Playback]: ${u}`);
      }
    } else if (u.includes('govid.live/e/') || (u.includes('embed') && !u.includes('google') && !u.includes('doubleclick'))) {
      if (!seenUrls.has(u)) {
        seenUrls.add(u);
        capturedEmbeds.push({ name: 'مشغل مدمج (govid)', url: u });
        console.log(`🎯 [لاقط التضمين]: ${u}`);
      }
    }
  });

  // 1. فتح الصفحة الرئيسية لتوثيق الجلسة
  console.log('🔑 توثيق الجلسة عبر الصفحة الرئيسية...');
  const rootTitle = await safeNavigate(pageTab, `${PRIMARY_DOMAIN}/`);
  console.log(`🌐 تم تأكيد الجلسة بنجاح: "${rootTitle}"`);

  // 2. فتح صفحة القسم
  console.log(`🎯 فتح صفحة القسم المستهدفة...`);
  const targetTitle = await safeNavigate(pageTab, targetUrl, `${PRIMARY_DOMAIN}/`);
  console.log(`📄 عنوان صفحة القسم: "${targetTitle}"`);

  // 3. استخراج كروت الأعمال من الـ Grid
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

  // 4. معالجة العناصر واستخراج البيانات وروابط البث
  for (const item of items.slice(0, 10)) {
    try {
      console.log(`🔍 بدء فحص: ${item.title}`);
      
      directPlayUrl = '';
      capturedEmbeds.length = 0;
      seenUrls.clear();

      const detailUrl = `${PRIMARY_DOMAIN}${item.path}`;
      await safeNavigate(pageTab, detailUrl, targetUrl);

      // نقر زر المشغل لتفعيل البث المباشر
      await pageTab.evaluate(() => {
        const triggers = [
          'ul#watch li:first-child',
          'ul#watch li',
          '.Watch--Btn',
          '.btn--watch',
          '.WatchIframe iframe',
          '.WatchIframe'
        ];
        for (const selector of triggers) {
          const el = document.querySelector(selector);
          if (el) {
            el.click();
            break;
          }
        }
      });

      await new Promise(r => setTimeout(r, 2200));

      // استخراج القصة بدقة وسوم الـ SEO والميتا والتقييم والأنواع
      const pageDetails = await pageTab.evaluate(() => {
        // 1. القصة (Story) - من وسوم الميتا الرسمية أو الوصف الداخلي
        let story = '';
        const metaDesc = document.querySelector('meta[property="og:description"], meta[name="description"]');
        if (metaDesc && metaDesc.content) {
          story = metaDesc.content.trim();
        }
        
        if (!story || story.length < 15) {
          const storyEl = document.querySelector('.StoryMovieContent, .Story--Content, .PostStory, .single-story, [itemprop="description"]');
          if (storyEl && storyEl.innerText.trim()) {
            story = storyEl.innerText.trim();
          }
        }

        // تنظيف القصة من العبارات الترويجية الثابتة
        story = story.replace(/^(مشاهدة|تحميل)\s+(فيلم|مسلسل).*?(اون لاين|مترجم|مدبلج)\s*[:\-]?\s*/i, '').trim();

        // 2. التقييم (Rating)
        let rating = null;
        const rateEl = document.querySelector('.IMDB--Rating, .Rate--Single, [itemprop="ratingValue"], .imdb');
        if (rateEl) {
          const match = rateEl.innerText.match(/(\d+(\.\d+)?)/);
          if (match) rating = parseFloat(match[1]);
        }
        if (!rating) {
          const bodyText = document.body ? document.body.innerText : '';
          const match = bodyText.match(/IMDb\s*[:\s]?\s*(\d+(\.\d+)?)/i) || bodyText.match(/(\d\.\d)\s*\/\s*10/);
          if (match) rating = parseFloat(match[1]);
        }

        // 3. التصنيفات الفرعية (Genres)
        const genres = [];
        document.querySelectorAll('a[href*="/genre/"], a[href*="/category/"]').forEach(a => {
          const txt = a.innerText.trim();
          const href = a.getAttribute('href') || '';
          if (
            txt && 
            !txt.includes('ماي سيما') && 
            !txt.includes('وي سيما') && 
            !txt.includes('افلام') && 
            !txt.includes('مسلسلات') && 
            !txt.includes('الرئيسية') &&
            !href.includes('/page/') &&
            !genres.includes(txt)
          ) {
            genres.push(txt);
          }
        });

        // 4. سيرفرات الـ DOM المكتوبة
        const domServers = [];
        document.querySelectorAll('ul#watch li, ul.WatchServersList li, [data-watch], [data-url]').forEach(li => {
          const url = li.getAttribute('data-watch') || li.getAttribute('data-url');
          const name = li.innerText.trim() || 'سيرفر مشاهدة';
          if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
            domServers.push({ name, url });
          }
        });

        return { story, rating, genres, domServers };
      });

      // دمج وتصفية السيرفرات
      const allServers = [...capturedEmbeds, ...pageDetails.domServers];
      if (directPlayUrl) {
        allServers.unshift({ name: 'بث مباشر رئيسي (Direct)', url: directPlayUrl });
      }

      const finalServers = [];
      const finalSeen = new Set();
      for (const s of allServers) {
        if (!finalSeen.has(s.url)) {
          finalSeen.add(s.url);
          finalServers.push(s);
        }
      }

      console.log(`📊 تفاصيل (${item.title}): تقييم: ${pageDetails.rating || 'N/A'} | تصنيفات: [${pageDetails.genres.join(', ')}] | طول القصة: ${pageDetails.story ? pageDetails.story.length : 0} حرف`);
      console.log(`📡 إجمالي السيرفرات المكتشفة: ${finalServers.length}`);

      const primaryStreamUrl = directPlayUrl || finalServers[0]?.url || detailUrl;
      const contentType = target.type === 'series' || item.isSeries ? 'series' : target.type;

      // حفظ السجل كاملاً في Supabase
      await db('contents?on_conflict=page_url', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify([{
          title: item.title,
          type: contentType,
          category: target.category,
          year: item.year,
          poster_url: item.poster,
          stream_url: primaryStreamUrl,
          page_url: item.path,
          extra_data: {
            servers: finalServers,
            direct_stream: directPlayUrl || null,
            story: pageDetails.story || null,
            rating: pageDetails.rating || null,
            genres: pageDetails.genres || []
          },
          updated_at: new Date().toISOString()
        }])
      });

      console.log(`✅ تم الحفظ بنجاح في Supabase: ${item.title}`);

    } catch (err) {
      console.log(`⚠️ تخطي ${item.title}: ${err.message}`);
    }
  }

  await browser.close();

  // تحديث المؤشر للدورة القادمة
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

  console.log(`🎉 اكتملت الدورة بنجاح. المحطة التالية: قسم ${CATEGORY_ORDER[nextIndex].category} (${nextIndex}) صفحة ${nextPage}`);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
