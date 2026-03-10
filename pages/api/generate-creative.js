// pages/api/generate-creative.js
// Uses Claude to generate winning ad creatives based on competitor analysis

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brand, offer, course, hookStyle, format, competitorHeadlines = [] } = req.body;

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are an expert Facebook/Instagram ad copywriter for Kerala education/coaching industry.

Brand: ${brand}
Course/Program: ${course}
Key Offer: ${offer}
Hook Style: ${hookStyle}
Ad Format: ${format}
Target: Students in Kerala, India aged 18-35

Competitor winning ad headlines for reference:
${competitorHeadlines.length ? competitorHeadlines.join('\n') : 'Kerala coaching, placement guaranteed, free demo class'}

Generate 3 winning ad creative variations. For each provide:
1. Headline (max 40 chars, punchy)
2. Primary Text (2-3 sentences, conversational Kerala market tone)
3. CTA text
4. Why this will win (1 sentence)
5. Hook type used

Return ONLY JSON array:
[{"headline":"...","primary_text":"...","cta":"...","why_win":"...","hook_type":"offer|fear|aspiration|social_proof"}]`
    }]
  });

  try {
    const text = message.content[0].text.replace(/```json|```/g, '').trim();
    const creatives = JSON.parse(text);
    return res.status(200).json({ creatives });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to parse creatives', details: e.message });
  }
}
