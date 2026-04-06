import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CommunityRecipe {
  id: string;
  title: string;
  author: string;
  authorUid?: string;
  description: string;
  category: string;
  time: number;
  difficulty: string;
  image: string;
  ingredients: { name: string; amount: string }[];
  steps: { description: string; time: number }[];
  createdAt: string;
  ratings: { userId: string; score: number }[];
  questions: {
    id: string;
    userId: string;
    text: string;
    createdAt: string;
    answer?: string;
    answerAt?: string;
  }[];
  likes: number;
}

const STORAGE_KEY = '@community_recipes';

export async function getCommunityRecipes(): Promise<CommunityRecipe[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveCommunityRecipe(recipe: CommunityRecipe): Promise<void> {
  const list = await getCommunityRecipes();
  list.unshift(recipe);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export async function updateCommunityRecipe(recipe: CommunityRecipe): Promise<void> {
  const list = await getCommunityRecipes();
  const idx = list.findIndex(r => r.id === recipe.id);
  if (idx !== -1) {
    list[idx] = recipe;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
}

export async function deleteCommunityRecipe(id: string): Promise<void> {
  const list = await getCommunityRecipes();
  const filtered = list.filter(r => r.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
