import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  TextInput,
  Platform,
  Alert,
  Share,
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { fetchCommunityRecipes, fetchRecipes, fetchUser, fetchRecipeById, updateUser, checkNicknameAvailable, uploadProfileImage } from '../../services/api';
import type { CommunityRecipe } from '../../constants/community';
import type { Recipe } from '../../constants/recipes';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const GRID_SIZE = (width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

export default function ProfileScreen() {
  const router = useRouter();
  const { userProfile, setUserProfile, firebaseUser } = useAuth();
  const [myRecipes, setMyRecipes] = useState<{ id: string; image: string; type: 'recipe' | 'community' }[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'saved'>('grid');
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState<'none' | 'nickname' | 'bio'>('none');
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [editProfileImage, setEditProfileImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const nicknameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const authorName = userProfile?.nickname || firebaseUser?.displayName || '';
          const [communityList, allRecipes] = await Promise.all([
            fetchCommunityRecipes(),
            fetchRecipes(),
          ]);
          const myUid = firebaseUser?.uid || '';
          const myCommunity = communityList
            .filter(r => (r.authorUid && r.authorUid === myUid) || r.author === authorName)
            .map(r => ({ id: r.id, image: r.image, type: 'community' as const }));
          const myRegular = authorName
            ? allRecipes.filter(r => r.author === authorName).map(r => ({ id: r.id, image: r.image, type: 'recipe' as const }))
            : [];
          setMyRecipes([...myRegular, ...myCommunity]);
          // Refresh user profile
          if (firebaseUser) {
            const fresh = await fetchUser(firebaseUser.uid);
            if (fresh) {
              setUserProfile(fresh);
              // Load bookmarked recipes
              if (fresh.bookmarkedRecipes?.length) {
                const bookmarked = await Promise.all(
                  fresh.bookmarkedRecipes.map(id => fetchRecipeById(id).catch(() => null))
                );
                setSavedRecipes(bookmarked.filter((r): r is Recipe => r !== null));
              } else {
                setSavedRecipes([]);
              }
            }
          }
        } catch (e) {
          console.warn('API 로드 실패:', e);
        }
      })();
    }, [firebaseUser?.uid])
  );

  const totalLikes = userProfile?.totalLikes ?? 0;

  const handleShareProfile = async () => {
    const nickname = userProfile?.nickname || firebaseUser?.displayName || '요리사';
    const uid = firebaseUser?.uid || '';
    const recipeCount = myRecipes.length;
    const profileLink = `yojalal://profile/${uid}`;
    const message = `[요잘알] ${nickname}님의 프로필\n레시피 ${recipeCount}개 | 좋아요 ${totalLikes}개\n\n${profileLink}`;
    try {
      await Share.share({ message });
    } catch (e) {
      console.warn('공유 실패:', e);
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setEditProfileImage(result.assets[0].uri);
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
        } else if (editProfileImage.startsWith('file://') || editProfileImage.startsWith('content://')) {
          // Upload via backend API
          const downloadURL = await uploadProfileImage(firebaseUser.uid, editProfileImage);
          data.profileImage = downloadURL;
        } else {
          data.profileImage = editProfileImage;
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
  const isValidImageUri = (uri?: string | null) => !!uri && uri !== 'default' && (uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('file://') || uri.startsWith('content://'));
  const isDefaultImage = !isValidImageUri(rawProfileImage);
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
            <Text style={styles.headerIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatar, userProfile?.role === 'admin' && styles.avatarAdmin]}>
              {isDefaultImage ? (
                <Image source={defaultAvatarSource} style={{ width: 80, height: 80, borderRadius: 40 }} />
              ) : (
                <Image source={{ uri: rawProfileImage! }} style={{ width: 80, height: 80, borderRadius: 40 }} />
              )}
            </View>
            {isEditing && (
              <TouchableOpacity style={styles.editPencil} onPress={showEditPhotoOptions} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.editPencilText}>✎</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{myRecipes.length}</Text>
              <Text style={styles.statLabel}>게시물</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile?.followers?.length ?? 0}</Text>
              <Text style={styles.statLabel}>팔로워</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile?.following?.length ?? 0}</Text>
              <Text style={styles.statLabel}>팔로잉</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalLikes}</Text>
              <Text style={styles.statLabel}>좋아요</Text>
            </View>
          </View>
          <View style={styles.bioNameRow}>
            <Text style={styles.bioName}>{isEditing ? editNickname : (userProfile?.nickname || firebaseUser?.displayName || '요리사님')} 👨‍🍳</Text>
            {isEditing && (
              <TouchableOpacity onPress={() => openFieldModal('nickname')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.fieldPencil}>✎</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.bioTextRow}>
            <Text style={styles.bioText}>{isEditing ? (editBio || '한줄소개를 입력하세요') : (userProfile?.bio || '맛있는 요리를 만들어 봐요!')}</Text>
            {isEditing && (
              <TouchableOpacity onPress={() => openFieldModal('bio')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.fieldPencil}>✎</Text>
              </TouchableOpacity>
            )}
          </View>
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
            <Text style={[styles.tabIcon, activeTab === 'grid' && styles.tabIconActive]}>▦</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Text style={[styles.tabIcon, activeTab === 'saved' && styles.tabIconActive]}>☆</Text>
          </TouchableOpacity>
        </View>

        {/* Grid Content */}
        {activeTab === 'grid' ? (
          <View style={styles.grid}>
            {myRecipes.map((recipe) => (
              <TouchableOpacity
                key={`${recipe.type}-${recipe.id}`}
                style={styles.gridItem}
                activeOpacity={0.8}
                onPress={() => {
                  router.push(recipe.type === 'community' ? `/recipe/${recipe.id}?type=community` : `/recipe/${recipe.id}`);
                }}
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
        ) : savedRecipes.length > 0 ? (
          <View style={styles.grid}>
            {savedRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.gridItem}
                activeOpacity={0.8}
                onPress={() => {
                  router.push(`/recipe/${recipe.id}`);
                }}
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
          <View style={styles.savedEmpty}>
            <Text style={styles.savedEmptyIcon}>☆</Text>
            <Text style={styles.savedEmptyTitle}>저장한 레시피</Text>
            <Text style={styles.savedEmptyDesc}>좋아하는 레시피를 저장해보세요</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

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
    paddingTop: 16,
    paddingBottom: 4,
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
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    marginBottom: 8,
  },
  avatarAdmin: {
    borderWidth: 2.5,
    borderColor: '#0B9A61',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  // Bio
  bioName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 20,
    marginBottom: 6,
    textAlign: 'center',
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  editPencilText: {
    fontSize: 12,
    color: '#666',
  },
  bioNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
    marginBottom: 1,
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
    paddingTop: Platform.OS === 'ios' ? 70 : 40,
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
    backgroundColor: '#0B9A61',
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
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
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
  // Saved Empty
  savedEmpty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  savedEmptyIcon: {
    fontSize: 40,
    color: '#BDBDBD',
    marginBottom: 12,
  },
  savedEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  savedEmptyDesc: {
    fontSize: 14,
    color: '#999',
  },
});
