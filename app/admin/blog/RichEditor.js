'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { NEW_COLORS as C } from '../../components/new/theme';

const btnStyle = (active) => ({
  width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${C.border}`,
  background: active ? C.lime : '#FDFBF6', color: active ? C.ink : C.text2,
  cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit',
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
      Link.configure({ openOnClick: false, HTMLAttributes: { style: `color:${C.ink};text-decoration:underline;` } }),
      Underline,
      Placeholder.configure({ placeholder: 'Escribe tu artículo…' }),
    ],
    content: html || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  if (!editor) return null;

  const insertImage = () => {
    const url = window.prompt('URL de la imagen:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const insertLink = () => {
    const url = window.prompt('URL del enlace:');
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertChart = () => {
    const ticker = window.prompt('Ticker para el gráfico (ej: AAPL):');
    if (ticker) editor.chain().focus().insertContent(`<p>[chart:${ticker.toUpperCase().trim()}]</p>`).run();
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', padding: '8px', background: '#FDFBF6', border: `1px solid ${C.border}`, borderRadius: '10px 10px 0 0' }}>
        <ToolbarButton title="Negrita" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolbarButton>
        <ToolbarButton title="Cursiva" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolbarButton>
        <ToolbarButton title="Subrayado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolbarButton>
        <ToolbarButton title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolbarButton>

        <div style={{ width: '1px', background: C.border, margin: '4px 2px' }} />

        <ToolbarButton title="Encabezado 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton title="Encabezado 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
        <ToolbarButton title="Párrafo" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>¶</ToolbarButton>

        <div style={{ width: '1px', background: C.border, margin: '4px 2px' }} />

        <ToolbarButton title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• ≡</ToolbarButton>
        <ToolbarButton title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. ≡</ToolbarButton>
        <ToolbarButton title="Cita" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&quot;</ToolbarButton>
        <ToolbarButton title="Código" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'</>'}</ToolbarButton>

        <div style={{ width: '1px', background: C.border, margin: '4px 2px' }} />

        <ToolbarButton title="Enlace" active={editor.isActive('link')} onClick={insertLink}>🔗</ToolbarButton>
        <ToolbarButton title="Insertar imagen" onClick={insertImage}>🖼</ToolbarButton>
        <ToolbarButton title="Insertar gráfico" onClick={insertChart}>📈</ToolbarButton>
        <ToolbarButton title="Separador" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarButton>

        <div style={{ width: '1px', background: C.border, margin: '4px 2px' }} />

        <ToolbarButton title="Deshacer" onClick={() => editor.chain().focus().undo().run()}>↺</ToolbarButton>
        <ToolbarButton title="Rehacer" onClick={() => editor.chain().focus().redo().run()}>↻</ToolbarButton>
      </div>

      <div className="rich-editor-content" style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', background: '#FDFBF6', minHeight: '320px', padding: '16px', boxSizing: 'border-box' }}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .rich-editor-content .ProseMirror { outline: none; color: ${C.ink}; font-family: inherit; font-size: 15px; line-height: 1.7; min-height: 290px; }
        .rich-editor-content .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: ${C.text3}; float: left; pointer-events: none; height: 0; }
        .rich-editor-content .ProseMirror h2 { font-size: 21px; font-weight: 800; margin: 20px 0 10px; }
        .rich-editor-content .ProseMirror h3 { font-size: 17px; font-weight: 800; margin: 16px 0 8px; }
        .rich-editor-content .ProseMirror p { margin: 0 0 14px; }
        .rich-editor-content .ProseMirror ul, .rich-editor-content .ProseMirror ol { margin: 0 0 14px; padding-left: 24px; }
        .rich-editor-content .ProseMirror blockquote { border-left: 3px solid ${C.ink}; margin: 0 0 14px; padding-left: 14px; color: ${C.text2}; }
        .rich-editor-content .ProseMirror pre { background: ${C.bg}; border-radius: 8px; padding: 12px; overflow-x: auto; }
        .rich-editor-content .ProseMirror img { max-width: 100%; border-radius: 12px; }
        .rich-editor-content .ProseMirror a { color: ${C.ink}; }
        .rich-editor-content .ProseMirror hr { border-color: ${C.border}; margin: 20px 0; }
      `}</style>
    </div>
  );
}
