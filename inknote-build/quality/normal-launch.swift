import AppKit
import CoreGraphics
import Foundation
let appPath = URL(fileURLWithPath: CommandLine.arguments[1]).resolvingSymlinksInPath().path
let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "app.inknote.mac").filter {
    $0.bundleURL?.resolvingSymlinksInPath().path == appPath && !$0.isTerminated
}
if CommandLine.arguments.contains("--terminate") {
    for app in apps { if !app.terminate() { fputs("Normal quit request was refused\n",stderr); exit(1) } }
} else {
    let rows = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] ?? []
    let ids = Set(apps.map { Int($0.processIdentifier) })
    let windows = rows.filter { row in
        guard let pid = row[kCGWindowOwnerPID as String] as? Int,
              let layer = row[kCGWindowLayer as String] as? Int else { return false }
        return ids.contains(pid) && layer == 0
    }
    let result: [String: Any] = ["count":apps.count,"pids":Array(ids).sorted(),"visibleWindows":windows.count,
        "names":apps.compactMap { $0.localizedName },"bundlePaths":apps.compactMap { $0.bundleURL?.path }]
    let data=try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys])
    print(String(data:data,encoding:.utf8)!)
}
