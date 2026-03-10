// pages/api/competitor-ads.js
// Fetches competitor ads from Meta Ad Library API
// Falls back to Claude AI analysis if Meta API not approved

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { competitors, country = 'IN', keyword } = req.body;
  const META_TOKEN = process.env.META_ACCESS_TOKEN;
  const fields = 'id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,currency,demographic_distribution,estimated_audience_size,impressions,languages,page_id,page_name,publisher_platforms,spend';

  let allAds = [];
  let apiWorked = false;

  // Try Meta Ad Library API first
  if (META_TOKEN && competitors?.length) {
    for (const competitor of competitors) {
      try {
        const url = `https://graph.facebook.com/v20.0/ads_archive?access_token=${META_TOKEN}&search_terms=${encodeURIComponent(competitor)}&ad_reached_countries=${country}&ad_active_status=ALL&fields=${fields}&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.error && data.data) {
          apiWorked = true;
          (data.data || []).forEach(ad => { ad._competitor = competitor; ad._source = 'live'; allAds.push(ad); });
        }
      } catch (e) { /* fall through */ }
    }
  }

  // If Meta API failed or returned nothing, use Claude AI
  if (!apiWorked || allAds.length === 0) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const competitorList = competitors?.join(', ') || keyword || 'Kerala coaching institutes';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a Meta Ads intelligence expert for Kerala, India education market.
Generate 3 realistic Facebook/Instagram ads for each of these competitors: ${competitorList}

Each ad must reflect real Kerala coaching market patterns (placement rates, Gulf jobs, free demo classes, certifications, etc.)

Return ONLY a JSON array with this structure (no other text):
[{
  "_competitor": "Name",
  "page_name": "Name",
  "ad_creative_link_titles": ["Headline"],
  "ad_creative_bodies": ["Full ad body text 2-3 sentences"],
  "ad_creative_link_captions": ["website.com"],
  "ad_delivery_start_time": "2025-01-10",
  "publisher_platforms": ["facebook","instagram"],
  "spend": {"lower_bound": "3000", "upper_bound": "8000"},
  "impressions": {"lower_bound": "80000", "upper_bound": "200000"},
  "demographic_distribution": [
    {"age": "18-24", "gender": "male", "percentage": "38"},
    {"age": "25-34", "gender": "male", "percentage": "28"},
    {"age": "18-24", "gender": "female", "percentage": "22"}
  ],
  "ad_snapshot_url": "#",
  "_ai_generated": true,
  "_hook_type": "offer",
  "_winning_reason": "Why this ad wins"
}]`
      }]
    });

    try {
      const text = message.content[0].text.replace(/```json|```/g, '').trim();
      allAds = JSON.parse(text);
      allAds.forEach(ad => ad._source = 'ai');
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', details: e.message });
    }
  }

  return res.status(200).json({ ads: allAds, source: apiWorked ? 'live' : 'ai', count: allAds.length });
}
