const axios = require('axios');
const News = require('../models/News');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ImageMetadata = require('../models/ImageMetadata');
const csv = require('csv-parser');
const https = require('https');

const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

const checkImageLink = async (url) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return false;
    }
    if (url.includes('serpapi.com/searches')) {
        return false;
    }
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BNN-Poster/1.0'
    };
    try {
        const res = await axiosInstance.head(url, { headers, timeout: 3000 });
        return res.status === 200;
    } catch (e) {
        try {
            const res = await axiosInstance.get(url, { headers: { ...headers, Range: 'bytes=0-0' }, timeout: 3000 });
            return res.status === 200 || res.status === 206;
        } catch (err) {
            return false;
        }
    }
};

const getFallbackImageUrl = (category) => {
    const backendUrl = process.env.BACKEND_API_BASE_URL || 'https://backend-service-682124901351.asia-south1.run.app';
    const cleanCat = category ? category.toLowerCase().trim() : 'politics';
    
    let path = 'Politics/image_1.png';
    if (cleanCat === 'business') {
        path = 'Business/image_3.jpg';
    } else if (cleanCat === 'entertainment') {
        path = 'Entertainment/image_1.png';
    } else if (cleanCat === 'sports') {
        path = 'Sports/image_1.jpg';
    } else if (cleanCat === 'tech' || cleanCat === 'technology') {
        path = 'Tech/image1.jpeg';
    } else if (cleanCat === 'world' || cleanCat === 'geopolitics') {
        path = 'World/world_general_1.png';
    }
    
    return `${backendUrl}/BNN_images/${path}`;
};

let cachedCsvMappings = null;

const getCsvSocialMappings = async () => {
    if (cachedCsvMappings) {
        return cachedCsvMappings;
    }

    const mappings = [];
    const csvDir = path.resolve(__dirname, '../../csv_data');
    if (!fs.existsSync(csvDir)) {
        return [];
    }

    const cleanHandle = (val) => {
        if (!val) return '';
        const trimmed = val.trim();
        if (trimmed.toLowerCase() === 'not available' || trimmed === '0' || trimmed === '-' || trimmed.toLowerCase() === 'not available') {
            return '';
        }
        return trimmed;
    };

    const getCsvValue = (row, canonicalName) => {
        const collapseWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const normalizeHeader = (header) => collapseWhitespace(header).toLowerCase();
        
        const wanted = normalizeHeader(canonicalName);
        const matchingKey = Object.keys(row).find((key) => {
            const normalized = normalizeHeader(key);
            return normalized === wanted || normalized.startsWith(wanted);
        });

        return collapseWhitespace(matchingKey ? row[matchingKey] : '');
    };

    try {
        const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
        for (const file of files) {
            const filePath = path.join(csvDir, file);
            const rows = [];
            await new Promise((resolve) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (data) => rows.push(data))
                    .on('end', resolve);
            });

            for (const row of rows) {
                const name = (row.Name || row['Full Name'] || row.leader || '').trim();
                const otherNamesRaw = row['Any other name'] || '';
                const otherNames = otherNamesRaw.split(/[;,|]/).map(n => n.trim()).filter(Boolean);

                if (!name) continue;

                const instagramId = cleanHandle(getCsvValue(row, 'Official Instagram id') || getCsvValue(row, 'Instagram id') || getCsvValue(row, 'instagram'));
                const facebookId = cleanHandle(getCsvValue(row, 'Official Facebook id') || getCsvValue(row, 'Facebook id') || getCsvValue(row, 'facebook'));

                if (instagramId || facebookId) {
                    mappings.push({
                        name: name,
                        otherNames: otherNames,
                        instagramId: instagramId,
                        facebookId: facebookId
                    });
                }
            }
        }
        cachedCsvMappings = mappings;
    } catch (err) {
        console.error('[Social Media handles] Failed to load CSV social mappings:', err.message);
    }

    return mappings || [];
};

