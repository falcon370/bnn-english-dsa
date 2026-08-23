"""
Combined YouTube + Mastodon Sentiment Analysis Pipeline
Bharat News Narratives (BNN) — Public Pulse Analyzer

Dashboard Edition:
  - Generates a styled BNN-themed UI card layout via Matplotlib.
  - Uses Google Gemini AI to generate the Summary and Key Takeaways.
  - Maps specific hex colors to specific emotions.
  - Can be invoked from the BNN server via BNN_ARTICLE_FILE env var.
"""

import os
import re
import html
import json
import textwrap
import collections
from datetime import datetime

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import seaborn as sns
import requests
from dotenv import load_dotenv

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

try:
    import spacy
    _NLP = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    _NLP = None
    SPACY_AVAILABLE = False

try:
    import yake
    YAKE_AVAILABLE = True
except Exception:
    YAKE_AVAILABLE = False

load_dotenv()

VADER = SentimentIntensityAnalyzer()
TOTAL_COMMENT_LIMIT = 5000
PER_QUERY_SAFETY_CEILING = 1000
DEFAULT_SIMULATED_SIZE = 5000

_ENTITY_PRIORITY = {"ORG": 0, "PERSON": 1, "PRODUCT": 2, "EVENT": 3, "GPE": 4, "LOC": 4, "NORP": 5}

# ── BNN Brand Emotion Color Palette ─────────────────────────────────────────
EMOTION_COLORS = {
    "joy":      "#1A56C4",   # BNN Brand Blue
    "trust":    "#22c55e",   # Emerald Green
    "surprise": "#f59e0b",   # Amber
    "fear":     "#60a5fa",   # Light Blue
    "anger":    "#d32f2f",   # BNN Accent Red
    "sadness":  "#94a3b8"    # Slate/Grey
}

# ── BNN Dashboard Theme ──────────────────────────────────────────────────────
BNN_BG       = "#0b0f19"   # dark ink background
BNN_CARD     = "#0e3a8a"   # navy card / header band
BNN_BLUE     = "#1A56C4"   # brand blue
BNN_RED      = "#d32f2f"   # accent red
BNN_WHITE    = "#ffffff"
BNN_MUTED    = "#60a5fa"   # blue-200
BNN_BODY     = "#cbd5e1"   # slate-300 body text
BNN_SUBTEXT  = "#94a3b8"   # slate-400 muted text

# ==========================================
# 1. QUERY EXTRACTION
# ==========================================
def extract_search_queries(article_text, max_queries=6):
    entity_queries = []
    seen = set()

    if SPACY_AVAILABLE:
        doc = _NLP(article_text)
        scored = []
        for ent in doc.ents:
            if ent.label_ in _ENTITY_PRIORITY:
                text = ent.text.strip()
                key = text.lower()
                if key not in seen and len(text) > 2:
                    seen.add(key)
                    scored.append((_ENTITY_PRIORITY[ent.label_], text))
        scored.sort(key=lambda x: x[0])
        entity_queries = [t for _, t in scored]

    yake_phrases = []
    if YAKE_AVAILABLE:
        try:
            kw_extractor = yake.KeywordExtractor(lan="en", n=3, top=15, dedupLim=0.7)
            yake_phrases = [p for p, _score in kw_extractor.extract_keywords(article_text)]
        except Exception:
            yake_phrases = []

    queries = []
    for q in entity_queries + yake_phrases:
        qkey = q.lower()
        if any(qkey in existing.lower() or existing.lower() in qkey for existing in queries):
            continue
        queries.append(q)
        if len(queries) >= max_queries:
            break

    if queries:
        return queries

    stopwords = set(["the", "and", "a", "of", "to", "in", "is", "that", "it", "on", "for", "as", "with", "was", "by", "an", "be", "this", "are", "from", "at", "about"])
    words = re.findall(r'\b[a-zA-Z]{4,}\b', article_text)
    filtered = [w.lower() for w in words if w.lower() not in stopwords]
    counter = collections.Counter(filtered)
    top = [w for w, _ in counter.most_common(max_queries * 2)]
    queries = [" ".join(top[i:i + 2]) for i in range(0, min(len(top), max_queries * 2), 2)][:max_queries]
    return queries

