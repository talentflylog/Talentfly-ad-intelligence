// pages/api/competitor-ads.js
// Uses Apify Facebook Ad Library Scraper (scraper-engine actor)
// Input: keywords or Ad Library URLs — works for India, all ad types

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitors = [], country = 'IN', keyword } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: 'APIFY_API_TOKEN is not set.',
      fix: 'Go to Vercel → Settings → Environment Variables → add APIFY_API_TOKEN'
    });
  }

  const searchTerms = keyword ? [keyword] : competitors.filter(Boolean);
  if (searchTerms.length === 0) return res.status(400).json({ error: 'No search terms provided' });

  const allAds = [];
  const errors = [];

  // curious_coder actor needs Ad Library URLs in the "urls" field
  // We build the Ad Library search URL for each competitor/keyword
  const urls = searchTerms.map(term =>
    `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(term)}&search_type=keyword_unordered&media_type=all`
  );

  try {
    const apifyUrl = `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120&memory=1024`;

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: urls,
        maxResults: 10,
        country: country,
      })
    });

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      // If curious_coder fails, try scraper-engine actor as fallback
      console.error('curious_coder failed:', errText);
      throw new Error(`Actor error: ${errText.slice(0, 300)}`);
    }

    const items = await apifyRes.json();

    if (Array.isArray(items) && items.length > 0) {
      items.forEach(item => normalizeAndPush(item, competitors, searchTerms, allAds));
    } else {
      throw new Error('No ads returned from curious_coder actor');
    }

  } catch (primaryErr) {
    errors.push({ actor: 'curious_coder', message: primaryErr.message });

    // FALLBACK: Try scraper-engine actor which accepts keywords directly
    try {
      const fallbackUrl = `https://api.apify.com/v2/acts/scraper-engine~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120&memory=1024`;

      const fallbackRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: searchTerms,
          country: country,
          maxResults: 10,
          sortBy: 'relevancy_monthly_grouped',
        })
      });

      if (!fallbackRes.ok) {
        const errText = await fallbackRes.text();
        throw new Error(`Fallback actor error: ${errText.slice(0, 300)}`);
      }

      const fallbackItems = await fallbackRes.json();
      if (Array.isArray(fallbackItems) && fallbackItems.length > 0) {
        fallbackItems.forEach(item => normalizeAndPush(item, competitors, searchTerms, allAds));
      } else {
        throw new Error('No ads returned from fallback actor');
      }

    } catch (fallbackErr) {
      errors.push({ actor: 'scraper-engine', message: fallbackErr.message });
    }
  }

  if (allAds.length === 0) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      errors,
      diagnosis: errors.map(e => `[${e.actor}] ${e.message}`).join(' | '),
      fix: 'The Apify scraper may have timed out. Try "Search by Keyword" with one competitor at a time, or check your Apify console at console.apify.com for run details.',
      token_preview: `${APIFY_TOKEN.slice(0, 12)}...${APIFY_TOKEN.slice(-6)}`
    });
  }

  return res.status(200).json({
    ads: allAds,
    source: 'live',
    count: allAds.length,
    partial_errors: errors.length > 0 ? errors : undefined,
  });
}

// Normalize any Apify actor output format to our internal ad schema
function normalizeAndPush(item, competitors, searchTerms, allAds) {
  // Try to match to a known competitor
  const pageName = item.pageName || item.page_name || item.advertiserName || item.advertiser || '';
  const matched = competitors.find(c =>
    pageName.toLowerCase().includes(c.toLowerCase().split(' ')[0].toLowerCase()) ||
    c.toLowerCase().includes(pageName.toLowerCase().split(' ')[0].toLowerCase())
  ) || pageName || searchTerms[0] || 'Unknown';

  // Extract body text — try multiple field names across different actors
  const bodyText =
    item.adTextBody ||
    item.body ||
    item.bodyText ||
    item.text ||
    item.ad_text ||
    item.snapshot?.body?.markup?.__html?.replace(/<[^>]+>/g, '') ||
    item.cards?.[0]?.body ||
    '';

  // Extract headline
  const headline =
    item.adCardTitle ||
    item.title ||
    item.headline ||
    item.ad_title ||
    item.snapshot?.title ||
    item.cards?.[0]?.title ||
    '';

  // Extract snapshot/library URL
  const snapshotUrl =
    item.adSnapshotUrl ||
    item.snapshot_url ||
    item.snapshotUrl ||
    item.libraryUrl ||
    item.ad_snapshot_url ||
    (item.adArchiveID ? `https://www.facebook.com/ads/library/?id=${item.adArchiveID}` : '') ||
    (item.id ? `https://www.facebook.com/ads/library/?id=${item.id}` : '') ||
    '';

  // Extract image
  const imageUrl =
    item.imageUrl ||
    item.image_url ||
    item.snapshot?.images?.[0]?.url ||
    item.snapshot?.images?.[0] ||
    item.creative?.images?.[0]?.url ||
    item.cards?.[0]?.imageUrl ||
    item.thumbnailUrl ||
    null;

  // Extract video
  const videoUrl =
    item.videoUrl ||
    item.video_url ||
    item.snapshot?.videos?.[0]?.video_hd_url ||
    item.snapshot?.videos?.[0]?.video_sd_url ||
    item.creative?.videos?.[0]?.url ||
    null;

  const ad = {
    id: item.adArchiveID || item.id || item.adId || String(Math.random()),
    _competitor: matched,
    _source: 'live',
    page_name: pageName,
    page_id: item.pageID || item.page_id || item.pageId || '',
    ad_creative_bodies: bodyText ? [bodyText] : [''],
    ad_creative_link_titles: headline ? [headline] : [''],
    ad_creative_link_captions: item.caption ? [item.caption] : item.adCardCaption ? [item.adCardCaption] : [''],
    ad_delivery_start_time: item.startDate || item.start_date || item.createdAt || item.ad_delivery_start_time || '',
    ad_delivery_stop_time: item.endDate || item.end_date || item.ad_delivery_stop_time || '',
    ad_snapshot_url: snapshotUrl,
    publisher_platforms: item.publisherPlatform || item.publisher_platforms || item.platforms || ['facebook'],
    spend: item.spend || item.spendRange || item.estimatedSpend || null,
    impressions: item.impressions || item.impressionRange || null,
    demographic_distribution: item.demographicDistribution || item.demographic_distribution || [],
    _image_url: imageUrl,
    _video_url: videoUrl,
    _cta: item.ctaText || item.cta || item.snapshot?.cta_text || null,
    _link_url: item.linkUrl || item.destinationUrl || item.snapshot?.link_url || null,
    _raw: item,
  };

  allAds.push(ad);
}
