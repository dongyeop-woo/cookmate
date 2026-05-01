// CookmateLiveActivityBundle.swift
// 위젯 익스텐션의 진입점. WidgetBundle 안에 Live Activity Widget만 등록.

import SwiftUI
import WidgetKit

@main
struct CookmateLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.1, *) {
            CookingTimerLiveActivity()
        }
    }
}
