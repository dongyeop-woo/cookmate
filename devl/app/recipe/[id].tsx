import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Image as RNImage } from 'react-native';
import { fetchRecipeById, fetchRecipesByCategory, likeRecipeUser, unlikeRecipeUser, addRecipeComment, deleteRecipeComment, fetchUser, deleteRecipe, fetchCommunityRecipeById, updateCommunityRecipeApi, rateCommunityRecipe, likeCommunityRecipe, unlikeCommunityRecipe, createReport, fetchTopUsers, fetchReviewsByRecipe, addCommentReply, deleteCommentReply, completeChallenge, updateCommunityRecipeVisibility, type Review } from '../../services/api';
import { isRemoteProfileImage } from '../../services/profileImage';
import type { Recipe } from '../../constants/recipes';
import type { CommunityRecipe } from '../../constants/community';
import { useAuth } from '../_layout';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import KakaoShareLink from 'react-native-kakao-share-link';

const bannerAdUnitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : Platform.OS === 'ios'
  ? 'ca-app-pub-8542314434357214/6417512417'
  : 'ca-app-pub-8542314434357214/3982920767';

// 쿠팡 파트너스 lptag — partners.coupang.com에서 발급받은 본인 파트너 식별자.
const COUPANG_PARTNER_LPTAG = 'AF8701960';
const openCoupangSearch = (query: string) => {
  const q = encodeURIComponent(query.trim());
  const url = COUPANG_PARTNER_LPTAG
    ? `https://www.coupang.com/np/search?q=${q}&lptag=${COUPANG_PARTNER_LPTAG}`
    : `https://www.coupang.com/np/search?q=${q}`;
  Linking.openURL(url).catch(() => Alert.alert('오류', '쿠팡을 열 수 없어요.'));
};

const { width } = Dimensions.get('window');
const PIXEL_RATIO = Math.ceil(Dimensions.get('window').scale);


const hiResImage = (uri: string, w = 400) => {
  if (uri && uri.includes('unsplash.com')) {
    return uri.replace(/[?&]w=\d+/, `?w=${w}`);
  }
  return uri;
};

