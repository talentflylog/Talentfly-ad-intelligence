# 🎯 Talentfly Ad Intelligence Platform

A full-stack Next.js app that:
- Fetches competitor ads from Meta Ad Library API
- Uses Claude AI to analyze winning ad patterns
- Generates custom ad creatives for your brand
- Publishes campaigns directly to Meta Ads Manager

---

## 🚀 Deploy in 10 Minutes (Free)

### Step 1 — Fork & Clone

1. Go to [github.com](https://github.com) → **New Repository**
2. Name it `talentfly-ad-intelligence` → Create
3. Upload all these files to the repo

### Step 2 — Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`)

### Step 3 — Deploy to Vercel (Free)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **"Add New Project"**
3. Import your `talentfly-ad-intelligence` repo
4. Add these **Environment Variables**:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-your-key-here` |
| `META_ACCESS_TOKEN` | `EAAyour-meta-token` |
| `META_AD_ACCOUNT_ID` | `act_1188718788591556` |

5. Click **Deploy** — Done! ✅

Your app will be live at: `https://talentfly-ad-intelligence.vercel.app`

---

## 🔧 Run Locally

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your keys

# Start development server
npm run dev
# Open http://localhost:3000
```

---

## 📁 File Structure

```
talentfly-ad-intelligence/
├── pages/
│   ├── index.js              # Main frontend UI
│   └── api/
│       ├── competitor-ads.js  # Meta Ad Library + Claude AI fallback
│       ├── generate-creative.js # Claude ad creative generator
│       └── publish-campaign.js  # Meta Marketing API publisher
├── .env.example              # Environment variables template
├── .gitignore                # Keeps secrets safe
├── next.config.js
└── package.json
```

---

## 🔑 Environment Variables

| Variable | Where to Get |
|----------|-------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `META_ACCESS_TOKEN` | [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer) |
| `META_AD_ACCOUNT_ID` | Your Ads Manager → Account Settings (format: `act_XXXXX`) |

---

## 💡 How It Works

1. **Competitor Research** → Tries Meta Ad Library API first. If blocked, Claude AI generates realistic competitor ad profiles based on Kerala coaching market patterns.

2. **Ad Analysis** → Identifies winner ads (14+ days running = profitable), platform distribution, spend estimates, demographic breakdown.

3. **Creative Generator** → Claude writes 3 ad copy variants optimized for your brand and Kerala audience.

4. **Publish** → Uses Meta Marketing API to create Campaign → Ad Set → Creative → Ad in PAUSED state for review.

---

## ⚠️ Important Notes

- Campaigns are created in **PAUSED** state — you must manually activate in Ads Manager
- Meta Access Tokens expire — regenerate at [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer) when needed
- Ad Library API requires separate Meta approval at [facebook.com/ads/library/api](https://www.facebook.com/ads/library/api)
