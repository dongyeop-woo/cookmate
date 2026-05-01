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
  Vibration,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { markRecipeCooked, trackCookingStep } from '../../services/api';

// 알림 핸들러는 services/notifications.ts에서 전역 설정 — 여기서 덮어쓰지 않음.
// 타이머 종료 ping은 data.type='cookingTimerPing'으로 마킹되어 글로벌 핸들러가 배너만 숨김.
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchRecipeById, likeRecipeUser } from '../../services/api';
import type { Recipe } from '../../constants/recipes';
import { useAuth } from '../_layout';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { CookingLiveActivity } from 'cooking-live-activity';
import FlatTimer from '../../components/FlatTimer';
import { useKeepAwake } from 'expo-keep-awake';

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : Platform.OS === 'ios'
  ? 'ca-app-pub-8542314434357214/8277316583'
  : 'ca-app-pub-8542314434357214/8476627131';

const interstitial = InterstitialAd.createForAdRequest(adUnitId);
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const { width, height } = Dimensions.get('window');
const shortSide = Math.min(width, height);
// 태블릿 여부 — 짧은 변 600dp 이상이면 태블릿으로 간주
const isTablet = shortSide >= 600;
// 작은 폰 (SE 등) — 세로 700pt 미만. 콘텐츠가 화면 초과해 nav 버튼이 잘리는 문제 방지.
const isSmallPhone = !isTablet && height < 700;

const IMAGE_HEIGHT = isTablet ? 320 : isSmallPhone ? 130 : 180;
const IMAGE_MIN_HEIGHT = isTablet ? 220 : isSmallPhone ? 90 : 110;
const DESC_FONT_SIZE = isTablet ? 28 : isSmallPhone ? 17 : 20;
const DESC_LINE_HEIGHT = isTablet ? 46 : isSmallPhone ? 26 : 34;
const TIMER_SECTION_MIN = isTablet ? 320 : isSmallPhone ? 150 : 220;

const SINO_KOREAN = ['일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십',
  '십일', '십이', '십삼', '십사', '십오', '십육', '십칠', '십팔', '십구', '이십'];
const toSinoKorean = (n: number) => SINO_KOREAN[n - 1] ?? String(n);

// 고유어 수사 (한, 두, 세, ...). 단위 앞에서는 '한/두/세/네/스무' 형태를 사용.
const NATIVE_KOREAN = ['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
  '열한', '열두', '열세', '열네', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스무'];
const toNativeKorean = (n: number) => NATIVE_KOREAN[n - 1] ?? String(n);

// 한자어 수사 변환 (0~9999 범위). "100" → "백", "250" → "이백오십"
const SINO_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SINO_POSITIONS = ['', '십', '백', '천'];
const numToSino = (n: number): string => {
  if (n === 0) return '영';
  if (n < 20) return SINO_KOREAN[n - 1] ?? String(n);
  if (n >= 10000) return String(n);
  let result = '';
  const s = String(n);
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = parseInt(s[i], 10);
    const pos = len - 1 - i;
    if (d === 0) continue;
    // "일십/일백/일천" 은 빼고 "십/백/천" 으로
    result += (d === 1 && pos > 0 ? '' : SINO_DIGITS[d]) + SINO_POSITIONS[pos];
  }
  return result || String(n);
};
// 설명 텍스트에서 분량/개수 부분(예: "1작은술", "1/2큰술", "2장")을 시각적으로 강조.
const MEASUREMENT_HIGHLIGHT = /(\d+(?:\.\d+|\s*\/\s*\d+)?\s*(?:큰술|작은술|스푼|티스푼|테이블스푼|컵|밀리리터|ml|mL|리터|L|그램|g|킬로그램|kg|장|개|마리|명|사람|권|번|잔|병|판|조각|송이|포기|알|그릇|접시|토막|쪽|모|대|줄기|덩어리|봉지|팩|숟갈|주먹))/g;

// 분량 내부에서 줄바꿈 방지: 각 문자 사이에 word joiner (U+2060) 삽입
const noBreak = (s: string) => s.split('').join('\u2060');

// 재료 나열 뒤 쉼표 + 문장 끝 마침표에서 줄바꿈 삽입
const insertSmartBreaks = (text: string): string => {
  const commaPattern = new RegExp(`(${MEASUREMENT_HIGHLIGHT.source}),\\s*`, 'g');
  let out = text.replace(commaPattern, '$1,\n');
  // 한글로 끝나는 문장 뒤 마침표 + 공백 → 줄바꿈 (소수점 "1.5" 제외)
  out = out.replace(/([가-힣])\.\s+/g, '$1.\n');
  return out;
};

