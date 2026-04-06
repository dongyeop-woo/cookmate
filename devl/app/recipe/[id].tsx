import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { fetchRecipeById, fetchRecipesByCategory, bookmarkRecipeUser, unbookmarkRecipeUser, likeRecipeUser, unlikeRecipeUser, addRecipeComment, deleteRecipeComment, fetchUser, deleteRecipe, fetchCommunityRecipeById, updateCommunityRecipeApi, rateCommunityRecipe, likeCommunityRecipe, unlikeCommunityRecipe } from '../../services/api';
import type { Recipe } from '../../constants/recipes';
import type { CommunityRecipe } from '../../constants/community';
import { useAuth } from '../_layout';

const { width } = Dimensions.get('window');
const PIXEL_RATIO = Math.ceil(Dimensions.get('window').scale);

// AdMob 광고 유닛 ID (TODO: 실제 AdMob 계정 생성 후 교체)
const ADMOB_BANNER_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : Platform.OS === 'ios'
    ? 'ca-app-pub-8542314434357214/6417512417'
    : 'ca-app-pub-8542314434357214/3982920767';

const hiResImage = (uri: string, w = 800) => {
  if (uri && uri.includes('unsplash.com')) {
    return uri.replace(/[?&]w=\d+/, `?w=${w * PIXEL_RATIO}`);
  }
  return uri;
};

