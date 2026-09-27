import { CALC_BASIS_TEXT, HOLIDAY_SOURCE_TEXT, PRIVACY_POLICY_URL } from '../config/app';
import { openExternal } from '../utils/openExternal';

/**
 * 화면 맨 아래 안내. 공휴일을 쓰는 화면은 출처·계산 기준을 보여주고,
 * 모든 탭에 개인정보처리방침 링크를 둔다 (따로 설정 화면이 없어서 여기 둔다).
 */
export default function AppFooter({ holidaySource = true }: { holidaySource?: boolean }) {
  return (
    <footer className="app-footer">
      {holidaySource && (
        <>
          <p>{HOLIDAY_SOURCE_TEXT}</p>
          <p>{CALC_BASIS_TEXT}</p>
        </>
      )}
      <button type="button" className="app-footer-link" onClick={() => openExternal(PRIVACY_POLICY_URL)}>
        개인정보처리방침
      </button>
    </footer>
  );
}
