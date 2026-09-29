    @MainActor private func goTo(_ path: String, _ app: XCUIApplication) throws {
        app.typeKey("g", modifierFlags: [.command, .shift])
        // Native identifiers verified in the captured macOS 26 accessibility hierarchy.
        // Do not enumerate transient background fields while a sheet is being attached.
        let dialog = app.sheets["GoToWindow"].firstMatch
        let entry = app.textFields["PathTextField"].firstMatch
        XCTAssertTrue(dialog.waitForExistence(timeout: 10))
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        try record("dialog-path-entry", app)
        entry.click();entry.typeKey("a", modifierFlags: .command)
        entry.typeText(path)
        try record("dialog-path-entered", app)
        XCTAssertEqual(entry.value as? String, path, "The requested directory must be entered verbatim")
        entry.typeKey(.return, modifierFlags: [])
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: dialog)
        let outcome = XCTWaiter.wait(for: [dismissed], timeout: 10)
        try record("dialog-path-resolved", app)
        XCTAssertEqual(outcome, .completed)
    }
    @MainActor private func savePanel(_ app: XCUIApplication, to url: URL, phase: String) throws {
        let save = app.sheets.buttons["OKButton"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 10))
        try record(phase + "-panel", app)
        try goTo(url.deletingLastPathComponent().path, app)
        let field = app.sheets.textFields["saveAsNameTextField"].firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.click();field.typeKey("a", modifierFlags: .command)
        field.typeText(url.lastPathComponent)
        expectValue(field, url.lastPathComponent)
        try record(phase + "-ready", app)
        save.click()
        let exists = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in FileManager.default.fileExists(atPath: url.path) }, object: nil)
        let outcome = XCTWaiter.wait(for: [exists], timeout: 25)
        try record(phase + "-after", app)
        print("INKBRUSH_EXPECTED_FILE=\(url.path) ACTUAL_CHILDREN=\((try? FileManager.default.contentsOfDirectory(atPath: url.deletingLastPathComponent().path)) ?? [])")
        XCTAssertEqual(outcome, .completed)
    }
    @MainActor private func openPanel(_ app: XCUIApplication, url: URL) throws {
        app.typeKey("o", modifierFlags: .command)
        let open = app.sheets.buttons["OKButton"].firstMatch
        XCTAssertTrue(open.waitForExistence(timeout: 10))
        try goTo(url.path, app)
        open.click()
        XCTAssertTrue(app.images["editorCanvas"].waitForExistence(timeout: 20))
    }
