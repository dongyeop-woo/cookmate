import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Recipe, Category } from '../constants/recipes';
import type { CommunityRecipe } from '../constants/community';

const CLOUD_RUN_URL = 'https://devl-backend-879574205436.asia-northeast3.run.app';

const getBaseUrl = (): string => {
  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
    if (debuggerHost) {
      return `http://${debuggerHost}:8080`;
    }
  }
  return CLOUD_RUN_URL;
};

const BASE_URL = getBaseUrl();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as unknown as T);
}

// ── Recipes ──

export async function fetchRecipes(): Promise<Recipe[]> {
  return request<Recipe[]>('/api/recipes');
}

export async function fetchRecipeById(id: string): Promise<Recipe> {
  return request<Recipe>(`/api/recipes/${id}`);
}

export async function fetchRecipesByCategory(category: string): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/recipes/category/${encodeURIComponent(category)}`);
}

export async function addRecipeComment(recipeId: string, uid: string, nickname: string, text: string, profileImage?: string): Promise<Recipe> {
  return request<Recipe>(`/api/recipes/${encodeURIComponent(recipeId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ uid, nickname, text, profileImage }),
  });
}

export async function deleteRecipeComment(recipeId: string, commentId: string): Promise<Recipe> {
  return request<Recipe>(`/api/recipes/${encodeURIComponent(recipeId)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await request(`/api/recipes/${encodeURIComponent(recipeId)}`, { method: 'DELETE' });
}

export async function updateRecipe(recipeId: string, data: Partial<Recipe>): Promise<Recipe> {
  return request<Recipe>(`/api/recipes/${encodeURIComponent(recipeId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchTopRecipes(limit = 10): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/recipes/top?limit=${limit}`);
}

export async function fetchQuickRecipes(maxMinutes = 15): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/recipes/quick?maxMinutes=${maxMinutes}`);
}

export async function fetchCategories(): Promise<Category[]> {
  return request<Category[]>('/api/recipes/categories');
}

// ── Community ──

export async function fetchCommunityRecipes(): Promise<CommunityRecipe[]> {
  return request<CommunityRecipe[]>('/api/community');
}

export async function fetchCommunityRecipeById(id: string): Promise<CommunityRecipe> {
  return request<CommunityRecipe>(`/api/community/${id}`);
}

export async function createCommunityRecipe(recipe: Omit<CommunityRecipe, 'id'>): Promise<CommunityRecipe> {
  return request<CommunityRecipe>('/api/community', {
    method: 'POST',
    body: JSON.stringify(recipe),
  });
}

export async function updateCommunityRecipeApi(recipe: CommunityRecipe): Promise<CommunityRecipe> {
  return request<CommunityRecipe>(`/api/community/${recipe.id}`, {
    method: 'PUT',
    body: JSON.stringify(recipe),
  });
}

export async function deleteCommunityRecipeApi(id: string): Promise<void> {
  await fetch(`${BASE_URL}/api/community/${id}`, { method: 'DELETE' });
}

export async function rateCommunityRecipe(id: string, userId: string, score: number): Promise<void> {
  await request(`/api/community/${id}/rating`, {
    method: 'POST',
    body: JSON.stringify({ userId, score }),
  });
}

export async function likeCommunityRecipe(id: string): Promise<void> {
  await request(`/api/community/${id}/like`, { method: 'POST' });
}

export async function unlikeCommunityRecipe(id: string): Promise<void> {
  await request(`/api/community/${id}/like`, { method: 'DELETE' });
}

// ── Users ──

export type UserProfile = {
  uid: string;
  email: string;
  nickname: string;
  phone: string;
  profileImage: string;
  bio: string;
  gender: 'male' | 'female' | '';
  role: 'user' | 'admin';
  followers: string[];
  following: string[];
  likedRecipes: string[];
  bookmarkedRecipes: string[];
  recipeCount: number;
  totalLikes: number;
  createdAt?: string;
  updatedAt?: string;
};

export async function createUser(user: Partial<UserProfile>): Promise<UserProfile> {
  return request<UserProfile>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export async function fetchUser(uid: string): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/api/users/${encodeURIComponent(uid)}`);
  } catch {
    return null;
  }
}

export async function updateUser(uid: string, data: Partial<UserProfile>): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function followUser(uid: string, targetUid: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/follow/${encodeURIComponent(targetUid)}`, { method: 'POST' });
}

export async function unfollowUser(uid: string, targetUid: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/follow/${encodeURIComponent(targetUid)}`, { method: 'DELETE' });
}

export async function likeRecipeUser(uid: string, recipeId: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/like/${encodeURIComponent(recipeId)}`, { method: 'POST' });
}

export async function unlikeRecipeUser(uid: string, recipeId: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/like/${encodeURIComponent(recipeId)}`, { method: 'DELETE' });
}

export async function bookmarkRecipeUser(uid: string, recipeId: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/bookmark/${encodeURIComponent(recipeId)}`, { method: 'POST' });
}

export async function unbookmarkRecipeUser(uid: string, recipeId: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/bookmark/${encodeURIComponent(recipeId)}`, { method: 'DELETE' });
}

export async function fetchUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/api/users/email/${encodeURIComponent(email)}`);
  } catch {
    return null;
  }
}

export async function fetchUserByPhone(phone: string): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/api/users/phone/${encodeURIComponent(phone)}`);
  } catch {
    return null;
  }
}

export async function fetchTopUsers(limit = 20): Promise<UserProfile[]> {
  return request<UserProfile[]>(`/api/users/top?limit=${limit}`);
}

export async function deleteUserAccount(uid: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
}

export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  const res = await request<{ available: boolean }>(`/api/users/nickname-check?nickname=${encodeURIComponent(nickname)}`);
  return res.available;
}

export async function uploadProfileImage(uid: string, imageUri: string): Promise<string> {
  const formData = new FormData();
  const ext = imageUri.split('.').pop()?.split('?')[0] || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  formData.append('uid', uid);
  formData.append('file', {
    uri: imageUri,
    name: `profile.${ext}`,
    type: mimeType,
  } as any);
  const res = await fetch(`${BASE_URL}/api/upload/profile-image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('이미지 업로드 실패');
  const json = await res.json();
  return json.url;
}

// SMS 인증
export async function sendSmsCode(phone: string): Promise<{ success: boolean; message: string }> {
  return request('/api/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifySmsCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
  return request('/api/sms/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

// 소셜 로그인
export async function exchangeKakaoToken(accessToken: string): Promise<{
  success: boolean;
  firebaseToken: string;
  kakaoId: string;
  email: string;
  nickname: string;
  message?: string;
}> {
  return request('/api/auth/kakao', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
}

// 푸시 알림
export async function updatePushToken(uid: string, pushToken: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/push-token`, {
    method: 'PUT',
    body: JSON.stringify({ pushToken }),
  });
}
