// pages/api/competitor-ads.js
// Uses Apify's Facebook Ad Library Scraper to get REAL ads from India
// Actor: curious_coder/facebook-ads-library-scraper (~$0.75/1000 ads)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitors = [], country = 'IN', keyword } = req.body;
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: 'APIFY_API_TOKEN is not set in Vercel environment variables.',
      fix: 'Go to Vercel → Project Settings → Environment Variables → add APIFY_API_TOKEN'
    });
  }

  const searchTerms = keyword ? [keyword] : competitors.filter(Boolean);
  if (searchTerms.length === 0) return res.status(400).json({ error: 'No competitors or keyword provided' });

  const allAds = [];
  const errors = [];

  for (const term of searchTerms) {
    try {
      // Build the Ad Library search URL for this competitor/keyword
      const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(term)}&search_type=keyword_unordered&media_type=all`;

      // Run Apify actor synchronously and get results directly
      const apifyUrl = `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60&memory=512`;

      const apifyRes = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerm: term,
          country: country,
          adType: 'ALL',
          adActiveStatus: 'ALL',
          pageLimit: 3,
          maxResults: 15,
        })
      });

      if (!apifyRes.ok) {
        const errText = await apifyRes.text();
        errors.push({ term, message: `Apify HTTP ${apifyRes.status}: ${errText.slice(0, 200)}` });
        continue;
      }

      const items = await apifyRes.json();

      if (!Array.isArray(items) || items.length === 0) {
        errors.push({ term, message: 'No ads returned for this search term' });
        continue;
      }

      // Normalize Apify output to our internal format
      items.forEach(item => {
        const ad = {
          id: item.adArchiveID || item.id || item.adId || String(Math.random()),
          _competitor: competitors.find(c =>
            (item.pageName || '').toLowerCase().includes(c.toLowerCase().split(' ')[0].toLowerCase())
          ) || item.pageName || term,
          _search_term: term,
          _source: 'live',
          page_name: item.pageName || item.page_name || term,
          page_id: item.pageID || item.page_id || '',
          ad_creative_bodies: item.adTextBody ? [item.adTextBody]
            : item.snapshot?.body?.markup?.__html ? [item.snapshot.body.markup.__html.replace(/<[^>]+>/g, '')]
            : item.bodyText ? [item.bodyText]
            : item.text ? [item.text]
            : [''],
          ad_creative_link_titles: item.adCardTitle ? [item.adCardTitle]
            : item.snapshot?.title ? [item.snapshot.title]
            : item.title ? [item.title]
            : [''],
          ad_creative_link_captions: item.adCardCaption ? [item.adCardCaption]
            : item.caption ? [item.caption]
            : [''],
          ad_creative_link_descriptions: item.adCardDescription ? [item.adCardDescription]
            : item.description ? [item.description]
            : [''],
          ad_delivery_start_time: item.startDate || item.ad_delivery_start_time || item.startDateFormatted || '',
          ad_delivery_stop_time: item.endDate || item.ad_delivery_stop_time || '',
          ad_snapshot_url: item.adSnapshotUrl || item.snapshot_url || item.snapshotUrl
            || `https://www.facebook.com/ads/library/?id=${item.adArchiveID || item.id || ''}`,
          publisher_platforms: item.publisherPlatform || item.publisher_platforms || ['facebook'],
          spend: item.spend || item.spendRange || null,
          impressions: item.impressions || item.impressionRange || null,
          demographic_distribution: item.demographicDistribution || item.demographic_distribution || [],
          // Keep raw data for debugging
          _raw: item,
          // Image/video
          _image_url: item.snapshot?.images?.[0]?.url || item.imageUrl || item.creative?.images?.[0] || null,
          _video_url: item.snapshot?.videos?.[0]?.video_hd_url || item.videoUrl || null,
          _cta: item.snapshot?.cta_text || item.ctaText || item.cta || null,
          _link_url: item.snapshot?.link_url || item.linkUrl || item.destinationUrl || null,
        };
        allAds.push(ad);
      });

    } catch (e) {
      errors.push({ term, message: `Error: ${e.message}` });
    }
  }

  if (allAds.length === 0) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      errors,
      diagnosis: errors[0]?.message || 'No ads found — Apify actor may have timed out or returned empty results.',
      fix: errors[0]?.message?.includes('timeout')
        ? 'The scraper timed out. Try fewer competitors at once or search by keyword instead.'
        : 'Check that APIFY_API_TOKEN is correct in Vercel environment variables.',
      token_preview: APIFY_TOKEN ? `${APIFY_TOKEN.slice(0, 12)}...${APIFY_TOKEN.slice(-6)}` : 'not set'
    });
  }

  return res.status(200).json({
    ads: allAds,
    source: 'live',
    count: allAds.length,
    partial_errors: errors.length > 0 ? errors : undefined,
  });
}