# ==========================================
# 2. YOUTUBE FETCH
# ==========================================
def _clean_youtube_html(text):
    text = html.unescape(text)
    return re.sub('<[^<]+?>', '', text).strip()

def fetch_youtube_for_query(query, api_key, days_back=14, safety_ceiling=PER_QUERY_SAFETY_CEILING, max_videos=15):
    if not api_key: return []
    cutoff = pd.Timestamp.now('UTC') - pd.Timedelta(days=days_back) if days_back else None
    base_url = "https://www.googleapis.com/youtube/v3"
    search_params = {'part': 'id', 'q': query, 'type': 'video', 'order': 'date', 'maxResults': max_videos, 'key': api_key}
    if cutoff is not None: search_params['publishedAfter'] = cutoff.strftime('%Y-%m-%dT%H:%M:%SZ')

    rows = []
    try:
        resp = requests.get(f"{base_url}/search", params=search_params, timeout=15)
        resp.raise_for_status()
        video_ids = [item['id']['videoId'] for item in resp.json().get('items', [])]
        if not video_ids: return []

        for vid in video_ids:
            if len(rows) >= safety_ceiling: break
            page_token = None
            while len(rows) < safety_ceiling:
                page_budget = min(100, safety_ceiling - len(rows))
                params = {'part': 'snippet', 'videoId': vid, 'order': 'relevance', 'maxResults': page_budget, 'key': api_key}
                if page_token: params['pageToken'] = page_token
                res = requests.get(f"{base_url}/commentThreads", params=params, timeout=15).json()
                items = res.get('items', [])
                if not items: break
                for item in items:
                    snippet = item['snippet']['topLevelComment']['snippet']
                    created = pd.to_datetime(snippet['publishedAt'])
                    if cutoff is not None and created < cutoff: continue
                    text_clean = _clean_youtube_html(snippet['textDisplay'])
                    if not text_clean: continue
                    rows.append({
                        'source': 'YouTube', 'search_query': query,
                        'author': snippet['authorDisplayName'], 'comment': text_clean,
                        'published_at': created, 'like_count': snippet.get('likeCount', 0),
                        'item_id': item['id'],
                    })
                    if len(rows) >= safety_ceiling: break
                page_token = res.get('nextPageToken')
                if not page_token: break
        return rows
    except requests.exceptions.RequestException as e:
        print(f"[ERR] YouTube request failed for query '{query}': {e}")
        return rows

