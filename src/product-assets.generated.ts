const TESLA_IMAGE_PROXY_VERSION = '20261118-3';

export function productAssetUrl(source?: string | null): string {
  if (!source) return '';
  const approvedImageSource =
    /^https:\/\/digitalassets-shop\.tesla\.(?:com|cn)\/image\/upload\//i.test(source) ||
    /^https:\/\/www\.eco-worthy\.com\/cdn\/shop\/files\//i.test(source);
  if (approvedImageSource) {
    return '/api/tesla-image?v=' + TESLA_IMAGE_PROXY_VERSION + '&url=' + encodeURIComponent(source);
  }
  return source;
}
