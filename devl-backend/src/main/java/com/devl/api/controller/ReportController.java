package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.auth.RateLimiter;
import com.devl.api.dto.ReportDto;
import com.devl.api.service.AuditLogService;
import com.devl.api.service.ReportService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final AuditLogService auditLogService;
    private final RateLimiter rateLimiter;

    @PostMapping("/api/reports")
    public ResponseEntity<?> create(@RequestBody ReportDto dto, HttpServletRequest req) throws ExecutionException, InterruptedException {
        try {
            if (dto.getReporterUid() != null) AuthContext.requireSelf(req, dto.getReporterUid());
            // 동일 유저 시간당 10건까지 — 신고 폭탄으로 상대 계정을 괴롭히는 어뷰징 방지
            if (dto.getReporterUid() != null) rateLimiter.check("report:" + dto.getReporterUid(), 10, 60L * 60 * 1000);
            return ResponseEntity.ok(reportService.create(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/api/admin/reports")
    public ResponseEntity<List<ReportDto>> getAll(HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        return ResponseEntity.ok(reportService.getAll());
    }

    @PutMapping("/api/admin/reports/{id}")
    public ResponseEntity<Void> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            HttpServletRequest req) throws ExecutionException, InterruptedException {
        AuthContext.requireAdmin(req);
        String newStatus = body.get("status");
        reportService.updateStatus(id, newStatus);
        auditLogService.log(req, "report", id, "update_status:" + newStatus);
        return ResponseEntity.ok().build();
    }
}
