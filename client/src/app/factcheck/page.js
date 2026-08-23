'use client';

import { useState, useRef } from 'react';
import { checkHeadline } from '@/lib/api';
import VerdictBadge, { getVerdictRingColor } from '@/components/VerdictBadge';
import CredibilityMeter from '@/components/CredibilityMeter';

export default function FactCheckDashboard() {
  const [headline, setHeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0: idle, 1: API, 2: AI, 3: aggregation, 4: done
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [animationText, setAnimationText] = useState('');

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!headline.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setStep(1);
    setAnimationText('Querying Google Fact Check Tools database...');

    try {
      // Simulate pipeline progression steps for smooth visuals
      await sleep(1500);
      setStep(2);
      setAnimationText('Synthesizing credibility indicators with Gemini AI...');

      await sleep(1800);
      setStep(3);
      setAnimationText('Aggregating final score and registering with cache...');

      // Make the actual backend call
      const res = await checkHeadline(headline);
      const data = res.data;

      await sleep(800);
      setStep(4);
      setResult(data);
    } catch (err) {
      console.error('Fact check request failed:', err);
      setError(err.response?.data?.message || 'Failed to complete fact check. Please try again.');
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  const setSample = (text) => {
    setHeadline(text);
  };


  const resetAll = () => {
    setHeadline('');
    setStep(0);
    setResult(null);
    setError('');
  };

  return (
    <div className="bg-[#f8faff] min-h-screen text-[#121212] py-10 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-blue-50 text-[#1A56C4] mb-3">
            BNN Editorial Tools
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3" style={{ fontFamily: 'Georgia, serif' }}>
            Headline Credibility Index
          </h1>
          <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
            Verify claims instantly. Our system checks national databases (Google Fact Check, PIB, AltNews) and leverages Gemini AI language diagnostics to score authenticity.
          </p>
        </div>

        {/* Input Card */}
        {step === 0 && (
          <div className="bg-white border border-blue-100 p-6 md:p-8 shadow-sm rounded-sm mb-6">
            <form onSubmit={handleCheck} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Enter News Headline to Fact-Check
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Government introduces new scheme to offer 50% discount on electricity..."
                  required
                  className="w-full border border-blue-100 focus:border-[#1A56C4] focus:outline-none focus:ring-1 focus:ring-[#1A56C4] text-sm text-gray-700 p-4 resize-none transition-colors"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-400 font-medium">Try samples:</span>
                  <button
                    type="button"
                    onClick={() => setSample('ISRO confirms NASA-ISRO joint satellite NISAR launch slated for early next year')}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 transition-colors"
                  >
                    🟢 Credible
                  </button>
                  <button
                    type="button"
                    onClick={() => setSample('Cabinet approves free smartphone distribution to all graduates in India')}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 transition-colors"
                  >
                    🔴 Sensational
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!headline.trim()}
                  className="w-full sm:w-auto px-8 py-3 bg-[#1A56C4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Verify Headline
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading / Pipeline State */}
        {step > 0 && step < 4 && (
          <div className="bg-white border border-blue-100 p-8 shadow-sm text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-[#1A56C4] border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest font-black text-[#1A56C4]">
                Pipeline Step {step} / 3
              </p>
              <p className="text-sm font-bold text-gray-700">{animationText}</p>
            </div>

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-4 max-w-xs mx-auto pt-4">
              <div className={`h-2 w-full rounded-full transition-all duration-300 ${step >= 1 ? 'bg-[#1A56C4]' : 'bg-gray-100'}`} />
              <div className={`h-2 w-full rounded-full transition-all duration-300 ${step >= 2 ? 'bg-[#1A56C4]' : 'bg-gray-100'}`} />
              <div className={`h-2 w-full rounded-full transition-all duration-300 ${step >= 3 ? 'bg-[#1A56C4]' : 'bg-gray-100'}`} />
            </div>
          </div>
        )}

        {/* Results display */}
        {step === 4 && result && (
          <div className="space-y-6">
            
            {/* Top Score Ring Card */}
            <div className="bg-white border border-blue-100 p-8 shadow-sm flex flex-col md:flex-row items-center gap-8">
              
              <CredibilityMeter score={result.finalScore} verdict={result.verdict} size="lg" />

              {/* Verdict Text */}
              <div className="flex-1 text-center md:text-left space-y-3">
                <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center">
                  <VerdictBadge verdict={result.verdict} size="md" />
                </div>
                <h2 className="text-xl md:text-2xl font-black leading-snug">
                  &quot;{result.headline}&quot;
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {result.aiVerdict || 'Linguistic evaluation complete. Credibility score aggregated successfully.'}
                </p>
              </div>
            </div>

            {/* Details Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* AI Diagnostic signals */}
              <div className="bg-white border border-blue-100 p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                  <div className="w-1 h-4 bg-[#1A56C4]" />
                  <h3 className="text-xs font-black uppercase tracking-widest">
                    AI Linguistic Breakdown
                  </h3>
                </div>

                <div className="space-y-4 flex-1">
                  {result.aiSignals ? (
                    Object.entries(result.aiSignals).map(([key, val]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs font-semibold mb-1 uppercase tracking-wider text-gray-500">
                          <span>{key}</span>
                          <span>{val}/100</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1A56C4] rounded-full transition-all duration-1000"
                            style={{ width: `${val}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-gray-400 italic">
                      Linguistic telemetry unavailable.
                    </div>
                  )}

                  {/* AI Flags */}
                  {result.aiFlags && result.aiFlags.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Detected Indicators</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.aiFlags.map((flag, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-blue-50 text-[#1A56C4] font-semibold px-2 py-1"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* External database checks */}
              <div className="bg-white border border-blue-100 p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                  <div className="w-1 h-4 bg-[#1A56C4]" />
                  <h3 className="text-xs font-black uppercase tracking-widest">
                    Google Fact Check Matches
                  </h3>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px]">
                  {result.matches && result.matches.length > 0 ? (
                    result.matches.map((match, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-100 space-y-2">
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-800 px-2 py-0.5">
                            {match.publisher}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold">
                            {match.publisherDate ? new Date(match.publisherDate).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 italic">
                          &quot;{match.claim}&quot;
                        </p>
                        <div className="text-xs font-bold text-gray-600">
                          Verdict: <span className="text-red-600 uppercase font-black">{match.verdict}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-2 text-gray-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                      <p className="text-xs font-semibold">No direct matches found</p>
                      <p className="text-[10px] mt-0.5">This headline is not indexed as a resolved hoax in our partner registries.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={resetAll}
                className="px-8 py-3 bg-[#1A56C4] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
              >
                ↩ Check Another Headline
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 mt-6 text-sm text-center font-semibold">
            {error}
          </div>
        )}

      </div>
    </div>
  );
}
