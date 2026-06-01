package com.devl.api.service;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ExecutionException;

/**
 * 관리자 집계 통계 서비스.
 * 기존 데이터 컬렉션(users, reports, reviews, refund_requests, user_gifticons, community, fridge_items)
 * 에서 애드혹 쿼리로 핵심 지표를 집계한다. 별도 수집 파이프라인을 두지 않아 구현 비용 최소화.
 *
 * KST(UTC+9) 기준으로 일자 경계를 자른다 — createdAt/lastActiveAt 등이 모두 Instant.toString() 포맷
 * (예: "2026-04-20T00:12:34.567Z")으로 저장돼 있어 문자열 비교 가능.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final Firestore firestore;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    /** KST 기준 date("YYYY-MM-DD")의 00:00~24:00을 UTC ISO 범위로 변환. */
    private String[] kstDayRangeIso(String date) {
        LocalDate day = LocalDate.parse(date);
        ZonedDateTime start = day.atStartOfDay(KST);
        ZonedDateTime end = start.plusDays(1);
        return new String[]{
                start.withZoneSameInstant(ZoneOffset.UTC).format(ISO),
                end.withZoneSameInstant(ZoneOffset.UTC).format(ISO),
        };
    }

    /** 오늘 KST 일자("YYYY-MM-DD") */
    public String todayKst() {
        return LocalDate.now(KST).toString();
    }

    // ───────── DAU ─────────

    /**
     * 특정 KST 일자의 활성 유저 수(=lastActiveAt이 해당일 범위에 있는 users 수).
     * 유저당 lastActiveAt은 1개 필드이므로 자연스럽게 하루 1계정당 1 카운트.
     */
    public Map<String, Object> getDau(String date) throws ExecutionException, InterruptedException {
        String[] range = kstDayRangeIso(date);
        long count = firestore.collection("users")
                .whereGreaterThanOrEqualTo("lastActiveAt", range[0])
                .whereLessThan("lastActiveAt", range[1])
                .count().get().get().getCount();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", date);
        out.put("count", count);
        return out;
    }

    /** 최근 N일 DAU 시리즈. */
    public List<Map<String, Object>> getDauSeries(int days) throws ExecutionException, InterruptedException {
        List<Map<String, Object>> out = new ArrayList<>();
        LocalDate today = LocalDate.now(KST);
        for (int i = days - 1; i >= 0; i--) {
            out.add(getDau(today.minusDays(i).toString()));
        }
        return out;
    }

    // ───────── 리텐션 ─────────

    /**
     * Day 1/7/30 재방문율. 가입 N일 전 유저 중, 가입 +N일 이후 활동한 비율.
     * createdAt이 (today - cohortDay - 1)일~today-cohortDay 범위인 유저를 코호트로 잡고,
     * 그 유저들의 lastActiveAt이 createdAt + cohortDay일 이후인지 확인.
     */
    public Map<String, Object> getRetention() throws ExecutionException, InterruptedException {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("d1", retentionForCohort(1));
        out.put("d7", retentionForCohort(7));
        out.put("d30", retentionForCohort(30));
        return out;
    }

    private Map<String, Object> retentionForCohort(int cohortDays) throws ExecutionException, InterruptedException {
        // N일 전에 가입한 유저들 (당일 범위)
        LocalDate cohortDate = LocalDate.now(KST).minusDays(cohortDays);
        String[] range = kstDayRangeIso(cohortDate.toString());
        List<QueryDocumentSnapshot> cohort = firestore.collection("users")
                .whereGreaterThanOrEqualTo("createdAt", range[0])
                .whereLessThan("createdAt", range[1])
                .get().get().getDocuments();

        int total = cohort.size();
        int retained = 0;
        // 가입 +cohortDays일 이후에 다시 접속한 유저
        Instant retainThreshold = cohortDate.plusDays(cohortDays).atStartOfDay(KST).toInstant();
        for (QueryDocumentSnapshot doc : cohort) {
            String lastActive = doc.getString("lastActiveAt");
            if (lastActive == null) continue;
            try {
                Instant la = Instant.parse(lastActive);
                if (la.isAfter(retainThreshold)) retained++;
            } catch (Exception ignored) {}
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cohortDate", cohortDate.toString());
        m.put("cohortSize", total);
        m.put("retained", retained);
        m.put("rate", total > 0 ? (double) retained / total : 0.0);
        return m;
    }

    // ───────── 첫 레시피 작성 시점 ─────────

    /**
     * 가입 후 첫 community 레시피 작성까지 걸린 일수 분포.
     * buckets: 0~1일 / 2~3일 / 4~7일 / 8~30일 / 31일+
     */
    public Map<String, Object> getTimeToFirstRecipe() throws ExecutionException, InterruptedException {
        // 전체 유저 → uid별 가장 빠른 community 레시피 createdAt
        List<QueryDocumentSnapshot> users = firestore.collection("users").get().get().getDocuments();
        List<QueryDocumentSnapshot> recipes = firestore.collection("community").get().get().getDocuments();

        // uid → earliest recipe Instant
        Map<String, Instant> firstRecipe = new HashMap<>();
        for (QueryDocumentSnapshot r : recipes) {
            String authorUid = r.getString("authorUid");
            String createdAt = r.getString("createdAt");
            if (authorUid == null || createdAt == null) continue;
            try {
                Instant ts = Instant.parse(createdAt);
                firstRecipe.merge(authorUid, ts, (a, b) -> a.isBefore(b) ? a : b);
            } catch (Exception ignored) {}
        }

        int[] buckets = new int[6]; // 0-1, 2-3, 4-7, 8-30, 31+, 작성안함
        List<Long> samples = new ArrayList<>();
        for (QueryDocumentSnapshot u : users) {
            String createdAt = u.getString("createdAt");
            String uid = u.getId();
            if (createdAt == null) continue;
            try {
                Instant created = Instant.parse(createdAt);
                Instant first = firstRecipe.get(uid);
                if (first == null) { buckets[5]++; continue; }
                long days = Duration.between(created, first).toDays();
                samples.add(days);
                if (days <= 1) buckets[0]++;
                else if (days <= 3) buckets[1]++;
                else if (days <= 7) buckets[2]++;
                else if (days <= 30) buckets[3]++;
                else buckets[4]++;
            } catch (Exception ignored) {}
        }
        samples.sort(Long::compareTo);
        double median = samples.isEmpty() ? 0 : samples.get(samples.size() / 2);
        double avg = samples.isEmpty() ? 0 : samples.stream().mapToLong(Long::longValue).average().orElse(0);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalUsers", users.size());
        out.put("withFirstRecipe", samples.size());
        out.put("neverWrote", buckets[5]);
        out.put("medianDays", median);
        out.put("avgDays", avg);
        Map<String, Integer> bucketMap = new LinkedHashMap<>();
        bucketMap.put("0-1일", buckets[0]);
        bucketMap.put("2-3일", buckets[1]);
        bucketMap.put("4-7일", buckets[2]);
        bucketMap.put("8-30일", buckets[3]);
        bucketMap.put("31일+", buckets[4]);
        out.put("buckets", bucketMap);
        return out;
    }

    // ───────── 신고 사유 분포 ─────────

    public List<Map<String, Object>> getReportsByReason() throws ExecutionException, InterruptedException {
        Map<String, Integer> counts = new HashMap<>();
        for (QueryDocumentSnapshot doc : firestore.collection("reports").get().get().getDocuments()) {
            String reason = doc.getString("reason");
            if (reason == null || reason.isBlank()) reason = "(미지정)";
            counts.merge(reason, 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("reason", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                }).toList();
    }

    // ───────── 리뷰/댓글 길이 분포 ─────────

    public Map<String, Object> getReviewLengthDistribution() throws ExecutionException, InterruptedException {
        int[] bucket = new int[3]; // 짧음(~30) / 보통(31~100) / 김(101+)
        int total = 0;
        long sumLen = 0;
        for (QueryDocumentSnapshot doc : firestore.collection("reviews").get().get().getDocuments()) {
            String content = doc.getString("content");
            if (content == null) continue;
            int len = content.length();
            total++;
            sumLen += len;
            if (len <= 30) bucket[0]++;
            else if (len <= 100) bucket[1]++;
            else bucket[2]++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("avgLength", total > 0 ? (double) sumLen / total : 0);
        Map<String, Integer> b = new LinkedHashMap<>();
        b.put("짧음(~30자)", bucket[0]);
        b.put("보통(31~100자)", bucket[1]);
        b.put("김(101자+)", bucket[2]);
        out.put("buckets", b);
        return out;
    }

    // ───────── 환불 사유 집계 ─────────

    public List<Map<String, Object>> getRefundReasons() throws ExecutionException, InterruptedException {
        Map<String, Integer> counts = new HashMap<>();
        for (QueryDocumentSnapshot doc : firestore.collection("refund_requests").get().get().getDocuments()) {
            String reason = doc.getString("reason");
            if (reason == null || reason.isBlank()) reason = "(미지정)";
            counts.merge(reason, 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("reason", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                }).toList();
    }

    // ───────── 기프티콘 교환 시간 히트맵 ─────────

    /** user_gifticons createdAt 기준 요일(0=일~6=토) × 시간(0~23) 히트맵. */
    public Map<String, Object> getGifticonHeatmap() throws ExecutionException, InterruptedException {
        int[][] heatmap = new int[7][24];
        int total = 0;
        for (QueryDocumentSnapshot doc : firestore.collection("user_gifticons").get().get().getDocuments()) {
            String createdAt = doc.getString("createdAt");
            if (createdAt == null) continue;
            try {
                ZonedDateTime zdt = Instant.parse(createdAt).atZone(KST);
                int dow = zdt.getDayOfWeek().getValue() % 7; // Mon=1..Sun=7 → 1..0
                int hour = zdt.getHour();
                heatmap[dow][hour]++;
                total++;
            } catch (Exception ignored) {}
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("heatmap", heatmap);
        return out;
    }

    // ───────── 커스텀 재료 수집 ─────────

    /**
     * fridge_items 중 isCustom=true 인 항목을 이름(소문자) 기준으로 그룹핑.
     * 향후 공식 재료로 승격시킬 후보 발견용.
     */
    public List<Map<String, Object>> getCustomIngredients() throws ExecutionException, InterruptedException {
        Map<String, Map<String, Object>> grouped = new HashMap<>();
        // fridge_items는 users/{uid}/fridge_items가 아니라 루트 컬렉션. 아래 확인 필요
        for (QueryDocumentSnapshot doc : firestore.collection("fridge_items")
                .whereEqualTo("isCustom", true).get().get().getDocuments()) {
            String name = doc.getString("name");
            if (name == null || name.isBlank()) continue;
            String key = name.trim().toLowerCase();
            String addedAt = doc.getString("addedAt");
            Map<String, Object> entry = grouped.computeIfAbsent(key, k -> {
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("name", name);
                e.put("count", 0);
                e.put("firstSeenAt", addedAt);
                e.put("lastSeenAt", addedAt);
                return e;
            });
            entry.put("count", ((Integer) entry.get("count")) + 1);
            if (addedAt != null) {
                String first = (String) entry.get("firstSeenAt");
                String last = (String) entry.get("lastSeenAt");
                if (first == null || addedAt.compareTo(first) < 0) entry.put("firstSeenAt", addedAt);
                if (last == null || addedAt.compareTo(last) > 0) entry.put("lastSeenAt", addedAt);
            }
        }
        return grouped.values().stream()
                .sorted((a, b) -> Integer.compare((Integer) b.get("count"), (Integer) a.get("count")))
                .toList();
    }

    // ───────── 검색 실패 쿼리 집계 ─────────

    public List<Map<String, Object>> getFailedSearches() throws ExecutionException, InterruptedException {
        Map<String, Integer> counts = new HashMap<>();
        Map<String, String> lastSeen = new HashMap<>();
        for (QueryDocumentSnapshot doc : firestore.collection("failed_searches").get().get().getDocuments()) {
            String query = doc.getString("query");
            String at = doc.getString("at");
            if (query == null || query.isBlank()) continue;
            String key = query.trim().toLowerCase();
            counts.merge(key, 1, Integer::sum);
            if (at != null) {
                lastSeen.merge(key, at, (a, b) -> a.compareTo(b) > 0 ? a : b);
            }
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(100)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("query", e.getKey());
                    m.put("count", e.getValue());
                    m.put("lastSeenAt", lastSeen.get(e.getKey()));
                    return m;
                }).toList();
    }

    // ───────── 요리모드 이탈 지점 ─────────

    /**
     * cooking_step_events 에서 recipeId별 단계별 이탈률 집계.
     * enter 카운트와 complete 카운트를 비교해 각 단계에서 빠져나간 비율 도출.
     */
    public List<Map<String, Object>> getCookingDropoff() throws ExecutionException, InterruptedException {
        // recipeId → step → { enter, complete }
        Map<String, Map<Integer, int[]>> stats = new HashMap<>();
        Map<String, String> recipeTitles = new HashMap<>();
        for (QueryDocumentSnapshot doc : firestore.collection("cooking_step_events").get().get().getDocuments()) {
            String recipeId = doc.getString("recipeId");
            String recipeTitle = doc.getString("recipeTitle");
            Long stepL = doc.getLong("step");
            String type = doc.getString("type"); // "enter" or "complete"
            if (recipeId == null || stepL == null || type == null) continue;
            int step = stepL.intValue();
            if (recipeTitle != null) recipeTitles.put(recipeId, recipeTitle);
            stats.computeIfAbsent(recipeId, k -> new HashMap<>())
                    .computeIfAbsent(step, k -> new int[2])
                    [type.equals("complete") ? 1 : 0]++;
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, Map<Integer, int[]>> e : stats.entrySet()) {
            Map<String, Object> recipe = new LinkedHashMap<>();
            recipe.put("recipeId", e.getKey());
            recipe.put("recipeTitle", recipeTitles.get(e.getKey()));
            List<Map<String, Object>> steps = new ArrayList<>();
            e.getValue().entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(stepEntry -> {
                        int enter = stepEntry.getValue()[0];
                        int complete = stepEntry.getValue()[1];
                        Map<String, Object> s = new LinkedHashMap<>();
                        s.put("step", stepEntry.getKey());
                        s.put("enter", enter);
                        s.put("complete", complete);
                        s.put("dropoffRate", enter > 0 ? 1.0 - ((double) complete / enter) : 0);
                        steps.add(s);
                    });
            recipe.put("steps", steps);
            out.add(recipe);
        }
        // 총 enter 많은 레시피 먼저
        out.sort((a, b) -> {
            long aTotal = ((List<Map<String, Object>>) a.get("steps")).stream()
                    .mapToLong(s -> ((Integer) s.get("enter")).longValue()).sum();
            long bTotal = ((List<Map<String, Object>>) b.get("steps")).stream()
                    .mapToLong(s -> ((Integer) s.get("enter")).longValue()).sum();
            return Long.compare(bTotal, aTotal);
        });
        return out;
    }
}
