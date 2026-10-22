import { useRef, useState } from 'react';
import ImageWidthControls from '@/components/fronter/marketing/ImageWidthControls';

export default function EmailDocumentEditor({ html, onChange }) {
  const frame = useRef(null);
  const image = useRef(null);
  const [selected, setSelected] = useState(false);
  const [source, setSource] = useState(false);
  const [documentHtml, setDocumentHtml] = useState(html);
  const capture = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const copy = doc.documentElement.cloneNode(true);
    copy.querySelectorAll('[contenteditable]').forEach(node => node.removeAttribute('contenteditable'));
    onChange(`<!doctype html>\n${copy.outerHTML}`);
  };
  const loaded = () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    doc.body.contentEditable = 'true';
    doc.addEventListener('input', capture);
    doc.addEventListener('click', event => {
      if (event.target.closest('a')) event.preventDefault();
      if (event.target.tagName === 'IMG') { image.current = event.target; setSelected(true); }
    });
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-assistant-muted">Edit text directly. Click an image, then choose its width.</p><button type="button" className="calendar-secondary" onClick={() => { setDocumentHtml(html); setSource(!source); setSelected(false); }}>{source ? 'Visual editor' : 'HTML source'}</button></div>
    {source ? <textarea aria-label="Marketing email HTML" className="calendar-field min-h-96 font-mono text-xs" value={html} onChange={event => onChange(event.target.value)} /> : <iframe ref={frame} title="Marketing email editor" sandbox="allow-same-origin" className="h-[520px] w-full rounded border border-assistant-border bg-background" srcDoc={documentHtml} onLoad={loaded} />}
    {selected && !source && <ImageWidthControls onApply={width => {
      const img = image.current;
      if (!img?.isConnected) return;
      img.style.width = width; img.style.height = 'auto';
      if (width.endsWith('px')) img.setAttribute('width', String(parseInt(width, 10)));
      else if (width) img.setAttribute('width', width);
      else img.removeAttribute('width');
      img.removeAttribute('height'); capture();
    }} />}
  </div>;
}