# ==========================================
# 3. MASTODON FETCH
# ==========================================
def _strip_mastodon_html(raw_html):
    text = html.unescape(raw_html)
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = re.sub(r'<[^<]+?>', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def fetch_mastodon_for_query(query, api_base_url, access_token, days_back=14, safety_ceiling=PER_QUERY_SAFETY_CEILING, include_boosts=False):
    if not api_base_url or not access_token: return []
    base_url = api_base_url.rstrip('/')
    headers = {"Authorization": f"Bearer {access_token}"}
    cutoff = pd.Timestamp.now('UTC') - pd.Timedelta(days=days_back) if days_back else None
    rows, offset, page_size = [], 0, 40

    try:
        while len(rows) < safety_ceiling and offset < 200:
            page_budget = min(page_size, safety_ceiling - len(rows))
            params = {'q': query, 'type': 'statuses', 'limit': page_budget, 'offset': offset, 'resolve': 'false'}
            resp = requests.get(f"{base_url}/api/v2/search", headers=headers, params=params, timeout=15)
            resp.raise_for_status()
            statuses = resp.json().get('statuses', [])
            if not statuses: break
            for status in statuses:
                if not include_boosts and status.get('reblog'): continue
                created = pd.to_datetime(status['created_at'])
                if cutoff is not None and created < cutoff: continue
                text_clean = _strip_mastodon_html(status.get('content', ''))
                if not text_clean: continue
                account = status.get('account', {})
                rows.append({
                    'source': 'Mastodon', 'search_query': query,
                    'author': account.get('display_name') or account.get('username', 'unknown'),
                    'comment': text_clean, 'published_at': created,
                    'like_count': status.get('favourites_count', 0),
                    'item_id': status.get('id'),
                })
                if len(rows) >= safety_ceiling: break
            offset += page_size
        return rows
    except requests.exceptions.RequestException as e:
        print(f"[ERR] Mastodon request failed for query '{query}': {e}")
        return rows

# ==========================================
# 4. COMBINED FETCH ORCHESTRATOR
# ==========================================
def fetch_combined_pulse(article_text, youtube_api_key, mastodon_base_url, mastodon_token, days_back=14, max_queries=6):
    queries = extract_search_queries(article_text, max_queries=max_queries)
    have_youtube = bool(youtube_api_key)
    have_mastodon = bool(mastodon_base_url and mastodon_token)
    
    if not have_youtube and not have_mastodon:
        print("[WARN] No API credentials. Generating simulated data.")
        topic = queries[0] if queries else "topic"
        return generate_simulated_combined_data(topic, DEFAULT_SIMULATED_SIZE)

    all_rows = []
    for query in queries:
        if len(all_rows) >= TOTAL_COMMENT_LIMIT: break
        if have_youtube:
            remaining = TOTAL_COMMENT_LIMIT - len(all_rows)
            yt_rows = fetch_youtube_for_query(query, youtube_api_key, days_back, min(PER_QUERY_SAFETY_CEILING, remaining))
            print(f"  --> YouTube  | '{query}': {len(yt_rows)} comments")
            all_rows.extend(yt_rows)

        if len(all_rows) >= TOTAL_COMMENT_LIMIT: break
        if have_mastodon:
            remaining = TOTAL_COMMENT_LIMIT - len(all_rows)
            md_rows = fetch_mastodon_for_query(query, mastodon_base_url, mastodon_token, days_back, min(PER_QUERY_SAFETY_CEILING, remaining))
            print(f"  --> Mastodon | '{query}': {len(md_rows)} posts")
            all_rows.extend(md_rows)

    if not all_rows:
        return generate_simulated_combined_data(queries[0] if queries else "topic", DEFAULT_SIMULATED_SIZE)

    df = pd.DataFrame(all_rows)
    df = df.drop_duplicates(subset=['source', 'item_id'])
    return apply_full_nlp(df)

def generate_simulated_combined_data(topic, size=DEFAULT_SIMULATED_SIZE):
    np.random.seed(hash(topic) % (2**32) if topic else 42)
    dates = pd.date_range(end=pd.Timestamp.now(tz="UTC"), periods=300, freq="h")
    mock_texts = [
        f"This completely shifts the balance of power regarding {topic}. Great move!",
        f"I really disagree with this angle, feels dishonest and one-sided.",
        f"A fantastic step forward, smart and well-reasoned analysis here.",
        f"I'm honestly furious about how this was handled, it's unacceptable.",
        f"Brilliant perspective on the timeline of events, very insightful.",
        f"This is terrifying, I'm worried about what happens next.",
        f"Wow, I didn't see that coming at all! Huge news.",
    ]
    rows = []
    for i in range(size):
        source = "YouTube" if i % 2 == 0 else "Mastodon"
        text = np.random.choice(mock_texts) + f" (Re: {topic})"
        rows.append({
            'source': source, 'search_query': topic, 'author': f"user_{i:05d}",
            'comment': text, 'published_at': np.random.choice(dates),
            'like_count': int(np.random.exponential(15)), 'item_id': f"sim_{i}",
        })
    return apply_full_nlp(pd.DataFrame(rows))

# ==========================================
# 5. SENTIMENT + EMOTION SCORING
# ==========================================
EMOTION_LEXICON = {
    "joy": {"happy", "great", "love", "excellent", "amazing", "wonderful", "glad", "delighted", "brilliant", "awesome", "good"},
    "anger": {"furious", "angry", "hate", "outrageous", "unacceptable", "disgusting", "annoyed", "rage", "corrupt"},
    "sadness": {"sad", "unfortunate", "disappointed", "regret", "sorrow", "depressing", "tragic", "heartbroken"},
    "fear": {"afraid", "scared", "worried", "terrifying", "anxious", "threat", "danger", "panic"},
    "surprise": {"shocked", "surprised", "unexpected", "unbelievable", "astonishing", "wow"},
    "trust": {"reliable", "honest", "credible", "trust", "confident", "assured", "genuine", "agree"},
}

def score_emotions(text):
    tokens = set(re.findall(r"[a-zA-Z']+", text.lower()))
    scores = {emo: len(tokens & words) for emo, words in EMOTION_LEXICON.items()}
    total = sum(scores.values())
    if total == 0: return {emo: 0.0 for emo in EMOTION_LEXICON}
    return {emo: round(v / total, 3) for emo, v in scores.items()}

def apply_full_nlp(df):
    df = df.copy()
    vader_scores = df['comment'].apply(lambda t: VADER.polarity_scores(t))
    df['sentiment'] = vader_scores.apply(lambda s: s['compound'])
    df['sentiment_label'] = pd.cut(df['sentiment'], bins=[-1.01, -0.05, 0.05, 1.01], labels=['Negative', 'Neutral', 'Positive'])
    emotion_df = df['comment'].apply(score_emotions).apply(pd.Series)
    df = pd.concat([df, emotion_df.add_prefix('emotion_')], axis=1)
    return df

# ==========================================
# 6. GEMINI AI INSIGHTS
# ==========================================
def _sample_comments_for_ai(df, per_label=15, max_chars=180):
    parts = []
    for label in ["Positive", "Negative", "Neutral"]:
        subset = df[df["sentiment_label"] == label].sort_values("like_count", ascending=False).head(per_label)
        for c in subset["comment"]:
            clean_c = c.strip().replace("\n", " ")
            if len(clean_c) > max_chars: clean_c = clean_c[:max_chars] + "..."
            parts.append(f"[{label}] {clean_c}")
    return parts

def generate_gemini_insights(df, topic, api_key):
    """
    Calls Google Gemini REST API to produce a summary and key takeaway.
    Uses GEMINI_API_KEY (falls back to GOOGLE_API_KEY).
    Model: gemini-2.0-flash
    """
    fallback = {
        "summary": (
            "The public reaction is largely divided. While many express optimism and appreciate "
            "the developments, a portion of the audience remains skeptical and expresses concerns "
            "regarding the long-term implementations."
        ),
        "key_takeaway": (
            "Engagement is high, driven by strong underlying sentiments. "
            "Transparent communication will be necessary moving forward."
        )
    }

    if not api_key:
        print("[INFO] No GEMINI_API_KEY set -- using fallback text.")
        return fallback

    sample = _sample_comments_for_ai(df)
    if not sample:
        return fallback

    prompt = (
        f"You are a public relations analyst for Bharat News Narratives (BNN), an independent Indian news outlet. "
        f"Analyze these social media comments regarding the news topic: \"{topic}\".\n\n"
        + "\n".join(sample)
        + "\n\nReturn your answer strictly as a JSON object with exactly two keys:\n"
        "1. \"summary\": A 3-4 sentence cohesive paragraph summarizing the main themes, what people appreciate, and what concerns them.\n"
        "2. \"key_takeaway\": A 1-2 sentence punchy takeaway highlighting the core driving emotion and advice for BNN editors moving forward."
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json"
        }
    }

    try:
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(raw_text)
        return {
            "summary": result.get("summary", fallback["summary"]),
            "key_takeaway": result.get("key_takeaway", fallback["key_takeaway"])
        }
    except Exception as e:
        print(f"[ERR] Gemini AI request failed: {e} -- using fallback text.")
        return fallback