const getSocialMappings = async () => {
    let dbMappings = [];
    try {
        const items = await ImageMetadata.find({
            $or: [
                { instagramId: { $ne: '' } },
                { facebookId: { $ne: '' } }
            ]
        }).select('leader otherNames instagramId facebookId');

        const map = new Map();
        for (const item of items) {
            const key = item.leader.toLowerCase().trim();
            if (!map.has(key)) {
                map.set(key, {
                    name: item.leader,
                    otherNames: item.otherNames || [],
                    instagramId: item.instagramId || '',
                    facebookId: item.facebookId || ''
                });
            } else {
                const existing = map.get(key);
                const mergedNames = new Set([...existing.otherNames, ...(item.otherNames || [])]);
                existing.otherNames = Array.from(mergedNames);
                if (!existing.instagramId && item.instagramId) {
                    existing.instagramId = item.instagramId;
                }
                if (!existing.facebookId && item.facebookId) {
                    existing.facebookId = item.facebookId;
                }
            }
        }
        dbMappings = Array.from(map.values());
    } catch (err) {
        console.error('[Social Media handles] Failed to fetch mappings from MongoDB:', err.message);
    }

    const csvMappings = await getCsvSocialMappings();

    const mergedMap = new Map();
    for (const mapping of csvMappings) {
        const key = mapping.name.toLowerCase().trim();
        mergedMap.set(key, mapping);
    }

    for (const mapping of dbMappings) {
        const key = mapping.name.toLowerCase().trim();
        if (!mergedMap.has(key)) {
            mergedMap.set(key, mapping);
        } else {
            const existing = mergedMap.get(key);
            const mergedNames = new Set([...existing.otherNames, ...mapping.otherNames]);
            existing.otherNames = Array.from(mergedNames);
            if (mapping.instagramId) existing.instagramId = mapping.instagramId;
            if (mapping.facebookId) existing.facebookId = mapping.facebookId;
        }
    }

    return Array.from(mergedMap.values());
};

const detectSocialTags = async (newsItem) => {
    const title = newsItem.title || newsItem.topic || '';
    const summary = newsItem.summary || '';
    const content = newsItem.content || '';
    const textToSearch = `${title} ${summary} ${content}`.toLowerCase();

    const mappings = await getSocialMappings();
    const matchedInsta = [];
    const matchedFb = [];

    const formatHandle = (handle) => {
        const trimmed = handle.trim();
        return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    };

    for (const mapping of mappings) {
        const namesToSearch = [mapping.name, ...mapping.otherNames].filter(Boolean);
        const isMentioned = namesToSearch.some(name => {
            const cleanName = name.trim().toLowerCase();
            if (cleanName.length < 3) return false;
            
            const escapedName = cleanName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
            return regex.test(textToSearch);
        });

        if (isMentioned) {
            if (mapping.instagramId) matchedInsta.push(formatHandle(mapping.instagramId));
            if (mapping.facebookId) matchedFb.push(formatHandle(mapping.facebookId));
        }
    }

    const uniqueInsta = Array.from(new Set(matchedInsta));
    const uniqueFb = Array.from(new Set(matchedFb));

    return {
        instagramTagsStr: uniqueInsta.length > 0 ? `\n\nFeaturing: ${uniqueInsta.join(' ')}` : '',
        facebookTagsStr: uniqueFb.length > 0 ? `\n\nFeaturing: ${uniqueFb.map(handle => `${handle} (facebook.com/${handle.replace(/^@/, '')})`).join(' ')}` : ''
    };
};


const postToFacebook = async (newsItem) => {
    const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    const missingKeys = !pageAccessToken || !pageId || pageAccessToken === 'your_facebook_page_access_token_here' || pageId === 'your_facebook_page_id_here';

    const title = newsItem.title || newsItem.topic;
    const summary = newsItem.summary || '';
    let imageToPost = newsItem.imageUrl || (newsItem.sourceOptions && newsItem.sourceOptions.length > 0 ? newsItem.sourceOptions[0].imageUrl : null);
    
    const isImageAccessible = await checkImageLink(imageToPost);
    if (!isImageAccessible) {
        console.log(`[Social Media - facebook] Image URL ${imageToPost} is invalid or inaccessible. Using fallback category image...`);
        imageToPost = getFallbackImageUrl(newsItem.category);
    }
    
    const storyId = newsItem._id;

    // MANDATORY FIELD CHECKS (Headline, Summary, Image, Link)
    if (!title || title.trim().length < 5) {
        console.error(`[Social Media] Skip: Title/Headline missing or too short for ID: ${storyId}`);
        return false;
    }
    if (!summary || summary.trim().length < 20) {
        console.error(`[Social Media] Skip: Summary missing or too short for ID: ${storyId}`);
        return false;
    }
    if (!imageToPost || imageToPost === 'null' || !imageToPost.startsWith('http')) {
        console.error(`[Social Media] Skip: Image link missing or invalid for ID: ${storyId}`);
        return false;
    }
    if (!storyId) {
        console.error(`[Social Media] Skip: Story ID missing, cannot generate link.`);
        return false;
    }

    const hashtagsStr = generateBetterHashtags(newsItem);
    const { facebookTagsStr } = await detectSocialTags(newsItem);

    const clientUrl = process.env.CLIENT_URL || 'https://bharatnewsnarratives.com';
    const articleUrl = `${clientUrl}/story/${storyId}`;
    
    // Construct a more prominent message with a clear call-to-action
    let message = `${title}\n\n${summary}\n\n🔗 Read the full story here:\n${articleUrl}${facebookTagsStr}${hashtagsStr}`;
    message = message.trim();

    if (missingKeys) {
        console.log(`[Social Media Mock] Would post to Facebook:\n${message}`);
        return { success: true, mock: true }; // Return object here too
    }

    try {
        let postData = {
            message: message,
            access_token: pageAccessToken
        };

        console.log(`[Social Media] Attempting photo upload for: ${imageToPost}`);
        
        const fbUrl = `https://graph.facebook.com/v19.0/me/photos`;
        const fbResponse = await axiosInstance.post(fbUrl, {
            url: imageToPost,
            caption: message,
            access_token: pageAccessToken
        });

        console.log(`[Social Media] Posted PHOTO to Facebook: "${title}" (ID: ${fbResponse.data.id})`);
        return { success: true, id: fbResponse.data.id };
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error(`[Social Media Error] FB API Error:`, JSON.stringify(errorData, null, 2));
        return { success: false, error: errorData };
    }
};

