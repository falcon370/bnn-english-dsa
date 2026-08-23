// src/layout.js - Newspaper Full Issue Layout (7 Pages) - Tightened & Fixed Images

'use strict';

function enforceWordLimit(text, limit) {
  if (!text) return '';
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;
  return words.slice(0, limit).join(' ') + '...';
}

function stripHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(text, limit) {
  return enforceWordLimit(stripHtml(text), limit);
}

function safeImage(url) {
  return typeof url === 'string' && url.trim().length > 0;
}

function bgImg(url) {
  if (!safeImage(url)) return '';
  return `background-image:url('${url.trim().replace(/'/g, "%27")}');`;
}

function esc(v) {
  return stripHtml(v === undefined || v === null ? '' : String(v));
}

const LIMITS = {
  teaserHeadline: 6,
  leadHeadline: 14,
  aHeadline: 9,
  aDeck: 10,
  aBody: 170,
  bHeadline: 9,
  bDeck: 8,
  bBody: 150,
  sidebarBody: 60,
  smallHeadline: 8,
  smallBody: 40,
  briefTitle: 6,
  briefBody: 40,
  specialTitle: 6,
  specialBody: 30,
  columnTitle: 5,
  columnBody: 30,
  featureTitle: 9,
  featureIntro: 55,
  featureBody: 320,
  splitFeatureBody: 125,
  pullQuote: 22,
  pageBoxTeaser: 10
};

function assignSlots(stories) {
  const slots = {
    'story-a-left': null, 'story-a-right': null, 'story-b-left': null,
    'story-c-left': null, 'story-d-left': null, 'story-b-right': null,
    'sidebar-bottom': null, 'small-right': [], brief: [],
    special: null, column: null, results: null, 'bottom-strip': []
  };

  const leftover = [];

  stories.forEach((s) => {
    const slot = s.slot;
    if (slot === 'story-a-left' && !slots['story-a-left']) slots['story-a-left'] = s;
    else if (slot === 'story-a-right' && !slots['story-a-right']) slots['story-a-right'] = s;
    else if (slot === 'story-b-left' && !slots['story-b-left']) slots['story-b-left'] = s;
    else if (slot === 'story-c-left' && !slots['story-c-left']) slots['story-c-left'] = s;
    else if (slot === 'story-d-left' && !slots['story-d-left']) slots['story-d-left'] = s;
    else if (slot === 'story-b-right' && !slots['story-b-right']) slots['story-b-right'] = s;
    else if (slot === 'sidebar-bottom' && !slots['sidebar-bottom']) slots['sidebar-bottom'] = s;
    else if (slot === 'small-right' && slots['small-right'].length < 2) slots['small-right'].push(s);
    else if (slot === 'brief' && slots.brief.length < 2) slots.brief.push(s);
    else if (slot === 'special' && !slots.special) slots.special = s;
    else if (slot === 'column' && !slots.column) slots.column = s;
    else if (slot === 'results' && !slots.results) slots.results = s;
    else if (slot === 'bottom-strip' && slots['bottom-strip'].length < 3) slots['bottom-strip'].push(s);
    else if (slot === 'teaser') { /* handled separately */ }
    else leftover.push(s);
  });

  const fillOrder = [
    'story-a-left', 'story-a-right', 'story-b-left', 'story-c-left', 
    'story-d-left', 'story-b-right', 'special', 'column', 'results', 
    'sidebar-bottom'
  ];
  
  fillOrder.forEach((key) => {
    if (!slots[key] && leftover.length) slots[key] = leftover.shift();
  });
  while (slots.brief.length < 2 && leftover.length) slots.brief.push(leftover.shift());
  while (slots['small-right'].length < 2 && leftover.length) slots['small-right'].push(leftover.shift());
  
  // Fill the bottom vertical columns with remaining stories
  while (slots['bottom-strip'].length < 3 && leftover.length) slots['bottom-strip'].push(leftover.shift());

  return { slots, leftover };
}

