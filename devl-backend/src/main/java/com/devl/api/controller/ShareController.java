package com.devl.api.controller;

import com.devl.api.dto.UserDto;
import com.devl.api.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.concurrent.ExecutionException;

@RestController
@RequiredArgsConstructor
public class ShareController {

    private static final String APP_STORE_URL = "https://apps.apple.com/kr/app/%EC%9A%94%EC%9E%98%EC%95%8C/id6761661890";
    // Android 출시(2026-05-16) 이전에는 이 URL이 "앱 없음" 페이지로 응답하지만,
    // Android 광고를 안 돌리고 있어서 영향 미미. 출시 후 자동 정상화.
    private static final String PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.dyw.cookmate";

    private final UserService userService;
    private final com.devl.api.service.RecipeService recipeService;
    private final com.devl.api.service.CommunityService communityService;

    @GetMapping(value = "/profile/{uid}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> profilePage(@PathVariable String uid) throws ExecutionException, InterruptedException {
        UserDto user = userService.getByUid(uid);
        String nickname = user != null ? user.getNickname() : "요리사";
        String profileImage = user != null && user.getProfileImage() != null && !user.getProfileImage().isEmpty() && !user.getProfileImage().equals("default")
                ? user.getProfileImage()
                : "https://yojalal.com/img/default-profile.png";
        // recipeCount는 user 문서 캐시값이 안 맞는 케이스가 많아 두 컬렉션에서 직접 카운트.
        // (community 승인분 + recipes 관리자 등록분) — 앱의 게시물 카운트와 동일 기준.
        // 공유 페이지는 빈도 낮아 매번 쿼리해도 비용 부담 없음.
        int recipeCount = user != null
                ? communityService.countApprovedByAuthor(uid, user.getNickname())
                : 0;
        int totalLikes = user != null ? user.getTotalLikes() : 0;
        int followers = user != null && user.getFollowers() != null ? user.getFollowers().size() : 0;
        String appLink = "yojalal://profile/" + uid;
        String appleStoreLink = APP_STORE_URL;
        String playStoreLink = PLAY_STORE_URL;

        String html = """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta property="og:type" content="profile">
                    <meta property="og:site_name" content="요잘알">
                    <meta property="og:title" content="%s님의 프로필 - 요잘알">
                    <meta property="og:description" content="레시피 %d개 | 좋아요 %d개 | 팔로워 %d명">
                    <meta property="og:image" content="%s">
                    <meta property="og:image:width" content="600">
                    <meta property="og:image:height" content="600">
                    <meta name="twitter:card" content="summary_large_image">
                    <meta name="twitter:title" content="%s님의 프로필 - 요잘알">
                    <meta name="twitter:description" content="레시피 %d개 | 좋아요 %d개 | 팔로워 %d명">
                    <meta name="twitter:image" content="%s">
                    <title>%s님의 프로필 - 요잘알</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f8f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                        .card { background: #fff; border-radius: 20px; padding: 40px 32px; max-width: 360px; width: 90%%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
                        .avatar { width: 80px; height: 80px; border-radius: 50%%; object-fit: cover; margin-bottom: 16px; }
                        .nickname { font-size: 22px; font-weight: 800; color: #1A1A1A; margin-bottom: 4px; }
                        .welcome { font-size: 14px; color: #888; margin-bottom: 20px; }
                        .stats { display: flex; justify-content: center; gap: 24px; margin-bottom: 24px; }
                        .stat-item { text-align: center; }
                        .stat-num { font-size: 18px; font-weight: 700; color: #1A1A1A; }
                        .stat-label { font-size: 12px; color: #999; margin-top: 2px; }
                        .open-btn { display: block; width: 100%%; padding: 14px; border: none; border-radius: 12px; background: #0B9A61; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; text-decoration: none; }
                        .open-btn:active { opacity: 0.8; }
                        .sub { font-size: 12px; color: #bbb; margin-top: 12px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <img class="avatar" src="%s" alt="profile">
                        <div class="nickname">%s</div>
                        <div class="welcome">%s님의 공간에 오신 것을 환영합니다.</div>
                        <div class="stats">
                            <div class="stat-item"><div class="stat-num">%d</div><div class="stat-label">레시피</div></div>
                            <div class="stat-item"><div class="stat-num">%d</div><div class="stat-label">팔로워</div></div>
                            <div class="stat-item"><div class="stat-num">%d</div><div class="stat-label">좋아요</div></div>
                        </div>
                        <a class="open-btn" id="openApp" href="%s">앱에서 보기</a>
                        <div class="sub">요잘알 앱이 필요합니다</div>
                    </div>
                    <script>
                        var appUrl = '%s';
                        var appStoreUrl = '%s';
                        var playStoreUrl = '%s';
                        var ua = navigator.userAgent.toLowerCase();
                        var isKakao = ua.indexOf('kakaotalk') > -1;
                        var isAndroid = ua.indexOf('android') > -1;
                        var isIOS = /iphone|ipad|ipod/.test(ua);
                        // Android면 Play Store, 그 외(iOS·데스크톱)는 App Store로 fallback
                        var storeUrl = isAndroid ? playStoreUrl : appStoreUrl;

                        function openApp() {
                            if (isKakao) {
                                // 카카오톡 인앱 브라우저 → 외부 브라우저로 열기
                                if (isAndroid) {
                                    location.href = 'intent://profile/' + appUrl.split('/profile/')[1] + '#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';
                                } else {
                                    location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
                                }
                            } else if (isAndroid) {
                                location.href = 'intent://profile/' + appUrl.split('/profile/')[1] + '#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=' + encodeURIComponent(storeUrl) + ';end';
                            } else {
                                location.href = appUrl;
                                setTimeout(function() { location.href = storeUrl; }, 1500);
                            }
                        }

                        // 페이지 로드 시 자동 시도
                        if (!isKakao) { setTimeout(openApp, 300); }

                        document.getElementById('openApp').addEventListener('click', function(e) {
                            e.preventDefault();
                            openApp();
                        });
                    </script>
                </body>
                </html>
                """.formatted(
                nickname, recipeCount, totalLikes, followers, profileImage,
                nickname, recipeCount, totalLikes, followers, profileImage,
                nickname,
                profileImage, nickname, nickname,
                recipeCount, followers, totalLikes,
                appLink, appLink, appleStoreLink, playStoreLink
        );

        return ResponseEntity.ok(html);
    }

