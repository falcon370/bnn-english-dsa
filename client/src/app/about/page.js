export const metadata = {
  title: 'About Us | Bharat News Narratives',
  description: 'Learn about Bharat News Narratives — an AI-assisted Indian newsroom committed to independent, evidence-driven journalism.',
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1
        className="text-3xl font-black mb-2 text-[#0e3a8a]"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        About Bharat News Narratives
      </h1>
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-semibold">
        Independent · Insightful · Indian
      </p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

        <div className="border-l-4 border-[#1A56C4] pl-4">
          <p className="text-base font-semibold text-gray-900 mb-2">Our Mission</p>
          <p>
            Bharat News Narratives (BNN) was established in 2026 with a single purpose: to deliver
            independent, evidence-driven news that serves the Indian public interest — with no
            corporate or political patron. We cover politics, business, technology, sports, world
            affairs, and the stories that matter most to people across India.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            Where We Are
          </p>
          <p>
            BNN is based in Warangal, Telangana, India. Our editorial and technology team operates
            from there, with a focus on covering stories relevant to India and the wider South Asian
            region.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            Our Newsroom Model
          </p>
          <p className="mb-3">
            BNN is an AI-assisted newsroom. We use Google&apos;s Gemini AI to help draft articles
            from trending and newsworthy topics. Every draft runs through an automated quality
            gate before publication — checking depth, source attribution, and duplicate topics —
            and is credited to the relevant category desk. Our editorial team spot-checks
            published articles and reviews every reader-flagged correction.
          </p>
          <p>
            We believe AI can help surface stories faster and at greater scale — but human editorial
            judgment is what gives those stories meaning and accountability. Our editorial process
            is documented in our{' '}
            <a href="/ethics-policy" className="text-[#1A56C4] hover:underline font-semibold">
              Editorial Standards &amp; Ethics Policy
            </a>.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            Independence
          </p>
          <p>
            BNN does not accept funding from political parties, government bodies, or corporate
            sponsors that could compromise our editorial independence. We are supported entirely
            through advertising revenue and reader support.
          </p>
        </div>

        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-3">
            Get in Touch
          </p>
          <p>
            We welcome feedback, corrections, and news tips. Visit our{' '}
            <a href="/contact" className="text-[#1A56C4] hover:underline font-semibold">
              Contact page
            </a>{' '}
            to reach our editorial team.
          </p>
        </div>

      </div>
    </div>
  );
}
