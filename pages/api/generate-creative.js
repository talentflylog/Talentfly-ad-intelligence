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
    const raw = message.content[0].text;
    let text = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
    const creatives = JSON.parse(text);
    return res.status(200).json({ creatives });
  } catch (e) {
    // Fallback creatives if parsing fails
    return res.status(200).json({ creatives: [
      { headline: `${brand} — Free Demo Class!`, primary_text: `Join ${brand} and launch your career in ${course||'professional courses'}. ${offer||'Free demo class available'}. Limited seats — register now!`, cta: 'Sign Up', why_win: 'Free offer removes hesitation', hook_type: 'offer' },
      { headline: `₹40,000/Month After Our Course`, primary_text: `${brand}'s ${course||'certification course'} gets you job-ready fast. Our students earn an average of ₹38,000/month. Gulf placements available. ${offer||''}`, cta: 'Learn More', why_win: 'Specific salary creates strong aspiration', hook_type: 'aspiration' },
      { headline: `500+ Students Placed — Join Us`, primary_text: `Don't miss out! ${brand} has placed 500+ students at top companies. ${offer||'Free counseling available'}. Your success story starts here.`, cta: 'Contact Us', why_win: 'Social proof builds immediate trust', hook_type: 'social_proof' }
    ]});
  }
}