    @GetMapping(value = "/recipe/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> recipePage(@PathVariable String id) {
        // 1) 데이터 로드 — 일반 레시피 우선, 없으면 커뮤니티에서 시도.
        RecipeView v = loadRecipeView(id);
        if (v == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .contentType(MediaType.TEXT_HTML)
                    .body(renderNotFoundPage(id));
        }

        // 2) 본문 섹션 HTML 구성
        String ingredientsHtml = renderIngredients(v.ingredients);
        String stepsHtml = renderSteps(v.steps);
        String tagsHtml = renderTags(v.tags);
        String descSafe = htmlEscape(v.description != null && !v.description.isBlank() ? v.description : "");

        // 3) Schema.org Recipe JSON-LD — 구글 검색 결과 리치 스니펫 (별점·시간·칼로리 카드)
        String jsonLd = buildRecipeJsonLd(v, id);

        String metaLine = String.format("%s분 · %s · %dkcal · %s인분",
                formatTime(v.timeMinutes),
                v.difficulty != null ? v.difficulty : "쉬움",
                v.calories,
                v.servings);
        String shortDesc = (v.description != null && !v.description.isBlank())
                ? truncate(stripHtml(v.description), 150)
                : metaLine;

        String appLink = "yojalal://recipe/" + id;
        String canonical = "https://yojalal.com/recipe/" + id;

        String difficultyColor = switch (v.difficulty == null ? "" : v.difficulty) {
            case "쉬움" -> "#1BAE74";
            case "어려움" -> "#E74C3C";
            default -> "#F5A623";
        };

        String html = """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
                    <meta name="theme-color" content="#0B9A61">
                    <meta name="description" content="%s">
                    <link rel="canonical" href="%s">
                    <meta property="og:type" content="article">
                    <meta property="og:site_name" content="요잘알">
                    <meta property="og:title" content="%s - 요잘알">
                    <meta property="og:description" content="%s">
                    <meta property="og:image" content="%s">
                    <meta property="og:image:width" content="1200">
                    <meta property="og:image:height" content="630">
                    <meta property="og:url" content="%s">
                    <meta name="twitter:card" content="summary_large_image">
                    <meta name="twitter:title" content="%s - 요잘알">
                    <meta name="twitter:description" content="%s">
                    <meta name="twitter:image" content="%s">
                    <meta name="apple-itunes-app" content="app-id=6761661890">
                    <link rel="icon" type="image/png" href="/img/app-icon.png">
                    <title>%s 레시피 - 요잘알</title>
                    <script type="application/ld+json">%s</script>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
                        html, body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Pretendard', sans-serif; color: #1A1A1A; }
                        body { background: #f8f8f8; padding-bottom: 100px; }
                        .page { max-width: 560px; margin: 0 auto; background: #fff; min-height: 100vh; box-shadow: 0 0 24px rgba(0,0,0,0.04); }
                        .topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.96); backdrop-filter: blur(8px); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0f0f0; }
                        .topbar a.logo { font-weight: 800; color: #0B9A61; font-size: 18px; text-decoration: none; letter-spacing: -0.3px; }
                        .topbar .open-mini { font-size: 13px; font-weight: 700; color: #0B9A61; background: #F0FAF5; padding: 8px 14px; border-radius: 999px; text-decoration: none; }
                        .hero { width: 100%%; aspect-ratio: 4/3; object-fit: cover; background: #eee; display: block; }
                        .content { padding: 22px 22px 32px; }
                        .title { font-size: 24px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.3; margin-bottom: 14px; }
                        .stat-row { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 18px; font-size: 14px; color: #555; }
                        .stat-row .stat { display: inline-flex; align-items: center; gap: 4px; }
                        .stat-row .star { color: #FFB800; }
                        .stat-row .heart { color: #FF4D67; }
                        .author { display: flex; align-items: center; gap: 8px; padding: 12px 0; border-top: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #555; }
                        .author .avatar { width: 28px; height: 28px; border-radius: 50%%; background: #F0FAF5; color: #0B9A61; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
                        .info-row { display: grid; grid-template-columns: repeat(4, 1fr); padding: 18px 0; margin-bottom: 8px; }
                        .info-item { text-align: center; }
                        .info-num { font-size: 18px; font-weight: 800; color: #1A1A1A; line-height: 1.2; }
                        .info-num .unit { font-size: 11px; font-weight: 600; color: #999; margin-left: 1px; }
                        .info-label { font-size: 11px; color: #999; margin-top: 4px; letter-spacing: 0.2px; }
                        .info-diff { color: %s; }
                        .section { margin-top: 28px; }
                        .section-title { font-size: 17px; font-weight: 800; margin-bottom: 14px; color: #1A1A1A; }
                        .desc { font-size: 14.5px; line-height: 1.65; color: #444; }
                        .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
                        .tag { font-size: 12px; font-weight: 600; color: #0B9A61; background: #F0FAF5; padding: 5px 10px; border-radius: 999px; }
                        .ingredient { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed #eee; font-size: 14.5px; }
                        .ingredient:last-child { border-bottom: none; }
                        .ingredient .name { color: #1A1A1A; font-weight: 600; }
                        .ingredient .amount { color: #777; font-weight: 500; }
                        .step { display: flex; gap: 14px; margin-bottom: 22px; }
                        .step-num { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%%; background: #0B9A61; color: #fff; font-weight: 800; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; }
                        .step-body { flex: 1; }
                        .step-photo { width: 100%%; aspect-ratio: 4/3; object-fit: cover; border-radius: 14px; background: #f0f0f0; margin-bottom: 10px; }
                        .step-desc { font-size: 14.5px; line-height: 1.65; color: #1A1A1A; margin-bottom: 6px; }
                        .step-time { font-size: 12px; color: #999; }
                        .cta-banner { position: fixed; left: 0; right: 0; bottom: 0; background: #fff; border-top: 1px solid #eee; padding: 14px 22px calc(14px + env(safe-area-inset-bottom)); display: flex; justify-content: center; }
                        .cta-banner-inner { max-width: 560px; width: 100%%; display: flex; gap: 10px; align-items: center; }
                        .cta-msg { flex: 1; }
                        .cta-msg b { font-size: 13.5px; font-weight: 800; display: block; color: #1A1A1A; }
                        .cta-msg span { font-size: 11.5px; color: #999; }
                        .cta-btn { padding: 13px 22px; background: #0B9A61; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 800; text-decoration: none; box-shadow: 0 6px 16px rgba(11,154,97,0.25); flex-shrink: 0; }
                        .cta-btn:active { transform: translateY(1px); }
                        .footer { padding: 32px 22px; text-align: center; font-size: 11.5px; color: #aaa; line-height: 1.6; }
                        .footer a { color: #888; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="page">
                        <header class="topbar">
                            <a class="logo" href="/">요잘알</a>
                            <a class="open-mini" href="%s" id="openMini">앱에서 열기</a>
                        </header>
                        <img class="hero" src="%s" alt="%s" loading="eager">
                        <main class="content">
                            <h1 class="title">%s</h1>
                            <div class="stat-row">
                                <span class="stat"><span class="star">★</span> %s</span>
                                <span class="stat"><span class="heart">♥</span> %d</span>
                            </div>
                            <div class="author">
                                <span class="avatar">%s</span>
                                <span>%s</span>
                            </div>
                            <div class="info-row">
                                <div class="info-item">
                                    <div class="info-num">%s<span class="unit">분</span></div>
                                    <div class="info-label">시간</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-num info-diff">%s</div>
                                    <div class="info-label">난이도</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-num">%d<span class="unit">kcal</span></div>
                                    <div class="info-label">칼로리</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-num">%s<span class="unit">인분</span></div>
                                    <div class="info-label">분량</div>
                                </div>
                            </div>
                            <section class="section">
                                <h2 class="section-title">소개</h2>
                                <p class="desc">%s</p>
                                %s
                            </section>
                            <section class="section">
                                <h2 class="section-title">재료</h2>
                                %s
                            </section>
                            <section class="section">
                                <h2 class="section-title">조리 순서</h2>
                                %s
                            </section>
                        </main>
                        <div class="footer">
                            요잘알 · 매일 뭐 먹지? 고민 끝.<br>
                            <a href="/">yojalal.com</a> · <a href="/privacy">개인정보처리방침</a> · <a href="/terms">이용약관</a>
                        </div>
                    </div>
                    <div class="cta-banner">
                        <div class="cta-banner-inner">
                            <div class="cta-msg">
                                <b>앱에서 음성 모드로 더 편하게</b>
                                <span>단계별 자동 타이머 · 손 없이 요리</span>
                            </div>
                            <a class="cta-btn" href="%s" id="openCta">앱 열기</a>
                        </div>
                    </div>
                    <script>
                        var appUrl = '%s';
                        var appStoreUrl = '%s';
                        var playStoreUrl = '%s';
                        var ua = navigator.userAgent.toLowerCase();
                        var isKakao = ua.indexOf('kakaotalk') > -1;
                        var isAndroid = ua.indexOf('android') > -1;
                        var isIOS = /iphone|ipad|ipod/.test(ua);
                        var storeUrl = isAndroid ? playStoreUrl : appStoreUrl;
                        function openApp() {
                            if (isKakao) {
                                if (isAndroid) {
                                    location.href = 'intent://recipe/' + appUrl.split('/recipe/')[1] + '#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';
                                } else {
                                    location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
                                }
                            } else if (isAndroid) {
                                location.href = 'intent://recipe/' + appUrl.split('/recipe/')[1] + '#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=' + encodeURIComponent(storeUrl) + ';end';
                            } else {
                                location.href = appUrl;
                                setTimeout(function() {
                                    // 데스크톱/iOS에서 1.5초 안에 앱이 안 열리면 스토어로
                                    if (document.visibilityState !== 'hidden') location.href = storeUrl;
                                }, 1500);
                            }
                        }
                        function bindOpen(el) {
                            if (!el) return;
                            el.addEventListener('click', function(e) { e.preventDefault(); openApp(); });
                        }
                        bindOpen(document.getElementById('openMini'));
                        bindOpen(document.getElementById('openCta'));
                    </script>
                </body>
                </html>
                """.formatted(
                shortDesc, canonical,
                v.title, shortDesc, v.image, canonical,
                v.title, shortDesc, v.image,
                v.title,
                jsonLd,
                difficultyColor,
                appLink, v.image, v.title,
                v.title,
                v.rating > 0 ? String.format("%.1f", v.rating) : "0.0", v.likes,
                authorInitial(v.author), htmlEscape(v.author),
                formatTime(v.timeMinutes),
                v.difficulty != null ? v.difficulty : "쉬움",
                v.calories,
                v.servings,
                descSafe, tagsHtml,
                ingredientsHtml,
                stepsHtml,
                appLink,
                appLink, APP_STORE_URL, PLAY_STORE_URL
        );

        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=300, s-maxage=600")
                .body(html);
    }

