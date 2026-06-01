package com.devl.api.service;

import com.devl.api.dto.InquiryDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class InquiryService {

    private final Firestore firestore;
    private final NotificationService notificationService;
    private final MailService mailService;

    private static final String COLLECTION = "inquiries";
    private static final String USERS = "users";

    public InquiryDto create(InquiryDto dto) throws ExecutionException, InterruptedException {
        if (dto.getUid() == null || dto.getUid().isEmpty()) {
            throw new IllegalArgumentException("uid는 필수입니다.");
        }
        if (dto.getTitle() == null || dto.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("제목은 필수입니다.");
        }
        if (dto.getContent() == null || dto.getContent().trim().length() < 5) {
            throw new IllegalArgumentException("문의 내용은 5자 이상 작성해주세요.");
        }

        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setStatus("pending");
        String now = Instant.now().toString();
        dto.setCreatedAt(now);
        dto.setUpdatedAt(now);
        ref.set(dto).get();

        // 관리자에게 새 문의 알림 (푸시)
        notificationService.sendToAdmins("새 문의 접수",
                String.format("[%s] %s", dto.getCategory() != null ? dto.getCategory() : "기타", dto.getTitle()));

        // 관리자에게 이메일 알림
        String mailSubject = String.format("[요잘알 문의] %s", dto.getTitle());
        String mailBody = String.format(
                "새 문의가 접수되었습니다.\n\n" +
                "─────────────────────\n" +
                "분류: %s\n" +
                "제목: %s\n" +
                "작성자 UID: %s\n" +
                "작성자 닉네임: %s\n" +
                "접수일시: %s\n" +
                "─────────────────────\n\n" +
                "[내용]\n%s\n\n" +
                "─────────────────────\n" +
                "관리자 페이지에서 답변해주세요.",
                dto.getCategory() != null ? dto.getCategory() : "기타",
                dto.getTitle(),
                dto.getUid(),
                dto.getAuthorNickname() != null ? dto.getAuthorNickname() : "(없음)",
                now,
                dto.getContent()
        );
        mailService.sendAdminNotification(mailSubject, mailBody);

        log.info("문의 접수: id={}, uid={}, category={}", dto.getId(), dto.getUid(), dto.getCategory());
        return dto;
    }

    public List<InquiryDto> getByUid(String uid) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("uid", uid)
                .get();
        List<InquiryDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(InquiryDto.class));
        }
        list.sort((a, b) -> {
            String A = a.getCreatedAt() != null ? a.getCreatedAt() : "";
            String B = b.getCreatedAt() != null ? b.getCreatedAt() : "";
            return B.compareTo(A);
        });
        return list;
    }

    public InquiryDto getById(String id) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection(COLLECTION).document(id).get().get();
        return doc.exists() ? doc.toObject(InquiryDto.class) : null;
    }

    /** 관리자 전용: 모든 문의 + 상태별 필터 */
    public List<InquiryDto> getAll(String statusFilter) throws ExecutionException, InterruptedException {
        Query q = firestore.collection(COLLECTION);
        if (statusFilter != null && !statusFilter.isEmpty() && !"all".equals(statusFilter)) {
            q = q.whereEqualTo("status", statusFilter);
        }
        QuerySnapshot snaps = q.get().get();
        List<InquiryDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : snaps.getDocuments()) {
            list.add(doc.toObject(InquiryDto.class));
        }
        list.sort((a, b) -> {
            String A = a.getCreatedAt() != null ? a.getCreatedAt() : "";
            String B = b.getCreatedAt() != null ? b.getCreatedAt() : "";
            return B.compareTo(A);
        });
        return list;
    }

    /** 관리자 답변 작성/수정 */
    public InquiryDto reply(String id, String adminUid, String reply) throws ExecutionException, InterruptedException {
        if (reply == null || reply.trim().isEmpty()) {
            throw new IllegalArgumentException("답변 내용은 필수입니다.");
        }
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) {
            throw new IllegalArgumentException("문의를 찾을 수 없습니다.");
        }
        // 관리자 권한 확인
        DocumentSnapshot adminDoc = firestore.collection(USERS).document(adminUid).get().get();
        if (!"admin".equals(adminDoc.getString("role"))) {
            throw new IllegalArgumentException("관리자만 답변할 수 있습니다.");
        }
        String adminNickname = adminDoc.getString("nickname");

        Map<String, Object> updates = new HashMap<>();
        updates.put("adminReply", reply.trim());
        updates.put("repliedBy", adminNickname != null ? adminNickname : "관리자");
        updates.put("repliedAt", Instant.now().toString());
        updates.put("status", "answered");
        updates.put("updatedAt", Instant.now().toString());
        ref.update(updates).get();

        // 사용자에게 답변 알림
        String userUid = snap.getString("uid");
        String title = snap.getString("title");
        if (userUid != null) {
            notificationService.sendToUser(userUid, "문의 답변 도착",
                    String.format("'%s' 문의에 답변이 도착했어요.", title != null ? title : ""),
                    "inquiry", "/inquiry/" + id, null);
        }
        return ref.get().get().toObject(InquiryDto.class);
    }

    public void updateStatus(String id, String status) throws ExecutionException, InterruptedException {
        Map<String, Object> updates = new HashMap<>();
        updates.put("status", status);
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(id).update(updates).get();
    }

    public void delete(String id) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(id).delete().get();
    }
}
