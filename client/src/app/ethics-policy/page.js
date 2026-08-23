export const metadata = {
  title: 'Editorial Standards & Ethics | Bharat News Narratives',
  description: 'How BNN sources, drafts, reviews, and corrects news — our editorial process and ethics policy.',
  robots: { index: true, follow: true },
};

export default function EthicsPolicyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1
        className="text-3xl font-black mb-2 text-[#0e3a8a]"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        Editorial Standards &amp; Ethics
      </h1>
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-semibold">
        Bharat News Narratives
      </p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

        <div className="border-l-4 border-[#1A56C4] pl-4">
          <p>
            BNN is committed to transparent, responsible journalism. This page explains how our
            content is sourced, produced, reviewed, and corrected.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            1. How We Source Stories
          </p>
          <p>
            BNN identifies newsworthy topics using public search trend data via SerpApi, which
            aggregates what people across India and the world are actively searching for. Topics are
            filtered and selected based on newsworthiness, relevance to our readership, and editorial
            judgment. We do not republish press releases, syndicate wire copy, or copy content from
            other news outlets.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            2. AI-Assisted Drafting
          </p>
          <p className="mb-3">
            Once a topic is selected, BNN uses Google Gemini — a large language model — to produce
            an initial article draft. The AI synthesizes publicly available information about the
            topic into a structured news article format, including a summary, analysis, and
            relevant context.
          </p>
          <p>
            AI-drafted content is clearly labelled on every article page. We believe in being
            transparent about how our content is produced.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            3. Editorial Review
          </p>
          <p className="mb-3">
            Every AI draft is run through an automated quality gate before publication. This
            gate:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Rejects drafts that fall short of our minimum depth and substantiveness bar, sending them back for regeneration rather than publishing thin content</li>
            <li>Checks source attribution so every article links back to the public reporting it draws on</li>
            <li>Filters duplicate topics so the same story isn&apos;t published twice</li>
            <li>Routes image selections through category-appropriate sourcing rules</li>
          </ul>
          <p className="mt-3">
            Our editorial team spot-checks published articles and reviews every reader-flagged
            correction (see Section 4). We are working to expand human review coverage over
            time; until then, the automated gate above is what runs on every draft.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            4. Accuracy &amp; Corrections
          </p>
          <p className="mb-3">
            BNN is committed to accuracy. When we get something wrong, we correct it promptly and
            transparently.
          </p>
          <p className="mb-3">
            If you believe an article contains a factual error, please contact us at{' '}
            <a
              href="mailto:bharatnewsnarratives@gmail.com"
              className="text-[#1A56C4] hover:underline"
            >
              bharatnewsnarratives@gmail.com
            </a>{' '}
            with the subject line <span className="font-semibold">Correction</span>. Include the
            article URL and details of the error.
          </p>
          <p>
            Corrections are reviewed within 2–3 business days. Significant corrections are noted
            within the article.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            5. Editorial Independence
          </p>
          <p>
            BNN&apos;s editorial decisions are made independently of advertisers, sponsors, and
            political interests. Advertising relationships do not influence our coverage. No
            individual or organisation pays for editorial placement on BNN.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            6. Images &amp; Copyright
          </p>
          <p>
            Images used on BNN are sourced from Unsplash (free to use), Wikimedia Commons (public
            domain or Creative Commons licensed), and our own curated image repository. We do not
            knowingly use copyrighted images without permission. If you believe an image infringes
            your copyright, contact us at{' '}
            <a
              href="mailto:bharatnewsnarratives@gmail.com"
              className="text-[#1A56C4] hover:underline"
            >
              bharatnewsnarratives@gmail.com
            </a>{' '}
            with the subject line <span className="font-semibold">Copyright Notice</span>.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            7. Contact Our Editorial Team
          </p>
          <p>
            For news tips, editorial queries, or feedback, visit our{' '}
            <a href="/contact" className="text-[#1A56C4] hover:underline font-semibold">
              Contact page
            </a>
            .
          </p>
        </div>

      </div>
    </div>
  );
}
