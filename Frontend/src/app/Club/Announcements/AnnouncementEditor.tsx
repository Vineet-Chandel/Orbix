import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import DOMPurify from 'dompurify';
import { AlignCenter, AlignLeft, AlignRight, Bold, Code, Eraser, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Underline, Undo2, Unlink } from 'lucide-react';
import { FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS, safeLink, type RichNode } from '../../../../../shared/announcements';
import { NeoSelect, type NeoSelectOption } from '../../../components/NeoSelect';
import './announcements.css';

const PARAGRAPH_OPTIONS: NeoSelectOption[] = [
    { value: 'paragraph', label: 'Paragraph' },
    { value: '1', label: 'Heading 1' },
    { value: '2', label: 'Heading 2' },
    { value: '3', label: 'Heading 3' },
];

const FONT_SIZE_OPTIONS: NeoSelectOption[] = [
    { value: '', label: 'Size' },
    ...FONT_SIZES.map(size => ({ value: size, label: size })),
];

const TEXT_COLOR_LABELS = ['Ink', 'Blue', 'Green', 'Red', 'Purple'];
const TEXT_COLOR_OPTIONS: NeoSelectOption[] = TEXT_COLORS.map((color, idx) => ({
    value: color,
    label: TEXT_COLOR_LABELS[idx] || color,
    icon: <span className="inline-block h-3 w-3 rounded-full border border-black shrink-0" style={{ backgroundColor: color }} />,
}));

const HIGHLIGHT_COLOR_LABELS = ['Yellow', 'Green', 'Blue'];
const HIGHLIGHT_COLOR_OPTIONS: NeoSelectOption[] = [
    { value: '', label: 'Highlight' },
    ...HIGHLIGHT_COLORS.map((color, idx) => ({
        value: color,
        label: HIGHLIGHT_COLOR_LABELS[idx] || color,
        icon: <span className="inline-block h-3 w-3 rounded-[3px] border border-black shrink-0" style={{ backgroundColor: color }} />,
    })),
];

