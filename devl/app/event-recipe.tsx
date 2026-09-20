import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const EVENT_START = new Date('2026-05-09T00:00:00+09:00');
const EVENT_END = new Date('2026-06-30T23:59:59+09:00');
const MAX_WINNERS = 50;
const REWARD_NAME = '스타벅스 아이스 카페 아메리카노 T';

export default function EventRecipeScreen() {
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
    router.push('/community/write');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={require('../assets/banner-recipe-event.jpg')} style={styles.bannerImage} contentFit="cover" />

        <View style={styles.titleSection}>
          <Text style={styles.eventLabel}>[이벤트] 요잘알 레시피 작성 이벤트</Text>
          <Text style={styles.eventDate}>26.05.09</Text>
          <Text style={styles.eventTitle}>내 레시피 한 그릇,{'\n'}스타벅스 아메리카노로!</Text>
          <Text style={styles.eventSubtitle}>레시피 승인되면 아이스 아메리카노 한 잔 발송</Text>
          <View style={styles.periodBadge}>
            <Text style={styles.periodText}>26.05.09 (토) ~ 선착순 {MAX_WINNERS}명</Text>
          </View>
        </View>

        <View style={styles.introSection}>
          <Text style={styles.introText}>
            평소에 만들어 먹던 나만의 레시피,{'\n'}
            요잘알 커뮤니티에 공유해 주세요!
          </Text>
          <Text style={styles.introHighlight}>
            승인된 레시피 선착순 {MAX_WINNERS}명에게{'\n'}
            스타벅스 아이스 카페 아메리카노 T{'\n'}
            기프티콘을 보내 드립니다.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="calendar-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>이벤트 기간</Text>
          </View>
          <Text style={styles.infoLabel}>참여 기간</Text>
          <Text style={styles.infoValue}>26.05.09 (토) ~ 26.06.30 (화)</Text>
          <Text style={styles.infoSub}>※ 선착순 {MAX_WINNERS}명 소진 시 자동 종료</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="help-circle-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>참여 대상</Text>
          </View>
          <Text style={styles.infoValue}>요잘알 가입 유저 전체</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="gift-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>이벤트 경품</Text>
          </View>
          <View style={styles.prizeList}>
            <View style={styles.prizeItem}>
              <View style={[styles.prizeRank, { backgroundColor: '#1BAE74' }]}>
                <Ionicons name="cafe" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.prizeInfo}>
                <Text style={styles.prizeName}>{REWARD_NAME}</Text>
                <Text style={styles.prizeCount}>선착순 {MAX_WINNERS}명</Text>
              </View>
            </View>
          </View>
          <Text style={styles.prizeNote}>
            ※ 운영팀이 직접 발급해 드리는 스타벅스 e-기프티콘으로,{'\n'}
            마이페이지 {'>'} 내 기프티콘에서 교환 번호를 확인하실 수 있어요.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="help-circle-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>참여 방법</Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 1</Text>
            <Text style={styles.stepTitle}>나만의 레시피 작성</Text>
            <Text style={styles.stepDesc}>
              커뮤니티에서 재료·조리 단계를 직접 작성해 주세요.
            </Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 2</Text>
            <Text style={styles.stepTitle}>운영팀 검수 (1~2일)</Text>
            <Text style={styles.stepDesc}>
              부적절한 콘텐츠·도용 여부를 운영팀이 직접 확인합니다.
            </Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 3</Text>
            <Text style={styles.stepTitle}>스타벅스 기프티콘 발급!</Text>
            <Text style={styles.stepDesc}>
              승인 후 1~2일 이내에 운영팀이 직접 발급해 드려요.{'\n'}
              마이페이지 {'>'} 내 기프티콘에서 확인하실 수 있어요.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.participateBtn, !isEventActive && { backgroundColor: '#BDBDBD' }]}
            onPress={handleParticipate}
          >
            <Text style={styles.participateBtnText}>레시피 작성하러 가기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noticeSection}>
          <Text style={styles.noticeTitle}>꼭 확인해 주세요</Text>
          <Text style={styles.noticeText}>
            {'•'} 동일 사용자는 이벤트 기간 중 1회만 참여할 수 있습니다 (중복 보상 불가).
          </Text>
          <Text style={styles.noticeText}>
            {'•'} 운영팀 검수 결과 부적절하다고 판단되는 레시피(타 사이트 무단 도용, 단순 카피, 부적절 콘텐츠 등)는 승인되지 않으며 보상 대상에서 제외됩니다.
          </Text>
          <Text style={styles.noticeText}>
            {'•'} 등록 순서를 기준으로 선착순 {MAX_WINNERS}명 마감 시 이벤트는 자동 종료됩니다.
          </Text>
          <Text style={styles.noticeText}>
            {'•'} 기프티콘 발급은 운영팀이 직접 진행하며, 승인 시점 기준 1~2일 이내에 마이페이지 {'>'} 내 기프티콘에 등록됩니다.
          </Text>
          <Text style={styles.noticeText}>
            {'•'} 발급된 스타벅스 e-기프티콘은 현금 환불이 불가하며, 기프티콘에 명시된 사용 기한 내에 사용해 주세요.
          </Text>
          <Text style={styles.noticeText}>
            {'•'} 기프티콘 미수령·미사용으로 인해 발생하는 불이익은 당사가 책임지지 않습니다.
          </Text>
          <Text style={styles.noticeText}>
            {'•'} 작성한 레시피는 요잘알 마케팅 활용 목적으로 사용될 수 있으며, 이벤트 참여 시 이에 동의한 것으로 간주합니다.
          </Text>
          <Text style={styles.noticeText}>
            {'•'} 욕설·비방·광고성·불법 콘텐츠 또는 타인에게 피해를 줄 수 있는 레시피는 사전 안내 없이 삭제될 수 있습니다.
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
  titleSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#F8F4E8',
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
  introSection: {
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: '#F8F4E8',
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
  infoSub: {
    fontSize: 12,
    color: '#1BAE74',
    fontWeight: '600',
    marginTop: 6,
  },
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
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
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
