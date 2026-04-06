import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';

interface CustomTextInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
}

const CustomTextInput: React.FC<CustomTextInputProps> = ({ placeholder, value, onChangeText, label }) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#6E6E73"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
});

export default CustomTextInput;