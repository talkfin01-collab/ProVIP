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
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d9%87%d9%86%d8%af%d9%8a/', category: 'movies_indian', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%aa%d8%b1%d9%83%d9%8a%d8%a9/', category: 'movies_turkish', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d8%a7%d8%b3%d9%8a%d9%88%d9%8a%d8%a9/', category: 'movies_asian', type: 'movie' },
  { path: '/category/%d8%a7%d9%81%d9%84%d8%a7%d9%85-%d9%83%d8%b1%d8%aa%d9%88%d9%86/', category: 'movies_anime', type: 'movie' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%b1%d9%85%d8%b6%d8%a7%d9%86-2026/', category: 'ramadan', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/', category: 'series_english', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%b9%d8%b1%d8%a8%d9%8a/', category: 'series_arabic', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%aa%d8%b1%d9%83%d9%8a%d8%a9/', category: 'series_turkish', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%87%d9%86%d8%af%d9%8a/', category: 'series_indian', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d8%b3%d9%8a%d9%88%d9%8a%d8%a9/', category: 'series_asian', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%83%d8%b1%d8%aa%d9%88%d9%86/', category: 'series_anime', type: 'series' },
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

function parseArabicSeasonNumber(text) {
  const norm = text.trim();
  const digitMatch = norm.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0], 10);
  if (norm.includes('الاول') || norm.includes('الأول')) return 1;
  if (norm.includes('الثاني')) return 2;
  if (norm.includes('الثالث')) return 3;
  if (norm.includes('الرابع')) return 4;
  if (norm.includes('الخامس')) return 5;
  if (norm.includes('السادس')) return 6;
  if (norm.includes('السابع')) return 7;
  if (norm.includes('الثامن')) return 8;
  if (norm.includes('التاسع')) return 9;
  if (norm.includes('العاشر')) return 10;
  return 1;
}

