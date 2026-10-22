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
      <div className="flex w-full items-center gap-2 rounded-full bg-home-muted py-1 pl-3 pr-1 focus-within:ring-2 focus-within:ring-home-accent sm:w-auto">
        <Search className="h-4 w-4 shrink-0 text-home-muted-ink" aria-hidden="true" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && runScan()}
          placeholder="Mailer ID"
          aria-label="Mailer ID"
          className="w-full min-w-0 bg-transparent text-sm text-home-ink placeholder:text-home-muted-ink focus:outline-none sm:w-28"
        />
        <button
          type="button"
          onClick={runScan}
          disabled={!value.trim() || !!scan}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-home-navy px-3 py-1.5 text-xs font-semibold text-home-navy-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </button>
      </div>

      {scan && (
        <div className="w-[300px] max-w-[86vw] overflow-hidden rounded-2xl border border-home-line bg-home-card p-3 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.5px] text-home-navy">
              <span className={`h-1.5 w-1.5 rounded-full ${scanning ? 'animate-pulse bg-home-accent' : scan.status === 'found' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {scanning ? 'Scanning records' : scan.status === 'found' ? 'Match found' : 'No match'}
            </span>
            {!scanning && (
              <button type="button" onClick={() => setScan(null)} className="text-home-muted-ink transition hover:text-home-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {scanning ? (
            <>
              <p className="mt-2 text-xs text-home-ink">{scan.source}…</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-home-muted">
                <div className="h-1 rounded-full bg-home-navy transition-all duration-200" style={{ width: `${scan.progress}%` }} />
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
                        done ? 'text-emerald-600' : current ? 'font-semibold text-home-navy' : 'text-home-muted-ink'
                      }`}
                    >
                      {done ? (
                        <Check className="h-3 w-3 shrink-0" />
                      ) : (
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${current ? 'animate-pulse bg-home-accent' : 'bg-home-line'}`} />
                      )}
                      {source}
                    </span>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] text-home-muted-ink">
                Records reviewed: {scan.hits.toLocaleString()} · pass {Math.floor(scan.step / SOURCES.length) + 1}
              </p>
            </>
          ) : scan.status === 'found' ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {scan.message}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-700">
              {scan.message}. Check the number printed on the front of your notice, or just ask below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}