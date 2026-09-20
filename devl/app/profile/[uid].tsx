import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Platform,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { fetchUser, fetchCommunityRecipes, fetchRecipes, followUser, unfollowUser, fetchRecipeById, blockUser, unblockUser } from '../../services/api';
import { isRemoteProfileImage } from '../../services/profileImage';
import type { UserProfile as UserProfileType } from '../../services/api';
import { useAuth } from '../_layout';
import { Ionicons } from '@expo/vector-icons';
import KakaoShareLink from 'react-native-kakao-share-link';

type RecipeItem = { id: string; image: string; type: 'community' | 'recipe' };

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const GRID_SIZE = Math.floor((width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

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
  const insets = useSafeAreaInsets();
  const { firebaseUser, userProfile: myProfile, setUserProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [followListVisible, setFollowListVisible] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [followSearch, setFollowSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'grid' | 'liked'>('grid');
  const [likedRecipes, setLikedRecipes] = useState<RecipeItem[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [followListData, setFollowListData] = useState<UserProfileType[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const isMe = firebaseUser?.uid === uid;
  const isFollowing = myProfile?.following?.includes(uid ?? '') ?? false;
  const isBlocked = (myProfile as any)?.blockedUids?.includes(uid ?? '') ?? false;
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const handleToggleBlock = async () => {
    if (!firebaseUser?.uid || !uid || blockLoading) return;
    setMenuVisible(false);
    const myUid = firebaseUser.uid;
    const wasBlocked = isBlocked;

    const prevBlocked = ((myProfile as any)?.blockedUids ?? []) as string[];
    const nextBlocked = wasBlocked
      ? prevBlocked.filter((id) => id !== uid)
      : [...prevBlocked, uid];
    if (myProfile) {
      setUserProfile({ ...(myProfile as any), blockedUids: nextBlocked } as any);
    }

    setBlockLoading(true);
    try {
      if (wasBlocked) {
        await unblockUser(myUid, uid);
      } else {
        await blockUser(myUid, uid);
      }
      Alert.alert(wasBlocked ? '차단 해제됨' : '차단됨', wasBlocked
        ? '이 사용자의 차단을 해제했습니다.'
        : '이 사용자를 차단했습니다. 상호 팔로우가 해제되며, 알림도 더 이상 받지 않습니다.');
    } catch (e) {
      if (myProfile) {
        setUserProfile({ ...(myProfile as any), blockedUids: prevBlocked } as any);
      }
      Alert.alert('오류', '요청을 처리하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleShareProfile = async () => {
    if (!uid || !profile) return;
    setMenuVisible(false);
    const nickname = profile.nickname || '요리사';
    const profileImage = profile.profileImage && profile.profileImage !== 'default' && profile.profileImage.startsWith('http')
      ? profile.profileImage
      : 'https://yojalal.com/img/default-profile.png';
    const webUrl = `https://yojalal.com/profile/${uid}`;
    const link = {
      webUrl,
      mobileWebUrl: webUrl,
    };
    try {
      await KakaoShareLink.sendFeed({
        content: {
          title: `${nickname}님의 요리 레시피를 구경해보세요!`,
          imageUrl: profileImage,
          link,
          description: '다양한 레시피와 조리 방법을 유저들과 공유해보세요.',
        },
        buttons: [
          { title: '프로필 보기', link },
        ],
      });
    } catch (e) {
      Alert.alert('공유 실패', '카카오톡이 설치되어 있는지 확인해주세요.');
    }
  };

  const confirmBlock = () => {
    if (isBlocked) {
      handleToggleBlock();
      return;
    }
    Alert.alert(
      '사용자 차단',
      `${profile?.nickname ?? '이 사용자'}님을 차단하시겠습니까?\n\n차단하면 이 사용자의 게시물과 댓글이 표시되지 않습니다.`,
      [
        { text: '취소', style: 'cancel', onPress: () => setMenuVisible(false) },
        { text: '차단', style: 'destructive', onPress: handleToggleBlock },
      ],
    );
  };

  const formatCount = (n: number) => {
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '천';
    return String(n);
  };

  const followReqIdRef = useRef(0);
  const loadFollowList = useCallback(async (type: 'followers' | 'following') => {
    const reqId = ++followReqIdRef.current;
    const uids = type === 'followers' ? (profile?.followers ?? []) : (profile?.following ?? []);
    if (uids.length === 0) {
      if (followReqIdRef.current === reqId) {
        setFollowListData([]);
        setFollowListLoading(false);
      }
      return;
    }
    setFollowListLoading(true);
    setFollowListData([]);
    try {
      const users = await Promise.all(uids.map(uid => fetchUser(uid)));
      if (followReqIdRef.current !== reqId) return;
      setFollowListData(users.filter(Boolean) as UserProfileType[]);
    } catch {
      if (followReqIdRef.current === reqId) setFollowListData([]);
    } finally {
      if (followReqIdRef.current === reqId) setFollowListLoading(false);
    }
  }, [profile?.followers, profile?.following]);

  useEffect(() => {
    if (followListVisible) loadFollowList(followListType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followListType, followListVisible]);

  useEffect(() => {
    if (activeTab !== 'liked' || !profile?.likedRecipes?.length) {
      if (activeTab === 'liked') setLikedRecipes([]);
      return;
    }
    (async () => {
      setLikedLoading(true);
      try {
        const fetched = await Promise.all(
          (profile.likedRecipes || []).slice(0, 60).map(async (rid) => {
            try {
              const r = await fetchRecipeById(rid);
              return r ? { id: r.id, image: r.image, type: 'recipe' as const } : null;
            } catch { return null; }
          })
        );
        setLikedRecipes(fetched.filter((r): r is RecipeItem => r !== null));
      } finally {
        setLikedLoading(false);
      }
    })();
  }, [activeTab, profile?.likedRecipes]);

  const openFollowList = (type: 'followers' | 'following') => {
    setFollowListType(type);
    setFollowSearch('');
    setFollowListVisible(true);
    loadFollowList(type);
  };

  const handleFollow = async () => {
    if (!firebaseUser?.uid || !uid || followLoading) return;
    // Optimistic update — UI 즉시 반영 후 백엔드 호출.
    // 실패 시 원상복구.
    const myUid = firebaseUser.uid;
    const wasFollowing = isFollowing;
    const prevProfile = profile;
    const prevMyProfile = myProfile;

    setProfile(prev => prev ? {
      ...prev,
      followers: wasFollowing
        ? prev.followers.filter(id => id !== myUid)
        : [...prev.followers, myUid],
    } : null);
    if (myProfile) {
      setUserProfile({
        ...myProfile,
        following: wasFollowing
          ? (myProfile.following || []).filter(id => id !== uid)
          : [...(myProfile.following || []), uid],
      } as any);
    }

    setFollowLoading(true);
    try {
      if (wasFollowing) {
        await unfollowUser(myUid, uid);
      } else {
        await followUser(myUid, uid);
      }
    } catch (e) {
      console.warn('팔로우 실패:', e);
      // Rollback
      setProfile(prevProfile);
      if (prevMyProfile) setUserProfile(prevMyProfile as any);
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
              // 승인된 레시피만 프로필에 노출 (pending/rejected는 '내 활동' 탭에서만 보임)
              .filter(r => ((r.authorUid && r.authorUid === uid) || r.author === user.nickname) && r.status === 'approved')
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

  const isDefaultImage = !isRemoteProfileImage(profile?.profileImage);
  const defaultAvatarSource = profile?.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A1A1A" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
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

  const isWithdrawn = !!(profile as any).withdrawnAt || (profile as any).status === 'withdrawn';
  if (isWithdrawn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="person-remove-outline" size={48} color="#BDBDBD" />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>탈퇴한 사용자입니다</Text>
          <Text style={{ fontSize: 13, color: '#9E9E9E', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>
            이 계정은 탈퇴 처리되었습니다.{'\n'}작성하신 게시물은 익명으로 보존됩니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalLikes = profile.totalLikes ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          {!isMe && firebaseUser ? (
            <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#1A1A1A" />
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileTopRow}>
            <View style={[styles.avatar, (profile as any).isPremium && profile.role !== 'admin' && styles.avatarPremium, profile.role === 'admin' && styles.avatarAdmin]}>
              {isDefaultImage ? (
                <Image source={defaultAvatarSource} style={{ width: 80, height: 80, borderRadius: 40 }} contentFit="cover" />
              ) : (
                <Image source={{ uri: profile.profileImage }} style={{ width: 80, height: 80, borderRadius: 40 }} contentFit="cover" cachePolicy="disk" recyclingKey={`profile-avatar-${profile.uid}`} priority="high" />
              )}
            </View>
            <View style={styles.statsSection}>
              <View style={styles.nameAndStats}>
                <View style={styles.bioNameRow}>
                  <Text style={styles.bioName}>{profile.nickname}</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{formatCount(recipes.length)}</Text>
                    <Text style={styles.statLabel}>게시물</Text>
                  </View>
                  <TouchableOpacity style={styles.statItem} onPress={() => openFollowList('followers')}>
                    <Text style={styles.statNumber}>{formatCount(profile.followers?.length ?? 0)}</Text>
                    <Text style={styles.statLabel}>팔로워</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statItem} onPress={() => openFollowList('following')}>
                    <Text style={styles.statNumber}>{formatCount(profile.following?.length ?? 0)}</Text>
                    <Text style={styles.statLabel}>팔로잉</Text>
                  </TouchableOpacity>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{formatCount(totalLikes)}</Text>
                    <Text style={styles.statLabel}>좋아요</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          {profile.bio ? (
            <View style={styles.bioTextRow}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Buttons */}
        {!isMe && firebaseUser && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, isFollowing ? styles.actionBtnDefault : styles.actionBtnFollow]}
              onPress={handleFollow}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, !isFollowing && styles.actionBtnFollowText]}>
                {isFollowing ? '팔로잉' : '팔로우'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, activeTab === 'grid' && styles.tabActive]} onPress={() => setActiveTab('grid')}>
            <Ionicons name="grid-outline" size={20} color={activeTab === 'grid' ? '#1A1A1A' : '#BDBDBD'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'liked' && styles.tabActive]} onPress={() => setActiveTab('liked')}>
            <Ionicons name="heart-outline" size={20} color={activeTab === 'liked' ? '#1A1A1A' : '#BDBDBD'} />
          </TouchableOpacity>
        </View>

        {/* Grid Content */}
        {activeTab === 'grid' ? (
          recipes.length > 0 ? (
            <FlatList
              data={recipes}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({ item: recipe }) => (
                <TouchableOpacity
                  style={styles.gridItem}
                  activeOpacity={0.8}
                  onPress={() => router.push(
                    recipe.type === 'community' ? `/recipe/${recipe.id}?type=community` : `/recipe/${recipe.id}`
                  )}
                >
                  {recipe.image ? (
                    <Image source={{ uri: recipe.image }} style={styles.gridImage} cachePolicy="disk" recyclingKey={`grid-${recipe.id}`} priority="high" />
                  ) : (
                    <View style={[styles.gridImage, styles.gridPlaceholder]}>
                      <Text style={styles.gridPlaceholderText}>🍳</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.emptyCardContainer}>
              <View style={styles.emptyCard}>
                <View style={[styles.emptyCardIconWrap, { backgroundColor: '#FFFFFF' }]}>
                  <Ionicons name="camera-outline" size={24} color="#1A1A1A" />
                </View>
                <Text style={styles.emptyCardTitle}>작성한 레시피가 없습니다</Text>
                <Text style={styles.emptyCardDesc}>아직 레시피를 작성하지 않았어요</Text>
              </View>
            </View>
          )
        ) : (
          likedLoading ? (
            <ActivityIndicator color="#FF4D67" style={{ marginTop: 40 }} />
          ) : likedRecipes.length > 0 ? (
            <FlatList
              data={likedRecipes}
              keyExtractor={(item) => `liked-${item.id}`}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({ item: recipe }) => (
                <TouchableOpacity
                  style={styles.gridItem}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                >
                  {recipe.image ? (
                    <Image source={{ uri: recipe.image }} style={styles.gridImage} cachePolicy="disk" recyclingKey={`liked-${recipe.id}`} priority="high" />
                  ) : (
                    <View style={[styles.gridImage, styles.gridPlaceholder]}>
                      <Text style={styles.gridPlaceholderText}>🍳</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.emptyCardContainer}>
              <View style={styles.emptyCard}>
                <View style={[styles.emptyCardIconWrap, { backgroundColor: 'transparent' }]}>
                  <Ionicons name="heart-outline" size={24} color="#FF4D67" />
                </View>
                <Text style={styles.emptyCardTitle}>좋아요한 레시피가 없습니다</Text>
              </View>
            </View>
          )
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleShareProfile}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#1A1A1A" />
              <Text style={styles.menuItemText}>카카오톡으로 공유</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={confirmBlock}
              disabled={blockLoading}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isBlocked ? 'person-add-outline' : 'ban-outline'}
                size={20}
                color={isBlocked ? '#1A1A1A' : '#FF3B30'}
              />
              <Text style={[styles.menuItemText, !isBlocked && { color: '#FF3B30' }]}>
                {isBlocked ? '차단 해제' : '사용자 차단'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => setMenuVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={20} color="#1A1A1A" />
              <Text style={styles.menuItemText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Follow List Modal */}
      <Modal
        visible={followListVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setFollowListVisible(false)}
      >
        <View style={[styles.followModalOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.followModalContainer}>
            <View style={styles.followModalHeader}>
              <TouchableOpacity onPress={() => setFollowListVisible(false)}>
                <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
              <Text style={styles.followModalTitle}>
                {profile?.nickname || '요리사'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.followTabsRow}>
              <TouchableOpacity
                style={[styles.followTab, followListType === 'followers' && styles.followTabActive]}
                onPress={() => { setFollowListType('followers'); setFollowSearch(''); }}
              >
                <Text style={[styles.followTabText, followListType === 'followers' && styles.followTabTextActive]}>
                  {profile?.followers?.length ?? 0} 팔로워
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.followTab, followListType === 'following' && styles.followTabActive]}
                onPress={() => { setFollowListType('following'); setFollowSearch(''); }}
              >
                <Text style={[styles.followTabText, followListType === 'following' && styles.followTabTextActive]}>
                  {profile?.following?.length ?? 0} 팔로잉
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.followSearchBar}>
              <Ionicons name="search" size={16} color="#9E9E9E" />
              <TextInput
                style={styles.followSearchInput}
                placeholder="검색"
                placeholderTextColor="#9E9E9E"
                value={followSearch}
                onChangeText={setFollowSearch}
              />
              {followSearch.length > 0 && (
                <TouchableOpacity onPress={() => setFollowSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#BDBDBD" />
                </TouchableOpacity>
              )}
            </View>

            {(() => {
              const q = followSearch.trim().toLowerCase();
              const filtered = q ? followListData.filter(u => (u.nickname || '').toLowerCase().includes(q)) : followListData;
              const trueCount = followListType === 'followers' ? (profile?.followers?.length ?? 0) : (profile?.following?.length ?? 0);
              if (filtered.length === 0) {
                // 검색 결과가 없거나, 실제로 팔로워/팔로잉이 0명일 때만 메시지 표시
                if (q || trueCount === 0) {
                  return (
                    <View style={styles.followEmptyContainer}>
                      <Ionicons name="people-outline" size={48} color="#E0E0E0" />
                      <Text style={styles.followEmptyText}>
                        {q ? '검색 결과가 없습니다' : (followListType === 'followers' ? '팔로워가 없습니다' : '팔로잉이 없습니다')}
                      </Text>
                    </View>
                  );
                }
                // 데이터가 아직 안 왔으면 빈 화면
                return <View style={{ flex: 1 }} />;
              }
              return (
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.uid}
                  extraData={myProfile?.following}
                  renderItem={({ item }) => {
                    const isMe = firebaseUser?.uid === item.uid;
                    const iFollow = !!myProfile?.following?.includes(item.uid);
                    return (
                      <View style={styles.followUserRow}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          activeOpacity={0.7}
                          onPress={() => {
                            setFollowListVisible(false);
                            router.push(`/profile/${item.uid}`);
                          }}
                        >
                          <View style={styles.followUserAvatar}>
                            {isRemoteProfileImage(item.profileImage) ? (
                              <Image source={{ uri: item.profileImage }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" cachePolicy="disk" recyclingKey={`follow-${item.uid}`} />
                            ) : (
                              <Image
                                source={item.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale}
                                style={{ width: 44, height: 44, borderRadius: 22 }}
                                contentFit="cover"
                              />
                            )}
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.followUserName}>{item.nickname || '요리사'}</Text>
                            {item.bio ? <Text style={styles.followUserBio} numberOfLines={1}>{item.bio}</Text> : null}
                          </View>
                        </TouchableOpacity>
                        {!isMe && firebaseUser?.uid && (
                          <TouchableOpacity
                            style={[styles.followActionBtn, iFollow ? styles.followActionFollowing : styles.followActionFollow]}
                            onPress={async () => {
                              if (!firebaseUser?.uid || !myProfile) return;
                              const wasFollowing = iFollow;
                              const prevMyProfile = myProfile;
                              const prevProfile = profile;
                              // Optimistic UI 업데이트 — 백엔드 응답 기다리지 않음
                              setUserProfile({
                                ...myProfile,
                                following: wasFollowing
                                  ? (myProfile.following ?? []).filter(u => u !== item.uid)
                                  : [...(myProfile.following ?? []), item.uid],
                              });
                              if (profile && profile.uid === firebaseUser.uid) {
                                setProfile({
                                  ...profile,
                                  following: wasFollowing
                                    ? (profile.following ?? []).filter(u => u !== item.uid)
                                    : [...(profile.following ?? []), item.uid],
                                });
                              }
                              try {
                                if (wasFollowing) await unfollowUser(firebaseUser.uid, item.uid);
                                else await followUser(firebaseUser.uid, item.uid);
                                // fetchUser 제거 — optimistic 상태를 그대로 신뢰. 느린 응답 대기 안 함.
                              } catch {
                                // 실패 시 원상복구
                                setUserProfile(prevMyProfile);
                                if (prevProfile && prevProfile.uid === firebaseUser.uid) setProfile(prevProfile);
                              }
                            }}
                          >
                            <Text style={[styles.followActionText, iFollow ? styles.followActionTextFollowing : styles.followActionTextFollow]}>
                              {iFollow ? '팔로잉' : '팔로우'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  }}
                />
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  // Profile Section
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarAdmin: {
    borderWidth: 2.5,
    borderColor: '#0B9A61',
    borderRadius: 43,
    overflow: 'hidden',
  },
  avatarPremium: {
    borderWidth: 2.5,
    borderColor: '#C8A24E',
    borderRadius: 43,
    overflow: 'hidden',
  },
  statsSection: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  nameAndStats: {
    gap: 12,
  },
  bioNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bioName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 15,
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  bioTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnDefault: {
    backgroundColor: '#F5F5F5',
  },
  actionBtnFollow: {
    backgroundColor: '#1BAE74',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  actionBtnFollowText: {
    color: '#FFFFFF',
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1A1A1A',
  },
  // Grid
  gridRow: {
    gap: GRID_GAP,
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    marginBottom: GRID_GAP,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridPlaceholder: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPlaceholderText: { fontSize: 28 },
  // Empty Card
  emptyCardContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
  },
  emptyCard: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  emptyCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1BAE74',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    marginBottom: 14,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  emptyCardDesc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  // Follow List Modal
  followModalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  followModalContainer: {
    flex: 1,
  },
  followModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  followTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  followTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  followTabActive: {
    borderBottomColor: '#1A1A1A',
  },
  followTabText: {
    fontSize: 14,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  followTabTextActive: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  followSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 8,
  },
  followSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    padding: 0,
  },
  followActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  followActionFollow: {
    backgroundColor: '#1BAE74',
  },
  followActionFollowing: {
    backgroundColor: '#F0F0F0',
  },
  followActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  followActionTextFollow: {
    color: '#FFFFFF',
  },
  followActionTextFollowing: {
    color: '#1A1A1A',
  },
  followModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  followEmptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  followEmptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  followUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  followUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  followUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  followUserBio: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
});
