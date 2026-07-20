// 移动端定位 — GPS获取与安全上下文降级
import { GeoResult } from '../types';

/**
 * 获取当前位置。
 * 非 HTTPS（且非 localhost）时 Geolocation API 被浏览器禁用，直接返回降级标记，
 * UI 据此提示"手动输入位置"或仅时间水印。
 */
export function getPosition(timeoutMs = 8000): Promise<GeoResult> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return Promise.resolve({ ok: false, latitude: null, longitude: null, reason: 'insecure' });
  }
  if (!('geolocation' in navigator)) {
    return Promise.resolve({ ok: false, latitude: null, longitude: null, reason: 'unsupported' });
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => resolve({
        ok: false,
        latitude: null,
        longitude: null,
        reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'timeout',
      }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

/** 定位失败原因的用户提示文案 */
export function geoFailureHint(reason?: GeoResult['reason']): string {
  switch (reason) {
    case 'insecure': return '当前为HTTP访问，浏览器已禁用定位。可手动填写位置，或部署HTTPS后使用GPS。';
    case 'denied': return '定位权限被拒绝，请在浏览器设置中允许定位，或手动填写位置。';
    case 'unsupported': return '当前浏览器不支持定位，可手动填写位置。';
    default: return '定位超时，可重试或手动填写位置。';
  }
}
