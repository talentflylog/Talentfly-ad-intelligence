// Temporary debug endpoint - shows raw Apify response
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitorUrls } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  const input = {
    urls: competitorUrls.map(u => ({ url: u })),
    count: 3, // just 3 ads for debugging
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
  while (['RUNNING','READY','TIMING-OUT'].includes(status)) {
    await new Promise(r => setTimeout(r, 4000));
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    status = (await s.json()).data?.status;
    if (['FAILED','ABORTED'].includes(status)) break;
  }

  const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=3`);
  const items = await dataRes.json();

  // Return the FULL raw first item so we can see all fields
  return res.status(200).json({
    status,
    total_items: items.length,
    first_item_keys: items[0] ? Object.keys(items[0]) : [],
    first_item_full: items[0] || null,
    second_item_keys: items[1] ? Object.keys(items[1]) : [],
  });
}
