export interface TextBoxStyles {
    fontSize: number;
    fontWeight: 'normal' | 'bold' | string;
    fontFamily?: string;
}

/** Returns true when `text` fits within width×height using the editor’s wrap rules. */
export function textFitsInBox(
    text: string,
    styles: TextBoxStyles,
    width: number,
    height: number,
): boolean {
    if (typeof document === 'undefined') return true;
    if (!text) return true;

    const fontFamily =
        styles.fontFamily ||
        getComputedStyle(document.documentElement).getPropertyValue('--font-heading').trim() ||
        'sans-serif';

    const el = document.createElement('div');
    el.style.cssText = [
        'position:absolute',
        'visibility:hidden',
        'pointer-events:none',
        'left:-99999px',
        'top:0',
        `width:${Math.max(0, width)}px`,
        'height:auto',
        'box-sizing:border-box',
        'padding:0 0.25rem',
        'white-space:normal',
        'word-break:break-word',
        'line-height:1.2',
        `font-size:${styles.fontSize}px`,
        `font-weight:${styles.fontWeight}`,
        `font-family:${fontFamily}`,
    ].join(';');
    el.textContent = text;
    document.body.appendChild(el);
    const fits = el.scrollHeight <= height + 0.5;
    document.body.removeChild(el);
    return fits;
}