export default function RecipeDetailScreen() {
  const { id, type } = useLocalSearchParams();
  const isCommunity = type === 'community';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, setUserProfile, firebaseUser, isPremium } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [communityRecipe, setCommunityRecipe] = useState<CommunityRecipe | null>(null);
  const [authorUid, setAuthorUid] = useState<string | null>(null);
  const [authorProfile, setAuthorProfile] = useState<{ profileImage?: string; gender?: string } | null>(null);
  const [similarRecipes, setSimilarRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [userComment, setUserComment] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [replyMenuOpenId, setReplyMenuOpenId] = useState<string | null>(null);
  const [replyMenuAnchor, setReplyMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [recipeMenuVisible, setRecipeMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'recipe' | 'community' | 'comment'; id: string; title?: string } | null>(null);
  const [reviews, setReviews] = useState<{ id: string; comment: string; date: string; nickname: string; uid: string; createdAt: string; profileImage?: string; reply?: string; replyAuthorNickname?: string; replyAuthorRole?: string; replyCreatedAt?: string }[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [profileImageMap, setProfileImageMap] = useState<Record<string, string>>({});
  const [photoReviews, setPhotoReviews] = useState<Review[]>([]);
  const blockedUids = ((userProfile as any)?.blockedUids ?? []) as string[];
  const filteredPhotoReviews = React.useMemo(
    () => photoReviews.filter(r => !blockedUids.includes(r.uid)),
    [photoReviews, blockedUids.join(',')]
  );
  const filteredReviews = React.useMemo(
    () => reviews.filter(r => !blockedUids.includes(r.uid)),
    [reviews, blockedUids.join(',')]
  );
  const reviewAvgRating = (() => {
    const rated = filteredPhotoReviews.filter(r => r.rating && r.rating > 0);
    if (rated.length === 0) return 0;
    return rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length;
  })();

  useEffect(() => {
    if (!id) return;
    fetchReviewsByRecipe(id as string).then(setPhotoReviews).catch(() => setPhotoReviews([]));
  }, [id]);
  // Community-specific state
  const [userRating, setUserRating] = useState(0);
  const [questionText, setQuestionText] = useState('');
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // TTS PENDING 상태일 때 3초마다 백그라운드 폴링하여 버튼 활성화
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recipe && (recipe as any).ttsStatus === 'PENDING') {
      interval = setInterval(async () => {
        try {
          const updated = isCommunity 
            ? await fetchCommunityRecipeById(id as string) 
            : await fetchRecipeById(id as string);
          if (updated && (updated as any).ttsStatus !== 'PENDING') {
            setRecipe(prev => prev ? { ...prev, ttsStatus: (updated as any).ttsStatus } as any : null);
            clearInterval(interval);
          }
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [recipe?.id, (recipe as any)?.ttsStatus]);

  // 레시피 작성자 또는 관리자만 답글 가능
  const canReplyToComments = (() => {
    if (!firebaseUser?.uid) return false;
    if (userProfile?.role === 'admin') return true;
    if (authorUid && authorUid === firebaseUser.uid) return true;
    if (recipe?.author && userProfile?.nickname === recipe.author) return true;
    return false;
  })();

  const handleSubmitCommentReply = async (commentId: string) => {
    if (!firebaseUser?.uid) return;
    const text = (replyDrafts[commentId] || '').trim();
    if (!text) {
      Alert.alert('답글', '답글 내용을 입력해주세요.');
      return;
    }
    try {
      const updated = await addCommentReply(id as string, commentId, firebaseUser.uid, text);
      if (updated.comments) setReviews(parseComments(updated.comments));
      setReplyDrafts(prev => ({ ...prev, [commentId]: '' }));
      setEditingReplyId(null);
      setReplyingToId(null);
    } catch (e: any) {
      Alert.alert('답글 실패', e.message || '잠시 후 다시 시도해주세요.');
    }
  };

  const handleDeleteCommentReply = (commentId: string) => {
    if (!firebaseUser?.uid) return;
    Alert.alert('답글 삭제', '답글을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            const updated = await deleteCommentReply(id as string, commentId, firebaseUser.uid);
            if (updated.comments) setReviews(parseComments(updated.comments));
          } catch (e: any) {
            Alert.alert('삭제 실패', e.message || '다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const parseComments = (comments: any[]) => {
    return comments
      .map((c: any) => ({
        id: c.id,
        comment: c.text,
        nickname: c.nickname,
        uid: c.uid || '',
        createdAt: c.createdAt || '',
        profileImage: c.profileImage || '',
        date: c.createdAt ? new Date(c.createdAt).toLocaleDateString('ko-KR') : '',
        reply: c.reply,
        replyAuthorNickname: c.replyAuthorNickname,
        replyAuthorRole: c.replyAuthorRole,
        replyCreatedAt: c.replyCreatedAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  useEffect(() => {
    (async () => {
      try {
        if (isCommunity) {
          const cr = await fetchCommunityRecipeById(id as string);
          setCommunityRecipe(cr);
          setLikeCount(cr.likes ?? 0);
          // Convert to Recipe-like for unified rendering
          setRecipe({
            id: cr.id,
            title: cr.title,
            author: cr.author,
            time: cr.time,
            difficulty: cr.difficulty,
            calories: (cr as any).calories || 0,
            rating: cr.ratings.length > 0 ? cr.ratings.reduce((s, r) => s + r.score, 0) / cr.ratings.length : 0,
            likes: cr.likes,
            image: cr.image,
            category: cr.category,
            description: cr.description,
            ingredients: cr.ingredients.map(i => ({ ...i, icon: '' })),
            steps: cr.steps.map((s, idx) => ({ step: idx + 1, description: s.description, time: s.time, imageUrl: s.imageUrl })),
            servings: (cr as any).servings || '1',
            tags: cr.tags ?? [],
          } as Recipe);
          // 비슷한 레시피 (동일 카테고리의 일반 레시피 추천)
          try {
            const catRecipes = await fetchRecipesByCategory(cr.category);
            setSimilarRecipes(catRecipes.filter(sr => sr.id !== id).slice(0, 6));
          } catch {}
          if (userProfile?.likedRecipes?.includes(id as string)) {
            setLiked(true);
          }
        } else {
          const r = await fetchRecipeById(id as string);
          setRecipe(r);
          setLikeCount(r.likes ?? 0);
          // Load comments from backend
          if (r.comments?.length) {
            const parsed = parseComments(r.comments);
            setReviews(parsed);
            const imgMap: Record<string, string> = {};
            // Use embedded profileImage from comments first
            for (const c of parsed) {
              if (c.uid && isRemoteProfileImage(c.profileImage)) {
                imgMap[c.uid] = c.profileImage!;
              }
            }
            if (firebaseUser?.uid && userProfile?.profileImage && userProfile.profileImage !== 'default') {
              imgMap[firebaseUser.uid] = userProfile.profileImage;
            }
            // Only fetch users whose profileImage is missing (max 5 to avoid N+1)
            const missingUids = [...new Set(parsed.map(c => c.uid).filter(uid => uid && !imgMap[uid]))].slice(0, 5);
            if (missingUids.length > 0) {
              await Promise.all(missingUids.map(async uid => {
                try {
                  const u = await fetchUser(uid);
                  if (isRemoteProfileImage(u?.profileImage)) {
                    imgMap[uid] = u!.profileImage;
                  }
                } catch {}
              }));
            }
            setProfileImageMap(imgMap);
          }
          const catRecipes = await fetchRecipesByCategory(r.category);
          setSimilarRecipes(
            catRecipes.filter(sr => sr.id !== id).sort((a, b) => b.rating - a.rating).slice(0, 6)
          );
          if (userProfile?.likedRecipes?.includes(id as string)) {
            setLiked(true);
          }
          if (userProfile?.likedRecipes?.includes(id as string)) {
            setLiked(true);
          }
        }
      } catch (e) {
        console.warn('API 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // author 닉네임으로 uid + 프로필 찾기
  useEffect(() => {
    if (!recipe?.author) return;
    fetchTopUsers(30).then(users => {
      const found = users.find(u => u.nickname === recipe.author);
      if (found) {
        setAuthorUid(found.uid);
        setAuthorProfile({ profileImage: found.profileImage, gender: found.gender });
      }
    }).catch(() => {});
  }, [recipe?.author]);

  const isAdmin = userProfile?.role === 'admin';
  const isMyRecipe = firebaseUser && userProfile && (recipe?.author === userProfile.nickname || isAdmin);

  const REPORT_REASONS = ['욕설/혐오 발언', '스팸/광고', '음란물/선정적 내용', '저작권 침해', '기타'];

  const handleOpenRecipeReport = () => {
    setRecipeMenuVisible(false);
    setReportTarget({ type: isCommunity ? 'community' : 'recipe', id: id as string, title: recipe?.title });
    setReportModalVisible(true);
  };

  const handleOpenCommentReport = (reviewId: string, nickname: string) => {
    setMenuOpenId(null);
    setMenuAnchor(null);
    setReportTarget({ type: 'comment', id: reviewId, title: `${nickname}의 질문` });
    setReportModalVisible(true);
  };

  const handleSubmitReport = async (reason: string) => {
    if (!firebaseUser || !reportTarget) return;
    setReportModalVisible(false);
    try {
      await createReport({
        reporterUid: firebaseUser.uid,
        reporterNickname: userProfile?.nickname,
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        targetTitle: reportTarget.title,
        reason,
      });
      Alert.alert('신고 완료', '신고가 접수되었습니다. 검토 후 조치하겠습니다.');
    } catch (e) {
      Alert.alert('오류', '신고 접수에 실패했습니다.');
    }
  };

  // 공개 범위 전환. 커뮤니티 레시피(내가 올린 것)에만 의미가 있다.
  // isPublic 이 없는 과거 문서는 전체공개로 취급하므로 기본값을 true 로 읽는다.
  const isPublicRecipe = communityRecipe?.isPublic !== false;

  const handleToggleVisibility = () => {
    if (!communityRecipe) return;
    const next = !isPublicRecipe;
    setRecipeMenuVisible(false);
    Alert.alert(
      next ? '전체공개로 변경' : '나만보기로 변경',
      next
        ? '다른 사용자에게도 이 레시피가 보입니다.'
        : '나에게만 보이고 목록·검색에서 사라집니다. 언제든 다시 공개할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            // 낙관적 반영 — 실패하면 되돌린다
            setCommunityRecipe(prev => (prev ? { ...prev, isPublic: next } : prev));
            try {
              await updateCommunityRecipeVisibility(communityRecipe.id, next);
            } catch (e: any) {
              setCommunityRecipe(prev => (prev ? { ...prev, isPublic: !next } : prev));
              Alert.alert('변경 실패', e?.message || '다시 시도해주세요.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteRecipe = () => {
    Alert.alert('레시피 삭제', '정말 이 레시피를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await deleteRecipe(id as string);
            router.back();
          } catch (e) {
            console.warn('레시피 삭제 실패:', e);
            Alert.alert('오류', '레시피 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleEditRecipe = () => {
    setRecipeMenuVisible(false);
    router.push({ pathname: '/recipe/edit', params: { id: id as string } });
  };

  const handleShareRecipe = async () => {
    if (!recipe) return;
    const webUrl = `https://yojalal.com/recipe/${recipe.id}`;
    const imageUrl = recipe.image || 'https://yojalal.com/img/default-profile.png';
    const link = {
      webUrl,
      mobileWebUrl: webUrl,
    };
    try {
      await KakaoShareLink.sendFeed({
        content: {
          title: recipe.title,
          imageUrl,
          link,
          description: `${recipe.time}분 · ${recipe.difficulty} · ${recipe.calories}kcal`,
        },
        buttons: [
          { title: '레시피 보기', link },
        ],
      });
    } catch (e) {
      Alert.alert('공유 실패', '카카오톡이 설치되어 있는지 확인해주세요.');
    }
  };

  const toggleLike = async () => {
    if (!firebaseUser || !userProfile) {
      if (isCommunity) {
        // 비로그인 likeCommunity는 optimistic + 롤백
        setLikeCount(prev => prev + 1);
        try {
          await likeCommunityRecipe(id as string);
        } catch (e) {
          console.warn('좋아요 실패:', e);
          setLikeCount(prev => Math.max(0, prev - 1));
        }
      }
      return;
    }
    // Optimistic UI — 즉시 하트 상태 반전 + 카운트 변경
    const wasLiked = liked;
    const prevProfile = userProfile;
    setLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    setUserProfile({
      ...userProfile,
      likedRecipes: wasLiked
        ? userProfile.likedRecipes.filter(rid => rid !== id)
        : [...userProfile.likedRecipes, id as string],
    });
    try {
      if (wasLiked) {
        await unlikeRecipeUser(firebaseUser.uid, id as string);
      } else {
        await likeRecipeUser(firebaseUser.uid, id as string);
        // 좋아요 과제 — 취소는 완료로 치지 않는다
        completeChallenge(firebaseUser.uid, 'like');
      }
    } catch (e) {
      console.warn('좋아요 실패:', e);
      // 롤백
      setLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
      setUserProfile(prevProfile);
    }
  };

  const handleSubmitReview = async () => {
    if (userComment.trim().length === 0 || !firebaseUser) return;
    const nickname = userProfile?.nickname || firebaseUser?.displayName || '요리사님';
    try {
      const profileImg = userProfile?.profileImage || '';
      const updated = await addRecipeComment(id as string, firebaseUser.uid, nickname, userComment.trim(), profileImg);
      if (updated.comments?.length) {
        setReviews(parseComments(updated.comments));
      }
      // Add current user's profile image to the map
      if (profileImg && profileImg !== 'default') {
        setProfileImageMap(prev => ({ ...prev, [firebaseUser.uid]: profileImg }));
      }
    } catch (e) {
      console.warn('댓글 등록 실패:', e);
    }
    setUserComment('');
    Keyboard.dismiss();
  };

  const handleEditReview = (review: { id: string; comment: string }) => {
    setEditingReviewId(review.id);
    setEditText(review.comment);
  };

  const cancelEdit = () => {
    setEditingReviewId(null);
    setEditText('');
  };

  const handleSaveEdit = async () => {
    if (!editingReviewId || editText.trim().length === 0 || !firebaseUser) return;
    const nickname = userProfile?.nickname || firebaseUser?.displayName || '요리사님';
    try {
      await deleteRecipeComment(id as string, editingReviewId);
      const profileImg = userProfile?.profileImage || '';
      const updated = await addRecipeComment(id as string, firebaseUser.uid, nickname, editText.trim(), profileImg);
      if (updated.comments?.length) {
        setReviews(parseComments(updated.comments));
      }
    } catch (e) {
      console.warn('댓글 수정 실패:', e);
    }
    setEditingReviewId(null);
    setEditText('');
  };

  const handleDeleteReview = async (commentId: string) => {
    try {
      const updated = await deleteRecipeComment(id as string, commentId);
      if (updated.comments?.length) {
        setReviews(parseComments(updated.comments));
      } else {
        setReviews([]);
      }
    } catch (e) {
      console.warn('댓글 삭제 실패:', e);
    }
  };

  // Community-specific handlers
  const avgRating = communityRecipe?.ratings?.length
    ? (communityRecipe.ratings.reduce((s, r) => s + r.score, 0) / communityRecipe.ratings.length).toFixed(1)
    : '0.0';

  const handleRate = async (score: number) => {
    if (!communityRecipe) return;
    setUserRating(score);
    const userId = firebaseUser?.uid || 'guest_' + Math.random().toString(36).slice(2, 8);
    try {
      await rateCommunityRecipe(communityRecipe.id, userId, score);
      setCommunityRecipe(prev => prev ? {
        ...prev,
        ratings: [...prev.ratings, { userId, score }],
      } : null);
      Alert.alert('감사합니다', `${score}점을 주셨어요!`);
    } catch (e) {
      console.warn('평점 실패:', e);
    }
  };

  const handleAskQuestion = async () => {
    if (!questionText.trim() || !communityRecipe) return;
    const newQ = {
      id: Date.now().toString(),
      userId: firebaseUser?.uid || 'guest_' + Math.random().toString(36).slice(2, 8),
      text: questionText.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = { ...communityRecipe, questions: [...communityRecipe.questions, newQ] };
    try {
      await updateCommunityRecipeApi(updated);
      setCommunityRecipe(updated);
      setQuestionText('');
    } catch (e) {
      console.warn('Q&A 실패:', e);
    }
  };

  const handleAnswer = async (qId: string) => {
    const text = answerTexts[qId]?.trim();
    if (!text || !communityRecipe) return;
    const updated = {
      ...communityRecipe,
      questions: communityRecipe.questions.map(q =>
        q.id === qId ? { ...q, answer: text, answerAt: new Date().toISOString() } : q
      ),
    };
    try {
      await updateCommunityRecipeApi(updated);
      setCommunityRecipe(updated);
      setAnswerTexts(prev => ({ ...prev, [qId]: '' }));
    } catch (e) {
      console.warn('답변 실패:', e);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>레시피를 찾을 수 없습니다.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed top buttons - always visible */}
      <SafeAreaView style={styles.fixedTopBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.overlayBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.overlayBtn, { marginRight: 8 }]} onPress={handleShareRecipe} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.overlayBtn, { marginRight: 8 }]}
            onPress={toggleLike}
            activeOpacity={0.7}
          >
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#FF4D67' : '#1A1A1A'} />
          </TouchableOpacity>
          {(isMyRecipe || firebaseUser) && (
            <TouchableOpacity style={styles.overlayBtn} onPress={() => setRecipeMenuVisible(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero Image (다중 이미지 지원) */}
        <View style={styles.imageContainer}>
          {(() => {
            const imgs: string[] = (recipe as any).images?.length
              ? (recipe as any).images
              : (recipe.image ? [recipe.image] : []);
            if (imgs.length <= 1) {
              return imgs[0] ? (
                <Image
                  source={{ uri: hiResImage(imgs[0], 1200) }}
                  style={styles.heroImage}
                  cachePolicy="disk"
                  contentFit="cover"
                  priority="high"
                  allowDownscaling={false}
                />
              ) : null;
            }
            return (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {imgs.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: hiResImage(uri, 1200) }}
                    style={[styles.heroImage, { width }]}
                    cachePolicy="disk"
                    contentFit="cover"
                    priority="high"
                    allowDownscaling={false}
                  />
                ))}
              </ScrollView>
            );
          })()}

          {/* Recipe Menu Action Sheet */}
          <Modal
            visible={recipeMenuVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setRecipeMenuVisible(false)}
          >
            <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setRecipeMenuVisible(false)}>
              <View style={[styles.actionSheetContainer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 24), marginBottom: Platform.OS === 'android' ? 10 : 0 }]}>
                <View style={styles.actionSheetGroup}>
                  {isMyRecipe ? (
                    <>
                      <TouchableOpacity style={styles.actionSheetItem} onPress={handleEditRecipe}>
                        <Text style={styles.actionSheetItemText}>수정</Text>
                      </TouchableOpacity>
                      {isCommunity && communityRecipe ? (
                        <>
                          <View style={styles.actionSheetDivider} />
                          <TouchableOpacity style={styles.actionSheetItem} onPress={handleToggleVisibility}>
                            <Text style={styles.actionSheetItemText}>
                              {isPublicRecipe ? '나만보기로 변경' : '전체공개로 변경'}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                      <View style={styles.actionSheetDivider} />
                      <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setRecipeMenuVisible(false); handleDeleteRecipe(); }}>
                        <Text style={[styles.actionSheetItemText, { color: '#FF3B30' }]}>삭제</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.actionSheetItem} onPress={handleOpenRecipeReport}>
                      <Text style={[styles.actionSheetItemText, { color: '#FF3B30' }]}>신고</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.actionSheetCancel} onPress={() => setRecipeMenuVisible(false)}>
                  <Text style={styles.actionSheetCancelText}>닫기</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* 신고 사유 선택 모달 */}
          <Modal
            visible={reportModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setReportModalVisible(false)}
          >
            <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setReportModalVisible(false)}>
              <View style={styles.actionSheetContainer}>
                <Text style={styles.reportSheetTitle}>신고 사유를 선택해주세요</Text>
                <View style={styles.actionSheetGroup}>
                  {REPORT_REASONS.map((reason, i) => (
                    <React.Fragment key={reason}>
                      {i > 0 && <View style={styles.actionSheetDivider} />}
                      <TouchableOpacity style={styles.actionSheetItem} onPress={() => handleSubmitReport(reason)}>
                        <Text style={styles.actionSheetItemText}>{reason}</Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
                <TouchableOpacity style={styles.actionSheetCancel} onPress={() => setReportModalVisible(false)}>
                  <Text style={styles.actionSheetCancelText}>취소</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Dot Indicators - single image, no dots needed */}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title + Rating */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { flex: 1, marginRight: 12 }]} numberOfLines={1} ellipsizeMode="tail">{recipe.title}</Text>
            <View style={styles.statGroup}>
              <View style={styles.statItem}>
                <Ionicons name="star" size={16} color="#FFB800" style={{ width: 20, textAlign: 'center' }} />
                <Text style={styles.statValue}>{reviewAvgRating > 0 ? reviewAvgRating.toFixed(1) : '0'} ({filteredPhotoReviews.length > 99 ? '99+' : filteredPhotoReviews.length})</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="heart" size={16} color="#FF4D67" style={{ width: 20, textAlign: 'center' }} />
                <Text style={styles.statValue}>{likeCount}</Text>
              </View>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => setReviewModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="help-circle-outline" size={16} color="#9E9E9E" style={{ width: 20, textAlign: 'center' }} />
                <Text style={styles.statValue}>{filteredReviews.length}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Author */}
          <TouchableOpacity style={styles.authorRow} onPress={() => authorUid && router.push(`/profile/${authorUid}`)} disabled={!authorUid} activeOpacity={0.7}>
            {isRemoteProfileImage(authorProfile?.profileImage) ? (
              <Image source={{ uri: authorProfile!.profileImage }} style={styles.authorAvatar} cachePolicy="disk" />
            ) : (
              <RNImage source={authorProfile?.gender === 'female' ? require('../../assets/girl.png') : require('../../assets/man.png')} style={styles.authorAvatar as any} />
            )}
            <Text style={styles.author}>{recipe.author}</Text>
            <Ionicons name="chevron-forward" size={14} color="#BDBDBD" />
          </TouchableOpacity>

          {/* Info Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoText}>
                {recipe.time}<Text style={styles.infoUnit}> 분</Text>
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={[styles.infoText, { color: recipe.difficulty === '쉬움' ? '#1BAE74' : recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623' }]}>{recipe.difficulty}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoText} numberOfLines={1}>
                {recipe.calories || 0}<Text style={styles.infoUnit}> cal</Text>
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoText}>
                {(recipe as any).servings || '1'}<Text style={styles.infoUnit}> 인분</Text>
              </Text>
            </View>
          </View>

          {/* 후기 미리보기 */}
          {true && (
          <TouchableOpacity
            style={styles.commentPreview}
            onPress={() => router.push({ pathname: '/review/[recipeId]', params: { recipeId: id as string, recipeTitle: recipe?.title, authorUid: (recipe as any)?.authorUid || recipe?.author || '' } })}
            activeOpacity={0.7}
          >
            <View style={styles.commentPreviewHeader}>
              <Text style={styles.commentPreviewTitle}>후기 {filteredPhotoReviews.length > 0 ? filteredPhotoReviews.length : ''}</Text>
              <Text style={styles.commentPreviewArrow}>›</Text>
            </View>
            {filteredPhotoReviews.length > 0 ? (
              <View style={styles.commentPreviewBody}>
                {filteredPhotoReviews[0].authorProfileImage && filteredPhotoReviews[0].authorProfileImage !== 'default' && filteredPhotoReviews[0].authorProfileImage.startsWith('http') ? (
                  <Image source={{ uri: filteredPhotoReviews[0].authorProfileImage }} style={styles.commentPreviewAvatar} cachePolicy="disk" />
                ) : (
                  <View style={[styles.commentPreviewAvatar, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={styles.commentPreviewAvatarText}>{(filteredPhotoReviews[0].authorNickname || '?').charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.commentPreviewText} numberOfLines={2}>{filteredPhotoReviews[0].content}</Text>
              </View>
            ) : (
              <Text style={styles.commentPreviewEmpty}>첫 후기를 남기고 20P를 받아보세요!</Text>
            )}
          </TouchableOpacity>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{recipe.description}</Text>
            {((recipe as any)?.tags?.length ?? 0) > 0 && (
              <View style={[styles.tagChipWrap, { marginTop: 12 }]}>
                {(recipe as any).tags.map((t: string) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.tagChipBtn}
                    onPress={() => router.push(`/recipe?tag=${encodeURIComponent(t)}` as any)}
                  >
                    <Text style={styles.tagChipBtnText}>#{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Ingredients */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientRow}>
                <View style={styles.ingredientLeft}>
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                </View>
                <View style={styles.ingredientRight}>
                  <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
                  <TouchableOpacity
                    style={styles.ingredientBuyBtn}
                    activeOpacity={0.7}
                    onPress={() => openCoupangSearch(ingredient.name)}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Ionicons name="cart-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.ingredientBuyText}>구매</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={styles.coupangDisclosure}>구매 버튼은 쿠팡파트너스 활동의 일환으로, 일정액의 수수료를 제공받습니다.</Text>
          </View>

          {/* 배너 광고 */}
          {!isPremium && (
            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <BannerAd unitId={bannerAdUnitId} size={BannerAdSize.LARGE_BANNER} />
            </View>
          )}

          {/* Steps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Steps</Text>
            {recipe.steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumberCircle}>
                  <Text style={styles.stepNumberText}>{step.step}</Text>
                </View>
                <View style={styles.stepContent}>
                  {(step as any).imageUrl && !(step as any).imageUrl.startsWith('file://') ? (
                    <View style={styles.stepPhotoWrap}>
                      <Image source={{ uri: (step as any).imageUrl }} style={styles.stepPhoto} contentFit="cover" cachePolicy="disk" />
                      {(step as any).isAiImage ? (
                        <View style={styles.stepAiBadge}>
                          <Text style={styles.stepAiBadgeText}>AI로 생성된 참고 이미지</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <Text style={styles.stepTime}><Ionicons name="time-outline" size={13} color="#999" /> {step.time >= 1 ? `${step.time}분` : `${Math.round(step.time * 60)}초`}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 비슷한 레시피 */}
          {similarRecipes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>비슷한 레시피</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20, overflow: 'visible' }} contentContainerStyle={{ paddingBottom: 16, paddingTop: 4 }}>
                {similarRecipes.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.similarCard}
                    onPress={() => router.push(`/recipe/${r.id}`)}
                  >
                    <Image source={{ uri: hiResImage(r.image) }} style={styles.similarImage} cachePolicy="disk" recyclingKey={`similar-${r.id}`} contentFit="cover" />
                    <Text style={styles.similarTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.similarMeta}><Ionicons name="heart" size={12} color="#FF6B6B" /> {r.likes ?? 0} · <Ionicons name="time-outline" size={12} color="#666" /> {r.time}분</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: Platform.OS === 'android' ? 140 : 100 }} />
        </View>
      </ScrollView>

      {/* Bottom CTA (커뮤니티 레시피 포함 모두 적용) */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (Platform.OS === 'android' ? 24 : 8) }]}>
        {/* TTS 생성 상태에 따른 조건부 렌더링 */}
        {(recipe as any).ttsStatus === 'PENDING' ? (
          <View style={[styles.ctaButton, { backgroundColor: '#BDBDBD' }]}>
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.ctaText}>AI 음성 레시피 생성 중...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push(`/cooking/${recipe.id}?mode=voice`)}
            activeOpacity={0.85}
          >
            <View style={styles.ctaIconCircle}>
              <Ionicons name="play" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.ctaText}>요리 시작하기</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Review Modal */}
      <Modal
        visible={reviewModalVisible}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => { setReviewModalVisible(false); setMenuOpenId(null); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.reviewModalOverlay}
        >
          <TouchableOpacity style={{ height: Platform.OS === 'android' && kbHeight > 0 ? '10%' : '30%' }} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setMenuOpenId(null); }} />
          <View style={styles.reviewModalContent}>
            {/* Header */}
            <View style={styles.reviewModalHeader}>
              <Text style={styles.reviewModalTitle}>질문 {filteredReviews.length > 0 && <Text style={{ fontWeight: '400', color: '#9E9E9E' }}>{filteredReviews.length}</Text>}</Text>
              <TouchableOpacity onPress={() => { setReviewModalVisible(false); setMenuOpenId(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {/* Reviews List */}
            <ScrollView style={styles.reviewList} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {filteredReviews.length > 0 ? filteredReviews.map((review, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.reviewItem}
                  activeOpacity={canReplyToComments ? 0.8 : 1}
                  onPress={() => {
                    if (!canReplyToComments) return;
                    if (review.reply) return; // 이미 답글 있으면 토글 안 함
                    setReplyingToId(prev => prev === review.id ? null : review.id);
                  }}
                >
                  <View style={styles.commentRow}>
                    {(isRemoteProfileImage(profileImageMap[review.uid]) || isRemoteProfileImage(review.profileImage)) ? (
                      <Image source={{ uri: profileImageMap[review.uid] || review.profileImage }} style={styles.commentAvatar} cachePolicy="disk" />
                    ) : (
                      <RNImage source={require('../../assets/man.png')} style={styles.commentAvatar as any} />
                    )}
                    <View style={styles.commentBody}>
                      <View style={styles.commentMeta}>
                        <View style={styles.commentMetaLeft}>
                          <Text style={styles.reviewItemNickname}>{review.nickname}</Text>
                          <Text style={styles.reviewItemDate}>{review.date}</Text>
                        </View>
                        {firebaseUser && (
                          <TouchableOpacity
                            onPress={(e) => {
                              if (menuOpenId === review.id) {
                                setMenuOpenId(null);
                                setMenuAnchor(null);
                              } else {
                                setMenuAnchor({ x: 0, y: (e.nativeEvent as any).pageY + 8 });
                                setMenuOpenId(review.id);
                              }
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="ellipsis-vertical" size={16} color="#BDBDBD" />
                          </TouchableOpacity>
                        )}
                      </View>
                      {editingReviewId === review.id ? (
                        <View style={{ marginTop: 4 }}>
                          <TextInput
                            style={styles.editInput}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            maxLength={200}
                            autoFocus
                          />
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity style={[styles.editActionBtn, { backgroundColor: '#F0F0F0' }]} onPress={cancelEdit}>
                              <Text style={[styles.editActionBtnText, { color: '#666' }]}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.editActionBtn} onPress={handleSaveEdit}>
                              <Text style={styles.editActionBtnText}>수정</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : review.comment !== '' ? (
                        <Text style={styles.reviewItemComment}>{review.comment}</Text>
                      ) : null}

                      {/* 답글 영역 */}
                      {review.reply ? (
                        <View style={styles.replyBoxQ}>
                          <View style={styles.replyHeaderQ}>
                            <Ionicons name="return-down-forward" size={13} color="#1A1A1A" />
                            {isRemoteProfileImage(authorProfile?.profileImage) ? (
                              <Image source={{ uri: authorProfile!.profileImage }} style={styles.replyAuthorAvatarQ} cachePolicy="disk" />
                            ) : (
                              <RNImage source={authorProfile?.gender === 'female' ? require('../../assets/girl.png') : require('../../assets/man.png')} style={styles.replyAuthorAvatarQ as any} />
                            )}
                            <Text style={[styles.replyAuthorQ, { flex: 1 }]}>{review.replyAuthorNickname || '작성자'}</Text>
                            <Text style={styles.replyBadgeQ}>
                              {review.replyAuthorRole === 'admin' ? '관리자' : '레시피 작성자'}
                            </Text>
                            {canReplyToComments && (
                              <TouchableOpacity
                                onPress={(e) => {
                                  if (replyMenuOpenId === review.id) {
                                    setReplyMenuOpenId(null);
                                    setReplyMenuAnchor(null);
                                  } else {
                                    setReplyMenuAnchor({ x: 0, y: (e.nativeEvent as any).pageY + 8 });
                                    setReplyMenuOpenId(review.id);
                                  }
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="ellipsis-vertical" size={16} color="#BDBDBD" />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={styles.replyContentQ}>{review.reply}</Text>
                        </View>
                      ) : null}

                      {/* 답글 입력 (작성자/관리자가 질문 탭했을 때만) */}
                      {canReplyToComments && ((replyingToId === review.id && !review.reply) || editingReplyId === review.id) && (
                        <View style={styles.replyInputBoxQ}>
                          <TextInput
                            style={styles.replyInputQ}
                            placeholder="답글 달기"
                            placeholderTextColor="#AAA"
                            value={replyDrafts[review.id] || ''}
                            onChangeText={(t) => setReplyDrafts(prev => ({ ...prev, [review.id]: t }))}
                            multiline
                          />
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                            <TouchableOpacity onPress={() => { setEditingReplyId(null); setReplyingToId(null); setReplyDrafts(prev => ({ ...prev, [review.id]: '' })); }}>
                              <Text style={styles.replyActionTextQ}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleSubmitCommentReply(review.id)}>
                              <Text style={[styles.replyActionTextQ, { color: '#1A1A1A' }]}>등록</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: '#BDBDBD' }}>질문이 없습니다</Text>
                </View>
              )}
            </ScrollView>

            {/* 하단 입력창 (당근 스타일) */}
            <View style={[styles.commentInputBar, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 12, marginBottom: Platform.OS === 'android' ? kbHeight + 48 : 0 }]}>
              <TextInput
                style={styles.commentInputField}
                placeholder="질문을 남겨보세요"
                placeholderTextColor="#BDBDBD"
                value={userComment}
                onChangeText={setUserComment}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                onPress={handleSubmitReview}
                disabled={userComment.trim().length === 0}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="send" size={22} color={userComment.trim().length === 0 ? '#DADADA' : '#1A1A1A'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 댓글 메뉴 드롭다운 오버레이 */}
          {menuOpenId !== null && menuAnchor && (
            <>
              <TouchableOpacity
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                activeOpacity={1}
                onPress={() => { setMenuOpenId(null); setMenuAnchor(null); }}
              />
              <View style={[styles.reviewMenuDropdown, { position: 'absolute', right: 16, top: menuAnchor.y, zIndex: 100 }]}>
                {(() => {
                  const menuReview = reviews.find(r => r.id === menuOpenId);
                  const isCommentOwner = menuReview?.uid === firebaseUser?.uid || isAdmin;
                  return isCommentOwner ? (
                    <>
                      <TouchableOpacity style={styles.reviewMenuItem} onPress={() => {
                        if (menuReview) handleEditReview(menuReview);
                        setMenuOpenId(null);
                        setMenuAnchor(null);
                      }}>
                        <Text style={styles.reviewMenuItemText}>수정</Text>
                      </TouchableOpacity>
                      <View style={styles.reviewMenuDivider} />
                      <TouchableOpacity style={styles.reviewMenuItem} onPress={() => {
                        if (menuOpenId) handleDeleteReview(menuOpenId);
                        setMenuOpenId(null);
                        setMenuAnchor(null);
                      }}>
                        <Text style={[styles.reviewMenuItemText, { color: '#FF4444' }]}>삭제</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.reviewMenuItem} onPress={() => {
                      if (menuReview) handleOpenCommentReport(menuReview.id, menuReview.nickname);
                    }}>
                      <Text style={[styles.reviewMenuItemText, { color: '#FF4444' }]}>신고</Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </>
          )}

          {/* 답글 메뉴 드롭다운 */}
          {replyMenuOpenId !== null && replyMenuAnchor && (
            <>
              <TouchableOpacity
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                activeOpacity={1}
                onPress={() => { setReplyMenuOpenId(null); setReplyMenuAnchor(null); }}
              />
              <View style={[styles.reviewMenuDropdown, { position: 'absolute', right: 16, top: replyMenuAnchor.y, zIndex: 100 }]}>
                <TouchableOpacity style={styles.reviewMenuItem} onPress={() => {
                  const r = reviews.find(rv => rv.id === replyMenuOpenId);
                  if (r) { setEditingReplyId(r.id); setReplyDrafts(prev => ({ ...prev, [r.id]: r.reply || '' })); }
                  setReplyMenuOpenId(null);
                  setReplyMenuAnchor(null);
                }}>
                  <Text style={styles.reviewMenuItemText}>수정</Text>
                </TouchableOpacity>
                <View style={styles.reviewMenuDivider} />
                <TouchableOpacity style={styles.reviewMenuItem} onPress={() => {
                  if (replyMenuOpenId) handleDeleteCommentReply(replyMenuOpenId);
                  setReplyMenuOpenId(null);
                  setReplyMenuAnchor(null);
                }}>
                  <Text style={[styles.reviewMenuItemText, { color: '#FF4444' }]}>삭제</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 100,
  },

  // Hero Image — 원본 이미지 11:6 가로형(1408×768)에 맞춰 0.6 비율로 조정.
  // 0.95(거의 정사각)였을 때 세로 1.63x 업스케일로 흐려지던 문제 해결.
  imageContainer: {
    width: '100%',
    height: width * 0.6,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
  },
  fixedTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
  },
  overlayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBtnIcon: {
    fontSize: 20,
    color: '#1A1A1A',
    textAlign: 'center',
    ...Platform.select({
      android: {
        textAlignVertical: 'center',
        includeFontPadding: false,
        marginTop: -9,
      },
    }),
  },
  actionSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  actionSheetContainer: {
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  actionSheetGroup: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  actionSheetItem: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionSheetItemText: {
    fontSize: 17,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  actionSheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0E0E0',
  },
  reportSheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
  },
  actionSheetCancel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionSheetCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dotRow: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Content
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Title
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleLeft: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  author: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 36,
  },
  ratingStar: {
    fontSize: 16,
    color: '#FF4D67',
    width: 20,
    textAlign: 'center',
  },
  statIcon: {
    fontSize: 16,
    color: '#9E9E9E',
    width: 20,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 2,
    minWidth: 14,
    textAlign: 'center',
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 18,
    paddingHorizontal: 4,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  infoIcon: {
    fontSize: 12,
    color: '#1A1A1A',
    marginRight: 1,
  },
  infoUnit: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  infoDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
  },

  // Sections
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 15,
    color: '#666',
    lineHeight: 24,
  },

  // Ingredients
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  ingredientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  ingredientEmoji: {
    fontSize: 22,
  },
  ingredientName: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  ingredientAmount: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  ingredientRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ingredientBuyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1BAE74',
  },
  ingredientBuyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coupangDisclosure: {
    fontSize: 10,
    color: '#9E9E9E',
    marginTop: 10,
    lineHeight: 14,
  },

  // AdMob Banner
  adBanner: {
    alignItems: 'center',
    marginTop: 16,
    overflow: 'hidden',
    borderRadius: 8,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  stepNumberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1BAE74',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepPhoto: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#E8E8E8',
  },
  stepPhotoWrap: {
    position: 'relative',
  },
  stepAiBadge: {
    position: 'absolute',
    right: 4,
    bottom: 14,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  stepAiBadgeText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  stepDescription: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  stepTime: {
    fontSize: 13,
    color: '#1A1A1A',
    marginTop: 8,
    fontWeight: '600',
  },

  // Bottom CTA
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  ctaButton: {
    flexDirection: 'row',
    backgroundColor: '#1BAE74',
    borderRadius: 18,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1BAE74',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  ctaPlayIcon: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 2,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    width: '100%',
    maxWidth: 380,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 14,
    position: 'relative',
  },
  modeCardHighlight: {
    backgroundColor: '#F6FDF9',
    borderColor: '#1BAE74',
    borderWidth: 1.5,
  },
  modeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modeRecommendBadgeAbs: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#1BAE74',
    zIndex: 2,
  },
  modeRecommendText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modeEmoji: {
    fontSize: 22,
    color: '#1A1A1A',
  },
  modeArrow: {
    fontSize: 22,
    color: '#C0C0C0',
    fontWeight: '300',
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
    textAlign: 'center',
  },
  modeDesc: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '600',
  },

  // Review Modal
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  reviewModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  reviewModalClose: {
    fontSize: 18,
    color: '#9E9E9E',
    padding: 4,
  },
  reviewList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  reviewItem: {
    marginBottom: 18,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    marginTop: 2,
  },
  commentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewItemNickname: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    includeFontPadding: false,
  },
  reviewItemDate: {
    fontSize: 11,
    color: '#BDBDBD',
    includeFontPadding: false,
  },
  reviewItemComment: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginTop: 2,
    includeFontPadding: false,
  },
  reviewMenuBtn: {
    fontSize: 18,
    color: '#BDBDBD',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  editActionBtn: {
    flex: 1,
    backgroundColor: '#1BAE74',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  editActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#fff',
    gap: 10,
  },
  commentInputField: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#1A1A1A',
    maxHeight: 80,
  },
  commentSendBtn: {
    fontSize: 22,
    color: '#1A1A1A',
    paddingBottom: 2,
  },
  reviewMenuDropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  reviewMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  reviewMenuItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  reviewMenuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },

  // Comment Preview (YouTube style)
  commentPreview: {
    marginTop: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 16,
  },
  commentPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  commentPreviewArrow: {
    fontSize: 20,
    color: '#BDBDBD',
  },
  commentPreviewBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentPreviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  commentPreviewAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  commentPreviewText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  commentPreviewEmpty: {
    fontSize: 13,
    color: '#BDBDBD',
  },

  // Tags
  tagChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EAF7F1',
  },
  tagChipBtnText: {
    fontSize: 13,
    color: '#0B9A61',
    fontWeight: '600',
  },

  // Similar Recipes
  similarCard: {
    width: Platform.OS === 'android' ? 120 : 140,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    elevation: 2,
  },
  similarImage: {
    width: '100%',
    height: Platform.OS === 'android' ? 85 : 100,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  similarTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  similarMeta: {
    fontSize: 11,
    color: '#9E9E9E',
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 3,
  },

  // Community: Rating Badge
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  ratingBadgeStar: {
    fontSize: 18,
    color: '#FFB800',
    marginRight: 4,
  },
  ratingBadgeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // Community: Rating Section
  ratingDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingBig: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  ratingCountText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  ratingPrompt: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  starButton: {
    fontSize: 36,
    color: '#FFB800',
  },
  ratedBox: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
  },
  ratedText: {
    fontSize: 16,
    color: '#FFB800',
    fontWeight: '700',
  },

  // Community: Q&A
  questionInput: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  qInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
    maxHeight: 80,
  },
  qSubmitBtn: {
    backgroundColor: '#1BAE74',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  qSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyQA: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyQAText: {
    fontSize: 15,
    color: '#999',
    fontWeight: '600',
  },
  emptyQASub: {
    fontSize: 13,
    color: '#BDBDBD',
    marginTop: 4,
  },
  questionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  qHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qUser: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },
  qDate: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  qText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 21,
  },
  answerBox: {
    marginTop: 12,
    backgroundColor: '#E8F5EF',
    borderRadius: 10,
    padding: 12,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  answerInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  aInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  aSubmitBtn: {
    backgroundColor: '#1BAE74',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  aSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  replyBoxQ: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
  },
  replyHeaderQ: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  replyAuthorQ: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  replyAuthorAvatarQ: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEE',
  },
  replyBadgeQ: {
    fontSize: 9, color: '#1A1A1A',
    backgroundColor: '#E0F5EA',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: '700',
  },
  replyContentQ: { fontSize: 14, color: '#333', lineHeight: 20 },
  replyActionTextQ: { fontSize: 11, color: '#666', fontWeight: '600' },
  replyInputBoxQ: {
    marginTop: 8,
    backgroundColor: '#FAFAFA',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  replyInputQ: {
    fontSize: 13,
    color: '#1A1A1A',
    minHeight: 36,
    textAlignVertical: 'top',
  },
});

