package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Storage;
import com.google.firebase.cloud.StorageClient;
import jakarta.servlet.http.HttpServletRequest;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    @Value("${firebase.storage-bucket}")
    private String storageBucket;

    // 파일 크기 상한 (바이트). 프로필 이미지는 좀 더 작게 제한.
    private static final long MAX_PROFILE_IMAGE_BYTES = 5L * 1024 * 1024;   // 5MB
    private static final long MAX_CONTENT_IMAGE_BYTES = 10L * 1024 * 1024;  // 10MB
    // 저장 시 리사이즈 최대 변(px). 그리드/상세 모두 충분히 선명하면서 다운로드 양 80~95% 감소.
    private static final int MAX_IMAGE_DIMENSION = 1200;
    private static final float JPEG_QUALITY = 0.85f;
    // 움짤(gif)과 영상은 제외, 정적 이미지 포맷은 모두 허용
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp",
            "image/heic", "image/heif", "image/bmp", "image/avif",
            "image/tiff"
    );

    private static String validateAndExt(MultipartFile file, long maxBytes) {
        String contentType = file.getContentType();
        String ct = contentType == null ? "" : contentType.toLowerCase();
        if (ct.isEmpty() || !ALLOWED_IMAGE_TYPES.contains(ct)) {
            throw new IllegalArgumentException("허용되지 않는 이미지 형식입니다. (움짤/영상 제외)");
        }
        if (file.getSize() <= 0) {
            throw new IllegalArgumentException("빈 파일입니다.");
        }
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException("파일 크기가 너무 큽니다. 최대 " + (maxBytes / 1024 / 1024) + "MB까지 허용.");
        }
        if (ct.equals("image/png")) return "png";
        if (ct.equals("image/webp")) return "webp";
        if (ct.equals("image/heic")) return "heic";
        if (ct.equals("image/heif")) return "heif";
        if (ct.equals("image/bmp")) return "bmp";
        if (ct.equals("image/avif")) return "avif";
        if (ct.equals("image/tiff")) return "tiff";
        return "jpg";
    }

    /**
     * 업로드 이미지를 저장하기 전에 max {@link #MAX_IMAGE_DIMENSION}px로 리사이즈.
     * - JPEG/PNG/BMP만 시도 (Thumbnailator/ImageIO 표준 지원). HEIC/WebP/AVIF/TIFF 등은 원본 그대로.
     * - 작은 이미지는 Thumbnailator의 no-upscaling 정책으로 자동 그대로 유지.
     * - EXIF orientation 자동 적용(useExifOrientation 기본값 true).
     * - 어떤 이유로든 변환 실패 시 null 반환 → 호출자가 원본 그대로 저장.
     */
    private static byte[] resizeIfPossible(MultipartFile file, String contentType) {
        String ct = contentType == null ? "" : contentType.toLowerCase();
        boolean canResize = ct.equals("image/jpeg") || ct.equals("image/jpg")
                || ct.equals("image/png") || ct.equals("image/bmp");
        if (!canResize) return null;
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            Thumbnails.of(file.getInputStream())
                    .size(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
                    .keepAspectRatio(true)
                    .outputQuality(JPEG_QUALITY)
                    .toOutputStream(baos);
            return baos.toByteArray();
        } catch (Throwable t) {
            // 변환 실패는 fatal하지 않음 — 원본으로 fallback
            return null;
        }
    }

    private String uploadAndGetUrl(String fileName, MultipartFile file, String contentType) throws IOException {
        var bucket = StorageClient.getInstance().bucket(storageBucket);
        byte[] resized = resizeIfPossible(file, contentType);
        if (resized != null) {
            bucket.create(fileName, new ByteArrayInputStream(resized), contentType);
        } else {
            bucket.create(fileName, file.getInputStream(), contentType);
        }
        return String.format(
                "https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media",
                storageBucket,
                URLEncoder.encode(fileName, StandardCharsets.UTF_8)
        );
    }

    @PostMapping("/profile-image")
    public ResponseEntity<Map<String, String>> uploadProfileImage(
            @RequestParam("uid") String uid,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest req) throws IOException {
        try {
            AuthContext.requireSelf(req, uid);
            String ext = validateAndExt(file, MAX_PROFILE_IMAGE_BYTES);
            String safeUid = uid.replace(':', '_').replace('/', '_');
            String fileName = "profileImages/" + safeUid + "." + ext;
            String url = uploadAndGetUrl(fileName, file, file.getContentType());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/review-image")
    public ResponseEntity<Map<String, String>> uploadReviewImage(
            @RequestParam("uid") String uid,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest req) throws IOException {
        try {
            AuthContext.requireSelf(req, uid);
            String ext = validateAndExt(file, MAX_CONTENT_IMAGE_BYTES);
            String safeUid = uid.replace(':', '_').replace('/', '_');
            String fileName = "reviewImages/" + safeUid + "_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
            String url = uploadAndGetUrl(fileName, file, file.getContentType());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 어드민 전용 — Firebase Storage에 이미 업로드된 이미지를 일괄 리사이즈해 덮어쓰기.
     * 신규 업로드는 uploadAndGetUrl에서 자동 처리되지만, 그 전에 올라간 기존 이미지는
     * 여전히 원본 사이즈로 남아있어서 다운로드가 느림. 이 엔드포인트로 한 번에 정리.
     *
     * 호출 예: POST /api/upload/backfill?folder=recipeImages
     * - folder: recipeImages | profileImages | reviewImages
     * - 각 호출에 한 폴더만 처리 (Cloud Run 타임아웃 고려).
     * - 이미 작은 이미지는 자동 skip (Thumbnailator no-upscaling).
     * - 5% 이상 줄어든 경우만 덮어쓰기 (불필요한 미세 갱신 방지).
     */
    @PostMapping("/backfill")
    public ResponseEntity<Map<String, Object>> backfillImages(
            @RequestParam("folder") String folder,
            @RequestParam(required = false) String pageToken,
            @RequestParam(defaultValue = "30") int limit,
            HttpServletRequest req
    ) throws IOException {
        AuthContext.requireAdmin(req);

        if (!Set.of("recipeImages", "profileImages", "reviewImages").contains(folder)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "invalid folder. allowed: recipeImages, profileImages, reviewImages"
            ));
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));

        var bucket = StorageClient.getInstance().bucket(storageBucket);
        String prefix = folder + "/";

        Storage.BlobListOption[] options;
        if (pageToken == null || pageToken.isBlank()) {
            options = new Storage.BlobListOption[] {
                    Storage.BlobListOption.prefix(prefix),
                    Storage.BlobListOption.pageSize(safeLimit),
            };
        } else {
            options = new Storage.BlobListOption[] {
                    Storage.BlobListOption.prefix(prefix),
                    Storage.BlobListOption.pageSize(safeLimit),
                    Storage.BlobListOption.pageToken(pageToken),
            };
        }

        var page = bucket.list(options);

        int processed = 0;
        int resized = 0;
        int skipped = 0;
        int failed = 0;
        long bytesBefore = 0;
        long bytesAfter = 0;
        List<String> errors = new ArrayList<>();

        for (Blob blob : page.getValues()) {
            processed++;
            try {
                String contentType = blob.getContentType();
                String ct = contentType == null ? "" : contentType.toLowerCase();
                // ImageIO 표준 포맷만 시도. HEIC/WebP/AVIF/TIFF 등은 skip.
                boolean canResize = ct.equals("image/jpeg") || ct.equals("image/jpg")
                        || ct.equals("image/png") || ct.equals("image/bmp");
                if (!canResize) {
                    skipped++;
                    continue;
                }

                byte[] original = blob.getContent();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                Thumbnails.of(new ByteArrayInputStream(original))
                        .size(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
                        .keepAspectRatio(true)
                        .outputQuality(JPEG_QUALITY)
                        .toOutputStream(baos);
                byte[] resizedBytes = baos.toByteArray();

                // 5% 이상 줄어든 경우만 덮어쓰기.
                if (resizedBytes.length < original.length * 0.95) {
                    bucket.create(blob.getName(), new ByteArrayInputStream(resizedBytes), contentType);
                    resized++;
                    bytesBefore += original.length;
                    bytesAfter += resizedBytes.length;
                } else {
                    skipped++;
                }
            } catch (Throwable t) {
                failed++;
                if (errors.size() < 10) {
                    errors.add(blob.getName() + ": " + t.getClass().getSimpleName() + ": " + t.getMessage());
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("folder", folder);
        result.put("processed", processed);
        result.put("resized", resized);
        result.put("skipped", skipped);
        result.put("failed", failed);
        result.put("bytesBefore", bytesBefore);
        result.put("bytesAfter", bytesAfter);
        result.put("savedMB", String.format("%.2f", (bytesBefore - bytesAfter) / 1024.0 / 1024.0));
        // 다음 페이지 있으면 토큰 반환 — 클라이언트가 이걸로 다음 호출.
        String nextToken = page.getNextPageToken();
        result.put("nextPageToken", nextToken == null ? "" : nextToken);
        if (!errors.isEmpty()) result.put("errors", errors);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/recipe-image")
    public ResponseEntity<Map<String, String>> uploadRecipeImage(
            @RequestParam("uid") String uid,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest req) throws IOException {
        try {
            // 관리자는 다른 유저(원작자) 명의로 레시피 이미지 업로드 가능
            if (!AuthContext.isAdmin(req)) {
                AuthContext.requireSelf(req, uid);
            } else {
                AuthContext.requireAuth(req);
            }
            String ext = validateAndExt(file, MAX_CONTENT_IMAGE_BYTES);
            String safeUid = uid.replace(':', '_').replace('/', '_');
            String fileName = "recipeImages/" + safeUid + "_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
            String url = uploadAndGetUrl(fileName, file, file.getContentType());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
