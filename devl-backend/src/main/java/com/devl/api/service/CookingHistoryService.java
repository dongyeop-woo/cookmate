package com.devl.api.service;

import com.devl.api.dto.CookingHistoryDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class CookingHistoryService {

    private final Firestore firestore;
    private static final String COLLECTION = "cooking_history";

    /** 유저가 해당 레시피로 요리모드를 완료했음을 기록. 이미 있으면 재기록 안 함. */
    public CookingHistoryDto complete(String uid, String recipeId) throws ExecutionException, InterruptedException {
        if (uid == null || uid.isEmpty() || recipeId == null || recipeId.isEmpty()) {
            throw new IllegalArgumentException("uid, recipeId는 필수입니다.");
        }

        String docId = uid + "_" + recipeId;
        DocumentReference ref = firestore.collection(COLLECTION).document(docId);
        DocumentSnapshot existing = ref.get().get();
        if (existing.exists()) {
            return existing.toObject(CookingHistoryDto.class);
        }

        CookingHistoryDto dto = CookingHistoryDto.builder()
                .id(docId)
                .uid(uid)
                .recipeId(recipeId)
                .cookedAt(Instant.now().toString())
                .build();
        ref.set(dto).get();
        log.info("요리모드 완료 기록: uid={}, recipeId={}", uid, recipeId);
        return dto;
    }

    /** 유저가 해당 레시피를 완료했는지 확인 */
    public boolean hasCooked(String uid, String recipeId) throws ExecutionException, InterruptedException {
        if (uid == null || uid.isEmpty() || recipeId == null || recipeId.isEmpty()) return false;
        String docId = uid + "_" + recipeId;
        DocumentSnapshot snap = firestore.collection(COLLECTION).document(docId).get().get();
        return snap.exists();
    }

    /** 완료 기록 조회 (없으면 null) */
    public CookingHistoryDto getRecord(String uid, String recipeId) throws ExecutionException, InterruptedException {
        if (uid == null || uid.isEmpty() || recipeId == null || recipeId.isEmpty()) return null;
        String docId = uid + "_" + recipeId;
        DocumentSnapshot snap = firestore.collection(COLLECTION).document(docId).get().get();
        return snap.exists() ? snap.toObject(CookingHistoryDto.class) : null;
    }
}
