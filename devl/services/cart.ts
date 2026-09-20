import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Gifticon } from './api';
import { authInstance } from '../firebase';

/**
 * 장바구니는 유저별로 분리 저장한다.
 * 계정 전환/탈퇴 후 재가입 시 이전 계정의 장바구니가 남지 않도록 key에 uid를 포함.
 * 비로그인 상태에서는 공용 키(@gifticon_cart:anon)를 사용 — 로그인하면 버린다.
 */
const GUEST_KEY = '@gifticon_cart:anon';
const USER_KEY_PREFIX = '@gifticon_cart:';

function cartKey(): string {
  const uid = authInstance.currentUser?.uid;
  return uid ? `${USER_KEY_PREFIX}${uid}` : GUEST_KEY;
}

export type CartItem = {
  gifticonId: string;
  name: string;
  brand: string;
  image: string;
  pointCost: number;
  addedAt: string;
};

export async function getCart(): Promise<CartItem[]> {
  try {
    const json = await AsyncStorage.getItem(cartKey());
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function addToCart(g: Gifticon): Promise<void> {
  const cart = await getCart();
  if (cart.find(c => c.gifticonId === g.id)) return;
  cart.push({
    gifticonId: g.id,
    name: g.name,
    brand: g.brand,
    image: g.image,
    pointCost: g.pointCost,
    addedAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(cartKey(), JSON.stringify(cart));
}

export async function removeFromCart(gifticonId: string): Promise<void> {
  const cart = await getCart();
  const filtered = cart.filter(c => c.gifticonId !== gifticonId);
  await AsyncStorage.setItem(cartKey(), JSON.stringify(filtered));
}

export async function clearCart(): Promise<void> {
  await AsyncStorage.removeItem(cartKey());
}

export async function getCartCount(): Promise<number> {
  const cart = await getCart();
  return cart.length;
}

/** 로그아웃/탈퇴 시 호출 — 모든 유저의 장바구니 데이터 삭제 (로컬 기기에 남은 개인정보 정리) */
export async function clearAllCartsOnDevice(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cartKeys = keys.filter(
      k => k === GUEST_KEY || (typeof k === 'string' && k.startsWith(USER_KEY_PREFIX))
    );
    if (cartKeys.length > 0) {
      await AsyncStorage.multiRemove(cartKeys);
    }
  } catch {}
}

/** 기존 레거시 키 마이그레이션 — 이전 "@gifticon_cart" 키 데이터가 남아있으면 제거. */
export async function cleanupLegacyCart(): Promise<void> {
  try {
    await AsyncStorage.removeItem('@gifticon_cart');
  } catch {}
}
