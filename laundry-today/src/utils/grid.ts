import gridData from '../data/grid.json';

/**
 * 기상청 격자 매핑표(활용가이드 격자_위경도 엑셀 → scripts/build-grid.py → src/data/grid.json).
 * rows: [행정구역코드, 시도인덱스, 시군구, 읍면동, nx, ny] — 시군구/읍면동이 빈 문자열이면 상위 대표 격자.
 */
type GridRow = [string, number, string, string, number, number];

interface GridData {
  version: string;
  sido: string[];
  rows: GridRow[];
}

const grid = gridData as unknown as GridData;

export interface RegionOption {
  code: string;
  sido: string;
  sgg: string;
  dong: string;
  /** "서울특별시 종로구 청운효자동" */
  label: string;
  nx: number;
  ny: number;
}

/** 격자 매핑 대상이 아닌 1단계 항목 (해상 관측 지점) */
const EXCLUDED_SIDO = new Set(['이어도']);

function toOption([code, sidoIdx, sgg, dong, nx, ny]: GridRow): RegionOption {
  const sido = grid.sido[sidoIdx];
  // 세종처럼 2단계가 1단계와 같은 이름이면 라벨에서 한 번만 보여준다
  const parts = [sido, sgg === sido ? '' : sgg, dong].filter(Boolean);
  return { code, sido, sgg, dong, label: parts.join(' '), nx, ny };
}

const DONG_OPTIONS: RegionOption[] = grid.rows
  .filter((row) => row[3] !== '' && !EXCLUDED_SIDO.has(grid.sido[row[1]]))
  .map(toOption);

/**
 * 검색용 정규화: 공백 제거 + 숫자 앞 "제" 제거.
 * 매핑표는 행정 표기("우제1동")를 쓰는데 사람들은 보통 "우1동"으로 검색하기 때문.
 */
const normalize = (s: string) => s.replace(/\s+/g, '').replace(/제(?=\d)/g, '');

/**
 * 동네 검색. 공백으로 나눈 검색어가 모두 "시도 시군구 동" 라벨에 포함된 읍·면·동을 돌려준다.
 * 예) "해운대" → 해운대구의 모든 동, "종로 청운" → 청운효자동
 */
export function searchRegions(query: string, limit = 60): RegionOption[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean).map(normalize);
  if (tokens.length === 0) return [];
  const result: RegionOption[] = [];
  for (const option of DONG_OPTIONS) {
    const haystack = normalize(option.label);
    if (tokens.every((t) => haystack.includes(t))) {
      result.push(option);
      if (result.length >= limit) break;
    }
  }
  return result;
}

/**
 * 동네 → 격자. 동이 매핑표에 없으면 같은 시/군/구의 대표 격자, 그것도 없으면 시/도 대표 격자.
 */
export function resolveGrid(sido: string, sgg: string, dong: string): { nx: number; ny: number } | null {
  const sidoIdx = grid.sido.indexOf(sido);
  if (sidoIdx < 0) return null;
  const candidates = grid.rows.filter((r) => r[1] === sidoIdx);
  const exact = candidates.find((r) => r[2] === sgg && r[3] === dong);
  const sggRow = candidates.find((r) => r[2] === sgg && r[3] === '');
  const sidoRow = candidates.find((r) => r[2] === '' && r[3] === '');
  const row = exact ?? sggRow ?? sidoRow;
  return row ? { nx: row[4], ny: row[5] } : null;
}

export const GRID_VERSION = grid.version;
