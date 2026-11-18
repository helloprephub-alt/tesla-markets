const TESLA_IMAGE_PROXY_VERSION = '20261118-2';

export function productAssetUrl(source?: string | null): string {
  if (!source) return '';
  if (/^https:\/\/digitalassets-shop\.tesla\.com\//i.test(source)) {
    return '/api/tesla-image?v=' + TESLA_IMAGE_PROXY_VERSION + '&url=' + encodeURIComponent(source);
  }
  return source;
}
