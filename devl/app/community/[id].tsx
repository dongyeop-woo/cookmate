import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function CommunityDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/recipe/${id}?type=community`);
  }, [id]);

  return null;
}
