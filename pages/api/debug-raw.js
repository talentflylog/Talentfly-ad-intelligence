// Temporary debug endpoint - shows raw Apify response
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitorUrls } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  // ✅ FIX 1: Use 512MB RAM so 1 URL is enough (1GB requires 2+ URLs)
  const memory = competitorUrls.length >= 2 ? 1024 : 512;

  const input = {
    urls: competitorUrls.map(u => ({ url: u })),
    count: 10,
    "scrapePageAds.period": "",
    "scrapePageAds.activeStatus": "all",
    "scrapePageAds.sortBy": "impressions_desc",
    "scrapePageAds.countryCode": "IN",
  };

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/XtaWFhbtfxyzqrFmd/runs?token=${APIFY_TOKEN}&memory=${memory}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  );
  const runData = await startRes.json();
  const runId = runData.data?.id;
  const datasetId = runData.data?.defaultDatasetId;

  if (!runId) {
    return res.status(500).json({ error: 'Failed to start Apify run', details: runData });
  }

  let status = 'RUNNING';
  let attempts = 0;
  while (['RUNNING', 'READY', 'TIMING-OUT'].includes(status) && attempts < 30) {
    await new Promise(r => setTimeout(r, 4000));
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    status = (await s.json()).data?.status;
    attempts++;
    if (['FAILED', 'ABORTED'].includes(status)) break;
  }

  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=10`
  );
  const items = await dataRes.json();

  // ✅ FIX 2: Check for errors in items
  if (items[0]?.error) {
    return res.status(500).json({ error: items[0].error });
  }

  // ✅ FIX 3: Correct field mapping matching actual Apify response structure
  const ads = items.map(item => {
    const snapshot = item.snapshot || {};
    const cards = snapshot.cards || [];

    const firstCard = cards[0] || {};
    const body = firstCard.body || snapshot.body || '';
    const title = firstCard.title || snapshot.title || '';
    const ctaText = firstCard.cta_text || snapshot.cta_text || '';
    const linkUrl = firstCard.link_url || snapshot.link_url || '';
    const imageUrl = firstCard.resized_image_url || firstCard.original_image_url
      || snapshot.resized_image_url || snapshot.original_image_url || '';
    const videoUrl = firstCard.video_hd_url || firstCard.video_sd_url
      || snapshot.video_hd_url || snapshot.video_sd_url || '';

    return {
      ad_archive_id: item.ad_archive_id,
      page_id: item.page_id || snapshot.page_id,
      page_name: snapshot.page_name || 'Unknown',
      page_profile_picture_url: snapshot.page_profile_picture_url || '',
      page_profile_uri: snapshot.page_profile_uri || '',

      headline: title,
      body: body,
      cta_text: ctaText,
      cta_type: firstCard.cta_type || '',
      link_url: linkUrl,
      link_description: firstCard.link_description || '',
      caption: firstCard.caption || snapshot.caption || '',

      image_url: imageUrl,
      video_url: videoUrl,
      video_preview_image_url: firstCard.video_preview_image_url || '',

      // All cards (for carousel ads)
      cards: cards.map(card => ({
        title: card.title || '',
        body: card.body || '',
        cta_text: card.cta_text || '',
        cta_type: card.cta_type || '',
        link_url: card.link_url || '',
        link_description: card.link_description || '',
        image_url: card.resized_image_url || card.original_image_url || '',
        video_url: card.video_hd_url || card.video_sd_url || '',
      })),

      collation_count: item.collation_count || 1,
    };
  });

  return res.status(200).json({
    status,
    total_items: items.length,
    ads,
    raw_first_item: items[0] || null,
  });
}