export default function RecipeDetailScreen() {
  const { id, type } = useLocalSearchParams();
  const isCommunity = type === 'community';
  const router = useRouter();
  const { userProfile, setUserProfile, firebaseUser } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [communityRecipe, setCommunityRecipe] = useState<CommunityRecipe | null>(null);
  const [similarRecipes, setSimilarRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [userComment, setUserComment] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [recipeMenuVisible, setRecipeMenuVisible] = useState(false);
  const [reviews, setReviews] = useState<{ id: string; comment: string; date: string; nickname: string; uid: string; createdAt: string; profileImage?: string }[]>([]);
  const [profileImageMap, setProfileImageMap] = useState<Record<string, string>>({});
  // Community-specific state
  const [userRating, setUserRating] = useState(0);
  const [questionText, setQuestionText] = useState('');
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});

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
            calories: 0,
            rating: cr.ratings.length > 0 ? cr.ratings.reduce((s, r) => s + r.score, 0) / cr.ratings.length : 0,
            likes: cr.likes,
            bookmarks: 0,
            image: cr.image,
            category: cr.category,
            description: cr.description,
            ingredients: cr.ingredients.map(i => ({ ...i, icon: '' })),
            steps: cr.steps.map((s, idx) => ({ step: idx + 1, description: s.description, time: s.time })),
          } as Recipe);
          if (userProfile?.likedRecipes?.includes(id as string)) {
            setLiked(true);
          }
        } else {
          const r = await fetchRecipeById(id as string);
          setRecipe(r);
          setLikeCount(r.likes ?? 0);
          setBookmarkCount(r.bookmarks ?? 0);
          // Load comments from backend
          if (r.comments?.length) {
            const parsed = parseComments(r.comments);
            setReviews(parsed);
            const uids = [...new Set(parsed.map(c => c.uid).filter(Boolean))];
            const imgMap: Record<string, string> = {};
            if (firebaseUser?.uid && userProfile?.profileImage && userProfile.profileImage !== 'default') {
              imgMap[firebaseUser.uid] = userProfile.profileImage;
            }
            await Promise.all(uids.map(async uid => {
              if (imgMap[uid]) return;
              try {
                const u = await fetchUser(uid);
                if (u?.profileImage && u.profileImage !== 'default' && u.profileImage.startsWith('http')) {
                  imgMap[uid] = u.profileImage;
                }
              } catch {}
            }));
            setProfileImageMap(imgMap);
          }
          const catRecipes = await fetchRecipesByCategory(r.category);
          setSimilarRecipes(
            catRecipes.filter(sr => sr.id !== id).sort((a, b) => b.rating - a.rating).slice(0, 6)
          );
          if (userProfile?.bookmarkedRecipes?.includes(id as string)) {
            setBookmarked(true);
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

  const isMyRecipe = firebaseUser && userProfile && recipe?.author === userProfile.nickname;

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

  const toggleBookmark = async () => {
    if (!firebaseUser || !userProfile) return;
    try {
      if (bookmarked) {
        await unbookmarkRecipeUser(firebaseUser.uid, id as string);
        setUserProfile({
          ...userProfile,
          bookmarkedRecipes: userProfile.bookmarkedRecipes.filter(rid => rid !== id),
        });
        setBookmarkCount(prev => Math.max(0, prev - 1));
      } else {
        await bookmarkRecipeUser(firebaseUser.uid, id as string);
        setUserProfile({
          ...userProfile,
          bookmarkedRecipes: [...userProfile.bookmarkedRecipes, id as string],
        });
        setBookmarkCount(prev => prev + 1);
      }
      setBookmarked(!bookmarked);
    } catch (e) {
      console.warn('북마크 실패:', e);
    }
  };

  const toggleLike = async () => {
    if (!firebaseUser || !userProfile) {
      if (isCommunity) {
        try {
          await likeCommunityRecipe(id as string);
          setLikeCount(prev => prev + 1);
        } catch (e) {
          console.warn('좋아요 실패:', e);
        }
      }
      return;
    }
    try {
      if (liked) {
        await unlikeRecipeUser(firebaseUser.uid, id as string);
        setUserProfile({
          ...userProfile,
          likedRecipes: userProfile.likedRecipes.filter(rid => rid !== id),
        });
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await likeRecipeUser(firebaseUser.uid, id as string);
        setUserProfile({
          ...userProfile,
          likedRecipes: [...userProfile.likedRecipes, id as string],
        });
        setLikeCount(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (e) {
      console.warn('좋아요 실패:', e);
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
        <ActivityIndicator size="large" color="#0B9A61" />
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
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: hiResImage(recipe.image, 1200) }} style={styles.heroImage} />

          {/* Overlay Buttons */}
          <SafeAreaView style={styles.imageOverlay}>
            <TouchableOpacity style={styles.overlayBtn} onPress={() => router.back()}>
              <Text style={styles.overlayBtnIcon}>←</Text>
            </TouchableOpacity>
            {isMyRecipe && !isCommunity ? (
              <TouchableOpacity
                style={styles.overlayBtn}
                onPress={() => setRecipeMenuVisible(!recipeMenuVisible)}
              >
                <Text style={[styles.overlayBtnIcon, { fontSize: 22, fontWeight: '700', marginTop: 4 }]}>⋮</Text>
              </TouchableOpacity>
            ) : isCommunity ? (
              <TouchableOpacity style={styles.overlayBtn} onPress={toggleLike} activeOpacity={0.7}>
                <Text style={styles.overlayBtnIcon}>{liked ? '♥' : '♡'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.overlayBtn}
                onPress={toggleBookmark}
              >
                <Text style={styles.overlayBtnIcon}>{bookmarked ? '★' : '☆'}</Text>
              </TouchableOpacity>
            )}
          </SafeAreaView>

          {/* Recipe Menu Action Sheet */}
          <Modal
            visible={recipeMenuVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setRecipeMenuVisible(false)}
          >
            <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setRecipeMenuVisible(false)}>
              <View style={styles.actionSheetContainer}>
                <View style={styles.actionSheetGroup}>
                  <TouchableOpacity style={styles.actionSheetItem} onPress={handleEditRecipe}>
                    <Text style={styles.actionSheetItemText}>수정</Text>
                  </TouchableOpacity>
                  <View style={styles.actionSheetDivider} />
                  <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setRecipeMenuVisible(false); handleDeleteRecipe(); }}>
                    <Text style={[styles.actionSheetItemText, { color: '#FF3B30' }]}>삭제</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.actionSheetCancel} onPress={() => setRecipeMenuVisible(false)}>
                  <Text style={styles.actionSheetCancelText}>닫기</Text>
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
            <View style={styles.titleLeft}>
              <Text style={styles.title}>{recipe.title}</Text>
              <Text style={styles.author}>By {recipe.author}</Text>
            </View>
            {isCommunity ? (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingBadgeStar}>★</Text>
                <Text style={styles.ratingBadgeValue}>{avgRating}</Text>
              </View>
            ) : (
              <View style={styles.statGroup}>
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={toggleLike}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ratingStar}>{liked ? '♥' : '♡'}</Text>
                  <Text style={styles.statValue}>{likeCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={toggleBookmark}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statIcon, bookmarked && { color: '#FFB800' }]}>{bookmarked ? '★' : '☆'}</Text>
                  <Text style={styles.statValue}>{bookmarkCount}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Info Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>◷</Text>
              <Text style={styles.infoText}>{recipe.time}분</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>◈</Text>
              <Text style={styles.infoText}>{recipe.difficulty}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              {isCommunity ? (
                <TouchableOpacity onPress={toggleLike} activeOpacity={0.7}>
                  <Text style={styles.infoText}>{liked ? '♥' : '♡'} {likeCount}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.infoIcon}>♨</Text>
                  <Text style={styles.infoText}>{recipe.calories} cal</Text>
                </>
              )}
            </View>
          </View>

          {/* 댓글 미리보기 (일반 레시피만) */}
          {!isCommunity && (
          <TouchableOpacity
            style={styles.commentPreview}
            onPress={() => setReviewModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.commentPreviewHeader}>
              <Text style={styles.commentPreviewTitle}>댓글 {reviews.length > 0 ? reviews.length : ''}</Text>
              <Text style={styles.commentPreviewArrow}>›</Text>
            </View>
            {reviews.length > 0 ? (
              <View style={styles.commentPreviewBody}>
                {(profileImageMap[reviews[reviews.length - 1].uid] || (reviews[reviews.length - 1].profileImage && reviews[reviews.length - 1].profileImage !== 'default')) ? (
                  <Image source={{ uri: profileImageMap[reviews[reviews.length - 1].uid] || reviews[reviews.length - 1].profileImage }} style={styles.commentPreviewAvatar} />
                ) : (
                  <View style={[styles.commentPreviewAvatar, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={styles.commentPreviewAvatarText}>{reviews[reviews.length - 1].nickname.charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.commentPreviewText} numberOfLines={2}>{reviews[reviews.length - 1].comment}</Text>
              </View>
            ) : (
              <Text style={styles.commentPreviewEmpty}>첫 댓글을 남겨보세요</Text>
            )}
          </TouchableOpacity>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{recipe.description}</Text>
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
                </View>
              </View>
            ))}
            {/* AdMob 배너 광고 */}
            <View style={styles.adBanner}>
              <BannerAd
                unitId={ADMOB_BANNER_ID}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{ requestNonPersonalizedAdsOnly: true }}
              />
            </View>
          </View>

          {/* Steps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Steps</Text>
            {recipe.steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumberCircle}>
                  <Text style={styles.stepNumberText}>{step.step}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <Text style={styles.stepTime}>◷ {step.time >= 1 ? `${step.time}분` : `${Math.round(step.time * 60)}초`}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Community: Rating Section */}
          {isCommunity && communityRecipe && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⭐ 평점</Text>
              <View style={styles.ratingDisplay}>
                <Text style={styles.ratingBig}>{avgRating}</Text>
                <Text style={styles.ratingCountText}>{communityRecipe.ratings.length}명 참여</Text>
              </View>
              {userRating === 0 ? (
                <View>
                  <Text style={styles.ratingPrompt}>이 레시피에 평점을 남겨주세요</Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => handleRate(star)} activeOpacity={0.6}>
                        <Text style={styles.starButton}>☆</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.ratedBox}>
                  <Text style={styles.ratedText}>
                    {'★'.repeat(userRating)}{'☆'.repeat(5 - userRating)} 평가 완료!
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Community: Q&A Section */}
          {isCommunity && communityRecipe && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💬 Q&A ({communityRecipe.questions.length})</Text>
              <View style={styles.questionInput}>
                <TextInput
                  style={styles.qInput}
                  placeholder="궁금한 점을 질문하세요..."
                  placeholderTextColor="#BDBDBD"
                  value={questionText}
                  onChangeText={setQuestionText}
                  multiline
                />
                <TouchableOpacity style={styles.qSubmitBtn} onPress={handleAskQuestion} activeOpacity={0.7}>
                  <Text style={styles.qSubmitText}>등록</Text>
                </TouchableOpacity>
              </View>
              {communityRecipe.questions.length === 0 ? (
                <View style={styles.emptyQA}>
                  <Text style={styles.emptyQAText}>아직 질문이 없어요</Text>
                  <Text style={styles.emptyQASub}>첫 번째 질문을 남겨보세요!</Text>
                </View>
              ) : (
                communityRecipe.questions.map((q) => (
                  <View key={q.id} style={styles.questionCard}>
                    <View style={styles.qHeader}>
                      <Text style={styles.qUser}>🙋 {q.userId.slice(0, 10)}</Text>
                      <Text style={styles.qDate}>{formatDate(q.createdAt)}</Text>
                    </View>
                    <Text style={styles.qText}>{q.text}</Text>
                    {q.answer ? (
                      <View style={styles.answerBox}>
                        <Text style={styles.answerLabel}>↳ 답변</Text>
                        <Text style={styles.answerText}>{q.answer}</Text>
                      </View>
                    ) : (
                      <View style={styles.answerInputRow}>
                        <TextInput
                          style={styles.aInput}
                          placeholder="답변을 작성하세요..."
                          placeholderTextColor="#BDBDBD"
                          value={answerTexts[q.id] || ''}
                          onChangeText={(t) => setAnswerTexts(prev => ({ ...prev, [q.id]: t }))}
                        />
                        <TouchableOpacity style={styles.aSubmitBtn} onPress={() => handleAnswer(q.id)} activeOpacity={0.7}>
                          <Text style={styles.aSubmitText}>답변</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* 비슷한 레시피 (일반 레시피만) */}
          {!isCommunity && similarRecipes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>비슷한 레시피</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20, overflow: 'visible' }} contentContainerStyle={{ paddingBottom: 8 }}>
                {similarRecipes.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.similarCard}
                    onPress={() => router.push(`/recipe/${r.id}`)}
                  >
                    <Image source={{ uri: hiResImage(r.image) }} style={styles.similarImage} />
                    <Text style={styles.similarTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.similarMeta}>♥ {r.likes ?? 0} · ☆ {r.bookmarks ?? 0} · ◷ {r.time}분</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom CTA (일반 레시피만) */}
      {!isCommunity && (
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.ctaIconCircle}>
            <Text style={styles.ctaPlayIcon}>▶</Text>
          </View>
          <Text style={styles.ctaText}>요리 시작하기</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Mode Selection Modal (일반 레시피만) */}
      {!isCommunity && (
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>요리 모드 선택</Text>
            <Text style={styles.modalSubtitle}>편한 모드를 선택하세요</Text>

            <TouchableOpacity
              style={styles.modeButton}
              onPress={() => {
                setModalVisible(false);
                router.push(`/cooking/${recipe.id}?mode=button`);
              }}
            >
              <View style={[styles.modeIconCircle, { backgroundColor: '#E8F5E9' }]}>
                <Text style={styles.modeEmoji}>☝︎</Text>
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>버튼 모드</Text>
                <Text style={styles.modeDesc}>화면을 터치해서 다음 단계로</Text>
              </View>
              <Text style={styles.modeArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeButton}
              onPress={() => {
                setModalVisible(false);
                router.push(`/cooking/${recipe.id}?mode=voice`);
              }}
            >
              <View style={[styles.modeIconCircle, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.modeEmoji}>◉</Text>
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>음성 모드</Text>
                <Text style={styles.modeDesc}>"다음"이라고 말하면 넘어가요</Text>
              </View>
              <Text style={styles.modeArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      )}

      {/* Review Modal (일반 레시피만) */}
      {!isCommunity && (
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setReviewModalVisible(false); setMenuOpenId(null); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.reviewModalOverlay}
        >
          <TouchableOpacity style={{ height: '30%' }} activeOpacity={1} onPress={() => { Keyboard.dismiss(); setMenuOpenId(null); }} />
          <View style={styles.reviewModalContent}>
            {/* Header */}
            <View style={styles.reviewModalHeader}>
              <Text style={styles.reviewModalTitle}>댓글 {reviews.length > 0 && <Text style={{ fontWeight: '400', color: '#9E9E9E' }}>{reviews.length}</Text>}</Text>
              <TouchableOpacity onPress={() => { setReviewModalVisible(false); setMenuOpenId(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.reviewModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Reviews List */}
            <ScrollView style={styles.reviewList} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {reviews.length > 0 ? reviews.map((review, idx) => (
                <View key={idx} style={styles.reviewItem}>
                  <View style={styles.commentRow}>
                    {(profileImageMap[review.uid] || (review.profileImage && review.profileImage !== 'default')) ? (
                      <Image source={{ uri: profileImageMap[review.uid] || review.profileImage }} style={styles.commentAvatar} />
                    ) : (
                      <View style={styles.commentAvatarFallback}>
                        <Text style={styles.commentAvatarText}>{review.nickname.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={styles.commentBody}>
                      <View style={styles.commentMeta}>
                        <View style={styles.commentMetaLeft}>
                          <Text style={styles.reviewItemNickname}>{review.nickname}</Text>
                          <Text style={styles.reviewItemDate}>{review.date}</Text>
                        </View>
                        {firebaseUser && review.uid === firebaseUser.uid && (
                          <TouchableOpacity onPress={() => setMenuOpenId(menuOpenId === review.id ? null : review.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.reviewMenuBtn}>⋮</Text>
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
                    </View>
                  </View>
                </View>
              )) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: '#BDBDBD' }}>댓글이 없습니다</Text>
                </View>
              )}
            </ScrollView>

            {/* 하단 입력창 (당근 스타일) */}
            <View style={styles.commentInputBar}>
              <TextInput
                style={styles.commentInputField}
                placeholder="댓글을 남겨보세요"
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
                <Text style={[styles.commentSendBtn, userComment.trim().length === 0 && { color: '#DADADA' }]}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dropdown overlay */}
          {menuOpenId !== null && (
            <>
              <TouchableOpacity
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                activeOpacity={1}
                onPress={() => setMenuOpenId(null)}
              />
              <View style={styles.reviewMenuDropdown}>
                <TouchableOpacity style={styles.reviewMenuItem} onPress={() => {
                  const review = reviews.find(r => r.id === menuOpenId);
                  if (review) handleEditReview(review);
                  setMenuOpenId(null);
                }}>
                  <Text style={styles.reviewMenuItemText}>수정</Text>
                </TouchableOpacity>
                <View style={styles.reviewMenuDivider} />
                <TouchableOpacity style={styles.reviewMenuItem} onPress={() => {
                  if (menuOpenId) handleDeleteReview(menuOpenId);
                  setMenuOpenId(null);
                }}>
                  <Text style={[styles.reviewMenuItemText, { color: '#FF4444' }]}>삭제</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
      )}
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

  // Hero Image
  imageContainer: {
    width: '100%',
    height: width * 0.95,
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
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  overlayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overlayBtnIcon: {
    fontSize: 20,
    color: '#1A1A1A',
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
    alignItems: 'flex-start',
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
  author: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 6,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {
    fontSize: 16,
    color: '#0B9A61',
    marginRight: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
  infoDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
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
    backgroundColor: '#0B9A61',
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
  stepDescription: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  stepTime: {
    fontSize: 13,
    color: '#0B9A61',
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  ctaButton: {
    flexDirection: 'row',
    backgroundColor: '#0B9A61',
    borderRadius: 18,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B9A61',
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
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  modeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
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
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  modeDesc: {
    fontSize: 13,
    color: '#9E9E9E',
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
    justifyContent: 'flex-end',
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
    color: '#0B9A61',
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
    fontSize: 13,
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
    marginLeft: 42,
  },
  editActionBtn: {
    flex: 1,
    backgroundColor: '#0B9A61',
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
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
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
    color: '#0B9A61',
    paddingBottom: 2,
  },
  reviewMenuDropdown: {
    position: 'absolute',
    right: 24,
    bottom: '45%',
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
    color: '#0B9A61',
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

  // Similar Recipes
  similarCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    elevation: 3,
  },
  similarImage: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
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
    backgroundColor: '#0B9A61',
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
    color: '#0B9A61',
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
    backgroundColor: '#0B9A61',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  aSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
