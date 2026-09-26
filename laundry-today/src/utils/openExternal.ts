import { Device } from '@apps-in-toss/web-framework';

/** 외부 링크 열기. 토스 앱 밖(로컬 브라우저)에서는 새 창으로 연다. */
export function openExternal(url: string): void {
  try {
    Device.openURL(url).catch(() => window.open(url, '_blank', 'noopener'));
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
