import sys
import os
import json
import argparse
import math
import re
from datetime import datetime, timedelta
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

try:
    import requests
    import rake_nltk
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.decomposition import LatentDirichletAllocation
    import nltk

    try:
        nltk.data.find('corpora/stopwords')
    except LookupError:
        try:
            nltk.download('stopwords', quiet=True)
        except Exception: pass
        
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        try:
            nltk.download('punkt', quiet=True)
            nltk.download('punkt_tab', quiet=True)
        except Exception: pass
    
except ImportError as e:
    print(f"ImportError: {e}", file=sys.stderr)
    sys.exit(1)

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    print("Warning: spacy en_core_web_sm not available, falling back to regex NER", file=sys.stderr)

def regex_ner(text):
    # Simple capitalization-based fallback for NER
    entities = []
    # matches sequences of capitalized words like "Narendra Modi", "New Delhi"
    matches = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    for m in matches:
        if m.lower() not in ["the", "a", "an", "and", "in", "on", "at", "to", "for", "with", "by", "of"]:
            entities.append(m)
    return list(set(entities))

def extract_entities(text):
    if SPACY_AVAILABLE:
        doc = nlp(text)
        entities = [ent.text for ent in doc.ents if ent.label_ in ['PERSON', 'ORG', 'GPE', 'LOC']]
        return list(set(entities))
    else:
        return regex_ner(text)

def extract_keywords(text):
    r = rake_nltk.Rake()
    r.extract_keywords_from_text(text)
    return r.get_ranked_phrases()[:5]

def fetch_articles(topic, days):
    try:
        from pymongo import MongoClient
        
        # Determine the MongoDB URI
        mongo_uri = "mongodb+srv://bharatnewsnarratives_db_user:admin%401234@bnn.zzixrad.mongodb.net/?appName=BNN"
        
        client = MongoClient(mongo_uri)
        db = client['test']
        collection = db['news']
        
        # Build query
        query = {}
        
        # Filter by topic (case-insensitive regex on title or content)
        if topic:
            words = topic.split()
            word_conditions = []
            for w in words:
                word_conditions.append({
                    '$or': [
                        {'title': {'$regex': w, '$options': 'i'}},
                        {'content': {'$regex': w, '$options': 'i'}},
                        {'topic': {'$regex': w, '$options': 'i'}}
                    ]
                })
            query['$and'] = word_conditions
            
        # Filter by days
        if days:
            date_threshold = datetime.now() - timedelta(days=days)
            query['createdAt'] = {'$gte': date_threshold}
            
        # Fetch articles
        cursor = collection.find(query).sort('createdAt', -1).limit(50)
        
        parsed_articles = []
        for doc in cursor:
            title = doc.get('title') or doc.get('topic') or 'Unknown Title'
            snippet = doc.get('summary', '')
            source = doc.get('primarySource', 'BNN Database')
            url = doc.get('primaryLink') or ''
            
            created_at = doc.get('createdAt')
            if created_at:
                ts = created_at.timestamp()
                pubDate = created_at.strftime('%Y-%m-%d %H:%M:%S')
            else:
                ts = datetime.now().timestamp()
                pubDate = "Unknown Date"
                
            parsed_articles.append({
                "headline": title,
                "source": source,
                "date": pubDate,
                "url": url,
                "snippet": snippet,
                "_ts": ts
            })
            
        client.close()
        return parsed_articles
        
    except Exception as e:
        print(f"DEBUG: MongoDB fetch error: {e}", file=sys.stderr)
        return []

