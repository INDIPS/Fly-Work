import React, { useState } from 'react';
import { MapPin, Search, Navigation, Building2, Wifi, Server, ExternalLink, RefreshCw } from 'lucide-react';

export const MapsGroundingPanel: React.FC = () => {
  const [query, setQuery] = useState('Public Wi-Fi hotspots and colocation data centers');
  const [location, setLocation] = useState('San Francisco, CA');
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState('');
  const [groundingChunks, setGroundingChunks] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const quickPresets = [
    { label: 'Public Wi-Fi Hotspots', q: 'Find public Wi-Fi hotspots and internet cafes with high-speed connectivity' },
    { label: 'Carrier Data Centers', q: 'Carrier-neutral colocation data centers and internet exchange points' },
    { label: 'Network Hardware Stores', q: 'Commercial network equipment and hardware vendors' },
    { label: 'Tech Coworking Hubs', q: 'Coworking spaces with dedicated fiber internet' },
  ];

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setResultText('');
    setGroundingChunks([]);

    try {
      const res = await fetch('/api/gemini/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        setResultText(data.text);
        setGroundingChunks(data.groundingChunks || []);
      } else {
        setErrorMsg(data.error || 'Failed to retrieve Google Maps grounded information.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827]/90 p-5 shadow-xl backdrop-blur-md space-y-5">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Google Maps Grounding (gemini-3.5-flash)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-world geographic network reconnaissance. Find nearby Wi-Fi spots, colocation data centers, and internet exchanges powered by Google Maps data.
          </p>
        </div>
      </div>

      {/* Query Form */}
      <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-7">
          <label className="block text-xs font-medium text-slate-300 mb-1">Search Objective</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Find fiber optic data centers or public Wi-Fi hotspots"
              className="w-full rounded border border-slate-700 bg-slate-900/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-300 mb-1">Location / City</label>
          <div className="relative">
            <Navigation className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Austin, TX"
              className="w-full rounded border border-slate-700 bg-slate-900/90 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span>Search Maps</span>
          </button>
        </div>
      </form>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-1.5">
        {quickPresets.map((qp) => (
          <button
            key={qp.label}
            onClick={() => {
              setQuery(qp.q);
            }}
            className="px-2.5 py-1 rounded border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700 text-xs transition-colors"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Result Display */}
      <div className="rounded-lg border border-slate-800 bg-[#0A0E17] p-4 min-h-[200px]">
        {loading ? (
          <div className="py-12 text-center text-cyan-400 italic flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Querying Google Maps grounding with gemini-3.5-flash...</span>
          </div>
        ) : resultText ? (
          <div className="space-y-4">
            <div className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">
              {resultText}
            </div>

            {/* Grounding Attribution Chunks */}
            {groundingChunks.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 mb-2 font-mono">
                  Google Maps Grounding Sources:
                </div>
                <div className="flex flex-wrap gap-2">
                  {groundingChunks.map((chunk, idx) => {
                    const title = chunk?.web?.title || chunk?.maps?.title || `Maps Place ${idx + 1}`;
                    const uri = chunk?.web?.uri || chunk?.maps?.uri;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono"
                      >
                        <MapPin className="h-3 w-3 text-cyan-400" />
                        <span>{title}</span>
                        {uri && (
                          <a href={uri} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-600 text-xs space-y-1">
            <MapPin className="h-8 w-8 mx-auto text-slate-700" />
            <div>Enter an objective and location above to search with real Google Maps data.</div>
          </div>
        )}

        {errorMsg && (
          <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900 p-2.5 rounded mt-3">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