const renderDescription = (rawText: string, highlightStyle: any): React.ReactNode[] => {
  const text = insertSmartBreaks(rawText);
  const parts: React.ReactNode[] = [];
  const regex = new RegExp(MEASUREMENT_HIGHLIGHT.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<Text key={`h-${m.index}`} style={highlightStyle}>{noBreak(m[0])}</Text>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const preprocessForTTS = (text: string): string => {
  // 괄호 안 내용 제거 (반각 () 및 전각 （）모두). 중첩은 지원 안 함.
  let out = text.replace(/[(（][^()（）]*[)）]/g, '');
  // 괄호 제거로 남은 중복 공백 정리
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?。、])/g, '$1').trim();
  // TTS 오독 교정: "갓 구운" → "가스 구운" 으로 읽히는 문제 수정
  out = out.replace(/갓\s+구운/g, '방금 구운');
  out = out.replace(/갓\s+뽑은/g, '방금 뽑은');
  out = out.replace(/갓\s+지은/g, '방금 지은');
  // "밖으로" → "바끄로" 처럼 받침 연음 오독 교정
  out = out.replace(/밖으로/g, '바끄로');
  out = out.replace(/밖에/g, '바께');
  out = out.replace(/안쪽으로/g, '안쪼그로');
  out = out.replace(/바깥쪽으로/g, '바깥쪼그로');
  // 요리 동사 뒤에 쉼표 삽입해 TTS 가 자연스럽게 끊어 읽도록
  const pauseVerbs = [
    '두르고', '넣고', '볶고', '끓이고', '올리고', '뿌리고', '담고', '섞고', '풀고', '접고', '썰고', '굽고', '조리고', '익히고',
    '저어', '넣어', '버무려', '만들어', '풀어', '담가', '데쳐', '구워', '익혀', '볶아', '부어', '삶아', '비벼', '썰어', '말아', '재워', '뭉쳐', '깔아',
    '한 뒤', '한 후', '한 다음', '되면', '나면', '지면',
  ];
  const pausePattern = new RegExp(`(${pauseVerbs.join('|')})\\s+`, 'g');
  out = out.replace(pausePattern, '$1, ');
  // 혼합수: 정수 + 공백 + 분수 (예: "1 1/2")
  out = out.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, (_, whole, num, den) =>
    `${numToSino(Number(whole))}과 ${numToSino(Number(den))}분의 ${numToSino(Number(num))}`
  );
  // 단순 분수: "1/2"
  out = out.replace(/(\d+)\s*\/\s*(\d+)/g, (_, num, den) =>
    `${numToSino(Number(den))}분의 ${numToSino(Number(num))}`
  );
  // 소수점: "2.5" → "이점오", "0.25" → "영점이오". TTS가 "2.5"를 "이오"로 읽는 문제 수정.
  const decimalToSino = (intPart: string, fracPart: string): string => {
    const intNum = Number(intPart);
    const intKor = intNum === 0 ? '영' : numToSino(intNum);
    const fracKor = fracPart.split('').map((d) => {
      const n = Number(d);
      return n === 0 ? '영' : (SINO_KOREAN[n - 1] ?? d);
    }).join('');
    return `${intKor}점${fracKor}`;
  };
  out = out.replace(/(\d+)\.(\d+)/g, (_, i, f) => decimalToSino(i, f));
  // 숫자+한자어 단위: 영문 단위 (ml, L, g, kg) 도 한글로 변환해 TTS 가 정확히 읽도록.
  // 예: "100ml" → "백밀리리터", "2kg" → "이킬로그램"
  const unitNormalize: Record<string, string> = {
    ml: '밀리리터', mL: '밀리리터', L: '리터', g: '그램', kg: '킬로그램',
  };
  const sinoUnits = ['밀리리터', 'ml', 'mL', '리터', 'L', '그램', 'g', '킬로그램', 'kg', '단계'];
  const unitPattern = new RegExp(`(\\d+)\\s*(${sinoUnits.join('|')})`, 'g');
  out = out.replace(unitPattern, (_, n, unit) => `${numToSino(Number(n))}${unitNormalize[unit] ?? unit}`);
  // 숫자+고유어 단위: "1컵" → "한 컵", "2큰술" → "두 큰술", "3개" → "세 개"
  // 요리 관련 계량 단위(큰술·작은술·컵·잔 등) 는 고유어 수사가 자연스러움.
  const nativeUnits = ['큰술', '작은술', '스푼', '티스푼', '테이블스푼', '컵', '잔', '공기', '장', '개', '마리', '명', '사람', '권', '번', '병', '판', '조각', '송이', '포기', '알', '그릇', '접시', '토막', '쪽', '모', '대', '줄기', '덩어리', '봉지', '팩', '숟갈', '주먹', '덩이', '뿌리', '통', '줌'];
  // 범위 표현 먼저 처리: "1~2개" → "한두 개", "2~3장" → "두세 장"
  const nativeRangePattern = new RegExp(`(\\d+)\\s*[~\\-]\\s*(\\d+)\\s*(${nativeUnits.join('|')})`, 'g');
  out = out.replace(nativeRangePattern, (_, a, b, unit) =>
    `${toNativeKorean(Number(a))}${toNativeKorean(Number(b))} ${unit}`
  );
  const nativePattern = new RegExp(`(\\d+)\\s*(${nativeUnits.join('|')})`, 'g');
  out = out.replace(nativePattern, (_, n, unit) => `${toNativeKorean(Number(n))} ${unit}`);
  return out;
};

