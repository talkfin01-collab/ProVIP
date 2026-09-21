const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

process.on('unhandledRejection', (reason) => {
  if (reason && reason.message && reason.message.includes('Target closed')) return;
  console.log('⚠️ [تحذير تم احتواؤه]:', reason?.message || reason);
});

const PRIMARY_DOMAIN = 'https://mycima.bike';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgxxpdmahcupysrgrhwt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

async function solveTurnstileIfPresent(page) {
  try {
    const frames = page.frames();
    for (const frame of frames) {
      if (frame.url().includes('cloudflare') || frame.url().includes('challenge-platform')) {
        const checkbox = await frame.$('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage');
        if (checkbox) {
          console.log('👆 النقر على مربع Turnstile داخل الإطار...');
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

function sanitizeTitle(rawTitle) {
  return rawTitle
    .replace(/^مشاهدة\s+/i, '')
    .replace(/\s*-\s*وي سيما.*$/i, '')
    .replace(/\s*-\s*ماي سيما.*$/i, '')
    .replace(/\s*اون\s*لاين/gi, '')
    .replace(/\s*مترجمة?/gi, '')
    .replace(/\s*مدبلجة?/gi, '')
    .replace(/\s*\(\s*\d{4}\s*\)\s*$/g, '')
    .trim();
}

async function scrapeSingleItem(browser, item, refererUrl, targetCategory, targetType, processedSeriesUrls) {
  const itemTab = await browser.newPage();
  await itemTab.setViewport({ width: 1920, height: 1080 });
  await itemTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

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
      }
    }
  };

  itemTab.on('request', networkSniffer);

  try {
    const detailUrl = `${PRIMARY_DOMAIN}${item.path}`;
    await safeNavigate(itemTab, detailUrl, refererUrl);

    try {
      await itemTab.evaluate(() => {
        const btn = document.querySelector('ul#watch li:first-child, .WatchServersList li:first-child, .Watch--Btn, .btn--watch');
        if (btn) btn.click();
      });
    } catch (e) {}

    await new Promise(r => setTimeout(r, 1800));

    const pageDetails = await itemTab.evaluate(() => {
      // 1. استخراج رابط وهوية المسلسل الرئيسية إن وجد
      let seriesTitle = null;
      let seriesUrl = null;
      
      const seriesAnchor = document.querySelector('.Terms--Content--Single-begin li a[href*="/series/"]') ||
                           document.querySelector('.Series--Section > a[href*="/series/"]');
      if (seriesAnchor) {
        seriesTitle = seriesAnchor.innerText.trim();
        seriesUrl = seriesAnchor.getAttribute('href');
      }

      // 2. استخراج البوستر المباشر
      let poster = '';
      const metaOgImage = document.querySelector('meta[property="og:image"]');
      const metaTwImage = document.querySelector('meta[name="twitter:image"]');
      
      if (metaOgImage && metaOgImage.content && !metaOgImage.content.includes('logo')) {
        poster = metaOgImage.content;
      } else if (metaTwImage && metaTwImage.content && !metaTwImage.content.includes('logo')) {
        poster = metaTwImage.content;
      }

      if (!poster) {
        const wecimaEl = document.querySelector('wecima');
        if (wecimaEl && wecimaEl.getAttribute('style')) {
          const m = wecimaEl.getAttribute('style').match(/--img:\s*url\(([^)]+)\)/i);
          if (m) poster = m[1].replace(/['"]/g, '');
        }
      }

      if (!poster) {
        const imgEl = document.querySelector('.Poster--Single-begin img, .wecima--single--poster img, [itemprop="image"]');
        if (imgEl) {
          poster = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || imgEl.src || '';
        }
      }

      // 3. القصة
      let story = '';
      const storyEl = document.querySelector('.StoryMovieContent, .AsideContext .StoryMovieContent, .PostStory, [itemprop="description"]');
      if (storyEl) {
        story = storyEl.innerText.trim();
      }

      // 4. السيرفرات
      const domServers = [];
      document.querySelectorAll('ul#watch li, .WatchServersList li, [data-watch]').forEach(li => {
        let url = li.getAttribute('data-watch') || li.getAttribute('data-url');
        const name = li.innerText.trim() || 'سيرفر مشاهدة';
        if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
          if (url.startsWith('//')) url = 'https:' + url;
          domServers.push({ name, url });
        }
      });

      // 5. التقييم
      let rating = null;
      const rateEl = document.querySelector('.IMDB--Rating, .Rate--Single, [itemprop="ratingValue"]');
      if (rateEl) {
        const match = rateEl.innerText.match(/(\d+(\.\d+)?)/);
        if (match) rating = parseFloat(match[1]);
      }

      // 6. التصنيفات
      const genres = [];
      document.querySelectorAll('a[href*="/genre/"]').forEach(a => {
        const txt = a.innerText.trim();
        if (txt && !genres.includes(txt)) genres.push(txt);
      });

      // 7. استخراج قائمة الحلقات بالكامل من جدول الحلقات الفعلي
      const episodesList = [];
      document.querySelectorAll('.EpisodesList a').forEach(a => {
        const href = a.getAttribute('href');
        const titleEl = a.querySelector('episodetitle') || a;
        const epTitle = titleEl.innerText.trim();
        const numMatch = epTitle.match(/(\d+)/);
        if (href) {
          episodesList.push({
            title: epTitle,
            url: href,
            episode_number: numMatch ? parseInt(numMatch[1], 10) : null
          });
        }
      });

      // 8. استخراج المواسم
      const seasonsList = [];
      document.querySelectorAll('.SeasonsList ul li a').forEach(a => {
        seasonsList.push({
          title: a.innerText.trim(),
          season_id: a.getAttribute('data-season') || null,
          url: a.getAttribute('href') || null
        });
      });

      const h1Text = document.querySelector('h1[itemprop="name"]')?.innerText || document.title;
      const seasonMatch = h1Text.match(/الموسم\s+([^\s]+)/);
      const episodeMatch = h1Text.match(/الحلقة\s+(\d+)/);

      return {
        seriesTitle,
        seriesUrl,
        poster,
        story,
        domServers,
        rating,
        genres,
        episodesList,
        seasonsList,
        seasonName: seasonMatch ? seasonMatch[1] : null,
        episodeNumber: episodeMatch ? parseInt(episodeMatch[1], 10) : null
      };
    });

    itemTab.off('request', networkSniffer);

    // التحقق من تكرار المسلسل: إذا كان المسلسل قد عولج في نفس الجلسة أو مسجل برابطه الأم
    const seriesKey = pageDetails.seriesUrl || (pageDetails.seriesTitle ? sanitizeTitle(pageDetails.seriesTitle) : null);
    if (seriesKey && processedSeriesUrls.has(seriesKey)) {
      console.log(`⏩ [تخطي تكرار]: تم معالجة وتخزين المسلسل مسبقاً (${pageDetails.seriesTitle || item.title})`);
      await itemTab.close().catch(() => {});
      return true;
    }

    const allServers = [...capturedEmbeds, ...pageDetails.domServers];
    if (directPlayUrl) allServers.unshift({ name: 'بث مباشر رئيسي (Direct)', url: directPlayUrl });

    const finalServers = [];
    const finalSeen = new Set();
    for (const s of allServers) {
      if (!finalSeen.has(s.url)) {
        finalSeen.add(s.url);
        finalServers.push(s);
      }
    }

    let finalPoster = pageDetails.poster || item.poster || '';
    if (finalPoster.startsWith('//')) finalPoster = 'https:' + finalPoster;

    const isSeriesItem = targetType === 'series' || item.isSeries || pageDetails.seriesTitle !== null;
    const contentType = isSeriesItem ? 'series' : targetType;

    // استخدام اسم المسلسل الرئيسي عنواناً للمسلسلات بدلاً من اسم الحلقة المفردة
    const finalTitle = isSeriesItem && pageDetails.seriesTitle 
      ? sanitizeTitle(pageDetails.seriesTitle) 
      : sanitizeTitle(item.title);

    // إذا كان مسلسلاً، نعتمد رابط المسلسل كـ page_url لتجنب إنشاء صف لكل حلقة، وإلا نستخدم رابط الصفحة
    const finalPageUrl = isSeriesItem && pageDetails.seriesUrl ? pageDetails.seriesUrl : item.path;

    await db('contents?on_conflict=page_url', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([{
        title: finalTitle,
        type: contentType,
        category: targetCategory,
        year: item.year,
        poster_url: finalPoster,
        stream_url: directPlayUrl || finalServers[0]?.url || detailUrl,
        page_url: finalPageUrl,
        extra_data: {
          original_title: item.title,
          servers: finalServers,
          direct_stream: directPlayUrl || null,
          story: pageDetails.story || null,
          rating: pageDetails.rating || null,
          genres: pageDetails.genres || [],
          series_title: pageDetails.seriesTitle || null,
          series_url: pageDetails.seriesUrl || null,
          season_name: pageDetails.seasonName || null,
          episode_number: pageDetails.episodeNumber || null,
          seasons: pageDetails.seasonsList.length > 0 ? pageDetails.seasonsList : undefined,
          episodes: pageDetails.episodesList.length > 0 ? pageDetails.episodesList : undefined,
          status: 'success'
        },
        updated_at: new Date().toISOString()
      }])
    });

    if (seriesKey) processedSeriesUrls.add(seriesKey);

    console.log(`✅ تم الحفظ: ${finalTitle} | بوستر: ${finalPoster ? 'متوفر' : 'غير متوفر'} | حلقات: ${pageDetails.episodesList.length}`);
    await itemTab.close().catch(() => {});
    return true;

  } catch (err) {
    console.log(`⚠️ فشل فحص (${item.title}): ${err.message}`);
    await itemTab.close().catch(() => {});
    return false;
  }
}

async function run() {
  console.log('🚀 بدء تشغيل الكاشط (معالجة البوسترات للأفلام والمسلسلات + منع التكرار)...');

  let state = (await db('scraper_state?id=eq.1&select=*'))?.[0];
  if (!state) {
    const defaultState = [{ id: 1, target_index: 0, current_page: 1, initial_archive_done: 0 }];
    await db('scraper_state', { method: 'POST', body: JSON.stringify(defaultState) });
    state = defaultState[0];
  }

  let targetIndex = (state.target_index || 0) % CATEGORY_ORDER.length;
  let page = state.current_page || 1;
  const target = CATEGORY_ORDER[targetIndex];

  const targetUrl = target.path === '/' 
    ? (page === 1 ? `${PRIMARY_DOMAIN}/` : `${PRIMARY_DOMAIN}/page/${page}/`)
    : `${PRIMARY_DOMAIN}${target.path}`.replace(/\/+$/, '') + (page === 1 ? '/' : `/page/${page}/`);

  console.log(`🌐 [صفحة: ${page}] | الهدف: ${targetUrl} (قسم: ${target.category})`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const mainTab = await browser.newPage();
  await mainTab.setViewport({ width: 1920, height: 1080 });
  await mainTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

  await safeNavigate(mainTab, `${PRIMARY_DOMAIN}/`);
  await safeNavigate(mainTab, targetUrl, `${PRIMARY_DOMAIN}/`);

  // استخراج العناصر من شبكة العرض والتقاط الـ data-lazy-style و CSS variables
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

      // فحص شامل لصور البطاقات في واجهة القسم (أفلام ومسلسلات)
      let poster = '';

      const bgSpan = el.querySelector('.BG--GridItem');
      if (bgSpan) {
        const lazyStyle = bgSpan.getAttribute('data-lazy-style') || bgSpan.getAttribute('style') || '';
        const match = lazyStyle.match(/--image:\s*url\(([^)]+)\)/i) || lazyStyle.match(/url\(['"]?([^'")]+)['"]?\)/i);
        if (match) poster = match[1].replace(/['"]/g, '');
      }

      if (!poster) {
        const img = el.querySelector('img');
        if (img) {
          poster = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.src || '';
        }
      }

      if (poster && poster.startsWith('//')) poster = 'https:' + poster;

      const yearMatch = el.innerText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
      const isSeries = path.includes('مسلسل') || path.includes('حلقة');

      list.push({ path, title, poster, year, isSeries });
    });
    return list;
  });

  await mainTab.close().catch(() => {});

  // فلترة العناصر الفريدة المستخرجة من الصفحة
  const uniqueMap = new Map();
  for (const it of rawItems) {
    if (!uniqueMap.has(it.path)) uniqueMap.set(it.path, it);
  }
  const items = Array.from(uniqueMap.values());
  console.log(`📦 العناصر المستخرجة: ${items.length} عنصر.`);

  // فحص قاعدة البيانات لتخطي العناصر التي تمت أرشفتها مسبقاً (تخطي التكرار)
  const pathsToCheck = items.map(i => `"${i.path}"`).join(',');
  let existingUrls = new Set();
  try {
    const existing = await db(`contents?select=page_url&page_url=in.(${encodeURIComponent(pathsToCheck)})`);
    if (existing && existing.length > 0) {
      existing.forEach(r => existingUrls.add(r.page_url));
    }
  } catch (e) {
    console.log('ملاحظة أثناء فحص التكرار المسبق:', e.message);
  }

  const itemsToProcess = items.filter(it => !existingUrls.has(it.path));
  console.log(`✨ عناصر جديدة تتطلب المعالجة بعد فحص التكرار: ${itemsToProcess.length} (تم تخطي ${items.length - itemsToProcess.length} مكرر).`);

  const processedSeriesUrls = new Set();

  for (const item of itemsToProcess.slice(0, 10)) {
    console.log(`🔍 بدء فحص: ${item.title}`);
    await scrapeSingleItem(browser, item, targetUrl, target.category, target.type, processedSeriesUrls);
    await new Promise(r => setTimeout(r, 600));
  }

  await browser.close();

  // تدوير الأقسام والصفحات
  let nextIndex = targetIndex + 1;
  let nextPage = page;
  if (nextIndex >= CATEGORY_ORDER.length) {
    nextIndex = 0;
    nextPage = page + 1;
    console.log(`🏁 اكتملت دورة الصفحة (${page}) لجميع الأقسام الـ 18. الانتقال للصفحة (${nextPage})...`);
  }
  if (nextPage > 50) nextPage = 1;

  await db('scraper_state?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({ target_index: nextIndex, current_page: nextPage })
  });

  console.log(`🎉 تم الانتهاء بنجاح. المحطة التالية: دورة ${nextPage} - قسم ${CATEGORY_ORDER[nextIndex].category}`);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
