import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import { signOut, deleteUser } from 'firebase/auth';
import { authInstance } from '../firebase';
import { deleteUserAccount, clearAllCache, clearTokenCache, updatePushToken } from '../services/api';
import { clearCart } from '../services/cart';
import { clearFridge } from '../services/fridge';
import { logoutPurchases } from '../services/premium';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as KakaoLogin from '@react-native-seoul/kakao-login';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MenuScreen() {
  const router = useRouter();
  const { userProfile, firebaseUser } = useAuth();

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          try {
            // 서버에서 이 계정의 푸시 토큰 제거 (다른 계정 로그인 시 엉뚱한 계정에 알림 가지 않도록)
            const prevUid = firebaseUser?.uid;
            if (prevUid) {
              try { await updatePushToken(prevUid, ''); } catch {}
            }
            // Google/카카오 로그아웃도 처리
            try { await GoogleSignin.signOut(); } catch (_) {}
            try { await KakaoLogin.logout(); } catch (_) {}
            await signOut(authInstance);
            // RC appUserID 분리 + 프리미엄 캐시 클리어 — 다음 사용자에게 이전 구독 적용 방지
            try { await logoutPurchases(); } catch {}
            clearAllCache();
            clearTokenCache();
            // 로그아웃은 장바구니를 지우지 않음 — 재로그인 시 복원되도록
            router.replace('/(auth)/welcome');
          } catch (e) {
            console.warn('로그아웃 실패:', e);
          }
        },
      },
    ]);
  };

  const performAccountDeletion = async (purgeContent: boolean) => {
    try {
      const user = authInstance.currentUser;
      if (user) {
        // 1) 서버에서 사용자 데이터 처리 (익명화 or 콘텐츠까지 삭제)
        try {
          await deleteUserAccount(user.uid, purgeContent);
        } catch (e) {
          console.warn('서버 데이터 삭제 실패:', e);
          throw e;
        }

        // 2) 소셜 연결 해제 (best-effort, 실패해도 진행)
        const providerId = user.providerData[0]?.providerId;
        try {
          if (providerId === 'google.com') {
            await GoogleSignin.revokeAccess();
          } else if (user.uid.startsWith('kakao:')) {
            await KakaoLogin.unlink();
          }
        } catch (_) {}

        // 3) Firebase Auth 계정 삭제 (실패 무시)
        try {
          await deleteUser(user);
        } catch (e: any) {
          console.warn('Firebase Auth 계정 삭제 실패 (무시):', e?.code);
        }

        try { await clearCart(); } catch {}
        try { await signOut(authInstance); } catch (_) {}
        // 탈퇴 시에도 RC 분리 + 캐시 클리어
        try { await logoutPurchases(); } catch {}
      }
      clearAllCache();
      clearTokenCache();
      router.replace('/(auth)/welcome');
    } catch (e: any) {
      Alert.alert('오류', '회원탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.');
      console.warn('회원탈퇴 실패:', e);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원탈퇴',
      '정말 탈퇴하시겠어요?\n\n• 개인정보(이름/이메일/전화번호 등)는 즉시 익명 처리됩니다.\n• 작성하신 레시피·후기·댓글은 익명(탈퇴한 사용자) 상태로 그대로 남습니다.\n• 법정 보존 의무가 있는 기록만 익명 상태로 보관됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () => performAccountDeletion(false),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerName}>
            {userProfile?.nickname || firebaseUser?.displayName || '요리사님'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Admin Section - 관리자만 표시 */}
        {userProfile?.role === 'admin' && (
          <View style={styles.adminWrapper}>
            <View style={styles.adminTitleRow}>
              <Ionicons name="shield-checkmark" size={14} color="#14B86F" style={{ marginRight: 6 }} />
              <Text style={styles.adminSectionTitle}>관리자</Text>
            </View>
            <View style={styles.adminSection}>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/recipes')}>
                <Text style={styles.adminRowText}>레시피 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/users')}>
                <Text style={styles.adminRowText}>유저 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/community')}>
                <Text style={styles.adminRowText}>커뮤니티 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/reports')}>
                <Text style={styles.adminRowText}>신고 처리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/inquiries')}>
                <Text style={styles.adminRowText}>문의 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/refunds')}>
                <Text style={styles.adminRowText}>환불 요청 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/dashboard')}>
                <Text style={styles.adminRowText}>통계 대시보드</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/custom-ingredients')}>
                <Text style={styles.adminRowText}>커스텀 재료 수집</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminRow} onPress={() => router.push('/admin/failed-searches')}>
                <Text style={styles.adminRowText}>검색 실패 쿼리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.adminRow, { borderBottomWidth: 0 }]} onPress={() => router.push('/admin/cooking-dropoff')}>
                <Text style={styles.adminRowText}>요리모드 이탈 지점</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section: 내 정보 */}
        <Text style={styles.sectionTitle}>내 정보</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/my-points')}>
            <Text style={styles.rowText}>포인트</Text>
            <Text style={styles.pointsValue}>{userProfile?.points ?? 0}P</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push('/my-activity')}>
            <Text style={styles.rowText}>내 활동</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Section: 고객지원 */}
        <Text style={styles.sectionTitle}>고객지원</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/settings')}>
            <Text style={styles.rowText}>설정</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/announcements')}>
            <Text style={styles.rowText}>공지사항</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push('/contact')}>
            <Text style={styles.rowText}>고객센터 / 문의하기</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Section: 약관 및 정책 */}
        <Text style={styles.sectionTitle}>약관 및 정책</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/(auth)/terms-service')}>
            <Text style={styles.rowText}>서비스 이용약관</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push('/(auth)/terms-privacy')}>
            <Text style={styles.rowText}>개인정보 처리방침</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Section: 계정 */}
        <Text style={styles.sectionTitle}>계정</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Text style={[styles.rowText, { color: '#FF3B30' }]}>로그아웃</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleDeleteAccount}>
            <Text style={[styles.rowText, { color: '#FF3B30' }]}>회원탈퇴</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App Version — app.json의 expo.version 자동 반영 (수동 갱신 불필요) */}
        <Text style={styles.version}>앱 버전 {Constants.expoConfig?.version ?? '—'}</Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  headerName: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  headerBio: { fontSize: 14, color: '#888' },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: { fontSize: 16, color: '#666', fontWeight: '600' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: { backgroundColor: '#FFFFFF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  rowArrow: { fontSize: 20, color: '#CCC', fontWeight: '300' },
  pointsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  version: { textAlign: 'center', fontSize: 13, color: '#BBB', marginTop: 24 },
  adminWrapper: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#F1FBF5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6F0E1',
    overflow: 'hidden',
  },
  adminTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  adminSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14B86F',
    letterSpacing: 0.3,
  },
  adminSection: { backgroundColor: 'transparent' },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCEEE3',
  },
  adminRowText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
});
