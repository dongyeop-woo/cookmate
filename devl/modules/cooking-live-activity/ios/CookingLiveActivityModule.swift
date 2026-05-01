// CookingLiveActivityModule.swift
// React Native ↔ ActivityKit 브릿지.
// 단 1개의 활동만 동시에 유지 (요리 화면이 단계별 타이머 1개만 띄움).

import ActivityKit
import ExpoModulesCore
import Foundation
import UIKit

public class CookingLiveActivityModule: Module {
    // 동시 활동 1개만 유지 — endAll 시 모두 종료.
    private var currentActivityId: String?

    public func definition() -> ModuleDefinition {
        Name("CookingLiveActivity")

        AsyncFunction("isSupported") { () -> Bool in
            if #available(iOS 16.1, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        // 진단용 — areActivitiesEnabled가 false일 때 어디가 막는지 사용자에게 보여줌.
        // 저전력 모드 / 시스템 설정 OFF / iOS<16.1 등 흔한 원인을 한 번에 노출.
        AsyncFunction("diagnose") { () -> [String: Any] in
            var result: [String: Any] = [
                "iosVersion": UIDevice.current.systemVersion,
                "isLowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
            ]
            if #available(iOS 16.1, *) {
                let info = ActivityAuthorizationInfo()
                result["areActivitiesEnabled"] = info.areActivitiesEnabled
                if #available(iOS 16.2, *) {
                    result["frequentPushesEnabled"] = info.frequentPushesEnabled
                }
            } else {
                result["areActivitiesEnabled"] = false
            }
            return result
        }

        // 새 활동 시작. 진행 중 활동이 있으면 먼저 종료.
        // remainingSeconds 만큼 카운트다운하는 endDate를 계산해서 위젯에 전달.
        AsyncFunction("start") { (
            recipeTitle: String,
            stepNumber: Int,
            totalSteps: Int,
            remainingSeconds: Int
        ) -> String? in
            guard #available(iOS 16.1, *) else { return nil }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }

            // 기존 활동이 있으면 깨끗이 종료 후 새로 시작.
            await self.endAllInternal()

            let attrs = CookingTimerAttributes(
                recipeTitle: recipeTitle,
                stepNumber: stepNumber,
                totalSteps: totalSteps
            )
            let endDate = Date().addingTimeInterval(TimeInterval(remainingSeconds))
            let initial = CookingTimerAttributes.TimerState(endDate: endDate)

            // try가 던지는 에러는 catch하지 않고 그대로 위로 — JS catch에서 정확한 원인 노출.
            // (예: 위젯 익스텐션 미포함 시 ActivityKit이 unsupportedTarget 등을 던짐)
            let activity: Activity<CookingTimerAttributes>
            if #available(iOS 16.2, *) {
                activity = try Activity.request(
                    attributes: attrs,
                    content: ActivityContent(state: initial, staleDate: endDate.addingTimeInterval(60)),
                    pushType: nil
                )
            } else {
                activity = try Activity.request(
                    attributes: attrs,
                    contentState: initial,
                    pushType: nil
                )
            }
            self.currentActivityId = activity.id
            return activity.id
        }

        // 일시정지 — 카운트다운 멈추고 남은 시간을 정적으로 표시.
        AsyncFunction("pause") { (remainingSeconds: Int) -> Void in
            guard #available(iOS 16.1, *) else { return }
            guard let id = self.currentActivityId,
                  let activity = Activity<CookingTimerAttributes>.activities.first(where: { $0.id == id })
            else { return }
            // 일시정지 상태에서 endDate는 의미 없지만 형식상 유지.
            let state = CookingTimerAttributes.TimerState(
                endDate: Date().addingTimeInterval(TimeInterval(remainingSeconds)),
                pausedRemainingSeconds: remainingSeconds
            )
            if #available(iOS 16.2, *) {
                await activity.update(ActivityContent(state: state, staleDate: nil))
            } else {
                await activity.update(using: state)
            }
        }

        // 재개 — 새 endDate로 카운트다운 재시작.
        AsyncFunction("resume") { (remainingSeconds: Int) -> Void in
            guard #available(iOS 16.1, *) else { return }
            guard let id = self.currentActivityId,
                  let activity = Activity<CookingTimerAttributes>.activities.first(where: { $0.id == id })
            else { return }
            let endDate = Date().addingTimeInterval(TimeInterval(remainingSeconds))
            let state = CookingTimerAttributes.TimerState(endDate: endDate)
            if #available(iOS 16.2, *) {
                await activity.update(ActivityContent(state: state, staleDate: endDate.addingTimeInterval(60)))
            } else {
                await activity.update(using: state)
            }
        }

        // 종료 — 시간 다 됐을 때 또는 사용자가 다음 단계로 넘어갈 때.
        AsyncFunction("end") { () -> Void in
            guard #available(iOS 16.1, *) else { return }
            await self.endAllInternal()
        }

        // 모든 활동 강제 종료 — 앱 종료/언마운트 시 안전 정리.
        AsyncFunction("endAll") { () -> Void in
            guard #available(iOS 16.1, *) else { return }
            await self.endAllInternal()
        }
    }

    @available(iOS 16.1, *)
    private func endAllInternal() async {
        for activity in Activity<CookingTimerAttributes>.activities {
            if #available(iOS 16.2, *) {
                await activity.end(nil, dismissalPolicy: .immediate)
            } else {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
        self.currentActivityId = nil
    }
}
