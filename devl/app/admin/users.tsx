import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, TextInput,
  Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchAllUsers, setUserRole, setUserPremium, deleteUserAccount } from '../../services/api';
import type { UserProfile } from '../../services/api';

const defaultAvatarMale = require('../../assets/man.png');
const defaultAvatarFemale = require('../../assets/girl.png');
const isValidImageUri = (uri?: string) => !!uri && uri !== 'default' && (uri.startsWith('https://') || uri.startsWith('http://'));

// 유저 아바타 — 깨진 URL(404 등)도 폴백되도록 onError 처리.
function UserAvatar({ uri, gender }: { uri?: string; gender?: 'male' | 'female' | '' }) {
  const [errored, setErrored] = React.useState(false);
  const fallback = gender === 'female' ? defaultAvatarFemale : defaultAvatarMale;
  if (errored || !isValidImageUri(uri)) {
    return <RNImage source={fallback} style={styles.avatar} />;
  }
  return <RNImage source={{ uri }} style={styles.avatar} onError={() => setErrored(true)} />;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.nickname || '').toLowerCase().includes(q));
  }, [users, searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch {
      Alert.alert('오류', '유저 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const toggleAdmin = (user: UserProfile) => {
    const isAdmin = user.role === 'admin';
    Alert.alert(
      isAdmin ? '관리자 해제' : '관리자 부여',
      `${user.nickname}님을 ${isAdmin ? '일반 유저' : '관리자'}로 변경하시겠어요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          onPress: async () => {
            try {
              await setUserRole(user.uid, isAdmin ? 'user' : 'admin');
              setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: isAdmin ? 'user' : 'admin' } as any : u));
            } catch { Alert.alert('오류', '변경에 실패했습니다.'); }
          },
        },
      ],
    );
  };

  const togglePremium = (user: UserProfile) => {
    const isPrem = (user as any).isPremium;
    const message = isPrem
      ? `${user.nickname}님의 프리미엄을 해제하시겠어요?\n\n참고: 앱 내 프리미엄 기능만 차단됩니다. Apple/Google 구독료 청구는 자동 중단되지 않으며, 환불이 필요하면 App Store Connect에서 별도 처리하세요.`
      : `${user.nickname}님에게 프리미엄을 부여하시겠어요?`;
    Alert.alert(
      isPrem ? '구독 해제' : '구독 부여',
      message,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          onPress: async () => {
            try {
              await setUserPremium(user.uid, !isPrem);
              setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, isPremium: !isPrem } as any : u));
            } catch { Alert.alert('오류', '변경에 실패했습니다.'); }
          },
        },
      ],
    );
  };

  const handleDelete = (user: UserProfile) => {
    Alert.alert('계정 삭제', `${user.nickname}님의 계정을 삭제하시겠어요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await deleteUserAccount(user.uid);
            setUsers(prev => prev.filter(u => u.uid !== user.uid));
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>유저 관리</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={styles.count}>{filteredUsers.length}명</Text>
          <TouchableOpacity
            onPress={() => {
              setSearchOpen(prev => {
                if (prev) setSearchQuery('');
                return !prev;
              });
            }}
            hitSlop={10}
          >
            <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="작성자 닉네임으로 검색"
            placeholderTextColor="#BDBDBD"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color="#C4C4C4" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1A1A1A" />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.uid}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.infoTouchable}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/my-points', params: { uid: item.uid } })}
              >
                <UserAvatar uri={item.profileImage} gender={item.gender} />
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.nickname}</Text>
                    {item.role === 'admin' && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>관리자</Text>
                      </View>
                    )}
                    {(item as any).isPremium && (
                      <View style={styles.premiumBadge}>
                        <Text style={styles.premiumBadgeText}>구독자</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sub} numberOfLines={1}>{item.email}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.roleBtn} onPress={() => toggleAdmin(item)}>
                <Ionicons name="shield-outline" size={18} color={item.role === 'admin' ? '#1A1A1A' : '#BDBDBD'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.roleBtn} onPress={() => togglePremium(item)}>
                <Ionicons name="diamond-outline" size={18} color={(item as any).isPremium ? '#C8A24E' : '#BDBDBD'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={18} color="#FF4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  titleWrap: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  count: { fontSize: 13, color: '#999' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A', padding: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F5F5F5',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  infoTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  adminBadge: {
    backgroundColor: '#E8F8F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: '#1A1A1A' },
  premiumBadge: {
    backgroundColor: '#FFF8E8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  premiumBadgeText: { fontSize: 11, fontWeight: '700', color: '#C8A24E' },
  sub: { fontSize: 12, color: '#999', marginTop: 2 },
  roleBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
});
