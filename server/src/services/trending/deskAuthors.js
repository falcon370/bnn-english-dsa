/**
 * Desk-level author attribution for auto-generated articles.
 *
 * Auto-generated articles need a byline (AdSense/E-E-A-T authorship signal), but the
 * pipeline has no real per-article human author. Rather than fabricate individual people,
 * every article is credited to its category "desk" — a real Author record shared by all
 * articles in that category.
 */

const Author = require('../../models/Author');

const DESK_AUTHORS = {
  Politics: { name: 'BNN Politics Desk', bio: 'Coverage of Indian politics, policy, and government from the BNN newsroom.' },
  Business: { name: 'BNN Business Desk', bio: 'Coverage of markets, economy, and business from the BNN newsroom.' },
  Sports: { name: 'BNN Sports Desk', bio: 'Coverage of sports news and results from the BNN newsroom.' },
  Entertainment: { name: 'BNN Entertainment Desk', bio: 'Coverage of entertainment and celebrity news from the BNN newsroom.' },
  Celebrity: { name: 'BNN Entertainment Desk', bio: 'Coverage of entertainment and celebrity news from the BNN newsroom.' },
  Tech: { name: 'BNN Tech Desk', bio: 'Coverage of technology and startups from the BNN newsroom.' },
  Technology: { name: 'BNN Tech Desk', bio: 'Coverage of technology and startups from the BNN newsroom.' },
  World: { name: 'BNN World Desk', bio: 'Coverage of world news and diplomacy from the BNN newsroom.' },
  'Bolta Hai Bharat': { name: 'BNN Opinion Desk', bio: 'Opinion and public-sentiment coverage from the BNN newsroom.' },
  Editorial: { name: 'BNN Opinion Desk', bio: 'Opinion and public-sentiment coverage from the BNN newsroom.' },
};

const FALLBACK_DESK = { name: 'BNN Newsroom', bio: 'General news coverage from the BNN newsroom.' };

const cache = new Map();

const getDeskAuthorId = async (category) => {
  const desk = DESK_AUTHORS[category] || FALLBACK_DESK;

  if (cache.has(desk.name)) {
    return cache.get(desk.name);
  }

  const author = await Author.findOneAndUpdate(
    { name: desk.name },
    { $setOnInsert: { name: desk.name, bio: desk.bio } },
    { upsert: true, new: true }
  );

  cache.set(desk.name, author._id);
  return author._id;
};

module.exports = { getDeskAuthorId };