def compute_similarity(articles):
    if not articles:
        return []
    
    n = len(articles)
    
    # Extract entities and keywords
    for a in articles:
        text = a['headline'] + ". " + a.get('snippet', '')
        a['entities'] = extract_entities(text)
        a['keywords'] = extract_keywords(text)
        a['full_text'] = text
        
    # TF-IDF
    texts = [a['full_text'] for a in articles]
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
        cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
    except:
        cosine_sim = [[0]*n for _ in range(n)]
        
    # LDA Topic Match
    try:
        lda = LatentDirichletAllocation(n_components=min(5, n), random_state=42)
        lda_matrix = lda.fit_transform(tfidf_matrix)
        lda_sim = cosine_similarity(lda_matrix, lda_matrix)
    except:
        lda_sim = [[0]*n for _ in range(n)]
        
    # Build clusters
    clusters = []
    used = set()
    
    for i in range(n):
        if i in used:
            continue
        current_cluster = [articles[i]]
        used.add(i)
        
        for j in range(i+1, n):
            if j in used:
                continue
                
            # Entity overlap (Jaccard)
            ents1 = set(articles[i]['entities'])
            ents2 = set(articles[j]['entities'])
            if len(ents1.union(ents2)) > 0:
                entity_overlap = len(ents1.intersection(ents2)) / len(ents1.union(ents2))
            else:
                entity_overlap = 0.0
                
            # Keyword overlap
            kw1 = set(articles[i]['keywords'])
            kw2 = set(articles[j]['keywords'])
            if len(kw1.union(kw2)) > 0:
                kw_overlap = len(kw1.intersection(kw2)) / len(kw1.union(kw2))
            else:
                kw_overlap = 0.0
                
            # Similarities
            tfidf_score = cosine_sim[i][j]
            lda_score = lda_sim[i][j]
            
            # Clustering formula with stricter emphasis on exact matches
            score = (0.4 * entity_overlap) + (0.3 * kw_overlap) + (0.2 * tfidf_score) + (0.1 * lda_score)
            
            # Strict condition: must share at least one entity or keyword, and have a good score
            if score > 0.25 and (len(ents1.intersection(ents2)) > 0 or len(kw1.intersection(kw2)) > 0):
                current_cluster.append(articles[j])
                used.add(j)
                
        clusters.append(current_cluster)
        
    return clusters

def generate_causal_connector(prev_article, next_article):
    # Infer causal connector based on keywords in next_article
    text = (next_article['headline'] + " " + next_article.get('snippet', '')).lower()
    
    escalation_words = ['escalate', 'worsen', 'intensify', 'surge', 'rise', 'heighten']
    trigger_words = ['trigger', 'spark', 'cause', 'prompt', 'lead to', 'ignite', 'result in', 'force']
    response_words = ['respond', 'react', 'retaliate', 'reply', 'address', 'tackle', 'slam']
    
    if any(w in text for w in escalation_words):
        return "escalated into"
    elif any(w in text for w in trigger_words):
        return "triggered"
    elif any(w in text for w in response_words):
        return "led to a response"
    else:
        return "followed by"

def process_timelines(topic, days):
    articles = fetch_articles(topic, days)
    print(f"DEBUG: Fetched {len(articles)} articles", file=sys.stderr)
    if not articles:
        return {"timelines": []}
        
    clusters = compute_similarity(articles)
    print(f"DEBUG: Computed {len(clusters)} clusters", file=sys.stderr)
    
    timelines = []
    
    for c in clusters:
        if len(c) < 2:
            continue # A timeline needs at least 2 events
            
        # Sort chronologically (oldest first)
        c.sort(key=lambda x: x['_ts'])
        
        # Determine shared entities for topic label
        all_ents = []
        for a in c:
            all_ents.extend(a['entities'])
            
        ent_counts = {}
        for e in all_ents:
            ent_counts[e] = ent_counts.get(e, 0) + 1
            
        shared_entities = sorted([e for e, count in ent_counts.items() if count > 1])
        if not shared_entities and all_ents:
            shared_entities = [all_ents[0]]
            
        cluster_topic = " - ".join(shared_entities[:2]) if shared_entities else "Developing Story"
        
        events = []
        for i, a in enumerate(c):
            connector = None
            if i < len(c) - 1:
                connector = generate_causal_connector(a, c[i+1])
                
            events.append({
                "date": a['date'],
                "headline": a['headline'],
                "source": a['source'],
                "url": a['url'],
                "entities": a['entities'],
                "keywords": a['keywords'],
                "connection": connector
            })
            
        timelines.append({
            "topic": cluster_topic,
            "shared_entities": shared_entities,
            "events": events
        })
        
    # Sort timelines by most recent event
    timelines.sort(key=lambda t: t['events'][-1]['date'] if t['events'] else "", reverse=True)
    
    return {"timelines": timelines}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate news timelines.")
    parser.add_argument("--topic", type=str, default="", help="Topic to search for")
    parser.add_argument("--days", type=int, default=5, help="Number of days to look back")
    
    args = parser.parse_args()
    
    result = process_timelines(args.topic, args.days)
    print(json.dumps(result))
