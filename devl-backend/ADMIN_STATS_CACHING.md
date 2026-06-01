# AdminStatsService 캐싱 전략

`AdminStatsService`는 DAU/리텐션/신고분포/검색실패/쿠킹모드 이탈 등 대시보드 통계를 계산한다.
**현재는 호출 시점마다 `users`, `community`, `reviews`, `reports`, `refund_requests`, `user_gifticons`,
`failed_searches`, `cooking_step_events` 컬렉션을 전량 스캔**한다. 관리자 1명이 대시보드를 한 번 열 때마다
수천~수만 reads가 발생한다.

## 문제 상세

[AdminStatsService.java](src/main/java/com/devl/api/service/AdminStatsService.java) 내 풀스캔 지점:

| 라인 | 메서드 | 스캔 대상 | 호출 빈도 |
|---|---|---|---|
| 128-129 | `getRegistrationToFirstRecipe()` | users + community | 대시보드 진입 |
| 186 | `getReportReasonDistribution()` | reports | 대시보드 진입 |
| 207 | `getReviewLengthStats()` | reviews | 대시보드 진입 |
| 232 | `getDailyActivity()` | users + reviews | 대시보드 진입 |
| 253 | `getRefundStats()` | refund_requests | 대시보드 진입 |
| 279 | `getGifticonRedemption()` | user_gifticons | 대시보드 진입 |
| 311 | `getFailedSearches()` | failed_searches | 대시보드 진입 |
| 343 | `getCookingDropoff()` | cooking_step_events | 대시보드 진입 |

**예상 비용** (유저 1만명 + 관리자 1명이 하루 5회 조회 기준):
- 1회 대시보드 진입 ≈ 2만~10만 reads
- 일일 약 50만~100만 reads = **월 10만~20만 reads 오버**
- Firestore 요금 무료 한도 1일 5만 reads 넘어서부터 과금

## 권장 해결 방안

### A. 집계 캐시 문서 (즉시 효과)

시간당 1회 precompute → 결과를 `analytics_cache/{date}` 문서에 저장.
관리자 대시보드는 이 문서만 조회 (1 read).

**구현 순서**:

1. 새 컬렉션 `analytics_cache` 생성
2. 새 스케줄러 추가 (`AnalyticsAggregationScheduler.java`):
   ```java
   @Scheduled(cron = "0 0 * * * *", zone = "UTC") // 매시간 정각
   public void precompute() {
       String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
       Map<String, Object> snapshot = new HashMap<>();
       snapshot.put("dau", adminStatsService.getDailyActivity());
       snapshot.put("reports", adminStatsService.getReportReasonDistribution());
       snapshot.put("refunds", adminStatsService.getRefundStats());
       snapshot.put("gifticons", adminStatsService.getGifticonRedemption());
       snapshot.put("reviews", adminStatsService.getReviewLengthStats());
       snapshot.put("regToRecipe", adminStatsService.getRegistrationToFirstRecipe());
       snapshot.put("failedSearches", adminStatsService.getFailedSearches());
       snapshot.put("cookingDropoff", adminStatsService.getCookingDropoff());
       snapshot.put("updatedAt", Instant.now().toString());
       firestore.collection("analytics_cache").document(today).set(snapshot).get();
   }
   ```
3. `AdminStatsController`에 새 엔드포인트 추가:
   ```java
   @GetMapping("/dashboard-snapshot")
   public ResponseEntity<?> getDashboardSnapshot() {
       String today = LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
       DocumentSnapshot snap = firestore.collection("analytics_cache")
           .document(today).get().get();
       if (!snap.exists()) return ResponseEntity.ok(Map.of("updatedAt", null));
       return ResponseEntity.ok(snap.getData());
   }
   ```
4. 프론트 [dashboard.tsx](../devl/app/admin/dashboard.tsx)를 `/api/admin/dashboard-snapshot` 단일 호출로 변경.

**효과**:
- 관리자 조회 1회당 수천 reads → **1 read** (99%+ 절감)
- 신선도: 최신 데이터 최대 1시간 지연 — 운영 통계는 실시간 필요 없어서 수용 가능

### B. whereIn 기반 DAU 계산 (더 정밀)

DAU/리텐션은 `users` 전체 스캔 대신 `attendance` 컬렉션을 사용:

```java
// 오늘 출석한 유저 수
ApiFuture<AggregateQuerySnapshot> count = firestore.collection("attendance")
    .whereEqualTo("date", LocalDate.now(kst).toString())
    .count().get();
long dau = count.get().getCount();
```

현재 users 컬렉션 풀스캔 + `lastActiveAt` 비교 → **attendance 레코드 count() 쿼리** (1 read).

### C. BigQuery 연동 (규모 커질 때)

유저 10만명+ 이상이면 Firestore 기반 집계 한계. Firestore → BigQuery 자동 export 설정 후
BigQuery SQL로 집계하면 **수십억 row도 초 단위 처리** 가능하고 비용도 Firestore 대비 저렴.

```
gcloud firestore export gs://<bucket>/daily-$(date +%F) --async
# BigQuery 스트리밍 설정: Firebase Extensions "Firestore → BigQuery" 사용
```

### D. 단기 완화 (캐싱 구현 전)

대시보드 페이지에서 한 번 로드하면 해당 세션 동안 메모리 캐싱:

```tsx
// dashboard.tsx
const [snapshot, setSnapshot] = useState(null);
useEffect(() => {
  if (snapshot) return; // 세션 동안 1회만
  loadAll().then(setSnapshot);
}, []);
```

관리자가 다른 탭 다녀와도 재조회 안 함. 제한적이지만 사용자 행동 패턴상 큰 효과.

## 우선순위

1. **당장** (D안) — 프론트 캐시만으로도 관리자 이동 반복 시 90% 절감
2. **1주 내** (A안) — Cloud Scheduler + analytics_cache 구현
3. **장기** (B/C안) — 유저 규모 1만명+ 도달 시 점진 도입

## 체크리스트

- [ ] `analytics_cache` 컬렉션 Firestore 규칙 추가 (관리자 read 전용)
- [ ] `AnalyticsAggregationScheduler` 구현
- [ ] Cloud Scheduler 시간당 트리거 확인 (Spring Boot `@Scheduled`는 서버 재시작 시 초기화되므로 Cloud Scheduler 병행 권장)
- [ ] 프론트 대시보드 단일 엔드포인트로 교체
- [ ] 기존 `/api/admin/stats/*` 엔드포인트는 deprecated 처리 후 추후 삭제
