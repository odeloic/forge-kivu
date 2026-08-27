const LOCAL_PATH = /^\/(?![/\\])/

export const safeRedirect = (value: unknown, fallback = '/'): string =>
  typeof value === 'string' && LOCAL_PATH.test(value) ? value : fallback
