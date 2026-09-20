import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as KakaoLogin from '@react-native-seoul/kakao-login';
import { useAuth } from './_layout';
import { claimKakaoChannelReward, checkKakaoChannelStatus } from '../services/api';

const CHANNEL_URL = 'http://pf.kakao.com/_enxdCX'; // TwentyVI 채널

export default function EventKakaoScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [alreadyRewarded, setAlreadyRewarded] = useState(false);

  useEffect(() => {
    if (firebaseUser?.uid) {
      checkKakaoChannelStatus(firebaseUser.uid).then(res => {
        if (res.rewarded) setAlreadyRewarded(true);
      }).catch(() => {});
    }
  }, [firebaseUser?.uid]);

  const handleClaim = async () => {
    if (!firebaseUser?.uid) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    if (alreadyRewarded) {
      Alert.alert('안내', '이미 포인트를 받으셨습니다.');
      return;
    }
    setLoading(true);
    try {
      // 카카오 로그인으로 최신 토큰 획득 (만료 방지)
      const t = await KakaoLogin.login();
      const accessToken = t.accessToken;
      const res = await fetch('https://kapi.kakao.com/v1/api/talk/channels', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      const channels = data.channels || [];
      const isFriend = channels.some((ch: any) => ch.relation === 'ADDED');

      if (!isFriend) {
        if (data.code) {
          Alert.alert('오류', `카카오 채널 확인에 실패했습니다.\n잠시 후 다시 시도해주세요.`);
        } else {
          Linking.openURL(CHANNEL_URL);
          Alert.alert('채널 친구 추가', '카카오톡에서 채널을 친구 추가한 후\n다시 버튼을 눌러주세요!');
        }
        return;
      }

      // 카카오 사용자 ID 가져오기 — 누락 시 중복 참여 방지가 불가능하므로 전송 차단
      const profile = await KakaoLogin.getProfile();
      const kakaoId = String((profile as any)?.id ?? '').trim();
      if (!kakaoId) {
        Alert.alert('오류', '카카오 계정 정보를 가져오지 못했습니다.\n카카오톡에 로그인되어 있는지 확인 후 다시 시도해주세요.');
        return;
      }
      const result = await claimKakaoChannelReward(firebaseUser.uid, kakaoId);
      if (result.success) {
        setAlreadyRewarded(true);
        Alert.alert('축하합니다! 🎉', '500P가 지급되었습니다!');
      } else {
        Alert.alert('안내', result.message || '포인트 지급에 실패했습니다.');
      }
    } catch (e: any) {
      console.warn('카카오 채널 보상 오류:', e);
      Alert.alert('오류', '잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
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
        <Image source={require('../assets/banner-kakao.jpg')} style={styles.bannerImage} contentFit="cover" />

        {/* 이벤트 제목 */}
        <View style={styles.titleSection}>
          <Text style={styles.eventLabel}>[이벤트] 카카오 채널 친구 추가</Text>
          <Text style={styles.eventDate}>26.05.01</Text>
          <Text style={styles.eventTitle}>친구 추가하면{'\n'}500P 즉시 지급!</Text>
          <Text style={styles.eventSubtitle}>요잘알 카카오 채널을 친구 추가해주세요</Text>
          <View style={styles.periodBadge}>
            <Text style={styles.periodText}>상시 · 선착순 1,000명</Text>
          </View>
        </View>

        {/* 이벤트 소개 */}
        <View style={styles.introSection}>
          <Text style={styles.introText}>
            요잘알 카카오 채널을 친구 추가하면{'\n'}
            500 포인트를 바로 드려요!
          </Text>
          <Text style={styles.introHighlight}>
            받은 포인트로{'\n'}
            다양한 기프티콘을 교환해보세요.
          </Text>
        </View>

        {/* 이벤트 혜택 */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="gift-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>이벤트 혜택</Text>
          </View>
          <View style={styles.rewardBox}>
            <Text style={styles.rewardAmount}>500P</Text>
            <Text style={styles.rewardDesc}>즉시 지급</Text>
          </View>
        </View>

        {/* 참여 대상 */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="people-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>참여 대상</Text>
          </View>
          <Text style={styles.infoValue}>요잘알 가입 유저 전체</Text>
        </View>

        {/* 참여 방법 */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Ionicons name="help-circle-outline" size={16} color="#1A1A1A" />
            <Text style={styles.infoBadgeText}>참여 방법</Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 1</Text>
            <Text style={styles.stepTitle}>아래 버튼을 눌러 채널 친구 추가</Text>
          </View>

          <View style={styles.stepItem}>
            <Text style={styles.stepLabel}>STEP 2</Text>
            <Text style={styles.stepTitle}>500P 즉시 지급!</Text>
          </View>

          <TouchableOpacity
            style={[styles.kakaoBtn, alreadyRewarded && styles.participateBtnDisabled]}
            onPress={handleClaim}
            disabled={loading || alreadyRewarded}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#3C1E1E" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses" size={18} color={alreadyRewarded ? '#FFFFFF' : '#3C1E1E'} />
                <Text style={[styles.kakaoBtnText, alreadyRewarded && { color: '#FFFFFF' }]}>
                  {alreadyRewarded ? '이미 참여 완료' : '카카오 채널 추가하고 500P 받기'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 유의사항 */}
        <View style={styles.noticeSection}>
          <Text style={styles.noticeTitle}>꼭 확인해 주세요</Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 요잘알 가입 유저 누구나 참여 가능합니다. (카카오톡 설치 필요)
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 1인 1회 한정으로, 이미 참여하신 경우 재참여가 불가합니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 선착순 1,000명 소진 시 사전 안내 없이 조기 종료될 수 있습니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 카카오 채널 친구 추가 후 포인트 수령이 가능합니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 부정한 방법으로 참여 시 포인트가 회수될 수 있습니다.
          </Text>
          <Text style={styles.noticeText}>
            {'\u2022'} 지급된 포인트는 앱 내 쇼핑에서 기프티콘 교환에 사용 가능합니다.
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
    backgroundColor: '#FFFDE7',
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
    borderColor: '#F9A825',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F9A825',
  },
  // Intro Section
  introSection: {
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: '#FFFDE7',
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
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Reward
  rewardBox: {
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  rewardAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F9A825',
  },
  rewardDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 4,
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
    color: '#F9A825',
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  kakaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE500',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
    justifyContent: 'center',
  },
  kakaoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3C1E1E',
  },
  participateBtn: {
    width: '100%',
    backgroundColor: '#F9A825',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  participateBtnDisabled: {
    backgroundColor: '#BDBDBD',
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
