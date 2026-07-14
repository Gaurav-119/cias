import api from '../api/client';

export function fileApiPath(file) {
  if (file?.object_key) {
    return `/api/files/${file.object_key.split('/').map(encodeURIComponent).join('/')}`;
  }
  if (file?.url?.includes('/api/files/')) {
    try {
      const parsed = new URL(file.url, 'http://localhost');
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return file.url.startsWith('/') ? file.url : `/${file.url}`;
    }
  }
  return '';
}

export async function fetchFileBlobUrl(file) {
  const path = fileApiPath(file);
  if (!path) {
    throw new Error('File location unavailable');
  }
  const res = await api.get(path, { responseType: 'blob' });
  const mime = file.content_type || res.headers['content-type'] || 'application/octet-stream';
  const blob = res.data.type === mime
    ? res.data
    : new Blob([res.data], { type: mime });
  return URL.createObjectURL(blob);
}
