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
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%87%d9%86%d8%af%d9%8a/', category: 'series_indian', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d9%86%d9%85%d9%8a/', category: 'series_anime', type: 'series' },
  { path: '/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d9%85%d8%af%d8%a8%d9%84%d8%ac%d8%a9/', category: 'series_dubbed', type: 'series' },
  { path: '/category/%d8%a8%d8%b1%d8%a7%d9%85%d8%ac-%d8%aa%d9%84%d9%81%d8%b2%d9%8a%d9%86%d9%8a%d8%a9/', category: 'tv_shows', type: 'series' },
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

function extractBaseTitle(rawTitle) {
  let clean = rawTitle
    .replace(/^مشاهدة\s+/i, '')
    .replace(/\s*-\s*وي سيما.*$/i, '')
    .replace(/\s*-\s*ماي سيما.*$/i, '')
    .replace(/\s*اون\s*لاين/gi, '')
    .replace(/\s*اون\b/gi, '')
    .replace(/\s*\bكامل(ة)?\b/gi, '')
    .replace(/\s*مترجمة?/gi, '')
    .replace(/\s*مدبلجة?/gi, '')
    .replace(/\s*الموسم\s+([^\s]+)/gi, '')
    .replace(/\s*الحلقة\s+\d+/gi, '')
    .replace(/\s*حلقة\s+\d+/gi, '')
    .replace(/\s*(الحادية|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة)\s+و\s*(العشرون|الثلاثون|الاربعون|الخمسون)/gi, '')
    .replace(/\s*(الحادية|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة)\s+عشر/gi, '')
    .replace(/\s*(الاولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|العشرون|الثلاثون|الاربعون|الخمسون|عشر)/gi, '')
    .replace(/\s*(والاخيرة|الاخيرة)/gi, '')
    .trim();

  clean = clean.replace(/(\(\s*\d{4}\s*\)\s*)+$/g, '').trim();
  clean = clean.replace(/\s*\b(19\d\d|20\d\d)\b\s*$/g, '').trim();
  clean = clean.replace(/\s+و$/gi, '').trim();

  return clean;
}

async function extractEpisodesFromPage(pageTab) {
  return await pageTab.evaluate(() => {
    const list = [];
    const seen = new Set();
    document.querySelectorAll('.EpisodesList a, .Episodes--List a, .List--Episodes a, .Episodes--Seasons--Episodes a, a[href*="/episode/"], a[href*="/watch/"]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.includes('javascript:') || seen.has(href)) return;
      const titleEl = a.querySelector('episodetitle') || a.querySelector('span') || a;
      const epTitle = titleEl.innerText.trim();
      if (href.includes('حلقة') || href.includes('الحلقة') || href.includes('/watch/') || epTitle.includes('حلقة') || epTitle.includes('الحلقة')) {
        seen.add(href);
        const numMatch = epTitle.match(/(\d+)/);
        list.push({
          title: epTitle || 'حلقة',
          url: href,
          episode_number: numMatch ? parseInt(numMatch[1], 10) : null
        });
      }
    });
    return list;
  });
}

// دالة سريعة لصيد رابط الفيديو المباشر والسيرفرات لحلقة محددة
async function resolveEpisodeStream(browser, epUrl, refererUrl) {
  const epTab = await browser.newPage();
  await epTab.setViewport({ width: 1280, height: 720 });
  await epTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  await epTab.setRequestInterception(true);

  let directStream = '';
  const embeds = [];
  const seenEmbeds = new Set();

  epTab.on('request', (req) => {
    const u = req.url();
    const resType = req.resourceType();

    if (u.includes('govid.live/video-') || u.includes('govid.live/play/') || u.includes('.m3u8') || u.includes('.mp4')) {
      if (!directStream) directStream = u;
    } else if (u.includes('govid.live/e/') || (u.includes('embed') && !u.includes('google') && !u.includes('doubleclick'))) {
      if (!seenEmbeds.has(u)) {
        seenEmbeds.add(u);
        embeds.push({ name: 'مشغل مدمج (govid)', url: u });
      }
    }

    if (resType === 'font' || resType === 'image' || (resType === 'media' && !u.includes('govid'))) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    const fullUrl = epUrl.startsWith('http') ? epUrl : `${PRIMARY_DOMAIN}${epUrl}`;
    await safeNavigate(epTab, fullUrl, refererUrl);

    try {
      await epTab.evaluate(() => {
        const btn = document.querySelector('ul#watch li:first-child, .WatchServersList li:first-child, .Watch--Btn, .btn--watch');
        if (btn) btn.click();
      });
    } catch (e) {}

    await new Promise(r => setTimeout(r, 1200));

    const domServers = await epTab.evaluate(() => {
      const list = [];
      document.querySelectorAll('ul#watch li, .WatchServersList li, [data-watch]').forEach(li => {
        let url = li.getAttribute('data-watch') || li.getAttribute('data-url');
        const name = li.innerText.trim() || 'سيرفر مشاهدة';
        if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
          if (url.startsWith('//')) url = 'https:' + url;
          list.push({ name, url });
        }
      });
      return list;
    });

    const allServers = [...embeds, ...domServers];
    if (directStream) allServers.unshift({ name: 'بث مباشر رئيسي (Direct)', url: directStream });

    await epTab.close().catch(() => {});
    return {
      stream_url: directStream || allServers[0]?.url || null,
      servers: allServers
    };
  } catch (err) {
    await epTab.close().catch(() => {});
    return { stream_url: null, servers: [] };
  }
}

