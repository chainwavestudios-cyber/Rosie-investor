import { renderFormatted } from '@/components/debt/ScriptRichText';

// Keep transfer beside AI Input; let the script itself scroll in every host.
export default function FronterContactScript({ scripts, activeScript, onSelectScript, segments, hasCompletedSteps, onComplete, onDebtConfirm, debtConfirming, onAiInput, aiInputRunning, onSendEmail, message }) {
  const completeButton = hasCompletedSteps && (
    <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
      <button type="button" onClick={onComplete} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '8px', padding: '12px 32px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 0 16px rgba(16,185,129,0.4)' }}>✅ Completed Steps → Transfer</button>
    </div>
  );
  const hasAiInput = segments.some(segment => segment.toUpperCase() === 'AI_INPUT');
  return (
    <div data-testid="fronter-contact-script" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {scripts.length > 1 && (
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0 }}>
          {scripts.map(script => <button key={script.id} onClick={() => onSelectScript(script)} style={{ padding: '6px 10px', background: 'none', border: 'none', borderBottom: `2px solid ${activeScript?.id === script.id ? '#10b981' : 'transparent'}`, color: activeScript?.id === script.id ? '#10b981' : '#6b7280', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: activeScript?.id === script.id ? 'bold' : 'normal' }}>{script.name}</button>)}
        </div>
      )}
      <div data-testid="fronter-script-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px' }}>
        {!activeScript ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No scripts yet. Ask your admin to add a script.</div> : (
          <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
            {segments.map((segment, index) => {
              if (segment.toUpperCase() === 'DEBT_CONFIRM') return (
                <div key={index} style={{ margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
                  <button onClick={onDebtConfirm} disabled={debtConfirming} style={{ background: '#10b98118', color: '#10b981', border: '2px solid #10b98155', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 0 12px #10b98133' }}>{debtConfirming ? '⏳ Confirming…' : '💰 Confirm Debt'}</button>
                </div>
              );
              if (segment.toUpperCase() === 'AI_INPUT') return (
                <div key={index} style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button onClick={onAiInput} disabled={aiInputRunning} style={{ background: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: '2px solid rgba(167,139,250,0.55)', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 0 12px rgba(167,139,250,0.33)' }}>{aiInputRunning ? '⏳ Summarizing…' : '🤖 AI Input'}</button>
                  {completeButton}
                </div>
              );
              if (segment.toUpperCase() === 'SEND_EMAIL') return (
                <div key={index} style={{ margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
                  <button onClick={onSendEmail} style={{ background: 'rgba(96,165,250,0.18)', color: '#60a5fa', border: '2px solid rgba(96,165,250,0.55)', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif', boxShadow: '0 0 12px rgba(96,165,250,0.33)' }}>📧 Send Credentials Email</button>
                </div>
              );
              return <span key={index}>{renderFormatted(segment)}</span>;
            })}
            {!hasAiInput && completeButton}
          </div>
        )}
      </div>
      {message && <div style={{ padding: '8px 14px', color: '#10b981', fontSize: '10px', flexShrink: 0 }}>{message}</div>}
    </div>
  );
}