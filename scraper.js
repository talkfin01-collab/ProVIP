const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// احتواء أخطاء إغلاق النوافذ غير المتوقعة الناتجة عن شبكات الإعلانات
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

// دالة تخطي التحقق Cloudflare Turnstile
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

// دالة تنقل آمنة
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

// دالة تنظيف العناوين لواجهة المستخدم
function sanitizeTitle(rawTitle) {
  return rawTitle
    .replace(/^مشاهدة\s+/i, '')
    .replace(/\s*-\s*وي سيما.*$/i, '')
    .replace(/\s*-\s*ماي سيما.*$/i, '')
    .replace(/\s*اون\s*لاين/gi, '')
    .replace(/\s*\(\s*\d{4}\s*\)\s*$/g, '')
    .trim();
}

// معالجة وفحص صفحة العمل بشكل معزول
async function scrapeSingleItem(browser, item, refererUrl, targetCategory, targetType) {
  const itemTab = await browser.newPage();
  await itemTab.setViewport({ width: 1920, height: 1080 });
  await itemTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

  // تحصين التبويب ضد الإعلانات المنبثقة
  await itemTab.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.open = () => null;
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => null;
  });

  let directPlayUrl = '';
  const capturedEmbeds = [];
  const seenUrls = new Set();

  const networkSniffer = (req) => {
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
  };

  itemTab.on('request', networkSniffer);

  try {
    const detailUrl = `${PRIMARY_DOMAIN}${item.path}`;
    await safeNavigate(itemTab, detailUrl, refererUrl);

    // تفعيل المشغل بهدوء إن وجد
    try {
      await itemTab.evaluate(() => {
        const btn = document.querySelector('ul#watch li:first-child, .Watch--Btn, .btn--watch');
        if (btn) btn.click();
      });
    } catch (e) {}

    await new Promise(r => setTimeout(r, 1800));

    // استخراج بيانات الـ DOM بدقة تامة بعد مطابقتها مع شفرة المصدر
    const pageDetails = await itemTab.evaluate(() => {
      // 1. القصة النقية (من الكلاس المخصص أو الميتا)
      let story = '';
      const storyEl = document.querySelector('.StoryMovieContent');
      if (storyEl && storyEl.innerText.trim()) {
        story = storyEl.innerText.trim();
      } else {
        const metaDesc = document.querySelector('meta[itemprop="description"], meta[name="description"]');
        if (metaDesc && metaDesc.content) story = metaDesc.content.trim();
      }

      // 2. استخراج جميع سيرفرات المشاهدة المباشرة الجاهزة في الصفحة
      const domServers = [];
      document.querySelectorAll('ul#watch li[data-watch]').forEach(li => {
        const url = li.getAttribute('data-watch');
        const name = li.innerText.trim() || 'سيرفر مشاهدة';
        if (url && url.startsWith('http')) {
          domServers.push({ name, url });
        }
      });

      // 3. التقييم
      let rating = null;
      const rateEl = document.querySelector('.IMDB--Rating, .Rate--Single, [itemprop="ratingValue"], .imdb');
      if (rateEl) {
        const match = rateEl.innerText.match(/(\d+(\.\d+)?)/);
        if (match) rating = parseFloat(match[1]);
      }

      // 4. التصنيفات من قائمة الشروط أو الأنواع
      const genres = [];
      document.querySelectorAll('a[href*="/genre/"], .Terms--Content--Single-begin li p a').forEach(a => {
        const txt = a.innerText.trim();
        const href = a.getAttribute('href') || '';
        if (
          txt &&
          !txt.includes('ماي سيما') &&
          !txt.includes('وي سيما') &&
          !txt.includes('مسلسلات') &&
          !txt.includes('افلام') &&
          !href.includes('/category/') &&
          !genres.includes(txt)
        ) {
          genres.push(txt);
        }
      });

      // 5. بيانات خاصة بالمسلسلات والحلقات
      let seriesTitle = null;
      let seriesUrl = null;
      const seriesAnchor = document.querySelector('.Terms--Content--Single-begin li a[href*="/series/"]');
      if (seriesAnchor) {
        seriesTitle = seriesAnchor.innerText.trim();
        seriesUrl = seriesAnchor.getAttribute('href');
      }

      const h1Text = document.querySelector('h1[itemprop="name"]')?.innerText || document.title;
      const seasonMatch = h1Text.match(/الموسم\s+([^\s]+)/);
      const episodeMatch = h1Text.match(/الحلقة\s+(\d+)/);

      return {
        story,
        domServers,
        rating,
        genres,
        seriesTitle,
        seriesUrl,
        seasonName: seasonMatch ? seasonMatch[1] : null,
        episodeNumber: episodeMatch ? parseInt(episodeMatch[1], 10) : null
      };
    });

    itemTab.off('request', networkSniffer);

    // دمج السيرفرات المكتشفة مع روابط الشبكة
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
    const isSeriesItem = targetType === 'series' || item.isSeries || pageDetails.seriesTitle !== null;
    const contentType = isSeriesItem ? 'series' : targetType;
    const cleanTitle = sanitizeTitle(item.title);

    // حفظ السجل كاملاً في Supabase مع تصفير أي أخطاء سابقة
    await db('contents?on_conflict=page_url', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([{
        title: cleanTitle,
        type: contentType,
        category: targetCategory,
        year: item.year,
        poster_url: item.poster,
        stream_url: primaryStreamUrl,
        page_url: item.path,
        extra_data: {
          original_title: item.title,
          servers: finalServers,
          direct_stream: directPlayUrl || null,
          story: pageDetails.story || null,
          rating: pageDetails.rating || null,
          genres: pageDetails.genres || [],
          // بيانات المسلسلات
          series_title: pageDetails.seriesTitle || null,
          series_url: pageDetails.seriesUrl || null,
          season_name: pageDetails.seasonName || null,
          episode_number: pageDetails.episodeNumber || null,
          status: 'success'
        },
        updated_at: new Date().toISOString()
      }])
    });

    console.log(`✅ تم الحفظ بنجاح في Supabase: ${cleanTitle}`);
    await itemTab.close().catch(() => {});
    return true;

  } catch (err) {
    console.log(`⚠️ فشل فحص (${item.title}): ${err.message}`);
    await itemTab.close().catch(() => {});

    // جدولة إعادة المحاولة بعد 24 ساعة
    const retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const contentType = targetType === 'series' || item.isSeries ? 'series' : targetType;
    const fallbackUrl = `${PRIMARY_DOMAIN}${item.path}`;

    await db('contents?on_conflict=page_url', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([{
        title: item.title,
        type: contentType,
        category: targetCategory,
        year: item.year,
        poster_url: item.poster,
        stream_url: fallbackUrl,
        page_url: item.path,
        extra_data: {
          status: 'failed',
          error: err.message,
          retry_after: retryAfter,
          retry_count: (item.extra_data?.retry_count || 0) + 1
        },
        updated_at: new Date().toISOString()
      }])
    }).catch(e => console.log('تعذر تسجيل حالة الفشل:', e.message));

    console.log(`⏳ [نظام الـ 24 ساعة]: تمت جدولة إعادة فحص (${item.title}) بعد 24 ساعة.`);
    return false;
  }
}

