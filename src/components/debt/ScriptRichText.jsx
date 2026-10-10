/**
 * ScriptRichText.jsx — BBCode-style inline formatting for debt scripts.
 * Tags: [b]..[/b] [i]..[/i] [c=#hex]..[/c] [bg=#hex]..[/bg] [s=18]..[/s] [f=Georgia]..[/f]
 * renderFormatted() turns a tagged string into styled React spans (unformatted
 *   text is left bare so it inherits the container's color/size).
 * stripFormatTags() removes the tags for plain-text speech matching.
 */
import React from 'react';

const TAG_RE = /\[(\/?)(b|i|c|bg|s|f|anim|gap)(?:=([^\]]+))?\]/gi;

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
    case 'anim': { const a = (value || 'pulse').toLowerCase(); return { animation: `script-${a} 1.5s ease-in-out infinite`, display: 'inline-block' }; }
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
    } else if (tag === 'gap') {
      const px = parseInt(value, 10);
      if (!isNaN(px)) nodes.push(<div key={key++} style={{ height: px + 'px' }} />);
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

// ── BBCode ↔ HTML conversion for WYSIWYG editing ──────────────────────────
// bbcodeToHtml: turns stored BBCode into HTML for display inside a contentEditable.
export function bbcodeToHtml(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html
    .replace(/\[b\]/gi, '<b>').replace(/\[\/b\]/gi, '</b>')
    .replace(/\[i\]/gi, '<i>').replace(/\[\/i\]/gi, '</i>')
    .replace(/\[c=([^\]]+)\]/gi, '<span style="color:$1">').replace(/\[\/c\]/gi, '</span>')
    .replace(/\[bg=([^\]]+)\]/gi, '<span style="background-color:$1">').replace(/\[\/bg\]/gi, '</span>')
    .replace(/\[s=([^\]]+)\]/gi, (m, p1) => `<span style="font-size:${p1}px">`).replace(/\[\/s\]/gi, '</span>')
    .replace(/\[f=([^\]]+)\]/gi, '<span style="font-family:$1">').replace(/\[\/f\]/gi, '</span>')
    .replace(/\[anim=([^\]]+)\]/gi, (m, p1) => `<span style="animation:script-${p1} 1.5s ease-in-out infinite;display:inline-block">`).replace(/\[\/anim\]/gi, '</span>')
    .replace(/\[gap=(\d+)\]/gi, (m, p1) => `<div style="height:${p1}px"></div>`);
  html = html.replace(/\n/g, '<br>');
  return html;
}

// htmlToBbcode: walks the DOM tree of the contentEditable and converts back to BBCode.
function nodeToBbcode(node) {
  let result = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent.replace(/\u00a0/g, ' ');
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') {
        result += '\n';
      } else if (tag === 'div' || tag === 'p') {
        const style = child.getAttribute('style') || '';
        const heightMatch = style.match(/height:\s*(\d+)px/i);
        if (heightMatch) {
          if (result && !result.endsWith('\n')) result += '\n';
          result += `[gap=${heightMatch[1]}]`;
          if (!result.endsWith('\n')) result += '\n';
        } else {
          if (result && !result.endsWith('\n')) result += '\n';
          result += nodeToBbcode(child);
          if (!result.endsWith('\n')) result += '\n';
        }
      } else if (tag === 'b' || tag === 'strong') {
        result += '[b]' + nodeToBbcode(child) + '[/b]';
      } else if (tag === 'i' || tag === 'em') {
        result += '[i]' + nodeToBbcode(child) + '[/i]';
      } else if (tag === 'span' || tag === 'font') {
        const style = child.getAttribute('style') || '';
        const colorMatch = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
        const bgMatch = style.match(/background-color:\s*([^;]+)/i) || style.match(/background:\s*([^;]+)/i);
        const sizeMatch = style.match(/font-size:\s*(\d+)px/i);
        const fontMatch = style.match(/font-family:\s*([^;]+)/i);
        const animMatch = style.match(/animation:\s*script-(\w+)/i);
        const fontColor = child.getAttribute('color');
        const fontFace = child.getAttribute('face');
        let openTags = '';
        let closeTags = '';
        if (animMatch) { openTags += `[anim=${animMatch[1]}]`; closeTags = '[/anim]' + closeTags; }
        if (colorMatch) { openTags += `[c=${colorMatch[1].trim()}]`; closeTags = '[/c]' + closeTags; }
        else if (fontColor) { openTags += `[c=${fontColor}]`; closeTags = '[/c]' + closeTags; }
        if (bgMatch) { openTags += `[bg=${bgMatch[1].trim()}]`; closeTags = '[/bg]' + closeTags; }
        if (sizeMatch) { openTags += `[s=${sizeMatch[1]}]`; closeTags = '[/s]' + closeTags; }
        if (fontMatch) { openTags += `[f=${fontMatch[1].trim()}]`; closeTags = '[/f]' + closeTags; }
        else if (fontFace) { openTags += `[f=${fontFace}]`; closeTags = '[/f]' + closeTags; }
        result += openTags + nodeToBbcode(child) + closeTags;
      } else {
        result += nodeToBbcode(child);
      }
    }
  }
  return result;
}

export function htmlToBbcode(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return nodeToBbcode(div).replace(/\n{3,}/g, '\n\n').trim();
}