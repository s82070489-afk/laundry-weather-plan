"""기상청 단기예보 활용가이드의 격자_위경도 엑셀을 앱 내장용 JSON으로 변환한다.

사용법: python3 scripts/build-grid.py [엑셀경로]
  (기본 입력: data-src/kma-grid-2607.xlsx, 출력: src/data/grid.json)
필요 패키지: openpyxl (pip install openpyxl)

출력 형식 (용량을 줄이려고 튜플 배열):
  { "version": "2607", "sido": ["서울특별시", ...],
    "rows": [[행정구역코드, 시도인덱스, "시군구", "읍면동", nx, ny], ...] }
  - 시군구/읍면동이 빈 문자열이면 상위 단계의 대표 격자 행이다.
"""
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data-src' / 'kma-grid-2607.xlsx'
out = ROOT / 'src' / 'data' / 'grid.json'

wb = openpyxl.load_workbook(src, read_only=True)
ws = wb.active
header, *rows = list(ws.iter_rows(values_only=True))
col = {name: i for i, name in enumerate(header) if name}

sido_list: list[str] = []
out_rows = []
for r in rows:
    code = str(r[col['행정구역코드']] or '').strip()
    sido = str(r[col['1단계']] or '').strip()
    sgg = str(r[col['2단계']] or '').strip()
    dong = str(r[col['3단계']] or '').strip()
    if not code or not sido:
        continue
    nx, ny = int(r[col['격자 X']]), int(r[col['격자 Y']])
    if sido not in sido_list:
        sido_list.append(sido)
    out_rows.append([code, sido_list.index(sido), sgg, dong, nx, ny])

version = ''.join(ch for ch in src.stem if ch.isdigit())[-4:]
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(
    json.dumps({'version': version, 'sido': sido_list, 'rows': out_rows}, ensure_ascii=False, separators=(',', ':')),
    encoding='utf-8',
)
print(f'{len(out_rows)} rows, {len(sido_list)} sido -> {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)')