const cleanImageUrl = (url) => {
    if (!url) return url;
    try {
        if (url.includes('images.unsplash.com')) {
            const urlObj = new URL(url);
            const allowedParams = ['fm', 'w', 'q', 'fit', 'crop', 'cs'];
            const newParams = new URLSearchParams();
            urlObj.searchParams.forEach((value, key) => {
                if (allowedParams.includes(key)) {
                    newParams.set(key, value);
                }
            });
            if (!newParams.has('fm')) newParams.set('fm', 'jpg');
            if (!newParams.has('w')) newParams.set('w', '1080');
            if (!newParams.has('q')) newParams.set('q', '80');
            if (!newParams.has('fit')) newParams.set('fit', 'max');

            return `${urlObj.origin}${urlObj.pathname}?${newParams.toString()}`;
        }
    } catch (err) {
        console.error('[Social Media Warning] Failed to clean image URL:', err.message);
    }
    return url;
};
const generateBetterHashtags = (newsItem) => {
    const category = (newsItem.category || 'news').toLowerCase();
    const tags = new Set([category, 'news', 'breaking', 'india', 'bharatnewsnarratives']);
    
    if (category === 'politics') {
        tags.add('indianpolitics');
        tags.add('politicsnews');
    } else if (category === 'sports') {
        tags.add('indiansports');
        tags.add('cricket');
    } else if (category === 'business') {
        tags.add('market');
        tags.add('finance');
    }

    // Add existing tags from newsItem if available
    if (newsItem.tags && newsItem.tags.length > 0) {
        newsItem.tags.forEach(t => {
            const cleanTag = t.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            // Restrict tag length to avoid ugly, long slug-like hashtags
            if (cleanTag.length > 2 && cleanTag.length <= 20) {
                tags.add(cleanTag);
            }
        });
    }
    
    // Parse title to extract capitalized words (entities/names/topics)
    const title = newsItem.title || newsItem.topic || '';
    const words = title.match(/[A-Z][a-zA-Z0-9]*/g);
    if (words && words.length > 0) {
        const stopWords = new Set([
            'the', 'and', 'but', 'for', 'its', 'our', 'his', 'her', 'who', 'out', 'new', 'day', 'one', 'two', 
            'off', 'set', 'get', 'put', 'ran', 'run', 'india', 'indian', 'court', 'state', 'government', 
            'party', 'minister', 'news', 'report', 'after', 'with', 'against', 'from', 'over', 'will', 
            'about', 'this', 'that', 'their', 'they', 'them', 'says', 'calls', 'amid', 'adds', 'held', 
            'seek', 'seeks', 'take', 'takes', 'make', 'makes', 'want', 'wants', 'been', 'have', 'were', 
            'also', 'has', 'had', 'are', 'was', 'not', 'into', 'than', 'then', 'down', 'only', 'very', 'fine'
        ]);
        
        words.forEach(w => {
            const cleanWord = w.toLowerCase();
            // Ensure words are between 3 and 20 characters and not in stopWords
            if (cleanWord.length > 2 && cleanWord.length <= 20 && !stopWords.has(cleanWord)) {
                tags.add(cleanWord);
            }
        });
    }
    
    // Convert back to hashtag format, taking a max of 8 premium tags
    const tagsList = Array.from(tags).slice(0, 8);
    return '\n\n' + tagsList.map(t => `#${t}`).join(' ');
};

