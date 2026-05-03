export function svgToDataUri(svg: string): string {
  try {
    const encoded = window.btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encoded}`;
  } catch {
    return "";
  }
}
