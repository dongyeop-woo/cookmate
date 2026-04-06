import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { fetchUser, fetchCommunityRecipes, fetchRecipes, followUser, unfollowUser } from '../../services/api';
import type { CommunityRecipe } from '../../constants/community';
import { useAuth } from '../_layout';

type RecipeItem = { id: string; image: string; type: 'community' | 'recipe' };

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const GRID_SIZE = (width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const defaultAvatarMale = require('../../assets/man.png');
const defaultAvatarFemale = require('../../assets/girl.png');

type UserProfile = {
  uid: string;
  nickname: string;
  profileImage: string;
  bio: string;
  gender: 'male' | 'female' | '';
  followers: string[];
  following: string[];
  recipeCount: number;
  totalLikes: number;
  role?: string;
};

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { firebaseUser, userProfile: myProfile, setUserProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const isMe = firebaseUser?.uid === uid;
  const isFollowing = myProfile?.following?.includes(uid ?? '') ?? false;

  const handleFollow = async () => {
    if (!firebaseUser?.uid || !uid || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(firebaseUser.uid, uid);
        setUserProfile(myProfile ? {
          ...myProfile,
          following: myProfile.following.filter(id => id !== uid),
        } : null);
        setProfile(prev => prev ? {
          ...prev,
          followers: prev.followers.filter(id => id !== firebaseUser.uid),
        } : null);
      } else {
        await followUser(firebaseUser.uid, uid);
        setUserProfile(myProfile ? {
          ...myProfile,
          following: [...myProfile.following, uid],
        } : null);
        setProfile(prev => prev ? {
          ...prev,
          followers: [...prev.followers, firebaseUser.uid],
        } : null);
      }
    } catch (e) {
      console.warn('팔로우 실패:', e);
    } finally {
      setFollowLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      setLoading(true);
      (async () => {
        try {
          const [user, communityRecipes, regularRecipes] = await Promise.all([
            fetchUser(uid),
            fetchCommunityRecipes(),
            fetchRecipes(),
          ]);
          if (user) {
            setProfile(user);
            const myCommunity = communityRecipes
              .filter(r => (r.authorUid && r.authorUid === uid) || r.author === user.nickname)
              .map(r => ({ id: r.id, image: r.image || '', type: 'community' as const }));
            const myRegular = regularRecipes
              .filter(r => r.author === user.nickname)
              .map(r => ({ id: r.id, image: r.image || '', type: 'recipe' as const }));
            setRecipes([...myRegular, ...myCommunity]);
          }
        } catch (e) {
          console.warn('프로필 로드 실패:', e);
        } finally {
          setLoading(false);
        }
      })();
    }, [uid])
  );

  const isValidImageUri = (uri?: string) => !!uri && uri !== 'default' && (uri.startsWith('https://') || uri.startsWith('http://'));
  const isDefaultImage = !isValidImageUri(profile?.profileImage);
  const defaultAvatarSource = profile?.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0B9A61" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>존재하지 않는 사용자입니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalLikes = profile.totalLikes ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile.nickname}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={[styles.avatar, profile.role === 'admin' && styles.avatarAdmin]}>
            {isDefaultImage ? (
              <Image source={defaultAvatarSource} style={{ width: 84, height: 84, borderRadius: 42 }} />
            ) : (
              <Image source={{ uri: profile.profileImage }} style={{ width: 84, height: 84, borderRadius: 42 }} />
            )}
          </View>
          <Text style={styles.nickname}>{profile.nickname}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {!isMe && firebaseUser && (
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              onPress={handleFollow}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {followLoading ? '...' : isFollowing ? '팔로잉' : '팔로우'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{recipes.length}</Text>
            <Text style={styles.statLabel}>레시피</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{profile.followers?.length || 0}</Text>
            <Text style={styles.statLabel}>팔로워</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalLikes}</Text>
            <Text style={styles.statLabel}>좋아요</Text>
          </View>
        </View>

        {/* Recipe Grid */}
        {recipes.length > 0 ? (
          <View style={styles.grid}>
            {recipes.map((recipe) => (
              <TouchableOpacity
                key={`${recipe.type}-${recipe.id}`}
                style={styles.gridItem}
                onPress={() => router.push(
                  recipe.type === 'community' ? `/recipe/${recipe.id}?type=community` : `/recipe/${recipe.id}`
                )}
              >
                {recipe.image ? (
                  <Image source={{ uri: recipe.image }} style={styles.gridImage} />
                ) : (
                  <View style={[styles.gridImage, styles.gridPlaceholder]}>
                    <Text style={styles.gridPlaceholderText}>🍳</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>아직 작성한 레시피가 없습니다.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { fontSize: 24, color: '#1A1A1A' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  profileSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F0F0F0',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarAdmin: {
    borderWidth: 2.5,
    borderColor: '#0B9A61',
  },
  nickname: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  followBtn: {
    marginTop: 14,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#0B9A61',
  },
  followingBtn: {
    backgroundColor: '#F0F0F0',
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  followingBtnText: {
    color: '#888',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    marginBottom: 2,
  },
  statItem: { alignItems: 'center', marginHorizontal: 24 },
  statNum: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPlaceholderText: { fontSize: 28 },
  emptySection: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});
