// pages/api/competitor-ads.js
// Primary:  igolaizola/facebook-ad-library-scraper  (keyword + country)
// Fallback: leadsbrary/meta-ads-library-scraper     (keyword + country)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitors = [], country = 'IN', keyword } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: 'APIFY_API_TOKEN is not set in Vercel environment variables.',
      fix: 'Go to Vercel → Settings → Environment Variables → add APIFY_API_TOKEN'
    });
  }

  const searchTerms = keyword ? [keyword] : competitors.filter(Boolean);
  if (searchTerms.length === 0) return res.status(400).json({ error: 'No search terms provided' });

  const allAds = [];
  const errors = [];

  for (const term of searchTerms) {
    let success = false;

    // ── PRIMARY: igolaizola/facebook-ad-library-scraper ──────────────────
    try {
      const r = await fetch(
        `https://api.apify.com/v2/acts/igolaizola~facebook-ad-library-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=90&memory=512`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchQuery: term,
            country:     country,
            maxItems:    15,
            category:    'ALL',
            activeStatus: 'ALL',
            proxyConfiguration: { useApifyProxy: true },
          })
        }
      );

      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const items = await r.json();
      if (!Array.isArray(items) || items.length === 0) throw new Error('Empty result');

      items.forEach(item => normalizeAndPush(item, competitors, term, allAds));
      success = true;

    } catch (e) {
      errors.push({ term, actor: 'igolaizola', message: e.message });
    }

    // ── FALLBACK: leadsbrary/meta-ads-library-scraper ─────────────────────
    if (!success) {
      try {
        const r = await fetch(
          `https://api.apify.com/v2/acts/leadsbrary~meta-ads-library-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=90&memory=512`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchQuery: term,
              country:     country,
              maxResults:  15,
              adStatus:    'ALL',
            })
          }
        );

        if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const items = await r.json();
        if (!Array.isArray(items) || items.length === 0) throw new Error('Empty result');

        items.forEach(item => normalizeAndPush(item, competitors, term, allAds));
        success = true;

      } catch (e) {
        errors.push({ term, actor: 'leadsbrary', message: e.message });
      }
    }
  }

  if (allAds.length === 0) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      errors,
      diagnosis: errors.map(e => `[${e.actor}] ${e.message}`).join(' | '),
      fix: 'Both Apify actors failed. Check console.apify.com to see run details. Try "Search by Keyword" with one term at a time.',
      token_preview: `${APIFY_TOKEN.slice(0, 12)}...${APIFY_TOKEN.slice(-6)}`
    });
  }

  return res.status(200).json({
    ads:    allAds,
    source: 'live',
    count:  allAds.length,
    partial_errors: errors.length ? errors : undefined,
  });
}

// ── Normalise any Apify actor output into our internal ad schema ─────────────
function normalizeAndPush(item, competitors, term, allAds) {
  const pageName =
    item.pageName || item.page_name || item.advertiserName ||
    item.advertiser || item.pageInfo?.name || '';

  const matched = competitors.find(c =>
    pageName.toLowerCase().includes(c.toLowerCase().split(' ')[0].toLowerCase()) ||
    c.toLowerCase().includes(pageName.toLowerCase().split(' ')[0].toLowerCase())
  ) || pageName || term;

  // Body text — try every known field name
  const bodyText =
    item.adTextBody || item.body || item.bodyText || item.text ||
    item.ad_text || item.adText || item.description ||
    item.snapshot?.body?.markup?.__html?.replace(/<[^>]+>/g, '') ||
    item.cards?.[0]?.body || '';

  // Headline
  const headline =
    item.adCardTitle || item.title || item.headline || item.ad_title ||
    item.snapshot?.title || item.cards?.[0]?.title || '';

  // Snapshot / Ad Library URL
  const snapshotUrl =
    item.adSnapshotUrl || item.snapshot_url || item.snapshotUrl ||
    item.libraryUrl || item.ad_snapshot_url || item.adLibraryUrl ||
    (item.adArchiveID ? `https://www.facebook.com/ads/library/?id=${item.adArchiveID}` : '') ||
    (item.id          ? `https://www.facebook.com/ads/library/?id=${item.id}`          : '') ||
    '';

  // Image
  const imageUrl =
    item.imageUrl || item.image_url ||
    item.snapshot?.images?.[0]?.url || item.snapshot?.images?.[0] ||
    item.creative?.images?.[0]?.url ||
    item.cards?.[0]?.imageUrl || item.thumbnailUrl ||
    item.images?.[0] || null;

  // Video
  const videoUrl =
    item.videoUrl || item.video_url ||
    item.snapshot?.videos?.[0]?.video_hd_url ||
    item.snapshot?.videos?.[0]?.video_sd_url ||
    item.creative?.videos?.[0]?.url ||
    item.videos?.[0] || null;

  allAds.push({
    id: item.adArchiveID || item.id || item.adId || String(Math.random()),
    _competitor:  matched,
    _source:      'live',
    page_name:    pageName,
    page_id:      item.pageID || item.page_id || item.pageId || '',
    ad_creative_bodies:      bodyText  ? [bodyText]  : [''],
    ad_creative_link_titles: headline  ? [headline]  : [''],
    ad_creative_link_captions: item.caption || item.adCardCaption ? [item.caption || item.adCardCaption] : [''],
    ad_delivery_start_time:  item.startDate  || item.start_date  || item.createdAt || '',
    ad_delivery_stop_time:   item.endDate    || item.end_date    || '',
    ad_snapshot_url:         snapshotUrl,
    publisher_platforms:     item.publisherPlatform || item.publisher_platforms || item.platforms || ['facebook'],
    spend:                   item.spend || item.spendRange || item.estimatedSpend || null,
    impressions:             item.impressions || item.impressionRange || null,
    demographic_distribution: item.demographicDistribution || item.demographic_distribution || [],
    _image_url: imageUrl,
    _video_url: videoUrl,
    _cta:       item.ctaText  || item.cta  || item.snapshot?.cta_text  || null,
    _link_url:  item.linkUrl  || item.destinationUrl || item.snapshot?.link_url || null,
    _raw:       item,
  });
}
