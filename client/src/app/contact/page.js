export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Bharat News Narratives.',
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1
        className="text-3xl font-black mb-2 text-[#0e3a8a]"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        Contact Us
      </h1>
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-semibold">
        Bharat News Narratives
      </p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <p>
          We welcome your feedback, corrections, and inquiries. Reach us using any of the methods below.
        </p>

        <div className="border-l-4 border-[#1A56C4] pl-4 space-y-3">
          <div>
            <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-1">Email</p>
            <a
              href="mailto:bharatnewsnarratives@gmail.com"
              className="text-[#1A56C4] hover:underline"
            >
              bharatnewsnarratives@gmail.com
            </a>
          </div>

          <div>
            <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-1">Phone</p>
            <a
              href="tel:+917569944196"
              className="text-[#1A56C4] hover:underline"
            >
              +91 75699 44196
            </a>
          </div>

          <div>
            <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-1">Editorial</p>
            <p>For news tips, corrections, or editorial queries, email us with the subject line <span className="font-semibold">Editorial</span>.</p>
          </div>

          <div>
            <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-1">Advertising</p>
            <p>For advertising inquiries, email us with the subject line <span className="font-semibold">Advertising</span>.</p>
          </div>

          <div>
            <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-1">Copyright / DMCA</p>
            <p>If you believe any content or image on this site infringes your copyright, contact us with the subject line <span className="font-semibold">Copyright Notice</span> for prompt review.</p>
          </div>

          <div>
            <p className="font-bold text-gray-900 uppercase tracking-wider text-xs mb-1">Jurisdiction</p>
            <p>Warangal, Telangana, India</p>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          We aim to respond to all queries within 2–3 business days.
        </p>
      </div>
    </div>
  );
}
