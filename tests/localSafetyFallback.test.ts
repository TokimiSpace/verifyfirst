import { describe, expect, it } from 'vitest';
import { buildLocalSafetyFallback } from '../services/localSafetyFallback';

describe('on-device consumer safety fallback', () => {
  it('keeps recovery guidance available without claiming external verification', () => {
    const result = buildLocalSafetyFallback(
      '訂單異常，請立即點擊 https://example.test 並付款解凍',
      'SMS_TEXT',
      'zh-TW',
    );

    expect(result.source).toBe('local');
    expect(result.degradation?.level).toBe('L5');
    expect(result.agentVerification.status).toBe('NOT_RUN');
    expect(result.finalVerdict).toBe('C_SUSPICIOUS_NEEDS_VERIFICATION');
    expect(result.conclusion).toContain('不是已查證結論');
    expect(result.riskSignals.map(signal => signal.type)).toEqual(expect.arrayContaining([
      'PRESSURE_TACTICS',
      'PHISHING_URL',
      'SUSPICIOUS_PAYMENT',
      'INSUFFICIENT_DATA',
    ]));
  });

  it('does not label neutral text safe when evidence services are unavailable', () => {
    const result = buildLocalSafetyFallback('明天下午三點開會', 'SMS_TEXT', 'zh-TW');

    expect(result.finalVerdict).toBe('C_SUSPICIOUS_NEEDS_VERIFICATION');
    expect(result.riskSignals).toHaveLength(1);
    expect(result.riskSignals[0].type).toBe('INSUFFICIENT_DATA');
    expect(result.conclusion).toContain('無法確認內容真偽');
  });

  it('provides Vietnamese copy without changing the trust boundary', () => {
    const result = buildLocalSafetyFallback('Khẩn cấp, chuyển tiền ngay', 'SMS_TEXT', 'vi');

    expect(result.conclusion).toContain('không phải kết luận đã xác minh');
    expect(result.source).toBe('local');
  });
});
