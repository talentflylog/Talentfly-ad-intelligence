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

  const input = {
    urls: competitorUrls.map(u => ({ url: u })),
    count: 10, // ✅ FIXED: minimum is 10
    "scrapePageAds.period": "",
    "scrapePageAds.activeStatus": "all",
    "scrapePageAds.sortBy": "impressions_desc",
    "scrapePageAds.countryCode": "IN",
  };

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/XtaWFhbtfxyzqrFmd/runs?token=${APIFY_TOKEN}&memory=1024`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  );
  const runData = await startRes.json();
  const runId = runData.data?.id;
  const datasetId = runData.data?.defaultDatasetId;

  let status = 'RUNNING';
  while (['RUNNING', 'READY', 'TIMING-OUT'].includes(status)) {
    await new Promise(r => setTimeout(r, 4000));
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    status = (await s.json()).data?.status;
    if (['FAILED', 'ABORTED'].includes(status)) break;
  }

  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=10`
  );
  const items = await dataRes.json();

  // ✅ Extract the rich fields from each ad
  const ads = items.map(item => ({
    ad_archive_id: item.ad_archive_id,
    page_id: item.page_id,
    page_name: item.snapshot?.page_name,
    page_profile_picture_url: item.snapshot?.page_profile_picture_url,
    page_profile_uri: item.snapshot?.page_profile_uri,

    // Ad content from cards
    cards: (item.snapshot?.cards || []).map(card => ({
      title: card.title,
      body: card.body,
      cta_text: card.cta_text,
      cta_type: card.cta_type,
      link_url: card.link_url,
      link_description: card.link_description,
      caption: card.caption,
      original_image_url: card.original_image_url,
      resized_image_url: card.resized_image_url,
      video_hd_url: card.video_hd_url,
      video_sd_url: card.video_sd_url,
      video_preview_image_url: card.video_preview_image_url,
    })),

    // Top-level caption/CTA (sometimes present outside cards)
    caption: item.snapshot?.caption,
    cta_text: item.snapshot?.cta_text,

    // Meta
    collation_count: item.collation_count,
    collation_id: item.collation_id,
  }));

  return res.status(200).json({
    status,
    total_items: items.length,
    ads,
    // Keep raw first item for debugging
    raw_first_item: items[0] || null,
  });
}
