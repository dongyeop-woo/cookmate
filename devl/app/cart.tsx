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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { getCart, removeFromCart, type CartItem } from '../services/cart';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const points = userProfile?.points ?? 0;

  useFocusEffect(useCallback(() => {
    getCart().then((items) => {
      setCart(items);
      setSelectedIds(new Set(items.map(i => i.gifticonId)));
    }).finally(() => setLoading(false));
  }, []));

  const selectedItems = cart.filter(c => selectedIds.has(c.gifticonId));
  const total = selectedItems.reduce((sum, c) => sum + c.pointCost, 0);
  const allSelected = cart.length > 0 && selectedIds.size === cart.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(cart.map(c => c.gifticonId)));
  };

  const removeSelected = async () => {
    for (const id of selectedIds) {
      await removeFromCart(id);
    }
    setCart(prev => prev.filter(c => !selectedIds.has(c.gifticonId)));
    setSelectedIds(new Set());
  };

  const handleRemove = async (id: string) => {
    await removeFromCart(id);
    setCart(prev => prev.filter(c => c.gifticonId !== id));
  };

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      Alert.alert('상품 선택', '교환할 상품을 선택해주세요.');
      return;
    }
    if (points < total) {
      Alert.alert('포인트 부족', `${(total - points).toLocaleString()}P가 더 필요해요.`);
      return;
    }
    const payload = selectedItems.map(i => ({
      gifticonId: i.gifticonId,
      name: i.name,
      brand: i.brand,
      image: i.image,
      pointCost: i.pointCost,
    }));
    router.push({ pathname: '/order', params: { items: JSON.stringify(payload), fromCart: '1' } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>장바구니</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : cart.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={64} color="#E0E0E0" />
          <Text style={styles.emptyText}>장바구니가 비어있어요</Text>
        </View>
      ) : (
        <>
          {/* 전체선택 */}
          <View style={styles.selectAllRow}>
            <TouchableOpacity onPress={toggleAll} style={styles.selectAllLeft} activeOpacity={0.7}>
              <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
                {allSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.selectAllText}>전체선택</Text>
            </TouchableOpacity>
            {selectedIds.size > 0 && (
              <TouchableOpacity onPress={removeSelected}>
                <Text style={styles.selectDeleteText}>선택삭제</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={cart}
            keyExtractor={(item) => item.gifticonId}
            contentContainerStyle={{ paddingBottom: 180 }}
            renderItem={({ item }) => {
              const checked = selectedIds.has(item.gifticonId);
              return (
                <View style={styles.item}>
                  <TouchableOpacity onPress={() => toggleSelect(item.gifticonId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                      <Ionicons name="gift" size={28} color="#DCDCDC" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemBrand}>{item.brand}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemPrice}>{item.pointCost.toLocaleString()}P</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(item.gifticonId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={20} color="#BBB" />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>내 포인트</Text>
              <Text style={styles.summaryValue}>{points.toLocaleString()}P</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>총 교환 포인트</Text>
              <Text style={styles.summaryValue}>{total.toLocaleString()}P</Text>
            </View>
            {points < total && (
              <View style={styles.summaryRow}>
                <Text style={styles.shortageLabel}>부족한 포인트</Text>
                <Text style={styles.shortageValue}>{(total - points).toLocaleString()}P</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>결제 예정</Text>
              <Text style={styles.totalValue}>{total.toLocaleString()}P</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutBtn, points < total && styles.checkoutBtnDisabled]}
              onPress={handleCheckout}
              disabled={points < total}
            >
              <Text style={styles.checkoutBtnText}>
                {points < total ? '포인트 부족' : `${selectedItems.length}개 교환하기`}
              </Text>
            </TouchableOpacity>
          </View>
        </>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  emptyText: { fontSize: 14, color: '#999' },
  shopBtn: {
    backgroundColor: '#1BAE74',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  shopBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F5F5F5',
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },
  itemImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemBrand: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
  },
  summaryValue: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  shortageLabel: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '600',
  },
  shortageValue: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  checkoutBtn: {
    backgroundColor: '#1BAE74',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  checkoutBtnDisabled: {
    backgroundColor: '#BDBDBD',
  },
  checkoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  selectAllLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectAllText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  selectDeleteText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1BAE74',
    borderColor: '#1BAE74',
  },
});
