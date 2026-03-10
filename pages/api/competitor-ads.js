// pages/api/competitor-ads.js
// Fetches REAL ads from Meta Ad Library API only.
// NO fake/AI generated ads. Shows exact error if API is blocked.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitors = [], country = 'IN', keyword } = req.body;
  const META_TOKEN = process.env.META_ACCESS_TOKEN;

  if (!META_TOKEN) {
    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      diagnosis: 'META_ACCESS_TOKEN is not set in Vercel environment variables.',
      fix: 'Go to Vercel → Project Settings → Environment Variables → add META_ACCESS_TOKEN'
    });
  }

  const fields = 'id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,currency,demographic_distribution,estimated_audience_size,impressions,languages,page_id,page_name,publisher_platforms,spend,bylines';

  const searchTerms = keyword ? [keyword] : competitors.filter(Boolean);
  if (searchTerms.length === 0) return res.status(400).json({ error: 'No competitors or keyword provided' });

  const allAds = [];
  const errors = [];

  for (const term of searchTerms) {
    const url = new URL('https://graph.facebook.com/v20.0/ads_archive');
    url.searchParams.set('access_token', META_TOKEN);
    url.searchParams.set('search_terms', term);
    url.searchParams.set('ad_reached_countries', country);
    url.searchParams.set('ad_active_status', 'ALL');
    url.searchParams.set('fields', fields);
    url.searchParams.set('limit', '20');

    try {
      const resp = await fetch(url.toString());
      const data = await resp.json();

      if (data.error) {
        errors.push({ term, code: data.error.code, type: data.error.type, message: data.error.message });
        continue;
      }

      const ads = data.data || [];
      ads.forEach(ad => {
        ad._search_term = term;
        ad._source = 'live';
        const matched = competitors.find(c =>
          (ad.page_name || '').toLowerCase().includes(c.toLowerCase().split(' ')[0]) ||
          c.toLowerCase().includes((ad.page_name || '').toLowerCase().split(' ')[0])
        );
        ad._competitor = matched || ad.page_name || term;
      });
      allAds.push(...ads);

      // Paginate up to 3 pages
      let nextUrl = data.paging?.next;
      let page = 1;
      while (nextUrl && page < 3) {
        const nr = await fetch(nextUrl);
        const nd = await nr.json();
        if (nd.error || !nd.data) break;
        nd.data.forEach(ad => { ad._search_term = term; ad._source = 'live'; ad._competitor = ad.page_name || term; });
        allAds.push(...nd.data);
        nextUrl = nd.paging?.next;
        page++;
      }
    } catch (e) {
      errors.push({ term, message: `Network error: ${e.message}` });
    }
  }

  if (allAds.length === 0 && errors.length > 0) {
    const err = errors[0];
    let diagnosis = err.message || 'Unknown error from Meta API';
    let fix = '';

    if (err.code === 200 || (err.message || '').toLowerCase().includes('permission')) {
      diagnosis = `Permission denied (code ${err.code}): "${err.message}"`;
      fix = 'Your app has ads_read but needs SEPARATE Ad Library API approval. Visit: https://www.facebook.com/ads/library/api and submit the access request form. Approval takes 24-72 hours.';
    } else if (err.code === 190 || (err.message || '').toLowerCase().includes('token') || (err.message || '').toLowerCase().includes('expired')) {
      diagnosis = `Token expired or invalid (code ${err.code}): "${err.message}"`;
      fix = 'Generate a fresh token at https://developers.facebook.com/tools/explorer with ads_read scope, then update META_ACCESS_TOKEN in Vercel environment variables.';
    } else if (err.code === 100) {
      diagnosis = `Invalid parameter (code ${err.code}): "${err.message}"`;
      fix = 'Make sure your Meta App has the Marketing API product added at developers.facebook.com.';
    }

    return res.status(200).json({
      ads: [], source: 'error', count: 0, api_blocked: true,
      raw_error: err, diagnosis, fix,
      token_preview: `${META_TOKEN.slice(0,12)}...${META_TOKEN.slice(-6)}`
    });
  }

  return res.status(200).json({ ads: allAds, source: 'live', count: allAds.length, partial_errors: errors.length > 0 ? errors : undefined });
}
