const CSV_COLUMNS = Object.freeze({
  uniqueId: 'UniqueID',
  leader: 'Name',
  otherNames: 'Any other name',
  leaderDescription: 'Description of the leader',
  imageDescription: 'Description of the image',
  imageUrl: 'Url',
  fileName: 'File name',
});

const collapseWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeHeader = (header) => collapseWhitespace(header).toLowerCase();

const getCsvValue = (row, canonicalName) => {
  const wanted = normalizeHeader(canonicalName);
  const matchingKey = Object.keys(row).find((key) => {
    const normalized = normalizeHeader(key);
    return normalized === wanted || normalized.startsWith(wanted);
  });

  return collapseWhitespace(matchingKey ? row[matchingKey] : '');
};

const parseOtherNames = (value, leader) => {
  const normalizedLeader = collapseWhitespace(leader).toLowerCase();

  return collapseWhitespace(value)
    .split(/[;,|]/)
    .map((name) => collapseWhitespace(name))
    .filter(Boolean)
    .filter((name, index, names) => names.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase()) === index)
    .filter((name) => name.toLowerCase() !== normalizedLeader);
};

const CATEGORY_SUBFOLDERS = Object.freeze({
  'politics': '',
  'entertainment': 'entertainment',
  'sports': 'sports',
  'partyflag': 'partyflag',
  'partyleaders': 'partyleaders'
});

const buildRepositoryImageUrl = (fileName, category = '') => {
  const cleanFileName = collapseWhitespace(fileName);
  if (!cleanFileName) return '';

  const baseUrl = (process.env.IMAGE_REPOSITORY_BASE_URL || 'https://storage.googleapis.com/news-images-bnn/').replace(/\/+$/, '');
  const subfolder = category ? (CATEGORY_SUBFOLDERS[category.toLowerCase()] !== undefined ? CATEGORY_SUBFOLDERS[category.toLowerCase()] : category) : '';
  if (subfolder) {
    return `${baseUrl}/${subfolder}/${encodeURIComponent(cleanFileName)}`;
  }
  return `${baseUrl}/${encodeURIComponent(cleanFileName)}`;
};

const trimSentenceEnd = (value) => collapseWhitespace(value).replace(/[.。]+$/u, '');

const buildSearchableText = ({ leader, otherNames = [], leaderDescription, imageDescription }) => {
  const parts = [];
  const cleanLeader = collapseWhitespace(leader);
  const cleanOtherNames = otherNames.map(collapseWhitespace).filter(Boolean);
  const cleanLeaderDescription = trimSentenceEnd(leaderDescription);
  const cleanImageDescription = trimSentenceEnd(imageDescription);

  if (cleanLeader && cleanOtherNames.length) {
    parts.push(`${cleanLeader} is also known as ${cleanOtherNames.join(', ')}.`);
  } else if (cleanLeader) {
    parts.push(`${cleanLeader}.`);
  }

  if (cleanLeaderDescription) {
    parts.push(`${cleanLeaderDescription}.`);
  }

  if (cleanImageDescription) {
    parts.push(`The image contains ${cleanImageDescription}.`);
  }

  return parts.join('\n');
};

const mapCsvRowToImageMetadata = (row, rowNumber = null, category = 'politics') => {
  const uniqueId = getCsvValue(row, CSV_COLUMNS.uniqueId);
  const leader = getCsvValue(row, CSV_COLUMNS.leader);
  const rawOtherNames = getCsvValue(row, CSV_COLUMNS.otherNames);
  const leaderDescription = getCsvValue(row, CSV_COLUMNS.leaderDescription);
  const imageDescription = getCsvValue(row, CSV_COLUMNS.imageDescription);
  const imageUrl = getCsvValue(row, CSV_COLUMNS.imageUrl);
  const fileName = getCsvValue(row, CSV_COLUMNS.fileName);
  const otherNames = parseOtherNames(rawOtherNames, leader);
  const searchableText = buildSearchableText({
    leader,
    otherNames,
    leaderDescription,
    imageDescription,
  });

  const cleanHandle = (val) => {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.toLowerCase() === 'not available' || trimmed === '0' || trimmed === '-' || trimmed.toLowerCase() === 'not available') {
      return '';
    }
    return trimmed;
  };

  const instagramId = cleanHandle(getCsvValue(row, 'Official Instagram id') || getCsvValue(row, 'Instagram id') || getCsvValue(row, 'instagram'));
  const facebookId = cleanHandle(getCsvValue(row, 'Official Facebook id') || getCsvValue(row, 'Facebook id') || getCsvValue(row, 'facebook'));

  return {
    uniqueId,
    leader,
    otherNames,
    leaderDescription,
    imageDescription,
    imageUrl,
    fileName,
    repositoryImageUrl: buildRepositoryImageUrl(fileName, category),
    searchableText,
    sourceRowNumber: rowNumber,
    category,
    instagramId,
    facebookId,
  };
};

module.exports = {
  buildRepositoryImageUrl,
  buildSearchableText,
  collapseWhitespace,
  getCsvValue,
  mapCsvRowToImageMetadata,
  parseOtherNames,
};
