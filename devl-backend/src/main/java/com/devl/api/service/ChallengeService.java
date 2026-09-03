package com.devl.api.service;

import com.devl.api.dto.AttendanceDto;
import com.devl.api.dto.ChallengeDto;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

/**
 * 일일 도전과제.
 *
 * 설계 의도:
 *  - 과제 완료 자체엔 포인트를 주지 않는다(소비형 행동). 어뷰징 유인을 없애기 위함.
 *  - 대신 "하루에 하나라도 완료" 하면 연속(streak)이 이어지고, 7일마다 보너스가 나간다.
 *    즉 포인트는 자산이 남는 행동(후기·레시피·초대)과 연속 달성에서만 나간다.
 *  - 매일 요리하지는 않으므로 택1 구조 — 아무 과제 하나면 그날은 완료.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChallengeService {

    private final Firestore firestore;
    private final AttendanceService attendanceService;

    private static final String COLLECTION = "challenges";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 과제 정의. id 는 클라이언트가 완료를 보고할 때 쓰는 키라 바꾸면 안 된다. */
    public static final List<Map<String, String>> TASKS = List.of(
            taskDef("listen", "음성모드로 요리하기", "쿠킹모드 음성으로 3단계 진행"),
            taskDef("like",   "레시피 좋아요", "마음에 드는 레시피에 하트"),
            taskDef("review", "후기 남기기",  "요리 후기 1개 작성")
    );

    private static Map<String, String> taskDef(String id, String title, String sub) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("title", title);
        m.put("sub", sub);
        return m;
    }

    private static boolean isValidTask(String taskId) {
        return TASKS.stream().anyMatch(t -> t.get("id").equals(taskId));
    }

    private String today() {
        return LocalDate.now(KST).toString();
    }

    private DocumentReference docRef(String uid, String date) {
        return firestore.collection(COLLECTION).document(uid + "_" + date);
    }

    /** 오늘의 과제 목록 + 완료 여부 + 연속 정보. */
    public Map<String, Object> getToday(String uid) throws ExecutionException, InterruptedException {
        String date = today();
        DocumentSnapshot snap = docRef(uid, date).get().get();
        ChallengeDto record = snap.exists() ? snap.toObject(ChallengeDto.class) : null;
        List<String> done = record != null ? record.getCompletedTasks() : List.of();

        List<Map<String, Object>> tasks = new ArrayList<>();
        for (Map<String, String> t : TASKS) {
            Map<String, Object> item = new LinkedHashMap<>(t);
            item.put("completed", done.contains(t.get("id")));
            tasks.add(item);
        }

        Map<String, Object> attendance = attendanceService.getStatus(uid);

        Map<String, Object> res = new HashMap<>();
        res.put("date", date);
        res.put("tasks", tasks);
        res.put("completedCount", done.size());
        res.put("totalCount", TASKS.size());
        // 하나라도 하면 그날은 완료 — 연속이 이어진다
        res.put("dayCompleted", !done.isEmpty());
        res.put("currentStreak", attendance.get("currentStreak"));
        res.put("nextBonusIn", nextBonusIn(attendance));
        return res;
    }

    /** 다음 보너스까지 남은 일수 (0이면 오늘 완료 시 보너스). */
    private int nextBonusIn(Map<String, Object> attendance) {
        Object nextStreakObj = attendance.get("nextStreak");
        int nextStreak = nextStreakObj instanceof Integer ? (Integer) nextStreakObj : 0;
        int remainder = nextStreak % 7;
        return remainder == 0 ? 0 : 7 - remainder;
    }

    /**
     * 과제 완료 보고.
     * 같은 과제를 여러 번 보고해도 한 번만 반영되고(멱등),
     * 그날 첫 완료일 때만 연속(streak)을 진행시킨다.
     */
    public Map<String, Object> complete(String uid, String taskId)
            throws ExecutionException, InterruptedException {
        if (uid == null || uid.isEmpty()) {
            throw new IllegalArgumentException("uid는 필수입니다.");
        }
        if (!isValidTask(taskId)) {
            throw new IllegalArgumentException("알 수 없는 과제입니다: " + taskId);
        }

        String date = today();
        DocumentReference ref = docRef(uid, date);

        // 트랜잭션 안에서 "오늘 첫 완료인지"까지 판정해야 동시 호출 시 streak 이 두 번 진행되지 않는다.
        Boolean firstOfDay = firestore.runTransaction(tx -> {
            DocumentSnapshot snap = tx.get(ref).get();
            if (!snap.exists()) {
                ChallengeDto fresh = ChallengeDto.builder()
                        .id(ref.getId())
                        .uid(uid)
                        .date(date)
                        .completedTasks(new ArrayList<>(List.of(taskId)))
                        .createdAt(Instant.now().toString())
                        .build();
                tx.set(ref, fresh);
                return Boolean.TRUE;
            }
            ChallengeDto existing = snap.toObject(ChallengeDto.class);
            List<String> done = existing != null ? existing.getCompletedTasks() : new ArrayList<>();
            boolean wasEmpty = done.isEmpty();
            if (!done.contains(taskId)) {
                List<String> updated = new ArrayList<>(done);
                updated.add(taskId);
                tx.update(ref, "completedTasks", updated);
            }
            return wasEmpty;
        }).get();

        int awardedBonus = 0;
        int streak = 0;
        if (Boolean.TRUE.equals(firstOfDay)) {
            try {
                AttendanceDto att = attendanceService.check(uid);
                awardedBonus = att.getBonusPoints();
                streak = att.getStreak();
            } catch (IllegalArgumentException e) {
                // 이미 오늘 처리된 경우 — 과제 기록은 남기고 조용히 넘어간다
                log.debug("streak 이미 진행됨: uid={}, {}", uid, e.getMessage());
            } catch (Exception e) {
                // streak 실패가 과제 완료 자체를 막으면 안 된다
                log.warn("streak 진행 실패: uid={}, error={}", uid, e.getMessage());
            }
        }

        Map<String, Object> res = new HashMap<>(getToday(uid));
        res.put("firstOfDay", Boolean.TRUE.equals(firstOfDay));
        res.put("awardedBonus", awardedBonus);
        if (streak > 0) res.put("currentStreak", streak);
        return res;
    }
}