    // ===== Recipe SSR helpers =====

    /** SSR용 통합 뷰 모델 — 일반 레시피와 커뮤니티 레시피의 공통 필드만 추림. */
    private static class RecipeView {
        String title;
        String image;
        String author;
        String description;
        String difficulty;
        double timeMinutes;
        int calories;
        String servings; // String으로 통일 (1, 2~3 등)
        double rating;
        int likes;
        java.util.List<String> tags = java.util.Collections.emptyList();
        java.util.List<IngredientView> ingredients = java.util.Collections.emptyList();
        java.util.List<StepView> steps = java.util.Collections.emptyList();
        String source; // "recipe" or "community"
    }

    private static class IngredientView {
        String name;
        String amount;
        IngredientView(String n, String a) { name = n; amount = a; }
    }

    private static class StepView {
        int number;
        String description;
        double time;
        String imageUrl;
        boolean isAi;
    }

    private RecipeView loadRecipeView(String id) {
        // 일반 레시피 우선
        try {
            com.devl.api.dto.RecipeDto r = recipeService.getRecipeById(id);
            if (r != null && r.getTitle() != null) {
                RecipeView v = new RecipeView();
                v.title = r.getTitle();
                v.image = (r.getImage() != null && !r.getImage().isEmpty()) ? r.getImage()
                        : "https://yojalal.com/img/app-icon.png";
                v.author = r.getAuthor() != null ? r.getAuthor() : "요잘알";
                v.description = r.getDescription();
                v.difficulty = r.getDifficulty();
                v.timeMinutes = r.getTime();
                v.calories = r.getCalories();
                v.servings = String.valueOf(r.getServings() != null ? r.getServings() : "1");
                v.rating = r.getRating();
                v.likes = r.getLikes();
                if (r.getTags() != null) v.tags = r.getTags();
                if (r.getIngredients() != null) {
                    v.ingredients = r.getIngredients().stream()
                            .map(i -> new IngredientView(i.getName(), i.getAmount()))
                            .toList();
                }
                if (r.getSteps() != null) {
                    v.steps = r.getSteps().stream().map(s -> {
                        StepView sv = new StepView();
                        sv.number = s.getStep();
                        sv.description = s.getDescription();
                        sv.time = s.getTime();
                        sv.imageUrl = s.getImageUrl();
                        sv.isAi = Boolean.TRUE.equals(s.getIsAiImage());
                        return sv;
                    }).toList();
                }
                v.source = "recipe";
                return v;
            }
        } catch (Exception ignore) {}

        // 커뮤니티 레시피 fallback
        try {
            com.devl.api.dto.CommunityRecipeDto c = communityService.getById(id);
            if (c != null && c.getTitle() != null) {
                RecipeView v = new RecipeView();
                v.title = c.getTitle();
                v.image = (c.getImage() != null && !c.getImage().isEmpty()) ? c.getImage()
                        : "https://yojalal.com/img/app-icon.png";
                v.author = c.getAuthor() != null ? c.getAuthor() : "회원";
                v.description = c.getDescription();
                v.difficulty = c.getDifficulty();
                v.timeMinutes = c.getTime();
                v.calories = c.getCalories();
                v.servings = String.valueOf(c.getServings() != null ? c.getServings() : "1");
                v.likes = c.getLikes();
                if (c.getIngredients() != null) {
                    v.ingredients = c.getIngredients().stream()
                            .map(i -> new IngredientView(i.getName(), i.getAmount()))
                            .toList();
                }
                if (c.getSteps() != null) {
                    java.util.List<StepView> stepList = new java.util.ArrayList<>();
                    int idx = 1;
                    for (var s : c.getSteps()) {
                        StepView sv = new StepView();
                        sv.number = idx++;
                        sv.description = s.getDescription();
                        sv.time = s.getTime();
                        sv.imageUrl = s.getImageUrl();
                        sv.isAi = Boolean.TRUE.equals(s.getIsAiImage());
                        stepList.add(sv);
                    }
                    v.steps = stepList;
                }
                v.source = "community";
                return v;
            }
        } catch (Exception ignore) {}

        return null;
    }

    private String renderIngredients(java.util.List<IngredientView> list) {
        if (list == null || list.isEmpty()) return "<p style=\"color:#999;font-size:14px;\">재료 정보가 없습니다.</p>";
        StringBuilder sb = new StringBuilder();
        for (IngredientView i : list) {
            sb.append("<div class=\"ingredient\"><span class=\"name\">")
              .append(htmlEscape(i.name != null ? i.name : ""))
              .append("</span><span class=\"amount\">")
              .append(htmlEscape(i.amount != null ? i.amount : ""))
              .append("</span></div>");
        }
        return sb.toString();
    }

    private String renderSteps(java.util.List<StepView> list) {
        if (list == null || list.isEmpty()) return "<p style=\"color:#999;font-size:14px;\">조리 순서 정보가 없습니다.</p>";
        StringBuilder sb = new StringBuilder();
        for (StepView s : list) {
            sb.append("<div class=\"step\"><div class=\"step-num\">")
              .append(s.number)
              .append("</div><div class=\"step-body\">");
            if (s.imageUrl != null && !s.imageUrl.isBlank() && !s.imageUrl.startsWith("file://")) {
                sb.append("<img class=\"step-photo\" src=\"")
                  .append(htmlEscapeAttr(s.imageUrl))
                  .append("\" alt=\"step ").append(s.number).append("\" loading=\"lazy\">");
            }
            sb.append("<p class=\"step-desc\">")
              .append(htmlEscape(s.description != null ? s.description : ""))
              .append("</p>");
            if (s.time > 0) {
                String t = s.time >= 1 ? formatTime(s.time) + "분" : Math.round(s.time * 60) + "초";
                sb.append("<div class=\"step-time\">⏱ ").append(t).append("</div>");
            }
            sb.append("</div></div>");
        }
        return sb.toString();
    }