function renderTable(story) {
  if (!story || !story.table || !story.table.length) return '';
  const head = story.tableHead || [];
  return `
    <div class="inset-table">
      ${story.tableCaption ? `<div class="inset-table-caption">${clean(story.tableCaption, 6)}</div>` : ''}
      <table>
        ${head.length ? `<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}
        <tbody>
          ${story.table.map(row => `
            <tr>
              <td class="row-label">${esc(row.label)}</td>
              ${(row.cols || [row.col1, row.col2, row.col3].filter(v => v !== undefined))
                .map(v => `<td>${esc(v)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBarList(story) {
  if (!story || !story.barList || !story.barList.length) return '';
  const max = Math.max(...story.barList.map(r => Math.abs(r.pct))) || 1;
  return `
    <div class="bar-list">
      ${story.barListCaption ? `<div class="inset-table-caption">${clean(story.barListCaption, 6)}</div>` : ''}
      ${story.barList.map(r => `
        <div class="bar-row">
          <span class="bar-label">${esc(r.label)}</span>
          <span class="bar-track">
            <span class="bar-fill" style="width:${Math.min(100, Math.abs(r.pct) / max * 100)}%"></span>
          </span>
          <span class="bar-value">${r.pct > 0 ? '+' : ''}${r.pct}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPageBox(story) {
  if (!story || !story.pageBox) return '';
  return `
    <div class="page-box">
      <span class="page-box-num">PAGE ${esc(story.pageBox.page)}</span>
      <span class="page-box-teaser">${clean(story.pageBox.teaser, LIMITS.pageBoxTeaser)}</span>
    </div>
  `;
}

function renderCallout(story) {
  if (!story || !story.calloutQuote) return '';
  return `
    <div class="callout">
      <div class="callout-photo" style="${bgImg(story.imageUrl)}"></div>
      <div class="callout-text">
        ${story.calloutAttribution ? `<div class="callout-attr">${esc(story.calloutAttribution).toUpperCase()}</div>` : ''}
        <div class="callout-quote">"${clean(story.calloutQuote, 28)}"</div>
      </div>
    </div>
  `;
}

function byline(story) {
  return `${esc(story.author) || 'Staff Reporter'}${story.city ? `, ${esc(story.city)}` : ''}`;
}

function renderMainStory(story, { size = 'a', cols = 1, hideHeadline = false, showImage = false, textLimitOverride = null } = {}) {
  if (!story) return '<div></div>';
  
  const hLimits = size === 'lead'
    ? { h: LIMITS.leadHeadline, d: LIMITS.aDeck, b: Math.floor(LIMITS.aBody * 1.5) }
    : size === 'a'
    ? { h: LIMITS.aHeadline, d: LIMITS.aDeck, b: LIMITS.aBody }
    : { h: LIMITS.bHeadline, d: LIMITS.bDeck, b: LIMITS.bBody };
    
  const textLimit = textLimitOverride || ((cols > 1 && size !== 'lead') ? Math.floor(hLimits.b * 1.5) : hLimits.b);

  return `
    <div class="story" style="display: flex; flex-direction: column; height: 100%; margin-bottom: 8px; overflow: hidden;">
      ${(!hideHeadline && (story.headline || story.title)) ? `<h2 class="headline ${size === 'lead' ? 'lead-headline' : ''}">${clean(story.headline || story.title, hLimits.h)}</h2>` : ''}
      ${(story.deck || story.summary) ? `<div class="deck">${clean(story.deck || story.summary, hLimits.d)}</div>` : ''}
      <div class="byline">${byline(story)}</div>
      ${(showImage && safeImage(story.imageUrl)) ? `<div class="story-image" style="${bgImg(story.imageUrl)} width:100%; height:${size === 'lead' ? '220px' : '140px'}; background-size:cover; background-position:center; margin-bottom:10px; background-color:#ccc; border-radius:2px; flex-shrink: 0;"></div>` : ''}
      ${renderTable(story)}
      ${renderBarList(story)}
      ${renderCallout(story)}
      <div class="body" style="${cols > 1 ? `column-count:${cols}; column-gap:14px; ` : ''}flex-grow: 1; overflow: hidden;">${clean(story.body || story.content, textLimit)}</div>
      ${renderPageBox(story)}
      ${story.jumpPage ? `<div class="jump">Turn to Page ${esc(story.jumpPage)}</div>` : ''}
    </div>
  `;
}

function renderFeatureBlock(story, isSplit) {
  if (!story) return '';
  if (isSplit) {
    const bodyStr = stripHtml(story.body || story.content);
    const bodyWords = bodyStr.split(/\s+/).filter(Boolean);
    const limit = LIMITS.splitFeatureBody; 
    const actualLimit = Math.min(bodyWords.length, limit);
    
    const part1Limit = Math.floor(actualLimit * 0.45);
    const part1 = bodyWords.slice(0, part1Limit).join(' ');
    const part2 = bodyWords.slice(part1Limit, actualLimit).join(' ') + (bodyWords.length > limit ? '...' : '');

    return `
      <div class="feature" style="display: flex; flex-direction: column; height: 100%;">
        <h2 style="font-size: 20px; font-style: italic; font-weight: 700; margin-bottom: 8px;">${clean(story.headline || story.title, LIMITS.featureTitle)}</h2>
        <div class="feature-split-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex-grow: 1;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div class="intro" style="font-size: 12.5px; line-height: 1.45;">${clean(story.intro || story.summary, LIMITS.featureIntro)}</div>
            <div class="qa-body" style="font-size: 12px; line-height: 1.45; text-align: justify; flex-grow: 1;">${part1}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${safeImage(story.imageUrl) ? `<div class="photo" style="${bgImg(story.imageUrl)} width: 100%; height: 120px; background-color: #ccc; background-size: cover; background-position: center;"></div>` : ''}
            <div class="qa-body" style="font-size: 12px; line-height: 1.45; text-align: justify; flex-grow: 1;">${part2}</div>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="feature">
      <h2>${clean(story.headline || story.title, LIMITS.featureTitle)}</h2>
      <div class="feature-body">
        ${story.statBox ? `
        <div class="stat-box">
          <div class="value">${esc(story.statBox.value)}</div>
          <div class="label">${esc(story.statBox.label)}</div>
        </div>` : '<div></div>'}
        <div>
          <div class="byline">Q&amp;A</div>
          <div class="intro">${clean(story.intro || story.summary, LIMITS.featureIntro)}</div>
          ${story.pullQuote ? `<div class="pull-quote">${clean(story.pullQuote, LIMITS.pullQuote)}</div>` : ''}
          <div class="qa-body">${clean(story.body || story.content, LIMITS.featureBody)}</div>
        </div>
        <div>
          <div class="photo" style="${bgImg(story.imageUrl)}"></div>
          ${story.photoCaption ? `<div class="photo-caption">${clean(story.photoCaption, 10)}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function getBaseCSS() {
  return `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; background:#e9e9e9; color:#111; padding:20px; }
  .page a, .page a:visited { color:inherit; text-decoration:none; font:inherit; }
  .page img { max-width:100%; display:block; }
  .page { max-width:1320px; margin:0 auto 40px auto; background:#fdf8f0; padding:16px 24px 24px; box-shadow:0 8px 30px rgba(0,0,0,.15); }
  
  @media print {
    body { background: #fff; padding: 0; }
    .page { margin: 0; box-shadow: none; page-break-after: always; padding-bottom: 20px; }
    .page:last-child { page-break-after: auto; }
  }

  /* FRONT PAGE SPECIFIC */
  .top-meta { display:flex; justify-content:space-between; align-items:flex-start; font-family:Arial,sans-serif; font-size:11px; color:#333; border-bottom:1px solid #999; padding-bottom:4px; margin-bottom:8px; }
  .top-meta .left div { line-height:1.5; }
  .top-meta .left .day-date { font-weight:700; letter-spacing:1px; }
  .top-meta .right { text-align:right; font-weight:700; }
  .masthead { text-align:center; border-bottom:3px double #111; padding:4px 0 6px; margin-bottom:8px; }
  .masthead h1 { font-family:'Times New Roman', Georgia, serif; font-size:52px; font-weight:700; letter-spacing:.5px; color:#000; line-height:1.1; }
  .masthead .url { font-family:Arial,sans-serif; font-size:11px; color:#555; margin-top:2px; }
  
  /* TEASERS */
  .teaser-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:0; border-top:1px solid #999; border-bottom:1px solid #999; margin-bottom:12px; }
  .teaser { display:flex; gap:8px; padding:6px 12px; border-left:1px solid #ccc; }
  .teaser:first-child { border-left:none; }
  .teaser .thumb { width:50px; height:50px; flex:none; border-radius:2px; background-color:#ccc; background-size:cover; background-position:center; }
  .teaser .tag { font-family:Arial,sans-serif; font-size:10px; font-weight:700; color:#c0392b; letter-spacing:.5px; }
  .teaser .tag .pg { color:#333; font-weight:400; }
  .teaser .headline { font-size:13px; font-weight:700; line-height:1.2; margin-top:2px; }

  /* CONTENT GRID */
  .content-grid { display:grid; grid-template-columns:16fr 56fr 24fr; gap:12px; border-top:2px solid #111; padding-top:10px; }
  
  .sidebar { border-right:1px solid #d8d0c4; padding-right:12px; display: flex; flex-direction: column; }
  .sidebar > *:not(:last-child) { margin-bottom:12px; }
  .box-header { background:#c0392b; color:#fff; font-family:Arial,sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; padding:4px 8px; margin-bottom:6px; }
  .sidebar-item, .side-item { margin-bottom:8px; }
  .sidebar-item h4, .side-item h4 { font-size:13px; font-weight:700; margin-bottom:2px; }
  .sidebar-item p, .side-item p { font-size:11.5px; line-height:1.35; color:#333; }
  
  .middle-column, .right-column { display: flex; flex-direction: column; text-align:justify; font-family:sans-serif; }
  .middle-column { border-right: 1px solid #d8d0c4; padding-right: 12px; }
  .col-item:not(:last-child) { border-bottom: 1px solid #111; padding-bottom: 10px; margin-bottom: 10px; }
  .col-item:last-child { flex-grow: 1; }
  .middle-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* FRONT PAGE BOTTOM VERTICAL GRID */
  .bottom-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 2px solid #111; }
  .bottom-grid > div { border-right: 1px solid #d8d0c4; padding-right: 16px; display: flex; flex-direction: column; }
  .bottom-grid > div:last-child { border-right: none; padding-right: 0; }

  /* STORY STYLING */
  .story h2.headline { font-size:24px; font-weight:700; line-height:1.1; margin-bottom:4px; }
  .story h2.lead-headline { font-size:30px; line-height:1.1; margin-bottom:6px; }
  .story .deck { font-size:17px; color:#333; font-family:Arial,sans-serif;font-weight:900; margin-bottom:6px; line-height:1.2; }
  .story .byline { font-family:Arial,sans-serif; font-size:10px; font-weight:700; text-transform:uppercase; color:#555; margin-bottom:6px; }
  .story .body { font-size:12.5px; line-height:1.45; }
  
  /* MISC COMPONENTS */
  .special-box, .column-box { border:1px solid #ddd; padding:6px 8px; }
  .special-box .kicker, .column-box .kicker { font-family:Arial,sans-serif; font-size:10px; font-weight:700; color:#c0392b; text-transform:uppercase; margin-bottom:2px; }
  .special-box h4, .column-box h4 { font-size:13px; margin-bottom:2px; }
  .special-box p, .column-box p { font-size:11.5px; line-height:1.35; color:#333; }
  .markets-table table, .results-box table, .inset-table table { width:100%; border-collapse:collapse; font-size:10.5px; font-family:Arial,sans-serif; }
  .markets-table th, .markets-table td, .results-box th, .results-box td, .inset-table th, .inset-table td { padding:2px 3px; text-align:right; border-bottom:1px solid #eee; }
  .markets-table th:first-child, .markets-table td:first-child, .results-box th:first-child, .results-box td:first-child, .row-label { text-align:left; }
  .crossref-band { background:#f3ece0; border-top:1px solid #111; border-bottom:1px solid #111; font-family:Arial,sans-serif; font-size:11px; font-weight:700; padding:6px 10px; display:flex; gap:16px; flex-wrap:wrap; margin:4px 0 16px; }
  .crossref-band span::before { content:"■ "; color:#c0392b; }
  .footer { margin-top:16px; padding-top:8px; border-top:1px solid #111; display:flex; justify-content:space-between; align-items:center; font-family:Arial,sans-serif; font-size:10.5px; color:#666; }

  /* ── INTERIOR PAGES STRICT FIXED LAYOUT ───────────────────────────── */
  .section-header { border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .section-header h2 { font-size: 32px; font-weight: 700; font-family: 'Times New Roman', Georgia, serif; text-transform: uppercase; margin: 0; line-height: 1; letter-spacing: 1px; color: #111; }
  .section-meta { font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; }
  
  .interior-hero { display: grid; grid-template-columns: 65% 35%; gap: 16px; height: 520px; border-bottom: 1px solid #111; padding-bottom: 12px; margin-bottom: 16px; overflow: hidden; }
  .interior-hero .lead-col { border-right: 1px solid #d8d0c4; padding-right: 16px; height: 100%; overflow: hidden; }
  .interior-hero .side-col { display: flex; flex-direction: column; gap: 12px; height: 100%; overflow: hidden; }
  .interior-hero .side-col .story { flex: 1; height: calc(50% - 6px); border-bottom: 1px dashed #d8d0c4; padding-bottom: 12px; margin-bottom: 0; overflow: hidden; }
  .interior-hero .side-col .story:last-child { border-bottom: none; padding-bottom: 0; }

  .interior-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start; flex-grow: 1; }
  .interior-grid > div { border-right: 1px solid #d8d0c4; padding-right: 16px; }
  .interior-grid > div:last-child { border-right: none; padding-right: 0; }

  @media (max-width:900px) {
    .content-grid, .interior-hero, .interior-grid, .bottom-grid { grid-template-columns:1fr; }
    .interior-hero { height: auto; } /* Let it grow on mobile if needed */
    .sidebar, .middle-column, .interior-hero .lead-col, .interior-grid > div, .bottom-grid > div { border-right:none; padding-right:0; }
    .middle-split { grid-template-columns:1fr; }
  }
  `;
}

function renderCategoryPage(pageNum, sectionName, stories, meta) {
  if (!stories || stories.length === 0) {
    return `
      <div class="page interior-page">
        <div class="section-header">
          <h2>${esc(sectionName)}</h2>
          <div class="section-meta">PAGE ${pageNum} | ${esc(meta.dateStr)} | ${esc(meta.title)}</div>
        </div>
        <div style="padding: 100px 20px; text-align: center; color: #777; font-family: Arial, sans-serif; font-size: 14px; font-style: italic; border: 1px dashed #ccc; margin: 20px 0; flex-grow: 1;">
          No stories available for ${esc(sectionName)} today.
        </div>
        <div class="footer" style="margin-top:auto;">
          <div>${new Date().getFullYear()} ${esc(meta.title)} • All rights reserved</div>
        </div>
      </div>
    `;
  }

  const lead = stories[0];
  const side = stories.slice(1, 3);
  const grid = stories.slice(3, 9);

  return `
    <div class="page interior-page">
      <div class="section-header">
        <h2>${esc(sectionName)}</h2>
        <div class="section-meta">PAGE ${pageNum} | ${esc(meta.dateStr)} | ${esc(meta.title)}</div>
      </div>

      <div class="interior-hero">
        <div class="lead-col">
          ${renderMainStory(lead, { size: 'lead', cols: 2, showImage: true, textLimitOverride: 250 })}
        </div>
        <div class="side-col">
          ${side.map(s => renderMainStory(s, { size: 'b', showImage: true, textLimitOverride: 70 })).join('')}
        </div>
      </div>

      ${grid.length > 0 ? `
      <div class="interior-grid">
        ${grid.map(s => `<div>${renderMainStory(s, { size: 'a', showImage: false })}</div>`).join('')}
      </div>
      ` : ''}

      <div class="footer" style="margin-top:auto;">
        <div>${new Date().getFullYear()} ${esc(meta.title)} • All rights reserved</div>
      </div>
    </div>
  `;
}

// MAIN EXPORT FUNCTION - RENDERS ALL 7 PAGES
function renderFrontPage(config) {
  const { title, dateObj, timezone, stories, edition, pageCount, price, volume, markets } = config;
  
  if (!stories || stories.length === 0) {
    return '<html><body><h1>No stories available</h1></body></html>';
  }

  const { slots, leftover } = assignSlots(stories); 
  const teasers = stories.filter(s => s.slot === 'teaser').slice(0, 3);

  const dateStr = dateObj.toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: timezone
  }).toUpperCase();

  const marketsRows = (markets && markets.length) ? markets : [
    { label: 'Sensex', level: '78,499.2', chg: '-455.6' },
    { label: 'Nifty', level: '24,570.7', chg: '+65.3' },
    { label: 'Dollar', level: '₹92.15', chg: '-92.5' },
    { label: 'Gold (10g)', level: '₹1,49,022.0', chg: '+1,176.0' }
  ];

  const jumpEntries = [slots['story-a-left'], slots['story-a-right'], slots['story-b-left'], slots['story-c-left'], slots['story-d-left'], slots['story-b-right']]
    .filter(s => s && s.jumpPage && s.jumpLabel);

  let htmlOutput = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <style>
    ${getBaseCSS()}
  </style>
  </head>
  <body>
  
  <!-- PAGE 1 (Front Page) -->
  <div class="page">
    <div class="top-meta">
      <div class="left">
        <div class="day-date">${dateStr}</div>
        <div>7 pages | Edition: ${esc(edition) || 'Main'}</div>
        <div>Vol ${esc(volume) || 'I'}</div>
      </div>
      <div class="right">
        <div class="price">₹${esc(price) || '15.00'}</div>
        <div>${esc(timezone)}</div>
      </div>
    </div>

    <div class="masthead">
      <h1>${esc(title)}</h1>
      <div class="url">www.${esc(title).toLowerCase().replace(/\s+/g, '')}.com</div>
    </div>

    ${teasers.length ? `
    <div class="teaser-strip">
      ${teasers.map(t => `
        <div class="teaser">
          <div class="thumb" style="${bgImg(t.imageUrl)}"></div>
          <div>
            <div class="tag">${esc(t.category || 'NEWS').toUpperCase()}${t.jumpPage ? ` <span class="pg">› ${esc(t.jumpPage)}</span>` : ''}</div>
            <div class="headline">${clean(t.headline || t.title, LIMITS.teaserHeadline)}</div>
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="content-grid">
      <div class="sidebar">
        <div class="markets-table">
          <div class="box-header">Markets</div>
          <table>
            <thead><tr><th></th><th>Level</th><th>Chg</th></tr></thead>
            <tbody>
              ${marketsRows.map(m => `<tr><td>${esc(m.label)}</td><td>${esc(m.level)}</td><td>${esc(m.chg)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        ${slots.brief.length ? `
        <div class="in-brief">
          <div class="box-header">In Brief</div>
          ${slots.brief.map(s => `
            <div class="sidebar-item">
              <h4>${clean(s.headline || s.title, LIMITS.briefTitle)}</h4>
              <p>${clean(s.summary || s.body || s.description, LIMITS.briefBody)}</p>
            </div>
          `).join('')}
        </div>` : ''}

        ${slots.special ? `
        <div class="special-box">
          <div class="kicker">Special</div>
          <h4>${clean(slots.special.headline || slots.special.title, LIMITS.specialTitle)}</h4>
          <p>${clean(slots.special.summary || slots.special.body, LIMITS.specialBody)}</p>
        </div>` : ''}

        ${slots.column ? `
        <div class="column-box">
          <div class="kicker">Analysis</div>
          <h4>${clean(slots.column.headline || slots.column.title, LIMITS.columnTitle)}</h4>
          <p>${clean(slots.column.summary || slots.column.body, LIMITS.columnBody)}</p>
        </div>` : ''}

        ${(slots.results && slots.results.table && slots.results.table.length) ? `
        <div class="results-box">
          <div class="box-header">Data</div>
          ${renderTable(slots.results)}
        </div>` : ''}

        ${slots['sidebar-bottom'] ? `
        <div class="sidebar-bottom-story" style="margin-top: 12px; border-top: 1px dashed #d8d0c4; padding-top: 12px;">
          <div class="box-header" style="margin-bottom: 8px;">More News</div>
          ${renderMainStory(slots['sidebar-bottom'], { size: 'b', showImage: false, textLimitOverride: LIMITS.sidebarBody })}
        </div>` : ''}
      </div>

      <div class="middle-column">
        <div class="col-item">
          ${renderMainStory(slots['story-a-left'], { size: 'lead', cols: 2, showImage: true })}
        </div>
        <div class="col-item middle-split">
          <div>${renderMainStory(slots['story-b-left'], { size: 'b' })}</div>
          <div>${renderMainStory(slots['story-c-left'], { size: 'b' })}</div>
        </div>
        <div class="col-item" style="flex-grow: 1;">
          ${renderMainStory(slots['story-d-left'], { size: 'b', cols: 3, hideHeadline: true })}
        </div>
      </div>

      <div class="right-column">
        <div class="col-item">${renderMainStory(slots['story-a-right'], { size: 'a' })}</div>
        <div class="col-item">${renderMainStory(slots['story-b-right'], { size: 'b', showImage: true })}</div>
        ${slots['small-right'].length > 0 ? `
        <div class="col-item" style="flex-grow: 1;">
          ${slots['small-right'].slice(0, 1).map(s => `
            <div class="side-item">
              <h4>${clean(s.headline || s.title, LIMITS.smallHeadline)}</h4>
              <p>${clean(s.summary || s.body || s.description, LIMITS.smallBody)}</p>
            </div>
          `).join('')}
        </div>` : ''}
      </div>
    </div>

    ${jumpEntries.length ? `
    <div class="crossref-band">
      ${jumpEntries.map(s => `<span>${esc(s.jumpLabel)}</span>`).join('')}
    </div>` : ''}

    ${slots['bottom-strip'].length > 0 ? `
    <div class="bottom-grid">
      ${slots['bottom-strip'].map(s => `<div>${renderMainStory(s, { size: 'a', showImage: true, textLimitOverride: 110 })}</div>`).join('')}
    </div>` : ''}

    <div class="footer">
      <div>${new Date().getFullYear()} ${esc(title)} • All rights reserved</div>
      <div class="reg-dots">
        <span style="background:#00aeef"></span><span style="background:#ec008c"></span>
        <span style="background:#fff200;border:1px solid #ccc"></span><span style="background:#111"></span>
        <span style="background:#c0392b"></span>
      </div>
    </div>
  </div>
  `;

  const buckets = {
    'Politics': [], 'Business': [], 'Technology': [], 
    'Entertainment': [], 'Sports': [], 'Food & Health': []
  };
  const unassigned = [];

  leftover.forEach(story => {
    let cat = (story.category || '').toLowerCase() + " " + (story.section || '').toLowerCase();
    
    if (cat.includes('politi') || cat.includes('nation') || cat.includes('world')) buckets['Politics'].push(story);
    else if (cat.includes('busines') || cat.includes('finance') || cat.includes('market') || cat.includes('econ')) buckets['Business'].push(story);
    else if (cat.includes('tech') || cat.includes('sci') || cat.includes('cyber')) buckets['Technology'].push(story);
    else if (cat.includes('entertain') || cat.includes('movie') || cat.includes('art') || cat.includes('music')) buckets['Entertainment'].push(story);
    else if (cat.includes('sport') || cat.includes('athlet') || cat.includes('game')) buckets['Sports'].push(story);
    else if (cat.includes('food') || cat.includes('health') || cat.includes('life') || cat.includes('wellness')) buckets['Food & Health'].push(story);
    else unassigned.push(story);
  });

  const bucketKeys = Object.keys(buckets);
  unassigned.forEach(story => {
    let minKey = bucketKeys[0];
    for (let key of bucketKeys) {
      if (buckets[key].length < buckets[minKey].length) {
        minKey = key;
      }
    }
    buckets[minKey].push(story);
  });

  const interiorMeta = { title, dateStr };
  const interiorPages = [
    { name: 'Politics', stories: buckets['Politics'] },
    { name: 'Business', stories: buckets['Business'] },
    { name: 'Technology', stories: buckets['Technology'] },
    { name: 'Entertainment', stories: buckets['Entertainment'] },
    { name: 'Sports', stories: buckets['Sports'] },
    { name: 'Food & Health', stories: buckets['Food & Health'] }
  ];

  let pageNum = 2;
  interiorPages.forEach(page => {
    htmlOutput += `\n<!-- PAGE ${pageNum} (${page.name}) -->\n`;
    htmlOutput += renderCategoryPage(pageNum, page.name, page.stories, interiorMeta);
    pageNum++;
  });

  htmlOutput += `
  </body>
  </html>
  `;

  return htmlOutput;
}

module.exports = {
  renderFrontPage,
  enforceWordLimit,
  LIMITS
};