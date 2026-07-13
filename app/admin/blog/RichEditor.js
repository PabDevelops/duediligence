'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';

const btnStyle = (active) => ({
  width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)',
  background: active ? 'var(--accent-dim)' : 'var(--bg-1)', color: active ? 'var(--accent)' : 'var(--text-2)',
  cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, sans-serif',
});

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button type="button" onClick={onClick} title={title} style={btnStyle(active)}>
      {children}
    </button>
  );
}

export default function RichEditor({ html, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ HTMLAttributes: { style: 'width:100%;border-radius:12px;margin:20px 0;' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { style: 'color:var(--accent);' } }),
      Underline,
      Placeholder.configure({ placeholder: 'Write your post…' }),
    ],
    content: html || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  if (!editor) return null;

  const insertImage = () => {
    const url = window.prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const insertLink = () => {
    const url = window.prompt('Link URL:');
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertChart = () => {
    const ticker = window.prompt('Ticker for stock chart (e.g. AAPL):');
    if (ticker) editor.chain().focus().insertContent(`<p>[chart:${ticker.toUpperCase().trim()}]</p>`).run();
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', padding: '8px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0' }}>
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '4px 2px' }} />

        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
        <ToolbarButton title="Paragraph" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>¶</ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '4px 2px' }} />

        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• ≡</ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. ≡</ToolbarButton>
        <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</ToolbarButton>
        <ToolbarButton title="Code" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'</>'}</ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '4px 2px' }} />

        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={insertLink}>🔗</ToolbarButton>
        <ToolbarButton title="Insert image" onClick={insertImage}>🖼</ToolbarButton>
        <ToolbarButton title="Insert stock chart" onClick={insertChart}>📈</ToolbarButton>
        <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '4px 2px' }} />

        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>↺</ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>↻</ToolbarButton>
      </div>

      <div className="rich-editor-content" style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', background: 'var(--bg-1)', minHeight: '320px', padding: '16px' }}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .rich-editor-content .ProseMirror { outline: none; color: var(--text); font-family: Inter, sans-serif; font-size: 15px; line-height: 1.7; min-height: 290px; }
        .rich-editor-content .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--text-3); float: left; pointer-events: none; height: 0; }
        .rich-editor-content .ProseMirror h2 { font-size: 21px; font-weight: 800; margin: 20px 0 10px; }
        .rich-editor-content .ProseMirror h3 { font-size: 17px; font-weight: 800; margin: 16px 0 8px; }
        .rich-editor-content .ProseMirror p { margin: 0 0 14px; }
        .rich-editor-content .ProseMirror ul, .rich-editor-content .ProseMirror ol { margin: 0 0 14px; padding-left: 24px; }
        .rich-editor-content .ProseMirror blockquote { border-left: 3px solid var(--accent); margin: 0 0 14px; padding-left: 14px; color: var(--text-2); }
        .rich-editor-content .ProseMirror pre { background: var(--bg-2); border-radius: 8px; padding: 12px; overflow-x: auto; }
        .rich-editor-content .ProseMirror img { max-width: 100%; border-radius: 12px; }
        .rich-editor-content .ProseMirror a { color: var(--accent); }
        .rich-editor-content .ProseMirror hr { border-color: var(--border); margin: 20px 0; }
      `}</style>
    </div>
  );
}
