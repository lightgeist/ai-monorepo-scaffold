import Foundation

/// Portable document intelligence. Layer IDs remain the single source of object identity.
nonisolated struct ACRect: Codable, Equatable, Sendable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var isValid: Bool { [x, y, width, height].allSatisfy(\.isFinite) && width >= 0 && height >= 0 && abs(x) <= 1_000_000 && abs(y) <= 1_000_000 && width <= 100_000 && height <= 100_000 }
}

nonisolated enum ACProvenance: String, Codable, CaseIterable, Sendable {
    case original, reconstructed, generated, userEdited = "user-edited"
}

nonisolated enum ACRole: String, Codable, Sendable { case object, background, shadow, reflection, text }

nonisolated struct ACObject: Codable, Equatable, Identifiable, Sendable {
    var id: UUID                  // Same UUID as ImageLayer.id, never a second object ID.
    var label: String
    var role: ACRole = .object
    var bounds: ACRect
    var confidence: Double?
    var depth: Double?            // Relative inverse depth, not metric distance.
    var depthMethod: String?
    var provenance: ACProvenance = .original
    var prompt: String = ""
    var protected = false
    var geometryIsStale = false
    var reconstructionMaskID: UUID?
    var originalMaskID: UUID?
    var completion: String = "visible-only"
    var warnings: [String] = []
}

nonisolated enum ACRelationKind: String, Codable, Sendable {
    case occludes, restsOn = "rests-on", heldBy = "held-by", casts, reflectsIn = "reflects-in", illuminates, follows
}
nonisolated struct ACRelation: Codable, Equatable, Sendable {
    var source: UUID
    var target: UUID
    var kind: ACRelationKind
    var confidence: Double?
    var basis: String
}

nonisolated struct ACReceipt: Codable, Equatable, Identifiable, Sendable {
    var id: UUID = UUID()
    var operation: String
    var provider: String
    var model: String
    var inputHash: String
    var outputHash: String
    var timestamp: String
    var warnings: [String] = []
}

nonisolated struct ACScene: Codable, Equatable, Sendable {
    var version = 1
    var sourceAssetID: UUID?
    var sourceSHA256: String
    var objects: [ACObject]
    var relationships: [ACRelation] = []
    var receipts: [ACReceipt] = []
    var warnings: [String] = []

    func validated(layerIDs: Set<UUID>, assetIDs: Set<UUID>) throws {
        guard version == 1, objects.count <= 512, relationships.count <= 4_096, receipts.count <= 512,
              warnings.count <= 128, warnings.allSatisfy({ $0.utf8.count <= 4_096 }),
              sourceSHA256.isEmpty || Self.isHash(sourceSHA256) else { throw ACError.invalidScene }
        if let sourceAssetID, !assetIDs.contains(sourceAssetID) { throw ACError.missingAsset }
        let ids = Set(objects.map(\.id))
        guard ids.count == objects.count, ids.isSubset(of: layerIDs) else { throw ACError.invalidScene }
        for object in objects {
            guard !object.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  object.label.utf8.count <= 1_024, object.prompt.utf8.count <= 32_768,
                  object.bounds.isValid, Self.probability(object.confidence),
                  object.depth.map({ $0.isFinite && $0 >= 0 && $0 <= 1 }) ?? true,
                  object.warnings.count <= 64, object.warnings.allSatisfy({ $0.utf8.count <= 4_096 }),
                  object.completion.utf8.count <= 1_024, (object.depthMethod?.utf8.count ?? 0) <= 1_024
            else { throw ACError.invalidScene }
            for asset in [object.reconstructionMaskID, object.originalMaskID].compactMap({ $0 }) {
                guard assetIDs.contains(asset) else { throw ACError.missingAsset }
            }
        }
        for relation in relationships {
            guard ids.contains(relation.source), ids.contains(relation.target), relation.source != relation.target,
                  Self.probability(relation.confidence), relation.basis.utf8.count <= 4_096 else { throw ACError.invalidScene }
        }
        // Only dependency edges must be acyclic. Physical relations need not form a DAG.
        let follows = relationships.filter { $0.kind == .follows }
        var visiting = Set<UUID>(), visited = Set<UUID>()
        func visit(_ id: UUID) throws {
            if visited.contains(id) { return }
            guard visiting.insert(id).inserted else { throw ACError.cyclicDependency }
            for edge in follows where edge.source == id { try visit(edge.target) }
            visiting.remove(id); visited.insert(id)
        }
        for id in ids { try visit(id) }
        for receipt in receipts {
            guard receipt.operation.utf8.count <= 1_024, receipt.provider.utf8.count <= 1_024,
                  receipt.model.utf8.count <= 1_024, receipt.timestamp.utf8.count <= 128,
                  Self.isHash(receipt.inputHash), Self.isHash(receipt.outputHash),
                  receipt.warnings.count <= 64, receipt.warnings.allSatisfy({ $0.utf8.count <= 4_096 }) else { throw ACError.invalidScene }
        }
    }
    static func probability(_ value: Double?) -> Bool { value.map { $0.isFinite && (0...1).contains($0) } ?? true }
    static func isHash(_ value: String) -> Bool { value.count == 64 && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) } }
    mutating func remove(_ ids: Set<UUID>) {
        objects.removeAll { ids.contains($0.id) }
        relationships.removeAll { ids.contains($0.source) || ids.contains($0.target) }
    }
    mutating func append(_ receipt: ACReceipt) {
        receipts.append(receipt)
        if receipts.count > 512 { receipts.removeFirst(receipts.count - 512) }
    }
}

nonisolated enum ACError: Error, LocalizedError, Equatable, Sendable {
    case invalidScene, missingAsset, cyclicDependency, invalidPixels, invalidPlan(String), provider(String), cancelled, staleDocument, tooLarge, noObjects, configuration(String)
    var errorDescription: String? {
        switch self {
        case .invalidScene: "The scene metadata is invalid. The current document is unchanged."
        case .missingAsset: "A required scene asset is missing. The current document is unchanged."
        case .cyclicDependency: "The scene contains a cyclic effect dependency."
        case .invalidPixels: "The image or mask dimensions are invalid."
        case .invalidPlan(let message): "The edit plan was not applied: \(message)"
        case .provider(let message): "The AI provider could not complete this operation: \(message)"
        case .cancelled: "The operation was cancelled."
        case .staleDocument: "The document changed during this operation. Run it again on the current image."
        case .tooLarge: "This operation exceeds the configured image or memory limit. Reduce the image size or number of objects."
        case .noObjects: "No reliable objects were found. Try selecting a region, use a different segmentation provider, or refine the image manually."
        case .configuration(let message): message
        }
    }
}
