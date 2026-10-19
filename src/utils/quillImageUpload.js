/**
 * Shared Quill image upload handler.
 * Overrides the default Quill image button (which embeds images as base64
 * data URIs and bloats the stored HTML past the field-size limit) to instead
 * upload the file via UploadPublicFile and insert the hosted URL.
 *
 * Usage:
 *   const quillRef = useRef();
 *   const modules = useQuillImageModules(quillRef);
 *   <ReactQuill ref={quillRef} modules={modules} ... />
 */
import { useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

export function useQuillImageModules(quillRef, extraFormats = []) {
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async () => {
      const file = input.files[0];
      document.body.removeChild(input);
      if (!file) return;
      try {
        const quill = quillRef.current?.getEditor?.();
        if (!quill) return;
        const range = quill.getSelection() || { index: quill.getLength(), length: 0 };
        const res = await base44.integrations.Core.UploadPublicFile({ file });
        const url = res?.file_url || res?.url;
        if (!url) throw new Error('No URL returned from upload');
        quill.insertEmbed(range.index, 'image', url);
        quill.setSelection(range.index + 1, 0);
      } catch (err) {
        console.error('Image upload failed:', err);
        alert('Image upload failed. Please try again or paste a hosted image URL.');
      }
    };

    input.click();
  }, [quillRef]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }, { list: 'bullet' }, { list: 'ordered' }],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: { image: imageHandler },
    },
  }), [imageHandler]);

  return modules;
}