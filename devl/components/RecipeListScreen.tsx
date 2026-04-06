import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, TextInput, SafeAreaView } from 'react-native';

interface Recipe {
  id: string;
  title: string;
  time: number;
  image: string;
}

const dummyRecipes: Recipe[] = [
  { id: '1', title: '김치찌개', time: 30, image: 'https://via.placeholder.com/150' },
  { id: '2', title: '된장찌개', time: 25, image: 'https://via.placeholder.com/150' },
  { id: '3', title: '불고기', time: 20, image: 'https://via.placeholder.com/150' },
  { id: '4', title: '비빔밥', time: 15, image: 'https://via.placeholder.com/150' },
  { id: '5', title: '삼겹살', time: 10, image: 'https://via.placeholder.com/150' },
  { id: '6', title: '된장국', time: 15, image: 'https://via.placeholder.com/150' },
];

const RecipeListScreen: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setRecipes(dummyRecipes);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredRecipes = recipes.filter(recipe => recipe.title.includes(search));

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.time}>⏱ {item.time}분</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.largeTitle}>오늘 뭐 먹지?</Text>
      <TextInput
        style={styles.searchBar}
        placeholder="레시피 검색"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredRecipes}
        renderItem={renderRecipe}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  largeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111111',
    padding: 16,
  },
  searchBar: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  list: {
    padding: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 16,
    alignItems: 'center',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
    textAlign: 'center',
  },
  time: {
    fontSize: 14,
    color: '#6E6E73',
    marginTop: 4,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#111111',
  },
});

export default RecipeListScreen;