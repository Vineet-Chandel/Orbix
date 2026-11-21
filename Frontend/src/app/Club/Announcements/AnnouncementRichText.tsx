import { createElement, type CSSProperties, type ReactNode } from 'react';
import { FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS, safeLink, type RichNode } from '../../../../../shared/announcements';
import './announcements.css';
function render(node: RichNode, key: number): ReactNode {
    let content: ReactNode = node.type === 'text' ? node.text : node.content?.map(render);
    if (node.type === 'text') {
        for (const [index, mark] of (node.marks || []).entries()) {
            const k = `${key}-${index}`;
            if (mark.type === 'bold') content = <strong key={k}>{content}</strong>;
            if (mark.type === 'italic') content = <em key={k}>{content}</em>;
            if (mark.type === 'underline') content = <u key={k}>{content}</u>;
            if (mark.type === 'strike') content = <s key={k}>{content}</s>;
            if (mark.type === 'code') content = <code key={k}>{content}</code>;
            if (mark.type === 'link') {
                const href = safeLink(mark.attrs?.href);
                if (href) content = <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">{content}</a>;
            }
            if (mark.type === 'textStyle') {
                const color = String(mark.attrs?.color || '');
                const size = String(mark.attrs?.fontSize || '');
                content = <span key={k} style={{ color: (TEXT_COLORS as readonly string[]).includes(color) ? color : undefined, fontSize: (FONT_SIZES as readonly string[]).includes(size) ? size : undefined }}>{content}</span>;
            }
            if (mark.type === 'highlight') {
                const color = String(mark.attrs?.color || HIGHLIGHT_COLORS[0]);
                content = <mark key={k} style={{ backgroundColor: (HIGHLIGHT_COLORS as readonly string[]).includes(color) ? color : HIGHLIGHT_COLORS[0] }}>{content}</mark>;
            }
        }
        return <span key={key}>{content}</span>;
    }
    const alignment = node.attrs?.textAlign;
    const style: CSSProperties | undefined = alignment === 'left' || alignment === 'center' || alignment === 'right' ? { textAlign: alignment } : undefined;
    switch (node.type) {
        case 'doc': return <div key={key}>{content}</div>;
        case 'paragraph': return <p key={key} style={style}>{content || <br />}</p>;
        case 'heading': return createElement(`h${[1, 2, 3].includes(Number(node.attrs?.level)) ? node.attrs!.level : 2}`, { key, style }, content);
        case 'bulletList': return <ul key={key}>{content}</ul>;
        case 'orderedList': return <ol key={key} start={Number(node.attrs?.start || 1)}>{content}</ol>;
        case 'listItem': return <li key={key}>{content}</li>;
        case 'blockquote': return <blockquote key={key}>{content}</blockquote>;
        case 'horizontalRule': return <hr key={key} />;
        case 'hardBreak': return <br key={key} />;
        case 'codeBlock': return <pre key={key}><code>{content}</code></pre>;
        default: return null;
    }
}
export function AnnouncementRichText({ content }: { content: RichNode }) {
    return <div className="announcement-richtext">{render(content, 0)}</div>;
}
