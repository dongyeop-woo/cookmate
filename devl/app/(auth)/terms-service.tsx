import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>이용약관</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Terms Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>요잘알 서비스 이용 약관</Text>

          <Text style={styles.sectionHeader}>이용 약관</Text>

          <Text style={styles.paragraph}>
            1. 본 앱은 요리 레시피 탐색, 단계별 요리 모드, 커뮤니티 레시피 공유를 위한 서비스입니다.
          </Text>

          <Text style={styles.paragraph}>
            2. 앱 사용 중 버그를 악용하거나 비정상적인 방법으로 서비스를 이용하는 행위는 <Text style={styles.redBold}>즉시 이용 정지 및 영구 제재</Text> 대상이 됩니다.
          </Text>

          <Text style={styles.paragraph}>
            3. 사용자가 작성한 레시피, 댓글, 리뷰, 이미지 등 모든 콘텐츠에 대한 법적 책임은 전적으로 작성자 본인에게 있으며, 제3자의 권리를 침해하는 콘텐츠로 인한 민·형사상 책임은 작성자가 부담합니다.
          </Text>

          <Text style={styles.paragraph}>
            4. 타인의 레시피, 사진, 영상 등을 허가 없이 복제, 배포, 상업적으로 이용하는 행위는 저작권법에 의해 금지되며, 위반 시 법적 책임을 질 수 있습니다.
          </Text>

          <Text style={styles.paragraph}>
            5. 커뮤니티 내 욕설, 비방, 명예훼손, 음란물, 광고, 허위 정보, 개인정보 유출 등의 게시물은 사전 경고 없이 즉시 삭제되며, 작성자에 대해 이용 제한 또는 영구 차단 조치가 취해질 수 있습니다.
          </Text>

          <Text style={styles.paragraph}>
            6. 서비스 내용, 운영 정책, 약관은 관련 법령 또는 서비스 운영상의 필요에 따라 사전 공지 후 변경될 수 있으며, 변경 사항은 앱 내 공지사항을 통해 최소 7일 전에 안내됩니다. 중대한 변경의 경우 30일 전에 공지합니다.
          </Text>

          <Text style={styles.paragraph}>
            7. 본 약관에 동의하지 않을 경우 서비스 이용이 제한되며, 이미 가입한 경우 탈퇴를 통해 동의를 철회할 수 있습니다.
          </Text>

          <Text style={styles.sectionHeader}>계정 관리</Text>

          <Text style={styles.paragraph}>
            1. 계정은 본인만 사용할 수 있으며, 타인에게 양도, 대여, 공유하는 행위는 금지됩니다. 이를 위반하여 발생하는 모든 문제에 대한 책임은 계정 소유자에게 있습니다.
          </Text>

          <Text style={styles.paragraph}>
            2. 계정의 비밀번호 및 인증 정보의 관리 책임은 사용자 본인에게 있으며, 관리 소홀로 발생하는 손해에 대해 앱은 책임을 지지 않습니다.
          </Text>

          <Text style={styles.paragraph}>
            3. 회원 탈퇴 시 개인정보는 「개인정보 보호법」에 따라 즉시 파기됩니다. 단, 관련 법령에 의해 보존이 필요한 정보는 해당 기간 동안 보관 후 파기합니다.
          </Text>

          <Text style={styles.paragraph}>
            4. 부정 이용, 불법 행위, 약관 위반이 확인된 계정은 사전 통지 없이 이용이 제한되거나 삭제될 수 있습니다.
          </Text>

          <Text style={styles.sectionHeader}>지적재산권</Text>

          <Text style={styles.paragraph}>
            1. 앱 내 로고, 아이콘, 디자인, UI/UX, 소스코드 등 모든 지적재산의 권리는 TwentyVI에 귀속되며, 무단 복제·배포·변형·상업적 이용 시 저작권법 및 관련 법률에 따라 민·형사상 책임을 질 수 있습니다.
          </Text>

          <Text style={styles.paragraph}>
            2. 사용자가 업로드한 레시피, 사진, 텍스트 등의 콘텐츠에 대한 저작권은 작성자에게 있으나, 서비스 내 표시·홍보·개선 목적으로 앱이 이를 무상으로 사용할 수 있는 비독점적 라이선스를 부여한 것으로 봅니다.
          </Text>

          <Text style={styles.paragraph}>
            3. 타인의 저작물을 무단으로 게시하는 경우 저작권법 제136조에 따라 5년 이하의 징역 또는 5천만원 이하의 벌금에 처해질 수 있으며, 이에 대한 모든 법적 책임은 게시자 본인에게 있습니다.
          </Text>

          <Text style={styles.sectionHeader}>면책 조항</Text>

          <Text style={styles.paragraph}>
            1. 앱에 게시된 레시피의 정확성, 안전성, 적합성에 대해 앱은 보증하지 않습니다. 레시피 이용 중 발생하는 식품 안전 사고, 알레르기 반응, 건강 문제 등에 대해 앱은 일체의 법적 책임을 지지 않습니다.
          </Text>

          <Text style={styles.paragraph}>
            2. Google, 카카오 등 제3자 인증 서비스 이용 중 발생하는 개인정보 유출, 인증 오류 등의 문제는 해당 서비스 제공자의 이용약관 및 개인정보처리방침에 따르며, 앱은 이에 대해 책임을 지지 않습니다.
          </Text>

          <Text style={styles.paragraph}>
            3. 천재지변, 서버 장애, 해킹, DDoS 공격, 정기 점검 등 불가항력적 사유로 인한 서비스 중단에 대해 앱은 책임을 지지 않습니다.
          </Text>

          <Text style={styles.paragraph}>
            4. 사용자 간 거래, 분쟁, 개인 정보 교환 등으로 발생하는 문제에 대해 앱은 개입하거나 책임을 지지 않습니다.
          </Text>

          <Text style={styles.sectionHeader}>손해배상</Text>

          <Text style={styles.paragraph}>
            1. 사용자가 본 약관을 위반하거나 불법 행위를 통해 앱 또는 제3자에게 손해를 끼친 경우, 해당 사용자는 이로 인한 모든 손해를 배상할 책임이 있습니다.
          </Text>

          <Text style={styles.paragraph}>
            2. 사용자의 약관 위반으로 인해 앱이 제3자로부터 소송, 이의제기 등을 받게 될 경우, 해당 사용자는 자신의 비용과 책임으로 앱을 면책시켜야 합니다.
          </Text>

          <Text style={styles.sectionHeader}>분쟁 해결</Text>

          <Text style={styles.paragraph}>
            1. 본 약관과 관련된 분쟁은 대한민국 법률을 준거법으로 합니다.
          </Text>

          <Text style={styles.paragraph}>
            2. 서비스 이용과 관련하여 분쟁이 발생한 경우, 양 당사자는 원만한 해결을 위해 성실히 협의합니다.
          </Text>

          <Text style={styles.dateText}>시행일: 2026년 4월 1일</Text>
        </View>
      </ScrollView>

      {/* Bottom Button */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  paragraph: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginBottom: 14,
  },
  bold: {
    fontWeight: '700',
    color: '#0B9A61',
  },
  redBold: {
    fontWeight: '700',
    color: '#FF5252',
  },
  dateText: {
    fontSize: 12,
    color: '#BDBDBD',
    marginTop: 16,
    textAlign: 'right',
  },
  bottomSection: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    backgroundColor: '#FFFFFF',
  },
  agreeButton: {
    backgroundColor: '#0B9A61',
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
