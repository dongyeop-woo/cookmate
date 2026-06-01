package com.devl.api.service;

import com.devl.api.dto.FridgeItemDto;
import com.devl.api.dto.FridgeSettingsDto;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class FridgeService {

    private final Firestore firestore;
    private static final String ITEMS_COLLECTION = "fridge_items";
    private static final String SETTINGS_COLLECTION = "fridge_settings";

    // ────────────── 재료 CRUD ──────────────

    public List<FridgeItemDto> list(String uid) throws ExecutionException, InterruptedException {
        requireUid(uid);
        QuerySnapshot snap = firestore.collection(ITEMS_COLLECTION)
                .whereEqualTo("uid", uid)
                .get()
                .get();
        List<FridgeItemDto> items = new ArrayList<>();
        for (DocumentSnapshot doc : snap.getDocuments()) {
            items.add(doc.toObject(FridgeItemDto.class));
        }
        items.sort((a, b) -> {
            String ea = a.getExpiresAt() == null ? "" : a.getExpiresAt();
            String eb = b.getExpiresAt() == null ? "" : b.getExpiresAt();
            return ea.compareTo(eb);
        });
        return items;
    }

    public FridgeItemDto add(String uid, FridgeItemDto input) throws ExecutionException, InterruptedException {
        requireUid(uid);
        String id = UUID.randomUUID().toString();
        FridgeItemDto item = FridgeItemDto.builder()
                .id(id)
                .uid(uid)
                .name(input.getName())
                .icon(input.getIcon())
                .imageUrl(input.getImageUrl())
                .addedAt(Instant.now().toString())
                .expiresAt(input.getExpiresAt())
                .quantity(input.getQuantity())
                .storage(input.getStorage())
                .notificationIds(input.getNotificationIds())
                .isCustom(input.getIsCustom())
                .sourceKey(input.getSourceKey())
                .build();
        firestore.collection(ITEMS_COLLECTION).document(id).set(item).get();
        return item;
    }

    public FridgeItemDto update(String uid, String id, FridgeItemDto updates) throws ExecutionException, InterruptedException {
        requireUid(uid);
        DocumentReference ref = firestore.collection(ITEMS_COLLECTION).document(id);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) throw new IllegalArgumentException("재료를 찾을 수 없어요");
        FridgeItemDto existing = snap.toObject(FridgeItemDto.class);
        if (existing == null || !uid.equals(existing.getUid())) {
            throw new IllegalArgumentException("권한이 없어요");
        }
        if (updates.getName() != null) existing.setName(updates.getName());
        if (updates.getIcon() != null) existing.setIcon(updates.getIcon());
        if (updates.getImageUrl() != null) existing.setImageUrl(updates.getImageUrl());
        if (updates.getExpiresAt() != null) existing.setExpiresAt(updates.getExpiresAt());
        if (updates.getQuantity() != null) existing.setQuantity(updates.getQuantity());
        if (updates.getStorage() != null) existing.setStorage(updates.getStorage());
        if (updates.getNotificationIds() != null) existing.setNotificationIds(updates.getNotificationIds());
        ref.set(existing).get();
        return existing;
    }

    public void remove(String uid, String id) throws ExecutionException, InterruptedException {
        requireUid(uid);
        DocumentReference ref = firestore.collection(ITEMS_COLLECTION).document(id);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) return;
        FridgeItemDto existing = snap.toObject(FridgeItemDto.class);
        if (existing != null && !uid.equals(existing.getUid())) {
            throw new IllegalArgumentException("권한이 없어요");
        }
        ref.delete().get();
    }

    public void clear(String uid) throws ExecutionException, InterruptedException {
        requireUid(uid);
        QuerySnapshot snap = firestore.collection(ITEMS_COLLECTION)
                .whereEqualTo("uid", uid)
                .get()
                .get();
        WriteBatch batch = firestore.batch();
        for (DocumentSnapshot doc : snap.getDocuments()) {
            batch.delete(doc.getReference());
        }
        batch.commit().get();
    }

    // ────────────── 설정 ──────────────

    public FridgeSettingsDto getSettings(String uid) throws ExecutionException, InterruptedException {
        requireUid(uid);
        DocumentSnapshot snap = firestore.collection(SETTINGS_COLLECTION).document(uid).get().get();
        if (!snap.exists()) return null;
        return snap.toObject(FridgeSettingsDto.class);
    }

    public FridgeSettingsDto saveSettings(String uid, FridgeSettingsDto settings) throws ExecutionException, InterruptedException {
        requireUid(uid);
        firestore.collection(SETTINGS_COLLECTION).document(uid).set(settings).get();
        return settings;
    }

    private void requireUid(String uid) {
        if (uid == null || uid.isEmpty()) {
            throw new IllegalArgumentException("uid는 필수입니다.");
        }
    }
}
