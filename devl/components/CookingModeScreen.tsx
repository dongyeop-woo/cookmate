import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRoute } from '@react-navigation/native';

const CookingModeScreen: React.FC = () => {
  const route = useRoute();
  const { id } = route.params as { id: string };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>요리 모드</Text>
      <Text>레시피 ID: {id}</Text>
      {/* Cooking timer and steps will be implemented here */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111111',
  },
});

export default CookingModeScreen;