async function reconcileOtherSeasons(itemTab, seasonsList, currentUrl, baseEpisodeMap) {
  if (!seasonsList || seasonsList.length <= 1) return;

  const seasonsToFetch = seasonsList.filter(s => s.url && !currentUrl.includes(s.url));
  if (seasonsToFetch.length === 0) return;

  console.log(`🧭 [تسوية المواسم]: تم رصد ${seasonsToFetch.length} مواسم إضافية، جاري فحص الحلقات...`);

  const CHUNK_SIZE = 3;
  for (let i = 0; i < seasonsToFetch.length; i += CHUNK_SIZE) {
    const chunk = seasonsToFetch.slice(i, i + CHUNK_SIZE);
    for (const season of chunk) {
      try {
        const fullSeasonUrl = season.url.startsWith('http') ? season.url : `${PRIMARY_DOMAIN}${season.url}`;
        await safeNavigate(itemTab, fullSeasonUrl, currentUrl);
        await itemTab.waitForSelector('.EpisodesList a, .List--Episodes', { timeout: 3000 }).catch(() => {});
        const seasonEps = await extractEpisodesFromPage(itemTab);
        for (const ep of seasonEps) {
          if (!baseEpisodeMap.has(ep.url)) {
            baseEpisodeMap.set(ep.url, Object.assign({}, ep, { season_title: season.title }));
          }
        }
      } catch (e) {}
    }
  }
}

