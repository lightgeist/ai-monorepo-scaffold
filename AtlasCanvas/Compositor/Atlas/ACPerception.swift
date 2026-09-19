import Foundation
import CoreGraphics
import CoreImage
import Vision

nonisolated struct ACSegment: @unchecked Sendable {
    var label: String
    var mask: CGImage
    var confidence: Double?
    var depth: Double?
    var depthMethod: String?
    var provider: String
    var model: String
    var warnings: [String] = []
}
nonisolated struct ACTextObservation: Codable, Equatable, Sendable {
    var text: String
    var bounds: ACRect
    var confidence: Double
}

actor ACNativePerception {
    static let shared=ACNativePerception()
    private var cachedHash: String?
    private var cachedSegments: [ACSegment] = []

    func segment(_ image: CGImage, maximumObjects: Int = 12) throws -> [ACSegment] {
        guard image.width*image.height <= ACImaging.maximumAIPixels,(1...32).contains(maximumObjects) else { throw ACError.tooLarge }
        try Task.checkCancellation()
        let hash=try ACImaging.hash(image)
        if hash==cachedHash { return Array(cachedSegments.prefix(maximumObjects)) }
        let handler=VNImageRequestHandler(cgImage:image,orientation:.up)
        let request=VNGenerateForegroundInstanceMaskRequest()
        try handler.perform([request])
        guard let observation=request.results?.first,!observation.allInstances.isEmpty else { throw ACError.noObjects }
        var segments:[ACSegment]=[]
        let ci=CIContext()
        for (number,index) in observation.allInstances.prefix(32).enumerated() {
            try Task.checkCancellation()
            let buffer=try observation.generateScaledMaskForImage(forInstances:IndexSet(integer:index),from:handler)
            let input=CIImage(cvPixelBuffer:buffer)
            guard let maskImage=ci.createCGImage(input,from:input.extent) else { continue }
            let mask=try ACImaging.refined(maskImage,guide:image)
            let alpha=try ACImaging.grayValues(mask)
            let occupied=alpha.filter { $0>32 }.count
            guard occupied>max(12,image.width*image.height/20_000),occupied<image.width*image.height*99/100,
                  let box=try ACCompositing.bounds(alpha:alpha,width:image.width,height:image.height,threshold:16)
            else { continue }
            let rect=CGRect(x:box.x,y:box.y,width:box.width,height:box.height)
            let label=try classify(image.cropping(to:rect) ?? image)
            segments.append(ACSegment(label:label.0 ?? "Object \(number+1)",mask:mask,confidence:label.1,
                provider:"Apple Vision",model:"VNGenerateForegroundInstanceMaskRequest + VNClassifyImageRequest",
                warnings:["Confidence describes the crop classification, not mask accuracy.","Depth and hidden shape are not observed by this provider."]))
        }
        guard !segments.isEmpty else { throw ACError.noObjects }
        cachedHash=hash;cachedSegments=segments
        return Array(segments.prefix(maximumObjects))
    }
    private func classify(_ image: CGImage) throws -> (String?,Double?) {
        let request=VNClassifyImageRequest()
        try VNImageRequestHandler(cgImage:image,orientation:.up).perform([request])
        guard let result=request.results?.first,result.confidence>0.1 else { return (nil,nil) }
        let raw=result.identifier.replacingOccurrences(of:"_",with:" ")
        let label=String(raw.prefix(120)).capitalized
        return (label,Double(result.confidence))
    }
    func text(_ image: CGImage) throws -> [ACTextObservation] {
        let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=false
        try VNImageRequestHandler(cgImage:image,orientation:.up).perform([request])
        return (request.results ?? []).prefix(128).compactMap { observation in
            guard let result=observation.topCandidates(1).first else { return nil }
            let b=observation.boundingBox
            return ACTextObservation(text:String(result.string.prefix(4096)),bounds:ACRect(x:b.minX*Double(image.width),y:(1-b.maxY)*Double(image.height),width:b.width*Double(image.width),height:b.height*Double(image.height)),confidence:Double(result.confidence))
        }
    }
}
