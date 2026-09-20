import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { fetchGifticons, exchangeGifticon, fetchUser } from '../services/api';
import type { Gifticon } from '../services/api';

export default function GifticonStoreScreen() {
  const router = useRouter();
  const { userProfile, firebaseUser, setUserProfile } = useAuth();
  const [gifticons, setGifticons] = useState<Gifticon[]>([]);
  const [points, setPoints] = useState(userProfile?.points ?? 0);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [list, fresh] = await Promise.all([
            fetchGifticons(),
            firebaseUser?.uid ? fetchUser(firebaseUser.uid) : null,
          ]);
          setGifticons(list);
          if (fresh) setPoints(fresh.points ?? 0);
        } catch (e) {
          console.warn('기프티콘 로드 실패:', e);
        } finally {
          setLoading(false);
        }
      })();
    }, [firebaseUser?.uid])
  );

  const handleExchange = (gifticon: Gifticon) => {
    if (points < gifticon.pointCost) {
      Alert.alert('포인트 부족', `${(gifticon.pointCost - points).toLocaleString()}P가 더 필요해요.`);
      return;
    }
    Alert.alert(
      '기프티콘 교환',
      `${gifticon.name}을(를) ${gifticon.pointCost.toLocaleString()}P로 교환할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '교환하기',
          onPress: async () => {
            if (!firebaseUser?.uid) return;
            setExchanging(gifticon.id);
            try {
              await exchangeGifticon(firebaseUser.uid, gifticon.id);
              const fresh = await fetchUser(firebaseUser.uid);
              if (fresh) {
                setPoints(fresh.points ?? 0);
                setUserProfile(fresh as any);
              }
              setGifticons(prev =>
                prev.map(g => g.id === gifticon.id ? { ...g, stock: g.stock - 1 } : g)
              );
              Alert.alert('교환 완료!', `${gifticon.name} 기프티콘이 발급되었어요.`);
            } catch (e: any) {
              Alert.alert('교환 실패', e.message || '다시 시도해주세요.');
            } finally {
              setExchanging(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>기프티콘 스토어</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* 보유 포인트 바 */}
      <View style={styles.pointsBar}>
        <Text style={styles.pointsBarLabel}>보유 포인트</Text>
        <Text style={styles.pointsBarAmount}>{points.toLocaleString()}P</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : gifticons.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="gift-outline" size={56} color="#E0E0E0" />
          <Text style={styles.emptyText}>준비 중인 기프티콘이에요</Text>
          <Text style={styles.emptySub}>곧 다양한 상품이 추가될 예정이에요!</Text>
        </View>
      ) : (
        <FlatList
          data={gifticons}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const canAfford = points >= item.pointCost;
            const outOfStock = item.stock <= 0;
            const disabled = !canAfford || outOfStock || exchanging === item.id;
            return (
              <View style={styles.card}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.cardImage} cachePolicy="disk" contentFit="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Ionicons name="gift" size={32} color="#BDBDBD" />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardBrand}>{item.brand}</Text>
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardCost}>{item.pointCost.toLocaleString()}P</Text>
                  <TouchableOpacity
                    style={[styles.exchangeBtn, disabled && styles.exchangeBtnDisabled]}
                    disabled={disabled}
                    onPress={() => handleExchange(item)}
                    activeOpacity={0.8}
                  >
                    {exchanging === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.exchangeBtnText, disabled && styles.exchangeBtnTextDisabled]}>
                        {outOfStock ? '품절' : !canAfford ? '포인트 부족' : '교환'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {outOfStock && <View style={styles.soldOutOverlay}><Text style={styles.soldOutText}>SOLD OUT</Text></View>}
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  // 포인트 바
  pointsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F5F5F7',
    marginBottom: 8,
  },
  pointsBarLabel: {
    fontSize: 14,
    color: '#666',
  },
  pointsBarAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  // 그리드
  grid: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },

  // 카드
  card: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0F0F0',
  },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: 12,
  },
  cardBrand: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    marginBottom: 2,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 19,
    marginBottom: 6,
  },
  cardCost: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  exchangeBtn: {
    backgroundColor: '#1BAE74',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  exchangeBtnDisabled: {
    backgroundColor: '#E8E8E8',
  },
  exchangeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  exchangeBtnTextDisabled: {
    color: '#BBB',
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  soldOutText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#BDBDBD',
    letterSpacing: 2,
  },

  // 빈 상태
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  emptySub: {
    fontSize: 13,
    color: '#BDBDBD',
  },
});
