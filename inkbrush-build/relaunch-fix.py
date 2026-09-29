from pathlib import Path
base=Path(__file__).parent
kit=base/'kit'
p=kit/'InkbrushUITests.swift';s=p.read_text()
s=s.replace('func testLayersPaintSaveExportAndLegacyOpen() throws {','func testLayersPaintSaveExportAndLegacyOpen() async throws {')
a=s.index('        let process=Process();process.executableURL=URL(fileURLWithPath:"/usr/bin/open")')
b=s.index('\n    }\n    @MainActor func testUnsavedCloseCanBeCancelled',a)
s=s[:a]+'''        // Await the operating system's file-open completion. Calling XCTest.activate before
        // Launch Services finishes can launch a fresh no-document instance with old test arguments.
        let expected = URL(fileURLWithPath: try XCTUnwrap(ProcessInfo.processInfo.environment["INKBRUSH_APP_PATH"]))
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        let launched = try await NSWorkspace.shared.open([project], withApplicationAt: expected, configuration: configuration)
        XCTAssertEqual(launched.bundleURL?.resolvingSymlinksInPath().path, expected.resolvingSymlinksInPath().path)
        let reopened = XCUIApplication(bundleIdentifier: "app.inkbrush.mac")
        let appeared = reopened.wait(for: .runningForeground, timeout: 25)
        let receipt: [String: Any] = ["method":"NSWorkspace.open URLs with explicit installed application; awaited completion", "bundlePath":launched.bundleURL?.path ?? "", "pid":Int(launched.processIdentifier), "project":project.path, "runningForeground":appeared]
        try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted,.sortedKeys]).write(to: output.appendingPathComponent("launch-services.json"))
        XCTAssertTrue(appeared, "Launch Services must launch the app before XCTest is allowed to activate it")
        reopened.activate()
        try record("10-finder-style-relaunch-before-check", reopened)
        XCTAssertFalse(launched.isTerminated, "XCTest must attach to the already opened process, not replace it")
        expectValue(reopened.staticTexts["layerCount"],"2")
        XCTAssertTrue(reopened.buttons.matching(NSPredicate(format:"label CONTAINS %@","Close Study-colour")).firstMatch.exists)
        try record("10-finder-style-relaunch",reopened)
''' + s[b:]
p.write_text(s)
(kit/'relaunch-fix.py').write_text(Path(__file__).read_text())
print('Await operating-system launch completion; keep full file-delivery assertions')
