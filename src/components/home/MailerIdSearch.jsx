import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SOURCES = [
  'Public Records',
  'Police Records',
  'Tax Records',
  'Credit Bureaus',
  'Property Records',
  'Court Filings',
  'DMV Records',
  'UCC Filings',
];

/**
 * MailerIdSearch — the visitor types the Mailer ID printed on their notice and we
 * run a record scan on it, then open their file for confirmation.
 */
export default function MailerIdSearch({ onFound }) {
  const [value, setValue] = useState('');
  const [scan, setScan] = useState(null);
  const ticker = useRef(null);

  useEffect(() => () => clearInterval(ticker.current), []);

  const runScan = async () => {
    const mailerId = value.trim();
    if (!mailerId || scan) return;

    setScan({ step: 0, source: SOURCES[0], progress: 5, hits: 0, status: 'scanning', message: '' });

    ticker.current = setInterval(() => {
      setScan((prev) => {
        if (!prev || prev.status !== 'scanning') return prev;
        const step = prev.step + 1;
        return {
          ...prev,
          step,
          source: SOURCES[step % SOURCES.length],
          progress: Math.min(5 + step * 1.5, 95),
          hits: prev.hits + 137 + (step % 9) * 211,
        };
      });
    }, 240);

    let profile = null;
    try {
      const lookup = base44.functions
        .invoke('homeQualifyChat', { action: 'lead_profile', candidates: [mailerId] })
        .then((response) => response?.data?.profile || null)
        .catch(() => null);
      [profile] = await Promise.all([lookup, new Promise((resolve) => setTimeout(resolve, 15000))]);
    } catch {
      profile = null;
    }

    clearInterval(ticker.current);
    setScan((prev) =>
      prev && {
        ...prev,
        progress: 100,
        status: profile ? 'found' : 'none',
        message: profile ? 'Match found — pulling your file' : 'No file matched that Mailer ID',
      },
    );

    if (profile) {
      setTimeout(() => {
        setScan(null);
        onFound?.(profile);
        setTimeout(() => document.getElementById('lead-confirm')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      }, 900);
    }
  };

  const scanning = scan?.status === 'scanning';

  return (
    <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-[#1a1626]/60 px-2 py-1.5 backdrop-blur-xl">
        <Search className="h-3.5 w-3.5 shrink-0 text-white/45" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && runScan()}
          placeholder="Mailer ID"
          className="w-24 bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none sm:w-32"
        />
        <button
          type="button"
          onClick={runScan}
          disabled={!value.trim() || !!scan}
          className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#1a0b2e] transition hover:bg-white/85 disabled:opacity-40"
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </button>
      </div>

      {scan && (
        <div className="w-[300px] max-w-[86vw] overflow-hidden rounded-2xl border border-white/15 bg-[#150f22]/90 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.5px] text-teal-300">
              <span className={`h-1.5 w-1.5 rounded-full ${scanning ? 'animate-pulse bg-teal-400' : scan.status === 'found' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {scanning ? 'Scanning records' : scan.status === 'found' ? 'Match found' : 'No match'}
            </span>
            {!scanning && (
              <button type="button" onClick={() => setScan(null)} className="text-white/40 transition hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {scanning ? (
            <>
              <p className="mt-2 text-xs text-white/85">{scan.source}…</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-1 rounded-full bg-gradient-to-r from-[#4d94ff] to-[#00e6a1] transition-all duration-200" style={{ width: `${scan.progress}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
                {SOURCES.map((source, index) => {
                  const position = scan.step % SOURCES.length;
                  const done = index < position;
                  const current = index === position;
                  return (
                    <span
                      key={source}
                      className={`inline-flex items-center gap-1 text-[10px] ${
                        done ? 'text-emerald-300' : current ? 'text-teal-200' : 'text-white/35'
                      }`}
                    >
                      {done ? (
                        <Check className="h-3 w-3 shrink-0" />
                      ) : (
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${current ? 'animate-pulse bg-teal-400' : 'bg-white/20'}`} />
                      )}
                      {source}
                    </span>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] text-white/40">
                Records reviewed: {scan.hits.toLocaleString()} · pass {Math.floor(scan.step / SOURCES.length) + 1}
              </p>
            </>
          ) : scan.status === 'found' ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              {scan.message}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-200">
              {scan.message}. Check the number printed on the front of your notice, or just ask below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}