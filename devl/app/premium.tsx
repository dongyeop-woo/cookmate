import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPackages, purchasePremium, restorePurchases, BackendSyncFailedError } from '../services/premium';
import { useAuth } from './_layout';
import type { PurchasesPackage } from 'react-native-purchases';

const { width } = Dimensions.get('window');

// 연간 플랜의 월 환산가 + 할인율 계산 (월간 패키지 대비)
function annualSavings(annual: PurchasesPackage, monthly?: PurchasesPackage): { perMonth: string; discount: number } | null {
  if (!annual || annual.packageType !== 'ANNUAL') return null;
  const annualPrice = annual.product.price; // number, 결제 통화 기준
  const monthEq = annualPrice / 12;
  const perMonth = `${annual.product.currencyCode === 'KRW' ? '₩' : ''}${Math.round(monthEq).toLocaleString()}`;
  if (!monthly) return { perMonth, discount: 0 };
  const monthlyPrice = monthly.product.price;
  if (monthlyPrice <= 0) return { perMonth, discount: 0 };
  const fullYear = monthlyPrice * 12;
  const discount = Math.round((1 - annualPrice / fullYear) * 100);
  return { perMonth, discount: Math.max(0, discount) };
}

type PlanKey = 'annual' | 'monthly';

export default function PremiumScreen() {
  const router = useRouter();
  const { isPremium, firebaseUser, refreshPremium } = useAuth();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  // 연간 기본 선택 — 패키지 로딩 전에도 선택 상태가 살아있어야 UX/스크린샷 모두 깔끔함.
  const [selectedKey, setSelectedKey] = useState<PlanKey>('annual');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPackages().then(setPackages).catch(() => {});
  }, []);

  const monthlyPkg = packages.find(p => p.packageType === 'MONTHLY');
  const annualPkg = packages.find(p => p.packageType === 'ANNUAL');
  const selectedPkg = selectedKey === 'annual' ? annualPkg : monthlyPkg;

  const handleSubscribe = async () => {
    if (!firebaseUser?.uid) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    if (!selectedPkg) {
      Alert.alert('준비 중', '프리미엄 구독 서비스를 준비하고 있어요.\n곧 만나보실 수 있습니다!');
      return;
    }
    setLoading(true);
    try {
      const success = await purchasePremium(firebaseUser.uid, selectedPkg);
      if (success) {
        await refreshPremium();
        Alert.alert('구독 완료!', '프리미엄 혜택을 즐겨보세요.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      // 결제는 성공했지만 백엔드 동기화 실패 — 사용자에게 정확히 안내 (다음 앱 재시작 시 자동 보정)
      if (e instanceof BackendSyncFailedError) {
        Alert.alert('결제 완료 (서버 동기화 지연)', e.message, [
          { text: '확인', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('구독 실패', e.message || '다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!firebaseUser?.uid) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    setLoading(true);
    try {
      const success = await restorePurchases(firebaseUser.uid);
      if (success) {
        await refreshPremium();
        Alert.alert('복원 완료', '프리미엄 구독이 복원되었습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('복원 실패', '활성화된 구독이 없습니다.');
      }
    } catch (e: any) {
      if (e instanceof BackendSyncFailedError) {
        Alert.alert('복원됨 (서버 동기화 지연)', e.message);
      } else {
        Alert.alert('오류', '복원에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // App Store 가이드라인 — 인앱에서 구독 관리/해지로 직접 보내는 deep link
  const openManageSubscriptions = () => {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() => {
      Alert.alert('알림', '구독 관리 페이지를 열 수 없습니다. 기기의 앱스토어 설정에서 직접 관리해주세요.');
    });
  };

  if (isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="checkmark-circle" size={64} color="#C8A24E" />
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginTop: 16 }}>프리미엄 이용 중</Text>
          <Text style={{ fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' }}>광고 없는 쾌적한 요리 경험을 즐기고 계세요!</Text>
          <TouchableOpacity onPress={openManageSubscriptions} style={{ marginTop: 28, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12 }} disabled={loading}>
            <Text style={{ fontSize: 14, color: '#1A1A1A', fontWeight: '600' }}>구독 관리 / 해지</Text>
          </TouchableOpacity>
          {/* 동기화 어긋남 케이스 대비 — 다른 기기에서 결제, 갱신 후 미반영 등 수동 복원 경로 */}
          <TouchableOpacity onPress={handleRestore} disabled={loading} style={{ marginTop: 12 }}>
            {loading ? (
              <ActivityIndicator color="#999" />
            ) : (
              <Text style={{ fontSize: 13, color: '#999', textDecorationLine: 'underline' }}>구독 복원하기</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 배너 이미지 */}
        <Image source={require('../assets/banner2.jpg')} style={styles.bannerImage} contentFit="cover" />

        {/* 타이틀 */}
        <View style={styles.titleSection}>
          <Text style={styles.premiumBadge}>PREMIUM</Text>
          <Text style={styles.mainTitle}>AI 추천 4배,{'\n'}광고도 0개</Text>
          <Text style={styles.subtitle}>요잘알 프리미엄으로 매일 새로운 레시피를 받아보세요</Text>
        </View>

        {/* 혜택 */}
        <View style={styles.benefitSection}>
          <Text style={styles.sectionTitle}>프리미엄 혜택</Text>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="sparkles-outline" size={24} color="#1A1A1A" />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitTitle}>AI 레시피 추천 일 20회</Text>
              <Text style={styles.benefitDesc}>무료 5회의 4배. 냉장고를 열 때마다 즉시 추천</Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="ban-outline" size={24} color="#1A1A1A" />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitTitle}>모든 광고 제거</Text>
              <Text style={styles.benefitDesc}>배너·전면·보상형 광고 없이 깔끔하게</Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="gift-outline" size={24} color="#1A1A1A" />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitTitle}>기프티콘 즉시 교환</Text>
              <Text style={styles.benefitDesc}>광고 시청 없이 포인트로 바로 교환</Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name="ribbon-outline" size={24} color="#1A1A1A" />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitTitle}>프리미엄 배지</Text>
              <Text style={styles.benefitDesc}>프로필에 특별한 프리미엄 배지 표시</Text>
            </View>
          </View>
        </View>

        {/* 가격 — 패키지 로딩 전에는 폴백 가격으로 카드 표시 (UX/스크린샷 모두 이득) */}
        <View style={styles.priceSection}>
          <Text style={styles.sectionTitle}>구독 플랜</Text>

          {/* 연간 플랜 — 추천(BEST VALUE) */}
          {(() => {
            const isSelected = selectedKey === 'annual';
            const priceText = annualPkg?.product.priceString ?? '₩39,000';
            const savings = annualPkg
              ? annualSavings(annualPkg, monthlyPkg)
              : { perMonth: '₩3,250', discount: 34 };
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedKey('annual')}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
              >
                <View style={styles.planTopRow}>
                  <View style={styles.planLabelRow}>
                    <Text style={styles.planLabel}>연간</Text>
                    {savings && savings.discount > 0 && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>{savings.discount}% 할인</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </View>
                <Text style={styles.planPrice}>{priceText}</Text>
                {savings && (
                  <Text style={styles.planSubPrice}>월 {savings.perMonth} 환산</Text>
                )}
                <View style={styles.bestBadge}>
                  <Ionicons name="star" size={10} color="#FFFFFF" />
                  <Text style={styles.bestBadgeText}>가장 합리적</Text>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* 월간 플랜 — 3일 무료체험 */}
          {(() => {
            const isSelected = selectedKey === 'monthly';
            const priceText = monthlyPkg?.product.priceString ?? '₩4,900';
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedKey('monthly')}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
              >
                <View style={styles.planTopRow}>
                  <View style={styles.planLabelRow}>
                    <Text style={styles.planLabel}>월간</Text>
                    <View style={styles.trialBadge}>
                      <Text style={styles.trialBadgeText}>3일 무료체험</Text>
                    </View>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </View>
                <Text style={styles.planPrice}>{priceText}</Text>
                <Text style={styles.planSubPrice}>매월 자동 결제</Text>
              </TouchableOpacity>
            );
          })()}
        </View>

        {/* 유의사항 */}
        <View style={styles.noticeSection}>
          <Text style={styles.noticeTitle}>유의사항</Text>
          <Text style={styles.noticeText}>{'\u2022'} 월간 플랜은 첫 3일 무료체험 후 자동 결제됩니다 (계정당 1회).</Text>
          <Text style={styles.noticeText}>{'\u2022'} 연간 플랜은 결제 즉시 활성화되며 12개월마다 자동 갱신됩니다.</Text>
          <Text style={styles.noticeText}>{'\u2022'} 갱신일 24시간 전까지 취소하지 않으면 자동 결제됩니다.</Text>
          <Text style={styles.noticeText}>{'\u2022'} 구독 관리 및 취소는 기기의 앱스토어/플레이스토어 설정에서 가능합니다.</Text>
        </View>

        {/* 구독 버튼 */}
        <View style={styles.btnSection}>
          <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeBtnText}>
                {selectedKey === 'monthly' ? '3일 무료로 시작하기' : '구독 시작하기'}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.btnHint}>
            {selectedKey === 'annual'
              ? `연 ${annualPkg?.product.priceString ?? '₩39,000'} · 12개월마다 자동 갱신`
              : `무료체험 후 ${monthlyPkg?.product.priceString ?? '₩4,900'}`}
          </Text>
          <TouchableOpacity onPress={handleRestore} style={{ marginTop: 12 }}>
            <Text style={styles.restoreText}>구독 복원하기</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
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
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  premiumBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C8A24E',
    letterSpacing: 2,
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  benefitSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  benefitIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 13,
    color: '#888',
  },
  priceSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  planCard: {
    borderWidth: 2,
    borderColor: '#EFEFEF',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#C8A24E',
    backgroundColor: '#FFFBEF',
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  discountBadge: {
    backgroundColor: '#C8A24E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  trialBadge: {
    backgroundColor: 'rgba(200,162,78,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trialBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C8A24E',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D5D5D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: '#C8A24E',
    borderColor: '#C8A24E',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  planSubPrice: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  bestBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bestBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noticeSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  noticeText: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
    marginBottom: 4,
  },
  btnSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  subscribeBtn: {
    width: '100%',
    backgroundColor: '#C8A24E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  subscribeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnHint: {
    fontSize: 12,
    color: '#BBB',
    marginTop: 8,
  },
  restoreText: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'underline',
  },
});
