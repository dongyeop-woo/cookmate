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
        {/* Privacy Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>요잘알 개인정보 수집 이용 동의</Text>

          <Text style={styles.paragraph}>
            TwentyVI(이하 '요잘알')은 서비스 제공을 위해 아래와 같이 개인정보를 수집 및 이용을 하고자 합니다. 내용을 읽으신 후 결정하여 주세요.
          </Text>

          <Text style={styles.sectionHeader}>개인정보 수집 및 이용 목적 및 항목</Text>

          {/* Table */}
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>수집목적</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>수집항목</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>보유기간</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>회원가입 및 관리</Text>
              <Text style={styles.tableCell}>이메일, 닉네임, 성별, 프로필 사진</Text>
              <Text style={styles.tableCell}>탈퇴 시까지</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>소셜 로그인</Text>
              <Text style={styles.tableCell}>소셜 계정 식별자, 이름, 이메일, 프로필 사진</Text>
              <Text style={styles.tableCell}>탈퇴 시까지</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>레시피 서비스 제공</Text>
              <Text style={styles.tableCell}>작성한 레시피, 리뷰, 평점</Text>
              <Text style={styles.tableCell}>탈퇴 시까지</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>커뮤니티 활동</Text>
              <Text style={styles.tableCell}>게시글, 댓글, 좋아요</Text>
              <Text style={styles.tableCell}>탈퇴 시까지</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>서비스 개선</Text>
              <Text style={styles.tableCell}>접속 로그, 기기 정보, OS 버전</Text>
              <Text style={styles.tableCell}>수집 후 1년</Text>
            </View>
          </View>

          <Text style={[styles.paragraph, { marginTop: 16 }]}>
            ※ 위 개인정보 수집에 동의하지 않을 경우 서비스 이용이 제한될 수 있습니다.
          </Text>

          <Text style={[styles.paragraph]}>
            ※ 수집된 개인정보는 위 목적 외에는 사용되지 않으며, 제3자에게 제공되지 않습니다.
          </Text>

          <Text style={styles.sectionHeader}>개인정보 처리 위탁</Text>

          <Text style={styles.paragraph}>
            TwentyVI는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있습니다.
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>수탁업체</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>위탁 업무</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Google</Text>
              <Text style={styles.tableCell}>인증, 데이터 저장, 호스팅</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>카카오</Text>
              <Text style={styles.tableCell}>소셜 로그인 인증</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>개인정보 파기 절차 및 방법</Text>

          <Text style={styles.paragraph}>
            1. 회원 탈퇴 시 개인정보는 즉시 파기됩니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관 후 파기합니다.
          </Text>

          <Text style={styles.paragraph}>
            2. 전자적 파일 형태의 정보는 복구 및 재생이 불가능한 기술적 방법을 사용하여 완전 삭제합니다.
          </Text>

          <Text style={styles.sectionHeader}>이용자의 권리</Text>

          <Text style={styles.paragraph}>
            이용자는 언제든지 자신의 개인정보에 대해 다음의 권리를 행사할 수 있습니다.
          </Text>

          <Text style={styles.paragraph}>
            1. 개인정보 열람 요구
          </Text>

          <Text style={styles.paragraph}>
            2. 개인정보 정정·삭제 요구
          </Text>

          <Text style={styles.paragraph}>
            3. 개인정보 처리정지 요구
          </Text>

          <Text style={styles.paragraph}>
            4. 회원 탈퇴(동의 철회)
          </Text>

          <Text style={styles.paragraph}>
            위 권리 행사는 앱 내 설정 또는 고객센터를 통해 가능하며, 요청 시 지체 없이 처리합니다.
          </Text>

          <Text style={styles.sectionHeader}>개인정보 안전성 확보 조치</Text>

          <Text style={styles.paragraph}>
            TwentyVI는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
          </Text>

          <Text style={styles.paragraph}>
            1. 개인정보의 암호화: 비밀번호 및 민감 정보는 암호화하여 저장·관리합니다.
          </Text>

          <Text style={styles.paragraph}>
            2. 접근 제한: 개인정보 처리 시스템에 대한 접근 권한을 최소화합니다.
          </Text>

          <Text style={styles.paragraph}>
            3. 보안 프로그램: 해킹 등에 대비하여 보안 시스템을 운영합니다.
          </Text>

          <Text style={styles.sectionHeader}>개인정보 보호책임자</Text>

          <Text style={styles.paragraph}>
            개인정보 처리에 관한 불만, 피해 구제 등 문의사항은 카카오톡 채널 '요잘알'로 연락해 주시기 바랍니다.
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
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    marginTop: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginBottom: 12,
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    color: '#444',
    paddingVertical: 12,
    paddingHorizontal: 10,
    lineHeight: 17,
  },
  tableHeaderText: {
    fontWeight: '700',
    color: '#1A1A1A',
    fontSize: 13,
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