# ==========================================
# 7. BNN-THEMED DASHBOARD (Matplotlib)
# ==========================================
def draw_bnn_card(fig, bounds, facecolor=None, edgecolor=None, alpha=1.0, radius=0.02):
    """Draws a rounded card panel on the figure."""
    fc = facecolor or BNN_CARD
    ec = edgecolor or BNN_BLUE
    rect = patches.FancyBboxPatch(
        (bounds[0], bounds[1]), bounds[2], bounds[3],
        boxstyle=f"round,pad=0.015,rounding_size={radius}",
        linewidth=1.2, edgecolor=ec, facecolor=fc, alpha=alpha,
        transform=fig.transFigure, zorder=0
    )
    fig.patches.append(rect)


def generate_dashboard(df, topic, original_article_text, output_dir="./output/", gemini_api_key=None):
    os.makedirs(output_dir, exist_ok=True)
    total_comments = f"{len(df):,}"

    # ── Emotion calculations ─────────────────────────────────────────────────
    emotion_cols = [c for c in df.columns if c.startswith('emotion_')]
    emo_sums = df[emotion_cols].sum()
    total_emo = emo_sums.sum()
    if total_emo > 0:
        emo_percents = (emo_sums / total_emo * 100).sort_values(ascending=False)
    else:
        emo_percents = pd.Series({"emotion_joy": 100})

    emo_percents = emo_percents.head(5)
    top_emotion_raw = emo_percents.idxmax().replace("emotion_", "")
    top_emotion_name = top_emotion_raw.title()
    top_emotion_color = EMOTION_COLORS.get(top_emotion_raw, BNN_BLUE)

    # ── Sentiment breakdown ──────────────────────────────────────────────────
    sentiment_counts = df['sentiment_label'].value_counts()
    pos_pct = int(sentiment_counts.get('Positive', 0) / len(df) * 100)
    neg_pct = int(sentiment_counts.get('Negative', 0) / len(df) * 100)
    neu_pct = 100 - pos_pct - neg_pct

    # ── AI Insights via Gemini ───────────────────────────────────────────────
    insights = generate_gemini_insights(df, topic, gemini_api_key)

    # ── Figure canvas ────────────────────────────────────────────────────────
    fig = plt.figure(figsize=(16, 10), facecolor=BNN_BG)

    # ── BNN masthead band (top strip) ────────────────────────────────────────
    masthead = patches.FancyBboxPatch(
        (0, 0.91), 1.0, 0.09,
        boxstyle="square,pad=0",
        linewidth=0, edgecolor='none', facecolor=BNN_CARD,
        transform=fig.transFigure, zorder=1
    )
    fig.patches.append(masthead)

    # Red accent line under masthead
    fig.add_artist(plt.Line2D(
        (0, 1), (0.91, 0.91),
        color=BNN_RED, linewidth=2.5, transform=fig.transFigure, zorder=2
    ))

    # BNN brand name (top-left of masthead)
    fig.text(0.025, 0.955, "BNN", fontsize=22, fontweight="bold",
             color=BNN_WHITE, fontfamily='serif', va='center', zorder=3)
    fig.text(0.078, 0.958, "BHARAT NEWS NARRATIVES", fontsize=8,
             color=BNN_MUTED, fontfamily='sans-serif', va='center',
             fontweight='bold', zorder=3, alpha=0.9)

    # Vertical pipe separator
    fig.add_artist(plt.Line2D(
        (0.072, 0.072), (0.915, 0.995),
        color=BNN_MUTED, linewidth=0.8, transform=fig.transFigure, zorder=3, alpha=0.5
    ))

    fig.text(0.5, 0.955, "PUBLIC PULSE", fontsize=18, fontweight="bold",
             color=BNN_WHITE, fontfamily='serif', va='center', ha='center',
             zorder=3)

    # Timestamp (top-right of masthead)
    ts = datetime.now().strftime("%d %b %Y, %I:%M %p")
    fig.text(0.975, 0.958, f"Generated: {ts}", fontsize=8,
             color=BNN_SUBTEXT, fontfamily='sans-serif', va='center', ha='right', zorder=3)

    # ── Main title & subtitle ────────────────────────────────────────────────
    fig.text(0.025, 0.875, "Public Reaction Summary",
             fontsize=22, fontweight="bold", color=BNN_WHITE, fontfamily='serif')

    subtitle = topic
    if len(original_article_text) > 20:
        first_line = original_article_text.strip().split('\n')[0][:75]
        subtitle = f'"{first_line}..."'
    fig.text(0.025, 0.840, subtitle,
             fontsize=13, color=BNN_BODY, fontfamily='sans-serif', style='italic')

    # Comments analyzed pill
    fig.text(0.025, 0.800,
             f"  Analysis based on {total_comments} comments  ",
             fontsize=10, color=BNN_MUTED,
             bbox=dict(boxstyle="round,pad=0.4", facecolor=BNN_CARD, edgecolor=BNN_BLUE, linewidth=0.8))

    # ── LEFT CARD: Top Emotion + Summary ────────────────────────────────────
    draw_bnn_card(fig, [0.025, 0.10, 0.44, 0.67])

    # "TOP EMOTION" label
    fig.text(0.042, 0.745, "TOP EMOTION", fontsize=8.5, fontweight="bold",
             color=BNN_MUTED, fontfamily='sans-serif',
             bbox=dict(boxstyle="square,pad=0.3", facecolor=BNN_BG, edgecolor='none'))

    # Large emotion name
    fig.text(0.042, 0.640, top_emotion_name,
             fontsize=62, fontweight="bold", color=top_emotion_color,
             fontfamily='serif', va='top')

    # Sentiment bar below emotion name
    bar_y = 0.575
    bar_x_start = 0.042
    bar_width = 0.40
    for pct, color, label in [
        (pos_pct, "#22c55e", f"Pos {pos_pct}%"),
        (neu_pct, BNN_MUTED, f"Neu {neu_pct}%"),
        (neg_pct, BNN_RED, f"Neg {neg_pct}%"),
    ]:
        seg_w = pct / 100 * bar_width
        if seg_w > 0:
            seg = patches.FancyBboxPatch(
                (bar_x_start, bar_y - 0.012), seg_w, 0.022,
                boxstyle="square,pad=0",
                linewidth=0, edgecolor='none', facecolor=color, alpha=0.85,
                transform=fig.transFigure, zorder=2
            )
            fig.patches.append(seg)
            if pct >= 8:
                fig.text(bar_x_start + seg_w / 2, bar_y - 0.001, label,
                         fontsize=7.5, color=BNN_WHITE, ha='center', va='center',
                         fontweight='bold', zorder=3)
            bar_x_start += seg_w

    # Divider
    fig.add_artist(plt.Line2D(
        (0.042, 0.455), (0.555, 0.555),
        color=BNN_MUTED, linewidth=0.5, alpha=0.4, transform=fig.transFigure
    ))

    # Summary label
    fig.text(0.042, 0.535, "SUMMARY", fontsize=8.5, fontweight="bold",
             color=BNN_MUTED, fontfamily='sans-serif')

    wrapped_summary = textwrap.fill(insights['summary'], width=62)
    fig.text(0.042, 0.510, wrapped_summary,
             fontsize=11, color=BNN_BODY, va='top', linespacing=1.65,
             fontfamily='sans-serif')

    # Total comments bottom pill
    fig.text(0.042, 0.130,
             f"   Total Comments Analyzed: {total_comments}   ",
             fontsize=12, fontweight="bold", color=BNN_WHITE,
             bbox=dict(boxstyle="round,pad=0.7", facecolor=BNN_BLUE, edgecolor='none'))

    # ── RIGHT TOP CARD: Emotion Breakdown Donut ──────────────────────────────
    draw_bnn_card(fig, [0.490, 0.38, 0.485, 0.39])

    fig.text(0.508, 0.745, "EMOTION BREAKDOWN", fontsize=8.5, fontweight="bold",
             color=BNN_MUTED, fontfamily='sans-serif',
             bbox=dict(boxstyle="square,pad=0.3", facecolor=BNN_BG, edgecolor='none'))
    fig.text(0.508, 0.720, "Breakdown of emotional tone across all comments",
             fontsize=9.5, color=BNN_BODY, fontfamily='sans-serif')

    ax_donut = fig.add_axes([0.490, 0.385, 0.285, 0.295])
    labels = [k.replace("emotion_", "").title() for k in emo_percents.index]
    sizes = emo_percents.values
    colors = [EMOTION_COLORS.get(l.lower(), BNN_SUBTEXT) for l in labels]

    wedges, _, autotexts = ax_donut.pie(
        sizes, colors=colors, autopct='%1.0f%%', pctdistance=0.72,
        startangle=90, counterclock=False,
        textprops={'color': BNN_WHITE, 'fontsize': 10, 'fontweight': 'bold'}
    )
    centre_circle = plt.Circle((0, 0), 0.52, fc=BNN_CARD)
    ax_donut.add_artist(centre_circle)
    ax_donut.set_facecolor(BNN_CARD)

    # Legend
    leg_y = 0.720
    for label, size, color in zip(labels, sizes, colors):
        fig.text(0.790, leg_y, "●", color=color, fontsize=13, zorder=3)
        fig.text(0.808, leg_y, label, color=BNN_WHITE, fontsize=12)
        fig.text(0.910, leg_y, f"{size:.0f}%", color=BNN_WHITE, fontsize=12, fontweight="bold", ha='right')
        leg_y -= 0.052

    fig.text(0.790, leg_y - 0.015,
             "Percentages may not add to 100%\ndue to rounding.",
             fontsize=8, color=BNN_SUBTEXT, style="italic")

    # ── RIGHT BOTTOM CARD: Key Takeaway ─────────────────────────────────────
    draw_bnn_card(fig, [0.490, 0.10, 0.485, 0.24])

    # Red accent left bar inside card
    key_bar = patches.FancyBboxPatch(
        (0.492, 0.115), 0.004, 0.205,
        boxstyle="square,pad=0",
        linewidth=0, edgecolor='none', facecolor=BNN_RED, alpha=0.9,
        transform=fig.transFigure, zorder=2
    )
    fig.patches.append(key_bar)

    fig.text(0.508, 0.290, "KEY TAKEAWAY", fontsize=8.5, fontweight="bold",
             color=BNN_RED, fontfamily='sans-serif')

    wrapped_takeaway = textwrap.fill(insights['key_takeaway'], width=68)
    fig.text(0.508, 0.263, wrapped_takeaway,
             fontsize=11.5, color=BNN_BODY, va='top', linespacing=1.65,
             fontfamily='sans-serif')

    # ── Footer ───────────────────────────────────────────────────────────────
    fig.add_artist(plt.Line2D(
        (0, 1), (0.07, 0.07),
        color=BNN_CARD, linewidth=1, transform=fig.transFigure, alpha=0.6
    ))
    fig.text(0.025, 0.042,
             "BNN Public Pulse  |  Powered by Google Gemini AI  |  Data: YouTube + Mastodon",
             fontsize=8, color=BNN_SUBTEXT, fontfamily='sans-serif')
    fig.text(0.975, 0.042,
             "bharatnewsnarratives.com",
             fontsize=8, color=BNN_MUTED, fontfamily='sans-serif', ha='right', style='italic')

    # ── Save ─────────────────────────────────────────────────────────────────
    # Determine output PNG filename — use slug if provided so each article gets
    # its own file instead of overwriting the shared dashboard image.
    output_slug = os.getenv("BNN_OUTPUT_SLUG", "").strip()
    png_filename = f"{output_slug}_dashboard.png" if output_slug else "0_public_reaction_summary.png"
    output_path = os.path.join(output_dir, png_filename)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close()

    # ── Build the extended machine-readable summary JSON ──────────────────────
    # Top positive/negative comments (up to 3 each) by like_count
    sorted_pos = (
        df[df['sentiment_label'] == 'Positive']
        .sort_values('like_count', ascending=False)
        .head(3)['comment']
        .tolist()
    )
    sorted_neg = (
        df[df['sentiment_label'] == 'Negative']
        .sort_values('like_count', ascending=False)
        .head(3)['comment']
        .tolist()
    )

    # Keyword extraction (top 8 meaningful tokens)
    import collections as _collections, re as _re
    _stopwords = set([
        "the","and","a","of","to","in","is","that","it","on","for","as","with",
        "was","by","an","be","this","are","from","at","about","not","but","have",
        "they","will","what","just","like","more","some","been","also","india",
        "news","very","video","channel","great","nice","good","bad","said","says"
    ])
    all_text = " ".join(df['comment'].dropna().tolist())
    raw_words = _re.findall(r'\b[a-zA-Z]{4,}\b', all_text.lower())
    filtered_words = [w for w in raw_words if w not in _stopwords]
    top_keywords = [w for w, _ in _collections.Counter(filtered_words).most_common(8)]

    # Emotion breakdown as percentages (rounded)
    emotion_breakdown = {}
    for col in emotion_cols:
        emo_name = col.replace("emotion_", "")
        pct = float(emo_percents.get(col, 0))
        emotion_breakdown[emo_name] = round(pct, 1)

    summary_path = os.path.join(output_dir, "summary.json")
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump({
            "summary":          insights['summary'],
            "key_takeaway":     insights['key_takeaway'],
            "positive_pct":     pos_pct,
            "negative_pct":     neg_pct,
            "neutral_pct":      neu_pct,
            "total_comments":   len(df),
            "top_emotion":      top_emotion_name,
            "emotion_breakdown": emotion_breakdown,
            "top_positive":     [c[:300] for c in sorted_pos],
            "top_negative":     [c[:300] for c in sorted_neg],
            "keywords":         top_keywords,
            "dashboard_png":    png_filename,
        }, f, ensure_ascii=False, indent=2)

    # Legacy flat summary.txt kept for backward-compat with old code paths
    legacy_path = os.path.join(output_dir, "summary.txt")
    with open(legacy_path, 'w', encoding='utf-8') as f:
        json.dump({
            "summary": insights['summary'],
            "key_takeaway": insights['key_takeaway']
        }, f, ensure_ascii=False)

    print(f"[DONE] Dashboard saved to: {output_path}")
    return df

