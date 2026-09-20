import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setPendingTermAgreement } from '../../constants/termsAgreementState';

export default function TermsPrivacyScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string | string[] }>();

  const handleAgree = () => {
    const source = Array.isArray(from) ? from[0] : from;
    if (source === 'signup') {
      setPendingTermAgreement('privacy');
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보 처리방침</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 제목 */}
        <Text style={styles.h1}>요잘알 개인정보 처리방침</Text>
        <Text style={styles.meta}>
          시행일: 2026년 5월 8일 · 최종 개정일: 2026년 5월 8일 · 앱 버전: 1.1.2
        </Text>

        <Text style={styles.p}>
          트웬티식스(이하 "회사")는 「개인정보 보호법」 등 관련 법령에 따라 이용자의 개인정보를
          적법하게 수집·이용·보관·파기하고 있으며, 아래와 같이 처리 기준을 명시합니다.
        </Text>

        {/* 1. 수집 항목 및 이용 목적 */}
        <Text style={styles.h2}>1. 수집 항목 및 이용 목적</Text>
        <Table
          headers={['이용 목적', '수집 항목', '보유 기간']}
          flexes={[1.1, 1.6, 1]}
          rows={[
            ['회원가입·계정 관리', '이메일, 닉네임, 프로필 사진, 성별(선택)', '탈퇴 시까지'],
            ['소셜 로그인', '소셜 계정 고유 식별자(Google/Apple/Kakao UID), 이름, 이메일, 프로필 사진', '탈퇴 시까지'],
            ['서비스 제공 (레시피·커뮤니티)', '작성한 레시피, 리뷰, 평점, 게시글, 댓글, 좋아요, 북마크', '탈퇴 시까지'],
            ['푸시 알림', 'FCM 디바이스 토큰', '탈퇴 또는 알림 해제 시까지'],
            ['프리미엄 구독 결제', '구매 영수증(Apple/Google), 거래 ID, 구독 상태', '결제 후 5년 (전자상거래법)'],
            ['기프티콘 교환·발송', '수신자 휴대폰 번호, 주문·교환 내역', '거래 완료 후 5년 (전자상거래법)'],
            ['광고 제공 및 부정행위 방지', '광고 식별자(IDFA/GAID), 기기 고유번호, OS 버전, 앱 버전', '수집 후 1년'],
            ['서비스 개선·문의 응대', '접속 로그, IP 주소, 쿠키, 문의 내용', '수집 후 1년 (문의기록 3년)'],
          ]}
        />
        <Text style={styles.p}>
          <Text style={styles.bold}>
            민감정보(사상·신념·건강·유전 등) 및 고유식별정보(주민등록번호·여권번호 등)를 일절 수집하지 않습니다.
          </Text>
        </Text>
        <Text style={styles.p}>
          필수 수집 항목에 동의하지 않을 경우 서비스 이용이 제한될 수 있습니다.
          선택 항목(마케팅 수신 등)은 동의하지 않아도 서비스 이용에 영향이 없습니다.
        </Text>

        {/* 2. 보유 및 이용 기간 */}
        <Text style={styles.h2}>2. 보유 및 이용 기간</Text>
        <Text style={styles.p}>
          원칙적으로 개인정보는 수집 목적이 달성되면 지체 없이 파기합니다.
          단, 아래 법령이 정하는 경우 해당 기간 동안 보관 후 파기합니다.
        </Text>
        <Table
          headers={['법령', '내용', '보관 기간']}
          flexes={[1, 1.6, 0.7]}
          rows={[
            ['전자상거래법', '계약·청약철회 기록', '5년'],
            ['전자상거래법', '대금결제·재화공급 기록', '5년'],
            ['전자상거래법', '소비자 불만·분쟁처리 기록', '3년'],
            ['통신비밀보호법', '접속 로그, IP 주소', '3개월'],
            ['부가가치세법', '세금계산서 등 장부·증빙', '5년'],
          ]}
        />

        {/* 3. 만 14세 미만 아동 */}
        <Text style={styles.h2}>3. 만 14세 미만 아동의 개인정보</Text>
        <Text style={styles.p}>
          회사는 「개인정보 보호법」 제22조의2에 따라 만 14세 미만 아동의 회원가입을 원칙적으로
          제한합니다. 불가피하게 만 14세 미만의 개인정보를 처리해야 하는 경우,
          <Text style={styles.bold}> 법정대리인의 동의</Text>를 받아 처리하며,
          동의 확인 방법으로 법정대리인의 성명·연락처 수집 및 휴대폰 본인인증을 사용합니다.
        </Text>

        {/* 4. 자동 수집 정보 */}
        <Text style={styles.h2}>4. 자동으로 수집되는 정보</Text>
        <Text style={styles.p}>서비스 이용 과정에서 아래 정보가 자동으로 생성·수집될 수 있습니다.</Text>
        <Bullets
          items={[
            '광고 식별자(IDFA/GAID) — 맞춤형 광고 제공',
            '쿠키·세션 — 로그인 상태 유지',
            '접속 IP, 기기 모델, OS 버전, 앱 버전 — 부정이용 방지·장애 대응',
          ]}
        />
        <Text style={styles.p}>
          <Text style={styles.bold}>거부 방법</Text>: iOS는 [설정 {'>'} 개인정보 보호 및 보안
          {' > '}추적 {'>'} 앱이 추적 요청하도록 허용]에서, Android는 [설정 {'>'} Google {'>'} 광고
          {' > '}광고 ID 재설정/삭제]에서 광고 식별자 사용을 거부할 수 있습니다.
          거부 시 일부 맞춤형 기능이 제한될 수 있습니다.
        </Text>

        {/* 5. 제3자 제공 */}
        <Text style={styles.h2}>5. 개인정보의 제3자 제공</Text>
        <Text style={styles.p}>
          회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
        </Text>
        <Bullets
          items={[
            '이용자가 사전에 동의한 경우',
            '법령의 규정에 의하거나, 수사기관이 법령에 정한 절차와 방법에 따라 요구하는 경우',
            '기프티콘 교환 시 ㈜케이티알파(기프티쇼)에 거래 식별 정보(거래 ID) 제공 — 개인식별정보 비포함',
          ]}
        />

        {/* 6. 위탁 */}
        <Text style={styles.h2}>6. 개인정보 처리 위탁</Text>
        <Text style={styles.p}>
          회사는 서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁하며, 수탁자가 개인정보 보호 법규를
          준수하도록 관리·감독하고 있습니다.
        </Text>
        <Table
          headers={['수탁자', '세부', '위탁 업무']}
          flexes={[1.2, 1.3, 1.6]}
          rows={[
            ['Google LLC', 'Firebase, Cloud Run, AdMob, FCM', '인증, 데이터베이스, 호스팅, 광고, 푸시 알림'],
            ['Apple Inc.', '-', 'Apple 로그인, 인앱 결제 처리'],
            ['㈜카카오', '-', '카카오 로그인 인증'],
            ['㈜케이티알파', '기프티쇼', '기프티콘 발행 (앱 내 수령)'],
            ['㈜솔라피', 'Solapi', '기프티콘 수령 안내용 카카오 알림톡 발송'],
            ['RevenueCat, Inc.', '미국', '구독 결제 영수증 검증, 구독 상태 관리'],
          ]}
        />

        {/* 7. 국외 이전 */}
        <Text style={styles.h2}>7. 개인정보의 국외 이전</Text>
        <Text style={styles.p}>회사는 서비스 제공을 위해 아래와 같이 개인정보를 국외로 이전하고 있습니다.</Text>
        <Table
          headers={['수탁자', '국가', '항목', '목적', '보유기간']}
          flexes={[1.2, 0.6, 1.4, 1.2, 1]}
          rows={[
            ['Google LLC', '미국', '계정정보, 서비스 이용기록, 광고 식별자', '클라우드 호스팅·광고', '위탁 종료 시까지'],
            ['Apple Inc.', '미국', '계정 식별자, 구매 영수증', '로그인·결제 처리', '위탁 종료 시까지'],
            ['RevenueCat, Inc.', '미국', '구매 영수증, 구독 식별자', '구독 결제 영수증 검증·구독 상태 관리', '위탁 종료 시까지'],
          ]}
        />
        <Text style={styles.p}>
          이용자는 이전을 거부할 수 있으며, 거부 시 서비스 이용이 제한될 수 있습니다.
          이전은 네트워크 전송(HTTPS/TLS)을 통해 실시간 또는 수시로 이루어집니다.
        </Text>

        {/* 8. 파기 */}
        <Text style={styles.h2}>8. 개인정보 파기 절차 및 방법</Text>
        <Numbered
          items={[
            '회원 탈퇴 시 이름·이메일·전화번호·프로필 사진 등 개인 식별정보는 즉시 익명 처리(복구 불가)됩니다.',
            '분쟁 해결 및 법정 보존 의무(전자상거래법상 결제·분쟁 기록 5년 등)를 위해 관련 기록은 익명화된 상태로 해당 기간 동안 보관 후 파기합니다.',
            '전자적 파일은 복구 및 재생이 불가능한 기술적 방법으로 완전 삭제하며, 출력물은 분쇄 또는 소각합니다.',
            '법령에 따라 별도 보관되는 정보는 보관 목적 외의 다른 목적으로 이용하지 않습니다.',
          ]}
        />
        <Text style={styles.p}>
          <Text style={styles.bold}>공개 콘텐츠 처리</Text>: 회원이 작성한 레시피·후기·댓글 등 다른 이용자에게
          공개된 콘텐츠는 기본적으로 "탈퇴한 사용자" 표기로 익명화되어 서비스에 계속 게시됩니다.
          이는 다른 이용자의 참고·열람 권리 보호와 서비스 품질 유지를 위함입니다.
        </Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>완전 삭제 옵션</Text>: 회원 탈퇴 화면에서 "내가 작성한 게시물도 함께 삭제"를
          선택하면 본인이 작성한 공개 콘텐츠도 즉시 삭제됩니다 (복구 불가). 탈퇴 후에도 완전 삭제를 원하는
          경우 고객센터(앱 내 프로필 {'>'} 고객센터 {'>'} 문의하기)를 통해 요청할 수 있으며, 본인 확인
          후 10일 이내 처리됩니다.
        </Text>

        {/* 9. 이용자 권리 */}
        <Text style={styles.h2}>9. 이용자의 권리</Text>
        <Text style={styles.p}>
          이용자는 언제든지 아래의 권리를 행사할 수 있으며, 요청 시 회사는
          <Text style={styles.bold}> 지체 없이(최대 10일 이내)</Text> 조치합니다.
        </Text>
        <Bullets
          items={[
            '개인정보 열람 요구',
            '개인정보 정정·삭제 요구',
            '개인정보 처리정지 요구',
            '동의 철회 및 회원 탈퇴',
          ]}
        />
        <Text style={styles.p}>
          권리 행사는 앱 내 [설정 {'>'} 계정 관리] 또는 고객센터(앱 내 프로필 {'>'} 고객센터 {'>'} 문의하기)를
          통해 가능하며, 법정대리인을 통해 대리 행사할 수도 있습니다.
        </Text>

        {/* 10. 안전성 */}
        <Text style={styles.h2}>10. 개인정보 안전성 확보 조치</Text>
        <Bullets
          items={[
            '암호화 — 비밀번호는 단방향 해시(bcrypt)로 저장하며, 통신 구간은 HTTPS/TLS로 암호화합니다.',
            '접근 통제 — 개인정보 처리 시스템은 최소 인원에게만 권한을 부여하며, 접근 기록을 남겨 정기적으로 점검합니다.',
            '해킹 방지 — 방화벽, 이상 접근 탐지, 취약점 점검을 정기 실시하며, 보안 패치를 즉시 적용합니다.',
            '백업·복구 — 데이터 손실에 대비해 정기 백업을 수행합니다.',
          ]}
        />

        {/* 11. 책임자 */}
        <Text style={styles.h2}>11. 개인정보 보호책임자</Text>
        <Text style={styles.p}>개인정보 처리에 관한 문의, 불만, 피해 구제 등은 아래로 연락해 주시기 바랍니다.</Text>
        <View style={styles.contactBox}>
          <Text style={styles.contactHeading}>사업자 정보</Text>
          <ContactLine label="상호" value="트웬티식스(TwentyVI)" />
          <ContactLine label="대표자" value="우동엽" />
          <ContactLine label="사업자등록번호" value="471-16-02759" />
          <ContactLine label="사업장 소재지" value="경기도 이천시 증신로291번길 119-3, 302호" />
          <ContactLine label="이메일" value="twentyvi@naver.com" />
          <ContactLine label="고객센터" value="앱 내 프로필 > 고객센터 > 문의하기" />
        </View>

        {/* 12. 권리 구제 */}
        <Text style={styles.h2}>12. 권리 구제 방법</Text>
        <Text style={styles.p}>개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의할 수 있습니다.</Text>
        <Bullets
          items={[
            '개인정보 분쟁조정위원회 — www.kopico.go.kr / 1833-6972',
            '개인정보 침해신고센터 — privacy.kisa.or.kr / 국번없이 118',
            '대검찰청 사이버수사과 — www.spo.go.kr / 국번없이 1301',
            '경찰청 사이버수사국 — ecrm.police.go.kr / 국번없이 182',
          ]}
        />

        {/* 13. 변경 */}
        <Text style={styles.h2}>13. 처리방침 변경</Text>
        <Text style={styles.p}>
          본 처리방침은 법령·정책·보안 기술 변경에 따라 개정될 수 있으며, 개정 시 시행일
          <Text style={styles.bold}> 7일 전</Text>(이용자에게 불리한 중대 변경의 경우
          <Text style={styles.bold}> 30일 전</Text>)부터 앱 내 공지사항을 통해 안내합니다.
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            공고일자: 2026년 5월 8일 · 시행일자: 2026년 5월 8일
          </Text>
          <Text style={styles.footerText}>© 2026 TwentyVI. All rights reserved.</Text>
          <Text style={styles.footerText}>본 개인정보 처리방침은 요잘알 앱에 적용됩니다.</Text>
        </View>
      </ScrollView>

      {/* 하단 동의 버튼 */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.agreeButton}
          onPress={handleAgree}
          activeOpacity={0.85}
        >
          <Text style={styles.agreeButtonText}>동의</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ────────── 공통 컴포넌트 ──────────

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.listWrap}>
      {items.map((t, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.listText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Numbered({ items }: { items: string[] }) {
  return (
    <View style={styles.listWrap}>
      {items.map((t, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={styles.numberMarker}>{i + 1}.</Text>
          <Text style={styles.listText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Table({
  headers,
  rows,
  flexes,
}: {
  headers: string[];
  rows: string[][];
  flexes?: number[];
}) {
  const flexArr = flexes || headers.map(() => 1);
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        {headers.map((h, i) => (
          <View
            key={i}
            style={[
              styles.tableCell,
              styles.tableHeaderCell,
              { flex: flexArr[i] },
              i < headers.length - 1 && styles.tableCellBorderRight,
            ]}
          >
            <Text style={styles.tableHeaderText}>{h}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[styles.tableRow, ri < rows.length - 1 && styles.tableRowBorderBottom]}>
          {row.map((cell, ci) => (
            <View
              key={ci}
              style={[
                styles.tableCell,
                { flex: flexArr[ci] },
                ci < row.length - 1 && styles.tableCellBorderRight,
              ]}
            >
              <Text style={styles.tableBodyText}>{cell}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ContactLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.contactLine}>
      <Text style={styles.contactLabel}>{label}: </Text>
      <Text style={styles.contactValue}>{value}</Text>
    </Text>
  );
}

// ────────── 스타일 (웹 버전과 시각 일치) ──────────
// 웹 BASE_STYLE 참고:
//   body: max-width 760px, padding 24px, line-height 1.7, color #1A1A1A
//   h1: 24px, border-bottom 2px #0B9A61
//   h2: 18px, color #0B9A61, margin-top 32px
//   table: border #E0E0E0, th bg #F7FAF8
//   contact: bg #F7FAF8, padding 16px, border-radius 8px

const ACCENT = '#0B9A61';
const TEXT = '#1A1A1A';
const META = '#666666';
const BORDER = '#E0E0E0';
const TABLE_HEADER_BG = '#F7FAF8';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
  },

  h1: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT,
    paddingBottom: 8,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  meta: {
    color: META,
    fontSize: 13,
    marginBottom: 20,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: ACCENT,
    marginTop: 32,
    marginBottom: 12,
  },
  p: {
    fontSize: 14,
    color: TEXT,
    lineHeight: 24,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
  },

  // 리스트
  listWrap: {
    marginLeft: 6,
    marginBottom: 12,
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 24,
    color: TEXT,
    width: 12,
    textAlign: 'center',
  },
  numberMarker: {
    fontSize: 14,
    lineHeight: 24,
    color: TEXT,
    fontWeight: '700',
    width: 18,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    lineHeight: 24,
  },

  // 표 (웹 BASE_STYLE 의 table)
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    marginVertical: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeaderRow: {
    backgroundColor: TABLE_HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    paddingVertical: 10,
  },
  tableCellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  tableBodyText: {
    fontSize: 13,
    color: TEXT,
    lineHeight: 19,
  },

  // 사업자 정보 박스 (웹의 .contact)
  contactBox: {
    backgroundColor: TABLE_HEADER_BG,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  contactHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 8,
  },
  contactLine: {
    fontSize: 13,
    lineHeight: 22,
    color: TEXT,
  },
  contactLabel: {
    fontWeight: '600',
    color: TEXT,
  },
  contactValue: {
    color: TEXT,
  },

  // 푸터 (웹의 footer)
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    color: '#9E9E9E',
    fontSize: 12,
    textAlign: 'center',
  },

  // 하단 동의 버튼
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  agreeButton: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  agreeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
