import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchRecipes, fetchCommunityRecipes, deleteRecipe, updateRecipe, deleteCommunityRecipeApi, updateCommunityRecipeApi } from '../../services/api';
import type { Recipe } from '../../constants/recipes';

export const TAG_PRESETS = [
  '에어프라이어', '다이어트', '자취', '1인분', '여름', '겨울', '명절',
  '한식', '양식', '중식', '일식', '동남아',
  '비건', '저탄수', '고단백', '매운맛', '아이반찬', '홈파티',
];

export default function AdminRecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagEditTarget, setTagEditTarget] = useState<Recipe | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  const filteredRecipes = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(r =>
      (r.title || '').toLowerCase().includes(q) ||
      (r.author || '').toLowerCase().includes(q)
    );
  }, [recipes, searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, cr] = await Promise.all([fetchRecipes(), fetchCommunityRecipes()]);
      const merged: Recipe[] = [...r, ...cr.map(c => ({ ...c, rating: 0, __isCommunity: true } as unknown as Recipe))];
      setRecipes(merged);
    } catch {
      Alert.alert('오류', '레시피 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const openTagEdit = (recipe: Recipe) => {
    setTagEditTarget(recipe);
    setEditTags(recipe.tags ?? []);
    setCustomTag('');
  };

  const toggleTag = (tag: string) => {
    setEditTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = () => {
    const t = customTag.trim();
    if (!t) return;
    if (!editTags.includes(t)) setEditTags((prev) => [...prev, t]);
    setCustomTag('');
  };

  const saveTags = async () => {
    if (!tagEditTarget) return;
    setSavingTags(true);
    try {
      if ((tagEditTarget as any).__isCommunity) {
        await updateCommunityRecipeApi({ ...(tagEditTarget as any), tags: editTags });
      } else {
        await updateRecipe(tagEditTarget.id, { tags: editTags });
      }
      setRecipes((prev) => prev.map((r) => (r.id === tagEditTarget.id ? { ...r, tags: editTags } : r)));
      setTagEditTarget(null);
    } catch {
      Alert.alert('오류', '태그 저장에 실패했습니다.');
    } finally {
      setSavingTags(false);
    }
  };

  const handleDelete = (recipe: Recipe) => {
    Alert.alert('레시피 삭제', `"${recipe.title}" 레시피를 삭제하시겠어요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            if ((recipe as any).__isCommunity) {
              await deleteCommunityRecipeApi(recipe.id);
            } else {
              await deleteRecipe(recipe.id);
            }
            setRecipes(prev => prev.filter(r => r.id !== recipe.id));
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
          <Text style={styles.title}>레시피 관리</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={styles.count}>{filteredRecipes.length}개</Text>
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
            placeholder="작성자 또는 레시피 이름으로 검색"
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
          data={filteredRecipes}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openTagEdit(item)}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.thumb} cachePolicy="disk" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={{ fontSize: 20 }}>🍳</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.sub}>{item.author} · {item.category}</Text>
                {item.tags && item.tags.length > 0 ? (
                  <Text style={styles.tagsInline} numberOfLines={1}>#{item.tags.join(' #')}</Text>
                ) : (
                  <Text style={styles.tagsInlineEmpty}>태그 없음 · 탭해서 추가</Text>
                )}
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={18} color="#FF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal
        visible={!!tagEditTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setTagEditTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>태그 편집</Text>
            <Text style={styles.modalSub} numberOfLines={1}>{tagEditTarget?.title}</Text>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.chipWrap}>
                {Array.from(new Set([...TAG_PRESETS, ...editTags])).map((t) => {
                  const active = editTags.includes(t);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tagChip, active && styles.tagChipActive]}
                      onPress={() => toggleTag(t)}
                    >
                      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customTag}
                  onChangeText={setCustomTag}
                  placeholder="직접 태그 추가 (예: 집들이)"
                  placeholderTextColor="#BDBDBD"
                  returnKeyType="done"
                  onSubmitEditing={addCustomTag}
                  maxLength={20}
                />
                <TouchableOpacity style={styles.customAddBtn} onPress={addCustomTag}>
                  <Text style={styles.customAddText}>추가</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setTagEditTarget(null)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingTags && { opacity: 0.5 }]}
                onPress={saveTags}
                disabled={savingTags}
              >
                <Text style={styles.modalSaveText}>{savingTags ? '저장 중…' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#F5F5F5' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  sub: { fontSize: 12, color: '#999', marginTop: 2 },
  tagsInline: { fontSize: 11, color: '#0B9A61', marginTop: 4, fontWeight: '600' },
  tagsInlineEmpty: { fontSize: 11, color: '#BDBDBD', marginTop: 4 },
  deleteBtn: { padding: 8 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: '#F5F5F7',
  },
  tagChipActive: { backgroundColor: '#0B9A61' },
  tagChipText: { fontSize: 13, color: '#1A1A1A', fontWeight: '600' },
  tagChipTextActive: { color: '#FFFFFF' },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
  customInput: {
    flex: 1,
    borderWidth: 1, borderColor: '#ECECEC', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#1A1A1A',
  },
  customAddBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#1A1A1A',
  },
  customAddText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#F5F5F5', alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, color: '#1A1A1A', fontWeight: '600' },
  modalSaveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#0B9A61', alignItems: 'center',
  },
  modalSaveText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
});
