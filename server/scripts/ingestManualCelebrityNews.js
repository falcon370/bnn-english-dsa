const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const News = require('../src/models/News');
const { resolveBestImage } = require('../src/services/trending/imageResolver');

const manualArticles = [
    // --- Narendra Modi ---
    {
        title: "Narendra Modi Leads India AI Impact Summit 2026",
        summary: "Prime Minister Narendra Modi inaugurated the India AI Impact Summit 2026 in New Delhi, launching a five-day showcase of AI innovation featuring around 600 startups and 13 country pavilions. The summit aims to position India as a global leader in artificial intelligence and foster collaborations across technology, industry, and policy sectors.",
        content: "Prime Minister Narendra Modi inaugurated the India AI Impact Summit 2026 in New Delhi, launching a five-day showcase of AI innovation featuring around 600 startups and 13 country pavilions. The summit aims to position India as a global leader in artificial intelligence and foster collaborations across technology, industry, and policy sectors.",
        query: "Narendra Modi AI Summit India",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Narendra Modi'
    },
    {
        title: "Narendra Modi Announces India-France Helicopter Project",
        summary: "Prime Minister Narendra Modi announced a strategic collaboration with France to jointly build the world’s first helicopter capable of flying to the height of Mount Everest. The initiative, revealed on Tuesday, aims to boost India’s aerospace capabilities and deepen defence and technology ties between the two nations.",
        content: "Prime Minister Narendra Modi announced a strategic collaboration with France to jointly build the world’s first helicopter capable of flying to the height of Mount Everest. The initiative, revealed on Tuesday, aims to boost India’s aerospace capabilities and deepen defence and technology ties between the two nations.",
        query: "Narendra Modi India-France Helicopter",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Narendra Modi'
    },

    // --- Amit Shah ---
    {
        title: "Congress Accepts Amit Shah's Challenge on India-US Trade Debate",
        summary: "The Congress party has accepted Home Minister Amit Shah’s public challenge to debate the India-US trade agreement, while warning that duty-free imports of American crops like maize and cotton could harm Indian farmers — highlighting rising political tensions over trade policy.",
        content: "The Congress party has accepted Home Minister Amit Shah’s public challenge to debate the India-US trade agreement, while warning that duty-free imports of American crops like maize and cotton could harm Indian farmers — highlighting rising political tensions over trade policy.",
        query: "Amit Shah India-US trade debate",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Amit Shah'
    },
    {
        title: "Amit Shah to Chair National Cooperative Summit in Gandhinagar",
        summary: "Union Cooperation Minister Amit Shah will chair a National Cooperative Summit in Gandhinagar on February 17, where projects worth over ₹250 crore will be inaugurated. The summit will focus on expanding cooperative credit societies, modern warehouses, and improving cooperative banks and dairy and fisheries institutions across India.",
        content: "Union Cooperation Minister Amit Shah will chair a National Cooperative Summit in Gandhinagar on February 17, where projects worth over ₹250 crore will be inaugurated. The summit will focus on expanding cooperative credit societies, modern warehouses, and improving cooperative banks and dairy and fisheries institutions across India.",
        query: "Amit Shah Cooperative Summit Gandhinagar",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Amit Shah'
    },

    // --- Rahul Gandhi ---
    {
        title: "Rahul Gandhi Wins Legal Victory in Karnataka High Court",
        summary: "Rahul Gandhi, Leader of Opposition in the Lok Sabha, won a major legal victory today as the Karnataka High Court quashed defamation proceedings against him linked to a controversial “corruption rate card” ad, reducing legal pressure on the Congress figure ahead of ongoing parliamentary battles over trade policy.",
        content: "Rahul Gandhi, Leader of Opposition in the Lok Sabha, won a major legal victory today as the Karnataka High Court quashed defamation proceedings against him linked to a controversial “corruption rate card” ad, reducing legal pressure on the Congress figure ahead of ongoing parliamentary battles over trade policy.",
        query: "Rahul Gandhi Karnataka High Court",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Rahul Gandhi'
    },
    {
        title: "Rahul Gandhi Demands Answers on India-US Trade Deal",
        summary: "In a political move, Rahul Gandhi demanded Prime Minister Narendra Modi publicly answer five “simple questions” about the implications of the India-US trade deal on India’s agricultural sector, keeping pressure on the government to clarify details for farmers.",
        content: "In a political move, Rahul Gandhi demanded Prime Minister Narendra Modi publicly answer five “simple questions” about the implications of the India-US trade deal on India’s agricultural sector, keeping pressure on the government to clarify details for farmers.",
        query: "Rahul Gandhi India-US trade deal questions",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Rahul Gandhi'
    },

    // --- Mamata Banerjee ---
    {
        title: "Mamata Banerjee Hits Back at Yogi Adityanath Over Unrest",
        summary: "Mamata Banerjee has recently hit back at Yogi Adityanath’s criticism over the Murshidabad unrest, calling him the “biggest Bhogi” and questioning his governance record — a point widely covered in national media discussions of BJP–TMC rivalry.",
        content: "Mamata Banerjee has recently hit back at Yogi Adityanath’s criticism over the Murshidabad unrest, calling him the “biggest Bhogi” and questioning his governance record — a point widely covered in national media discussions of BJP–TMC rivalry.",
        query: "Mamata Banerjee Yogi Adityanath criticism",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Mamata Banerjee'
    },
    {
        title: "Security Lapses Alleged at Mamata Banerjee’s Residence",
        summary: "In an interview ahead of the Assembly elections, Mamata Banerjee claimed there have been multiple intrusion attempts at her Kalighat Road residence, including armed individuals entering the premises, raising concerns about her personal security as political tensions rise in West Bengal.",
        content: "In an interview ahead of the Assembly elections, Mamata Banerjee claimed there have been multiple intrusion attempts at her Kalighat Road residence, including armed individuals entering the premises, raising concerns about her personal security as political tensions rise in West Bengal.",
        query: "Mamata Banerjee security residence",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Mamata Banerjee'
    },

    // --- Trump ---
    {
        title: "Trump Takes Aim at Former Ally Marjorie Taylor Greene",
        summary: "In a rare public rebuke, President Trump has taken a swipe at former Congresswoman Marjorie Taylor Greene, calling her a “traitor” as she reports facing hundreds of death threats, highlighting growing tensions within Republican ranks and Trump’s continued influence over the party’s internal dynamics.",
        content: "In a rare public rebuke, President Trump has taken a swipe at former Congresswoman Marjorie Taylor Greene, calling her a “traitor” as she reports facing hundreds of death threats, highlighting growing tensions within Republican ranks and Trump’s continued influence over the party’s internal dynamics.",
        query: "Donald Trump Marjorie Taylor Greene",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Donald Trump'
    },
    {
        title: "Trump Threatens Death Penalty in High-Profile Kidnapping Case",
        summary: "U.S. President Donald Trump has vowed that federal authorities will seek the death penalty for anyone responsible if Nancy Guthrie, the 84-year-old mother of TV journalist Savannah Guthrie — who has been missing for weeks — is found dead, signaling the administration’s commitment to an aggressive federal investigation.",
        content: "U.S. President Donald Trump has vowed that federal authorities will seek the death penalty for anyone responsible if Nancy Guthrie, the 84-year-old mother of TV journalist Savannah Guthrie — who has been missing for weeks — is found dead, signaling the administration’s commitment to an aggressive federal investigation.",
        query: "Trump Nancy Guthrie death penalty",
        imageSubjectType: 'specific_person',
        imageSubjectName: 'Donald Trump'
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
                category: 'Celebrity',
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
                    category: 'Celebrity',
                    tags: ['celebrity', 'manual-ingest'],
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