# ==========================================
# 8. EXECUTION PIPELINE
# ==========================================
if __name__ == "__main__":
    # When invoked from the BNN server, the article text is passed via a temp file.
    article_file = os.getenv("BNN_ARTICLE_FILE", "")
    topic_override = os.getenv("BNN_TOPIC_OVERRIDE", "")

    if article_file and os.path.exists(article_file):
        with open(article_file, 'r', encoding='utf-8') as f:
            sample_article_input = f.read()
        print(f"[BNN] Loaded article from: {article_file}")
    else:
        # Standalone fallback article for manual testing
        sample_article_input = """
        PM Modi Begins Australia Visit, Focus on Trade, Defence and Clean Energy
        Prime Minister Narendra Modi has arrived in Australia for a three-day official
        visit aimed at strengthening the India-Australia Comprehensive Strategic
        Partnership. During the visit, PM Modi is scheduled to hold bilateral talks
        with Australian Prime Minister Anthony Albanese, with discussions focusing on
        trade, defence cooperation, critical minerals, clean energy, technology, and
        the Indo-Pacific region.
        """

    youtube_api_key   = os.getenv("YOUTUBE_API_KEY")
    mastodon_base_url = os.getenv("MASTODON_API_BASE_URL")
    mastodon_token    = os.getenv("MASTODON_ACCESS_TOKEN")

    # Gemini API key — falls back to GOOGLE_API_KEY used by the BNN server
    gemini_api_key = (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    )

    combined_df = fetch_combined_pulse(
        article_text=sample_article_input,
        youtube_api_key=youtube_api_key,
        mastodon_base_url=mastodon_base_url,
        mastodon_token=mastodon_token,
        days_back=14,
        max_queries=6,
    )

    if topic_override:
        topic_label = topic_override
    else:
        queries = extract_search_queries(sample_article_input, max_queries=1)
        topic_label = queries[0] if queries else "topic"

    if not combined_df.empty:
        generate_dashboard(
            combined_df,
            topic=topic_label,
            original_article_text=sample_article_input,
            output_dir="./output/",
            gemini_api_key=gemini_api_key
        )