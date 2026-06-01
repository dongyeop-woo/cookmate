package com.devl.api.service;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final Firestore firestore;
    private static final String COLLECTION = "search_logs";

    // 인기 검색어 필터용 음식 어휘 캐시. 레시피 제목/재료/카테고리를 모아놓는다.
    private volatile Set<String> foodVocabCache = null;
    private volatile long foodVocabCacheAt = 0;
    // 6시간 TTL — 레시피 목록은 자주 바뀌지 않으므로 긴 캐시로 Firestore read 비용 절감.
    // 신규 레시피 승인 직후 노출까지 최대 6시간 지연될 수 있으나 인기 검색어 필터 용도라 허용.
    private static final long FOOD_VOCAB_TTL_MS = 6L * 60 * 60 * 1000;

    public void log(String keyword, String type) {
        if (keyword == null || keyword.isBlank()) return;
        String k = keyword.trim();
        if (k.length() > 50) k = k.substring(0, 50);
        Map<String, Object> doc = new HashMap<>();
        doc.put("keyword", k);
        doc.put("type", type == null ? "all" : type);
        doc.put("ts", Instant.now().toEpochMilli());
        firestore.collection(COLLECTION).add(doc);
    }

    /** 최근 24시간 인기 검색어 TOP 10 (전일 대비 등락 포함) */
    public List<Map<String, Object>> trending() throws ExecutionException, InterruptedException {
        long now = Instant.now().toEpochMilli();
        long day = 24L * 60 * 60 * 1000;
        Map<String, Integer> last24 = countSince(now - day, now);
        Map<String, Integer> prev24 = countSince(now - 2 * day, now - day);

        List<Map.Entry<String, Integer>> sorted = new ArrayList<>(last24.entrySet());
        sorted.sort((a, b) -> Integer.compare(b.getValue(), a.getValue()));

        // 음식 관련 키워드만 인기 검색어에 노출 — "테스트", "헤어" 같은 비음식 검색어 필터링
        Set<String> vocab = loadFoodVocab();

        // 데이터 부족 시 시드 키워드로 보강
        List<String> seed = List.of("김치찌개", "비빔밥", "파스타", "샐러드", "닭가슴살",
                "다이어트", "에그타르트", "떡볶이", "김밥", "라면");
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> used = new LinkedHashSet<>();
        for (int i = 0; i < sorted.size() && result.size() < 10; i++) {
            String kw = sorted.get(i).getKey();
            if (!isFoodKeyword(kw, vocab)) continue;
            used.add(kw);
            result.add(buildEntry(kw, result.size() + 1, prev24, last24));
        }
        for (String kw : seed) {
            if (result.size() >= 10) break;
            if (used.contains(kw)) continue;
            result.add(buildEntry(kw, result.size() + 1, prev24, last24));
        }
        return result;
    }

    /**
     * 레시피 제목/재료/카테고리/태그를 긁어 음식 어휘 사전을 만든다. 5분 캐시.
     * 인기 검색어 필터에 사용 — 이 사전에 걸리지 않으면 비음식 검색어로 간주.
     */
    @SuppressWarnings("unchecked")
    private Set<String> loadFoodVocab() {
        long nowMs = System.currentTimeMillis();
        Set<String> cached = foodVocabCache;
        if (cached != null && nowMs - foodVocabCacheAt < FOOD_VOCAB_TTL_MS) {
            return cached;
        }
        Set<String> vocab = new HashSet<>();
        for (String coll : List.of("recipes", "community")) {
            try {
                QuerySnapshot snap = firestore.collection(coll).get().get();
                for (DocumentSnapshot d : snap.getDocuments()) {
                    addIfPresent(vocab, d.getString("title"));
                    addIfPresent(vocab, d.getString("category"));
                    Object tags = d.get("tags");
                    if (tags instanceof List) {
                        for (Object t : (List<Object>) tags) {
                            if (t instanceof String) addIfPresent(vocab, (String) t);
                        }
                    }
                    Object ingredients = d.get("ingredients");
                    if (ingredients instanceof List) {
                        for (Object ing : (List<Object>) ingredients) {
                            if (ing instanceof Map) {
                                Object name = ((Map<String, Object>) ing).get("name");
                                if (name instanceof String) addIfPresent(vocab, (String) name);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("음식 어휘 로드 실패 collection={}: {}", coll, e.getMessage());
            }
        }
        foodVocabCache = vocab;
        foodVocabCacheAt = nowMs;
        return vocab;
    }

    private void addIfPresent(Set<String> vocab, String s) {
        if (s == null) return;
        String trimmed = s.trim().toLowerCase();
        if (trimmed.length() >= 2) vocab.add(trimmed);
    }

    private boolean isFoodKeyword(String keyword, Set<String> vocab) {
        if (keyword == null) return false;
        String kw = keyword.trim().toLowerCase();
        // 1글자 키워드는 과매칭 많고 의미도 약해 제외 ("요", "국" 등)
        if (kw.length() < 2) return false;
        // 정확 매칭 또는 어휘 항목과 부분 겹침 (예: "김치" ↔ "김치찌개")
        for (String v : vocab) {
            if (v.equals(kw) || v.contains(kw) || kw.contains(v)) return true;
        }
        return false;
    }

    private Map<String, Object> buildEntry(String keyword, int rank, Map<String, Integer> prev, Map<String, Integer> curr) {
        Map<String, Object> m = new HashMap<>();
        m.put("keyword", keyword);
        m.put("rank", rank);
        boolean isNew = !prev.containsKey(keyword) || prev.get(keyword) == 0;
        m.put("isNew", isNew);
        int diff = curr.getOrDefault(keyword, 0) - prev.getOrDefault(keyword, 0);
        String change = diff > 0 ? "up" : diff < 0 ? "down" : "same";
        m.put("change", change);
        m.put("category", guessCategory(keyword));
        return m;
    }

    /** 운영자 큐레이션 추천 검색어 (Firestore: recommended_keywords/{id}.keyword) */
    public List<String> recommended() throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> fut = firestore.collection("recommended_keywords")
                .orderBy("order", Query.Direction.ASCENDING).limit(20).get();
        List<String> out = new ArrayList<>();
        for (DocumentSnapshot d : fut.get().getDocuments()) {
            String kw = d.getString("keyword");
            if (kw != null && !kw.isBlank()) out.add(kw);
        }
        if (out.isEmpty()) {
            return List.of("다이어트 도시락", "에어프라이어 요리", "자취생 요리", "10분 요리",
                    "건강 샐러드", "원팬 요리", "캠핑 요리", "비건 레시피", "야식", "홈베이킹");
        }
        return out;
    }

    /** 키워드별 카테고리 추정 (인기 검색어 뱃지용) */
    public Map<String, String> keywordCategories(List<String> keywords) {
        Map<String, String> out = new HashMap<>();
        for (String kw : keywords) {
            out.put(kw, guessCategory(kw));
        }
        return out;
    }

    private String guessCategory(String kw) {
        String s = kw.toLowerCase();
        if (s.matches(".*(빵|케이크|쿠키|타르트|디저트|마카롱|초콜릿).*")) return "디저트";
        if (s.matches(".*(커피|음료|차|주스|스무디|에이드).*")) return "음료";
        if (s.matches(".*(샐러드|다이어트|건강).*")) return "건강식";
        if (s.matches(".*(치킨|족발|보쌈|야식|곱창).*")) return "야식";
        if (s.matches(".*(라면|떡볶이|김밥|핫도그|순대|어묵|튀김|분식).*")) return "분식";
        if (s.matches(".*(간식).*")) return "간식";
        if (s.matches(".*(파스타|스테이크|리조또|피자|양식).*")) return "양식";
        if (s.matches(".*(찌개|비빔밥|국|볶음|반찬|김치|한식).*")) return "한식";
        return "레시피";
    }

    private Map<String, Integer> countSince(long from, long to) throws ExecutionException, InterruptedException {
        Query q = firestore.collection(COLLECTION)
                .whereGreaterThanOrEqualTo("ts", from)
                .whereLessThan("ts", to);
        ApiFuture<QuerySnapshot> fut = q.get();
        Map<String, Integer> counts = new HashMap<>();
        for (DocumentSnapshot d : fut.get().getDocuments()) {
            String kw = d.getString("keyword");
            if (kw == null) continue;
            counts.merge(kw, 1, Integer::sum);
        }
        return counts;
    }
}