const postToInstagram = async (newsItem) => {
    const isInstagramLogin = !!process.env.INSTAGRAM_ACCESS_TOKEN;
    const accessToken = isInstagramLogin ? process.env.INSTAGRAM_ACCESS_TOKEN : process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !igId || igId === 'your_instagram_business_account_id_here' || igId === 'your_instagram_user_id_here') {
        console.log(`[Instagram Mock] Skip: Missing IG ID or Token.`);
        return { success: false, error: 'Missing Instagram configuration' };
    }

    const title = newsItem.title || newsItem.topic;
    const summary = newsItem.summary || '';
    let rawImage = newsItem.imageUrl || (newsItem.sourceOptions && newsItem.sourceOptions.length > 0 ? newsItem.sourceOptions[0].imageUrl : null);
    
    const isImageAccessible = await checkImageLink(rawImage);
    if (!isImageAccessible) {
        console.log(`[Instagram] Image URL ${rawImage} is invalid or inaccessible. Using fallback category image...`);
        rawImage = getFallbackImageUrl(newsItem.category);
    }
    
    const storyId = newsItem._id;

    // MANDATORY FIELD CHECKS (Headline, Summary, Image, Link)
    if (!title || title.trim().length < 5) {
        console.error(`[Instagram] Skip: Title/Headline missing or too short for ID: ${storyId}`);
        return { success: false, error: 'Title missing or too short' };
    }
    if (!summary || summary.trim().length < 20) {
        console.error(`[Instagram] Skip: Summary missing or too short for ID: ${storyId}`);
        return { success: false, error: 'Summary missing or too short' };
    }
    if (!rawImage || rawImage === 'null' || !rawImage.startsWith('http')) {
        console.error(`[Instagram] Skip: Image link missing or invalid for ID: ${storyId}`);
        return { success: false, error: 'Image missing or invalid' };
    }
    if (!storyId) {
        console.error(`[Instagram] Skip: Story ID missing, cannot generate link.`);
        return { success: false, error: 'Story ID missing' };
    }

    const imageToPost = cleanImageUrl(rawImage);
    const clientUrl = process.env.CLIENT_URL || 'https://bharatnewsnarratives.com';
    const articleUrl = `${clientUrl}/story/${storyId}`;
    
    const hashtagsStr = generateBetterHashtags(newsItem);
    const { instagramTagsStr } = await detectSocialTags(newsItem);

    const caption = `${title}\n\n${summary}\n\n🔗 Read the full story: Link in Bio! 👉 @bharatnewsnarratives\n(Or copy & paste: ${articleUrl})${instagramTagsStr}${hashtagsStr}`;

    const baseDomain = isInstagramLogin ? 'graph.instagram.com' : 'graph.facebook.com';
    const apiVersion = 'v19.0';

    try {
        console.log(`[Instagram] Creating media container for: ${imageToPost} using ${baseDomain}`);
        
        // 1. Create Media Container
        const containerUrl = `https://${baseDomain}/${apiVersion}/${igId}/media`;
        const containerResp = await axiosInstance.post(containerUrl, {
            image_url: imageToPost,
            caption: caption,
            access_token: accessToken
        });

        const creationId = containerResp.data.id;
        if (!creationId) throw new Error('No creation_id returned from Instagram');

        console.log(`[Instagram] Created container ID: ${creationId}. Polling status...`);

        // Poll container status until it's FINISHED or ERROR
        let statusCode = 'IN_PROGRESS';
        let pollCount = 0;
        const maxPolls = 20; // 20 polls * 3 seconds = 60 seconds max
        const statusUrl = `https://${baseDomain}/${apiVersion}/${creationId}`;

        while (statusCode === 'IN_PROGRESS' && pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            pollCount++;

            try {
                const statusResp = await axiosInstance.get(statusUrl, {
                    params: {
                        fields: 'status_code',
                        access_token: accessToken
                    }
                });
                statusCode = statusResp.data.status_code;
                console.log(`[Instagram] Container status check ${pollCount}: ${statusCode}`);
            } catch (pollErr) {
                const errMsg = pollErr.response ? JSON.stringify(pollErr.response.data) : pollErr.message;
                console.error(`[Instagram Warning] Error checking status: ${errMsg}`);
            }
        }

        if (statusCode !== 'FINISHED') {
            throw new Error(`Media container ${creationId} failed to finish processing. Status is ${statusCode}`);
        }

        console.log(`[Instagram] Container ${creationId} is FINISHED. Publishing...`);

        // 2. Publish Media
        const publishUrl = `https://${baseDomain}/${apiVersion}/${igId}/media_publish`;
        await axiosInstance.post(publishUrl, {
            creation_id: creationId,
            access_token: accessToken
        });

        console.log(`[Instagram] Posted to Instagram: "${title}"`);
        return { success: true };
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error(`[Instagram Error] Failed to post: ${error.message}`, JSON.stringify(errorData, null, 2));
        return { success: false, error: errorData };
    }
};

