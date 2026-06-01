package com.devl.api.controller;

import com.devl.api.dto.PointHistoryDto;
import com.devl.api.service.PointHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class PointHistoryController {

    private final PointHistoryService pointHistoryService;

    @GetMapping("/{uid}/point-history")
    public ResponseEntity<List<PointHistoryDto>> getByUid(@PathVariable String uid)
            throws ExecutionException, InterruptedException {
        return ResponseEntity.ok(pointHistoryService.getByUid(uid));
    }
}
