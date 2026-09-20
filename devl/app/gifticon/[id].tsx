import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { fetchGifticons } from '../../services/api';
import type { Gifticon } from '../../services/api';
import { addToCart, getCartCount } from '../../services/cart';

const { width } = Dimensions.get('window');

export default function GifticonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const [gifticon, setGifticon] = useState<Gifticon | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const points = userProfile?.points ?? 0;

  useFocusEffect(
    useCallback(() => {
      getCartCount().then(setCartCount);
    }, [])
  );

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchGifticons();
        const found = list.find(g => g.id === id);
        setGifticon(found || null);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleExchange = () => {
    if (!gifticon) return;
    if (points < gifticon.pointCost) {
      Alert.alert('포인트 부족', `${(gifticon.pointCost - points).toLocaleString()}P가 더 필요해요.`);
      return;
    }
    const payload = [{
      gifticonId: gifticon.id,
      name: gifticon.name,
      brand: gifticon.brand,
      image: gifticon.image,
      pointCost: gifticon.pointCost,
    }];
    router.push({ pathname: '/order', params: { items: JSON.stringify(payload) } });
  };

  const handleCart = async () => {
    if (!gifticon) return;
    await addToCart(gifticon);
    setCartCount(await getCartCount());
    Alert.alert('장바구니 담기 완료', '장바구니에 담겼어요.', [
      { text: '계속 쇼핑', style: 'cancel' },
      { text: '장바구니 보기', onPress: () => router.push('/cart') },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      </SafeAreaView>
    );
  }

  if (!gifticon) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
        <View style={{ padding: 20 }}>
          <Text>상품을 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canAfford = points >= gifticon.pointCost;
  const discountRate = gifticon.salePrice > 0
    ? Math.round(((gifticon.salePrice - gifticon.pointCost) / gifticon.salePrice) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>쇼핑</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>{gifticon.brand}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.cartIconWrap}>
            <Ionicons name="cart-outline" size={24} color="#FF6B9D" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 상품 이미지 */}
        <View style={styles.productImageWrap}>
          {gifticon.image ? (
            <Image source={{ uri: gifticon.image }} style={styles.productImage} contentFit="cover" />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Ionicons name="gift" size={80} color="#DCDCDC" />
            </View>
          )}
        </View>

        {/* 상품 정보 */}
        <View style={styles.infoSection}>
          <Text style={styles.name}>[공식] {gifticon.name}</Text>

          {discountRate > 0 && (
            <View style={styles.priceTopRow}>
              <Text style={styles.discountRate}>{discountRate}%</Text>
              <Text style={styles.originalPrice}>{gifticon.salePrice.toLocaleString()}P</Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{gifticon.pointCost.toLocaleString()}</Text>
            <Text style={styles.priceUnit}>P</Text>
          </View>

          <View style={styles.shippingRow}>
            <Ionicons name="flash" size={13} color="#888" />
            <Text style={styles.shippingText}>즉시 발송 (수신 번호로 발송)</Text>
          </View>
        </View>

        {/* 상품 설명 */}
        {gifticon.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descTitle}>상품 안내</Text>
            <Text style={styles.descText}>{gifticon.description}</Text>
          </View>
        ) : null}

        {/* 유의사항 */}
        <View style={styles.noticeSection}>
          <Text style={styles.descTitle}>유의사항</Text>
          <Text style={styles.noticeText}>{'\u2022'} 기프티콘 유효기간은 발행일로부터 30일입니다.</Text>
          <Text style={styles.noticeText}>{'\u2022'} 교환 후에는 취소/환불이 불가합니다.</Text>
          <Text style={styles.noticeText}>{'\u2022'} 발송은 입력하신 휴대폰 번호로 진행됩니다.</Text>
          <Text style={styles.noticeText}>{'\u2022'} 일부 지점에서는 사용이 제한될 수 있습니다.</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={handleCart}
          activeOpacity={0.85}
        >
          <Ionicons name="cart-outline" size={22} color="#FF6B9D" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exchangeBtn, !canAfford && styles.exchangeBtnDisabled]}
          onPress={handleExchange}
          disabled={!canAfford}
          activeOpacity={0.85}
        >
          <Text style={styles.exchangeBtnText}>
            {canAfford ? '교환하기' : '포인트 부족'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    marginTop: 10,
    gap: 10,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  brandBadgeText: { fontSize: 11, color: '#FFFFFF', fontWeight: '800' },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cartIconWrap: { position: 'relative' },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E91E63',
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },

  productImageWrap: {
    width: '100%',
    height: width * 0.9,
    backgroundColor: '#F5F1EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  pageIndicator: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  pageIndicatorText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },

  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 26,
    marginBottom: 16,
  },

  priceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  discountRate: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  originalPrice: {
    fontSize: 15,
    color: '#BBB',
    textDecorationLine: 'line-through',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  price: { fontSize: 28, fontWeight: '800', color: '#E53935' },
  priceUnit: { fontSize: 18, fontWeight: '600', color: '#E53935', marginLeft: 3 },

  shippingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shippingText: { fontSize: 12, color: '#666' },

  benefitSection: {
    borderTopWidth: 8,
    borderTopColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 14,
  },
  benefitLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    width: 32,
    paddingTop: 4,
  },
  benefitContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  benefitTag: {
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  benefitTagText: { fontSize: 11, color: '#1A1A1A', fontWeight: '800' },
  benefitTextStrong: { flex: 1, fontSize: 13, color: '#1A1A1A', fontWeight: '700' },

  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  benefitItemText: { flex: 1, fontSize: 13, color: '#444' },

  myPointSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  myPointLabel: { fontSize: 14, color: '#666', fontWeight: '600' },
  myPointValue: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },

  descSection: {
    borderTopWidth: 8,
    borderTopColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  descTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  descText: { fontSize: 13, color: '#555', lineHeight: 20 },

  noticeSection: {
    borderTopWidth: 8,
    borderTopColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  noticeText: { fontSize: 12, color: '#888', lineHeight: 20, marginBottom: 4 },

  bottomBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
    backgroundColor: '#FFFFFF',
  },
  cartBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exchangeBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1BAE74',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exchangeBtnDisabled: { backgroundColor: '#BDBDBD' },
  exchangeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