export default function CookingModeScreen() {
  useKeepAwake(); // 요리 중 화면 꺼짐 방지
  const insets = useSafeAreaInsets();
  const { id, mode } = useLocalSearchParams();
  const router = useRouter();
  const { firebaseUser, isPremium } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    const loadListener = interstitial.addAdEventListener(AdEventType.LOADED, () => setAdLoaded(true));
    const closeListener = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false);
      try { interstitial.load(); } catch {}
      router.back();
    });
    const errorListener = interstitial.addAdEventListener(AdEventType.ERROR, (err) => {
      console.warn('Interstitial ad error:', err);
      setAdLoaded(false);
      try { interstitial.load(); } catch {}
      if (completeModalRef.current) router.back();
    });
    interstitial.load();
    return () => { loadListener(); closeListener(); errorListener(); };
  }, []);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerTotal, setTimerTotal] = useState(0);
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
  const isMountedRef = useRef(true);
  const lastCommandTimeRef = useRef(0);
  const bestKoreanVoiceRef = useRef<string | undefined>(undefined);
  // 명시적 abort 시 재시작 방지 — true일 때만 end/error 이벤트에서 자동 재시작
  const shouldRestartListeningRef = useRef(false);
  // 중복 start 방지
  const isListeningRef = useRef(false);
  // 재시작 타이머 — 기존 예약이 있으면 취소
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 타이머 상태를 result 이벤트 핸들러(클로저)에서 읽기 위한 ref
  const isRunningRef = useRef(false);
  const hasTimerRef = useRef(false);
  // speakStep 내부 setTimeout 체인을 단계 전환 시 취소하기 위한 ref들
  const speakSequenceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speakGenerationRef = useRef(0);

  const steps = recipe?.steps || [];
  const step = steps[currentStep];

  // Keep refs in sync
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);

  // 단계 진입 이벤트 — 관리자 대시보드에서 이탈률 계산에 사용.
  useEffect(() => {
    if (id && steps.length > 0) {
      trackCookingStep(
        String(id),
        recipe?.name || '',
        currentStep,
        'enter'
      );
    }
  }, [id, currentStep, steps.length]);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { hasTimerRef.current = !!(step && step.time > 0); }, [step]);

  // ── iOS Live Activity (다이나믹 아일랜드 + 잠금화면 타이머) ──
  // 단계가 바뀌거나 타이머가 끝나면 종료, 재생 토글이면 pause/resume.
  // timeLeft를 ref로 갖고 있어야 매초 effect가 재실행되지 않음.
  const timeLeftRef = useRef(0);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  const liveActivityRef = useRef<{ active: boolean; step: number }>({ active: false, step: -1 });

  // isRunning / currentStep 변화에만 반응 — start/resume/pause 트리거.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !recipe || !step) return;
    if (step.time <= 0) return;

    const onSameStep = liveActivityRef.current.step === currentStep;
    const remaining = timeLeftRef.current;
    if (remaining <= 0) return;

    if (isRunning) {
      if (liveActivityRef.current.active && onSameStep) {
        CookingLiveActivity.resume(remaining);
      } else {
        if (liveActivityRef.current.active) {
          CookingLiveActivity.end();
        }
        // 진단 alert는 dev 빌드에서만 — release 사용자에게 매번 뜨면 안 됨.
        CookingLiveActivity.start(recipe.title, currentStep + 1, steps.length, remaining)
          .then(async (activityId) => {
            if (activityId) {
              liveActivityRef.current = { active: true, step: currentStep };
              if (__DEV__) {
                Alert.alert('LA 진단', `시작 성공\nID: ${String(activityId).slice(0, 16)}...\nremaining: ${remaining}s`);
              }
            } else if (__DEV__) {
              const d = await CookingLiveActivity.diagnose().catch(() => null);
              const lines = d
                ? [
                    `iOS: ${d.iosVersion}`,
                    `areActivitiesEnabled: ${d.areActivitiesEnabled}`,
                    `isLowPowerMode: ${d.isLowPowerMode}`,
                    d.frequentPushesEnabled !== undefined ? `frequentPushes: ${d.frequentPushesEnabled}` : null,
                  ].filter(Boolean).join('\n')
                : '(diagnose 호출 실패)';
              Alert.alert('LA 진단', `null 반환\n\n${lines}\n\nremaining: ${remaining}s`);
            }
          })
          .catch((err) => {
            if (__DEV__) {
              Alert.alert(
                'LA 진단',
                `request() throw\n${err?.code ? `code: ${err.code}\n` : ''}msg: ${err?.message || String(err)}`
              );
            }
          });
      }
    } else if (liveActivityRef.current.active && onSameStep) {
      CookingLiveActivity.pause(remaining);
    }
  }, [isRunning, currentStep, recipe, steps.length, step]);

  // 타이머 0 도달 시 활동 종료 (TTS 알림과 별개로 위젯만 정리)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (timeLeft === 0 && liveActivityRef.current.active) {
      CookingLiveActivity.end();
      liveActivityRef.current = { active: false, step: -1 };
    }
  }, [timeLeft]);

  // 단계가 바뀌어 타이머 없는 단계로 가면 활동 종료
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (step && step.time <= 0 && liveActivityRef.current.active) {
      CookingLiveActivity.end();
      liveActivityRef.current = { active: false, step: -1 };
    }
  }, [step, currentStep]);

  // Live Activity 권한 미부여 시 1회 안내 (쿠킹 모드 진입 후 첫 타이머 step 도달 시)
  // AsyncStorage로 영구 dismissed 플래그 저장 — 한 번 안내 후 다신 안 띄움.
  const liveActivityWarnedRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!step || step.time <= 0) return;
    if (liveActivityWarnedRef.current) return;
    liveActivityWarnedRef.current = true;

    (async () => {
      try {
        const dismissedKey = 'liveActivityWarnDismissed';
        const dismissed = await AsyncStorage.getItem(dismissedKey);
        if (dismissed === '1') return;
        const supported = await CookingLiveActivity.isSupported();
        if (supported) return;
        Alert.alert(
          '잠금화면 타이머 사용 불가',
          '잠금화면과 다이나믹 아일랜드에 타이머를 표시하려면 Live Activities를 켜주세요.\n\n설정 → 요잘알 → Live Activities 활성화',
          [
            {
              text: '나중에',
              style: 'cancel',
              onPress: () => { AsyncStorage.setItem(dismissedKey, '1').catch(() => {}); },
            },
            {
              text: '설정 열기',
              onPress: () => {
                AsyncStorage.setItem(dismissedKey, '1').catch(() => {});
                Linking.openSettings();
              },
            },
          ]
        );
      } catch {}
    })();
  }, [step]);

  // 화면 언마운트 시 활동 강제 종료 (요리 완료/뒤로가기/앱 종료 안전망)
  useEffect(() => {
    return () => {
      if (Platform.OS === 'ios') {
        CookingLiveActivity.endAll();
      }
    };
  }, []);

  // 기기에서 최적 한국어 음성 자동 선택
  useEffect(() => {
    (async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const korean = voices.filter(v => v.language?.startsWith('ko'));
        if (korean.length === 0) return;

        if (Platform.OS === 'ios') {
          // 우선순위: premium → enhanced → compact 순
          const priority = ['premium', 'enhanced', 'compact'];
          const picked = priority.reduce<typeof korean[0] | undefined>((found, tier) => {
            return found ?? korean.find(v => v.identifier?.includes(tier));
          }, undefined) ?? korean[0];
          bestKoreanVoiceRef.current = picked.identifier;
        } else {
          // Android: 'network' 포함 음성 우선 (온라인 고품질), 없으면 첫 번째
          const picked = korean.find(v => v.identifier?.includes('network')) ?? korean[0];
          bestKoreanVoiceRef.current = picked.identifier;
        }
      } catch (_) {}
    })();
  }, []);

  const scheduleRestart = useCallback((delayMs: number) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (
        shouldRestartListeningRef.current &&
        isMountedRef.current &&
        isVoiceModeRef.current &&
        !isSpeakingRef.current &&
        !completeModalRef.current &&
        !isListeningRef.current
      ) {
        startListening();
      }
    }, delayMs);
  }, []);

  // Voice recognition event handlers
  useSpeechRecognitionEvent('start', () => {
    isListeningRef.current = true;
    setIsListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    isListeningRef.current = false;
    setIsListening(false);
    // shouldRestartListeningRef가 false면 명시적 abort → 재시작 안 함
    if (shouldRestartListeningRef.current && isVoiceModeRef.current && !isSpeakingRef.current && !completeModalRef.current) {
      scheduleRestart(400);
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    // TTS 재생 중엔 음성 명령 무시
    if (isSpeakingRef.current) return;

    const transcript = (event.results[0]?.transcript || '').trim();
    if (!transcript) return;
    setLastCommand(transcript);

    // final result가 아닌 interim은 쿨다운으로만 처리
    const now = Date.now();
    if (now - lastCommandTimeRef.current < 1500) return;

    const nextWords = ['다음', '다음요', '다음으로', '넘어가', '넘겨', '넥스트', 'next'];
    const prevWords = ['이전', '이전으로', '뒤로', '돌아가', '이전요', '백', 'back'];
    const endWords = ['끝', '종료', '그만', '끝내', '완료'];
    const timerStartWords = ['타이머 시작', '시작', '스타트', '재개'];
    const timerStopWords = ['타이머 정지', '타이머 멈춰', '정지', '멈춰', '일시정지', '스톱'];
    const replayWords = ['다시 듣기', '다시 읽어', '다시 말해', '한번 더', '한 번 더', '반복', '다시'];

    const lower = transcript.toLowerCase();
    const isNext = nextWords.some(w => lower.includes(w));
    const isPrev = prevWords.some(w => lower.includes(w));
    const isEnd = endWords.some(w => lower.includes(w));
    const isTimerStart = timerStartWords.some(w => lower.includes(w));
    const isTimerStop = timerStopWords.some(w => lower.includes(w));
    const isReplay = replayWords.some(w => lower.includes(w));

    if (isEnd) {
      lastCommandTimeRef.current = now;
      stopListening();
      Speech.stop();
      completeModalRef.current = true;
      setCompleteModalVisible(true);
      if (id && firebaseUser?.uid) markRecipeCooked(firebaseUser.uid, id as string);
    } else if (isNext) {
      const s = stepsRef.current;
      const cur = currentStepRef.current;
      if (cur < s.length - 1) {
        lastCommandTimeRef.current = now;
        stopListening();
        Speech.stop();
        setCurrentStep(cur + 1);
        setIsRunning(false);
      }
    } else if (isPrev) {
      const cur = currentStepRef.current;
      if (cur > 0) {
        lastCommandTimeRef.current = now;
        stopListening();
        Speech.stop();
        setCurrentStep(cur - 1);
        setIsRunning(false);
      }
    } else if (isTimerStop && hasTimerRef.current && isRunningRef.current) {
      lastCommandTimeRef.current = now;
      setIsRunning(false);
    } else if (isTimerStart && hasTimerRef.current && !isRunningRef.current) {
      lastCommandTimeRef.current = now;
      setIsRunning(true);
    } else if (isReplay) {
      lastCommandTimeRef.current = now;
      const s = stepsRef.current;
      const cur = currentStepRef.current;
      if (s[cur]) {
        stopListening();
        Speech.stop();
        speakStep(`${toSinoKorean(cur + 1)}단계. ${s[cur].description}`, false, 0);
      }
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    isListeningRef.current = false;
    setIsListening(false);
    if (!shouldRestartListeningRef.current || !isVoiceModeRef.current || isSpeakingRef.current || completeModalRef.current) return;
    // 권한 관련 에러는 재시작 안 함
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') return;
    // no-speech는 바로 재시작, 나머지는 1.2초 후
    const delay = event.error === 'no-speech' ? 200 : 1200;
    scheduleRestart(delay);
  });

  const startListening = useCallback(async () => {
    // 이미 듣는 중이면 중복 start 방지
    if (isListeningRef.current) return;
    try {
      // 이미 권한 있으면 다시 묻지 않음 — getPermissionsAsync는 다이얼로그 안 띄움.
      // 한 번 동의 후엔 OS가 앱 삭제될 때까지 기억하므로 매 호출마다 request 하지 않음.
      let granted = false;
      const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (status.granted) {
        granted = true;
      } else if (status.canAskAgain) {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        granted = result.granted;
      }
      if (!granted) {
        Alert.alert('권한 필요', '음성 인식을 위해 마이크 권한이 필요합니다.\n설정 → 요잘알 → 마이크에서 허용해주세요.');
        shouldRestartListeningRef.current = false;
        return;
      }
      shouldRestartListeningRef.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: 'ko-KR',
        interimResults: true,
        continuous: false, // false가 Android/iOS 둘 다 안정적
        contextualStrings: ['다음', '이전', '다음으로', '이전으로', '넘어가', '뒤로', '끝', '완료', '타이머 시작', '타이머 정지', '시작', '정지', '멈춰'],
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
        },
        iosTaskHint: 'unspecified',
        // TTS가 수화기로 빠지지 않고 메인 스피커로 출력되도록 강제
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'default',
        },
      });
    } catch (_) {
      // Already recognizing or other transient error — 잠시 후 재시도
      if (shouldRestartListeningRef.current) scheduleRestart(800);
    }
  }, [scheduleRestart]);

  const stopListening = useCallback(() => {
    shouldRestartListeningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch (_) {}
    isListeningRef.current = false;
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
      isMountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      speakSequenceTimersRef.current.forEach(clearTimeout);
      speakSequenceTimersRef.current = [];
      speakGenerationRef.current += 1;
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

  // TTS 한 문장 읽기. onFinished 있으면 완료 후 호출, 없으면 자동으로 듣기 재개
  const speakText = useCallback((text: string, onFinished?: () => void) => {
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    Speech.speak(preprocessForTTS(text), {
      language: 'ko-KR',
      voice: bestKoreanVoiceRef.current,
      rate: 0.9,
      onStart: () => { isSpeakingRef.current = true; setIsSpeaking(true); },
      onDone: () => {
        if (onFinished) {
          onFinished();
        } else {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (isVoiceModeRef.current && !completeModalRef.current) {
            shouldRestartListeningRef.current = true; // ← 핵심: 재시작 허용
            scheduleRestart(Platform.OS === 'ios' ? 1000 : 400);
          }
        }
      },
      onStopped: () => { isSpeakingRef.current = false; setIsSpeaking(false); },
    });
  }, [scheduleRestart]);

  const speakStep = useCallback((description: string, hasTimer: boolean, timerMins: number) => {
    stopListening();
    Speech.stop();
    // 이전 speakStep 시퀀스의 모든 대기중 setTimeout 취소 + 세대 증가
    speakSequenceTimersRef.current.forEach(clearTimeout);
    speakSequenceTimersRef.current = [];
    speakGenerationRef.current += 1;
    const myGen = speakGenerationRef.current;
    const isStale = () => myGen !== speakGenerationRef.current;
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        speakSequenceTimersRef.current = speakSequenceTimersRef.current.filter(x => x !== t);
        if (isStale()) return;
        fn();
      }, ms);
      speakSequenceTimersRef.current.push(t);
    };

    isSpeakingRef.current = true;
    setIsSpeaking(true);

    schedule(() => {
      if (hasTimer) {
        // 단계 설명 → 타이머 안내 → 타이머 자동 시작 → 듣기 재개
        speakText(description, () => {
          if (isStale()) return;
          schedule(() => {
            const totalSec = Math.round(timerMins * 60);
            const mm = Math.floor(totalSec / 60);
            const ss = totalSec % 60;
            const parts: string[] = [];
            if (mm > 0) parts.push(`${toSinoKorean(mm)}분`);
            if (ss > 0) parts.push(`${toSinoKorean(ss)}초`);
            const timeStr = parts.length ? parts.join(' ') : '0초';
            speakText(`${timeStr} 타이머를 시작합니다.`, () => {
              if (isStale()) return;
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              setIsRunning(true); // 타이머 자동 시작
              if (isVoiceModeRef.current && !completeModalRef.current) {
                shouldRestartListeningRef.current = true;
                scheduleRestart(Platform.OS === 'ios' ? 1000 : 400);
              }
            });
          }, 300);
        });
      } else {
        // 타이머 없는 단계 → 설명 후 바로 듣기 재개
        speakText(description);
      }
    }, 200);
  }, [speakText, stopListening, scheduleRestart]);

  // Speak step when step changes (or recipe first loads)
  useEffect(() => {
    if (isVoiceMode && step?.description) {
      speakStep(
        `${toSinoKorean(currentStep + 1)}단계. ${step.description}`,
        step.time > 0,
        step.time,
      );
    }
    return () => { Speech.stop(); isSpeakingRef.current = false; setIsSpeaking(false); };
  }, [currentStep, isVoiceMode, step?.description]);

  useEffect(() => {
    if (step) {
      const total = step.time * 60;
      setTimeLeft(total);
      setTimerTotal(total);
      setIsRunning(false);
    }
  }, [currentStep, step?.time]);

  const hasTimer = step && step.time > 0;

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            // 타이머 종료 TTS 알림 (트리거 단어 제외, 청취 일시 중단)
            const stepNum = currentStepRef.current + 1;

            // OS 기본 알림음 + 진동. type 마킹으로 글로벌 핸들러가 배너 숨김.
            Notifications.scheduleNotificationAsync({
              content: { sound: true, title: '', body: '', data: { type: 'cookingTimerPing' } },
              trigger: null,
            });
            Vibration.vibrate(Platform.OS === 'ios'
              ? [0, 400, 200, 400]
              : [0, 500, 200, 500, 200, 500]
            );

            isSpeakingRef.current = true;
            setIsSpeaking(true);
            Speech.speak(`${toSinoKorean(stepNum)}단계 타이머 시간이 됐습니다.`, {
              language: 'ko-KR',
              voice: bestKoreanVoiceRef.current,
              rate: 0.9,
              onDone: () => {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                if (isVoiceModeRef.current && !completeModalRef.current) {
                  shouldRestartListeningRef.current = true; // ← 재시작 허용
                  scheduleRestart(Platform.OS === 'ios' ? 1000 : 400);
                }
              },
              onStopped: () => {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
              },
            });
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
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipe.title}</Text>
        <View style={styles.modeBadge} />
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

      {/* Voice Pill (음성 모드 상태) */}
      {isVoiceMode && (
        <>
          <View style={styles.voicePillRow}>
            <View style={styles.voicePill}>
              <View style={[styles.voiceDot, isSpeaking && styles.voiceDotActive, isListening && styles.voiceDotListening]} />
              <Text style={styles.voicePillText}>
                {isSpeaking ? '읽는 중' : isListening ? '듣는 중' : '음성 모드'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replayButton}
              onPress={() => step && speakStep(`${toSinoKorean(currentStep + 1)}단계. ${step.description}`, false, 0)}
            >
              <Text style={styles.replayText}>다시 듣기</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.voiceHintRowTop}>
            <Text style={styles.voiceHintText}>
              {hasTimer
                ? '"다음" · "이전" · "끝" · "다시 듣기" · "타이머 시작" · "정지"'
                : '"다음" · "이전" · "끝" · "다시 듣기"'}
            </Text>
          </View>
        </>
      )}

      {/* Step Photo (단계별 사진이 있을 때만 표시) */}
      {(step as any)?.imageUrl && !(step as any).imageUrl.startsWith('file://') ? (
        <View style={[styles.stepImageWrap, !hasTimer && styles.stepImageWrapExpanded]}>
          <Image
            source={{ uri: (step as any).imageUrl }}
            style={styles.stepImage}
            contentFit="cover"
            cachePolicy="disk"
          />
          <View style={styles.aiImageBadge}>
            <Text style={styles.aiImageBadgeText}>AI로 생성된 참고 이미지</Text>
          </View>
        </View>
      ) : null}

      {/* Step Info */}
      {hasTimer && (
        <View style={styles.stepSectionCompact}>
          <Text style={styles.stepDescription} lineBreakStrategyIOS="hangul-word">{renderDescription(step.description, styles.stepDescriptionHighlight)}</Text>
        </View>
      )}

      {/* Timer or No-Timer */}
      <View style={[styles.timerSection, !hasTimer && styles.timerSectionNoTimer]}>
        {hasTimer ? (
          <>
            <FlatTimer
              timeLeft={timeLeft}
              totalSeconds={timerTotal || 1}
              isRunning={isRunning}
              compact={isSmallPhone}
            />
            <View style={styles.timerControlRow}>
              <TouchableOpacity
                style={styles.timerSideBtn}
                onPress={() => {
                  setTimeLeft(timerTotal);
                  setIsRunning(false);
                }}
              >
                <Ionicons name="refresh" size={24} color="#6B7280" />
                <Text style={styles.timerSideBtnText}>처음부터</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timerPrimaryBtn}
                onPress={() => {
                  if (timeLeft === 0) setTimeLeft(timerTotal);
                  setIsRunning(!isRunning);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name={isRunning ? 'pause' : 'play'} size={36} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timerSideBtn}
                onPress={() => {
                  setIsRunning(false);
                  setEditMinutes(String(Math.floor(timeLeft / 60)));
                  setEditSeconds(String(timeLeft % 60));
                  setEditModalVisible(true);
                  try {
                    Speech.stop();
                    Speech.speak('타이머를 수정합니다', { language: 'ko-KR', voice: bestKoreanVoiceRef.current, rate: 0.95 });
                  } catch {}
                }}
              >
                <Ionicons name="pencil" size={22} color="#6B7280" />
                <Text style={styles.timerSideBtnText}>수정</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noTimerContainer}>
              <Text style={styles.stepDescription} lineBreakStrategyIOS="hangul-word">{renderDescription(step.description, styles.stepDescriptionHighlight)}</Text>
          </View>
        )}
      </View>

      {/* Navigation — bottom padding은 safeAreaInsets 기반 (SE같은 홈버튼 기기는 0) */}
      <View style={[styles.navRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
          onPress={() => {
            if (currentStep > 0) {
              stopListening();
              Speech.stop();
              setCurrentStep(currentStep - 1);
              setIsRunning(false);
            }
          }}
          disabled={currentStep === 0}
        >
          <Text style={[styles.navButtonText, currentStep === 0 && styles.navButtonTextDisabled]}><Ionicons name="chevron-back" size={16} /> 이전</Text>
        </TouchableOpacity>

        {currentStep < steps.length - 1 ? (
          <TouchableOpacity
            style={styles.navButtonNext}
            onPress={() => {
              stopListening();
              Speech.stop();
              setCurrentStep(currentStep + 1);
              setIsRunning(false);
            }}
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
              if (id && firebaseUser?.uid) markRecipeCooked(firebaseUser.uid, id as string);
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
                  const totalSec = Math.max(0, m * 60 + s);
                  setTimeLeft(totalSec);
                  setTimerTotal(totalSec); // 원형 프로그레스 재시작 기준
                  setIsRunning(true); // 자동 시작
                  setEditModalVisible(false);
                  // TTS: "N분 M초 타이머를 시작합니다"
                  try {
                    const parts: string[] = [];
                    if (m > 0) parts.push(`${toSinoKorean(m)}분`);
                    if (s > 0) parts.push(`${toSinoKorean(s)}초`);
                    const timeStr = parts.length ? parts.join(' ') : '0초';
                    Speech.stop();
                    Speech.speak(`${timeStr} 타이머를 시작합니다`, { language: 'ko-KR', voice: bestKoreanVoiceRef.current, rate: 0.95 });
                  } catch {}
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
              <Text style={styles.completeLikeIcon}>{liked ? <Ionicons name="heart" size={28} color="#FF6B6B" /> : <Ionicons name="heart-outline" size={28} color="#999" />}</Text>
              <Text style={[styles.completeLikeText, liked && styles.completeLikeTextActive]}>
                {liked ? '좋아요를 눌렀어요!' : '좋아요'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeCloseBtn}
              onPress={() => {
                setCompleteModalVisible(false);
                // 오디오 세션 충돌 방지: 음성 인식/TTS 확실히 정지
                shouldRestartListeningRef.current = false;
                try { stopListening(); } catch {}
                try { Speech.stop(); } catch {}
                isSpeakingRef.current = false;
                // 모달 dismiss 애니메이션 완료 + iOS 오디오 세션 해제 시간 확보 (iOS는 600ms+ 필요)
                const SHOW_DELAY = Platform.OS === 'ios' ? 700 : 300;
                if (isPremium) {
                  router.back();
                } else if (adLoaded) {
                  setTimeout(() => {
                    try {
                      interstitial.show();
                    } catch (e) {
                      console.warn('Ad show failed:', e);
                      router.back();
                    }
                  }, SHOW_DELAY);
                } else {
                  // 광고 로딩 중 — 최대 3초 대기 후 표시, 시간 초과 시 그냥 뒤로가기
                  let resolved = false;
                  const finish = (showAd: boolean) => {
                    if (resolved) return;
                    resolved = true;
                    cleanup();
                    clearTimeout(timeoutId);
                    if (showAd) {
                      setTimeout(() => {
                        try { interstitial.show(); } catch { router.back(); }
                      }, SHOW_DELAY);
                    } else {
                      router.back();
                    }
                  };
                  const cleanup = interstitial.addAdEventListener(AdEventType.LOADED, () => finish(true));
                  const timeoutId = setTimeout(() => finish(false), 3000);
                }
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
    padding: 4,
  },
  closeIcon: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    zIndex: -1,
  },
  modeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
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
    backgroundColor: '#1BAE74',
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
  stepImageWrap: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    height: IMAGE_HEIGHT,
    flexShrink: 1,
    minHeight: IMAGE_MIN_HEIGHT,
  },
  stepImageWrapExpanded: {
    height: isTablet ? 420 : 280,
  },
  stepImage: {
    width: '100%',
    height: '100%',
  },
  aiImageBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  aiImageBadgeText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  stepSectionCompact: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 4,
  },
  stepLabel: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: DESC_FONT_SIZE,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: DESC_LINE_HEIGHT,
  },
  stepDescriptionHighlight: {
    color: '#1BAE74',
    fontWeight: '900',
  },
  timerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: TIMER_SECTION_MIN,
  },
  timerSectionNoTimer: {
    justifyContent: 'flex-start',
    paddingTop: 20,
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
    backgroundColor: '#1BAE74',
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
    color: '#1A1A1A',
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
    paddingTop: 8,
    // paddingBottom은 인라인에서 insets로 동적 적용 (홈인디케이터 유무 따라 다름)
  },
  voiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  voicePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  voicePillText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '600',
    marginLeft: 6,
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
    backgroundColor: '#1BAE74',
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
    color: '#1A1A1A',
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
    backgroundColor: '#1BAE74',
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
  timerControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginTop: 28,
  },
  timerSideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    paddingVertical: 8,
  },
  timerSideBtnText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 4,
  },
  timerPrimaryBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1BAE74',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1BAE74',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  timerEditButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    backgroundColor: '#1BAE74',
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
    color: '#1A1A1A',
    fontWeight: '500',
  },
  voiceHintRow: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  voiceHintRowTop: {
    alignItems: 'center',
    paddingBottom: 4,
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
    color: '#1A1A1A',
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
    backgroundColor: '#1BAE74',
  },
  completeCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
