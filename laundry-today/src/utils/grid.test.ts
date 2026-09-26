import { describe, expect, it } from 'vitest';
import { resolveGrid, searchRegions } from './grid';

describe('grid', () => {
  it('동 검색', () => {
    const r = searchRegions('종로 청운');
    expect(r[0]).toMatchObject({ label: '서울특별시 종로구 청운효자동', nx: 60, ny: 127 });
    expect(searchRegions('해운대').every((o) => o.sgg === '해운대구')).toBe(true);
    expect(searchRegions('')).toEqual([]);
  });

  it('세종은 시/도 이름을 두 번 쓰지 않는다', () => {
    expect(searchRegions('조치원')[0].label).toBe('세종특별자치시 조치원읍');
  });

  it('매핑이 안 되는 동은 같은 시/군/구 대표 격자로 대체', () => {
    expect(resolveGrid('서울특별시', '종로구', '청운효자동')).toEqual({ nx: 60, ny: 127 });
    expect(resolveGrid('서울특별시', '종로구', '없는동')).toEqual(resolveGrid('서울특별시', '종로구', ''));
    expect(resolveGrid('없는시', '', '')).toBeNull();
  });
});