async function scrapeSingleItem(browser, item, refererUrl, targetCategory, targetType, processedSeriesCache) {
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

  await itemTab.setRequestInterception(true);

  let directPlayUrl = '';
  const capturedEmbeds = [];
  const seenUrls = new Set();

  itemTab.on('request', (req) => {
    const u = req.url();
    const resType = req.resourceType();

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

    if (resType === 'font' || (resType === 'media' && !u.includes('govid'))) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    const detailUrl = `${PRIMARY_DOMAIN}${item.path}`;
    await safeNavigate(itemTab, detailUrl, refererUrl);

    try {
      await itemTab.evaluate(() => {
        const btn = document.querySelector('ul#watch li:first-child, .WatchServersList li:first-child, .Watch--Btn, .btn--watch');
        if (btn) btn.click();
      });
    } catch (e) {}

    await itemTab.waitForSelector('.EpisodesList a, .Seasons--Episodes, .List--Episodes, .Episodes--List', { timeout: 3500 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    const extractDetails = async () => {
      return await itemTab.evaluate(() => {
        let seriesTitle = null;
        let seriesUrl = null;
        
        const seriesAnchor = document.querySelector('.Terms--Content--Single-begin li a[href*="/series/"]') ||
                             document.querySelector('.Series--Section > a[href*="/series/"]') ||
                             document.querySelector('a.series--name') ||
                             document.querySelector('a[href*="/series/"]');
        if (seriesAnchor) {
          seriesTitle = seriesAnchor.innerText.trim();
          seriesUrl = seriesAnchor.getAttribute('href');
        }

        let poster = '';
        const metaOgImage = document.querySelector('meta[property="og:image"]');
        const metaTwImage = document.querySelector('meta[name="twitter:image"]');
        
        if (metaOgImage && metaOgImage.content && !metaOgImage.content.includes('logo')) {
          poster = metaOgImage.content;
        } else if (metaTwImage && metaTwImage.content && !metaTwImage.content.includes('logo')) {
          poster = metaTwImage.content;
        }

        if (!poster) {
          try {
            const schemaEl = document.querySelector('script.yoast-schema-graph, script[type="application/ld+json"]');
            if (schemaEl) {
              const schemaData = JSON.parse(schemaEl.innerText);
              const graph = schemaData['@graph'] || [schemaData];
              for (const node of graph) {
                if (node.thumbnailUrl) { poster = node.thumbnailUrl; break; }
                if (node.image && node.image.url) { poster = node.image.url; break; }
              }
            }
          } catch (e) {}
        }

        if (!poster) {
          const wecimaEl = document.querySelector('wecima, .wecima--single--poster, .Poster--Single-begin');
          if (wecimaEl) {
            const rawStyle = wecimaEl.getAttribute('style') || '';
            const m = rawStyle.match(/--img:\s*url\(([^)]+)\)/i) || rawStyle.match(/url\(['"]?([^'")]+)['"]?\)/i);
            if (m) poster = m[1].replace(/['"]/g, '');
          }
        }

        if (!poster) {
          const imgEl = document.querySelector('.Poster--Single-begin img, .wecima--single--poster img, [itemprop="image"], .Poster--Single img');
          if (imgEl) {
            poster = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || imgEl.src || '';
          }
        }

        let story = '';
        const storyEl = document.querySelector('.StoryMovieContent, .AsideContext .StoryMovieContent, .PostStory, [itemprop="description"]');
        if (storyEl) {
          story = storyEl.innerText.trim();
        }

        const domServers = [];
        document.querySelectorAll('ul#watch li, .WatchServersList li, [data-watch]').forEach(li => {
          let url = li.getAttribute('data-watch') || li.getAttribute('data-url');
          const name = li.innerText.trim() || 'سيرفر مشاهدة';
          if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
            if (url.startsWith('//')) url = 'https:' + url;
            domServers.push({ name, url });
          }
        });

        let rating = null;
        const rateEl = document.querySelector('.IMDB--Rating, .Rate--Single, [itemprop="ratingValue"]');
        if (rateEl) {
          const match = rateEl.innerText.match(/(\d+(\.\d+)?)/);
          if (match) rating = parseFloat(match[1]);
        }

        const genres = [];
        document.querySelectorAll('a[href*="/genre/"]').forEach(a => {
          const txt = a.innerText.trim();
          if (txt && !genres.includes(txt)) genres.push(txt);
        });

        const episodesList = [];
        const epElements = document.querySelectorAll(
          '.EpisodesList a, .Episodes--List a, .Seasons--Episodes .EpisodesList a, .List--Episodes a, .Singles--Episodes a, .Episodes--Seasons--Episodes a, a[href*="/episode/"], a[href*="/watch/"]'
        );
        
        const seenEps = new Set();
        epElements.forEach(a => {
          const href = a.getAttribute('href');
          if (!href || href.startsWith('#') || href.includes('javascript:') || seenEps.has(href)) return;

          const titleEl = a.querySelector('episodetitle') || a.querySelector('span') || a;
          const epTitle = titleEl.innerText.trim();
          
          if (href.includes('حلقة') || href.includes('الحلقة') || href.includes('/watch/') || epTitle.includes('حلقة') || epTitle.includes('الحلقة')) {
            seenEps.add(href);
            const numMatch = epTitle.match(/(\d+)/);
            episodesList.push({
              title: epTitle || 'حلقة',
              url: href,
              episode_number: numMatch ? parseInt(numMatch[1], 10) : null
            });
          }
        });

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
    };

    let pageDetails;
    try {
      pageDetails = await extractDetails();
    } catch (e) {
      await new Promise(r => setTimeout(r, 1500));
      pageDetails = await extractDetails();
    }

    const isSeriesItem = targetType === 'series' || item.isSeries || pageDetails.seriesTitle !== null;

    if (isSeriesItem && pageDetails.episodesList.length === 0 && pageDetails.seriesUrl) {
      try {
        console.log(`🚀 [القفز لصفحة المسلسل الأصلية]: ${pageDetails.seriesUrl}`);
        const fullSeriesUrl = pageDetails.seriesUrl.startsWith('http') ? pageDetails.seriesUrl : `${PRIMARY_DOMAIN}${pageDetails.seriesUrl}`;
        await safeNavigate(itemTab, fullSeriesUrl, detailUrl);
        await itemTab.waitForSelector('.EpisodesList a, .List--Episodes, .Episodes--List', { timeout: 3500 }).catch(() => {});
        const extraEpisodes = await extractEpisodesFromPage(itemTab);
        if (extraEpisodes && extraEpisodes.length > 0) {
          pageDetails.episodesList = extraEpisodes;
          console.log(`✨ تم استخراج ${extraEpisodes.length} حلقة بنجاح من صفحة المسلسل!`);
        }
      } catch (err) {
        console.log('ملاحظة أثناء استخراج صفحة المسلسل الأم:', err.message);
      }
    }

    const baseTitle = extractBaseTitle(pageDetails.seriesTitle || item.title);
    const existingSeriesRecord = processedSeriesCache.get(baseTitle);

    const episodeMap = new Map();
    if (existingSeriesRecord && existingSeriesRecord.extra_data?.episodes) {
      existingSeriesRecord.extra_data.episodes.forEach(ep => episodeMap.set(ep.url, ep));
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

    // 1. تسجيل الحلقة الحالية مع رابط البث المباشر الصريح وسيرفراتها
    if (pageDetails.episodeNumber) {
      const currentStream = directPlayUrl || finalServers[0]?.url || null;
      episodeMap.set(item.path, {
        title: `الحلقة ${pageDetails.episodeNumber}`,
        url: item.path,
        stream_url: currentStream,
        episode_number: pageDetails.episodeNumber,
        servers: finalServers
      });
    }

    // 2. دمج الحلقات الأخرى المكتشفة في الصفحة مع الحفاظ على ما تم صيده سابقاً
    for (const ep of pageDetails.episodesList) {
      if (!episodeMap.has(ep.url)) {
        episodeMap.set(ep.url, {
          title: ep.title,
          url: ep.url,
          stream_url: null,
          episode_number: ep.episode_number,
          servers: []
        });
      }
    }

    if (isSeriesItem && pageDetails.seasonsList && pageDetails.seasonsList.length > 1) {
      await reconcileOtherSeasons(itemTab, pageDetails.seasonsList, detailUrl, episodeMap);
    }

    // 3. فحص الحلقات التي ينقصها رابط بث مباشر (أحدث 3 حلقات لتفادي إطالة وقت التنفيذ)
    if (isSeriesItem) {
      const unstreamedEps = Array.from(episodeMap.values())
        .filter(ep => !ep.stream_url && ep.url && ep.url !== item.path)
        .slice(-3); // فحص أحدث 3 حلقات فقط لضمان سرعة الكاشط وتوفير الرابط فوراً

      if (unstreamedEps.length > 0) {
        console.log(`🎬 [جلب روابط المشاهدة المباشرة]: فحص ${unstreamedEps.length} حلقات إضافية لمسلسل (${baseTitle})...`);
        for (const targetEp of unstreamedEps) {
          const resolved = await resolveEpisodeStream(browser, targetEp.url, detailUrl);
          if (resolved.stream_url) {
            targetEp.stream_url = resolved.stream_url;
            targetEp.servers = resolved.servers;
            episodeMap.set(targetEp.url, targetEp);
            console.log(`  ⚡ تم صيد رابط مباشر للحلقة (${targetEp.episode_number || targetEp.title})`);
          }
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    const contentType = isSeriesItem ? 'series' : targetType;
    const finalTitle = isSeriesItem ? baseTitle : `${baseTitle} (${item.year})`;
    const finalPageUrl = isSeriesItem && pageDetails.seriesUrl ? pageDetails.seriesUrl : item.path;

    let finalPoster = pageDetails.poster || item.poster || '';
    if (finalPoster.startsWith('//')) finalPoster = 'https:' + finalPoster;

    const mergedEpisodes = Array.from(episodeMap.values()).sort((a, b) => {
      return (a.episode_number || 0) - (b.episode_number || 0);
    });
    const hasEpisodes = mergedEpisodes.length > 0;

    // رابط العرض الرئيسي للعمل ككل (أول رابط متاح)
    const masterStreamUrl = directPlayUrl || mergedEpisodes.find(e => e.stream_url)?.stream_url || finalServers[0]?.url || detailUrl;

    await db('contents?on_conflict=page_url', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([{
        title: finalTitle,
        type: contentType,
        category: targetCategory,
        year: item.year,
        poster_url: finalPoster,
        stream_url: masterStreamUrl,
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
          episodes: hasEpisodes ? mergedEpisodes : undefined,
          status: 'success'
        },
        updated_at: new Date().toISOString()
      }])
    });

    if (isSeriesItem && hasEpisodes) {
      processedSeriesCache.set(baseTitle, {
        title: finalTitle,
        page_url: finalPageUrl,
        extra_data: { episodes: mergedEpisodes }
      });
    }

    const streamedCount = mergedEpisodes.filter(e => e.stream_url).length;
    console.log(`✅ تم الحفظ: ${finalTitle} | بوستر: ${finalPoster ? 'متوفر' : 'غير متوفر'} | إجمالي الحلقات: ${mergedEpisodes.length} (جاهزة للبث المباشر: ${streamedCount})`);
    await itemTab.close().catch(() => {});
    return true;

  } catch (err) {
    console.log(`⚠️ فشل فحص (${item.title}): ${err.message}`);
    await itemTab.close().catch(() => {});

    try {
      await db('failed_jobs', {
        method: 'POST',
        body: JSON.stringify([{
          target_path: item.path,
          category: targetCategory,
          type: targetType,
          page: 1,
          retry_count: 0,
          error_msg: err.message
        }])
      });
      console.log(`📌 تم إدراج (${item.title}) في جدول failed_jobs لإعادة المحاولة.`);
    } catch (e) {}

    return false;
  }
}

async function run() {
  console.log('🚀 بدء تشغيل الكاشط الذكي الشامل (دعم الحلقات الجديدة + المراقبة الحية + failed_jobs)...');

  let state = (await db('scraper_state?id=eq.1&select=*'))?.[0];
  if (!state) {
    const defaultState = [{ id: 1, target_index: 0, current_page: 1, initial_archive_done: 0 }];
    await db('scraper_state', { method: 'POST', body: JSON.stringify(defaultState) });
    state = defaultState[0];
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  // 1. معالجة المهام الفاشلة مسبقاً
  try {
    const failedJobs = await db('failed_jobs?retry_count=lt.3&order=id.asc&limit=3');
    if (failedJobs && failedJobs.length > 0) {
      console.log(`🛠️ [معالجة المهام الفاشلة]: جاري إعادة محاولة ${failedJobs.length} مهام معلقة...`);
      for (const job of failedJobs) {
        const dummyItem = { path: job.target_path, title: job.target_path, year: 2026, isSeries: job.type === 'series' };
        const success = await scrapeSingleItem(browser, dummyItem, PRIMARY_DOMAIN, job.category, job.type, new Map());
        if (success) {
          await db(`failed_jobs?id=eq.${job.id}`, { method: 'DELETE' });
          console.log(`🎯 تم حل المهمة الفاشلة وحذفها من failed_jobs بنجاح: ${job.target_path}`);
        } else {
          const newCount = (job.retry_count || 0) + 1;
          await db(`failed_jobs?id=eq.${job.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ retry_count: newCount })
          });
        }
      }
    }
  } catch (e) {
    console.log('ملاحظة أثناء فحص failed_jobs:', e.message);
  }

  // 2. إكمال دورة الكشط الطبيعية
  let targetIndex = (state.target_index || 0) % CATEGORY_ORDER.length;
  let page = state.current_page || 1;
  const isArchiveDone = state.initial_archive_done === 1;

  if (isArchiveDone) {
    page = 1;
    console.log(`📡 [وضع المراقبة الحية للعروض الحديثة نشط]: فحص التحديثات الحصرية أولاً بأول...`);
  }

  const target = CATEGORY_ORDER[targetIndex];
  const targetUrl = target.path === '/' 
    ? (page === 1 ? `${PRIMARY_DOMAIN}/` : `${PRIMARY_DOMAIN}/page/${page}/`)
    : `${PRIMARY_DOMAIN}${target.path}`.replace(/\/+$/, '') + (page === 1 ? '/' : `/page/${page}/`);

  console.log(`🌐 [صفحة: ${page}] | الهدف: ${targetUrl} (قسم: ${target.category} [${targetIndex + 1}/${CATEGORY_ORDER.length}])`);

  const mainTab = await browser.newPage();
  await mainTab.setViewport({ width: 1920, height: 1080 });
  await mainTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

  await safeNavigate(mainTab, `${PRIMARY_DOMAIN}/`);
  await safeNavigate(mainTab, targetUrl, `${PRIMARY_DOMAIN}/`);

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

      let decodedPath = '';
      try {
        decodedPath = decodeURIComponent(path);
      } catch (e) {
        decodedPath = path;
      }

      const isSeries = title.includes('مسلسل') || 
                       title.includes('حلقة') || 
                       title.includes('الموسم') || 
                       decodedPath.includes('مسلسل') || 
                       decodedPath.includes('حلقة');

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
  console.log(`📦 العناصر المستخرجة من الصفحة: ${items.length} عنصر.`);

  if (items.length === 0 && !isArchiveDone) {
    console.log(`ℹ️ القسم (${target.category}) لا يحتوي على عناصر إضافية في الصفحة (${page}). الانتقال للقسم التالي...`);
    let nextIndex = (targetIndex + 1) % CATEGORY_ORDER.length;
    await db('scraper_state?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({ target_index: nextIndex, current_page: 1 })
    });
    await browser.close();
    return;
  }

  const nonSeriesPaths = items.filter(i => !i.isSeries).map(i => `"${i.path}"`);
  const existingNonSeriesPaths = new Set();
  if (nonSeriesPaths.length > 0) {
    try {
      const existing = await db(`contents?select=page_url&page_url=in.(${encodeURIComponent(nonSeriesPaths.join(','))})`);
      if (existing && existing.length > 0) {
        existing.forEach(r => existingNonSeriesPaths.add(r.page_url));
      }
    } catch (e) {
      console.log('ملاحظة أثناء استرجاع المسارات المسجلة مسبقاً:', e.message);
    }
  }

  const processedSeriesCache = new Map();
  try {
    const existingSeries = await db(`contents?type=eq.series&select=title,page_url,extra_data&limit=350&order=id.desc`);
    if (existingSeries && existingSeries.length > 0) {
      existingSeries.forEach(r => {
        if (r.title) processedSeriesCache.set(r.title, r);
      });
    }
  } catch (e) {
    console.log('ملاحظة أثناء تحميل كاش المسلسلات:', e.message);
  }

  const filteredItems = [];
  const seenInCurrentPage = new Set();

  for (const item of items) {
    if (!item.isSeries && existingNonSeriesPaths.has(item.path)) {
      continue;
    }

    const base = extractBaseTitle(item.title);
    if (item.isSeries) {
      const cached = processedSeriesCache.get(base);
      if (cached && cached.extra_data?.episodes) {
        const episodeExists = cached.extra_data.episodes.some(ep => ep.url === item.path && ep.stream_url);
        if (episodeExists) {
          continue;
        } else {
          console.log(`🔥 [رصد حلقة جديدة أو تحديث بث لمسلسل]: ${item.title}`);
        }
      }
      if (seenInCurrentPage.has(base)) {
        continue;
      }
      seenInCurrentPage.add(base);
    }
    filteredItems.push(item);
  }

  console.log(`✨ عناصر جديدة تستحق الفحص والتحديث: ${filteredItems.length} عنصر (تم تخطي ${items.length - filteredItems.length} مسجل مسبقاً).`);

  for (const item of filteredItems) {
    console.log(`🔍 بدء فحص: ${item.title}`);
    await scrapeSingleItem(browser, item, targetUrl, target.category, target.type, processedSeriesCache);
    await new Promise(r => setTimeout(r, 600));
  }

  await browser.close();

  let nextIndex = targetIndex + 1;
  let nextPage = page;
  let archiveFinished = state.initial_archive_done || 0;

  if (nextIndex >= CATEGORY_ORDER.length) {
    nextIndex = 0;
    if (!isArchiveDone) {
      nextPage = page + 1;
      console.log(`🏁 اكتملت دورة الصفحة (${page}) لكافة الأقسام. الانتقال للصفحة (${nextPage})...`);
    } else {
      nextPage = 1;
    }
  }

  if (nextPage > 50) {
    nextPage = 1;
    archiveFinished = 1;
    console.log('🏆 [تم اكتمال أرشفة الموقع بالكامل!] الانتقال الدائم الآن إلى وضع المراقبة الحية للعروض الحصرية والجديدة.');
  }

  await db('scraper_state?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({ 
      target_index: nextIndex, 
      current_page: nextPage,
      initial_archive_done: archiveFinished
    })
  });

  console.log(`🎉 تم الانتهاء بنجاح. المحطة التالية: [قسم: ${CATEGORY_ORDER[nextIndex].category}] - صفحة ${nextPage}`);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
