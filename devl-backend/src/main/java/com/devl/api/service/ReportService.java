package com.devl.api.service;

import com.devl.api.dto.ReportDto;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final Firestore firestore;
    private static final String COLLECTION = "reports";

    public ReportDto create(ReportDto dto) throws ExecutionException, InterruptedException {
        if (dto.getReporterUid() == null || dto.getReporterUid().isEmpty()) {
            throw new IllegalArgumentException("신고자 정보가 필요합니다.");
        }
        if (dto.getTargetId() == null || dto.getTargetType() == null) {
            throw new IllegalArgumentException("신고 대상 정보가 필요합니다.");
        }

        // 동일 유저의 동일 대상 중복 신고 차단 (pending 또는 24h 이내)
        var existing = firestore.collection(COLLECTION)
                .whereEqualTo("reporterUid", dto.getReporterUid())
                .whereEqualTo("targetType", dto.getTargetType())
                .whereEqualTo("targetId", dto.getTargetId())
                .limit(1)
                .get().get().getDocuments();
        if (!existing.isEmpty()) {
            String existingStatus = existing.get(0).getString("status");
            if ("pending".equals(existingStatus) || "processing".equals(existingStatus)) {
                throw new IllegalArgumentException("이미 접수된 신고가 있습니다.");
            }
        }

        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setStatus("pending");
        dto.setCreatedAt(Instant.now().toString());
        ref.set(dto).get();
        log.info("신고 접수: id={}, type={}, targetId={}", dto.getId(), dto.getTargetType(), dto.getTargetId());
        return dto;
    }

    public List<ReportDto> getAll() throws ExecutionException, InterruptedException {
        List<ReportDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : firestore.collection(COLLECTION)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .get().get().getDocuments()) {
            list.add(doc.toObject(ReportDto.class));
        }
        return list;
    }

    public void updateStatus(String id, String status) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(id)
                .update(Map.of("status", status))
                .get();
    }
}
