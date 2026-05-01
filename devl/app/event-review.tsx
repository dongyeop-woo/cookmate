import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// 이벤트 기간 — 시작/종료 시각으로 활성 여부 결정. 한국시간 기준.
const EVENT_START = new Date('2026-05-01T00:00:00+09:00');
const EVENT_END = new Date('2026-06-30T23:59:59+09:00');

export default function EventReviewScreen() {
  const router = useRouter();

  const now = new Date();
  const isBeforeEvent = now < EVENT_START;
  const isAfterEvent = now > EVENT_END;
  const isEventActive = !isBeforeEvent && !isAfterEvent;

  const handleParticipate = () => {
    if (isBeforeEvent) {
      Alert.alert('이벤트 준비 중', '아직 이벤트 시작 전입니다.\n곧 참여하실 수 있어요!');
      return;
    }
    if (isAfterEvent) {
      Alert.alert('이벤트 종료', '이벤트 참여 기간이 종료되었어요.');
      return;
    }
    router.push('/inquiry/write?mode=event');
  };

  const openStoreReview = () => {
    if (Platform.OS === 'ios') {
      // App Store 리뷰 작성 화면으로 직접 이동
      Linking.openURL('https://apps.apple.com/app/id6761661890?action=write-review');
    } else {
      // Android는 아직 정식 출시 전 (내부 테스트 단계)
      const { Alert } = require('react-native');
      Alert.alert('출시 전', '안드로이드는 아직 출시 전이에요.\n출시 후 다시 이용해주세요!');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 배너 이미지 */}
        <Image source={require('../assets/test.png')} style={styles.bannerImage} contentFit="cover" />

        {/* 이벤트 제목 */}
        <View style={styles.titleSection}>
          <Text style={styles.eventLabel}>[이벤트] 요잘알 앱 리뷰 이벤트</Text>
          <Text style={styles.eventDate}>26.05.01</Text>
          <Text style={styles.eventTitle}>요잘알이{'\n'}요리 재료 쏜다!</Text>
          <Text style={styles.eventSubtitle}>감사의 마음을 담아, 푸짐한 경품을 드려요</Text>
          <View style={styles.periodBadge}>
            <Text style={styles.periodText}>26.05.01 (금) ~ 26.06.30 (화)</Text>
          </View>
        </View>

        {/* 이벤트 소개 */}
        <View style={styles.introSection}>
          <Text style={styles.introText}>
            요잘알과 함께 요리하며{'\n'}
            즐거웠던 순간이 있었다면,{'\n'}
            그 소중한 경험을 앱 리뷰로 나눠주세요!
          </Text>
          <Text style={styles.introHighlight}>
            감사한 마음 가득 담아,{'\n'}
            푸짐한 경품을 보내드리겠습니다.
          </Text>
        </View>

        {/* 이벤트 기간 */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="calendar-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>이벤트 기간</Text>
          </View>
          <Text style={styles.infoLabel}>참여 기간</Text>
          <Text style={styles.infoValue}>26.05.01 (금) ~ 26.06.30 (화)</Text>
        </View>

        {/* 참여 대상 */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="help-circle-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>참여 대상</Text>
          </View>
          <Text style={styles.infoValue}>요잘알 가입 유저 전체</Text>
        </View>

        {/* 이벤트 경품 */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="gift-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>이벤트 경품</Text>
          </View>
          <View style={styles.prizeList}>
            <View style={styles.prizeItem}>
              <View style={[styles.prizeRank, { backgroundColor: '#FFD700' }]}>
                <Text style={styles.prizeRankText}>1등</Text>
              </View>
              <View style={styles.prizeInfo}>
                <Text style={styles.prizeName}>신세계 상품권 5만원</Text>
                <Text style={styles.prizeCount}>1명</Text>
              </View>
            </View>
            <View style={styles.prizeItem}>
              <View style={[styles.prizeRank, { backgroundColor: '#C0C0C0' }]}>
                <Text style={styles.prizeRankText}>2등</Text>
              </View>
              <View style={styles.prizeInfo}>
                <Text style={styles.prizeName}>신세계 상품권 1만원</Text>
                <Text style={styles.prizeCount}>5명</Text>
              </View>
            </View>
            <View style={styles.prizeItem}>
              <View style={[styles.prizeRank, { backgroundColor: '#CD7F32' }]}>
                <Text style={styles.prizeRankText}>3등</Text>
              </View>
              <View style={styles.prizeInfo}>
                <Text style={styles.prizeName}>요잘알 포인트 1,000P</Text>
                <Text style={styles.prizeCount}>100명</Text>
              </View>
            </View>
          </View>
          <Text style={styles.prizeNote}>
            ※ 이벤트 참여 인원에 따라 경품 및 당첨 인원이 추가 증정될 수 있습니다.
          </Text>
        </View>

        {/* 참여 방법 */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="help-circle-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>참여 방법</Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 1</Text>
            <Text style={styles.stepTitle}>스토어에 리뷰 작성</Text>
            {Platform.OS === 'android' && (
              <TouchableOpacity
                style={styles.storeBtn}
                onPress={openStoreReview}
              >
                <Ionicons name="logo-google-playstore" size={18} color="#1A1A1A" />
                <Text style={styles.storeBtnText}>플레이스토어 리뷰 작성하기</Text>
              </TouchableOpacity>
            )}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.storeBtn}
                onPress={openStoreReview}
              >
                <Ionicons name="logo-apple" size={18} color="#1A1A1A" />
                <Text style={styles.storeBtnText}>앱 스토어 리뷰 작성하기</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 2</Text>
            <Text style={styles.stepTitle}>작성한 리뷰 화면 캡처</Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 3</Text>
            <Text style={styles.stepTitle}>요잘알 앱 내 문의하기로 제출 완료!</Text>
          </View>

          <TouchableOpacity
            style={[styles.participateBtn, !isEventActive && { backgroundColor: '#BDBDBD' }]}
            onPress={handleParticipate}
          >
            <Text style={styles.participateBtnText}>이벤트 참여하기</Text>
          </TouchableOpacity>
        </View>

        {/* 유의사항 */}
        <View style={styles.noticeSection}>
          <Text style={styles.noticeTitle}>꼭 확인해 주세요</Text>
          <Text style={styles.noticeText}>
            {'\u2022'} Google Play Store 또는 App Store에 기간 내에 앱 리뷰를 남겨야만 이벤트 참여가 가능합니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 이벤트 참여 인원에 따라 당첨 경품 및 인원이 추가 증정될 수 있습니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 상품 발송 시점에 작성한 리뷰 확인이 불가할 경우, 상품 수여 대상에서 제외됩니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 이벤트 참여 시 작성해주신 리뷰는 요잘알 마케팅 활용 목적으로 사용될 수 있으며, 이벤트 응모 시 이에 동의한 것으로 간주합니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 이벤트 응모 시 오기재 된 정보 및 휴대폰 설정으로 인한 경품 미제공은 당사가 책임지지 않습니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 이벤트 참여 시 욕설, 비방, 부적절하거나 타인에게 피해를 줄 수 있는 내용이 담겨 있는 리뷰는 사전 안내 없이 삭제 조치될 수 있습니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 당첨자 발표: 2026.07.07 앱 공지사항
          </Text>

          <Text style={[styles.noticeTitle, { marginTop: 20 }]}>[개인정보 수집 및 이용 동의 안내]</Text>
          <Text style={styles.noticeText}>
            이벤트 진행을 위해 아래와 같이 개인정보를 수집 및 이용합니다. 이벤트 참여 시에는 이에 동의한 것으로 간주합니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 수집 및 이용 목적: 이벤트 운영 및 경품 발송
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 수집 항목: 이름, 휴대폰 번호, 리뷰 작성 캡처 이미지 (앱스토어 닉네임, 리뷰 정보 포함)
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 보유 및 이용기간: 당첨자 발표 후 1개월
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bannerImage: {
    width: '100%',
    aspectRatio: 2752 / 1536,
  },
  // Title Section
  titleSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#F0FAF5',
  },
  eventLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    color: '#BBB',
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 8,
  },
  eventSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  periodBadge: {
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Intro Section
  introSection: {
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: '#F0FAF5',
    alignItems: 'center',
  },
  introText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  introHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 24,
  },
  // Info Card
  infoCard: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 8,
    borderBottomColor: '#F5F5F5',
    alignItems: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  infoBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  infoLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Prize
  prizeList: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  prizeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  prizeRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prizeRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  prizeInfo: {
    flex: 1,
  },
  prizeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  prizeCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  prizeNote: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  // Steps
  stepItem: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  storeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
    justifyContent: 'center',
  },
  storeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  participateBtn: {
    width: '100%',
    backgroundColor: '#1BAE74',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  participateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Notice
  noticeSection: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
    marginBottom: 8,
  },
});
