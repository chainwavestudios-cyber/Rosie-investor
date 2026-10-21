/**
 * FronterCustomHoldMusicTab.jsx — Admin "Custom Hold Music" section, holding all
 * three call-audio slots in one place:
 *
 *   Custom Hold Recording / Music #1  — standard fronting queue hold (FronterHoldAudio)
 *   Custom Hold Recording / Music #2  — the AI agent's live transfer queue hold (InboundCallAudio)
 *   Incoming Call Recording #1        — Christopher's recorded inbound intro (InboundCallAudio)
 */
import FronterHoldAudioTab from '@/components/fronter/FronterHoldAudioTab';
import InboundHoldAssetManager from './InboundHoldAssetManager';

const GOLD = '#10b981';

export default function FronterCustomHoldMusicTab({ adminUsername }) {
  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🔊 Custom Hold Music</div>

      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '16px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
        Three audio assets control what callers hear. <strong style={{ color: GOLD }}>Custom Hold Recording / Music #1</strong> plays to a customer on hold in the standard fronting queue. <strong style={{ color: GOLD }}>Custom Hold Recording / Music #2</strong> plays to a caller the AI agent is putting into the live transfer queue. <strong style={{ color: GOLD }}>Incoming Call Recording #1</strong> is Christopher's recorded intro that plays when someone first calls in, right before the AI agent takes over. Record from your microphone or upload a .wav / .mp3 file.
      </div>

      <FronterHoldAudioTab
        adminUsername={adminUsername}
        title="Custom Hold Recording / Music #1"
        description="Played when a fronter presses Merge, and to a customer waiting on hold in the standard fronting queue."
      />

      <InboundHoldAssetManager
        assetType="adam_transfer_hold"
        title="Custom Hold Recording / Music #2"
        description="Played to a caller the AI agent is transferring into the live transfer queue (marked Incoming AI - validated through process)."
        adminUsername={adminUsername}
      />

      <InboundHoldAssetManager
        assetType="inbound_initial_message"
        title="Incoming Call Recording #1"
        description="Christopher's recorded intro. Plays when prospects first call in, right after the personalized name greeting and regional phrase, before the AI agent takes over."
        adminUsername={adminUsername}
      />
    </div>
  );
}