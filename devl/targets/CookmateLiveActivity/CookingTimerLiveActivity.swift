// CookingTimerLiveActivity.swift
// 스타벅스 스타일 — 진한 그린 배경, 흰 텍스트, 진행 바, 미니멀.

import ActivityKit
import SwiftUI
import WidgetKit

// 요잘알 브랜드 컬러 + 스타벅스 톤
private extension Color {
    static let yojalalGreen = Color(red: 0.027, green: 0.439, blue: 0.290)        // #07704A 진한 그린
    static let yojalalGreenDark = Color(red: 0.012, green: 0.310, blue: 0.200)    // #027F52 더 어두운 톤
    static let yojalalAccent = Color(red: 0.043, green: 0.604, blue: 0.380)       // #0B9A61 액센트
}

@available(iOS 16.1, *)
struct CookingTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CookingTimerAttributes.self) { context in
            // ── 잠금화면 / 알림센터 ──
            LockScreenView(context: context)
                .activityBackgroundTint(Color.yojalalGreen)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            // ── 다이나믹 아일랜드 ──
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 10) {
                        AppIconView(size: 36, shape: .roundedRect(8))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.attributes.recipeTitle)
                                .font(.subheadline.weight(.bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Text("\(context.attributes.stepNumber) / \(context.attributes.totalSteps) 단계")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerView(state: context.state, font: .system(size: 24, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundColor(.white)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    StepProgressBar(
                        current: context.attributes.stepNumber,
                        total: context.attributes.totalSteps
                    )
                    .padding(.top, 6)
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                AppIconView(size: 20, shape: .roundedRect(5))
            } compactTrailing: {
                timerView(state: context.state, font: .system(size: 14, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundColor(.yojalalAccent)
                    .frame(maxWidth: 60)
            } minimal: {
                AppIconView(size: 20, shape: .roundedRect(5))
            }
            .keylineTint(.yojalalAccent)
        }
    }

    @ViewBuilder
    private func timerView(state: CookingTimerAttributes.ContentState, font: Font) -> some View {
        if let paused = state.pausedRemainingSeconds {
            Text(formatSeconds(paused))
                .font(font)
                .opacity(0.6)
        } else {
            Text(timerInterval: Date()...state.endDate, countsDown: true)
                .font(font)
                .multilineTextAlignment(.trailing)
        }
    }

    private func formatSeconds(_ s: Int) -> String {
        let m = s / 60
        let r = s % 60
        return String(format: "%d:%02d", m, r)
    }
}

// MARK: - Lock Screen

@available(iOS 16.1, *)
private struct LockScreenView: View {
    let context: ActivityViewContext<CookingTimerAttributes>

    var body: some View {
        ZStack {
            // 진한 그린 그라데이션 — 스타벅스 풍
            LinearGradient(
                colors: [Color.yojalalGreen, Color.yojalalGreenDark],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    AppIconView(size: 44, shape: .roundedRect(10))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(context.attributes.recipeTitle)
                            .font(.headline)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text("\(context.attributes.stepNumber) / \(context.attributes.totalSteps) 단계 진행 중")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.7))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 0) {
                        timerLabel
                        Text(context.state.pausedRemainingSeconds == nil ? "남음" : "일시 정지")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
                StepProgressBar(
                    current: context.attributes.stepNumber,
                    total: context.attributes.totalSteps
                )
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
        }
    }

    @ViewBuilder
    private var timerLabel: some View {
        if let paused = context.state.pausedRemainingSeconds {
            Text(formatSeconds(paused))
                .font(.system(size: 28, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundColor(.white.opacity(0.7))
        } else {
            Text(timerInterval: Date()...context.state.endDate, countsDown: true)
                .font(.system(size: 28, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundColor(.white)
                .multilineTextAlignment(.trailing)
        }
    }

    private func formatSeconds(_ s: Int) -> String {
        let m = s / 60
        let r = s % 60
        return String(format: "%d:%02d", m, r)
    }
}

// MARK: - Components

// 앱 아이콘 — 모든 위치에서 사용. 모양만 인자로 변경.
@available(iOS 16.1, *)
private struct AppIconView: View {
    var size: CGFloat = 36
    var shape: IconShape = .circle

    enum IconShape: Equatable {
        case circle
        case roundedRect(CGFloat)
    }

    @ViewBuilder
    var body: some View {
        switch shape {
        case .circle:
            iconImage.clipShape(Circle())
        case .roundedRect(let r):
            iconImage.clipShape(RoundedRectangle(cornerRadius: r))
        }
    }

    private var iconImage: some View {
        Image("yojalalLogo")
            .resizable()
            .renderingMode(.original)
            .aspectRatio(contentMode: .fill)
            .frame(width: size, height: size)
    }
}

@available(iOS 16.1, *)
private struct StepProgressBar: View {
    let current: Int
    let total: Int

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.white.opacity(0.18))
                Capsule()
                    .fill(Color.white)
                    .frame(width: max(6, geo.size.width * progress))
            }
        }
        .frame(height: 4)
    }

    private var progress: Double {
        guard total > 0 else { return 0 }
        return min(1.0, max(0.0, Double(current) / Double(total)))
    }
}
