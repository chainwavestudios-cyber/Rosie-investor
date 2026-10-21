/**
 * FronterErrorBoundary.jsx — Safety net for the fronter screens.
 * Without it, any failure on /fronter unmounts the whole app and leaves the
 * fronter staring at a black page mid-call with no way back. This catches the
 * failure and shows what went wrong, so it can be reported and fixed.
 */
import { Component } from 'react';

const GOLD = '#10b981';

export default class FronterErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Fronter screen error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 999999, fontFamily: 'Georgia, serif' }}>
        <div style={{ width: '100%', maxWidth: '560px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>⚠ The call screen hit a problem</div>
          <div style={{ color: '#e8e0d0', fontSize: '13px', lineHeight: 1.6, marginBottom: '14px' }}>
            This is the message that used to leave the screen black. Send it to your admin so the cause can be fixed.
          </div>
          <pre style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '12px', color: '#f59e0b', fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '180px', overflowY: 'auto', marginBottom: '16px' }}>
            {`${error?.name || 'Error'}: ${error?.message || String(error)}`}
          </pre>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => this.setState({ error: null })}
              style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '6px', padding: '10px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '6px', padding: '10px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}
            >
              Reload the screen
            </button>
          </div>
        </div>
      </div>
    );
  }
}