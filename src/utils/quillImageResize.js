/**
 * quillImageResize.js — Registers a custom Quill Image blot that preserves
 * inline width styles, so images can be resized in the editor and the width
 * survives save/reload cycles.
 *
 * Also provides a helper to attach a click-to-resize interaction to the editor.
 */
import Quill from 'quill';

let registered = false;

export function registerImageResizeBlot() {
  if (registered) return;
  registered = true;

  const Image = Quill.import('formats/image');

  // Override static formats to capture width from inline style
  const origFormats = Image.formats;
  Image.formats = function (domNode) {
    const formats = origFormats ? origFormats.call(this, domNode) : {};
    if (domNode.style && domNode.style.width) {
      formats.width = domNode.style.width;
    }
    return formats;
  };

  // Override static value to return { src, width } object when width is set
  const origValue = Image.value;
  Image.value = function (domNode) {
    const src = origValue ? origValue.call(this, domNode) : domNode.getAttribute('src');
    if (domNode.style && domNode.style.width) {
      return { src, width: domNode.style.width };
    }
    return src;
  };

  // Override static create to handle { src, width } objects
  const origCreate = Image.create;
  Image.create = function (value) {
    const src = typeof value === 'object' ? value.src : value;
    const node = origCreate.call(this, src);
    if (typeof value === 'object' && value.width) {
      node.style.width = value.width;
    }
    return node;
  };

  // Add format instance method to apply/remove width
  const origFormat = Image.prototype.format;
  Image.prototype.format = function (name, value) {
    if (name === 'width') {
      if (value) {
        this.domNode.style.width = value;
      } else {
        this.domNode.style.width = '';
      }
    } else if (origFormat) {
      origFormat.call(this, name, value);
    }
  };
}

/**
 * Attaches a click handler to the Quill editor that shows a floating resize
 * panel when an image is clicked. Returns a cleanup function.
 *
 * @param {object} quill - The Quill editor instance
 * @param {function} onSelect - Callback(width, imgElement) when a size is chosen
 * @returns {function} cleanup function
 */
export function attachImageResizeHandler(quill, onSelect) {
  if (!quill) return () => {};

  const handleClick = (e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      onSelect(e.target);
    }
  };

  quill.root.addEventListener('click', handleClick);
  return () => quill.root.removeEventListener('click', handleClick);
}