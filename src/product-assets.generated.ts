export function productAssetUrl(source?: string | null): string {
  if (!source) return '';
  if (/^https:\/\/digitalassets-shop\.tesla\.com\//i.test(source)) return '/api/tesla-image?url=' + encodeURIComponent(source);
  return source;
}
