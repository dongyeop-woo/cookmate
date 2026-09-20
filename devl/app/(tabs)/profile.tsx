import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Platform,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import ImageCropPicker from 'react-native-image-crop-picker';
import { fetchCommunityRecipes, fetchRecipes, fetchUser, fetchRecipesByIds, updateUser, checkNicknameAvailable, uploadProfileImage, fetchTopUsers, followUser, unfollowUser } from '../../services/api';
import type { UserProfile as UserProfileType } from '../../services/api';
import type { CommunityRecipe } from '../../constants/community';
import type { Recipe } from '../../constants/recipes';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../_layout';
import { Ionicons } from '@expo/vector-icons';
import KakaoShareLink from 'react-native-kakao-share-link';

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const GRID_SIZE = Math.floor((width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; _t?: string }>();
  const insets = useSafeAreaInsets();
  const { userProfile, setUserProfile, firebaseUser } = useAuth();
  const [myRecipes, setMyRecipes] = useState<{ id: string; image: string; type: 'recipe' | 'community'; createdAt?: string }[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'saved'>('grid');

  useEffect(() => {
    if (params.tab === 'saved') setActiveTab('saved');
    else if (params.tab === 'grid') setActiveTab('grid');
  }, [params.tab, params._t]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState<'none' | 'nickname' | 'bio'>('none');
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [editProfileImage, setEditProfileImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const nicknameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [followListVisible, setFollowListVisible] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [followListData, setFollowListData] = useState<UserProfileType[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followSearch, setFollowSearch] = useState('');

  // 재진입 throttle — 30초 이내 재포커스는 fetch 스킵 (체감 렉 제거).
  // 변동 가능성 있는 액션(좋아요, 글 작성 등) 후에는 lastFetchRef.current = 0 으로 강제 리프레시 가능.
  const lastFetchRef = useRef(0);
  const FETCH_THROTTLE_MS = 30_000;
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const now = Date.now();
        if (lastFetchRef.current > 0 && now - lastFetchRef.current < FETCH_THROTTLE_MS) {
          return;
        }
        lastFetchRef.current = now;
        try {
          const authorName = userProfile?.nickname || firebaseUser?.displayName || '';
          // 3개 fetch 모두 병렬 — fetchUser를 community/recipes 와 동시에 (기존엔 직렬)
          const [communityList, allRecipes, fresh] = await Promise.all([
            fetchCommunityRecipes(),
            fetchRecipes(),
            firebaseUser ? fetchUser(firebaseUser.uid) : Promise.resolve(null),
          ]);
          const myUid = firebaseUser?.uid || '';
          const myCommunity = communityList
            // 승인된 레시피만 프로필 목록에 표시 (pending/rejected는 '내 활동'에서 확인)
            .filter(r => ((r.authorUid && r.authorUid === myUid) || r.author === authorName) && r.status === 'approved')
            .map(r => ({ id: r.id, image: r.image, type: 'community' as const, createdAt: (r as any).createdAt }));
          const myRegular = authorName
            ? allRecipes.filter(r => r.author === authorName).map(r => ({ id: r.id, image: r.image, type: 'recipe' as const, createdAt: (r as any).createdAt }))
            : [];
          // 최신 작성순 정렬 (createdAt 내림차순)
          const combined = [...myRegular, ...myCommunity].sort((a, b) => {
            const A = a.createdAt || '';
            const B = b.createdAt || '';
            return B.localeCompare(A);
          });
          setMyRecipes(combined);
          // 그리드 이미지 prefetch — 첫 진입 시 디스크 캐시 워밍 (백그라운드)
          try {
            const urls = combined.slice(0, 20).map(r => r.image).filter(Boolean) as string[];
            if (urls.length) Image.prefetch(urls, 'disk');
          } catch {}
          // Refresh user profile (이미 위에서 병렬로 받음)
          if (fresh) {
            setUserProfile(fresh);
            // 북마크한 레시피 일괄 조회 — N+1(20 reads) 대신 배치 쿼리(2~4 reads)로 비용 절감
            if (fresh.likedRecipes?.length) {
              try {
                const bookmarked = await fetchRecipesByIds(fresh.likedRecipes.slice(0, 20));
                setSavedRecipes(bookmarked);
                // 북마크 그리드도 prefetch
                try {
                  const burls = bookmarked.slice(0, 20).map(r => r.image).filter(Boolean) as string[];
                  if (burls.length) Image.prefetch(burls, 'disk');
                } catch {}
              } catch {
                setSavedRecipes([]);
              }
            } else {
              setSavedRecipes([]);
            }
          }
        } catch (e) {
          console.warn('API 로드 실패:', e);
        }
      })();
    }, [firebaseUser?.uid])
  );

  const totalLikes = userProfile?.totalLikes ?? 0;

  const followReqIdRef = useRef(0);
  const loadFollowList = useCallback(async (type: 'followers' | 'following') => {
    const reqId = ++followReqIdRef.current;
    const uids = type === 'followers' ? (userProfile?.followers ?? []) : (userProfile?.following ?? []);
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
  }, [userProfile?.followers, userProfile?.following]);

  useEffect(() => {
    if (followListVisible) loadFollowList(followListType);
  }, [followListType, followListVisible, loadFollowList]);

  const openFollowList = (type: 'followers' | 'following') => {
    setFollowListType(type);
    setFollowSearch('');
    setFollowListVisible(true);
  };

  const formatCount = (n: number) => {
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '천';
    return String(n);
  };

  const handleShareProfile = async () => {
    const nickname = userProfile?.nickname || firebaseUser?.displayName || '요리사';
    const uid = firebaseUser?.uid || '';
    const profileImage = userProfile?.profileImage && userProfile.profileImage !== 'default' && userProfile.profileImage.startsWith('http')
      ? userProfile.profileImage
      : 'https://yojalal.com/img/default-profile.png';
    const webUrl = `https://yojalal.com/profile/${uid}`;

    shareViaKakao(nickname, profileImage, webUrl);
  };

  const shareViaKakao = async (nickname: string, profileImage: string, webUrl: string) => {
    const uid = firebaseUser?.uid || '';
    const execParams = [
      { key: 'type', value: 'profile' },
      { key: 'uid', value: uid },
    ];
    const link = {
      webUrl,
      mobileWebUrl: webUrl,
      iosExecutionParams: execParams,
      androidExecutionParams: execParams,
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
      console.warn('카카오 공유 실패:', e);
      Alert.alert('공유 실패', '카카오톡이 설치되어 있는지 확인해주세요.');
    }
  };


  const startEditing = () => {
    setEditNickname(userProfile?.nickname || firebaseUser?.displayName || '');
    setEditBio(userProfile?.bio || '');
    setEditProfileImage(null);
    setNicknameStatus('idle');
    setEditingField('none');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingField('none');
    if (nicknameTimer.current) clearTimeout(nicknameTimer.current);
  };

  const openFieldModal = (field: 'nickname' | 'bio') => {
    setModalValue(field === 'nickname' ? editNickname : editBio);
    setNicknameStatus('idle');
    setEditingField(field);
  };

  const confirmFieldModal = () => {
    if (editingField === 'nickname') {
      if (nicknameStatus === 'taken') return;
      setEditNickname(modalValue);
    } else if (editingField === 'bio') {
      setEditBio(modalValue);
    }
    setEditingField('none');
  };

  const cancelFieldModal = () => {
    setEditingField('none');
    setNicknameStatus('idle');
  };

  const handleModalNicknameChange = (text: string) => {
    setModalValue(text);
    if (nicknameTimer.current) clearTimeout(nicknameTimer.current);
    const trimmed = text.trim();
    if (!trimmed || trimmed === (userProfile?.nickname || '')) {
      setNicknameStatus('idle');
      return;
    }
    setNicknameStatus('checking');
    nicknameTimer.current = setTimeout(async () => {
      try {
        const available = await checkNicknameAvailable(trimmed);
        setNicknameStatus(available ? 'available' : 'taken');
      } catch {
        setNicknameStatus('idle');
      }
    }, 500);
  };

  const pickEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }
    try {
      const result = await ImageCropPicker.openPicker({
        width: 400,
        height: 400,
        cropping: true,
        cropperCircleOverlay: true,
        compressImageQuality: 0.7,
        mediaType: 'photo',
      });
      if (result.path) {
        setEditProfileImage(result.path);
      }
    } catch (e: any) {
      if (e?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('오류', '이미지를 불러올 수 없습니다.');
      }
    }
  };

  const resetEditImage = () => {
    setEditProfileImage('default');
  };

  const showEditPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: '\ud504\ub85c\ud544 \uc0ac\uc9c4 \uc124\uc815',
          options: ['\uc568\ubc94\uc5d0\uc11c \uc0ac\uc9c4 \uc120\ud0dd', '\uae30\ubcf8 \uc774\ubbf8\uc9c0\ub85c \ubcc0\uacbd', '\ucde8\uc18c'],
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) pickEditImage();
          else if (idx === 1) resetEditImage();
        },
      );
    } else {
      Alert.alert('\ud504\ub85c\ud544 \uc0ac\uc9c4 \uc124\uc815', undefined, [
        { text: '\uc568\ubc94\uc5d0\uc11c \uc0ac\uc9c4 \uc120\ud0dd', onPress: pickEditImage },
        { text: '\uae30\ubcf8 \uc774\ubbf8\uc9c0\ub85c \ubcc0\uacbd', onPress: resetEditImage },
        { text: '\ucde8\uc18c', style: 'cancel' },
      ]);
    }
  };

  const saveProfile = async () => {
    if (!firebaseUser) return;
    if (nicknameStatus === 'taken') {
      Alert.alert('\uc624\ub958', '\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \ub2c9\ub124\uc784\uc785\ub2c8\ub2e4.');
      return;
    }
    setSaving(true);
    try {
      const data: Record<string, any> = {};
      const trimmedNick = editNickname.trim();
      if (trimmedNick && trimmedNick !== userProfile?.nickname) data.nickname = trimmedNick;
      if (editBio.trim() !== (userProfile?.bio || '')) data.bio = editBio.trim();
      if (editProfileImage !== null) {
        if (editProfileImage === 'default') {
          data.profileImage = 'default';
        } else if (editProfileImage.startsWith('http://') || editProfileImage.startsWith('https://')) {
          // 이미 원격 URL인 경우 그대로
          data.profileImage = editProfileImage;
        } else {
          // 로컬 경로 — image-crop-picker는 iOS에서 file:// 없이 /var/... 경로 반환하므로 보정
          const uri = (editProfileImage.startsWith('file://') || editProfileImage.startsWith('content://'))
            ? editProfileImage
            : `file://${editProfileImage}`;
          console.log('[profile] 업로드 시작 URI:', uri);
          const downloadURL = await uploadProfileImage(firebaseUser.uid, uri);
          console.log('[profile] 업로드 성공 URL:', downloadURL);
          // 파일명이 uid 기반이라 URL이 동일 → 이미지 캐시 무력화 위해 버스터 추가
          const separator = downloadURL.includes('?') ? '&' : '?';
          data.profileImage = `${downloadURL}${separator}t=${Date.now()}`;
        }
      }
      if (Object.keys(data).length > 0) {
        const updated = await updateUser(firebaseUser.uid, data);
        setUserProfile(updated);
      }
      setIsEditing(false);
    } catch (e: any) {
      console.error('프로필 수정 실패:', e?.message || e);
      Alert.alert('오류', '프로필 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const rawProfileImage = isEditing && editProfileImage !== null
    ? editProfileImage
    : userProfile?.profileImage || null;
  const isValidImageUri = (uri?: string | null) => !!uri && uri !== 'default' && uri.trim() !== '' && (uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('file://') || uri.startsWith('content://'));
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  // URL이 바뀌면 이전 로드 실패 상태 리셋 (안 그러면 새 사진도 기본 이미지로 보임)
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [rawProfileImage]);
  const isDefaultImage = !isValidImageUri(rawProfileImage) || avatarLoadFailed;
  const defaultAvatarSource = userProfile?.gender === 'female'
    ? require('../../assets/girl.png')
    : require('../../assets/man.png');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* Header */}
        <View style={styles.header}>
          <View />
          <TouchableOpacity onPress={() => router.push('/menu')}>
            <Ionicons name="menu" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrapper}>
              <View style={[styles.avatar, (userProfile as any)?.isPremium && userProfile?.role !== 'admin' && styles.avatarPremium, userProfile?.role === 'admin' && styles.avatarAdmin]}>
                {isDefaultImage ? (
                  <Image source={defaultAvatarSource} style={{ width: 80, height: 80, borderRadius: 40 }} contentFit="cover" />
                ) : (
                  <Image
                    key={rawProfileImage}
                    source={{ uri: rawProfileImage! }}
                    style={{ width: 80, height: 80, borderRadius: 40 }}
                    contentFit="cover"
                    cachePolicy="disk"
                    recyclingKey={`my-avatar-${rawProfileImage}`}
                    priority="high"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                )}
              </View>
              {isEditing && (
                <TouchableOpacity style={styles.editPencil} onPress={showEditPhotoOptions} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.statsSection}>
              <View style={styles.nameAndStats}>
                <View style={styles.bioNameRow}>
                  <Text style={styles.bioName}>{isEditing ? editNickname : (userProfile?.nickname || firebaseUser?.displayName || '요리사님')}</Text>
                  {isEditing && (
                    <TouchableOpacity onPress={() => openFieldModal('nickname')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="pencil" size={14} color="#666666" />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{formatCount(myRecipes.length)}</Text>
                    <Text style={styles.statLabel}>게시물</Text>
                  </View>
                  <TouchableOpacity style={styles.statItem} onPress={() => openFollowList('followers')}>
                    <Text style={styles.statNumber}>{formatCount(userProfile?.followers?.length ?? 0)}</Text>
                    <Text style={styles.statLabel}>팔로워</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statItem} onPress={() => openFollowList('following')}>
                    <Text style={styles.statNumber}>{formatCount(userProfile?.following?.length ?? 0)}</Text>
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
          {(isEditing || userProfile?.bio) ? (
            <View style={styles.bioTextRow}>
              <Text style={styles.bioText}>{isEditing ? (editBio || '한줄소개를 입력하세요') : userProfile?.bio}</Text>
              {isEditing && (
                <TouchableOpacity onPress={() => openFieldModal('bio')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil" size={14} color="#666666" />
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {isEditing ? (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={cancelEditing}>
                <Text style={styles.actionBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtnSave, (saving || nicknameStatus === 'taken') && styles.actionBtnDisabled]}
                onPress={saveProfile}
                disabled={saving || nicknameStatus === 'taken'}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.actionBtnSaveText}>저장</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={startEditing}>
                <Text style={styles.actionBtnText}>프로필 편집</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShareProfile}>
                <Text style={styles.actionBtnText}>프로필 공유</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'grid' && styles.tabActive]}
            onPress={() => setActiveTab('grid')}
          >
            <Text style={[styles.tabIcon, activeTab === 'grid' && styles.tabIconActive]}><Ionicons name="grid-outline" size={20} color={activeTab === 'grid' ? '#1A1A1A' : '#BDBDBD'} /></Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Text style={[styles.tabIcon, activeTab === 'saved' && styles.tabIconActive]}><Ionicons name="heart-outline" size={20} color={activeTab === 'saved' ? '#1A1A1A' : '#BDBDBD'} /></Text>
          </TouchableOpacity>
        </View>

        {/* Grid Content */}
        {activeTab === 'grid' ? (
          myRecipes.length > 0 ? (
            <FlatList
              data={myRecipes}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({ item: recipe }) => (
                <TouchableOpacity
                  style={styles.gridItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push(recipe.type === 'community' ? `/recipe/${recipe.id}?type=community` : `/recipe/${recipe.id}`);
                  }}
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
              <TouchableOpacity style={styles.emptyCard} activeOpacity={0.8} onPress={() => router.push('/community/write')}>
                <View style={[styles.emptyCardIconWrap, { backgroundColor: '#FFFFFF' }]}>
                  <Ionicons name="create-outline" size={24} color="#1A1A1A" />
                </View>
                <Text style={styles.emptyCardTitle}>첫 레시피를 작성해보세요</Text>
                <Text style={styles.emptyCardDesc}>나만의 요리 과정을 기록하고{'\n'}다른 사람들과 공유해보세요</Text>
                <View style={styles.emptyCardBtn}>
                  <Text style={styles.emptyCardBtnText}>레시피 작성하기</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.emptyCard}>
                <View style={[styles.emptyCardIconWrap, { backgroundColor: '#FFFFFF' }]}>
                  <Ionicons name="people-outline" size={24} color="#1A1A1A" />
                </View>
                <Text style={styles.emptyCardTitle}>커뮤니티 둘러보기</Text>
                <Text style={styles.emptyCardDesc}>다른 요리사들의 레시피를{'\n'}구경하고 영감을 얻어보세요</Text>
              </View>
            </View>
          )
        ) : savedRecipes.length > 0 ? (
          <FlatList
            data={savedRecipes}
            keyExtractor={(item) => item.id}
            numColumns={3}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={({ item: recipe }) => (
              <TouchableOpacity
                style={styles.gridItem}
                activeOpacity={0.8}
                onPress={() => {
                  router.push(`/recipe/${recipe.id}`);
                }}
              >
                {recipe.image ? (
                  <Image source={{ uri: recipe.image }} style={styles.gridImage} cachePolicy="disk" recyclingKey={`saved-${recipe.id}`} priority="high" />
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
              <Text style={styles.emptyCardTitle}>레시피에 좋아요 해보세요</Text>
              <Text style={styles.emptyCardDesc}>마음에 드는 레시피에{'\n'}좋아요하고 모아보세요</Text>
            </View>
            <TouchableOpacity style={styles.emptyCard} activeOpacity={0.8} onPress={() => router.push('/(tabs)/recipe')}>
              <View style={[styles.emptyCardIconWrap, { backgroundColor: '#FFFFFF' }]}>
                <Ionicons name="search-outline" size={24} color="#1A1A1A" />
              </View>
              <Text style={styles.emptyCardTitle}>레시피 둘러보기</Text>
              <Text style={styles.emptyCardDesc}>다양한 레시피를 탐색하고{'\n'}좋아하는 레시피를 찾아보세요</Text>
              <View style={styles.emptyCardBtn}>
                <Text style={styles.emptyCardBtnText}>둘러보기</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

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
                {userProfile?.nickname || '요리사'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.followTabsRow}>
              <TouchableOpacity
                style={[styles.followTab, followListType === 'followers' && styles.followTabActive]}
                onPress={() => { setFollowListType('followers'); setFollowSearch(''); }}
              >
                <Text style={[styles.followTabText, followListType === 'followers' && styles.followTabTextActive]}>
                  {userProfile?.followers?.length ?? 0} 팔로워
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.followTab, followListType === 'following' && styles.followTabActive]}
                onPress={() => { setFollowListType('following'); setFollowSearch(''); }}
              >
                <Text style={[styles.followTabText, followListType === 'following' && styles.followTabTextActive]}>
                  {userProfile?.following?.length ?? 0} 팔로잉
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
              const trueCount = followListType === 'followers' ? (userProfile?.followers?.length ?? 0) : (userProfile?.following?.length ?? 0);
              if (filtered.length === 0) {
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
                return <View style={{ flex: 1 }} />;
              }
              return (
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.uid}
                  extraData={userProfile?.following}
                  renderItem={({ item }) => {
                    const isMe = firebaseUser?.uid === item.uid;
                    const iFollow = !!userProfile?.following?.includes(item.uid);
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
                            {item.profileImage && item.profileImage !== 'default' && item.profileImage.startsWith('http') ? (
                              <Image source={{ uri: item.profileImage }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" cachePolicy="disk" recyclingKey={`my-follow-${item.uid}`} />
                            ) : (
                              <Image
                                source={item.gender === 'female' ? require('../../assets/girl.png') : require('../../assets/man.png')}
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
                        {!isMe && firebaseUser?.uid && userProfile && (
                          <TouchableOpacity
                            style={[styles.followActionBtn, iFollow ? styles.followActionFollowing : styles.followActionFollow]}
                            onPress={async () => {
                              const wasFollowing = iFollow;
                              setUserProfile({
                                ...userProfile,
                                following: wasFollowing
                                  ? userProfile.following.filter(u => u !== item.uid)
                                  : [...(userProfile.following ?? []), item.uid],
                              });
                              try {
                                if (wasFollowing) await unfollowUser(firebaseUser.uid, item.uid);
                                else await followUser(firebaseUser.uid, item.uid);
                                const fresh = await fetchUser(firebaseUser.uid);
                                if (fresh) setUserProfile(fresh);
                              } catch {
                                setUserProfile(userProfile);
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

      {/* Field Edit Modal */}
      <Modal
        visible={editingField !== 'none'}
        transparent
        animationType="slide"
        onRequestClose={cancelFieldModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={cancelFieldModal}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingField === 'nickname' ? '닉네임' : '한줄소개'}
              </Text>
              <TouchableOpacity
                onPress={confirmFieldModal}
                disabled={editingField === 'nickname' && nicknameStatus === 'taken'}
              >
                <Text style={[
                  styles.modalConfirmText,
                  editingField === 'nickname' && nicknameStatus === 'taken' && styles.modalConfirmDisabled,
                ]}>확인</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalCenter}>
              <View style={styles.modalBody}>
                <TextInput
                  style={styles.modalInput}
                  value={modalValue}
                  onChangeText={editingField === 'nickname' ? handleModalNicknameChange : setModalValue}
                  maxLength={editingField === 'nickname' ? 16 : 40}
                  placeholder={editingField === 'nickname' ? '닉네임을 입력하세요' : '한줄소개를 입력하세요'}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoFocus
                />
                <View style={styles.modalInputBar} />
                <View style={styles.modalInputInfo}>
                  {editingField === 'nickname' && nicknameStatus === 'taken' && (
                    <Text style={styles.modalErrorText}>이미 사용 중인 닉네임</Text>
                  )}
                  {editingField === 'nickname' && nicknameStatus === 'available' && (
                    <Text style={styles.modalOkText}>사용 가능</Text>
                  )}
                  {editingField === 'nickname' && nicknameStatus === 'checking' && (
                    <Text style={styles.modalCheckingText}>확인 중...</Text>
                  )}
                  <Text style={styles.modalCharCount}>
                    {modalValue.length}/{editingField === 'nickname' ? 16 : 40}
                  </Text>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 56,
    marginTop: 10,
  },
  headerUsername: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  headerIcon: {
    fontSize: 22,
    color: '#1A1A1A',
  },
  // Profile Section
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 10,
    marginTop: -8,
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
  avatarEmoji: {
    fontSize: 40,
  },
  statsSection: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  nameAndStats: {
    gap: 12,
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
  // Bio
  bioName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 15,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Avatar wrapper for edit pencil positioning
  avatarWrapper: {
    position: 'relative',
    marginBottom: 0,
  },
  editPencil: {
    position: 'absolute',
    bottom: 16,
    right: -4,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPencilText: {
    fontSize: 12,
    color: '#666',
  },
  bioNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bioTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  fieldPencil: {
    fontSize: 14,
    color: '#999',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 54,
    paddingBottom: 16,
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalConfirmDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  modalBody: {
    paddingTop: 0,
  },
  modalInput: {
    fontSize: 18,
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  modalInputBar: {
    height: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  modalInputInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalCharCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 'auto',
  },
  modalErrorText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
  modalOkText: {
    fontSize: 12,
    color: '#69DB7C',
  },
  modalCheckingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
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
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  actionBtnSave: {
    flex: 1,
    backgroundColor: '#1BAE74',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnSmall: {
    width: 44,
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSmallText: {
    fontSize: 14,
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
  tabIcon: {
    fontSize: 20,
    color: '#BDBDBD',
  },
  tabIconActive: {
    color: '#1A1A1A',
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
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
  gridPlaceholderText: {
    fontSize: 28,
  },
  // Empty Card
  emptyCardContainer: {
    flexDirection: 'row' as const,
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
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 14,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginBottom: 6,
  },
  emptyCardDesc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
  },
  emptyCardBtn: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  emptyCardBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1A1A1A',
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  followTabsRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  followTab: {
    flex: 1,
    alignItems: 'center' as const,
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
    fontWeight: '600' as const,
  },
  followTabTextActive: {
    color: '#1A1A1A',
    fontWeight: '700' as const,
  },
  followSearchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
    alignItems: 'center' as const,
  },
  followActionFollow: {
    backgroundColor: '#1BAE74',
  },
  followActionFollowing: {
    backgroundColor: '#F0F0F0',
  },
  followActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  followActionTextFollow: {
    color: '#FFFFFF',
  },
  followActionTextFollowing: {
    color: '#1A1A1A',
  },
  followModalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1A1A1A',
  },
  followEmptyContainer: {
    alignItems: 'center' as const,
    paddingTop: 60,
  },
  followEmptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  followUserRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  followUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden' as const,
  },
  followUserName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1A1A1A',
  },
  followUserBio: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  followToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    marginLeft: 8,
  },
  followToggleBtnOn: {
    backgroundColor: '#F2F2F2',
  },
  followToggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  followToggleBtnTextOn: {
    color: '#1A1A1A',
  },
});
