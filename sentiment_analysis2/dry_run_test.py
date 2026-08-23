import os, sys
sys.path.insert(0, ".")

import combined_sentiment_analysis as csa
csa.TOTAL_COMMENT_LIMIT = 30
csa.PER_QUERY_SAFETY_CEILING = 15
csa.DEFAULT_SIMULATED_SIZE = 30

from dotenv import load_dotenv
load_dotenv()

SAMPLE_ARTICLE = (
    "PM Modi Begins Australia Visit, Focus on Trade, Defence and Clean Energy. "
    "Prime Minister Narendra Modi has arrived in Australia for a three-day official "
    "visit aimed at strengthening the India-Australia Comprehensive Strategic Partnership. "
    "Discussions focus on trade, defence, critical minerals, clean energy, and Indo-Pacific."
)

print("=" * 60)
print(" DRY RUN: Reduced Comment Sentiment Analysis Test")
print("=" * 60)
print(f"  TOTAL_COMMENT_LIMIT      : {csa.TOTAL_COMMENT_LIMIT}")
print(f"  PER_QUERY_SAFETY_CEILING : {csa.PER_QUERY_SAFETY_CEILING}")
print(f"  DEFAULT_SIMULATED_SIZE   : {csa.DEFAULT_SIMULATED_SIZE}")
print("-" * 60)

yt = os.getenv("YOUTUBE_API_KEY")
mb = os.getenv("MASTODON_API_BASE_URL")
mt = os.getenv("MASTODON_ACCESS_TOKEN")
gk = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

print(f"  YouTube API Key   : {'OK' if yt else 'MISSING'}")
print(f"  Mastodon URL      : {'OK' if mb else 'MISSING'}")
print(f"  Mastodon Token    : {'OK' if mt else 'MISSING'}")
print(f"  Gemini API Key    : {'OK' if gk else 'MISSING'}")
print("-" * 60)

# Step 1
print("\n[Step 1] Extracting queries (max 2)...")
q = csa.extract_search_queries(SAMPLE_ARTICLE, max_queries=2)
print(f"  Queries: {q}")
assert len(q) > 0, "No queries extracted"
print("  PASS")

# Step 2
print("\n[Step 2] Fetching data (30 comment cap, 3 days back)...")
df = csa.fetch_combined_pulse(SAMPLE_ARTICLE, yt, mb, mt, days_back=3, max_queries=2)
print(f"  Rows returned : {len(df)}")
print(f"  Sources       : {df['source'].value_counts().to_dict()}")
assert len(df) > 0, "DataFrame is empty"
assert "sentiment" in df.columns, "sentiment column missing"
assert "sentiment_label" in df.columns, "sentiment_label column missing"
print("  PASS")

# Step 3
print("\n[Step 3] Sentiment distribution...")
print(f"  {df['sentiment_label'].value_counts().to_dict()}")
print("  PASS")

# Step 4
print("\n[Step 4] Gemini AI insights...")
topic = q[0] if q else "topic"
ins = csa.generate_gemini_insights(df, topic, gk)
print(f"  Summary  : {ins['summary'][:120]}...")
print(f"  Takeaway : {ins['key_takeaway'][:120]}...")
assert "summary" in ins and "key_takeaway" in ins, "Insights keys missing"
print("  PASS")

# Step 5
print("\n[Step 5] Dashboard generation -> ./output/dry_run/ ...")
out = "./output/dry_run/"
csa.generate_dashboard(df, topic, SAMPLE_ARTICLE, out, gk)
img = os.path.join(out, "0_public_reaction_summary.png")
assert os.path.exists(img), f"Image not found: {img}"
print("  PASS")

print()
print("=" * 60)
print(" ALL CHECKS PASSED")
print(f"  Rows    : {len(df)}")
print(f"  Sources : {df['source'].value_counts().to_dict()}")
print(f"  Image   : {os.path.abspath(img)}")
print("=" * 60)
