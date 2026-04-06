import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchRecipeById, likeRecipeUser } from '../../services/api';
import type { Recipe } from '../../constants/recipes';
import { useAuth } from '../_layout';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const { width } = Dimensions.get('window');

export default function CookingModeScreen() {
  const { id, mode } = useLocalSearchParams();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVoiceMode = mode === 'voice';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const stepsRef = useRef<Recipe['steps']>([]);
  const currentStepRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const isVoiceModeRef = useRef(isVoiceMode);
  const completeModalRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  // Voice recognition event handlers
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    // Only auto-restart if: voice mode, not speaking TTS, modal not open
    if (isVoiceModeRef.current && !isSpeakingRef.current && !completeModalRef.current) {
      setTimeout(() => {
        if (!isSpeakingRef.current && !completeModalRef.current) {
          startListening();
        }
      }, 500);
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = (event.results[0]?.transcript || '').trim();
    if (!transcript) return;
    setLastCommand(transcript);

    const nextWords = ['다음', '다음요', '다음으로', '넘어가', '넘겨', '넥스트', 'next'];
    const prevWords = ['이전', '이전으로', '뒤로', '돌아가', '이전요', '백', 'back'];
    const endWords = ['끝', '종료', '그만', '끝내', '완료'];

    const lower = transcript.toLowerCase();
    const isNext = nextWords.some(w => lower.includes(w));
    const isPrev = prevWords.some(w => lower.includes(w));
    const isEnd = endWords.some(w => lower.includes(w));

    if (isEnd) {
      stopListening();
      Speech.stop();
      completeModalRef.current = true;
      setCompleteModalVisible(true);
    } else if (isNext) {
      const s = stepsRef.current;
      const cur = currentStepRef.current;
      if (cur < s.length - 1) {
        stopListening();
        Speech.stop();
        setCurrentStep(cur + 1);
        setIsRunning(false);
      }
    } else if (isPrev) {
      const cur = currentStepRef.current;
      if (cur > 0) {
        stopListening();
        Speech.stop();
        setCurrentStep(cur - 1);
        setIsRunning(false);
      }
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    if (isVoiceModeRef.current && !isSpeakingRef.current && !completeModalRef.current
        && event.error !== 'not-allowed' && event.error !== 'service-not-allowed') {
      setTimeout(() => {
        if (!isSpeakingRef.current && !completeModalRef.current) {
          startListening();
        }
      }, 1000);
    }
  });

  const startListening = useCallback(async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert('권한 필요', '음성 인식을 위해 마이크 권한이 필요합니다.');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'ko-KR',
        interimResults: true,
        continuous: true,
        contextualStrings: ['다음', '이전', '다음으로', '이전으로', '넘어가', '뒤로'],
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
        },
        iosTaskHint: 'confirmation',
      });
    } catch (e) {
      // Already recognizing or other error – ignore
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch (e) {
      // ignore
    }
    setIsListening(false);
  }, []);

  // Start/stop listening based on voice mode
  useEffect(() => {
    if (!isVoiceMode) {
      stopListening();
      Speech.stop();
      isSpeakingRef.current = false;
    }
  }, [isVoiceMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      Speech.stop();
      isSpeakingRef.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchRecipeById(id as string);
        setRecipe(r);
      } catch (e) {
        console.warn('API 로드 실패:', e);
      }
    })();
  }, [id]);

  const steps = recipe?.steps || [];
  const step = steps[currentStep];

  // TTS: read current step aloud in voice mode
  const speakStep = useCallback((description: string) => {
    // Stop listening while speaking to avoid picking up TTS audio
    stopListening();
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    Speech.stop();
    setTimeout(() => {
      Speech.speak(description, {
        language: 'ko-KR',
        rate: 0.9,
        onStart: () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        },
        onDone: () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          // Resume listening after TTS finishes
          if (isVoiceModeRef.current && !completeModalRef.current) {
            setTimeout(() => startListening(), 300);
          }
        },
        onStopped: () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
        },
      });
    }, 200);
  }, [startListening, stopListening]);

  // Speak step when step changes (or recipe first loads)
  useEffect(() => {
    if (isVoiceMode && step?.description) {
      speakStep(`${currentStep + 1}단계. ${step.description}`);
    }
    return () => { Speech.stop(); isSpeakingRef.current = false; };
  }, [currentStep, isVoiceMode, step?.description]);

  useEffect(() => {
    if (step) {
      setTimeLeft(step.time * 60);
      setIsRunning(false);
    }
  }, [currentStep]);

  const hasTimer = step && step.time > 0;

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!recipe || !step) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>레시피를 찾을 수 없습니다.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipe.title}</Text>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{isVoiceMode ? '◉' : '☝︎'}</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i === currentStep && styles.progressDotActive,
              i < currentStep && styles.progressDotDone,
            ]}
          />
        ))}
      </View>

      {/* Step Info */}
      {hasTimer && (
        <View style={styles.stepSectionCompact}>
          <Text style={styles.stepLabel}>단계 {step.step}/{steps.length}</Text>
          <Text style={styles.stepDescription}>{step.description}</Text>
        </View>
      )}

      {/* Timer or No-Timer */}
      <View style={styles.timerSection}>
        {hasTimer ? (
          <>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            <View style={styles.timerButtonRow}>
              <TouchableOpacity
                style={[styles.timerButton, isRunning && styles.timerButtonPause]}
                onPress={() => setIsRunning(!isRunning)}
              >
                <Text style={styles.timerButtonText}>{isRunning ? '일시정지' : '시작'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timerEditButton}
                onPress={() => {
                  setIsRunning(false);
                  setEditMinutes(String(Math.floor(timeLeft / 60)));
                  setEditSeconds(String(timeLeft % 60));
                  setEditModalVisible(true);
                }}
              >
                <Text style={styles.timerEditButtonText}>✎</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noTimerContainer}>
            <Text style={styles.stepLabel}>단계 {step.step}/{steps.length}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        )}
      </View>

      {/* Voice Status */}
      {isVoiceMode && (
        <View style={styles.voiceStatus}>
          <View style={[styles.voiceDot, isSpeaking && styles.voiceDotActive, isListening && styles.voiceDotListening]} />
          <Text style={styles.voiceStatusText}>
            {isSpeaking ? '🔊 읽는 중...' : isListening ? '🎙️ 듣는 중...' : '음성 안내 모드'}
          </Text>
          <TouchableOpacity
            style={styles.replayButton}
            onPress={() => step && speakStep(`${currentStep + 1}단계. ${step.description}`)}
          >
            <Text style={styles.replayText}>다시 듣기</Text>
          </TouchableOpacity>
        </View>
      )}
      {isVoiceMode && lastCommand ? (
        <View style={styles.lastCommandRow}>
          <Text style={styles.lastCommandText}>인식: "{lastCommand}"</Text>
        </View>
      ) : null}
      {isVoiceMode && (
        <View style={styles.voiceHintRow}>
          <Text style={styles.voiceHintText}>"다음" / "이전" / "끝" 이라고 말해보세요</Text>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
          onPress={() => { if (currentStep > 0) { setCurrentStep(currentStep - 1); setIsRunning(false); } }}
          disabled={currentStep === 0}
        >
          <Text style={[styles.navButtonText, currentStep === 0 && styles.navButtonTextDisabled]}>← 이전</Text>
        </TouchableOpacity>

        {currentStep < steps.length - 1 ? (
          <TouchableOpacity
            style={styles.navButtonNext}
            onPress={() => { setCurrentStep(currentStep + 1); setIsRunning(false); }}
          >
            <Text style={styles.navButtonNextText}>다음 →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navButtonComplete}
            onPress={() => {
              stopListening();
              Speech.stop();
              isSpeakingRef.current = false;
              completeModalRef.current = true;
              setCompleteModalVisible(true);
            }}
          >
            <Text style={styles.navButtonNextText}>완성! 🎉</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Timer Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.editModalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>타이머 설정</Text>
            <View style={styles.editTimeRow}>
              <View style={styles.editTimeField}>
                <TextInput
                  style={styles.editTimeInput}
                  value={editMinutes}
                  onChangeText={setEditMinutes}
                  keyboardType="number-pad"
                  maxLength={3}
                  selectTextOnFocus
                />
                <Text style={styles.editTimeLabel}>분</Text>
              </View>
              <Text style={styles.editTimeColon}>:</Text>
              <View style={styles.editTimeField}>
                <TextInput
                  style={styles.editTimeInput}
                  value={editSeconds}
                  onChangeText={setEditSeconds}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
                <Text style={styles.editTimeLabel}>초</Text>
              </View>
            </View>
            <View style={styles.editButtonRow}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.editCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editConfirmBtn}
                onPress={() => {
                  const m = parseInt(editMinutes, 10) || 0;
                  const s = parseInt(editSeconds, 10) || 0;
                  setTimeLeft(Math.max(0, m * 60 + s));
                  setEditModalVisible(false);
                }}
              >
                <Text style={styles.editConfirmText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Completion Modal */}
      <Modal
        visible={completeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCompleteModalVisible(false);
          router.back();
        }}
      >
        <View style={styles.completeOverlay}>
          <View style={styles.completeContent}>
            <Text style={styles.completeEmoji}>🎉</Text>
            <Text style={styles.completeTitle}>요리 완성!</Text>
            <Text style={styles.completeSubtitle}>
              {recipe?.title} 만들기를 완료했어요!
            </Text>
            <Text style={styles.completeDesc}>
              맛있게 드세요! 레시피가 마음에 드셨다면{'\n'}좋아요를 눌러주세요
            </Text>

            <TouchableOpacity
              style={[styles.completeLikeBtn, liked && styles.completeLikeBtnActive]}
              onPress={async () => {
                if (!liked && firebaseUser?.uid && recipe?.id) {
                  setLiked(true);
                  try {
                    await likeRecipeUser(firebaseUser.uid, recipe.id);
                  } catch (e) {
                    // ignore
                  }
                }
              }}
            >
              <Text style={styles.completeLikeIcon}>{liked ? '♥' : '♡'}</Text>
              <Text style={[styles.completeLikeText, liked && styles.completeLikeTextActive]}>
                {liked ? '좋아요를 눌렀어요!' : '좋아요'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeCloseBtn}
              onPress={() => {
                setCompleteModalVisible(false);
                router.back();
              }}
            >
              <Text style={styles.completeCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modeBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeBadgeText: {
    fontSize: 18,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    backgroundColor: '#0B9A61',
    width: 28,
    borderRadius: 5,
  },
  progressDotDone: {
    backgroundColor: '#A8E6CF',
  },
  stepSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  stepSectionCompact: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  stepLabel: {
    fontSize: 14,
    color: '#0B9A61',
    fontWeight: '600',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 34,
  },
  timerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 64,
    fontWeight: '200',
    color: '#1A1A1A',
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
  },
  timerButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#0B9A61',
  },
  timerButtonPause: {
    backgroundColor: '#FF6B6B',
  },
  timerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noTimerContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noTimerStep: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B9A61',
    marginBottom: 12,
  },
  noTimerDesc: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 16,
  },
  noTimerHint: {
    fontSize: 14,
    color: '#BDBDBD',
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  voiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginRight: 8,
  },
  voiceDotActive: {
    backgroundColor: '#FF6B6B',
  },
  voiceDotListening: {
    backgroundColor: '#0B9A61',
  },
  voiceStatusText: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  replayButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  replayText: {
    fontSize: 12,
    color: '#0B9A61',
    fontWeight: '600',
  },
  navButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  navButtonTextDisabled: {
    color: '#9E9E9E',
  },
  navButtonNext: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0B9A61',
  },
  navButtonComplete: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFB347',
  },
  navButtonNextText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timerButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerEditButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerEditButtonText: {
    fontSize: 20,
    color: '#1A1A1A',
  },
  editModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  editModalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  editTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  editTimeField: {
    alignItems: 'center',
  },
  editTimeInput: {
    width: 80,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  editTimeLabel: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 4,
  },
  editTimeColon: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    marginHorizontal: 12,
  },
  editButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  editConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0B9A61',
    alignItems: 'center',
  },
  editConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lastCommandRow: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  lastCommandText: {
    fontSize: 12,
    color: '#0B9A61',
    fontWeight: '500',
  },
  voiceHintRow: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  voiceHintText: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  completeOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  completeContent: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  completeEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0B9A61',
    marginBottom: 8,
  },
  completeDesc: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  completeLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
    gap: 8,
  },
  completeLikeBtnActive: {
    backgroundColor: '#FFF0F0',
  },
  completeLikeIcon: {
    fontSize: 22,
    color: '#FF6B6B',
  },
  completeLikeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  completeLikeTextActive: {
    color: '#FF6B6B',
  },
  completeCloseBtn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0B9A61',
  },
  completeCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
