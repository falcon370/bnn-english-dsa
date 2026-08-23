const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const News = require('../src/models/News');
const { resolveBestImage } = require('../src/services/trending/imageResolver');

const manualArticles = [
    {
        title: "Nitish Kumar Resignation",
        summary: "Nitish Kumar's resignation as Bihar Chief Minister felt like a sudden turning point. Social media exploded with questions not just about the next CM, but about Bihar's future — legacy debates, alliance fears, governance worries, and a wave of memes all at once.",
        content: `Nitish Kumar's resignation as Bihar Chief Minister did not feel like a normal political update. It felt like a sudden turning point. One headline came, and Bihar's public discussion (social media) went in many directions at once. People were not only asking, "Who will be the next CM?" They were also asking, "What will happen to Bihar now?"

Even many critics accept that under him Bihar saw more focus on roads and basic services, better administrative functioning in many areas, and sustained attention to women's education and empowerment. That long, familiar "Nitish era" is exactly why his exit feels so big. But social media rarely begins with balance. The moment the news broke, the discussion quickly shifted from legacy to loud reaction—memes, sarcasm, and sharp political accusations—reflecting not just opinions on Nitish, but also public anxiety about what comes next.

The first reactions to Nitish Kumar's resignation on social media were mostly jokes and sarcasm, and the most repeated line was about ₹10,000. Here's why: in recent months, the Bihar government rolled out a scheme where ₹10,000 was given as an initial payment (mainly to women) to support small work or self-employment. Because the payment came close to election season, many users connected it with "vote politics." So when the resignation news broke, commenters pulled that same number back into the discussion and mocked voters by saying people "sold" their future for quick money—almost as if the resignation proved they were "tricked." Around the same time, Prashant Kishor—often called "PK," a well-known political strategist in Bihar who now runs the Jan Suraaj campaign—had said that people won't sell their future for ₹10,000, and his line also returned in the comments as people argued about whether voters can really be "bought." Behind the jokes is a serious worry: when politics starts feeling like a cash deal, people stop trusting each other, and poor voters get blamed even though many families accept benefits because they are genuinely under financial pressure.

Then the discussion moves to another strong theme: Prashant Kishor (PK). Many people wrote, "PK was right." They feel his prediction came true—that Nitish would not remain CM and a new face would come. In today's politics, when people feel decisions are already made behind closed doors, the person who "predicts" correctly starts looking powerful. For some, PK is not just a commentator now. They see him as a possible future option.

The third theme is the most political and emotional: BJP vs JDU. Many comments say BJP "used" Nitish to win and then pushed him aside. They also say BJP will slowly finish JDU. Whether this is correct or not, it shows a deep fear: will Bihar be run from Patna or controlled from Delhi? Bihar has always been sensitive about respect and autonomy. So alliance politics quickly becomes a matter of pride and insecurity, not just party strategy.

After that comes the fourth theme, which is about Nitish Kumar himself. People are divided into two clear groups. One side calls him a "flip-flopper" who keeps changing sides for power. The other side calls him the best CM Bihar has had in a long time. This shows how one leader can have two images at the same time. Some people judge him by political moves. Others judge him by what changed in daily life. Bihar's politics is complicated, and leaders often survive by adjusting. But the cost of constant adjustment is loss of public trust.

The fifth theme is the most important because it is about governance. Many comments—especially the serious ones—talk about what Bihar gained in Nitish's long period: better law-and-order compared to earlier times, less fear in villages, more focus on women and education, and benefits from government schemes. Some people even mention specific schemes they liked. This is the part of the debate that should matter most, because it is about everyday life. For these commenters, Nitish is not just a politician; he represents stability and functioning administration.

But praise comes with worry, and that is the sixth theme: fear about the future. Many people worry about unemployment, delayed government recruitment, crime, and policy changes (some mention liquor/prohibition). Under the jokes and anger is a basic fear: will Bihar become unstable again? Most citizens don't demand miracles. They want predictable governance—so they can plan their lives, careers, and families without constant political shocks.

The seventh theme explains the style of the whole discussion: memes and entertainment. People say things like "Netflix series," "movie ban jaye," "khela hobe," and make jokes about who will become CM next. Bihar politics is often unpredictable, so many citizens cope by laughing. But there is a danger here. When politics becomes only entertainment, accountability becomes weak. Leaders start thinking that social media noise is enough, and real governance becomes secondary.

So Nitish Kumar's resignation is not just about one person stepping down. It has opened seven big public feelings: anger about money politics, interest in predictions, fear of alliances, mixed judgment about Nitish, debate on governance work, worry about jobs and safety.

The real question Bihar must ask now is simple: Are we choosing our future, or are we just watching power games while we become spectators? If this is truly the end of one long era, then the next phase should not be decided only by "who defeated whom." It should be judged by what matters most: safety, jobs, education, dignity, and a government that treats citizens seriously—not like an audience. Because when politics becomes a joke, it is not only leaders who lose respect. Slowly, democracy also loses respect.`,
        query: "Nitish Kumar Bihar Chief Minister resignation politics",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Nitish Kumar'
    },
];

const ingest = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is missing from environment variables');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        for (const article of manualArticles) {
            console.log(`Processing: ${article.title}`);

            const imageResult = await resolveBestImage({
                topic: article.query,
                category: 'Bolta Hai Bharat',
                imageDescription: article.query,
                imageSubjectType: article.imageSubjectType,
                imageSubjectName: article.imageSubjectName
            });
            console.log(`- Image: ${imageResult.imageUrl ? 'Found' : 'Not Found'}`);

            const record = await News.findOneAndUpdate(
                { title: article.title },
                {
                    title: article.title,
                    summary: article.summary,
                    content: article.content,
                    topic: article.title,
                    category: 'Bolta Hai Bharat',
                    tags: ['bolta-hai-bharat', 'bihar', 'nitish-kumar', 'manual-ingest'],
                    imageUrl: imageResult.imageUrl || null,
                    imageSource: imageResult.imageSource || null,
                    sourceOptions: [],
                    availableSources: [],
                    selectedSource: 'Manual Entry',
                    primarySource: 'Manual Entry',
                    generatedAt: new Date(),
                    publishedAt: new Date(),
                    isTrending: false,
                    autoGenerated: false,
                    fromNewsApi: false,
                    status: 'published'
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`✅ Saved: ${record._id}`);
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

ingest();
