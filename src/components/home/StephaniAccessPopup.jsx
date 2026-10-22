import React, { useState } from 'react';
import { Lock, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SarahQualifySection from '@/components/sarah/SarahQualifySection';

const ACCESS_KEY = 'stephani_access_granted';
const APP_BASE_URL = window.location.origin;

export default function StephaniAccessPopup() {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ACCESS_KEY) === 'true');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const unlock = async (event) => {
    event.preventDefault();
    const value = code.trim().toLowerCase();
    if (!value || checking) return;
    setChecking(true);
    setError('');
    try {
      const resp = await fetch(`${APP_BASE_URL}/functions/validateAccessCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      });
      const result = await resp.json();
      if (!result?.valid) {
        setError('That access code was not recognised.');
        setChecking(false);
        return;
      }
      sessionStorage.setItem(ACCESS_KEY, 'true');
      setUnlocked(true);
    } catch {
      setError('Could not verify the code. Please try again.');
    }
    setChecking(false);
  };

  return (
    <>
      <section className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-[#d7e6f5] bg-white px-6 py-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[4px] text-[#0ea5e9]">Video access</p>
        <h2 className="mt-2 text-lg font-bold text-[#003366]">Prefer to talk it through face to face?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#475569]">
          Stephani can walk you through the program on video. Video access is reserved for invited clients and needs your
          access code.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#003366] px-5 py-3 text-sm font-semibold text-white"
        >
          <Video className="h-4 w-4" />
          Open Stephani video
        </button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto bg-[#0b1220]">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Talk with Stephani</DialogTitle>
            <DialogDescription className="text-slate-400">
              {unlocked ? 'Your video session is open.' : 'Enter your access code to open the video session.'}
            </DialogDescription>
          </DialogHeader>

          {unlocked ? (
            <div className="flex justify-center">
              <SarahQualifySection />
            </div>
          ) : (
            <form onSubmit={unlock} className="mx-auto w-full max-w-sm py-4">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type="text"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError('');
                }}
                placeholder="Your personal access code"
                className="w-full rounded-xl border border-white/10 bg-[#0d1117] px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/40"
              />
              {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
              <button
                type="submit"
                disabled={checking}
                className="mt-3 w-full rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 px-4 py-3 text-sm font-semibold text-[#0b1220] disabled:opacity-50"
              >
                {checking ? 'Checking…' : 'Unlock video'}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}