    private String renderTags(java.util.List<String> tags) {
        if (tags == null || tags.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("<div class=\"tags\">");
        for (String t : tags) {
            sb.append("<span class=\"tag\">#").append(htmlEscape(t)).append("</span>");
        }
        sb.append("</div>");
        return sb.toString();
    }

    private String buildRecipeJsonLd(RecipeView v, String id) {
        StringBuilder ing = new StringBuilder();
        for (int i = 0; i < v.ingredients.size(); i++) {
            IngredientView it = v.ingredients.get(i);
            if (i > 0) ing.append(",");
            ing.append("\"").append(jsonEscape(
                    (it.name != null ? it.name : "") + " " + (it.amount != null ? it.amount : "")
            ).trim()).append("\"");
        }
        StringBuilder steps = new StringBuilder();
        for (int i = 0; i < v.steps.size(); i++) {
            StepView s = v.steps.get(i);
            if (i > 0) steps.append(",");
            steps.append("{\"@type\":\"HowToStep\",\"position\":").append(s.number)
                 .append(",\"text\":\"").append(jsonEscape(s.description != null ? s.description : "")).append("\"}");
        }
        String totalTime = "PT" + Math.max(1, (int) Math.round(v.timeMinutes)) + "M";
        StringBuilder sb = new StringBuilder();
        sb.append("{\"@context\":\"https://schema.org/\",\"@type\":\"Recipe\",")
          .append("\"name\":\"").append(jsonEscape(v.title)).append("\",")
          .append("\"image\":[\"").append(jsonEscape(v.image)).append("\"],")
          .append("\"author\":{\"@type\":\"Person\",\"name\":\"").append(jsonEscape(v.author)).append("\"},")
          .append("\"description\":\"").append(jsonEscape(v.description != null ? truncate(stripHtml(v.description), 200) : v.title + " 레시피")).append("\",")
          .append("\"recipeCategory\":\"한식\",")
          .append("\"recipeCuisine\":\"한식\",")
          .append("\"totalTime\":\"").append(totalTime).append("\",")
          .append("\"recipeYield\":\"").append(jsonEscape(v.servings)).append("인분\",")
          .append("\"nutrition\":{\"@type\":\"NutritionInformation\",\"calories\":\"").append(v.calories).append(" kcal\"},")
          .append("\"recipeIngredient\":[").append(ing).append("],")
          .append("\"recipeInstructions\":[").append(steps).append("],")
          .append("\"url\":\"https://yojalal.com/recipe/").append(id).append("\"");
        if (v.rating > 0) {
            sb.append(",\"aggregateRating\":{\"@type\":\"AggregateRating\",\"ratingValue\":\"")
              .append(String.format("%.1f", v.rating)).append("\",\"reviewCount\":\"")
              .append(Math.max(1, v.likes)).append("\"}");
        }
        sb.append("}");
        return sb.toString();
    }

    private String renderNotFoundPage(String id) {
        return """
                <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
                <title>레시피를 찾을 수 없습니다 - 요잘알</title>
                <meta name="robots" content="noindex">
                <style>body{font-family:-apple-system,sans-serif;background:#f8f8f8;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;}
                .box{background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:360px;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
                h1{font-size:18px;margin-bottom:8px;color:#1A1A1A;}p{color:#888;font-size:14px;margin-bottom:24px;}
                a{display:inline-block;background:#0B9A61;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;}</style>
                </head><body><div class="box"><h1>레시피를 찾을 수 없습니다</h1><p>삭제되었거나 잘못된 링크일 수 있어요.</p>
                <a href="/">요잘알 홈으로</a></div></body></html>
                """;
    }

    // ===== 텍스트 유틸 =====

    private static String htmlEscape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private static String htmlEscapeAttr(String s) {
        return htmlEscape(s);
    }

    private static String jsonEscape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private static String stripHtml(String s) {
        if (s == null) return "";
        return s.replaceAll("<[^>]+>", "").replaceAll("\\s+", " ").trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        s = s.trim();
        if (s.length() <= max) return s;
        return s.substring(0, max - 1) + "…";
    }

    private static String authorInitial(String name) {
        if (name == null || name.isEmpty()) return "?";
        return name.substring(0, 1).toUpperCase();
    }

    private static String formatTime(double t) {
        if (t == Math.floor(t)) return String.valueOf((int) t);
        return String.valueOf(t);
    }

    /**
     * Android App Links 검증.
     * 여러 인증서 fingerprint를 배열로 등록 가능.
     *  - 기존 값 FA:C6:17:...  : dev/preview 빌드
     *  - E5:B6:D1:AA:...        : EAS production 빌드 (eas credentials 기준)
     *  - (추후) Google Play App Signing 값: 첫 Play 업로드 후 Play Console
     *    → 앱 무결성 → 앱 서명 → SHA-256 복사해서 추가.
     */
    @GetMapping(value = "/.well-known/assetlinks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> assetLinks() {
        String json = """
                [{
                  "relation": ["delegate_permission/common.handle_all_urls"],
                  "target": {
                    "namespace": "android_app",
                    "package_name": "com.dyw.cookmate",
                    "sha256_cert_fingerprints": [
                      "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C",
                      "E5:B6:D1:AA:73:7D:C4:19:47:CE:B6:82:26:6C:6F:B0:CF:E2:95:4E:6A:03:E3:CB:EA:2D:7A:74:EF:A2:94:48"
                    ]
                  }
                }]
                """;
        return ResponseEntity.ok(json);
    }

    /**
     * AdMob app-ads.txt — 광고 사기 방지(IAB Tech Lab 표준).
     * App Store Connect의 "마케팅 URL"에 등록된 도메인(yojalal.com)에 이 파일이 있어야
     * AdMob이 앱 소유자를 검증한다.
     */
    @GetMapping(value = "/app-ads.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> appAdsTxt() {
        String content = "google.com, pub-8542314434357214, DIRECT, f08c47fec0942fa0\n";
        return ResponseEntity.ok(content);
    }

    /**
     * robots.txt — 크롤러에게 모든 경로 허용 명시.
     * 기본 응답이 JSON 에러였던 탓에 AdMob 크롤러가 "robots.txt에 의해 차단됨"으로 잘못 판단해
     * app-ads.txt 인증이 실패하던 문제를 해결.
     *
     * AdsBot-Google은 wildcard(User-agent: *) 규칙을 무시하므로 명시적으로 허용해야 한다.
     * Mediapartners-Google(AdSense), Googlebot도 함께 명시.
     */
    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> robotsTxt() {
        String content = """
                User-agent: *
                Allow: /

                User-agent: AdsBot-Google
                Allow: /

                User-agent: AdsBot-Google-Mobile
                Allow: /

                User-agent: Mediapartners-Google
                Allow: /

                User-agent: Googlebot
                Allow: /

                Sitemap: https://yojalal.com/sitemap.xml
                """;
        return ResponseEntity.ok(content);
    }

    /**
     * sitemap.xml — 검색엔진에 모든 레시피 URL을 일괄 알림. Google Search Console에 제출하면
     * 색인 속도가 크게 빨라짐. 일반 레시피 + 승인된 커뮤니티 레시피 모두 포함.
     * 비용 보호: Firestore 전체 스캔이라 결과 크면 비싸짐 → recipes 컬렉션 limit 캡 적용 (RecipeService 기본값 사용).
     */
    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
          .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // 정적 페이지
        appendUrl(sb, "https://yojalal.com/", "daily", "1.0");
        appendUrl(sb, "https://yojalal.com/privacy", "yearly", "0.3");
        appendUrl(sb, "https://yojalal.com/terms", "yearly", "0.3");

        // 카테고리 페이지
        for (String[] c : CATEGORIES) {
            String encoded = java.net.URLEncoder.encode(c[0], java.nio.charset.StandardCharsets.UTF_8);
            appendUrl(sb, "https://yojalal.com/category/" + encoded, "daily", "0.9");
        }

        // 일반 레시피 (관리자 등록)
        try {
            for (com.devl.api.dto.RecipeDto r : recipeService.getAllRecipes()) {
                if (r.getId() != null && !r.getId().isEmpty()) {
                    appendUrl(sb, "https://yojalal.com/recipe/" + r.getId(), "weekly", "0.8");
                }
            }
        } catch (Exception ignore) {}

        // 커뮤니티 승인 레시피
        try {
            for (com.devl.api.dto.CommunityRecipeDto c : communityService.getAll()) {
                if (c.getId() != null && !c.getId().isEmpty() && "approved".equals(c.getStatus())) {
                    appendUrl(sb, "https://yojalal.com/recipe/" + c.getId(), "weekly", "0.6");
                }
            }
        } catch (Exception ignore) {}

        sb.append("</urlset>\n");
        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=3600")
                .body(sb.toString());
    }

    private static void appendUrl(StringBuilder sb, String loc, String changefreq, String priority) {
        sb.append("  <url>\n    <loc>").append(loc).append("</loc>\n")
          .append("    <changefreq>").append(changefreq).append("</changefreq>\n")
          .append("    <priority>").append(priority).append("</priority>\n  </url>\n");
    }

    /**
     * 법적 문서 / 지원 페이지 redirect — 외부에 노출되는 깔끔한 URL을 제공.
     * Notion URL이 변경되거나 자체 호스팅으로 이전해도 외부 링크(스토어 등록·앱 내 안내) 변경 불필요.
     * 약관 개정 시 Notion 콘텐츠만 수정하면 모든 외부 링크에 자동 반영.
     */
    @GetMapping("/privacy")
    public ResponseEntity<Void> privacyRedirect() {
        return redirect("https://tame-impatiens-537.notion.site/349265f9e0178008a026f1bf668df65e");
    }

