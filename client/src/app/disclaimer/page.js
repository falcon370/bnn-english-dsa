import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Disclaimer | Bharat News Narratives',
  description: 'Disclaimer for Bharat News Narratives — AI-generated content, image usage, and liability.',
  robots: { index: true, follow: true },
};

export default function DisclaimerPage() {
  const { title, body } = LEGAL.disclaimer;
  const sections = body.split('\n\n');

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1
        className="text-3xl font-black mb-2 text-[#0e3a8a]"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {title}
      </h1>
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-semibold">
        Bharat News Narratives
      </p>
      <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-4">
        {sections.map((para, i) => (
          <p key={i} className="text-gray-700">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}
