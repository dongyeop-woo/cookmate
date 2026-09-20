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

export default function TermsServiceScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string | string[] }>();

  const handleAgree = () => {
    const source = Array.isArray(from) ? from[0] : from;
    if (source === 'signup') {
      setPendingTermAgreement('service');
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
        <Text style={styles.headerTitle}>이용약관</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 제목 */}
        <Text style={styles.h1}>요잘알 서비스 이용 약관</Text>
        <Text style={styles.meta}>
          시행일: 2026년 5월 8일 · 최종 개정일: 2026년 5월 8일 · 앱 버전: 1.1.2
        </Text>

        <Text style={styles.p}>
          본 약관은 요잘알 앱에서 제공하는 서비스 이용 조건과 권리·의무를 규정합니다.
          가입 전 반드시 아래 내용을 확인해 주세요.
        </Text>

        {/* 1. 이용 약관 */}
        <Text style={styles.h2}>1. 이용 약관</Text>
        <Numbered
          items={[
            <Text key="1-1">본 앱은 요리 레시피 탐색, 단계별 요리 모드, 커뮤니티 레시피 공유, 포인트·기프티콘 교환 서비스를 제공하는 <Text style={styles.bold}>전체이용가</Text> 모바일 애플리케이션입니다.</Text>,
            <Text key="1-2">앱 사용 중 버그를 악용하거나 비정상적인 방법으로 서비스를 이용하는 행위는 <Text style={styles.danger}>즉시 이용 정지 및 영구 제재</Text> 대상이 됩니다.</Text>,
            '사용자가 작성한 레시피, 댓글, 리뷰, 이미지 등 모든 콘텐츠에 대한 법적 책임은 전적으로 작성자 본인에게 있으며, 제3자의 권리를 침해하는 콘텐츠로 인한 민·형사상 책임은 작성자가 부담합니다.',
            '타인의 레시피, 사진, 영상 등을 허가 없이 복제, 배포, 상업적으로 이용하는 행위는 저작권법에 의해 금지되며, 위반 시 법적 책임을 질 수 있습니다.',
            <Text key="1-5">커뮤니티 내 욕설, 비방, 명예훼손, 음란물, 광고, 허위 정보, 개인정보 유출 등의 게시물은 <Text style={styles.danger}>사전 경고 없이 즉시 삭제</Text>되며, 작성자에 대해 이용 제한 또는 영구 차단 조치가 취해질 수 있습니다.</Text>,
            '서비스 내용, 운영 정책, 약관은 관련 법령 또는 서비스 운영상의 필요에 따라 사전 공지 후 변경될 수 있으며, 변경 사항은 앱 내 공지사항을 통해 최소 7일 전에 안내됩니다. 중대한 변경의 경우 30일 전에 공지합니다.',
            '본 약관에 동의하지 않을 경우 서비스 이용이 제한되며, 이미 가입한 경우 탈퇴를 통해 동의를 철회할 수 있습니다.',
          ]}
        />

        {/* 2. 회원가입 및 자격 */}
        <Text style={styles.h2}>2. 회원가입 및 자격</Text>
        <Numbered
          items={[
            <Text key="2-1">본 서비스는 전체이용가이나, 「개인정보 보호법」에 따라 계정 생성은 <Text style={styles.bold}>만 14세 이상</Text>만 가능합니다. 만 14세 미만은 법정대리인의 동의 절차를 거쳐 이용할 수 있습니다.</Text>,
            '유료 결제(프리미엄 구독, 기프티콘 교환 등)는 만 19세 이상이거나, 미성년자의 경우 법정대리인의 동의가 있어야 합니다. 법정대리인 동의 없이 이루어진 결제는 관련 법령에 따라 취소될 수 있습니다.',
            <Text key="2-3">가입 시 허위 정보(타인의 명의, 허위 이메일, 허위 연령 등)를 제공한 계정은 <Text style={styles.danger}>발견 즉시 이용이 제한</Text>되며, 이로 인한 모든 불이익은 본인이 부담합니다.</Text>,
          ]}
        />

        {/* 3. 계정 관리 */}
        <Text style={styles.h2}>3. 계정 관리</Text>
        <Numbered
          items={[
            '계정은 본인만 사용할 수 있으며, 타인에게 양도, 대여, 공유하는 행위는 금지됩니다. 이를 위반하여 발생하는 모든 문제에 대한 책임은 계정 소유자에게 있습니다.',
            '계정의 비밀번호 및 인증 정보의 관리 책임은 사용자 본인에게 있으며, 관리 소홀로 발생하는 손해에 대해 앱은 책임을 지지 않습니다.',
            '회원 탈퇴 시 개인정보는 「개인정보 보호법」에 따라 즉시 파기됩니다. 단, 관련 법령에 의해 보존이 필요한 정보는 해당 기간 동안 보관 후 파기합니다.',
            '부정 이용, 불법 행위, 약관 위반이 확인된 계정은 사전 통지 없이 이용이 제한되거나 삭제될 수 있습니다.',
          ]}
        />

        {/* 4. 지적재산권 */}
        <Text style={styles.h2}>4. 지적재산권</Text>
        <Numbered
          items={[
            '앱 내 로고, 아이콘, 디자인, UI/UX, 소스코드 등 모든 지적재산의 권리는 TwentyVI에 귀속되며, 무단 복제·배포·변형·상업적 이용 시 저작권법 및 관련 법률에 따라 민·형사상 책임을 질 수 있습니다.',
            '사용자가 업로드한 레시피, 사진, 텍스트 등의 콘텐츠에 대한 저작권은 작성자에게 있으나, 서비스 내 표시·홍보·개선 목적으로 앱이 이를 무상으로 사용할 수 있는 비독점적 라이선스를 부여한 것으로 봅니다.',
            '타인의 저작물을 무단으로 게시하는 경우 저작권법 제136조에 따라 5년 이하의 징역 또는 5천만원 이하의 벌금에 처해질 수 있으며, 이에 대한 모든 법적 책임은 게시자 본인에게 있습니다.',
          ]}
        />

        {/* 5. 면책 조항 */}
        <Text style={styles.h2}>5. 면책 조항</Text>
        <Numbered
          items={[
            <Text key="5-1">앱에 게시된 레시피의 정확성, 안전성, 적합성에 대해 앱은 보증하지 않습니다. 레시피 이용 중 발생하는 <Text style={styles.danger}>식품 안전 사고, 알레르기 반응, 건강 문제</Text> 등에 대해 앱은 일체의 법적 책임을 지지 않습니다.</Text>,
            'Google, 카카오 등 제3자 인증 서비스 이용 중 발생하는 개인정보 유출, 인증 오류 등의 문제는 해당 서비스 제공자의 이용약관 및 개인정보처리방침에 따르며, 앱은 이에 대해 책임을 지지 않습니다.',
            '천재지변, 서버 장애, 해킹, DDoS 공격, 정기 점검 등 불가항력적 사유로 인한 서비스 중단에 대해 앱은 책임을 지지 않습니다.',
            '사용자 간 거래, 분쟁, 개인 정보 교환 등으로 발생하는 문제에 대해 앱은 개입하거나 책임을 지지 않습니다.',
            '기프티콘 발행사, 결제 대행사, 광고 네트워크 등 제휴사의 서비스 중단·정책 변경·오류로 발생한 문제는 해당 제휴사의 정책에 따르며, 앱은 이를 중개한 범위 내에서 협조할 뿐 직접적인 법적 책임을 지지 않습니다.',
            <Text key="5-6">다음 행위는 금지되며, 적발 시 <Text style={styles.danger}>사전 통지 없이 영구 정지</Text> 및 민·형사상 조치가 취해질 수 있습니다.</Text>,
          ]}
        />
        <Bullets
          items={[
            '자동화 프로그램, 봇, 매크로, 크롤러 등을 이용한 서비스 접근',
            '역공학(Reverse Engineering), 앱 변조, 해킹 시도',
            '다중 계정 생성을 통한 포인트·혜택 중복 수령',
            '서버에 과도한 부하를 유발하는 비정상 API 호출',
          ]}
        />

        {/* 6. 포인트 정책 */}
        <Text style={styles.h2}>6. 포인트 정책</Text>
        <Numbered
          items={[
            '포인트는 출석체크, 후기 작성, 요리모드 완료 등 앱이 정한 활동을 통해 적립되며, 앱 내 기프티콘 교환 등 정해진 용도로만 사용할 수 있습니다.',
            <Text key="6-2">포인트는 <Text style={styles.bold}>현금으로 환불·양도되지 않으며</Text>, 계정 간 이전도 불가합니다.</Text>,
            <Text key="6-3"><Text style={styles.danger}>회원 탈퇴 시 잔여 포인트는 즉시 소멸</Text>되며, 복구되지 않습니다.</Text>,
            <Text key="6-4">부정한 방법(다중 계정, 자동화 프로그램, 허위 후기 등)으로 적립된 포인트는 사전 통지 없이 <Text style={styles.danger}>전액 회수</Text>되며, 해당 계정은 이용 제한될 수 있습니다.</Text>,
          ]}
        />

        {/* 7. 프리미엄 구독 */}
        <Text style={styles.h2}>7. 프리미엄 구독</Text>
        <Numbered
          items={[
            '프리미엄 구독은 광고 제거, 추가 기능 등 부가 혜택을 제공하는 유료 서비스이며, 결제는 Apple App Store 또는 Google Play 스토어를 통해 이루어집니다.',
            <Text key="7-2">구독은 <Text style={styles.danger}>자동 갱신</Text>되며, <Text style={styles.bold}>갱신 24시간 전까지</Text> 해지하지 않는 경우 기존 결제 수단으로 동일 금액이 재결제됩니다.</Text>,
            '구독 해지는 Apple App Store의 구독 관리 또는 Google Play 정기 결제 메뉴에서 직접 진행해야 하며, 앱 내에서는 해지가 불가능합니다. 해지 후에도 현재 결제 주기가 끝날 때까지는 혜택이 유지됩니다.',
            <Text key="7-4">무료체험이 제공되는 경우 기간과 조건은 Apple App Store / Google Play의 결제 화면에서 확인할 수 있으며, <Text style={styles.danger}>체험 기간 종료 전 해지하지 않으면 정상 요금이 자동 결제</Text>됩니다.</Text>,
            '결제 환불은 Apple 및 Google의 환불 정책에 따르며, 앱은 결제 처리의 대행자가 아니므로 환불·분쟁 조정은 각 스토어를 통해 진행해야 합니다. 단, 「전자상거래법」에 따른 청약철회가 가능한 경우에는 관련 법령을 우선 따릅니다.',
          ]}
        />

        {/* 8. 기프티콘 교환 */}
        <Text style={styles.h2}>8. 기프티콘 교환</Text>
        <Numbered
          items={[
            '포인트로 교환하는 기프티콘은 ㈜기프티쇼 등 제휴사를 통해 발행되며, 유효기간·사용처·환불 정책은 각 발행사의 정책에 따릅니다.',
            <Text key="8-2">교환한 기프티콘은 <Text style={styles.bold}>교환 후 3일 이내</Text>에만 환불 요청이 가능합니다. 환불 승인 시 결제한 포인트가 즉시 복원되며, 검토 후 <Text style={styles.bold}>영업일 기준 1일 이내</Text>(주말·공휴일 제외)에 처리됩니다.</Text>,
            <Text key="8-3">환불은 <Text style={styles.bold}>미사용·미발송 상태</Text>의 기프티콘에 한해 가능합니다. 이미 사용되었거나 발행사(기프티쇼)에서 취소 불가 상태로 전환된 기프티콘은 <Text style={styles.danger}>환불이 불가</Text>하며, 발송된 기프티콘의 분실·도용에 대한 책임은 수령자에게 있습니다.</Text>,
            <Text key="8-4">오발송, 누락, 발행 오류 등의 문제는 발송 후 <Text style={styles.bold}>7일 이내</Text> 고객센터로 접수한 경우에 한해 확인 후 재발송 또는 포인트 복원이 가능합니다.</Text>,
          ]}
        />

        {/* 9. 광고 및 제3자 서비스 */}
        <Text style={styles.h2}>9. 광고 및 제3자 서비스</Text>
        <Numbered
          items={[
            '앱은 서비스 운영을 위해 Google AdMob 등 제3자 광고 네트워크를 사용하며, 이 과정에서 광고 식별자(IDFA/GAID) 및 기기 정보가 수집될 수 있습니다. 자세한 내용은 개인정보 처리방침에서 확인할 수 있습니다.',
            '리워드형 광고를 시청한 경우, 광고 시청 완료 시 약속된 보상(포인트 등)이 지급됩니다. 단, 시청 중단·네트워크 오류 등으로 보상이 미지급된 경우 이후 재시도해야 합니다.',
            '프리미엄 구독 시 앱 내 광고가 제거되나, 제3자 링크·외부 브라우저로 이동한 이후의 광고는 제거 대상이 아닙니다.',
          ]}
        />

        {/* 10. 이용 제한 */}
        <Text style={styles.h2}>10. 이용 제한</Text>
        <Text style={styles.p}>
          앱은 사용자가 본 약관을 위반하거나 관련 법령을 위반하는 경우, 위반 정도에 따라 다음과 같이 단계적으로 이용을 제한할 수 있습니다.
        </Text>
        <Table
          headers={['단계', '대상 행위']}
          flexes={[1, 2.5]}
          rows={[
            ['경고', '경미한 도배, 부적절한 표현, 허위 후기 등'],
            ['7~30일 일시 정지', '반복적인 약관 위반, 광고성 게시물, 욕설·비방'],
            ['영구 정지', '타인 사칭, 계정 양도·매매, 포인트 어뷰징, 불법 콘텐츠 게시, 중대한 법령 위반'],
          ]}
        />
        <Numbered
          items={[
            '이용 제한이 부당하다고 판단하는 경우, 제한 안내일로부터 14일 이내에 고객센터로 이의제기할 수 있으며, 앱은 접수일로부터 7영업일 이내 검토 결과를 회신합니다.',
            <Text key="10-2">불법·선정성·허위 콘텐츠 신고가 접수된 게시물은 <Text style={styles.bold}>접수 후 24시간 이내</Text>(주말·공휴일 포함) 검토 후 필요 시 즉시 임시 비공개 처리되며, 48시간 이내 최종 조치 결과를 신고자에게 통지합니다. 명백한 불법(아동·청소년 성보호, 폭력·자해 조장, 범죄 모의 등)은 즉시 삭제 및 관계기관 신고 대상입니다.</Text>,
          ]}
        />

        {/* 11. 청약철회 및 환불 */}
        <Text style={styles.h2}>11. 청약철회 및 환불</Text>
        <Numbered
          items={[
            '유료 콘텐츠에 대한 청약철회는 「전자상거래 등에서의 소비자 보호에 관한 법률」에 따라 결제일로부터 7일 이내 가능합니다. 단, 이미 이용한 디지털 콘텐츠에 대해서는 관련 법령에 따라 청약철회가 제한될 수 있습니다.',
            '미성년자가 법정대리인의 동의 없이 결제한 경우, 법정대리인은 해당 결제를 취소할 수 있습니다. 이 경우 증빙자료 제출을 요구할 수 있습니다.',
            '환불 요청 및 결제 분쟁은 Apple App Store 또는 Google Play 스토어를 통해 접수해주시기 바라며, 결제 스토어를 통한 해결이 불가능한 경우 고객센터로 문의하시면 성실히 협의합니다.',
          ]}
        />

        {/* 12. 알림 및 광고성 정보 수신 */}
        <Text style={styles.h2}>12. 알림 및 광고성 정보 수신</Text>
        <Numbered
          items={[
            <Text key="12-1"><Text style={styles.bold}>거래 알림(기프티콘 발송, 포인트 변동, 환불 처리 등)</Text>은 서비스 제공에 필수적인 공지로, 카카오 알림톡·앱 푸시 등을 통해 발송됩니다. 회원가입 시 본 약관 동의로 수신에 동의한 것으로 간주되며, 수신 거부는 회원 탈퇴 또는 휴대폰 번호 변경을 통해 가능합니다.</Text>,
            <Text key="12-2">이벤트, 프로모션, 신규 기능 안내 등 <Text style={styles.bold}>광고성 정보 수신</Text>은 별도의 선택 동의를 받아 진행되며, 동의하지 않아도 서비스 이용에 제한은 없습니다.</Text>,
            '수신 동의 후에도 앱 설정 또는 고객센터를 통해 언제든지 수신 거부할 수 있으며, 거부 처리는 14일 이내 완료됩니다.',
          ]}
        />

        {/* 13. 손해배상 */}
        <Text style={styles.h2}>13. 손해배상</Text>
        <Numbered
          items={[
            '사용자가 본 약관을 위반하거나 불법 행위를 통해 앱 또는 제3자에게 손해를 끼친 경우, 해당 사용자는 이로 인한 모든 손해를 배상할 책임이 있습니다.',
            '사용자의 약관 위반으로 인해 앱이 제3자로부터 소송, 이의제기 등을 받게 될 경우, 해당 사용자는 자신의 비용과 책임으로 앱을 면책시켜야 합니다.',
          ]}
        />

        {/* 14. 분쟁 해결 */}
        <Text style={styles.h2}>14. 분쟁 해결</Text>
        <Numbered
          items={[
            '본 약관과 관련된 분쟁은 대한민국 법률을 준거법으로 하며, 영문·기타 언어 번역본과 원문(한국어)의 해석이 상충할 경우 한국어 원문을 우선합니다.',
            '서비스 이용과 관련하여 분쟁이 발생한 경우, 양 당사자는 원만한 해결을 위해 성실히 협의합니다.',
            '협의로 해결되지 않는 분쟁에 대한 소송의 관할 법원은 「민사소송법」이 정한 관할 법원으로 하며, 이용자의 주소지 또는 거소지를 관할하는 법원을 우선합니다.',
            '소비자 분쟁은 공정거래위원회 고시 「소비자분쟁해결기준」 및 한국소비자원의 분쟁조정 절차를 통해 해결할 수 있습니다.',
          ]}
        />

        {/* 15. 약관 개정 */}
        <Text style={styles.h2}>15. 약관 개정</Text>
        <Numbered
          items={[
            <Text key="15-1">앱은 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 시행일 및 개정 사유를 명시하여 현행 약관과 함께 앱 내 공지사항에 <Text style={styles.bold}>최소 7일 전</Text>(이용자에게 불리한 중대 개정의 경우 <Text style={styles.bold}>30일 전</Text>)부터 공지합니다.</Text>,
            '이용자가 개정 약관에 동의하지 않는 경우, 공지된 시행일 이전에 거부 의사를 통지하거나 회원 탈퇴를 할 수 있으며, 시행일까지 거부 의사를 표시하지 않은 경우 약관 개정에 동의한 것으로 간주됩니다.',
          ]}
        />

        {/* 16. 개인정보 보호 (NEW) */}
        <Text style={styles.h2}>16. 개인정보 보호</Text>
        <Text style={styles.p}>
          회사는 회원의 개인정보를 보호하기 위해 별도의 「개인정보 처리방침」을 수립·공개하며,
          본 약관과 함께 효력을 미칩니다. 개인정보의 수집·이용·보관·파기·제3자 제공 등 자세한 사항은
          앱 내 [설정 {'>'} 개인정보 처리방침] 또는 https://yojalal.com/privacy 에서 확인할 수 있습니다.
        </Text>

        {/* 17. 사업자 정보 */}
        <Text style={styles.h2}>17. 사업자 정보</Text>
        <View style={styles.contactBox}>
          <ContactLine label="상호" value="트웬티식스 (TwentyVI)" />
          <ContactLine label="대표자" value="우동엽" />
          <ContactLine label="사업자등록번호" value="471-16-02759" />
          <ContactLine label="통신판매업" value="신고 면제 대상 (간이과세자)" />
          <ContactLine label="사업장 소재지" value="경기도 이천시 증신로291번길 119-3, 302호" />
          <ContactLine label="이메일" value="twentyvi@naver.com" />
          <ContactLine label="고객센터" value="앱 내 프로필 > 고객센터 > 문의하기" />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            공고일자: 2026년 5월 8일 · 시행일자: 2026년 5월 8일
          </Text>
          <Text style={styles.footerText}>© 2026 TwentyVI. All rights reserved.</Text>
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

function Bullets({ items }: { items: React.ReactNode[] }) {
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

function Numbered({ items }: { items: React.ReactNode[] }) {
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

// ────────── 스타일 (privacy 와 일치) ──────────

const ACCENT = '#0B9A61';
const TEXT = '#1A1A1A';
const META = '#666666';
const BORDER = '#E0E0E0';
const TABLE_HEADER_BG = '#F7FAF8';
const DANGER = '#FF3B30';

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
  danger: {
    fontWeight: '700',
    color: DANGER,
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

  // 표
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

  // 사업자 정보 박스
  contactBox: {
    backgroundColor: TABLE_HEADER_BG,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
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

  // 푸터
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
