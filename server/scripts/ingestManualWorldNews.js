const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const News = require('../src/models/News');
const { resolveBestImage } = require('../src/services/trending/imageResolver');

const manualArticles = [
    {
        title: "Bangladesh Swears in Tarique Rahman as Prime Minister After Landslide Victory",
        summary: "Tarique Rahman was formally sworn in as Prime Minister of Bangladesh following a decisive election win for the Bangladesh Nationalist Party, marking a historic return to power after years in exile. His oath-taking in Dhaka underscores a major shift in the country’s political landscape and will shape Bangladesh’s regional engagement in South Asia.",
        content: "Tarique Rahman was formally sworn in as Prime Minister of Bangladesh following a decisive election win for the Bangladesh Nationalist Party, marking a historic return to power after years in exile. His oath-taking in Dhaka underscores a major shift in the country’s political landscape and will shape Bangladesh’s regional engagement in South Asia.",
        query: "Bangladesh election Tarique Rahman",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Tarique Rahman'
    },
    {
        title: "US and Iran Begin Second Round of Nuclear Talks Amid Strait of Hormuz Tensions",
        summary: "The United States and Iran have started a second round of nuclear negotiations in Geneva while Iran simultaneously conducted large missile drills near the Strait of Hormuz. The contrasting moves highlight the delicate balance between diplomacy and deterrence as both sides seek to manage heightened Middle East tensions.",
        content: "The United States and Iran have started a second round of nuclear negotiations in Geneva while Iran simultaneously conducted large missile drills near the Strait of Hormuz. The contrasting moves highlight the delicate balance between diplomacy and deterrence as both sides seek to manage heightened Middle East tensions.",
        query: "US Iran nuclear talks Geneva missile drills",
        imageSubjectType: 'specific_place',
        imageSubjectName: 'Geneva'
    },
    {
        title: "Australia Refuses to Repatriate IS-Linked Families Held in Syrian Camp",
        summary: "The Australian government announced it will not repatriate 34 women and children linked to Islamic State from detention camps in Syria, sparking criticism from human rights groups. Officials say security concerns and legal complexities are behind the decision, which has drawn international scrutiny.",
        content: "The Australian government announced it will not repatriate 34 women and children linked to Islamic State from detention camps in Syria, sparking criticism from human rights groups. Officials say security concerns and legal complexities are behind the decision, which has drawn international scrutiny.",
        query: "Australia repatriate Syria camp",
        imageSubjectType: 'generic_society',
        imageSubjectName: ''
    },
    {
        title: "Brazil Carnival Opens with Political Backdrop Ahead of Election Year",
        summary: "The annual Rio Carnival kicked off with vibrant parades and huge crowds, but political undertones are strong this year as President Luiz Inácio Lula da Silva faces both popular celebrations and legal scrutiny amid an election cycle. The event reflects Brazil’s cultural pride and the broader political climate in Latin America.",
        content: "The annual Rio Carnival kicked off with vibrant parades and huge crowds, but political undertones are strong this year as President Luiz Inácio Lula da Silva faces both popular celebrations and legal scrutiny amid an election cycle. The event reflects Brazil’s cultural pride and the broader political climate in Latin America.",
        query: "Rio Carnival Brazil politics",
        imageSubjectType: 'specific_place',
        imageSubjectName: 'Rio Carnival'
    },
    {
        title: "Israel Approves West Bank Land Registration, Drawing Regional Condemnation",
        summary: "The Israeli cabinet has approved a controversial land registration plan in the West Bank, which critics say amounts to a “de facto annexation” of Palestinian territories. Leaders from neighbouring countries and Palestinian officials have condemned the move as escalating tensions and undermining peace efforts in the region.",
        content: "The Israeli cabinet has approved a controversial land registration plan in the West Bank, which critics say amounts to a “de facto annexation” of Palestinian territories. Leaders from neighbouring countries and Palestinian officials have condemned the move as escalating tensions and undermining peace efforts in the region.",
        query: "West Bank land registration Israel Palestine",
        imageSubjectType: 'specific_place',
        imageSubjectName: 'West Bank'
    }
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
                category: 'World',
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
                    category: 'World',
                    tags: ['world', 'manual-ingest'],
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
