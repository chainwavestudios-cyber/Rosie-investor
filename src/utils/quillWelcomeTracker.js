/**
 * Shared "Insert Welcome Tracker" helper for the Quill email editors.
 *
 * Wraps the currently-selected image OR text in a trackable anchor whose
 * href is the {{personalMessageUrl}} placeholder. The email sending layer
 * rewrites {{personalMessageUrl}} into a per-lead tracked URL at send time,
 * so clicks light up the 🎙️ Personal Message badge on the contact card.
 *
 * Uses Quill's native format API (not raw DOM manipulation) so the editor's
 * internal delta stays in sync and the controlled onChange never overwrites
 * the link with a sanitized/stale version.
 */
import Quill from 'quill';

export const TRACK_HREF = '{{personalMessageUrl}}';
export const DEFAULT_LINKED_TEXT = '▶ Listen to my personal message';

let linkPatched = false;

/**
 * Patch Quill's Link blot once so it accepts mustache placeholders like
 * {{personalMessageUrl}} instead of sanitizing them to '#'.
 */
function patchLinkBlot() {
  if (linkPatched) return;
  try {
    const Link = Quill.import('formats/link');
    const originalSanitize = Link.sanitize;
    Link.sanitize = function (url) {
      if (typeof url === 'string' && /\{\{.*\}\}/.test(url)) {
        return url;
      }
      return originalSanitize.call(this, url);
    };
    linkPatched = true;
  } catch {
    /* Quill not loaded yet — will retry on next call */
  }
}

export function insertWelcomeTracker(quillRef, selectedImg, onSelectImg, updateField) {
  patchLinkBlot();
  const quill = quillRef.current?.getEditor?.();
  if (!quill) return;

  // Case 1 — a selected image: apply the link format to the image embed
  if (selectedImg && quill.root.contains(selectedImg)) {
    try {
      const blot = Quill.find(selectedImg);
      if (blot) {
        const offset = blot.offset(quill.scroll);
        quill.formatText(offset, 1, 'link', TRACK_HREF, 'user');
        if (onSelectImg) onSelectImg(null);
        updateField(quill.root.innerHTML);
        return;
      }
    } catch {
      /* fall through to text/append cases */
    }
  }

  // Case 2 — a text selection inside the editor: link the selected range
  const range = quill.getSelection();
  if (range && range.length > 0) {
    quill.formatText(range.index, range.length, 'link', TRACK_HREF, 'user');
    updateField(quill.root.innerHTML);
    return;
  }

  // Case 3 — nothing selected: append a default linked text at the end
  const end = quill.getLength();
  quill.insertText(end, DEFAULT_LINKED_TEXT, { link: TRACK_HREF }, 'user');
  quill.insertText(end + DEFAULT_LINKED_TEXT.length, '\n', 'user');
  updateField(quill.root.innerHTML);
}