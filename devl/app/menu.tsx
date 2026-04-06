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
import { useAuth } from './_layout';
import { signOut, deleteUser } from 'firebase/auth';
import { authInstance } from '../firebase';
import { deleteUserAccount } from '../services/api';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as KakaoLogin from '@react-native-seoul/kakao-login';

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
            // Google/카카오 로그아웃도 처리
            try { await GoogleSignin.signOut(); } catch (_) {}
            try { await KakaoLogin.logout(); } catch (_) {}
            await signOut(authInstance);
            router.replace('/(auth)/welcome');
          } catch (e) {
            console.warn('로그아웃 실패:', e);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('회원탈퇴', '정말 탈퇴하시겠어요? 모든 데이터가 삭제되며 복구할 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: async () => {
          try {
            const user = authInstance.currentUser;
            if (user) {
              // 1) 소셜 연결 해제 (카카오 unlink, 구글 revokeAccess)
              const providerId = user.providerData[0]?.providerId;
              try {
                if (providerId === 'google.com') {
                  await GoogleSignin.revokeAccess();
                } else if (user.uid.startsWith('kakao:')) {
                  await KakaoLogin.unlink();
                }
              } catch (_) {}

              // 3) 서버에서 사용자 데이터 삭제
              try {
                await deleteUserAccount(user.uid);
              } catch (e) {
                console.warn('서버 데이터 삭제 실패:', e);
              }
              // 4) Firebase Auth 계정 삭제
              await deleteUser(user);
            }
            router.replace('/(auth)/welcome');
          } catch (e: any) {
            if (e?.code === 'auth/requires-recent-login') {
              Alert.alert(
                '재인증 필요',
                '보안을 위해 로그아웃 후 다시 로그인한 뒤 탈퇴해주세요.',
                [{ text: '확인', onPress: () => signOut(authInstance).then(() => router.replace('/(auth)/welcome')) }]
              );
            } else {
              Alert.alert('오류', '회원탈퇴에 실패했습니다. 다시 시도해주세요.');
              console.warn('회원탈퇴 실패:', e);
            }
          }
        },
      },
    ]);
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
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Admin Section - 관리자만 표시 */}
        {userProfile?.role === 'admin' && (
          <>
            <Text style={styles.sectionTitle}>관리자</Text>
            <View style={styles.section}>
              <TouchableOpacity style={styles.row} onPress={() => router.push('/admin/recipes')}>
                <Text style={[styles.rowText, { color: '#0B9A61' }]}>레시피 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={() => router.push('/admin/users')}>
                <Text style={[styles.rowText, { color: '#0B9A61' }]}>유저 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={() => router.push('/admin/community')}>
                <Text style={[styles.rowText, { color: '#0B9A61' }]}>커뮤니티 관리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push('/admin/reports')}>
                <Text style={[styles.rowText, { color: '#0B9A61' }]}>신고 처리</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Section: 내 정보 */}
        <Text style={styles.sectionTitle}>내 정보</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/my-activity')}>
            <Text style={styles.rowText}>내 활동</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.back()}>
            <Text style={styles.rowText}>내 레시피</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.back()}>
            <Text style={styles.rowText}>저장한 레시피</Text>
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

        {/* App Version */}
        <Text style={styles.version}>앱 버전 1.0.0</Text>

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
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
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
  version: { textAlign: 'center', fontSize: 13, color: '#BBB', marginTop: 24 },
});
