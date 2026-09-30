/**
 * ScriptRichText.jsx — BBCode-style inline formatting for debt scripts.
 * Tags: [b]..[/b] [i]..[/i] [c=#hex]..[/c] [bg=#hex]..[/bg] [s=18]..[/s] [f=Georgia]..[/f]
 * renderFormatted() turns a tagged string into styled React spans (unformatted
 *   text is left bare so it inherits the container's color/size).
 * stripFormatTags() removes the tags for plain-text speech matching.
 */
import React from 'react';

const TAG_RE = /\[(\/?)(b|i|c|bg|s|f)(?:=([^\]]+))?\]/gi;

export function stripFormatTags(text) {
  if (!text) return text;
  return text.replace(TAG_RE, '');
}

function styleForTag(tag, value) {
  switch (tag) {
    case 'b': return { fontWeight: 'bold' };
    case 'i': return { fontStyle: 'italic' };
    case 'c': return { color: value };
    case 'bg': return { backgroundColor: value, padding: '0 2px', borderRadius: '2px' };
    case 's': { const n = parseInt(value, 10); return { fontSize: (isNaN(n) ? 14 : n) + 'px' }; }
    case 'f': return { fontFamily: value };
    default: return {};
  }
}

export function renderFormatted(text) {
  if (!text) return text;
  const re = new RegExp(TAG_RE.source, 'gi');
  const nodes = [];
  const stack = [{}]; // base style is empty → bare text inherits container
  let lastIndex = 0;
  let key = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const seg = text.slice(lastIndex, m.index);
      const style = stack[stack.length - 1];
      if (Object.keys(style).length) nodes.push(<span key={key++} style={style}>{seg}</span>);
      else nodes.push(seg);
    }
    lastIndex = re.lastIndex;
    const isClose = m[1] === '/';
    const tag = m[2];
    const value = m[3];
    if (isClose) {
      if (stack.length > 1) stack.pop();
    } else {
      stack.push({ ...stack[stack.length - 1], ...styleForTag(tag, value) });
    }
  }
  if (lastIndex < text.length) {
    const seg = text.slice(lastIndex);
    const style = stack[stack.length - 1];
    if (Object.keys(style).length) nodes.push(<span key={key++} style={style}>{seg}</span>);
    else nodes.push(seg);
  }
  return nodes;
}