import { isIP } from 'node:net';

export function isSafeDeliveryUri(uri: string, allowMock = process.env.NODE_ENV === 'test'): boolean {
  let value: URL; try { value = new URL(uri); } catch { return false; }
  if (value.username || value.password) return false;
  if (value.protocol === 'managed:' && value.hostname === 'exports' && !value.search && !value.hash) { try { return !decodeURIComponent(value.pathname).split('/').includes('..'); } catch { return false; } }
  if (allowMock && value.protocol === 'mock:' && value.hostname === 'exports') return true;
  if (value.protocol !== 'https:') return false;
  const host = value.hostname.replace(/^\[|\]$/g, '').toLowerCase(); const ip = isIP(host);
  return host !== 'localhost' && !host.endsWith('.local') && !(ip === 4 && /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) && !(ip === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')));
}
