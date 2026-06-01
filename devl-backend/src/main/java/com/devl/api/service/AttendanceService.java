package com.devl.api.service;

import com.devl.api.dto.AttendanceDto;
import com.devl.api.dto.PointHistoryDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final Firestore firestore;
    private final PointHistoryService pointHistoryService;
    private final UserService userService;

    private static final String COLLECTION = "attendance";
    private static final String USERS = "users";
    private static final int BONUS_EVERY_N_DAYS = 7;
    private static final int BONUS_POINTS = 40;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 기본 포인트 = 3 + streak (day 1=4P, day 3=6P, day 7=10P) */
    private int calculateBase(int streak) {
        return 3 + streak;
    }

    private int calculateBonus(int streak) {
        return (streak > 0 && streak % BONUS_EVERY_N_DAYS == 0) ? BONUS_POINTS : 0;
    }

    /** 현재 상태 조회 (오늘 출석 여부 + 연속 일수 + 오늘 지급 예정 포인트) */
    public Map<String, Object> getStatus(String uid) throws ExecutionException, InterruptedException {
        String today = LocalDate.now(KST).toString();
        AttendanceDto todayRecord = getRecord(uid, today);
        int currentStreak = todayRecord != null ? todayRecord.getStreak() : computeStreakIfCheckedToday(uid, today);
        int nextStreak = todayRecord != null ? currentStreak : currentStreak + 1;

        Map<String, Object> res = new HashMap<>();
        res.put("attendedToday", todayRecord != null);
        res.put("currentStreak", currentStreak);
        res.put("nextStreak", nextStreak);
        res.put("expectedBase", calculateBase(nextStreak));
        res.put("expectedBonus", calculateBonus(nextStreak));
        return res;
    }

    /**
     * 출석체크 실행 (하루 1회 제한, streak 계산 + 포인트 지급).
     * 문서 id를 uid_date로 결정적 생성하고 트랜잭션으로 create-if-absent 해서
     * 동시 호출 시 한쪽만 성공하도록 보장한다.
     */
    public AttendanceDto check(String uid) throws ExecutionException, InterruptedException {
        if (uid == null || uid.isEmpty()) {
            throw new IllegalArgumentException("uid는 필수입니다.");
        }
        LocalDate todayDate = LocalDate.now(KST);
        String today = todayDate.toString();

        // 어제 streak 조회 (트랜잭션 외부 — 과거 데이터라 정합성 영향 없음)
        String yesterday = todayDate.minusDays(1).toString();
        AttendanceDto yesterdayRecord = getRecord(uid, yesterday);
        int newStreak = yesterdayRecord != null ? yesterdayRecord.getStreak() + 1 : 1;

        int base = calculateBase(newStreak);
        int bonus = calculateBonus(newStreak);
        int total = base + bonus;

        // 결정적 문서 id (동일 uid+date는 단 하나의 문서만 존재)
        String docId = uid + "_" + today;
        DocumentReference ref = firestore.collection(COLLECTION).document(docId);

        AttendanceDto dto = AttendanceDto.builder()
                .id(docId)
                .uid(uid)
                .date(today)
                .streak(newStreak)
                .awardedPoints(base)
                .bonusPoints(bonus)
                .createdAt(Instant.now().toString())
                .build();

        Boolean alreadyChecked;
        try {
            alreadyChecked = firestore.runTransaction(tx -> {
                com.google.cloud.firestore.DocumentSnapshot snap = tx.get(ref).get();
                if (snap.exists()) return Boolean.TRUE;
                tx.set(ref, dto);
                return Boolean.FALSE;
            }).get();
        } catch (ExecutionException e) {
            throw e;
        }

        if (Boolean.TRUE.equals(alreadyChecked)) {
            throw new IllegalArgumentException("오늘 이미 출석체크를 완료했습니다.");
        }

        // 포인트 지급
        firestore.collection(USERS).document(uid)
                .update("points", FieldValue.increment(total)).get();

        // 포인트 내역 기록
        PointHistoryDto history = PointHistoryDto.builder()
                .uid(uid)
                .type("earn")
                .amount(total)
                .title("출석체크")
                .description(newStreak + "일째 출석" + (bonus > 0 ? " + " + BONUS_EVERY_N_DAYS + "일 연속 보너스" : ""))
                .build();
        pointHistoryService.create(history);
        log.info("출석 포인트 {}P 지급: uid={}, streak={}", total, uid, newStreak);

        // 첫 출석체크 보너스 200P 지급
        try {
            userService.claimAttendanceBonus(uid);
        } catch (Exception e) {
            log.warn("첫 출석 보너스 지급 실패: uid={}, error={}", uid, e.getMessage());
        }

        return dto;
    }

    private AttendanceDto getRecord(String uid, String date) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("uid", uid)
                .whereEqualTo("date", date)
                .limit(1)
                .get();
        List<QueryDocumentSnapshot> docs = future.get().getDocuments();
        return docs.isEmpty() ? null : docs.get(0).toObject(AttendanceDto.class);
    }

    /** 오늘 아직 출석 안 했을 때 "현재 유지되는 streak" 계산 (어제 출석 기록 기반) */
    private int computeStreakIfCheckedToday(String uid, String today) throws ExecutionException, InterruptedException {
        LocalDate yesterday = LocalDate.parse(today).minusDays(1);
        AttendanceDto y = getRecord(uid, yesterday.toString());
        return y != null ? y.getStreak() : 0;
    }
}
