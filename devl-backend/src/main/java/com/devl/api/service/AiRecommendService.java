package com.devl.api.service;

import com.devl.api.dto.AiRecommendDto;
import com.devl.api.dto.FridgeItemDto;
import com.devl.api.dto.RecipeDto;
import com.devl.api.dto.UserDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

/**
 * Google Gemini Flash 기반 레시피 추천.
 *
 * 환경변수: GEMINI_API_KEY (Cloud Run env에 설정 필요)
 *
 * 사용자별 레이트 리밋:
 *   - 무료 사용자: 일 5회 (Firestore daily counter)
 *   - 프리미엄: 일 20회
 *
 * 비용 최적화:
 *   - 후보 풀: 상위 30개만 Gemini에 전달 (메타도 슬림 — id/제목/카테고리/시간만)
 *   - 음식 외 입력 사전 필터 (Gemini 호출 전 차단, 쿼터 차감 X)
 *   - 동일 (uid, 쿼리) 1시간 결과 캐시 (재호출 시 무료, 쿼터 차감 X)
 *
 * 추천 컨텍스트(개인화):
 *   - 시간대 (KST 기준 아침/점심/간식/저녁/야식)
 *   - 사용자 히스토리 (좋아요한 레시피의 카테고리 빈도)
 *   - 인기도 가중 (likes + 선호 카테고리 + 냉장고 매치)
 *   - 냉장고 보유 재료 (만료 안 된 것만)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiRecommendService {

    private static final int FREE_DAILY_LIMIT = 5;
    private static final int PREMIUM_DAILY_LIMIT = 20;
    private static final int CANDIDATE_LIMIT = 30;       // 토큰 절감 — 60→30
    private static final long CACHE_TTL_SECONDS = 3600;  // 1시간
    private static final String CACHE_COLLECTION = "ai_cache";
    // 2026-04 기준: gemini-1.5/2.0-flash는 신규 사용자 차단됨. 2.5-flash가 현재 표준.
    private static final String GEMINI_MODEL = "gemini-2.5-flash";
    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";

    private final Firestore firestore;
    private final UserService userService;
    private final RecipeService recipeService;
    private final FridgeService fridgeService;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${GEMINI_API_KEY:}")
    private String geminiApiKey;

    /** 부팅 시 Gemini 키 누락 경고 — 프로덕션에서 환경변수 미설정 사고 방지. */
    @jakarta.annotation.PostConstruct
    public void validateConfig() {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            log.error("⚠️ GEMINI_API_KEY 미설정 — AI 추천 기능 비활성화. Cloud Run 환경변수 확인 필요.");
        } else {
            log.info("Gemini API 키 로드됨 (length={})", geminiApiKey.length());
        }
    }

    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String msg) { super(msg); }
    }

    /** 음식·요리와 무관한 입력 — Gemini 호출 차단 + 쿼터 차감 X. */
    public static class OffTopicException extends RuntimeException {
        public OffTopicException(String msg) { super(msg); }
    }

    /** 쿼터 조회 — 카운터 증가 X. 화면 진입 시 헤더 표시용. */
    public AiRecommendDto.QuotaResponse getQuota(String uid) throws Exception {
        UserDto user = userService.getByUid(uid);
        boolean isPremium = user != null && Boolean.TRUE.equals(user.getIsPremium());
        int dailyLimit = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
        Integer remaining = remainingQuotaCurrent(uid, dailyLimit);
        return AiRecommendDto.QuotaResponse.builder()
                .remainingFreeQuota(remaining)
                .isPremium(isPremium)
                .dailyLimit(dailyLimit)
                .build();
    }

    public AiRecommendDto.Response recommend(String uid, String query) throws Exception {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY 가 설정되지 않았습니다.");
        }
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("query 가 비어있습니다.");
        }

        String normalizedQuery = normalizeQuery(query);

        // 1) 음식 외 입력 사전 필터 — 호출 전 차단, 쿼터 차감 안 함
        if (!isLikelyFoodQuery(normalizedQuery)) {
            throw new OffTopicException("요리·재료·분위기로 물어봐 주세요. 예) \"비 오는 날 매콤한 국물\"");
        }

        UserDto user = userService.getByUid(uid);
        boolean isPremium = user != null && Boolean.TRUE.equals(user.getIsPremium());

        int dailyLimit = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;

        // 2) 캐시 조회 — 1시간 내 동일 쿼리면 Gemini 호출 X, 쿼터 차감 X
        AiRecommendDto.Response cached = readCache(uid, normalizedQuery);
        if (cached != null) {
            // 캐시 히트는 쿼터 차감 안 하지만 잔여 표시는 현재 카운터 기준으로 채워줌
            cached.setRemainingFreeQuota(remainingQuotaCurrent(uid, dailyLimit));
            log.info("AI 추천 캐시 히트 uid={} query={}", uid, normalizedQuery);
            return cached;
        }

        // 3) 레이트 리밋 — 캐시 미스 시점에만 카운터 증가 (프리미엄도 적용, 한도만 다름)
        int used = checkAndIncrementDailyCount(uid);
        if (used > dailyLimit) {
            String msg = isPremium
                    ? "오늘의 추천 한도(" + PREMIUM_DAILY_LIMIT + "회)를 모두 사용했어요. 내일 다시 만나요."
                    : "오늘의 무료 추천 한도(" + FREE_DAILY_LIMIT + "회)를 모두 사용했어요. 프리미엄 가입 시 일 " + PREMIUM_DAILY_LIMIT + "회 이용 가능합니다.";
            throw new QuotaExceededException(msg);
        }
        Integer remainingFreeQuota = Math.max(0, dailyLimit - used);

        // 4) 컨텍스트 수집 (시간대 + 사용자 히스토리 + 냉장고 재료)
        List<RecipeDto> recipes = recipeService.getAllRecipes();
        TimeContext timeCtx = currentTimeContext();
        List<String> preferredCategories = computePreferredCategories(user, recipes);
        List<String> fridgeIngredients = safeGetFridgeIngredients(uid);

        // 5) 후보 랭킹 (likes + 선호 카테고리 + 냉장고 매치) → 상위 N개
        List<RecipeDto> rankedCandidates = rankCandidates(recipes, preferredCategories, fridgeIngredients);
        List<RecipeDto> topCandidates = rankedCandidates.size() > CANDIDATE_LIMIT
                ? rankedCandidates.subList(0, CANDIDATE_LIMIT)
                : rankedCandidates;

        log.info("AI 추천 컨텍스트 uid={} 시간대={} 선호카테고리={} 냉장고재료수={} 후보수={}",
                uid, timeCtx.label, preferredCategories, fridgeIngredients.size(), topCandidates.size());

        // 6) Gemini 호출 — 실패 시 쿼터 차감 롤백 후 예외 전파
        List<AiRecommendDto.RecommendItem> items;
        try {
            items = callGemini(query, topCandidates, recipes, timeCtx, preferredCategories, fridgeIngredients);
        } catch (Exception e) {
            rollbackDailyCount(uid);
            log.warn("Gemini 호출 실패로 쿼터 롤백 uid={}: {}", uid, e.getMessage());
            throw e;
        }

        // Gemini가 빈 응답 반환한 경우도 사용자 가치 0이므로 롤백
        if (items == null || items.isEmpty()) {
            rollbackDailyCount(uid);
        }

        AiRecommendDto.Response response = AiRecommendDto.Response.builder()
                .recommendations(items)
                .remainingFreeQuota(remainingFreeQuota)
                .build();

        // 7) 결과 캐시 저장 (best-effort) — 빈 결과는 캐시 안 함
        if (items != null && !items.isEmpty()) {
            writeCache(uid, normalizedQuery, response);
        }

        return response;
    }

    // ────────────── 음식 외 입력 필터 ──────────────

    /** 분명한 비식품 패턴(인사·잡담)은 차단, 식품 키워드 있으면 통과, 애매하면 길이로 판단(보수적 허용). */
    private boolean isLikelyFoodQuery(String s) {
        if (s == null || s.length() < 2) return false;

        // 명백한 비식품 — 인사/잡담/오프토픽
        String[] nonFoodPrefixes = {
                "안녕", "하이", "헬로", "hi", "hello", "반가", "굿모닝", "잘있", "잘가",
                "누구", "너는", "넌 ", "이름", "뭐해", "뭐하", "사랑해", "결혼", "나이",
                "날씨", "뉴스", "정치", "주식", "코인", "운세", "로또", "비트코인",
        };
        for (String p : nonFoodPrefixes) {
            if (s.startsWith(p)) return false;
            if (s.equals(p)) return false;
        }

        // 식품/요리 관련 키워드 — 하나라도 있으면 통과
        String[] foodKeywords = {
                "먹", "음식", "메뉴", "요리", "만들", "끓", "굽", "볶", "튀", "삶", "찌",
                "추천", "맛", "맵", "매콤", "달", "짠", "시원", "따뜻", "든든", "가볍", "담백",
                "다이어트", "야식", "안주", "해장", "간식", "디저트", "반찬",
                "아침", "점심", "저녁", "브런치",
                "김치", "고기", "생선", "채소", "야채", "재료", "냉장고",
                "밥", "면", "국", "찌개", "탕", "죽", "전골", "볶음", "조림", "무침", "구이",
                "라면", "치킨", "피자", "파스타", "샐러드", "스테이크", "스튜", "카레", "덮밥",
                "한식", "양식", "중식", "일식",
                "비 와", "비오", "추울", "더울", "쌀쌀", // 날씨 컨텍스트 (음식 함께 따라옴)
                "아이", "어른", "혼자", "둘이", "가족",
        };
        for (String k : foodKeywords) {
            if (s.contains(k)) return true;
        }

        // 키워드 매치 안 되면 길이로 판단 — 너무 짧으면 reject (잡담일 가능성)
        if (s.length() < 6) return false;

        // 충분히 길면 일단 허용 (AI 해석에 맡김)
        return true;
    }

    // ────────────── 캐시 (1시간 TTL) ──────────────

    private String normalizeQuery(String q) {
        return q.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    private String cacheDocId(String uid, String normalizedQuery) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest((uid + "|" + normalizedQuery).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 16; i++) sb.append(String.format("%02x", hash[i]));
            return sb.toString();
        } catch (Exception e) {
            // 해시 실패 시 안전한 fallback (캐시 비활성화에 가까움)
            return uid.replaceAll("[^a-zA-Z0-9]", "_") + "_" + Math.abs(normalizedQuery.hashCode());
        }
    }

    private AiRecommendDto.Response readCache(String uid, String normalizedQuery) {
        try {
            DocumentReference ref = firestore.collection(CACHE_COLLECTION).document(cacheDocId(uid, normalizedQuery));
            DocumentSnapshot snap = ref.get().get();
            if (!snap.exists()) return null;

            String expiresAtStr = snap.getString("expiresAt");
            if (expiresAtStr == null) return null;
            Instant expiresAt = Instant.parse(expiresAtStr);
            if (Instant.now().isAfter(expiresAt)) return null; // 만료

            String resultJson = snap.getString("result");
            if (resultJson == null || resultJson.isBlank()) return null;
            return mapper.readValue(resultJson, AiRecommendDto.Response.class);
        } catch (Exception e) {
            log.warn("AI 캐시 조회 실패 uid={}: {}", uid, e.getMessage());
            return null;
        }
    }

    private void writeCache(String uid, String normalizedQuery, AiRecommendDto.Response response) {
        try {
            // remainingFreeQuota는 호출 시점마다 달라지므로 캐시에는 null로 저장 (꺼낼 때 다시 채움)
            AiRecommendDto.Response toStore = AiRecommendDto.Response.builder()
                    .recommendations(response.getRecommendations())
                    .remainingFreeQuota(null)
                    .build();
            String json = mapper.writeValueAsString(toStore);
            Map<String, Object> data = new HashMap<>();
            data.put("uid", uid);
            data.put("query", normalizedQuery);
            data.put("result", json);
            data.put("cachedAt", Instant.now().toString());
            data.put("expiresAt", Instant.now().plusSeconds(CACHE_TTL_SECONDS).toString());
            firestore.collection(CACHE_COLLECTION).document(cacheDocId(uid, normalizedQuery)).set(data).get();
        } catch (Exception e) {
            log.warn("AI 캐시 저장 실패 uid={}: {}", uid, e.getMessage());
        }
    }

    /** 잔여 쿼터 조회 — 카운터 증가 X. dailyLimit는 호출자가 사용자 등급에 맞게 전달. */
    private int remainingQuotaCurrent(String uid, int dailyLimit) {
        try {
            String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
            DocumentSnapshot snap = firestore.collection("ai_usage").document(uid)
                    .collection("daily").document(today).get().get();
            int current = snap.exists() && snap.contains("count")
                    ? snap.getLong("count").intValue() : 0;
            return Math.max(0, dailyLimit - current);
        } catch (Exception e) {
            return dailyLimit;
        }
    }

    /** Firestore에 일일 카운터를 증가시키고 현재 카운트 반환. 트랜잭션 사용해 동시성 안전. */
    private int checkAndIncrementDailyCount(String uid) throws ExecutionException, InterruptedException {
        String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
        DocumentReference ref = firestore.collection("ai_usage").document(uid)
                .collection("daily").document(today);

        return firestore.runTransaction(tx -> {
            DocumentSnapshot snap = tx.get(ref).get();
            int current = snap.exists() && snap.contains("count")
                    ? snap.getLong("count").intValue() : 0;
            int next = current + 1;
            Map<String, Object> data = new HashMap<>();
            data.put("count", next);
            data.put("updatedAt", Instant.now().toString());
            tx.set(ref, data);
            return next;
        }).get();
    }

    /**
     * Gemini 실패 시 쿼터 차감 롤백 — 사용자에게 결과를 못 줬는데 무료 한도만 깎이는 상황 방지.
     * best-effort: 롤백 자체 실패해도 호출자에 영향 X.
     */
    private void rollbackDailyCount(String uid) {
        try {
            String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
            DocumentReference ref = firestore.collection("ai_usage").document(uid)
                    .collection("daily").document(today);
            firestore.runTransaction(tx -> {
                DocumentSnapshot snap = tx.get(ref).get();
                if (!snap.exists() || !snap.contains("count")) return null;
                int current = snap.getLong("count").intValue();
                int next = Math.max(0, current - 1);
                Map<String, Object> data = new HashMap<>();
                data.put("count", next);
                data.put("updatedAt", Instant.now().toString());
                tx.set(ref, data);
                return null;
            }).get();
        } catch (Exception e) {
            log.warn("AI 쿼터 롤백 실패 uid={}: {}", uid, e.getMessage());
        }
    }

    // ────────────── 컨텍스트 수집 ──────────────

    private record TimeContext(String label, String description) {}

    /** KST 기준 시간대 분류. */
    private TimeContext currentTimeContext() {
        int hour = LocalTime.now(ZoneId.of("Asia/Seoul")).getHour();
        if (hour >= 5 && hour < 11) return new TimeContext("아침", "가볍고 부담 없는 메뉴");
        if (hour >= 11 && hour < 15) return new TimeContext("점심", "든든한 한 끼");
        if (hour >= 15 && hour < 17) return new TimeContext("간식", "달거나 가벼운 메뉴");
        if (hour >= 17 && hour < 22) return new TimeContext("저녁", "메인 요리");
        return new TimeContext("야식", "간단·국물·안주류");
    }

    /** 좋아요한 레시피들의 카테고리 빈도 → 상위 3개. */
    private List<String> computePreferredCategories(UserDto user, List<RecipeDto> recipes) {
        if (user == null || user.getLikedRecipes() == null || user.getLikedRecipes().isEmpty()) {
            return List.of();
        }
        Map<String, RecipeDto> byId = new HashMap<>();
        for (RecipeDto r : recipes) if (r.getId() != null) byId.put(r.getId(), r);

        Map<String, Integer> freq = new HashMap<>();
        for (String rid : user.getLikedRecipes()) {
            RecipeDto r = byId.get(rid);
            if (r != null && r.getCategory() != null && !r.getCategory().isBlank()) {
                freq.merge(r.getCategory(), 1, Integer::sum);
            }
        }
        return freq.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(3)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    /** 냉장고 보유 재료 이름 (만료 안 된 것만, 최대 30개). 실패해도 빈 리스트로 graceful. */
    private List<String> safeGetFridgeIngredients(String uid) {
        try {
            List<FridgeItemDto> items = fridgeService.list(uid);
            Instant now = Instant.now();
            LinkedHashSet<String> names = new LinkedHashSet<>();
            for (FridgeItemDto it : items) {
                if (isExpired(it.getExpiresAt(), now)) continue;
                String n = it.getName();
                if (n != null && !n.isBlank()) names.add(n.trim());
                if (names.size() >= 30) break;
            }
            return new ArrayList<>(names);
        } catch (Exception e) {
            log.warn("냉장고 재료 조회 실패 uid={}: {}", uid, e.getMessage());
            return List.of();
        }
    }

    private boolean isExpired(String expiresAt, Instant now) {
        if (expiresAt == null || expiresAt.isBlank()) return false; // 유통기한 없으면 유효 간주
        try {
            return Instant.parse(expiresAt).isBefore(now);
        } catch (Exception e) {
            return false;
        }
    }

    // ────────────── 후보 랭킹 ──────────────

    private List<RecipeDto> rankCandidates(List<RecipeDto> recipes, List<String> prefCats, List<String> fridge) {
        Set<String> prefSet = new HashSet<>(prefCats);
        Set<String> fridgeNorm = fridge.stream()
                .map(this::normalize)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());

        return recipes.stream()
                .sorted(Comparator
                        .comparingInt((RecipeDto r) -> compositeScore(r, prefSet, fridgeNorm))
                        .reversed())
                .collect(Collectors.toList());
    }

    /** likes + 선호 카테고리(+80) + 냉장고 매치(매치당 +15, 최대 6매치). */
    private int compositeScore(RecipeDto r, Set<String> prefSet, Set<String> fridgeNorm) {
        int score = Math.max(0, r.getLikes());

        if (r.getCategory() != null && prefSet.contains(r.getCategory())) {
            score += 80;
        }

        if (!fridgeNorm.isEmpty() && r.getIngredients() != null) {
            int matches = 0;
            for (RecipeDto.IngredientDto ing : r.getIngredients()) {
                if (ing == null || ing.getName() == null) continue;
                String n = normalize(ing.getName());
                if (n.isEmpty()) continue;
                for (String f : fridgeNorm) {
                    if (n.contains(f) || f.contains(n)) { matches++; break; }
                }
                if (matches >= 6) break;
            }
            score += matches * 15;
        }
        return score;
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.replaceAll("\\s+", "").toLowerCase().trim();
    }

    // ────────────── Gemini 호출 ──────────────

    private List<AiRecommendDto.RecommendItem> callGemini(
            String query,
            List<RecipeDto> topCandidates,
            List<RecipeDto> allRecipes,
            TimeContext timeCtx,
            List<String> preferredCategories,
            List<String> fridgeIngredients
    ) throws Exception {

        // 후보 — 슬림 포맷 (id|제목|카테고리|시간만, 설명·좋아요·난이도 제거)
        StringBuilder candidates = new StringBuilder();
        for (RecipeDto r : topCandidates) {
            candidates.append("[").append(r.getId()).append("] ")
                    .append(r.getTitle()).append("|")
                    .append(r.getCategory() != null ? r.getCategory() : "")
                    .append("|").append((int) r.getTime()).append("분\n");
        }

        // 환각 방지용 — 전체 레시피 ID로 매칭
        Map<String, RecipeDto> recipeMap = new HashMap<>();
        for (RecipeDto r : allRecipes) if (r.getId() != null) recipeMap.put(r.getId(), r);

        // 컨텍스트 (한 줄씩 압축)
        String history = preferredCategories.isEmpty() ? "없음" : String.join(",", preferredCategories);
        String fridge = fridgeIngredients.isEmpty() ? "없음" : String.join(",", fridgeIngredients);

        // 프롬프트 — 슬림하지만 충분히 명확. responseSchema가 출력 구조를 강제하므로 텍스트 가이드는 짧게.
        String prompt = "당신은 한국 요리 레시피 추천 어시스턴트입니다. 아래 후보에서 사용자 요청에 가장 잘 맞는 레시피 3개를 골라 id와 한 줄 reason을 반환하세요.\n\n" +
                "[컨텍스트]\n" +
                "- 시간대: " + timeCtx.label + " (" + timeCtx.description + ")\n" +
                "- 선호 카테고리: " + history + "\n" +
                "- 냉장고 재료: " + fridge + "\n\n" +
                "[사용자 요청]\n\"" + query + "\"\n\n" +
                "[가이드]\n" +
                "- 요청을 1순위로, 시간대도 고려.\n" +
                "- 보유 재료 활용 가능하면 reason에 자연스럽게 언급.\n" +
                "- reason은 한국어 한 줄, 30~50자.\n\n" +
                "[후보 (id|제목|카테고리|시간)]\n" + candidates;

        // Gemini 요청 body
        ObjectNode body = mapper.createObjectNode();
        ArrayNode contents = body.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");
        parts.addObject().put("text", prompt);
        ObjectNode genConfig = body.putObject("generationConfig");
        genConfig.put("temperature", 0.7);
        genConfig.put("maxOutputTokens", 1024);
        genConfig.put("responseMimeType", "application/json");
        // gemini-2.5-flash thinking 비활성화 — JSON 잘림 방지
        genConfig.putObject("thinkingConfig").put("thinkingBudget", 0);
        // responseSchema — 출력 구조 강제. Gemini가 JSON 외 텍스트를 섞거나 환각하는 것 방지.
        ObjectNode schema = genConfig.putObject("responseSchema");
        schema.put("type", "OBJECT");
        ObjectNode schemaProps = schema.putObject("properties");
        ObjectNode recsProp = schemaProps.putObject("recommendations");
        recsProp.put("type", "ARRAY");
        ObjectNode itemSchema = recsProp.putObject("items");
        itemSchema.put("type", "OBJECT");
        ObjectNode itemProps = itemSchema.putObject("properties");
        itemProps.putObject("id").put("type", "STRING");
        itemProps.putObject("reason").put("type", "STRING");
        ArrayNode required = itemSchema.putArray("required");
        required.add("id");
        required.add("reason");
        ArrayNode topRequired = schema.putArray("required");
        topRequired.add("recommendations");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_URL + "?key=" + geminiApiKey))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() >= 400) {
            log.warn("Gemini API 에러 status={} body={}", resp.statusCode(), resp.body());
            throw new RuntimeException("AI 추천 요청 실패 (status=" + resp.statusCode() + ")");
        }

        JsonNode root = mapper.readTree(resp.body());
        JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (textNode.isMissingNode()) {
            log.warn("Gemini 응답에 text 노드 없음: {}", resp.body());
            return List.of();
        }

        // Gemini가 가끔 responseSchema 무시하고 깨진 JSON을 보낼 때가 있어서 graceful 처리.
        JsonNode parsed;
        try {
            parsed = mapper.readTree(textNode.asText());
        } catch (Exception e) {
            log.warn("Gemini JSON 파싱 실패 (graceful fallback): {} | text={}", e.getMessage(), textNode.asText());
            return List.of();
        }

        JsonNode recArr = parsed.path("recommendations");
        List<AiRecommendDto.RecommendItem> items = new ArrayList<>();
        for (JsonNode rec : recArr) {
            String id = rec.path("id").asText();
            String reason = rec.path("reason").asText();
            RecipeDto r = recipeMap.get(id);
            if (r == null) continue; // 환각 ID 스킵
            items.add(AiRecommendDto.RecommendItem.builder()
                    .recipeId(id)
                    .title(r.getTitle())
                    .reason(reason)
                    .image(r.getImage())
                    .category(r.getCategory())
                    .build());
        }
        return items;
    }
}
