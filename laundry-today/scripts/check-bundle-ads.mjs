/**
 * 빌드 결과물(dist) 광고 ID 검사 — `npm run build`에서 vite build 직후, ait build 전에 실행된다.
 *   - 테스트 광고 ID 문자열이 하나라도 있으면 실패 (앱인토스 심사: 출시 번들에 테스트 광고 ID 불가)
 *   - src/config/app.ts의 라이브 광고 ID가 없으면 실패
 *
 *   node scripts/check-bundle-ads.mjs [검사할 폴더, 기본 dist]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_AD_ID = 'ait-ad-test-banner-id';
const distDir = join(ROOT, process.argv[2] ?? 'dist');

const appConfig = readFileSync(join(ROOT, 'src/config/app.ts'), 'utf8');
const liveAdId = appConfig.match(/LIVE_BANNER_AD_GROUP_ID\s*=\s*'([^']*)'/)?.[1]?.trim();

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

let files;
try {
  files = listFiles(distDir);
} catch {
  console.error(`✗ ${relative(ROOT, distDir)} 폴더가 없어요. vite build 후에 실행하세요.`);
  process.exit(1);
}

const withTestId = [];
const withLiveId = [];
for (const file of files) {
  const content = readFileSync(file, 'latin1');
  if (content.includes(TEST_AD_ID)) withTestId.push(relative(ROOT, file));
  if (liveAdId && content.includes(liveAdId)) withLiveId.push(relative(ROOT, file));
}

let failed = false;
if (withTestId.length) {
  failed = true;
  console.error(`✗ 테스트 광고 ID(${TEST_AD_ID})가 빌드 결과물에 있어요: ${withTestId.join(', ')}`);
} else {
  console.log(`✓ 테스트 광고 ID 없음 (${files.length}개 파일 검사)`);
}

if (!liveAdId) {
  failed = true;
  console.error('✗ src/config/app.ts의 LIVE_BANNER_AD_GROUP_ID가 비어 있어요.');
} else if (!withLiveId.length) {
  failed = true;
  console.error(`✗ 라이브 광고 ID(${liveAdId})가 빌드 결과물에 없어요.`);
} else {
  console.log(`✓ 라이브 광고 ID 있음 (${liveAdId}): ${withLiveId.join(', ')}`);
}

process.exit(failed ? 1 : 0);
