// pages/index.js — Talentfly Ad Intelligence Platform

import { useState, useRef } from 'react';
import Head from 'next/head';

const COMPETITORS_DEFAULT = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&q=Reliant+Institute+of+Logistics&search_type=keyword_unordered&media_type=all`;

export default function Home() {
  const [tab, setTab] = useState('research');
  const [competitors, setCompetitors] = useState(COMPETITORS_DEFAULT);
  const [country, setCountry] = useState('IN');
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [posterAd, setPosterAd] = useState(null);
  const adsRef = useRef(null);

  const [brand, setBrand] = useState('Talentfly Ads');
  const [offer, setOffer] = useState('');
  const [course, setCourse] = useState('');
  const [hookStyle, setHookStyle] = useState('offer');
  const [creatives, setCreatives] = useState([]);
  const [creativeLoading, setCreativeLoading] = useState(false);

  const [publishForm, setPublishForm] = useState({
    campaignName: 'Talentfly — Kerala Coaching — 2025',
    objective: 'LEAD_GENERATION',
    adsetName: 'Kerala 18-35 Education Seekers',
    dailyBudget: '500', ageMin: '18', ageMax: '35', gender: 'all',
    pageId: '', headline: '', primaryText: '', destinationUrl: '', imageUrl: '', ctaType: 'LEARN_MORE',
  });
  const [publishResult, setPublishResult] = useState(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishLogs, setPublishLogs] = useState([]);
  const [apiError, setApiError] = useState(null);

  const addLog = (msg, type = 'info') =>
    setLogs(l => [...l, { msg, type, time: new Date().toLocaleTimeString() }]);

  // ---- FETCH ADS ----
  const fetchAds = async () => {
    setLoading(true); setLogs([]); setAds([]); setApiError(null);
    const urls = competitors.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (!urls.length) {
      addLog('❌ Please paste at least one Facebook Ad Library URL (starting with https://)', 'error');
      setLoading(false);
      return;
    }
    addLog(`🔍 Fetching ads from ${urls.length} competitor URL(s)...`, 'info');
    addLog('⏳ This takes 30–60 seconds — Apify is scraping live data...', 'warn');
    try {
      const res = await fetch('/api/competitor-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorUrls: urls, country }),
      });
      const data = await res.json();
      if (data.api_blocked) {
        setApiError(data);
        addLog(`❌ ${data.diagnosis}`, 'error');
        return;
      }
      if (data.error) { addLog(`❌ Error: ${data.error}`, 'error'); return; }
      setAds(data.ads || []);
      addLog(`✅ ${data.count} real ads fetched from Meta Ad Library!`, 'success');
      setTimeout(() => adsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      addLog(`❌ Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ---- GENERATE CREATIVES ----
  const generateCreatives = async () => {
    setCreativeLoading(true); setCreatives([]);
    const winnerHeadlines = ads
      .filter(ad => daysRunning(ad) >= 7)
      .slice(0, 5)
      .map(ad => ad.headline)
      .filter(Boolean);
    try {
      const res = await fetch('/api/generate-creative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, offer, course, hookStyle, format: 'image', competitorHeadlines: winnerHeadlines }),
      });
      const data = await res.json();
      setCreatives(data.creatives || []);
    } catch (e) {
      alert('Error generating creatives: ' + e.message);
    } finally {
      setCreativeLoading(false);
    }
  };

  // ---- PUBLISH ----
  const publishCampaign = async () => {
    setPublishLoading(true); setPublishLogs([]); setPublishResult(null);
    try {
      const res = await fetch('/api/publish-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishForm),
      });
      const data = await res.json();
      setPublishLogs(data.log || []);
      setPublishResult(data);
      if (data.success) setTab('results');
    } catch (e) {
      setPublishLogs([`❌ Error: ${e.message}`]);
    } finally {
      setPublishLoading(false);
    }
  };

  const copyToPublish = (ad) => {
    setPublishForm(f => ({ ...f, headline: ad.headline || '', primaryText: ad.body || '' }));
    setTab('publish');
  };

  // Safe date helpers — guards against Unix epoch / bad dates
  const daysRunning = (ad) => {
    if (!ad.ad_delivery_start_time) return 0;
    const start = new Date(ad.ad_delivery_start_time);
    if (isNaN(start.getTime()) || start.getFullYear() < 2000) return 0;
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  };

  const fmtDate = (ad) => {
    if (!ad.ad_delivery_start_time) return 'Unknown';
    const d = new Date(ad.ad_delivery_start_time);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return 'Unknown';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtSpend = (ad) => ad.spend
    ? `₹${parseInt(ad.spend.lower_bound || 0).toLocaleString()}–₹${parseInt(ad.spend.upper_bound || 0).toLocaleString()}`
    : 'N/A';

  const fmtImpressions = (ad) => ad.impressions
    ? `${parseInt(ad.impressions.lower_bound || 0).toLocaleString()}+`
    : 'N/A';

  const initials = (name) =>
    (name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // ---- RENDER ----
  return (
    <>
      <Head>
        <title>Talentfly Ad Intelligence</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0f;color:#e8e8f0;font-family:'DM Sans',sans-serif;min-height:100vh}
        .syne{font-family:'Syne',sans-serif}
        .mono{font-family:'DM Mono',monospace}
        .card{background:#111118;border:1px solid #2a2a3a;border-radius:12px;padding:24px;margin-bottom:20px}
        .btn{padding:10px 18px;border-radius:8px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-weight:600;font-size:0.85rem;transition:all 0.2s}
        .btn-primary{background:#6c63ff;color:white}.btn-primary:hover{background:#5a52e0}
        .btn-outline{background:transparent;border:1px solid #2a2a3a;color:#e8e8f0}.btn-outline:hover{border-color:#6c63ff;color:#6c63ff}
        .btn-success{background:#43e97b;color:#0a0a0f}
        input,select,textarea{background:#1a1a24;border:1px solid #2a2a3a;color:#e8e8f0;padding:10px 14px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:0.9rem;width:100%;outline:none}
        input:focus,select:focus,textarea:focus{border-color:#6c63ff}
        label{font-size:0.78rem;color:#6b6b80;display:block;margin-bottom:5px;font-family:'DM Mono',monospace}
        .fg{margin-bottom:14px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .tag{font-size:0.7rem;padding:3px 8px;border-radius:10px;font-family:'DM Mono',monospace}
        .tag-green{background:rgba(67,233,123,0.15);color:#43e97b;border:1px solid rgba(67,233,123,0.3)}
        .tag-purple{background:rgba(108,99,255,0.15);color:#a09fff;border:1px solid rgba(108,99,255,0.3)}
        .tag-orange{background:rgba(255,209,102,0.15);color:#ffd166;border:1px solid rgba(255,209,102,0.3)}
        .log-box{background:#080810;border:1px solid #2a2a3a;border-radius:8px;padding:14px;font-family:'DM Mono',monospace;font-size:0.78rem;height:160px;overflow-y:auto}
        .spinner{width:32px;height:32px;border:3px solid #2a2a3a;border-top-color:#6c63ff;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
        @keyframes spin{to{transform:rotate(360deg)}}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
        .modal-box{background:#111118;border:1px solid #2a2a3a;border-radius:16px;padding:28px;max-width:960px;width:100%;max-height:90vh;overflow-y:auto}
        .bar-track{background:#1a1a24;border-radius:4px;height:6px;overflow:hidden;margin-top:3px}
        .bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#6c63ff,#ff6584)}
        .alert-warn{background:rgba(255,209,102,0.1);border:1px solid rgba(255,209,102,0.3);color:#ffd166;padding:12px 16px;border-radius:8px;font-size:0.85rem;margin-bottom:14px}
        .alert-success{background:rgba(67,233,123,0.1);border:1px solid rgba(67,233,123,0.3);color:#43e97b;padding:12px 16px;border-radius:8px;font-size:0.85rem;margin-bottom:14px}
        @media(max-width:768px){.grid2,.grid4{grid-template-columns:1fr}}
      `}</style>

      {/* HEADER */}
      <div style={{background:'linear-gradient(135deg,#0d0d1a,#1a0d2e)',borderBottom:'1px solid #2a2a3a',padding:'18px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div className="syne" style={{fontWeight:800,fontSize:'1.3rem'}}>
          Talentfly <span style={{color:'#6c63ff'}}>Ad Intelligence</span>
        </div>
        <div className="tag tag-green mono">⬤ {ads.length > 0 ? `${ads.length} Ads Loaded` : 'Ready'}</div>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:4,padding:'16px 28px 0',borderBottom:'1px solid #2a2a3a',background:'#111118',overflowX:'auto'}}>
        {[
          ['research','🔍 Competitor Research'],
          ['analysis','📊 Analysis'],
          ['creative','🎨 Creative Generator'],
          ['publish','🚀 Publish Campaign'],
          ['results','✅ Results'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className="syne" style={{
            padding:'10px 18px',border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.83rem',
            background:'transparent',color:tab===key?'#6c63ff':'#6b6b80',
            borderBottom:tab===key?'2px solid #6c63ff':'2px solid transparent',
            whiteSpace:'nowrap',transition:'color 0.2s',
          }}>{label}</button>
        ))}
      </div>

      <div style={{padding:28,maxWidth:1400,margin:'0 auto'}}>

        {/* ===== RESEARCH TAB ===== */}
        {tab === 'research' && (
          <div>
            <div className="card">
              <div className="syne" style={{fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#6c63ff',display:'inline-block'}}></span>
                Competitor Ad Library Search
              </div>
              <div className="fg">
                <label>Competitor Ad Library URLs (one per line)</label>
                <textarea rows={5} value={competitors} onChange={e => setCompetitors(e.target.value)}
                  placeholder="https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&q=YourCompetitor&search_type=keyword_unordered&media_type=all" />
                <div style={{marginTop:6,fontSize:'0.76rem',color:'#6b6b80',lineHeight:1.6}}>
                  💡 Go to <a href="https://www.facebook.com/ads/library" target="_blank" rel="noreferrer" style={{color:'#6c63ff'}}>facebook.com/ads/library</a> → search each competitor → copy the URL and paste here (one per line)
                </div>
              </div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                <select value={country} onChange={e => setCountry(e.target.value)} style={{width:'auto',padding:'10px 12px'}}>
                  <option value="IN">🇮🇳 India</option>
                  <option value="US">🇺🇸 USA</option>
                  <option value="GB">🇬🇧 UK</option>
                  <option value="AE">🇦🇪 UAE</option>
                </select>
                <button className="btn btn-primary" onClick={fetchAds} disabled={loading}>
                  {loading ? '⏳ Fetching...' : '🔍 Fetch Competitor Ads'}
                </button>
              </div>
            </div>

            {logs.length > 0 && (
              <div className="card">
                <div className="syne" style={{fontWeight:700,marginBottom:12,fontSize:'0.9rem'}}>● Live Log</div>
                <div className="log-box">
                  {logs.map((l, i) => (
                    <div key={i} style={{
                      color: l.type==='success'?'#43e97b':l.type==='error'?'#ff6584':l.type==='warn'?'#ffd166':'#6c63ff',
                      marginBottom:3,
                    }}>
                      [{l.time}] {l.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div style={{textAlign:'center',padding:40}}>
                <div className="spinner"></div>
                <div className="mono" style={{color:'#6b6b80',marginTop:12,fontSize:'0.82rem'}}>
                  Scraping Meta Ad Library via Apify... this takes ~30–60 seconds
                </div>
              </div>
            )}

            {/* API ERROR PANEL */}
            {apiError && !loading && (
              <div style={{background:'#1a0a0a',border:'2px solid #ff6584',borderRadius:12,padding:24,marginBottom:20}}>
                <div className="syne" style={{fontWeight:800,color:'#ff6584',fontSize:'1.1rem',marginBottom:12}}>❌ Error Fetching Ads</div>
                <div style={{background:'rgba(255,101,132,0.1)',borderRadius:8,padding:'12px 16px',marginBottom:14}}>
                  <div style={{fontSize:'0.85rem',color:'#ffccd5'}}>{apiError.diagnosis}</div>
                </div>
                <div style={{background:'rgba(255,209,102,0.08)',border:'1px solid rgba(255,209,102,0.3)',borderRadius:8,padding:'12px 16px'}}>
                  <div className="mono" style={{fontSize:'0.72rem',color:'#ffd166',marginBottom:6}}>🔧 HOW TO FIX</div>
                  <div style={{fontSize:'0.85rem',color:'#ffd166',lineHeight:1.6}}>{apiError.fix}</div>
                </div>
              </div>
            )}

            {/* AD RESULTS */}
            {ads.length > 0 && (
              <div ref={adsRef}>
                <div className="card" style={{marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <span className="syne" style={{fontWeight:700,fontSize:'1.1rem'}}>{ads.length} Real Ads Found</span>
                    <span className="tag tag-green mono" style={{marginLeft:10}}>📡 Live from Meta Ad Library</span>
                  </div>
                  <button className="btn btn-outline" style={{fontSize:'0.78rem'}} onClick={() => setTab('analysis')}>
                    📊 View Analysis →
                  </button>
                </div>

                {ads.map((ad, i) => {
                  const days = daysRunning(ad);
                  const ini = initials(ad.page_name || ad._competitor);
                  const platforms = (ad.publisher_platforms || ['facebook']).join(' + ');

                  return (
                    <div key={i} style={{
                      background:'#111118',
                      border:`1px solid ${days>=14?'#ffd16644':'#2a2a3a'}`,
                      borderRadius:14,marginBottom:24,overflow:'hidden',
                      boxShadow:days>=14?'0 0 20px rgba(255,209,102,0.08)':'none',
                    }}>
                      {/* Card Header */}
                      <div style={{padding:'16px 20px',borderBottom:'1px solid #2a2a3a',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#0f0f18'}}>
                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                          {ad.page_profile_picture_url ? (
                            <img src={ad.page_profile_picture_url} alt={ad.page_name}
                              style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',flexShrink:0}}
                              onError={e => { e.target.style.display='none'; }} />
                          ) : (
                            <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#ff6584)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:'1rem',flexShrink:0}}>{ini}</div>
                          )}
                          <div>
                            <div className="syne" style={{fontWeight:700,fontSize:'1rem'}}>{ad.page_name || ad._competitor}</div>
                            <div className="mono" style={{fontSize:'0.7rem',color:'#6b6b80',marginTop:2}}>
                              Started {fmtDate(ad)} · Running {days} days · {platforms}
                            </div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          {days >= 14 && <span className="tag tag-orange">🏆 WINNER</span>}
                          {ad.collation_count > 1 && <span className="tag tag-purple">🎠 {ad.collation_count} variants</span>}
                        </div>
                      </div>

                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>

                        {/* LEFT: Real Ad Creative */}
                        <div style={{padding:20,borderRight:'1px solid #2a2a3a'}}>
                          <div className="mono" style={{fontSize:'0.68rem',color:'#6b6b80',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>📱 Real Ad Creative</div>

                          {/* Facebook-style ad card */}
                          <div style={{background:'white',borderRadius:10,overflow:'hidden',boxShadow:'0 2px 16px rgba(0,0,0,0.4)',maxWidth:380,marginBottom:14}}>
                            {/* Page header */}
                            <div style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:8}}>
                              {ad.page_profile_picture_url ? (
                                <img src={ad.page_profile_picture_url} alt=""
                                  style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}}
                                  onError={e => { e.target.style.display='none'; }} />
                              ) : (
                                <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#ff6584)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:'0.8rem',flexShrink:0}}>{ini}</div>
                              )}
                              <div>
                                <div style={{color:'#1c1e21',fontWeight:700,fontSize:'0.85rem'}}>{ad.page_name || ad._competitor}</div>
                                <div style={{color:'#65676b',fontSize:'0.7rem'}}>Sponsored · 🌐</div>
                              </div>
                            </div>

                            {/* Body text */}
                            {ad.body && (
                              <div style={{padding:'0 14px 10px',color:'#1c1e21',fontSize:'0.82rem',lineHeight:1.5,fontFamily:'system-ui,sans-serif',whiteSpace:'pre-line'}}>
                                {ad.body}
                              </div>
                            )}

                            {/* Media */}
                            {ad._video_url ? (
                              <video controls style={{width:'100%',maxHeight:240,objectFit:'cover',display:'block'}}
                                poster={ad._video_thumb || undefined} src={ad._video_url} />
                            ) : ad._image_url ? (
                              <img src={ad._image_url} alt="Ad creative"
                                style={{width:'100%',maxHeight:240,objectFit:'cover',display:'block'}}
                                onError={e => { e.target.style.display='none'; }} />
                            ) : (
                              <div style={{background:'#f0f2f5',minHeight:100,display:'flex',alignItems:'center',justifyContent:'center',color:'#65676b',fontSize:'0.8rem',padding:16,textAlign:'center'}}>
                                🖼 View creative on Facebook Ad Library
                              </div>
                            )}

                            {/* Headline + CTA bar */}
                            {(ad.headline || ad.cta_text) && (
                              <div style={{background:'#f0f2f5',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                <div style={{flex:1,minWidth:0}}>
                                  {ad.link_url && (
                                    <div style={{color:'#65676b',fontSize:'0.68rem',textTransform:'uppercase',marginBottom:2}}>
                                      {(() => { try { return new URL(ad.link_url).hostname.replace('www.',''); } catch(e) { return ''; } })()}
                                    </div>
                                  )}
                                  {ad.headline && (
                                    <div style={{color:'#1c1e21',fontWeight:700,fontSize:'0.82rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                      {ad.headline}
                                    </div>
                                  )}
                                  {ad.link_description && (
                                    <div style={{color:'#65676b',fontSize:'0.72rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                      {ad.link_description}
                                    </div>
                                  )}
                                </div>
                                {ad.cta_text && (
                                  <div style={{background:'#e4e6eb',color:'#1c1e21',padding:'5px 10px',borderRadius:6,fontSize:'0.75rem',fontWeight:600,flexShrink:0,marginLeft:8,whiteSpace:'nowrap'}}>
                                    {ad.cta_text}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Carousel indicator */}
                          {ad.cards?.length > 1 && (
                            <div style={{fontSize:'0.76rem',color:'#6b6b80',marginBottom:10}}>
                              🎠 Carousel ad — {ad.cards.length} cards
                            </div>
                          )}

                          {/* View on Facebook */}
                          <a href={ad.ad_snapshot_url || `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&q=${encodeURIComponent(ad.page_name||'')}&search_type=keyword_unordered&media_type=all`}
                            target="_blank" rel="noreferrer"
                            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'11px',borderRadius:8,background:'#1877F2',color:'white',textDecoration:'none',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'0.85rem',width:'100%'}}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            👁 View This Ad on Facebook
                          </a>
                        </div>

                        {/* RIGHT: Intelligence Panel */}
                        <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
                          <div className="mono" style={{fontSize:'0.68rem',color:'#6b6b80',textTransform:'uppercase',letterSpacing:'0.05em'}}>📊 Ad Intelligence</div>

                          {/* Metrics */}
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                            {[
                              ['💰 Est. Spend', fmtSpend(ad), '#43e97b'],
                              ['👁 Impressions', fmtImpressions(ad), '#6c63ff'],
                              ['📅 Days Running', `${days} days`, '#ffd166'],
                              ['📱 Platforms', platforms, '#ff6584'],
                            ].map(([k, v, c]) => (
                              <div key={k} style={{background:'#1a1a24',borderRadius:8,padding:'10px 12px'}}>
                                <div style={{fontSize:'0.7rem',color:'#6b6b80',marginBottom:4}}>{k}</div>
                                <div className="syne" style={{fontWeight:700,fontSize:'0.9rem',color:c}}>{v}</div>
                              </div>
                            ))}
                          </div>

                          {/* Full Ad Copy */}
                          <div style={{background:'#1a1a24',borderRadius:8,padding:'12px 14px'}}>
                            <div className="mono" style={{fontSize:'0.68rem',color:'#6b6b80',marginBottom:8}}>FULL AD COPY</div>
                            {ad.headline && (
                              <div className="syne" style={{fontWeight:700,fontSize:'0.92rem',marginBottom:6,color:'#e8e8f0'}}>
                                {ad.headline}
                              </div>
                            )}
                            {ad.body && (
                              <div style={{fontSize:'0.82rem',color:'rgba(232,232,240,0.8)',lineHeight:1.6,whiteSpace:'pre-line',marginBottom:ad.cta_text?8:0}}>
                                {ad.body}
                              </div>
                            )}
                            {ad.cta_text && (
                              <div style={{display:'inline-block',background:'rgba(108,99,255,0.2)',color:'#a09fff',border:'1px solid rgba(108,99,255,0.4)',borderRadius:6,padding:'3px 10px',fontSize:'0.78rem',fontFamily:'DM Mono,monospace',marginTop:4}}>
                                CTA: {ad.cta_text}
                              </div>
                            )}
                            {ad.link_description && (
                              <div style={{marginTop:8,fontSize:'0.78rem',color:'#6b6b80',fontStyle:'italic'}}>
                                {ad.link_description}
                              </div>
                            )}
                            {!ad.headline && !ad.body && (
                              <div style={{color:'#6b6b80',fontSize:'0.82rem'}}>No copy available — view on Facebook</div>
                            )}
                          </div>

                          {/* Carousel cards */}
                          {ad.cards?.length > 1 && (
                            <div style={{background:'#1a1a24',borderRadius:8,padding:'12px 14px'}}>
                              <div className="mono" style={{fontSize:'0.68rem',color:'#6b6b80',marginBottom:8}}>🎠 ALL CAROUSEL CARDS</div>
                              {ad.cards.map((card, ci) => (
                                <div key={ci} style={{borderTop:ci>0?'1px solid #2a2a3a':'none',paddingTop:ci>0?8:0,marginTop:ci>0?8:0}}>
                                  <div style={{fontSize:'0.72rem',color:'#6b6b80',marginBottom:2}}>Card {ci+1}</div>
                                  {card.title && <div style={{fontWeight:600,fontSize:'0.82rem',color:'#e8e8f0',marginBottom:2}}>{card.title}</div>}
                                  {card.body && <div style={{fontSize:'0.78rem',color:'rgba(232,232,240,0.7)',lineHeight:1.5,whiteSpace:'pre-line'}}>{card.body}</div>}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:'auto'}}>
                            <button style={{width:'100%',padding:'10px',borderRadius:8,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#7B2FBE,#00C4CC)',color:'white',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'0.85rem'}}
                              onClick={() => setPosterAd(ad)}>
                              🎨 Create Canva Poster from This Ad
                            </button>
                            <div style={{display:'flex',gap:8}}>
                              <button className="btn btn-primary" style={{flex:1,fontSize:'0.8rem'}} onClick={() => copyToPublish(ad)}>
                                📋 Copy & Publish
                              </button>
                              <button className="btn btn-outline" style={{flex:1,fontSize:'0.8rem'}} onClick={() => {
                                const url = ad.ad_snapshot_url || `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&q=${encodeURIComponent(ad.page_name||'')}&search_type=keyword_unordered&media_type=all`;
                                window.open(url, '_blank');
                              }}>🔗 View on FB</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== ANALYSIS TAB ===== */}
        {tab === 'analysis' && (
          <div>
            {ads.length === 0 ? (
              <div style={{textAlign:'center',padding:60,color:'#6b6b80'}}>
                <div style={{fontSize:'3rem',marginBottom:12}}>📊</div>
                <p>Fetch competitor ads first from the Research tab</p>
              </div>
            ) : (
              <div>
                <div className="grid4">
                  {[
                    ['Total Ads', ads.length, '#6c63ff'],
                    ['Winner Ads (14d+)', ads.filter(a => daysRunning(a) >= 14).length, '#ffd166'],
                    ['Competitors', [...new Set(ads.map(a => a._competitor))].length, '#43e97b'],
                    ['Avg Days Running', Math.round(ads.reduce((s,a) => s + daysRunning(a), 0) / ads.length), '#ff6584'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{background:'#1a1a24',border:'1px solid #2a2a3a',borderRadius:10,padding:18}}>
                      <div className="mono" style={{fontSize:'0.72rem',color:'#6b6b80',textTransform:'uppercase',marginBottom:6}}>{label}</div>
                      <div className="syne" style={{fontWeight:800,fontSize:'2rem',color}}>{val}</div>
                    </div>
                  ))}
                </div>

                <div className="grid2" style={{marginTop:20}}>
                  <div className="card">
                    <div className="syne" style={{fontWeight:700,marginBottom:14}}>Ads Per Competitor</div>
                    {Object.entries(
                      ads.reduce((acc, ad) => { acc[ad._competitor] = (acc[ad._competitor]||0)+1; return acc; }, {})
                    ).map(([name, count]) => (
                      <div key={name} style={{marginBottom:12}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',marginBottom:4}}>
                          <span>{name}</span><span style={{color:'#6c63ff'}}>{count} ads</span>
                        </div>
                        <div className="bar-track"><div className="bar-fill" style={{width:`${Math.min(100,count*20)}%`}}></div></div>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="syne" style={{fontWeight:700,marginBottom:14}}>🏆 Top Winning Ads</div>
                    {[...ads].sort((a,b) => daysRunning(b)-daysRunning(a)).slice(0,5).map((ad,i) => (
                      <div key={i} style={{padding:'10px 0',borderBottom:'1px solid #1a1a24',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontSize:'0.82rem',fontWeight:600}}>{(ad.headline||'No headline').slice(0,40)}</div>
                          <div className="mono" style={{fontSize:'0.7rem',color:'#6b6b80'}}>{ad._competitor}</div>
                        </div>
                        <span className="tag tag-orange">{daysRunning(ad)}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== CREATIVE TAB ===== */}
        {tab === 'creative' && (
          <div>
            <div className="card">
              <div className="syne" style={{fontWeight:700,marginBottom:14}}>🎨 AI Creative Generator</div>
              <div className="grid2">
                <div className="fg"><label>Your Brand Name</label><input value={brand} onChange={e=>setBrand(e.target.value)} /></div>
                <div className="fg"><label>Key Offer</label><input value={offer} onChange={e=>setOffer(e.target.value)} placeholder="Free Demo Class, 30% Off..." /></div>
                <div className="fg"><label>Target Course</label><input value={course} onChange={e=>setCourse(e.target.value)} placeholder="Logistics, Digital Marketing..." /></div>
                <div className="fg">
                  <label>Hook Style</label>
                  <select value={hookStyle} onChange={e=>setHookStyle(e.target.value)}>
                    <option value="offer">Offer-Driven</option>
                    <option value="fear">Fear/FOMO</option>
                    <option value="aspiration">Aspiration</option>
                    <option value="social_proof">Social Proof</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={generateCreatives} disabled={creativeLoading}>
                {creativeLoading ? '⏳ Generating...' : '✨ Generate Winning Creatives'}
              </button>
            </div>
            {creativeLoading && <div style={{textAlign:'center',padding:40}}><div className="spinner"></div></div>}
            {creatives.map((c, i) => (
              <div key={i} className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div className="syne" style={{fontWeight:700}}>Creative Variant {i+1}</div>
                  <span className="tag" style={{
                    background:`rgba(${i===0?'108,99,255':i===1?'255,101,132':'67,233,123'},0.15)`,
                    color:i===0?'#a09fff':i===1?'#ff6584':'#43e97b',
                    border:`1px solid rgba(${i===0?'108,99,255':i===1?'255,101,132':'67,233,123'},0.3)`,
                  }}>{c.hook_type}</span>
                </div>
                <div className="grid2">
                  <div style={{background:'linear-gradient(135deg,#1a0d2e,#0d1a2e)',borderRadius:10,padding:24,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',minHeight:180,position:'relative',overflow:'hidden'}}>
                    <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 0,rgba(108,99,255,0.2),transparent 70%)'}}></div>
                    <div className="syne" style={{fontWeight:800,fontSize:'1.2rem',marginBottom:10,position:'relative'}}>{c.headline}</div>
                    <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.7)',lineHeight:1.6,marginBottom:14,position:'relative'}}>{c.primary_text}</div>
                    <div style={{background:'#6c63ff',color:'white',padding:'8px 20px',borderRadius:8,fontWeight:700,position:'relative',fontSize:'0.85rem'}}>{c.cta}</div>
                  </div>
                  <div>
                    <div style={{padding:'10px 14px',background:'rgba(255,209,102,0.08)',border:'1px solid rgba(255,209,102,0.2)',borderRadius:8,fontSize:'0.82rem',color:'#ffd166',marginBottom:12}}>
                      💡 {c.why_win}
                    </div>
                    <button className="btn btn-success" style={{width:'100%',fontSize:'0.8rem'}} onClick={() => {
                      setPublishForm(f => ({...f, headline:c.headline, primaryText:c.primary_text}));
                      setTab('publish');
                    }}>✅ Use This → Publish</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== PUBLISH TAB ===== */}
        {tab === 'publish' && (
          <div>
            <div className="alert-warn">⚠️ This will create a REAL campaign in PAUSED state — safe to review before going live.</div>
            {[
              { title: '📋 Campaign', fields: [
                ['campaignName','Campaign Name','text'],
                ['objective','Objective','select',['LEAD_GENERATION','LINK_CLICKS','CONVERSIONS','REACH']],
              ]},
              { title: '🎯 Ad Set & Targeting', fields: [
                ['adsetName','Ad Set Name','text'],
                ['dailyBudget','Daily Budget (₹)','number'],
                ['ageMin','Age Min','number'],
                ['ageMax','Age Max','number'],
                ['gender','Gender','select',['all','male','female']],
              ]},
              { title: '📝 Ad Creative', fields: [
                ['pageId','Facebook Page ID','text'],
                ['headline','Headline','text'],
                ['primaryText','Primary Text','textarea'],
                ['destinationUrl','Destination URL','url'],
                ['imageUrl','Image URL','url'],
                ['ctaType','CTA Button','select',['LEARN_MORE','SIGN_UP','CONTACT_US','GET_QUOTE','BOOK_NOW']],
              ]},
            ].map(section => (
              <div key={section.title} style={{background:'#1a1a24',border:'1px solid #2a2a3a',borderRadius:12,padding:22,marginBottom:16}}>
                <div className="syne" style={{fontWeight:700,color:'#6c63ff',marginBottom:16,fontSize:'0.92rem'}}>{section.title}</div>
                <div className="grid2">
                  {section.fields.map(([key, lbl, type, opts]) => (
                    <div key={key} className="fg" style={type==='textarea'?{gridColumn:'1/-1'}:{}}>
                      <label>{lbl}</label>
                      {type === 'select' ? (
                        <select value={publishForm[key]||''} onChange={e=>setPublishForm(f=>({...f,[key]:e.target.value}))}>
                          {(opts||[]).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : type === 'textarea' ? (
                        <textarea rows={3} value={publishForm[key]||''} onChange={e=>setPublishForm(f=>({...f,[key]:e.target.value}))} />
                      ) : (
                        <input type={type} value={publishForm[key]||''} onChange={e=>setPublishForm(f=>({...f,[key]:e.target.value}))} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-primary" onClick={publishCampaign} disabled={publishLoading}>
              {publishLoading ? '⏳ Publishing...' : '🚀 Create & Publish Campaign'}
            </button>
            {publishLogs.length > 0 && (
              <div className="card" style={{marginTop:16}}>
                <div className="log-box">
                  {publishLogs.map((l, i) => (
                    <div key={i} style={{color:l.includes('✅')||l.includes('🎉')?'#43e97b':l.includes('❌')||l.includes('Error')?'#ff6584':'#6c63ff',marginBottom:3}}>{l}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== RESULTS TAB ===== */}
        {tab === 'results' && (
          <div>
            {!publishResult ? (
              <div style={{textAlign:'center',padding:60,color:'#6b6b80'}}>
                <div style={{fontSize:'3rem',marginBottom:12}}>✅</div>
                <p>Publish a campaign to see results here</p>
              </div>
            ) : publishResult.success ? (
              <div>
                <div className="alert-success">🎉 Campaign created in PAUSED state — review before activating!</div>
                <div className="grid2">
                  <div className="card">
                    <div className="syne" style={{fontWeight:700,marginBottom:14}}>Campaign IDs</div>
                    {Object.entries(publishResult.ids||{}).map(([k,v]) => (
                      <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #1a1a24'}}>
                        <span style={{color:'#6b6b80',fontSize:'0.85rem',textTransform:'capitalize'}}>{k} ID</span>
                        <span className="mono" style={{fontSize:'0.78rem'}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="syne" style={{fontWeight:700,marginBottom:14}}>Next Steps</div>
                    {['Review in Ads Manager','Check creative preview','Set status to ACTIVE','Monitor CTR & leads daily'].map((s,i) => (
                      <div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a1a24'}}>
                        <span style={{width:22,height:22,borderRadius:'50%',background:'#43e97b',color:'#0a0a0f',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:800,flexShrink:0}}>{i+1}</span>
                        <span style={{fontSize:'0.85rem'}}>{s}</span>
                      </div>
                    ))}
                    <a href="https://adsmanager.facebook.com" target="_blank" rel="noreferrer"
                      style={{display:'block',marginTop:14,padding:'10px',background:'#43e97b',color:'#0a0a0f',borderRadius:8,textAlign:'center',fontFamily:'Syne,sans-serif',fontWeight:700,textDecoration:'none',fontSize:'0.85rem'}}>
                      Open Ads Manager →
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{borderColor:'#ff6584'}}>
                <div className="syne" style={{fontWeight:700,color:'#ff6584',marginBottom:10}}>❌ Error</div>
                <div style={{color:'#ff6584',fontSize:'0.85rem'}}>{publishResult.error}</div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* CANVA POSTER MODAL */}
      {posterAd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPosterAd(null)}>
          <div className="modal-box">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div className="syne" style={{fontWeight:800,fontSize:'1.1rem'}}>🎨 Ad Poster Studio</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={() => {
                  const q = encodeURIComponent('facebook ad coaching education Kerala');
                  window.open(`https://www.canva.com/search/templates?q=${q}`, '_blank');
                  const text = `HEADLINE: ${posterAd.headline||''}\n\nBODY: ${posterAd.body||''}\n\nCTA: ${posterAd.cta_text||''}\n\nBRAND: ${brand}`;
                  navigator.clipboard.writeText(text).catch(() => {});
                  alert('Canva opened! Ad text copied to clipboard — paste into the template.');
                }} style={{background:'linear-gradient(135deg,#7B2FBE,#00C4CC)',color:'white',border:'none',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'0.82rem'}}>
                  🎨 Open in Canva
                </button>
                <button onClick={() => setPosterAd(null)} style={{background:'#1a1a24',border:'1px solid #2a2a3a',color:'#e8e8f0',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontFamily:'Syne,sans-serif'}}>✕</button>
              </div>
            </div>
            {/* Poster Preview */}
            <div style={{background:'#0a1628',borderRadius:12,padding:32,aspectRatio:'1',maxWidth:400,margin:'0 auto',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 30% 20%,rgba(0,196,204,0.25),transparent 60%)',pointerEvents:'none'}}></div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'auto',position:'relative'}}>
                <div style={{background:'#00C4CC',color:'#0a1628',padding:'5px 12px',borderRadius:20,fontSize:'0.72rem',fontWeight:800,fontFamily:'Syne,sans-serif'}}>
                  🎯 {posterAd.cta_text || 'ENROLL NOW'}
                </div>
                <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.68rem',fontFamily:'DM Mono,monospace'}}>SPONSORED</div>
              </div>
              <div className="syne" style={{fontWeight:800,fontSize:'1.4rem',lineHeight:1.2,color:'white',margin:'20px 0 10px',position:'relative'}}>
                {posterAd.headline || 'Your Headline Here'}
              </div>
              <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.7)',lineHeight:1.5,marginBottom:18,position:'relative'}}>
                {(posterAd.body||'').slice(0,120)}{(posterAd.body||'').length>120?'...':''}
              </div>
              <div style={{height:1,background:'linear-gradient(90deg,#00C4CC,transparent)',marginBottom:14,position:'relative'}}></div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative'}}>
                <div className="syne" style={{fontWeight:800,color:'white'}}>{brand}</div>
                <div style={{background:'#00C4CC',color:'#0a1628',padding:'8px 16px',borderRadius:8,fontWeight:800,fontSize:'0.8rem',fontFamily:'Syne,sans-serif'}}>
                  {posterAd.cta_text || 'Enroll Now'} →
                </div>
              </div>
            </div>
            <div style={{textAlign:'center',marginTop:16,color:'#6b6b80',fontSize:'0.82rem'}}>
              Click <strong style={{color:'#a09fff'}}>"Open in Canva"</strong> → ad text auto-copied → paste into template
            </div>
          </div>
        </div>
      )}
    </>
  );
}