async function run() {
  console.log('🚀 بدء تشغيل كاشط GitHub Actions...');

  let state = (await db('scraper_state?id=eq.1&select=*'))?.[0];
  if (!state) {
    const defaultState = [{ id: 1, target_index: 0, current_page: 1, initial_archive_done: 0 }];
    await db('scraper_state', { method: 'POST', body: JSON.stringify(defaultState) });
    state = defaultState[0];
  }

  let targetIndex = state.target_index % CATEGORY_ORDER.length;
  let page = state.current_page;
  const target = CATEGORY_ORDER[targetIndex];

  let targetUrl = '';
  if (target.path === '/') {
    targetUrl = page === 1 ? `${PRIMARY_DOMAIN}/` : `${PRIMARY_DOMAIN}/page/${page}/`;
  } else {
    const basePath = `${PRIMARY_DOMAIN}${target.path}`.replace(/\/+$/, '');
    targetUrl = page === 1 ? `${basePath}/` : `${basePath}/page/${page}/`;
  }

  console.log(`🌐 جلب الرابط (${target.category} - صفحة ${page}): ${targetUrl}`);

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

  await pageTab.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  // التحقق من فحص Cloudflare والانتظار حتى يتجاوزه
  let currentTitle = await pageTab.title();
  console.log(`📄 عنوان الصفحة الأولي: "${currentTitle}"`);

  let attempts = 0;
  while ((currentTitle.includes('Just a moment') || currentTitle.includes('Cloudflare') || currentTitle.includes('Attention Required')) && attempts < 10) {
    console.log(`⏳ انتظار تخطي فحص Cloudflare... (محاولة ${attempts + 1})`);
    await new Promise(r => setTimeout(r, 3000));
    currentTitle = await pageTab.title();
    attempts++;
  }

  console.log(`✅ عنوان الصفحة النهائي: "${currentTitle}"`);

  // استخراج البطاقات بمحددات مرنة وشاملة
  const items = await pageTab.evaluate(() => {
    const list = [];
    const elements = document.querySelectorAll('.Thumb--GridItem, .GridItem, .Grid--WecimaPosts > div');
    
    elements.forEach(el => {
      const linkEl = el.querySelector('a');
      if (!linkEl) return;
      const rawHref = linkEl.getAttribute('href') || '';
      const path = rawHref.replace(/^https?:\/\/[^\/]+/, '');
      if (!path || path.startsWith('/category/') || path.startsWith('/tag/') || path === '/') return;

      const title = el.querySelector('strong, .title, h2')?.innerText?.trim() || linkEl.getAttribute('title') || '';
      if (!title) return;

      const style = el.getAttribute('style') || '';
      const posterMatch = style.match(/--image:\s*url\(([^)]+)\)/i) || style.match(/src=["']([^"']+)["']/i);
      const imgEl = el.querySelector('img');
      const poster = posterMatch ? posterMatch[1].replace(/['"]/g, '') : (imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || '') : '');

      const yearMatch = el.innerText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
      const isSeries = path.includes('مسلسل') || path.includes('حلقة');
      const epMatch = el.querySelector('.Episode--number')?.innerText?.match(/\d+/);
      const epNumber = epMatch ? parseInt(epMatch[0], 10) : undefined;

      list.push({ path, title, poster, year, isSeries, epNumber });
    });
    return list;
  });

  console.log(`📦 تم العثور على ${items.length} عنصر.`);

  for (const item of items) {
    try {
      console.log(`🔍 جلب تفاصيل: ${item.title}`);
      const detailTab = await browser.newPage();
      await detailTab.setViewport({ width: 1920, height: 1080 });
      await detailTab.goto(`${PRIMARY_DOMAIN}${item.path}`, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 2000));

      const details = await detailTab.evaluate(() => {
        const servers = [];
        const watchItems = document.querySelectorAll('ul#watch li, ul.WatchServersList li');
        watchItems.forEach(li => {
          const url = li.getAttribute('data-watch') || li.getAttribute('data-url');
          const name = li.innerText.trim();
          if (url) servers.push({ name, url });
        });
        const title = document.querySelector('h1')?.innerText?.trim() || '';
        return { servers, title };
      });

      await detailTab.close();

      if (details.servers.length === 0) {
        console.log(`⚠️ لم يتم العثور على سيرفرات مشاهدة لـ: ${item.title}`);
        continue;
      }

      const realTitle = details.title || item.title;

      if (target.type === 'series' || item.isSeries) {
        const cleanTitle = realTitle.replace(/الموسم.*$/i, '').replace(/الحلقة.*$/i, '').trim();
        let series = (await db(`contents?title=eq.${encodeURIComponent(cleanTitle)}&type=eq.series&select=id`))?.[0];

        if (!series) {
          const inserted = await db('contents', {
            method: 'POST',
            body: JSON.stringify([{
              title: cleanTitle,
              type: 'series',
              category: target.category,
              year: item.year,
              poster_url: item.poster,
              stream_url: `${PRIMARY_DOMAIN}${item.path}`,
              page_url: item.path,
              updated_at: new Date().toISOString()
            }])
          });
          series = inserted?.[0];
        }

        if (series) {
          const seasonNumber = parseArabicSeasonNumber(realTitle);
          let season = (await db(`seasons?content_id=eq.${series.id}&season_number=eq.${seasonNumber}&select=id`))?.[0];
          if (!season) {
            const insertedSeason = await db('seasons', {
              method: 'POST',
              body: JSON.stringify([{
                content_id: series.id,
                season_number: seasonNumber,
                season_title: `الموسم ${seasonNumber}`
              }])
            });
            season = insertedSeason?.[0];
          }

          if (season) {
            const epNum = item.epNumber || (realTitle.match(/الحلقة\s*(\d+)/i)?.[1] ? parseInt(realTitle.match(/الحلقة\s*(\d+)/i)[1], 10) : 1);
            await db('episodes?on_conflict=page_url', {
              method: 'POST',
              headers: { 'Prefer': 'resolution=merge-duplicates' },
              body: JSON.stringify([{
                season_id: season.id,
                episode_number: epNum,
                title: `الحلقة ${epNum}`,
                stream_url: details.servers[0].url,
                page_url: item.path,
                extra_data: { servers: details.servers }
              }])
            });
          }
        }
      } else {
        await db('contents?on_conflict=page_url', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify([{
            title: realTitle,
            type: target.type,
            category: target.category,
            year: item.year,
            poster_url: item.poster,
            stream_url: details.servers[0].url,
            page_url: item.path,
            extra_data: { servers: details.servers },
            updated_at: new Date().toISOString()
          }])
        });
      }
      console.log(`✅ تم حفظ: ${realTitle}`);
    } catch (err) {
      console.log(`⚠️ تخطي عنصر بسبب: ${err.message}`);
    }
  }

  await browser.close();

  // تحديث المؤشر للصفحة التالية
  if (items.length === 0 || page >= 50) {
    page = 1;
    targetIndex = (targetIndex + 1) % CATEGORY_ORDER.length;
  } else {
    page++;
  }

  await db('scraper_state?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({ target_index: targetIndex, current_page: page })
  });

  console.log(`🎉 اكتملت الدورة بنجاح. الانتقال إلى القسم ${targetIndex} صفحة ${page}`);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
