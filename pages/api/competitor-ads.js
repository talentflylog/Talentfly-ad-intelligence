// pages/api/competitor-ads.js
// Actor: XtaWFhbtfxyzqrFmd (curious_coder/facebook-ads-library-scraper)
// Uses exact input schema from Apify docs

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitorUrls = [], country = 'IN' } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: 'APIFY_API_TOKEN is not set.',
      fix: 'Vercel → Settings → Environment Variables → add APIFY_API_TOKEN'
    });
  }

  if (!competitorUrls.length) {
    return res.status(400).json({ error: 'No competitor URLs provided' });
  }

  // Build input exactly as shown in Apify docs
  const input = {
    urls: competitorUrls.map(u => ({ url: u })),
    count: 20,
    "scrapePageAds.period": "",
    "scrapePageAds.activeStatus": "all",
    "scrapePageAds.sortBy": "impressions_desc",
    "scrapePageAds.countryCode": country,
  };

  try {
    // Step 1: Start the actor run
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/XtaWFhbtfxyzqrFmd/runs?token=${APIFY_TOKEN}&memory=1024`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      throw new Error(`Failed to start actor: HTTP ${startRes.status} — ${errText.slice(0, 300)}`);
    }

    const runData = await startRes.json();
    const runId = runData.data?.id;
    const datasetId = runData.data?.defaultDatasetId;

    if (!runId) throw new Error('No run ID returned from Apify');

    // Step 2: Poll until finished (max 90s)
    let status = 'RUNNING';
    let attempts = 0;
    while (status === 'RUNNING' || status === 'READY' || status === 'TIMING-OUT') {
      await new Promise(r => setTimeout(r, 4000));
      attempts++;
      if (attempts > 22) throw new Error('Actor run timed out after 90s. Try fewer URLs or use Search by Keyword.');

      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      const statusData = await statusRes.json();
      status = statusData.data?.status;

      if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(`Actor run ${status}. Check console.apify.com for logs.`);
      }
    }

    // Step 3: Fetch results from dataset
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=100`
    );

    if (!dataRes.ok) throw new Error(`Failed to fetch dataset: HTTP ${dataRes.status}`);

    const items = await dataRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        ads: [], source: 'error', count: 0, api_blocked: true,
        diagnosis: 'Actor ran successfully but returned no ads.',
        fix: 'These pages may not have active ads. Try different competitor URLs or check the Ad Library manually.'
      });
    }

    const allAds = items.map(item => normalize(item, competitorUrls));

    return res.status(200).json({ ads: allAds, source: 'live', count: allAds.length });

  } catch (e) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: e.message,
      fix: e.message.includes('timeout') || e.message.includes('timed out')
        ? 'Try one competitor URL at a time, or reduce count to 10.'
        : 'Check console.apify.com → Runs for detailed error logs.',
      token_preview: `${APIFY_TOKEN.slice(0, 12)}...${APIFY_TOKEN.slice(-6)}`
    });
  }
}

function normalize(item, competitorUrls) {
  const pageName =
    item.pageName || item.page_name || item.advertiserName ||
    item.advertiser || item.pageInfo?.name || '';

  const bodyText =
    item.adTextBody || item.body || item.bodyText || item.text || item.adText ||
    item.snapshot?.body?.markup?.__html?.replace(/<[^>]+>/g, '') ||
    item.cards?.[0]?.body || '';

  const headline =
    item.adCardTitle || item.title || item.headline ||
    item.snapshot?.title || item.cards?.[0]?.title || '';

  const snapshotUrl =
    item.adSnapshotUrl || item.snapshot_url || item.snapshotUrl ||
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
    _competitor: pageName || 'Unknown',
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