const processPlatformQueue = async (platform) => {
    const isFb = platform === 'facebook';
    const postedField = isFb ? 'facebookPosted' : 'instagramPosted';
    const otherField = isFb ? 'instagramPosted' : 'facebookPosted';
    const postFn = isFb ? postToFacebook : postToInstagram;

    const maxAgeHours = parseInt(process.env.MAX_POST_ARTICLE_AGE_HOURS || '48', 10);
    const minDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    if (!isFb) {
        // --- INSTAGRAM SPECIFIC LOGIC ---
        
        // 1. Rate Limit Check: Last Instagram post must be at least 1 hour ago
        const lastPosted = await News.findOne({ instagramPosted: true }).sort({ updatedAt: -1 });
        if (lastPosted) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            if (lastPosted.updatedAt > oneHourAgo) {
                console.log(`[Social Media - instagram] Safety Skip: Last Instagram post was at ${lastPosted.updatedAt}. Limit is 1 post/hour.`);
                return { success: true, message: 'Skipped to respect 1-hour rate limit.' };
            }
        }

        // 2. Fetch the most recent published Politics news item created within MAX_POST_ARTICLE_AGE_HOURS that hasn't been posted to Instagram yet
        const query = {
            status: 'published',
            category: 'Politics',
            createdAt: { $gte: minDate }
        };
        query[postedField] = { $ne: true };

        const pendingNews = await News.findOne(query).sort({ publishedAt: -1, createdAt: -1 });

        if (pendingNews) {
            // Atomically acquire lock by setting postedField to true
            const lockedNews = await News.findOneAndUpdate(
                { _id: pendingNews._id, [postedField]: { $ne: true } },
                { $set: { [postedField]: true } },
                { new: true }
            );

            if (!lockedNews) {
                console.log(`[Social Media - instagram] Safety Skip: Item ${pendingNews._id} was already claimed by another process.`);
                return { success: true, message: 'Skipped: item already claimed.' };
            }

            console.log(`[Social Media - instagram] Found Politics item to post: "${lockedNews.title || lockedNews.topic}"`);
            
            const result = await postToInstagram(lockedNews);
            const success = result === true || (result && result.success === true);

            if (success) {
                const currentDoc = await News.findById(lockedNews._id).select(otherField);
                if (currentDoc && currentDoc[otherField] === true) {
                    await News.findByIdAndUpdate(lockedNews._id, { sociallyPosted: true });
                }
                console.log(`[Social Media - instagram] SUCCESS: Confirmed ID ${lockedNews._id} as instagramPosted=true.`);
                return { 
                    success: true, 
                    message: `Successfully posted to instagram`,
                    itemId: lockedNews._id
                };
            } else {
                // Revert lock on failure
                await News.findByIdAndUpdate(lockedNews._id, { [postedField]: false });
                console.error(`[Social Media - instagram] Failed to post: Reverted ${postedField} to false.`);
                return { 
                    success: false, 
                    message: `Failed to post to instagram.`,
                    error: result ? result.error : 'Unknown error'
                };
            }
        }

        return { 
            success: true, 
            message: `No unposted Politics items found for instagram.`
        };
    } else {
        // --- FACEBOOK SPECIFIC LOGIC ---
        // Dynamically fetch active categories from MongoDB
        let CATEGORY_ROTATION = [];
        try {
            const dbCategories = await News.distinct('category', { status: 'published' });
            CATEGORY_ROTATION = dbCategories.filter(Boolean).sort();
        } catch (err) {
            console.error('[Social Media Queue Warning] Failed to fetch categories from DB:', err.message);
        }

        if (!CATEGORY_ROTATION || CATEGORY_ROTATION.length === 0) {
            CATEGORY_ROTATION = [
                'Politics',
                'Business',
                'Technology',
                'Tech',
                'World',
                'Sports',
                'Celebrity',
                'Bolta Hai Bharat',
                'Editorial',
                'Entertainment',
                'Geopolitics'
            ];
        }

        // Find the last posted news item for Facebook to determine next index
        const queryLast = { facebookPosted: true };
        let lastPosted = await News.findOne(queryLast).sort({ updatedAt: -1 });

        if (!lastPosted) {
            lastPosted = await News.findOne({ sociallyPosted: true }).sort({ updatedAt: -1 });
        }

        let nextIndex = 0;
        if (lastPosted && lastPosted.category) {
            const lastIndex = CATEGORY_ROTATION.indexOf(lastPosted.category);
            if (lastIndex !== -1) {
                nextIndex = (lastIndex + 1) % CATEGORY_ROTATION.length;
            }
        }

        const queryCount = {
            status: 'published',
            facebookPosted: { $ne: true },
            createdAt: { $gte: minDate }
        };
        const unpostedCount = await News.countDocuments(queryCount);
        
        if (unpostedCount === 0) {
            console.log(`[Social Media - facebook] No recent unposted news items found within last ${maxAgeHours} hours.`);
            return { success: true, message: `No recent unposted news items found for facebook.` };
        }

        console.log(`[Social Media - facebook] Starting rotation from category: ${CATEGORY_ROTATION[nextIndex]}`);

        let lastError = null;
        for (let i = 0; i < CATEGORY_ROTATION.length; i++) {
            const currentIdx = (nextIndex + i) % CATEGORY_ROTATION.length;
            const currentCat = CATEGORY_ROTATION[currentIdx];

            const query = {
                status: 'published',
                category: currentCat,
                facebookPosted: { $ne: true },
                createdAt: { $gte: minDate }
            };

            const pendingNews = await News.findOne(query).sort({ publishedAt: -1, createdAt: -1 });

            if (pendingNews) {
                // Atomically acquire lock by setting facebookPosted to true
                const lockedNews = await News.findOneAndUpdate(
                    { _id: pendingNews._id, facebookPosted: { $ne: true } },
                    { $set: { facebookPosted: true } },
                    { new: true }
                );

                if (!lockedNews) {
                    console.log(`[Social Media - facebook] Item ${pendingNews._id} was already claimed by another process. Skipping...`);
                    continue;
                }

                console.log(`[Social Media - facebook] Found item to post: "${lockedNews.title || lockedNews.topic}" [${currentCat}]`);
                
                const result = await postToFacebook(lockedNews);
                const success = result === true || (result && result.success === true);

                if (success) {
                    const currentDoc = await News.findById(lockedNews._id).select(otherField);
                    if (currentDoc && currentDoc[otherField] === true) {
                        await News.findByIdAndUpdate(lockedNews._id, { sociallyPosted: true });
                    }
                    console.log(`[Social Media - facebook] SUCCESS: Confirmed ID ${lockedNews._id} as facebookPosted=true.`);
                    return { 
                        success: true, 
                        message: `Successfully posted to facebook`,
                        itemId: lockedNews._id
                    };
                } else {
                    // Revert lock on failure
                    await News.findByIdAndUpdate(lockedNews._id, { facebookPosted: false });
                    lastError = result ? result.error : 'Unknown error';
                    console.error(`[Social Media - facebook] Failed to post item ${lockedNews._id} to facebook. Reverted facebookPosted to false. Skipping to next category...`);
                }
            }
        }

        return { 
            success: false, 
            message: lastError ? `Failed to post to facebook.` : `No items found in any category for facebook after rotation.`,
            error: lastError
        };
    }
};

const processPendingSocialPosts = async () => {
    try {
        const fbResult = await processPlatformQueue('facebook');
        const igResult = await processPlatformQueue('instagram');

        const success = fbResult.success || igResult.success;
        const message = `Facebook: ${fbResult.message} | Instagram: ${igResult.message}`;
        const itemId = fbResult.itemId || igResult.itemId;

        return {
            success,
            message,
            itemId,
            fbError: fbResult.error,
            igError: igResult.error
        };
    } catch (error) {
        console.error(`[Social Media Error] Error in processPendingSocialPosts:`, error);
        return { success: false, message: 'Internal error in social media service', error: error.message };
    }
};

module.exports = {
    postToFacebook,
    postToInstagram,
    processPendingSocialPosts,
    detectSocialTags,
    generateBetterHashtags
};
