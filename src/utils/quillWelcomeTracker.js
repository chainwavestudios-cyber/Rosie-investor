/**
 * Shared "Insert Welcome Tracker" helper for the Quill email editors.
 *
 * Wraps the currently-selected image OR text in a trackable anchor whose
 * href is the {{personalMessageUrl}} placeholder. The email sending layer
 * rewrites {{personalMessageUrl}} into a per-lead tracked URL at send time,
 * so clicks light up the 🎙️ Personal Message badge on the contact card.
 *
 * We manipulate the Quill DOM directly (instead of quill.format('link', ...))
 * because Quill's built-in Link blot sanitizes non-URL values and would
 * replace {{personalMessageUrl}} with '#'.
 *
 * Usage:
 *   import { insertWelcomeTracker } from '@/utils/quillWelcomeTracker';
 *   insertWelcomeTracker(quillRef, selectedImg, setSelectedImg, (html) => update('bodyHtml', html));
 */
export const TRACK_HREF = '{{personalMessageUrl}}';
export const DEFAULT_LINKED_TEXT = '▶ Listen to my personal message';

export function insertWelcomeTracker(quillRef, selectedImg, onSelectImg, updateField) {
  const quill = quillRef.current?.getEditor?.();
  if (!quill) return;
  const root = quill.root;

  // Case 1 — a selected image: wrap it (or re-point an existing anchor)
  if (selectedImg) {
    const parent = selectedImg.parentNode;
    if (parent && parent.tagName === 'A') {
      parent.setAttribute('href', TRACK_HREF);
      parent.setAttribute('target', '_blank');
    } else if (parent) {
      const anchor = document.createElement('a');
      anchor.href = TRACK_HREF;
      anchor.target = '_blank';
      parent.insertBefore(anchor, selectedImg);
      anchor.appendChild(selectedImg);
    }
    if (onSelectImg) onSelectImg(null);
    updateField(root.innerHTML);
    return;
  }

  // Case 2 — a text selection inside the editor: wrap the selected range
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && root.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      const anchor = document.createElement('a');
      anchor.href = TRACK_HREF;
      anchor.target = '_blank';
      anchor.appendChild(range.extractContents());
      range.insertNode(anchor);
      sel.removeAllRanges();
      updateField(root.innerHTML);
      return;
    }
  }

  // Case 3 — nothing selected: append a default linked text at the end
  const anchor = document.createElement('a');
  anchor.href = TRACK_HREF;
  anchor.target = '_blank';
  anchor.textContent = DEFAULT_LINKED_TEXT;
  root.appendChild(anchor);
  root.appendChild(document.createElement('br'));
  updateField(root.innerHTML);
}