async function run() {
  console.log('🚀 [v16 - Cross-Category Page Rotation & Accurate Media Engine] بدء التشغيل...');

  let state = (await db('scraper_state?id=eq.1&select=*'))?.[0];
  if (!state) {
    const defaultState = [{ id: 1, target_index: 0, current_page: 1, initial_archive_done: 0 }];
    await db('scraper_state', { method: 'POST', body: JSON.stringify(defaultState) });
    state = defaultState[0];
  }

  let targetIndex = state.target_index % CATEGORY_ORDER.length;
  let page = state.current_page || 1;
  const target = CATEGORY_ORDER[targetIndex];

  const targetUrl = target.path === '/' 
    ? (page === 1 ? `${PRIMARY_DOMAIN}/` : `${PRIMARY_DOMAIN}/page/${page}/`)
    : `${PRIMARY_DOMAIN}${target.path}`.replace(/\/+$/, '') + (page === 1 ? '/' : `/page/${page}/`);

  console.log(`🌐 [دورة الصفحة: ${page}] | الهدف: ${targetUrl} (القسم: ${target.category} [${targetIndex + 1}/${CATEGORY_ORDER.length}])`);

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

  const mainTab = await browser.newPage();
  await mainTab.setViewport({ width: 1920, height: 1080 });
  await mainTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

  // 1. فتح الصفحة الرئيسية لتوثيق الجلسة وحصد الكوكيز الصالحة
  console.log('🔑 توثيق الجلسة عبر الصفحة الرئيسية...');
  const rootTitle = await safeNavigate(mainTab, `${PRIMARY_DOMAIN}/`);
  console.log(`🌐 تم تأكيد الجلسة بنجاح: "${rootTitle}"`);

  // 2. فحص طابور إعادة المحاولة بعد 24 ساعة
  try {
    const failedCandidates = await db('contents?select=*&extra_data->>status=eq.failed&limit=3');
    const nowTime = new Date();

    if (failedCandidates && failedCandidates.length > 0) {
      for (const failedItem of failedCandidates) {
        const retryTime = failedItem.extra_data?.retry_after ? new Date(failedItem.extra_data.retry_after) : null;
        if (!retryTime || nowTime >= retryTime) {
          console.log(`🔄 [إعادة فحص مستحقة بعد 24 ساعة]: ${failedItem.title}`);
          const itemPayload = {
            path: failedItem.page_url,
            title: failedItem.title,
            poster: failedItem.poster_url,
            year: failedItem.year,
            isSeries: failedItem.type === 'series',
            extra_data: failedItem.extra_data
          };
          await scrapeSingleItem(browser, itemPayload, `${PRIMARY_DOMAIN}/`, failedItem.category, failedItem.type);
        }
      }
    }
  } catch (e) {
    console.log('ملاحظة أثناء فحص طابور الـ 24 ساعة:', e.message);
  }

  // 3. فتح صفحة القسم المستهدفة واستخراج العناصر
  console.log(`🎯 فتح صفحة القسم المستهدفة...`);
  const targetTitle = await safeNavigate(mainTab, targetUrl, `${PRIMARY_DOMAIN}/`);
  console.log(`📄 عنوان صفحة القسم: "${targetTitle}"`);

  const rawItems = await mainTab.evaluate(() => {
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

  await mainTab.close().catch(() => {});

  const uniqueMap = new Map();
  for (const it of rawItems) {
    if (!uniqueMap.has(it.path)) uniqueMap.set(it.path, it);
  }
  const items = Array.from(uniqueMap.values());

  console.log(`📦 العناصر الفريدة المستخرجة: ${items.length} عنصر.`);

  // 4. معالجة العناصر في تبويبات معزولة ومستقلة
  for (const item of items.slice(0, 10)) {
    console.log(`🔍 بدء فحص: ${item.title}`);
    await scrapeSingleItem(browser, item, targetUrl, target.category, target.type);
    await new Promise(r => setTimeout(r, 600));
  }

  await browser.close();

  // -------------------------------------------------------------
  // 5. آلية التدوير: التنقل بين الأقسام على نفس الصفحة أولاً، ثم الانتقال للصفحة التالية
  // -------------------------------------------------------------
  let nextIndex = targetIndex + 1;
  let nextPage = page;

  // إذا أنهينا القسم الأخير (18)، نعود للقسم الأول وننتقل للصفحة التالية (دورة جديدة)
  if (nextIndex >= CATEGORY_ORDER.length) {
    nextIndex = 0;
    nextPage = page + 1;
    console.log(`🏁 اكتملت دورة الصفحة (${page}) لجميع الأقسام الـ 18 بنجاح! الانتقال لدورة الصفحة (${nextPage})...`);
  }

  // إذا تجاوزت الصفحات الحد الأقصى للأرشفة (50 صفحة)، نعود للصفحة 1
  if (nextPage > 50) {
    nextPage = 1;
  }

  await db('scraper_state?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({ target_index: nextIndex, current_page: nextPage })
  });

  console.log(`🎉 اكتملت التشغيلة بنجاح. المحطة التالية: [دورة الصفحة ${nextPage}] - قسم ${CATEGORY_ORDER[nextIndex].category} (${nextIndex + 1}/${CATEGORY_ORDER.length})`);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
