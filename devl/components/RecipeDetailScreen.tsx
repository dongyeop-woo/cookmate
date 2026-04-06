import React from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { recipes } from '../constants/recipes';

const RecipeDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params as { id: string };
  const recipe = recipes.find(r => r.id === id);

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>레시피를 찾을 수 없습니다.</Text>
      </SafeAreaView>
    );
  }

  const renderStep = ({ item }: { item: any }) => (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{item.step}</Text>
      <Text style={styles.stepDescription}>{item.description}</Text>
      <Text style={styles.stepTime}>{item.time}분</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Image source={{ uri: recipe.image }} style={styles.image} />
        <View style={styles.content}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.time}>총 조리 시간: {recipe.time}분</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('CookingMode', { id: recipe.id })}>
            <Text style={styles.buttonText}>요리 시작하기</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>요리 단계 미리보기</Text>
          <FlatList
            data={recipe.steps}
            renderItem={renderStep}
            keyExtractor={item => item.step.toString()}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  image: {
    width: '100%',
    height: 300,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 8,
  },
  time: {
    fontSize: 18,
    color: '#6E6E73',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FF6B35',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 16,
  },
  step: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginRight: 16,
  },
  stepDescription: {
    flex: 1,
    fontSize: 16,
    color: '#111111',
  },
  stepTime: {
    fontSize: 14,
    color: '#6E6E73',
  },
});

export default RecipeDetailScreen;