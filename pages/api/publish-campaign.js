// pages/api/publish-campaign.js
// Publishes campaign to Meta Ads Manager via Marketing API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const META_TOKEN = process.env.META_ACCESS_TOKEN;
  const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_1188718788591556';
  const GRAPH = 'https://graph.facebook.com/v20.0';

  const {
    campaignName, objective, adsetName, dailyBudget,
    ageMin, ageMax, gender, pageId, headline, primaryText,
    destinationUrl, imageUrl, ctaType,
  } = req.body;

  const log = [];

  const post = async (endpoint, body) => {
    const r = await fetch(`${GRAPH}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: META_TOKEN }),
    });
    return r.json();
  };

  try {
    // Step 1: Campaign
    log.push('Creating campaign...');
    const camp = await post(`${AD_ACCOUNT_ID}/campaigns`, {
      name: campaignName,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
    });
    if (camp.error) return res.status(400).json({ error: camp.error.message, log });
    log.push(`✅ Campaign created: ${camp.id}`);

    // Step 2: Ad Set
    log.push('Creating ad set...');
    const genderMap = { all: [1, 2], male: [1], female: [2] };
    const adset = await post(`${AD_ACCOUNT_ID}/adsets`, {
      name: adsetName,
      campaign_id: camp.id,
      daily_budget: parseInt(dailyBudget) * 100,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: {
        age_min: parseInt(ageMin),
        age_max: parseInt(ageMax),
        genders: genderMap[gender] || [1, 2],
        geo_locations: { countries: ['IN'], regions: [{ key: '1270' }] },
        publisher_platforms: ['facebook', 'instagram'],
      },
      status: 'PAUSED',
    });
    if (adset.error) return res.status(400).json({ error: adset.error.message, log });
    log.push(`✅ Ad set created: ${adset.id}`);

    // Step 3: Creative
    log.push('Creating ad creative...');
    const creativeBody = {
      name: `${campaignName} Creative`,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message: primaryText,
          link: destinationUrl || 'https://facebook.com',
          name: headline,
          call_to_action: { type: ctaType || 'LEARN_MORE' },
        },
      },
    };
    if (imageUrl) creativeBody.object_story_spec.link_data.picture = imageUrl;
    const creative = await post(`${AD_ACCOUNT_ID}/adcreatives`, creativeBody);
    if (creative.error) return res.status(400).json({ error: creative.error.message, log });
    log.push(`✅ Creative created: ${creative.id}`);

    // Step 4: Ad
    log.push('Creating ad...');
    const ad = await post(`${AD_ACCOUNT_ID}/ads`, {
      name: `${campaignName} — Ad 1`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });
    if (ad.error) return res.status(400).json({ error: ad.error.message, log });
    log.push(`✅ Ad created: ${ad.id}`);
    log.push('🎉 Campaign created successfully in PAUSED state — review before activating!');

    return res.status(200).json({
      success: true,
      log,
      ids: { campaign: camp.id, adset: adset.id, creative: creative.id, ad: ad.id },
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, log });
  }
}
