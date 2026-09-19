import Foundation
import AppKit
import Testing
@testable import Compositor

@MainActor
struct AtlasImagingTests {
    @Test func pixelOrientationAndPNGReadback() throws {
        let p=try ACPixels(width:2,height:2,bytes:[255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255])
        let image=try ACImaging.image(p)
        #expect(try ACImaging.pixels(image)==p)
        let data=try ACImaging.png(image)
        let bitmap=try #require(NSBitmapImageRep(data:data))
        let top=try #require(bitmap.colorAt(x:0,y:0)?.usingColorSpace(.sRGB))
        let bottom=try #require(bitmap.colorAt(x:0,y:1)?.usingColorSpace(.sRGB))
        #expect(top.redComponent>0.99 && top.blueComponent<0.01)
        #expect(bottom.blueComponent>0.99 && bottom.redComponent<0.01)
        #expect(try ACImaging.pixels(ACImaging.decode(data))==p)
        let cropped=try #require(image.cropping(to:CGRect(x:0,y:1,width:1,height:1)))
        #expect(try ACImaging.pixels(cropped).bytes == [0,0,255,255])
    }
    @Test func localFillPreservesUnselectedSource() throws {
        var p=try ACPixels(width:64,height:48,fill:(70,90,110,255))
        var mask=[UInt8](repeating:0,count:64*48)
        for y in 16..<30 { for x in 20..<36 { let i=y*64+x;mask[i]=255;p.bytes[i*4]=220;p.bytes[i*4+1]=20;p.bytes[i*4+2]=20 } }
        let out=try ACImaging.pixels(ACImaging.textureFill(ACImaging.image(p),mask:mask))
        for i in mask.indices where mask[i]==0 { #expect(out.bytes[i*4..<i*4+4]==p.bytes[i*4..<i*4+4]) }
        #expect(out.bytes[(20*64+25)*4] < 130)
    }
    @Test func malformedEncodedImagesAreRejected() throws {
        #expect(throws:ACError.self) { try ACImaging.decodeBase64("not-base64") }
        #expect(throws:ACError.self) { try ACImaging.decode(Data("not a png".utf8)) }
        #expect(throws:ACError.self) { try ACImaging.resized(ACImaging.image(ACPixels(width:1,height:1)),width:0,height:1) }
    }
    @Test func visionRunsOnActualPhotograph() async throws {
        let url=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/coffee.png")
        let data=try Data(contentsOf:url)
        let image=try ACImaging.decode(data)
        let start=Date()
        let segments=try await ACNativePerception.shared.segment(image)
        #expect(!segments.isEmpty)
        for segment in segments {
            #expect(segment.mask.width==image.width && segment.mask.height==image.height)
            let alpha=try ACImaging.grayValues(segment.mask)
            #expect(alpha.contains { $0>200 });#expect(alpha.contains { $0<10 })
            #expect(!segment.label.isEmpty)
        }
        print("ATLAS_LIVE_VISION coffee objects=\(segments.count) labels=\(segments.map(\.label)) seconds=\(Date().timeIntervalSince(start))")
    }
}
