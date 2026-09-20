import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { exchangeGifticon, fetchUser, invalidateCacheTag } from '../services/api';
import { removeFromCart } from '../services/cart';
import { RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

const rewardedAdUnitId = __DEV__ ? TestIds.REWARDED : Platform.OS === 'ios'
  ? 'ca-app-pub-8542314434357214/6075268030'
  : 'ca-app-pub-8542314434357214/9224175556';

type OrderItem = {
  gifticonId: string;
  name: string;
  brand: string;
  image: string;
  pointCost: number;
};

export default function OrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, userProfile, setUserProfile, isPremium } = useAuth();
  const { items: itemsJson, fromCart } = useLocalSearchParams<{ items: string; fromCart?: string }>();

  const items: OrderItem[] = useMemo(() => {
    try {
      return itemsJson ? JSON.parse(itemsJson) : [];
    } catch {
      return [];
    }
  }, [itemsJson]);

  const total = items.reduce((sum, it) => sum + it.pointCost, 0);
  const points = userProfile?.points ?? 0;
  const remaining = points - total;

  const [phoneInput, setPhoneInput] = useState('');
  const [exchanging, setExchanging] = useState(false);

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  };

  const handleExchange = async () => {
    if (!firebaseUser?.uid || items.length === 0) return;
    const cleaned = phoneInput.replace(/-/g, '').replace(/\s+/g, '');
    if (!/^01\d{8,9}$/.test(cleaned)) {
      Alert.alert('안내', '올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    if (points < total) {
      Alert.alert('포인트 부족', `${(total - points).toLocaleString()}P가 더 필요해요.`);
      return;
    }

    if (!isPremium) try {
      await new Promise<void>((resolve) => {
        const rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId);
        const loadListener = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => rewarded.show());
        const earnListener = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          loadListener(); earnListener(); resolve();
        });
        rewarded.load();
        setTimeout(() => { loadListener(); earnListener(); resolve(); }, 15000);
      });
    } catch {}

    setExchanging(true);
    try {
      for (const item of items) {
        await exchangeGifticon(firebaseUser.uid, item.gifticonId, cleaned);
      }
      invalidateCacheTag('points');
      invalidateCacheTag('gifticons');
      const fresh = await fetchUser(firebaseUser.uid);
      if (fresh) setUserProfile(fresh as any);
      if (fromCart === '1') {
        for (const item of items) await removeFromCart(item.gifticonId);
      }
      Alert.alert('교환 완료!', `${items.length}개 기프티콘이 ${cleaned}로 발송되었어요.`, [
        { text: '확인', onPress: () => router.replace('/my-gifticons') },
      ]);
    } catch (e: any) {
      Alert.alert('교환 실패', e.message || '다시 시도해주세요.');
    } finally {
      setExchanging(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>주문하기</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>주문 상품 ({items.length}개)</Text>
            {items.map((item, idx) => (
              <View key={`${item.gifticonId}-${idx}`} style={styles.itemRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                ) : (
                  <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                    <Ionicons name="gift" size={24} color="#DCDCDC" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemBrand}>{item.brand}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                </View>
                <Text style={styles.itemPrice}>{item.pointCost.toLocaleString()}P</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>받을 전화번호</Text>
            <Text style={styles.sectionSub}>입력한 번호의 카카오톡으로 기프티콘 발송 알림이 전송돼요.</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="010-1234-5678"
              placeholderTextColor="#BDBDBD"
              keyboardType="number-pad"
              value={phoneInput}
              onChangeText={(v) => setPhoneInput(formatPhone(v))}
              maxLength={13}
            />
            <Text style={styles.phoneHint}>* 기프티콘은 앱의 '내 기프티콘'에서도 언제든 확인 가능해요.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>결제 정보</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>내 포인트</Text>
              <Text style={styles.summaryValue}>{points.toLocaleString()}P</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>사용 포인트</Text>
              <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>-{total.toLocaleString()}P</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>교환 후 잔액</Text>
              <Text style={[styles.totalValue, remaining < 0 && { color: '#FF3B30' }]}>
                {remaining.toLocaleString()}P
              </Text>
            </View>
          </View>

          {!isPremium && (
            <View style={styles.notice}>
              <Ionicons name="information-circle" size={16} color="#888" />
              <Text style={styles.noticeText}>
                교환 전 보상형 광고 1회가 재생돼요. (프리미엄 유저는 생략)
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[
              styles.exchangeBtn,
              (exchanging || points < total) && styles.exchangeBtnDisabled,
            ]}
            onPress={handleExchange}
            disabled={exchanging || points < total}
          >
            {exchanging ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.exchangeBtnText}>
                {points < total ? '포인트 부족' : `${total.toLocaleString()}P 교환하기`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  section: {
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 8, borderBottomColor: '#F8F9FA',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  sectionSub: { fontSize: 13, color: '#888', marginTop: -8, marginBottom: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  itemImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F5F5F5' },
  itemImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  itemBrand: { fontSize: 11, color: '#888', marginBottom: 2 },
  itemName: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  itemPrice: { fontSize: 14, color: '#1A1A1A', fontWeight: '700' },
  phoneInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A1A1A',
  },
  phoneHint: {
    fontSize: 12, color: '#9E9E9E', marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E0E0E0', marginVertical: 8 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  notice: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  noticeText: { fontSize: 12, color: '#888', flex: 1 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F0F0',
  },
  exchangeBtn: {
    backgroundColor: '#1BAE74', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  exchangeBtnDisabled: { backgroundColor: '#BDBDBD' },
  exchangeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
