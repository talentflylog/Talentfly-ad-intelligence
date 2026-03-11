// pages/api/competitor-ads.js
// Actor: curious_coder/facebook-ads-library-scraper (XtaWFhbtfxyzqrFmd)
// Input: urls[] — Ad Library search URLs

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitors = [], country = 'IN', keyword } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: 'APIFY_API_TOKEN is not set.',
      fix: 'Vercel → Settings → Environment Variables → add APIFY_API_TOKEN'
    });
  }

  const searchTerms = keyword ? [keyword] : competitors.filter(Boolean);
  if (!searchTerms.length) return res.status(400).json({ error: 'No search terms' });

  // Build exact Ad Library URLs like the ones shown in the Apify input form
  const urls = searchTerms.map(term => ({
    url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(term)}&search_type=keyword_unordered&media_type=all`
  }));

  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/XtaWFhbtfxyzqrFmd/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120&memory=1024`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      }
    );

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      throw new Error(`Apify HTTP ${apifyRes.status}: ${errText.slice(0, 400)}`);
    }

    const items = await apifyRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        ads: [], source: 'error', count: 0, api_blocked: true,
        diagnosis: 'Apify returned no results. These competitors may not have active ads, or try a different keyword.',
        fix: 'Try "Search by Keyword" with a broader term like "coaching Kerala" or "logistics institute India".'
      });
    }

    const allAds = items.map(item => normalize(item, competitors, searchTerms));

    return res.status(200).json({ ads: allAds, source: 'live', count: allAds.length });

  } catch (e) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: e.message,
      fix: e.message.includes('timeout')
        ? 'Timed out — try fewer competitors or use "Search by Keyword" with one term.'
        : 'Check console.apify.com for run logs.',
      token_preview: `${APIFY_TOKEN.slice(0, 12)}...${APIFY_TOKEN.slice(-6)}`
    });
  }
}

function normalize(item, competitors, searchTerms) {
  const pageName =
    item.pageName || item.page_name || item.advertiserName || item.advertiser ||
    item.pageInfo?.name || '';

  const matched = competitors.find(c =>
    pageName.toLowerCase().includes(c.toLowerCase().split(' ')[0].toLowerCase()) ||
    c.toLowerCase().includes(pageName.toLowerCase().split(' ')[0].toLowerCase())
  ) || pageName || searchTerms[0] || 'Unknown';

  const bodyText =
    item.adTextBody || item.body || item.bodyText || item.text || item.adText ||
    item.snapshot?.body?.markup?.__html?.replace(/<[^>]+>/g, '') ||
    item.cards?.[0]?.body || '';

  const headline =
    item.adCardTitle || item.title || item.headline ||
    item.snapshot?.title || item.cards?.[0]?.title || '';

  const snapshotUrl =
    item.adSnapshotUrl || item.snapshot_url || item.snapshotUrl || item.ad_snapshot_url ||
    (item.adArchiveID ? `https://www.facebook.com/ads/library/?id=${item.adArchiveID}` : '') ||
    (item.id ? `https://www.facebook.com/ads/library/?id=${item.id}` : '') || '';

  const imageUrl =
    item.imageUrl || item.image_url ||
    item.snapshot?.images?.[0]?.url || item.snapshot?.images?.[0] ||
    item.cards?.[0]?.imageUrl || item.thumbnailUrl || item.images?.[0] || null;

  const videoUrl =
    item.videoUrl || item.video_url ||
    item.snapshot?.videos?.[0]?.video_hd_url ||
    item.snapshot?.videos?.[0]?.video_sd_url ||
    item.videos?.[0] || null;

  return {
    id: item.adArchiveID || item.id || item.adId || String(Math.random()),
    _competitor: matched,
    _source: 'live',
    page_name: pageName,
    page_id: item.pageID || item.page_id || item.pageId || '',
    ad_creative_bodies: bodyText ? [bodyText] : [''],
    ad_creative_link_titles: headline ? [headline] : [''],
    ad_creative_link_captions: item.caption || item.adCardCaption ? [item.caption || item.adCardCaption] : [''],
    ad_delivery_start_time: item.startDate || item.start_date || item.createdAt || '',
    ad_delivery_stop_time: item.endDate || item.end_date || '',
    ad_snapshot_url: snapshotUrl,
    publisher_platforms: item.publisherPlatform || item.publisher_platforms || ['facebook'],
    spend: item.spend || item.spendRange || null,
    impressions: item.impressions || item.impressionRange || null,
    demographic_distribution: item.demographicDistribution || item.demographic_distribution || [],
    _image_url: imageUrl,
    _video_url: videoUrl,
    _cta: item.ctaText || item.cta || item.snapshot?.cta_text || null,
    _link_url: item.linkUrl || item.destinationUrl || item.snapshot?.link_url || null,
    _raw: item,
  };
}
