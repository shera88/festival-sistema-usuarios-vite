export function extractVimeoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function vimeoEmbedUrl(id: string, opts: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({
    autoplay: opts.autoplay ? '1' : '0',
    title: '0',
    byline: '0',
    portrait: '0',
    color: '00E5FF',
  });
  return `https://player.vimeo.com/video/${id}?${params}`;
}

export function vimeoThumbUrl(id: string): string {
  return `https://vumbnail.com/${id}.jpg`;
}