export interface AnnouncementEditorHandle { openLink: () => void }
export function AnnouncementEditor({ initialContent, onChange, disabled, editorRef }: { initialContent: RichNode; onChange: (content: RichNode) => void; disabled: boolean; editorRef?: Ref<AnnouncementEditorHandle> }) {
    const [linkOpen, setLinkOpen] = useState(false);
    const [link, setLink] = useState('');
    const [linkError, setLinkError] = useState('');
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: false, isAllowedUri: uri => !!safeLink(uri) } }),
            TextStyle, Color, FontSize, TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
            Highlight.configure({ multicolor: true }),
        ],
        content: initialContent,
        editable: !disabled,
        shouldRerenderOnTransaction: true,
        onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as RichNode),
        editorProps: {
            attributes: { role: 'textbox', 'aria-label': 'Announcement message', 'aria-multiline': 'true', 'data-placeholder': 'Share an announcement with your community...' },
            transformPastedHTML: html => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p','br','h1','h2','h3','strong','b','em','i','u','s','strike','code','pre','ul','ol','li','blockquote','hr','a'], ALLOWED_ATTR: ['href','start'] }),
        },
    });
    useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
    useImperativeHandle(editorRef, () => ({ openLink: () => { setLink(String(editor?.getAttributes('link').href || '')); setLinkError(''); setLinkOpen(true); } }), [editor]);
    if (!editor) return <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />;
    const actions = [
        ['Bold (Ctrl/⌘ B)', <Bold size={16} />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
        ['Italic (Ctrl/⌘ I)', <Italic size={16} />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
        ['Underline (Ctrl/⌘ U)', <Underline size={16} />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline')],
        ['Strikethrough', <Strikethrough size={16} />, () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike')],
        ['Inline code', <Code size={16} />, () => editor.chain().focus().toggleCode().run(), editor.isActive('code')],
        ['Bulleted list', <List size={16} />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
        ['Numbered list', <ListOrdered size={16} />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
        ['Quotation', <Quote size={16} />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote')],
        ['Align left', <AlignLeft size={16} />, () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' })],
        ['Align center', <AlignCenter size={16} />, () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' })],
        ['Align right', <AlignRight size={16} />, () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' })],
        ['Horizontal separator', <Minus size={16} />, () => editor.chain().focus().setHorizontalRule().run(), false],
        ['Insert or edit link', <Link2 size={16} />, () => { setLink(String(editor.getAttributes('link').href || '')); setLinkError(''); setLinkOpen(value => !value); }, editor.isActive('link')],
        ['Remove link', <Unlink size={16} />, () => editor.chain().focus().extendMarkRange('link').unsetLink().run(), false],
        ['Clear formatting', <Eraser size={16} />, () => editor.chain().focus().unsetAllMarks().clearNodes().run(), false],
        ['Undo (Ctrl/⌘ Z)', <Undo2 size={16} />, () => editor.chain().focus().undo().run(), false],
        ['Redo (Ctrl/⌘ Shift Z)', <Redo2 size={16} />, () => editor.chain().focus().redo().run(), false],
    ] as const;
    return <div className={`announcement-editor overflow-hidden rounded-xl border-2 border-black ${disabled ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={disabled}>
        <div className="announcement-toolbar flex flex-wrap items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 p-2" role="toolbar" aria-label="Text formatting">
            <div className="w-28 shrink-0">
                <NeoSelect
                    aria-label="Paragraph style"
                    size="sm"
                    portal={true}
                    dropdownWidth={150}
                    triggerClassName="!h-9 !py-1 !px-2.5 !text-xs !bg-white !rounded-lg !border-2 !border-black font-bold"
                    value={editor.isActive('heading') ? String(editor.getAttributes('heading').level) : 'paragraph'}
                    options={PARAGRAPH_OPTIONS}
                    disabled={disabled}
                    onChange={val => {
                        if (val === 'paragraph') editor.chain().focus().setParagraph().run();
                        else editor.chain().focus().setHeading({ level: Number(val) as 1 | 2 | 3 }).run();
                    }}
                />
            </div>
            {actions.map(([label, icon, action, active]) => <button key={label} type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={action}>{icon}</button>)}
            <div className="w-24 shrink-0">
                <NeoSelect
                    aria-label="Font size"
                    size="sm"
                    portal={true}
                    dropdownWidth={130}
                    triggerClassName="!h-9 !py-1 !px-2.5 !text-xs !bg-white !rounded-lg !border-2 !border-black font-bold"
                    value={String(editor.getAttributes('textStyle').fontSize || '')}
                    placeholder="Size"
                    options={FONT_SIZE_OPTIONS}
                    disabled={disabled}
                    onChange={val => {
                        if (val) editor.chain().focus().setFontSize(val).run();
                        else editor.chain().focus().unsetFontSize().run();
                    }}
                />
            </div>
            <div className="w-28 shrink-0">
                <NeoSelect
                    aria-label="Text color"
                    size="sm"
                    portal={true}
                    dropdownWidth={150}
                    triggerClassName="!h-9 !py-1 !px-2.5 !text-xs !bg-white !rounded-lg !border-2 !border-black font-bold"
                    value={String(editor.getAttributes('textStyle').color || TEXT_COLORS[0])}
                    options={TEXT_COLOR_OPTIONS}
                    disabled={disabled}
                    onChange={val => editor.chain().focus().setColor(val).run()}
                />
            </div>
            <div className="w-28 shrink-0">
                <NeoSelect
                    aria-label="Highlight color"
                    size="sm"
                    portal={true}
                    dropdownWidth={150}
                    triggerClassName="!h-9 !py-1 !px-2.5 !text-xs !bg-white !rounded-lg !border-2 !border-black font-bold"
                    value={String(editor.getAttributes('highlight').color || '')}
                    placeholder="Highlight"
                    options={HIGHLIGHT_COLOR_OPTIONS}
                    disabled={disabled}
                    onChange={val => {
                        if (val) editor.chain().focus().setHighlight({ color: val }).run();
                        else editor.chain().focus().unsetHighlight().run();
                    }}
                />
            </div>
        </div>
        {linkOpen && <div className="flex flex-wrap gap-2 border-b border-neutral-200 p-3"><input aria-label="Link URL" value={link} onChange={event => setLink(event.target.value)} placeholder="https://example.com" className="min-w-0 flex-1 rounded-lg border border-black px-3 py-2 text-sm" onKeyDown={event => { if (event.key === 'Escape') setLinkOpen(false); }} /><button type="button" className="rounded-lg border border-black bg-[#a2ff86] px-3 text-xs font-bold" onClick={() => { const href = safeLink(link); if (!href) { setLinkError('Enter a valid http, https, email, or phone link.'); return; } editor.chain().focus().extendMarkRange('link').setLink({ href }).run(); setLinkOpen(false); }}>Apply link</button><button type="button" className="text-xs font-bold" onClick={() => setLinkOpen(false)}>Cancel</button>{linkError && <p role="alert" className="w-full text-xs text-red-700">{linkError}</p>}</div>}
        <EditorContent editor={editor} className={editor.isEmpty ? 'is-empty' : ''} />
    </div>;
}
