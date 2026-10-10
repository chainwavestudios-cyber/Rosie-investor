/**
 * ScriptWysiwygEditor.jsx — ContentEditable WYSIWYG editor for debt scripts.
 * Renders BBCode formatting inline (bold, italic, color, highlight, size, font)
 * instead of showing raw [b]..[/b] tags in a plain textarea.
 *
 * Stores BBCode (same format as before) — converts BBCode→HTML on load and
 * HTML→BBCode on input. The contentEditable ref is exposed via forwardRef so
 * the format toolbar and cue-insert buttons can drive it with execCommand.
 */
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { bbcodeToHtml, htmlToBbcode } from '@/components/debt/ScriptRichText';

const ScriptWysiwygEditor = forwardRef(({ value, onChange, style }, ref) => {
  const innerRef = useRef(null);
  const lastValueRef = useRef('');

  useImperativeHandle(ref, () => innerRef.current);

  // Set innerHTML when the external BBCode value changes (e.g. switching scripts).
  // Skips when the change came from our own onInput (lastValueRef matches).
  useEffect(() => {
    if (!innerRef.current) return;
    if (value !== lastValueRef.current) {
      innerRef.current.innerHTML = bbcodeToHtml(value);
      lastValueRef.current = value;
    }
  }, [value]);

  const handleInput = () => {
    if (!innerRef.current) return;
    const bbcode = htmlToBbcode(innerRef.current.innerHTML);
    lastValueRef.current = bbcode;
    onChange(bbcode);
  };

  // Intercept Enter to insert a <br> (instead of browser-default <div>).
  // This makes line breaks reliable and consistent across browsers.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const br = document.createElement('br');
      range.insertNode(br);
      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
      // If the br is at the end of the container, add a helper br so the
      // cursor shows on the new line. It's marked data-helper so the BBCode
      // converter skips it — no extra \n in the saved content.
      if (!br.nextSibling) {
        const helper = document.createElement('br');
        helper.setAttribute('data-helper', '1');
        br.parentNode.appendChild(helper);
      }
      handleInput();
    }
  };

  // Paste as plain text to avoid messy external HTML polluting the editor
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div
      ref={innerRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      data-placeholder="Type your script here… Use {{firstname}} or {{lastname}} for auto-insertion. Highlight text and use the toolbar to color, bold, italicize, resize, or highlight it. Use cue block buttons above to add non-spoken annotations."
      style={{
        ...style,
        whiteSpace: 'pre-wrap',
        outline: 'none',
        overflowY: 'auto',
        overflowX: 'hidden',
        wordBreak: 'break-word',
      }}
    />
  );
});

export default ScriptWysiwygEditor;