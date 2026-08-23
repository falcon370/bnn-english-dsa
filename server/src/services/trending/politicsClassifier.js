/**
 * India-specific political content classifier.
 *
 * Uses two tiers of keyword lists to score text:
 *  - Tier A: Direct political entities (parties, institutions, elections)
 *  - Tier B: Broader governance / legal / protest vocabulary
 *
 * Returns 1 (political) or 0 (not political).
 */

// ── Keyword lists ──────────────────────────────────────────────

const TIER_A_KEYWORDS = [
  'parliament', 'sansad', 'lok sabha', 'rajya sabha', 'vidhan sabha', 'vidhan parishad',
  'legislative assembly', 'legislative council', 'union government', 'central government',
  'state government', 'cabinet', 'council of ministers', 'minister', 'ministry',
  'pmo', 'prime minister', 'chief minister', 'deputy cm', 'governor', 'lieutenant governor', 'lg',
  'speaker', 'leader of opposition', 'whip',
  'bill', 'ordinance', 'act', 'amendment', 'parliamentary committee', 'standing committee',
  'select committee', 'question hour', 'zero hour', 'no-confidence motion', 'confidence motion',
  'floor test', 'finance bill', 'appropriation bill', 'budget', 'interim budget',
  'election commission', 'eci', 'chief election commissioner', 'model code of conduct', 'mcc',
  'polling', 'voter turnout', 'constituency', 'bypoll', 'by-election', 'delimitation',
  'evm', 'vvpat', 'manifesto', 'campaign', 'rally', 'nomination', 'counting',
  'nda', 'upa', 'india bloc', 'i.n.d.i.a', 'coalition',
  'bjp', 'bharatiya janata party',
  'inc', 'congress', 'indian national congress',
  'aap', 'aam aadmi party',
  'cpi', 'cpi(m)', 'cpim', 'left',
  'tmc', 'trinamool congress', 'all india trinamool congress',
  'sp', 'samajwadi party',
  'bsp', 'bahujan samaj party',
  'dmk', 'aiadmk', 'bjd', 'ysrcp', 'tdp', 'jd(u)', 'jdu', 'rjd',
  'shiv sena', 'ncp', 'jmm', 'trs', 'brs', 'sad',
];

const TIER_B_KEYWORDS = [
  'constitution', 'constitutional', 'fundamental rights', 'directive principles',
  'supreme court', 'sc', 'high court', 'pil', 'bench', 'verdict', 'stay order',
  'cji', 'attorney general', 'solicitor general', 'article 370', 'article 356',
  'tenth schedule', 'anti-defection', 'disqualification', 'impeachment',
  'niti aayog', 'raj bhavan', 'rashtrapati bhavan', 'north block', 'south block',
  'panchayat', 'gram sabha', 'municipal corporation', 'municipality',
  'protest', 'agitation', 'dharna', 'bandh', 'hartal',
  'political row', 'opposition attack', 'allegations', 'controversy',
  'governance', 'policy', 'reforms', 'law and order', 'curfew',
  'corruption', 'scam', 'graft', 'resignation', 'cabinet reshuffle',
  'ed', 'enforcement directorate', 'cbi', 'nia', 'lokpal', 'cvc',
];

// ── Helpers ────────────────────────────────────────────────────

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPatterns(keywords) {
  return keywords.map((kw) => {
    const k = normalize(kw);
    const escaped = escapeRegExp(k);
    const isPhrase = /[\s.()]/.test(k);
    const pattern = isPhrase
      ? new RegExp(escaped, 'gi')
      : new RegExp(`\\b${escaped}\\b`, 'gi');
    return { kw, re: pattern };
  });
}

// Pre-compile once at module load
const tierAPatterns = buildPatterns(TIER_A_KEYWORDS);
const tierBPatterns = buildPatterns(TIER_B_KEYWORDS);

function countMatches(text, patterns) {
  let count = 0;
  for (const { re } of patterns) {
    const found = text.match(re);
    if (found) count += found.length;
  }
  return count;
}

// ── World Politics Keyword lists ─────────────────────────────────

const WORLD_TIER_A_KEYWORDS = [
  'president', 'prime minister', 'chancellor', 'premier',
  'foreign minister', 'defense minister', 'government',
  'parliament', 'congress', 'senate', 'election', 'vote',
  'policy', 'law', 'sanctions', 'treaty',
  'un', 'nato', 'eu', 'imf', 'world bank',
  'diplomacy', 'geopolitics', 'summit',
  'war', 'conflict', 'military', 'invasion'
];

const WORLD_TIER_B_KEYWORDS = [
  'court', 'justice', 'verdict',
  'governance', 'reform', 'regulation',
  'protest', 'crisis', 'scandal', 'corruption',
  'trade war', 'tariffs', 'central bank',
  'alliance', 'border dispute'
];

const WORLD_LEADERS = [
  // USA
  'biden', 'donald trump', 'kamala harris',
  // Russia
  'putin', 'medvedev',
  // China
  'xi jinping', 'li keqiang',
  // Europe
  'macron', 'olaf scholz', 'rishi sunak', 'mario draghi', 'peter motz', 'petr farkas',
  // Israel
  'netanyahu', 'yair lapid',
  // Ukraine
  'zelensky',
  // Middle East
  'mohammed bin salman', 'mohammed bin zayed', 'abdullah ii',
  // India (International context)
  'narendra modi', 'amit shah',
  // Africa
  'cyril ramaphosa', 'abiy ahmed', 'mohamed bazoum',
  // Latin America
  'gustavo petro', 'lula da silva', 'andres manuel lopez obrador',
  // Japan / Asia
  'fumio kishida', 'yoshihide suga',
  // Other notable
  'moon jae-in', 'lee nak-yon', 'anastasiadis', 'gotabaya rajapaksa'
];

const worldTierAPatterns = buildPatterns(WORLD_TIER_A_KEYWORDS);
const worldTierBPatterns = buildPatterns(WORLD_TIER_B_KEYWORDS);

function hasLeaderMention(text) {
  const norm = normalize(text);
  return WORLD_LEADERS.some(name => norm.includes(name));
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Classify whether `inputText` is Indian political content.
 * @returns {number} 1 = political, 0 = not political
 */
function classifyPolitics(inputText, options = {}) {
  const { minTierA = 1, minTierB = 3, requireBoth = false } = options;
  const text = normalize(inputText);
  const tierAScore = countMatches(text, tierAPatterns);
  const tierBScore = countMatches(text, tierBPatterns);

  let isPolitical;
  if (requireBoth) {
    isPolitical = (tierAScore >= 1 && tierBScore >= 1) || tierAScore >= 2;
  } else {
    isPolitical = tierAScore >= minTierA || tierBScore >= minTierB;
  }
  return isPolitical ? 1 : 0;
}

/**
 * Classify whether `inputText` is World political content.
 * @returns {number} 1 = world political, 0 = not world political
 */
function classifyPoliticsWorld01(inputText) {
  const text = normalize(inputText);
  const tierAScore = countMatches(text, worldTierAPatterns);
  const tierBScore = countMatches(text, worldTierBPatterns);
  const leaderSignal = hasLeaderMention(text);

  const isPolitical =
    tierAScore >= 1 ||
    tierBScore >= 2 ||
    (tierAScore >= 1 && leaderSignal);
    
  return isPolitical ? 1 : 0;
}

module.exports = { classifyPolitics, classifyPoliticsWorld01 };
