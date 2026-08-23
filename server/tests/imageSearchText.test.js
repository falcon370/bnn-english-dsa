const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSearchableText,
  mapCsvRowToImageMetadata,
} = require('../src/utils/imageSearchText');

test('buildSearchableText creates natural language without identifiers or URLs', () => {
  const text = buildSearchableText({
    leader: ' Narendra   Modi ',
    otherNames: [' Modi '],
    leaderDescription: ' He is the prime minister of India. ',
    imageDescription: ' Narendra Modi speaking at podium with microphones. ',
  });

  assert.equal(
    text,
    [
      'Narendra Modi is also known as Modi.',
      'He is the prime minister of India.',
      'The image contains Narendra Modi speaking at podium with microphones.',
    ].join('\n')
  );
  assert.equal(text.includes('https://'), false);
  assert.equal(text.includes('imgnarmod1'), false);
  assert.equal(text.includes('.jpg'), false);
});

test('mapCsvRowToImageMetadata handles loose CSV headers and skips duplicate leader aliases', () => {
  const mapped = mapCsvRowToImageMetadata(
    {
      UniqueID: 'imgnarmod1',
      Name: 'Narendra Modi',
      'Any other name': 'Modi; Narendra Modi',
      'Description of the leader': 'He is the prime minister of India.',
      'Description of the image': 'Narendra Modi speaking at podium.',
      'Url ': 'https://example.com/image.jpg',
      'File name (same as UniqueID with extension)': 'imgnarmod1.jpg',
    },
    2
  );

  assert.equal(mapped.uniqueId, 'imgnarmod1');
  assert.deepEqual(mapped.otherNames, ['Modi']);
  assert.equal(mapped.imageUrl, 'https://example.com/image.jpg');
  assert.equal(mapped.fileName, 'imgnarmod1.jpg');
  assert.equal(mapped.repositoryImageUrl, 'https://storage.googleapis.com/news-images-bnn/imgnarmod1.jpg');
  assert.equal(mapped.sourceRowNumber, 2);
  assert.match(mapped.searchableText, /The image contains Narendra Modi speaking at podium\./);
  assert.equal(mapped.searchableText.includes('https://example.com'), false);
  assert.equal(mapped.searchableText.includes('imgnarmod1.jpg'), false);
});