    @GetMapping("/terms")
    public ResponseEntity<Void> termsRedirect() {
        return redirect("https://tame-impatiens-537.notion.site/349265f9e01780a6bf15ed0a3edf22b1");
    }

    @GetMapping("/account-deletion")
    public ResponseEntity<Void> accountDeletionRedirect() {
        return redirect("https://tame-impatiens-537.notion.site/34f265f9e017807ca0feeb2b4f113e23");
    }

    @GetMapping("/support")
    public ResponseEntity<Void> supportRedirect() {
        return redirect("https://tame-impatiens-537.notion.site/349265f9e0178073942fe8abc39c3d31");
    }

    private ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    /** iOS Universal Links 검증 */
    @GetMapping(value = "/.well-known/apple-app-site-association", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> appleAppSiteAssociation() {
        // Apple Team ID는 Apple Developer 계정에서 확인 후 교체
        String json = """
                {
                  "applinks": {
                    "apps": [],
                    "details": [
                      {
                        "appID": "3KFNM7FFCJ.com.dyw.cookmate",
                        "paths": ["/profile/*", "/recipe/*"]
                      }
                    ]
                  }
                }
                """;
        return ResponseEntity.ok(json);
    }

    @GetMapping(value = "/about", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> aboutPage() {
        String html = """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>요잘알 - 서비스 소개</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f8f8; color: #1A1A1A; }
                        .hero { background: linear-gradient(135deg, #0B9A61, #078a55); color: #fff; padding: 60px 24px; text-align: center; }
                        .hero img { width: 80px; height: 80px; border-radius: 20px; margin-bottom: 16px; }
                        .hero h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
                        .hero p { font-size: 16px; opacity: 0.9; }
                        .container { max-width: 720px; margin: 0 auto; padding: 40px 24px; }
                        .section { margin-bottom: 40px; }
                        .section h2 { font-size: 20px; font-weight: 800; margin-bottom: 16px; color: #0B9A61; border-bottom: 2px solid #0B9A61; padding-bottom: 8px; display: inline-block; }
                        .section p, .section li { font-size: 15px; line-height: 1.8; color: #333; }
                        .section ul { padding-left: 20px; }
                        .section li { margin-bottom: 6px; }
                        .screenshots { display: flex; gap: 12px; overflow-x: auto; padding: 16px 0; }
                        .screenshots img { width: 200px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); flex-shrink: 0; }
                        .info-table { width: 100%%; border-collapse: collapse; }
                        .info-table td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
                        .info-table td:first-child { font-weight: 700; color: #555; width: 120px; white-space: nowrap; }
                        .badge { display: inline-block; background: #0B9A61; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-top: 8px; }
                        .channel-info { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); margin-top: 20px; }
                        .channel-info h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
                        .footer { text-align: center; padding: 32px 24px; color: #999; font-size: 12px; border-top: 1px solid #eee; margin-top: 40px; }
                    </style>
                </head>
                <body>
                    <div class="hero">
                        <h1>TwentyVI</h1>
                        <p>트웬티식스 — IT 서비스 개발 및 운영</p>
                    </div>

                    <div class="container">
                        <div class="section">
                            <h2>회사 소개</h2>
                            <p>
                                <strong>트웬티식스 (TwentyVI)</strong>는 모바일 앱 개발 및 IT 서비스를 운영하는 기업입니다.
                                사용자 중심의 서비스를 기획·개발·운영하며, 지속적으로 새로운 서비스를 선보이고 있습니다.
                            </p>
                        </div>

                        <div class="section">
                            <h2>운영 서비스</h2>
                            <div class="channel-info">
                                <h3>🍳 요잘알 — 요리 레시피 앱</h3>
                                <p>누구나 쉽게 요리를 배우고, 나만의 레시피를 공유하며, 포인트를 모아 기프티콘으로 교환할 수 있는 요리 커뮤니티 앱</p>
                                <br>
                                <ul>
                                    <li>카테고리별 레시피 탐색 (아침/점심/저녁/디저트/간식/음료)</li>
                                    <li>단계별 요리 모드 (타이머, 음성 안내)</li>
                                    <li>커뮤니티 레시피 등록, 후기 작성, 팔로우</li>
                                    <li>포인트 적립 및 기프티콘 교환</li>
                                </ul>
                                <br>
                                <p>• 플랫폼: iOS (Apple TestFlight 공개 테스트 중)</p>
                                <p>• 앱 번들 ID: com.dyw.cookmate</p>
                            </div>
                        </div>

                        <div class="section">
                            <h2>카카오 채널 운영 목적</h2>
                            <p>
                                카카오 채널 <strong>'TwentyVI'</strong>는 트웬티식스의 <strong>공식 고객센터 채널</strong>로,
                                자사 서비스 전반에 대해 아래 목적으로 운영됩니다.
                            </p>
                            <br>
                            <ul>
                                <li>자사 서비스 업데이트 및 공지사항 안내</li>
                                <li>이벤트 및 프로모션 소식 발행</li>
                                <li>고객 문의 및 피드백 수렴</li>
                                <li>카카오 로그인 및 카카오톡 공유 기능 연동</li>
                            </ul>
                            <div class="channel-info">
                                <h3>채널 연관성 증빙</h3>
                                <p>• 카카오 채널명: <strong>TwentyVI</strong></p>
                                <p>• 사업자명: <strong>트웬티식스 (TwentyVI)</strong></p>
                                <p>• 채널 = 사업자명 영문 표기와 동일</p>
                                <p>• 카카오 앱 키: <strong>4e6d0defa8992e8a7c49029d2f95ffb6</strong></p>
                                <p>• 사업자등록번호: <strong>471-16-02759</strong></p>
                                <span class="badge">사업자(트웬티식스) = 채널(TwentyVI) 동일 사업체</span>
                            </div>
                        </div>

                        <div class="section">
                            <h2>사업자 정보</h2>
                            <table class="info-table">
                                <tr><td>상호</td><td>트웬티식스 (TwentyVI)</td></tr>
                                <tr><td>대표자</td><td>우동엽</td></tr>
                                <tr><td>사업자등록번호</td><td>471-16-02759</td></tr>
                                <tr><td>업태/종목</td><td>정보통신업 / 앱 개발 및 서비스</td></tr>
                                <tr><td>사업장 소재지</td><td>경기도 이천시 증신로291번길 119-3, 302호</td></tr>
                                <tr><td>연락처</td><td>dongyeopwoo1@gmail.com</td></tr>
                                <tr><td>통신판매업</td><td>간이과세자 면제 대상</td></tr>
                            </table>
                        </div>
                    </div>

                    <div class="footer">
                        &copy; 2025-2026 트웬티식스 TwentyVI (대표: 우동엽)<br>
                        사업자등록번호: 471-16-02759 | dongyeopwoo1@gmail.com
                    </div>
                </body>
                </html>
                """;

        return ResponseEntity.ok(html);
    }

    // 루트 도메인(yojalal.com) 접속 시 레시피 중심의 홈 노출 (SEO 타겟).
    // 기존 링크트리 스타일 랜딩은 /yojalal 에서 그대로 접근 가능.
    @GetMapping(value = "/", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> rootLanding() {
        return homePage();
    }

    /**
     * 레시피 카테고리 정의 — 앱의 HOME_CATEGORIES 와 동일 순서. [이름, 아이콘 파일명].
     * 아이콘 PNG는 backend/src/main/resources/static/img/ 에 배치되어 /img/ 경로로 서빙됨.
     */
    private static final java.util.List<String[]> CATEGORIES = java.util.List.of(
            new String[]{"아침",   "breakfast.png"},
            new String[]{"점심",   "lunch.png"},
            new String[]{"저녁",   "dinner.png"},
            new String[]{"디저트", "dessert.png"},
            new String[]{"간식",   "snack.png"},
            new String[]{"음료",   "drink.png"},
            new String[]{"야식",   "midnight.png"},
            new String[]{"분식",   "street-food.png"},
            new String[]{"한식",   "korean.png"},
            new String[]{"양식",   "western.png"}
    );

    /** 레시피 중심 홈 — 카테고리 그리드 + 인기 레시피 + 앱 설치 CTA. SEO 메인 페이지. */
    public ResponseEntity<String> homePage() {
        // 인기 레시피 = 좋아요 내림차순 상위 12개. 비용 보호: 일반 레시피만, 전체 스캔 후 정렬.
        java.util.List<com.devl.api.dto.RecipeDto> popular = java.util.Collections.emptyList();
        try {
            popular = recipeService.getAllRecipes().stream()
                    .sorted((a, b) -> Integer.compare(b.getLikes(), a.getLikes()))
                    .limit(12)
                    .toList();
        } catch (Exception ignore) {}

        String categoryGrid = renderCategoryGrid();
        String popularGrid = renderRecipeCardGrid(popular);

        String html = """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
                    <meta name="theme-color" content="#0B9A61">
                    <meta name="description" content="오늘 뭐 먹지? 고민 끝. 10개 카테고리 검증 레시피와 단계별 자동 타이머로 요리 초보도 실패 없이.">
                    <link rel="canonical" href="https://yojalal.com/">
                    <meta property="og:type" content="website">
                    <meta property="og:site_name" content="요잘알">
                    <meta property="og:title" content="요잘알 — 오늘 뭐 먹지? 매일의 레시피 고민 끝">
                    <meta property="og:description" content="10개 카테고리 검증 레시피, AI 메뉴 추천, 단계별 자동 타이머. 누구나 쉽게 따라하는 집밥 레시피.">
                    <meta property="og:image" content="https://yojalal.com/img/app-icon.png">
                    <meta property="og:url" content="https://yojalal.com/">
                    <meta name="twitter:card" content="summary_large_image">
                    <meta name="twitter:title" content="요잘알 — 오늘 뭐 먹지? 매일의 레시피 고민 끝">
                    <meta name="twitter:description" content="10개 카테고리 검증 레시피, AI 메뉴 추천.">
                    <meta name="twitter:image" content="https://yojalal.com/img/app-icon.png">
                    <link rel="icon" type="image/png" href="/img/app-icon.png">
                    <title>요잘알 — 오늘 뭐 먹지? 매일의 레시피 고민 끝</title>
                    %s
                </head>
                <body>
                    <div class="page">
                        %s
                        <main class="content">
                            <section class="hero">
                                <h1 class="hero-title">오늘 뭐 먹지?<br><span class="hero-accent">고민, 이제 끝.</span></h1>
                                <p class="hero-sub">10개 카테고리 검증 레시피와<br>단계별 자동 타이머로 누구나 쉽게.</p>
                            </section>
                            <section class="section">
                                <h2 class="section-title">카테고리</h2>
                                %s
                            </section>
                            <section class="section">
                                <h2 class="section-title">인기 레시피</h2>
                                %s
                            </section>
                        </main>
                        %s
                    </div>
                    %s
                    %s
                </body>
                </html>
                """.formatted(
                renderSharedStyles(),
                renderTopbar(),
                categoryGrid,
                popularGrid,
                renderFooter(),
                renderCtaBanner("앱에서 음성 모드로 더 편하게", "단계별 자동 타이머 · AI 메뉴 추천"),
                renderAppOpenScript("yojalal://")
        );

        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=300, s-maxage=600")
                .body(html);
    }

    /** 카테고리별 레시피 목록 — /category/{name} */
    @GetMapping(value = "/category/{name}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> categoryPage(@PathVariable String name) {
        String decoded = java.net.URLDecoder.decode(name, java.nio.charset.StandardCharsets.UTF_8);
        String iconFile = null;
        for (String[] c : CATEGORIES) {
            if (c[0].equals(decoded)) { iconFile = c[1]; break; }
        }

        java.util.List<com.devl.api.dto.RecipeDto> recipes = java.util.Collections.emptyList();
        try {
            recipes = recipeService.getRecipesByCategory(decoded);
        } catch (Exception ignore) {}

        String safeName = htmlEscape(decoded);
        String canonical = "https://yojalal.com/category/" + java.net.URLEncoder.encode(decoded, java.nio.charset.StandardCharsets.UTF_8);
        String grid = renderRecipeCardGrid(recipes);

        String html = """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
                    <meta name="theme-color" content="#0B9A61">
                    <meta name="description" content="%s 카테고리의 레시피 모음 — 요잘알에서 단계별로 쉽게 만들어보세요.">
                    <link rel="canonical" href="%s">
                    <meta property="og:type" content="website">
                    <meta property="og:site_name" content="요잘알">
                    <meta property="og:title" content="%s 레시피 — 요잘알">
                    <meta property="og:description" content="%s 카테고리의 인기 레시피">
                    <meta property="og:image" content="https://yojalal.com/img/app-icon.png">
                    <meta property="og:url" content="%s">
                    <link rel="icon" type="image/png" href="/img/app-icon.png">
                    <title>%s 레시피 — 요잘알</title>
                    %s
                </head>
                <body>
                    <div class="page">
                        %s
                        <main class="content">
                            <section class="cat-hero">
                                <div class="cat-hero-icon"><img src="/img/%s" alt="%s"></div>
                                <h1 class="cat-hero-title">%s</h1>
                                <p class="cat-hero-sub">총 %d개 레시피</p>
                            </section>
                            <section class="section">
                                %s
                            </section>
                        </main>
                        %s
                    </div>
                    %s
                    %s
                </body>
                </html>
                """.formatted(
                safeName, canonical,
                safeName, safeName, canonical,
                safeName,
                renderSharedStyles(),
                renderTopbar(),
                iconFile != null ? iconFile : "app-icon.png", safeName, safeName, recipes.size(),
                grid,
                renderFooter(),
                renderCtaBanner("앱에서 음성 모드로 더 편하게", "단계별 자동 타이머 · 손 없이 요리"),
                renderAppOpenScript("yojalal://")
        );

        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=300, s-maxage=600")
                .body(html);
    }

    // ===== 공통 컴포넌트 =====

    private String renderSharedStyles() {
        // 앱의 (tabs)/index.tsx, recipe/[id].tsx 스타일을 그대로 옮겨옴.
        // 핵심: 백색 배경(#FFFFFF), Pretendard/Apple SD Gothic Neo, 카테고리 5열 PNG 아이콘, 작은 그림자.
        return """
                <style>
                * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
                html, body { font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Segoe UI', sans-serif; color: #1A1A1A; }
                body { background: #FFFFFF; padding-bottom: 100px; }
                .page { max-width: 560px; margin: 0 auto; background: #FFFFFF; min-height: 100vh; }
                /* ===== Topbar (앱 header 기준 - height 56) ===== */
                .topbar { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.96); backdrop-filter: blur(8px); padding: 0 20px; height: 56px; display: flex; justify-content: space-between; align-items: center; }
                .topbar a.logo { font-weight: 800; color: #1A1A1A; font-size: 22px; text-decoration: none; letter-spacing: -0.5px; display: inline-flex; align-items: center; gap: 6px; }
                .topbar a.logo .leaf { color: #0B9A61; }
                .topbar .open-mini { font-size: 13px; font-weight: 700; color: #FFFFFF; background: #0B9A61; padding: 8px 14px; border-radius: 20px; text-decoration: none; }
                /* ===== Hero (앱 greetingRow 영역과 비슷한 톤) ===== */
                .content { padding: 8px 20px 24px; }
                .hero { padding: 16px 0 20px; }
                .hero-title { font-size: 26px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.3; color: #1A1A1A; }
                .hero-accent { color: #0B9A61; }
                .hero-sub { font-size: 14px; color: #666; margin-top: 10px; line-height: 1.55; }
                /* ===== Section (앱 sectionTitle: fontSize 18, fontWeight 700) ===== */
                .section { margin-top: 8px; }
                .section-header { padding: 0 0 12px; margin-top: 8px; }
                .section-title { font-size: 18px; font-weight: 700; color: #1A1A1A; letter-spacing: -0.2px; }
                /* ===== Category grid (앱: 5열, paddingHorizontal 12, categoryIcon 52~60px, 흰배경+PNG 풀필) ===== */
                .cat-grid { display: grid; grid-template-columns: repeat(5, 1fr); padding: 0 0 14px; }
                .cat-item { width: 100%%; display: flex; flex-direction: column; align-items: center; text-decoration: none; color: #1A1A1A; padding: 6px 0; gap: 8px; }
                .cat-icon { width: 52px; height: 52px; border-radius: 16px; background: #FFFFFF; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; }
                .cat-icon img { width: 100%%; height: 100%%; object-fit: cover; border-radius: 16px; }
                .cat-label { font-size: 14px; font-weight: 500; color: #1A1A1A; text-align: center; }
                /* ===== Recipe Card (앱: width 150, aspectRatio 1, borderRadius 8) ===== */
                .recipe-hscroll { display: flex; gap: 12px; overflow-x: auto; padding: 0 0 16px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
                .recipe-hscroll::-webkit-scrollbar { display: none; }
                .recipe-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 12px; padding-bottom: 16px; }
                .recipe-card { background: transparent; text-decoration: none; color: inherit; display: block; }
                .recipe-card.hscroll { width: 150px; flex-shrink: 0; }
                .recipe-card .thumb-wrap { position: relative; width: 100%%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #F2F2F2; }
                .recipe-card .thumb { width: 100%%; height: 100%%; object-fit: cover; display: block; }
                .recipe-card .author-overlay { position: absolute; top: 8px; right: 8px; display: inline-flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.35); border-radius: 12px; padding: 3px 6px; font-size: 11px; font-weight: 500; color: #fff; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .recipe-card .name { font-size: 15px; font-weight: 500; color: #1A1A1A; line-height: 1.32; margin-top: 8px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
                .recipe-card .meta { font-size: 12px; color: #888; margin-top: 4px; display: flex; gap: 6px; align-items: center; }
                .recipe-card .meta .heart { color: #FF4D67; }
                .recipe-card .meta .diff { font-weight: 700; }
                /* ===== Category Hero ===== */
                .cat-hero { padding: 16px 0 20px; text-align: center; border-bottom: 1px solid #F2F2F2; margin-bottom: 20px; }
                .cat-hero-icon { width: 64px; height: 64px; border-radius: 18px; margin: 0 auto 12px; display: inline-flex; align-items: center; justify-content: center; background: #FFFFFF; overflow: hidden; }
                .cat-hero-icon img { width: 100%%; height: 100%%; object-fit: cover; border-radius: 18px; }
                .cat-hero-title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; color: #1A1A1A; }
                .cat-hero-sub { font-size: 13px; color: #999; margin-top: 4px; }
                .empty { padding: 40px 16px; text-align: center; color: #BDBDBD; font-size: 14px; }
                /* ===== CTA Banner (앱 bottomBar 톤: white bg, top border) ===== */
                .cta-banner { position: fixed; left: 0; right: 0; bottom: 0; background: #FFFFFF; border-top: 1px solid #F0F0F0; padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); display: flex; justify-content: center; z-index: 50; }
                .cta-banner-inner { max-width: 560px; width: 100%%; display: flex; gap: 10px; align-items: center; }
                .cta-msg { flex: 1; min-width: 0; }
                .cta-msg b { font-size: 14px; font-weight: 700; display: block; color: #1A1A1A; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .cta-msg span { font-size: 11.5px; color: #888; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
                .cta-btn { padding: 12px 20px; background: #0B9A61; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; flex-shrink: 0; }
                .cta-btn:active { background: #088450; }
                .footer { padding: 24px 20px 32px; text-align: center; font-size: 11.5px; color: #BDBDBD; line-height: 1.6; }
                .footer a { color: #888; text-decoration: none; }
                </style>
                """;
    }

    private String renderTopbar() {
        return """
                <header class="topbar">
                    <a class="logo" href="/"><span class="leaf">🌱</span>요잘알</a>
                    <a class="open-mini" href="yojalal://" id="openMini">앱 열기</a>
                </header>
                """;
    }

    private String renderFooter() {
        return """
                <div class="footer">
                    요잘알 · 매일 뭐 먹지? 고민 끝.<br>
                    <a href="/">yojalal.com</a> · <a href="/privacy">개인정보처리방침</a> · <a href="/terms">이용약관</a>
                </div>
                """;
    }

    private String renderCtaBanner(String title, String sub) {
        return ("""
                <div class="cta-banner">
                    <div class="cta-banner-inner">
                        <div class="cta-msg">
                            <b>%s</b>
                            <span>%s</span>
                        </div>
                        <a class="cta-btn" href="yojalal://" id="openCta">앱 열기</a>
                    </div>
                </div>
                """).formatted(htmlEscape(title), htmlEscape(sub));
    }

    private String renderCategoryGrid() {
        StringBuilder sb = new StringBuilder("<div class=\"cat-grid\">");
        for (String[] c : CATEGORIES) {
            sb.append("<a class=\"cat-item\" href=\"/category/")
              .append(java.net.URLEncoder.encode(c[0], java.nio.charset.StandardCharsets.UTF_8))
              .append("\"><span class=\"cat-icon\"><img src=\"/img/")
              .append(c[1]).append("\" alt=\"").append(c[0]).append("\" loading=\"lazy\"></span>")
              .append("<span class=\"cat-label\">").append(c[0]).append("</span></a>");
        }
        sb.append("</div>");
        return sb.toString();
    }

    private String renderRecipeCardGrid(java.util.List<com.devl.api.dto.RecipeDto> list) {
        if (list == null || list.isEmpty()) {
            return "<div class=\"empty\">아직 등록된 레시피가 없어요.</div>";
        }
        StringBuilder sb = new StringBuilder("<div class=\"recipe-grid\">");
        for (com.devl.api.dto.RecipeDto r : list) {
            if (r.getId() == null) continue;
            String img = (r.getImage() != null && !r.getImage().isEmpty())
                    ? r.getImage() : "https://yojalal.com/img/app-icon.png";
            String diffColor = switch (r.getDifficulty() == null ? "" : r.getDifficulty()) {
                case "쉬움" -> "#1BAE74";
                case "어려움" -> "#E74C3C";
                default -> "#F5A623";
            };
            sb.append("<a class=\"recipe-card\" href=\"/recipe/").append(r.getId()).append("\">")
              .append("<div class=\"thumb-wrap\">")
              .append("<img class=\"thumb\" src=\"").append(htmlEscapeAttr(img))
              .append("\" alt=\"").append(htmlEscapeAttr(r.getTitle() != null ? r.getTitle() : "")).append("\" loading=\"lazy\">");
            if (r.getAuthor() != null && !r.getAuthor().isEmpty()) {
                sb.append("<span class=\"author-overlay\">").append(htmlEscape(r.getAuthor())).append("</span>");
            }
            sb.append("</div>")
              .append("<div class=\"name\">").append(htmlEscape(r.getTitle() != null ? r.getTitle() : "")).append("</div>")
              .append("<div class=\"meta\">")
              .append("<span>").append(formatTime(r.getTime())).append("분</span>")
              .append("<span style=\"color:#ddd;\">·</span>")
              .append("<span class=\"diff\" style=\"color:").append(diffColor).append(";\">").append(r.getDifficulty() != null ? r.getDifficulty() : "쉬움").append("</span>")
              .append("<span style=\"color:#ddd;\">·</span>")
              .append("<span class=\"heart\">♥ ").append(r.getLikes()).append("</span>")
              .append("</div></a>");
        }
        sb.append("</div>");
        return sb.toString();
    }

    private String renderAppOpenScript(String defaultPath) {
        return ("""
                <script>
                (function() {
                    var ua = navigator.userAgent.toLowerCase();
                    var isKakao = ua.indexOf('kakaotalk') > -1;
                    var isAndroid = ua.indexOf('android') > -1;
                    var isIOS = /iphone|ipad|ipod/.test(ua);
                    var appStoreUrl = '%s';
                    var playStoreUrl = '%s';
                    var storeUrl = isAndroid ? playStoreUrl : appStoreUrl;
                    function openApp(href) {
                        var path = (href || '%s').replace(/^yojalal:\\/\\//, '');
                        if (isKakao) {
                            if (isAndroid) {
                                location.href = 'intent://' + path + '#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';
                            } else {
                                location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
                            }
                        } else if (isAndroid) {
                            location.href = 'intent://' + path + '#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=' + encodeURIComponent(storeUrl) + ';end';
                        } else {
                            location.href = 'yojalal://' + path;
                            setTimeout(function() {
                                if (document.visibilityState !== 'hidden') location.href = storeUrl;
                            }, 1500);
                        }
                    }
                    function bind(el) {
                        if (!el) return;
                        el.addEventListener('click', function(e) { e.preventDefault(); openApp(el.getAttribute('href')); });
                    }
                    bind(document.getElementById('openMini'));
                    bind(document.getElementById('openCta'));
                })();
                </script>
                """).formatted(APP_STORE_URL, PLAY_STORE_URL, defaultPath);
    }

    @GetMapping(value = "/yojalal", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> yojalalLanding() {
        String appStoreUrl = APP_STORE_URL;
        String playStoreUrl = PLAY_STORE_URL;

        String html = """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
                    <meta name="theme-color" content="#0B9A61">
                    <meta property="og:type" content="website">
                    <meta property="og:site_name" content="요잘알">
                    <meta property="og:title" content="요잘알 - 매일 뭐 먹지? 고민 끝!">
                    <meta property="og:description" content="아침부터 야식까지, 재료 6~8개로 끝내는 AI 레시피 앱.">
                    <meta property="og:image" content="https://yojalal.com/img/app-icon.png">
                    <meta name="apple-itunes-app" content="app-id=6761661890">
                    <link rel="icon" type="image/png" href="/img/app-icon.png">
                    <title>요잘알 - 매일 뭐 먹지? 고민 끝!</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
                        html, body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Pretendard', sans-serif; }
                        body {
                            min-height: 100vh;
                            background:
                                radial-gradient(ellipse 80%% 50%% at 50%% 0%%, rgba(11,154,97,0.18) 0%%, transparent 70%%),
                                linear-gradient(180deg, #F4FBF7 0%%, #FFFFFF 60%%);
                            color: #1A1A1A;
                            display: flex; flex-direction: column; align-items: center;
                            padding: 56px 20px 32px;
                        }
                        .wrap { width: 100%%; max-width: 460px; display: flex; flex-direction: column; align-items: center; }
                        .logo {
                            width: 96px; height: 96px; border-radius: 24px;
                            box-shadow: 0 14px 32px rgba(11,154,97,0.22), 0 2px 6px rgba(0,0,0,0.06);
                            margin-bottom: 18px; background: #fff;
                        }
                        .name { font-size: 24px; font-weight: 800; color: #0B9A61; margin-bottom: 4px; letter-spacing: -0.4px; }
                        .handle { font-size: 13px; font-weight: 600; color: #888; margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; transition: color 0.15s ease; }
                        .handle:hover { color: #0B9A61; }
                        .handle svg { width: 14px; height: 14px; }
                        .bio { font-size: 14.5px; color: #555; line-height: 1.55; text-align: center; margin-bottom: 30px; padding: 0 8px; }
                        .links { width: 100%%; display: flex; flex-direction: column; gap: 12px; }
                        .btn {
                            display: flex; align-items: center; justify-content: center; gap: 10px;
                            width: 100%%; padding: 17px 20px;
                            background: #fff; color: #1A1A1A;
                            border-radius: 16px; font-size: 15px; font-weight: 700;
                            text-decoration: none;
                            box-shadow: 0 2px 14px rgba(11,154,97,0.10);
                            border: 1.5px solid rgba(11,154,97,0.10);
                            transition: transform 0.14s ease, box-shadow 0.2s ease, background 0.2s ease;
                            position: relative;
                            user-select: none;
                        }
                        a.btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(11,154,97,0.20); background: #FAFFFB; }
                        a.btn:active { transform: translateY(0); }
                        .btn .ico { width: 22px; height: 22px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
                        .btn .ico svg { width: 100%%; height: 100%%; display: block; }
                        .btn.disabled .ico { opacity: 0.65; }
                        .btn.primary { background: #0B9A61; color: #fff; border-color: #0B9A61; box-shadow: 0 8px 22px rgba(11,154,97,0.32); }
                        a.btn.primary:hover { background: #078A55; box-shadow: 0 12px 28px rgba(11,154,97,0.40); }
                        .btn.disabled { background: #F1F4F2; color: #9AA39E; border-color: transparent; box-shadow: none; cursor: not-allowed; }
                        .badge-soon {
                            position: absolute; right: 14px; top: 50%%; transform: translateY(-50%%);
                            background: #0B9A61; color: #fff;
                            font-size: 10px; font-weight: 800;
                            padding: 4px 9px; border-radius: 999px;
                            letter-spacing: 0.2px;
                        }
                        .footer { margin-top: 36px; text-align: center; font-size: 12px; color: #999; line-height: 1.8; }
                        .footer a { color: #0B9A61; text-decoration: none; font-weight: 600; padding: 0 4px; }
                        .footer a:hover { text-decoration: underline; }
                        .footer .sep { color: #D5DCD8; }
                        .legal { margin-top: 8px; font-size: 11px; color: #AAB1AD; }
                    </style>
                </head>
                <body>
                    <main class="wrap">
                        <img class="logo" src="/img/app-icon.png" alt="요잘알 앱 아이콘">
                        <h1 class="name">요잘알</h1>
                        <a class="handle" href="https://instagram.com/cookmate_yojalal" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                            @cookmate_yojalal
                        </a>
                        <p class="bio">매일 "뭐 먹지?" 고민, 이제 끝.<br>AI가 골라주는 오늘의 메뉴 · 레시피 앱</p>

                        <nav class="links">
                            <a class="btn primary" href="%s" rel="noopener">
                                <span class="ico"><svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg></span>
                                App Store에서 다운로드
                            </a>
                            <a class="btn" href="%s" rel="noopener">
                                <span class="ico"><svg viewBox="0 0 16.05 17.86" xmlns="http://www.w3.org/2000/svg"><path d="M.16 0a.69.69 0 0 0-.16.46v16.94c0 .19.06.36.16.51l.05.05L9.51 8.93v-.11L.21.05.16 0z" fill="#00C3FF"/><path d="M12.62 12.16l-3.11-3.23V8.81l3.11-3.21.07.04 3.69 2.1c1.05.6 1.05 1.58 0 2.18l-3.69 2.1z" fill="#FFD500"/><path d="M12.69 12.13L9.5 8.87.16 18.32a.83.83 0 0 0 1.06.03l11.47-6.22z" fill="#FF4757"/><path d="M12.69 5.61L1.22.05A.83.83 0 0 0 .16 0l9.34 8.87 3.19-3.26z" fill="#34A853"/></svg></span>
                                Google Play에서 다운로드
                            </a>
                            <a class="btn" href="https://pf.kakao.com/_enxdCX" target="_blank" rel="noopener">
                                <span class="ico"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="5.5" fill="#FEE500"/><path d="M12 6c-3.866 0-7 2.245-7 5.014 0 1.756 1.27 3.297 3.18 4.207l-.628 2.298c-.064.232.21.422.41.286l2.738-1.853c.428.058.864.087 1.3.087 3.866 0 7-2.245 7-5.013S15.866 6 12 6z" fill="#3C1E1E"/></svg></span>
                                카카오 채널 요잘알 문의
                            </a>
                            <a class="btn" href="mailto:twentyvi@naver.com">
                                <span class="ico"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#1A1A1A" stroke-width="1.8"/><path d="M3.5 7l8.5 6 8.5-6" stroke="#1A1A1A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                이메일 문의
                            </a>
                        </nav>

                        <div class="footer">
                            <a href="/privacy">개인정보처리방침</a><span class="sep">·</span>
                            <a href="/terms">이용약관</a>
                            <div class="legal">© 2025-2026 트웬티식스 (TwentyVI) · 사업자등록번호 471-16-02759</div>
                        </div>
                    </main>
                </body>
                </html>
                """.formatted(appStoreUrl, playStoreUrl);

        return ResponseEntity.ok(html);
    }
}
