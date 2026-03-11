// pages/api/competitor-ads.js
// Fetches real ads from Meta Ad Library via Apify actor XtaWFhbtfxyzqrFmd

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitorUrls = [], country = 'IN' } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: 'APIFY_API_TOKEN is not set in environment variables.',
      fix: 'Go to Vercel → Settings → Environment Variables → add APIFY_API_TOKEN',
    });
  }

  if (!competitorUrls.length) {
    return res.status(400).json({ error: 'No competitor URLs provided' });
  }

  // 512MB RAM per URL — Apify requires at least 1 URL per 512MB
  const memory = Math.min(competitorUrls.length * 512, 4096);

  const input = {
    urls: competitorUrls.map(u => ({ url: u })),
    count: 20,
    'scrapePageAds.period': '',
    'scrapePageAds.activeStatus': 'all',
    'scrapePageAds.sortBy': 'impressions_desc',
    'scrapePageAds.countryCode': country,
  };

  try {
    // Start the Apify actor run
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/XtaWFhbtfxyzqrFmd/runs?token=${APIFY_TOKEN}&memory=${memory}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
    );
    if (!startRes.ok) {
      const errText = await startRes.text();
      throw new Error(`Failed to start Apify actor: HTTP ${startRes.status} — ${errText.slice(0, 300)}`);
    }

    const runData = await startRes.json();
    const runId = runData.data?.id;
    const datasetId = runData.data?.defaultDatasetId;
    if (!runId) throw new Error('No run ID returned from Apify. Check your API token.');

    // Poll until finished (max 120 seconds)
    let status = 'RUNNING';
    let attempts = 0;
    while (['RUNNING', 'READY', 'TIMING-OUT'].includes(status)) {
      await new Promise(r => setTimeout(r, 4000));
      attempts++;
      if (attempts > 30) throw new Error('Apify run timed out after 120s. Try fewer URLs.');
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      status = (await statusRes.json()).data?.status;
      if (['FAILED', 'ABORTED'].includes(status)) throw new Error(`Apify actor run ${status}. Check console.apify.com for logs.`);
    }

    // Fetch results
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=100`
    );
    if (!dataRes.ok) throw new Error(`Failed to fetch dataset: HTTP ${dataRes.status}`);

    const items = await dataRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        ads: [], source: 'error', count: 0, api_blocked: true,
        diagnosis: 'Apify ran successfully but returned 0 ads.',
        fix: 'These pages may not have active ads. Try different competitor URLs or check the Ad Library manually.',
      });
    }

    // Check for actor-level error in first item
    if (items[0]?.error) {
      return res.status(200).json({
        ads: [], source: 'error', count: 0, api_blocked: true,
        diagnosis: items[0].error,
        fix: 'Adjust the request — check Apify actor logs at console.apify.com',
      });
    }

    const allAds = items.map(item => normalize(item));
    return res.status(200).json({ ads: allAds, source: 'live', count: allAds.length });

  } catch (e) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: e.message,
      fix: e.message.includes('timeout') || e.message.includes('timed out')
        ? 'Try one competitor URL at a time, or reduce count.'
        : 'Check console.apify.com → Runs for detailed error logs.',
      token_preview: `${APIFY_TOKEN.slice(0, 12)}...${APIFY_TOKEN.slice(-6)}`,
    });
  }
}

// Normalize raw Apify item into clean ad object
function normalize(item) {
  const snapshot = item.snapshot || {};
  const cards = snapshot.cards || [];
  const firstCard = cards[0] || {};

  // Page info
  const pageName = snapshot.page_name || '';
  const pageProfilePic = snapshot.page_profile_picture_url || '';
  const pageProfileUri = snapshot.page_profile_uri || '';

  // Ad content — first card, fallback to snapshot root
  const headline = firstCard.title || snapshot.title || '';
  const body = firstCard.body || snapshot.body || '';
  const ctaText = firstCard.cta_text || snapshot.cta_text || '';
  const ctaType = firstCard.cta_type || '';
  const linkUrl = firstCard.link_url || snapshot.link_url || '';
  const linkDescription = firstCard.link_description || '';
  const caption = firstCard.caption || snapshot.caption || '';

  // Media — prefer resized (faster load), fallback to original
  const imageUrl =
    firstCard.resized_image_url || firstCard.original_image_url ||
    snapshot.resized_image_url || snapshot.original_image_url || null;
  const videoUrl =
    firstCard.video_hd_url || firstCard.video_sd_url ||
    snapshot.video_hd_url || snapshot.video_sd_url || null;
  const videoThumb = firstCard.video_preview_image_url || snapshot.video_preview_image_url || null;

  // All cards for carousel ads
  const allCards = cards.map(card => ({
    title: card.title || '',
    body: card.body || '',
    cta_text: card.cta_text || '',
    cta_type: card.cta_type || '',
    link_url: card.link_url || '',
    link_description: card.link_description || '',
    caption: card.caption || '',
    image_url: card.resized_image_url || card.original_image_url || null,
    video_url: card.video_hd_url || card.video_sd_url || null,
    video_thumb: card.video_preview_image_url || null,
  }));

  // Date parsing — Apify can return Unix timestamps (seconds) or ISO strings
  const parseDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') return new Date(val * 1000).toISOString();
    if (typeof val === 'string' && val.includes('T')) return val;
    if (typeof val === 'string' && /^\d+$/.test(val)) return new Date(parseInt(val) * 1000).toISOString();
    return null;
  };

  const startDate = parseDate(item.startDate || item.start_date || item.ad_delivery_start_time);
  const endDate = parseDate(item.endDate || item.end_date || item.ad_delivery_stop_time);

  // Ad Library URL
  const archiveId = item.ad_archive_id || item.adArchiveID || item.id || '';
  const snapshotUrl = archiveId
    ? `https://www.facebook.com/ads/library/?id=${archiveId}`
    : pageProfileUri || '';

  const platforms = item.publisherPlatform || item.publisher_platforms || ['facebook'];

  return {
    id: archiveId || String(Math.random()),
    ad_archive_id: archiveId,
    page_id: item.page_id || snapshot.page_id || '',

    // Page
    _competitor: pageName || 'Unknown',
    page_name: pageName,
    page_profile_picture_url: pageProfilePic,
    page_profile_uri: pageProfileUri,

    // Content
    headline,
    body,
    cta_text: ctaText,
    cta_type: ctaType,
    link_url: linkUrl,
    link_description: linkDescription,
    caption,

    // Also keep old field names so frontend works either way
    ad_creative_link_titles: headline ? [headline] : [],
    ad_creative_bodies: body ? [body] : [],
    _cta: ctaText,
    _link_url: linkUrl,

    // Media
    _image_url: imageUrl,
    _video_url: videoUrl,
    _video_thumb: videoThumb,

    // All carousel cards
    cards: allCards,

    // Dates
    ad_delivery_start_time: startDate,
    ad_delivery_stop_time: endDate,

    // Distribution
    publisher_platforms: Array.isArray(platforms) ? platforms : [platforms],
    collation_count: item.collation_count || 1,

    // Links
    ad_snapshot_url: snapshotUrl,

    // These come from Meta Ad Library API directly — not available via Apify scraper
    spend: null,
    impressions: null,
    demographic_distribution: [],

    _source: 'live',
  };
}
