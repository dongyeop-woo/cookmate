import recipesData from '../data/recipes.json';
import categoriesData from '../data/categories.json';

export interface Recipe {
  id: string;
  title: string;
  author: string;
  time: number;
  difficulty: string;
  calories: number;
  rating: number;
  likes: number;
  bookmarks: number;
  image: string;
  category: string;
  description: string;
  ingredients: { name: string; amount: string; icon: string }[];
  steps: { step: number; description: string; time: number }[];
  comments?: { id: string; uid: string; nickname: string; text: string; createdAt: string; profileImage?: string }[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const categories: Category[] = categoriesData;
export const recipes: Recipe[] = recipesData;