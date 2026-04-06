package com.devl.api.service;

import com.devl.api.dto.CommunityRecipeDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityService {

    private final Firestore firestore;

    private static final String COLLECTION = "community";

    public List<CommunityRecipeDto> getAll() throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .get();

        List<CommunityRecipeDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            list.add(doc.toObject(CommunityRecipeDto.class));
        }
        return list;
    }

    public CommunityRecipeDto getById(String id) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection(COLLECTION).document(id).get().get();
        if (!doc.exists()) {
            return null;
        }
        return doc.toObject(CommunityRecipeDto.class);
    }

    public CommunityRecipeDto create(CommunityRecipeDto dto) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document();
        dto.setId(ref.getId());
        dto.setCreatedAt(java.time.Instant.now().toString());
        dto.setLikes(0);
        if (dto.getRatings() == null) dto.setRatings(new ArrayList<>());
        if (dto.getQuestions() == null) dto.setQuestions(new ArrayList<>());
        ref.set(dto).get();
        return dto;
    }

    public CommunityRecipeDto update(String id, CommunityRecipeDto dto) throws ExecutionException, InterruptedException {
        dto.setId(id);
        firestore.collection(COLLECTION).document(id).set(dto, SetOptions.merge()).get();
        return dto;
    }

    public void delete(String id) throws ExecutionException, InterruptedException {
        firestore.collection(COLLECTION).document(id).delete().get();
    }

    public CommunityRecipeDto addRating(String id, String userId, double score)
            throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        CommunityRecipeDto dto = ref.get().get().toObject(CommunityRecipeDto.class);
        if (dto == null) return null;

        List<CommunityRecipeDto.RatingDto> ratings = dto.getRatings();
        if (ratings == null) ratings = new ArrayList<>();
        ratings.removeIf(r -> userId.equals(r.getUserId()));
        ratings.add(CommunityRecipeDto.RatingDto.builder().userId(userId).score(score).build());
        dto.setRatings(ratings);

        ref.update("ratings", ratings).get();
        return dto;
    }

    public CommunityRecipeDto like(String id) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        ref.update("likes", FieldValue.increment(1)).get();
        return ref.get().get().toObject(CommunityRecipeDto.class);
    }

    public CommunityRecipeDto unlike(String id) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(id);
        CommunityRecipeDto dto = ref.get().get().toObject(CommunityRecipeDto.class);
        if (dto == null) return null;
        long currentLikes = dto.getLikes();
        ref.update("likes", Math.max(0, currentLikes - 1)).get();
        dto.setLikes((int) Math.max(0, currentLikes - 1));
        return dto;
    }
}
