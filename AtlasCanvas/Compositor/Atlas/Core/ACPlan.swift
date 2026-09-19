import Foundation

nonisolated enum ACOperation: String, Codable, CaseIterable, Sendable {
    case move, transform, delete, duplicate, recolor, modify, replace, add, background, generate, blur, harmonize, shadow, protect, unprotect, rename
}

/// Strict wire format shared with the local companion and external agent providers.
/// A model proposes these operations; native validation and transactions authorize effects.
nonisolated struct ACAction: Codable, Equatable, Sendable {
    var op: ACOperation
    var target: UUID?
    var prompt: String?
    var dx: Double?
    var dy: Double?
    var scale: Double?
    var angle: Double?
    var color: String?
    var amount: Double?
    var x: Double?
    var y: Double?
    var width: Double?
    var height: Double?
    var name: String?

    var requiresImageProvider: Bool { [.modify, .replace, .add, .background, .generate].contains(op) }
    var modifiesPixels: Bool { [.recolor, .modify, .replace, .background, .blur, .harmonize].contains(op) }
}
nonisolated struct ACPlan: Codable, Equatable, Sendable {
    var summary: String
    var steps: [ACAction]
    func validate(objects: [ACObject], availableLayerIDs: Set<UUID>, imageCallLimit: Int = 6) throws {
        guard !steps.isEmpty, steps.count <= 16, summary.utf8.count <= 4_096 else { throw ACError.invalidPlan("Use 1–16 bounded editing steps.") }
        guard steps.filter(\.requiresImageProvider).count <= imageCallLimit else { throw ACError.invalidPlan("This plan exceeds the image-call budget.") }
        var alive = availableLayerIDs
        let protected = Set(objects.filter(\.protected).map(\.id))
        for step in steps {
            let needsTarget = ![.add, .generate].contains(step.op)
            if needsTarget {
                guard let target = step.target, alive.contains(target) else { throw ACError.invalidPlan("A target is missing, unknown, or was deleted by an earlier step.") }
                // A model cannot unprotect a user's region. Only an explicit native control can.
                if protected.contains(target), step.op != .protect { throw ACError.invalidPlan("A targeted object is protected. Unprotect it explicitly in the inspector first.") }
                if step.op == .unprotect { throw ACError.invalidPlan("Only the user can remove protection in the inspector.") }
                if step.op == .delete { alive.remove(target) }
            } else if step.target != nil { throw ACError.invalidPlan("Creation cannot overwrite an existing target.") }
            if step.op == .generate && (!availableLayerIDs.isEmpty || steps.count != 1) { throw ACError.invalidPlan("Generate a scene in a new empty document.") }
            for value in [step.dx, step.dy, step.angle, step.amount, step.x, step.y, step.width, step.height].compactMap({ $0 }) {
                guard value.isFinite, abs(value) <= 100_000 else { throw ACError.invalidPlan("A numeric parameter is outside its safe range.") }
            }
            if let scale = step.scale, !scale.isFinite || !(0.01...100).contains(scale) { throw ACError.invalidPlan("Scale must be between 0.01 and 100.") }
            if let width = step.width, !(1...30_000).contains(width) { throw ACError.invalidPlan("Width is out of range.") }
            if let height = step.height, !(1...30_000).contains(height) { throw ACError.invalidPlan("Height is out of range.") }
            if let prompt = step.prompt, prompt.utf8.count > 32_768 { throw ACError.invalidPlan("The prompt is too long.") }
            if step.requiresImageProvider && (step.prompt?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) { throw ACError.invalidPlan("Image operations need a prompt.") }
            if step.op == .move && step.dx == nil && step.dy == nil { throw ACError.invalidPlan("A move needs an offset.") }
            if step.op == .transform && step.scale == nil && step.angle == nil { throw ACError.invalidPlan("A transform needs a scale or angle.") }
            if step.op == .recolor {
                guard let color = step.color, Self.rgb(color) != nil else { throw ACError.invalidPlan("Recolor requires a six-digit hexadecimal color.") }
            }
            if step.op == .rename, (step.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) || (step.name?.utf8.count ?? 0) > 1_024 { throw ACError.invalidPlan("A layer name is missing or too long.") }
            if [.blur, .harmonize, .shadow].contains(step.op), let amount = step.amount, !(0...100).contains(amount) { throw ACError.invalidPlan("Effect strength must be between 0 and 100.") }
        }
    }
    static func rgb(_ hex: String) -> (UInt8, UInt8, UInt8)? {
        let s = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard s.count == 6, s.utf8.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }), let v = UInt32(s, radix: 16) else { return nil }
        return (UInt8(v >> 16), UInt8((v >> 8) & 255), UInt8(v & 255))
    }
}
