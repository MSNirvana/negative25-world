import { describe, expect, it } from 'vitest';
import { getLocale, setLocale, t } from './i18n';

describe('locale', () => {
  it('defaults to Simplified Chinese', () => {
    setLocale('zh');
    expect(getLocale()).toBe('zh');
    expect(t('gallery.featured')).toBe('精选');
  });

  it('switches translations and interpolates values', () => {
    setLocale('en');
    expect(t('gallery.featured')).toBe('Featured');
    expect(t('gallery.region')).toBe('Region');
    expect(t('gallery.count', { count: 3 })).toBe('3 photographs');
    setLocale('zh');
    expect(t('gallery.region')).toBe('地区');
    expect(t('gallery.count', { count: 3 })).toBe('3 张照片');
  });

  it('falls back to the key for missing translations', () => {
    expect(t('missing.translation.key')).toBe('missing.translation.key');
  });
});
