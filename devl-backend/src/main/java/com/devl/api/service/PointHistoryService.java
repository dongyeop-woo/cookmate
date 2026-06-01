package com.devl.api.service;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.PointHistoryDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class PointHistoryService {

    private final Firestore firestore;
    private static final String COLLECTION = "point_history";

    public List<PointHistoryDto> getByUid(String uid) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("uid", uid)
                .get();

        List<PointHistoryDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(PointHistoryDto.class));
        }
        list.sort((a, b) -> {
            String dateA = a.getCreatedAt() != null ? a.getCreatedAt() : "";
            String dateB = b.getCreatedAt() != null ? b.getCreatedAt() : "";
            return dateB.compareTo(dateA);
        });
        return list;
    }

    public PointHistoryDto create(PointHistoryDto dto) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setCreatedAt(Instant.now().toString());
        attachRequestContext(dto);
        ref.set(dto).get();
        return dto;
    }

    /** 현재 요청의 IP/UA/엔드포인트를 dto에 주입 (요청 컨텍스트 밖이면 no-op). */
    private void attachRequestContext(PointHistoryDto dto) {
        try {
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
            if (!(attrs instanceof ServletRequestAttributes)) return;
            HttpServletRequest req = ((ServletRequestAttributes) attrs).getRequest();
            if (dto.getSourceIp() == null) dto.setSourceIp(AuthContext.clientIp(req));
            if (dto.getSourceUa() == null) {
                String ua = req.getHeader("User-Agent");
                if (ua != null) dto.setSourceUa(ua.length() > 250 ? ua.substring(0, 250) : ua);
            }
            if (dto.getSourceEndpoint() == null) {
                dto.setSourceEndpoint(req.getMethod() + " " + req.getRequestURI());
            }
        } catch (Exception ignored) {
            // 백그라운드 스레드 등 요청 컨텍스트가 없는 경우는 무시
        }
    }

    /**
     * 포인트 적립 헬퍼 — point_history 기록 + users.points 증가를 WriteBatch로 원자화.
     * 이전엔 history 기록 성공 후 users.points 증가가 실패하면 내역만 남는 불일치 발생.
     */
    public void addPoints(String uid, int amount, String description, String recipeId) throws ExecutionException, InterruptedException {
        addPoints(uid, amount, null, description, recipeId);
    }

    public void addPoints(String uid, int amount, String title, String description, String recipeId) throws ExecutionException, InterruptedException {
        DocumentReference historyRef = firestore.collection(COLLECTION).document();
        PointHistoryDto dto = new PointHistoryDto();
        dto.setId(historyRef.getId());
        dto.setUid(uid);
        dto.setAmount(amount);
        dto.setType("earn");
        dto.setTitle(title);
        dto.setDescription(description);
        dto.setRecipeId(recipeId);
        dto.setCreatedAt(Instant.now().toString());
        attachRequestContext(dto);

        DocumentReference userRef = firestore.collection("users").document(uid);
        WriteBatch batch = firestore.batch();
        batch.set(historyRef, dto);
        batch.update(userRef, "points", FieldValue.increment(amount));
        batch.commit().get();
    }
}
