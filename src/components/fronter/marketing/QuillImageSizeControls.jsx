import { useEffect, useState } from 'react';
import Quill from 'quill';
import ImageWidthControls from '@/components/fronter/marketing/ImageWidthControls';

export default function QuillImageSizeControls({ quillRef }) {
  const [index, setIndex] = useState(null);
  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const select = event => {
      if (event.target.tagName !== 'IMG') return;
      const blot = Quill.find(event.target);
      if (blot) setIndex(editor.getIndex(blot));
    };
    editor.root.addEventListener('click', select);
    return () => editor.root.removeEventListener('click', select);
  }, [quillRef]);
  if (index === null) return <p className="mt-2 text-xs text-assistant-muted">Click an inserted image to change its size.</p>;
  return <ImageWidthControls onApply={width => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    editor.formatText(index, 1, 'width', width || false, 'user');
  }} />;
}