import Foundation

/// RGBA8, premultiplied, top-left origin. This is the only CPU pixel convention in Atlas.
nonisolated struct ACPixels: Equatable, Sendable {
    var width: Int
    var height: Int
    var bytes: [UInt8]
    init(width: Int, height: Int, bytes: [UInt8]) throws {
        guard width > 0, height > 0, width <= 30_000, height <= 30_000,
              width * height <= 100_000_000, bytes.count == width * height * 4 else { throw ACError.invalidPixels }
        self.width = width; self.height = height; self.bytes = bytes
    }
    init(width: Int, height: Int, fill: (UInt8, UInt8, UInt8, UInt8) = (0,0,0,0)) throws {
        guard width > 0, height > 0, width <= 30_000, height <= 30_000, width * height <= 100_000_000 else { throw ACError.invalidPixels }
        self.width = width; self.height = height
        self.bytes = [UInt8](repeating: 0, count: width * height * 4)
        for i in stride(from: 0, to: bytes.count, by: 4) { bytes[i] = fill.0; bytes[i+1] = fill.1; bytes[i+2] = fill.2; bytes[i+3] = fill.3 }
    }
    func validatedPremultiplication() throws {
        for i in stride(from: 0, to: bytes.count, by: 4) {
            if bytes[i] > bytes[i+3] || bytes[i+1] > bytes[i+3] || bytes[i+2] > bytes[i+3] { throw ACError.invalidPixels }
        }
    }
    static func roundedMultiply(_ a: Int, _ b: Int) -> Int { (a * b + 127) / 255 }
    func over(_ background: ACPixels) throws -> ACPixels {
        guard width == background.width, height == background.height else { throw ACError.invalidPixels }
        var output = background
        for i in stride(from: 0, to: bytes.count, by: 4) {
            let inv = 255 - Int(bytes[i+3])
            for c in 0..<4 { output.bytes[i+c] = UInt8(min(255, Int(bytes[i+c]) + Self.roundedMultiply(Int(background.bytes[i+c]), inv))) }
        }
        return output
    }
    /// Models never own edit locality. This clips even a completely nonlocal model result.
    func replacing(with candidate: ACPixels, inside mask: [UInt8]) throws -> ACPixels {
        guard width == candidate.width, height == candidate.height, mask.count == width * height else { throw ACError.invalidPixels }
        var out = self
        for p in mask.indices where mask[p] != 0 {
            let alpha = Int(mask[p]), i = p*4
            for c in 0..<4 { out.bytes[i+c] = UInt8((Int(bytes[i+c])*(255-alpha) + Int(candidate.bytes[i+c])*alpha + 127)/255) }
        }
        return out
    }
    func maxDifference(from other: ACPixels) throws -> Int {
        guard width == other.width, height == other.height else { throw ACError.invalidPixels }
        return zip(bytes, other.bytes).reduce(0) { max($0, abs(Int($1.0)-Int($1.1))) }
    }
}

nonisolated struct ACPeel: Sendable {
    var foreground: ACPixels
    var background: ACPixels
    var originalMask: [UInt8]
    var reconstructedMask: [UInt8]
}

nonisolated enum ACCompositing {
    /// Solve source = foreground OVER reconstructed background, instead of copying edge
    /// pixels that already contain the old background. Raise alpha only as much as required
    /// to keep physical premultiplied colors. Quantization is bounded by one alpha level.
    /// Opaque interiors retain the original source bytes exactly.
    static func peel(source: ACPixels, reconstructed: ACPixels, mask: [UInt8]) throws -> ACPeel {
        guard source.width == reconstructed.width, source.height == reconstructed.height,
              mask.count == source.width * source.height else { throw ACError.invalidPixels }
        try source.validatedPremultiplication(); try reconstructed.validatedPremultiplication()
        var front = try ACPixels(width: source.width, height: source.height)
        var back = reconstructed
        var repair = [UInt8](repeating: 0, count: mask.count)
        for p in mask.indices {
            let i = p*4, ia = Int(source.bytes[i+3])
            guard mask[p] > 0 && ia > 0 else {
                for c in 0..<4 { back.bytes[i+c] = source.bytes[i+c] }
                continue
            }
            repair[p] = 255
            let oldBA = Int(reconstructed.bytes[i+3])
            let bc = (0..<3).map { c -> Double in
                oldBA == 0 ? 0 : min(1, Double(reconstructed.bytes[i+c]) / Double(oldBA))
            }
            var a = Double(mask[p]) / 255 * Double(ia)
            for c in 0..<3 {
                let value = Double(source.bytes[i+c]), b = bc[c]
                if b > 0 { a = max(a, Double(ia) - value / b) }
                if b < 1 { a = max(a, (value - b * Double(ia)) / (1-b)) }
            }
            var alpha = min(ia, max(1, Int(ceil(a))))
            while true {
                let ba = alpha == 255 ? oldBA : min(255, max(0, Int((Double(ia-alpha)*255/Double(255-alpha)).rounded())))
                var bg = [Int](repeating: 0, count: 3), fg = bg
                for c in 0..<3 {
                    bg[c] = Int((bc[c] * Double(ba)).rounded())
                    fg[c] = Int(source.bytes[i+c]) - ACPixels.roundedMultiply(bg[c], 255-alpha)
                }
                if fg.allSatisfy({ $0 >= 0 && $0 <= alpha }) || alpha == ia {
                    for c in 0..<3 {
                        back.bytes[i+c] = UInt8(bg[c])
                        front.bytes[i+c] = UInt8(min(alpha, max(0, fg[c])))
                    }
                    back.bytes[i+3] = UInt8(ba)
                    front.bytes[i+3] = UInt8(alpha)
                    break
                }
                alpha += 1
            }
        }
        return ACPeel(foreground: front, background: back, originalMask: mask, reconstructedMask: repair)
    }
    static func bounds(alpha: [UInt8], width: Int, height: Int, threshold: UInt8 = 0) throws -> ACRect? {
        guard width > 0, height > 0, width <= 30_000, height <= 30_000, alpha.count == width * height else { throw ACError.invalidPixels }
        var minX=width, minY=height, maxX = -1, maxY = -1
        for p in alpha.indices where alpha[p] > threshold {
            let x = p % width, y = p / width
            minX=min(minX,x); maxX=max(maxX,x); minY=min(minY,y); maxY=max(maxY,y)
        }
        guard maxX >= minX else { return nil }
        return ACRect(x: Double(minX), y: Double(minY), width: Double(maxX-minX+1), height: Double(maxY-minY+1))
    }
}
