import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { fetchUser, unblockUser, type UserProfile } from '../services/api';

const defaultAvatarMale = require('../assets/man.png');
const defaultAvatarFemale = require('../assets/girl.png');

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { firebaseUser, userProfile, setUserProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const blockedUids = (userProfile as any)?.blockedUids ?? [];

  const loadUsers = useCallback(async () => {
    if (blockedUids.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fetched = await Promise.all(blockedUids.map((uid: string) => fetchUser(uid)));
      setUsers(fetched.filter(Boolean) as UserProfile[]);
    } catch (e) {
      console.warn('차단 목록 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [blockedUids.join(',')]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUnblock = (target: UserProfile) => {
    if (!firebaseUser?.uid) return;
    Alert.alert(
      '차단 해제',
      `${target.nickname}님의 차단을 해제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          style: 'destructive',
          onPress: async () => {
            const myUid = firebaseUser.uid;
            const prev = blockedUids as string[];
            const next = prev.filter((id) => id !== target.uid);
            setPendingUid(target.uid);
            if (userProfile) {
              setUserProfile({ ...(userProfile as any), blockedUids: next } as any);
            }
            setUsers((arr) => arr.filter((u) => u.uid !== target.uid));
            try {
              await unblockUser(myUid, target.uid);
            } catch (e) {
              if (userProfile) {
                setUserProfile({ ...(userProfile as any), blockedUids: prev } as any);
              }
              setUsers((arr) => [...arr, target]);
              Alert.alert('오류', '차단 해제에 실패했습니다.');
            } finally {
              setPendingUid(null);
            }
          },
        },
      ],
    );
  };

  const isValidImage = (uri?: string) =>
    !!uri && uri !== 'default' && (uri.startsWith('http://') || uri.startsWith('https://'));

  const renderItem = ({ item }: { item: UserProfile }) => {
    const fallback = item.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale;
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/profile/${item.uid}`)}
          activeOpacity={0.7}
        >
          {isValidImage(item.profileImage) ? (
            <RNImage source={{ uri: item.profileImage }} style={styles.avatar} />
          ) : (
            <RNImage source={fallback} style={styles.avatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.nickname} numberOfLines={1}>{item.nickname}</Text>
            {item.bio ? (
              <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unblockBtn, pendingUid === item.uid && { opacity: 0.5 }]}
          onPress={() => handleUnblock(item)}
          disabled={pendingUid === item.uid}
          activeOpacity={0.7}
        >
          <Text style={styles.unblockBtnText}>차단 해제</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>차단한 사용자</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="ban-outline" size={48} color="#E0E0E0" />
          <Text style={styles.emptyText}>차단한 사용자가 없습니다</Text>
          <Text style={styles.emptyHint}>
            다른 사용자의 프로필에서 메뉴를 눌러 차단할 수 있습니다.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#9E9E9E', fontWeight: '500' },
  emptyHint: { marginTop: 6, fontSize: 13, color: '#BDBDBD', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  nickname: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  bio: { fontSize: 13, color: '#888', marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
  },
  unblockBtnText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
});
