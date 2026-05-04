const apiPort = '8088';

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (typeof window === 'undefined' || window.location.port === apiPort) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.protocol}//${window.location.hostname}:${apiPort}${normalizedPath}`;
}
