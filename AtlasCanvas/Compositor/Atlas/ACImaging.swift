import Foundation
import CoreGraphics
import CoreImage
import ImageIO
import UniformTypeIdentifiers
import CryptoKit

nonisolated enum ACImaging {
    static let maximumAIPixels = 12_000_000
    static let maximumEncodedBytes = 48 * 1024 * 1024
    private static let space = CGColorSpace(name: CGColorSpace.sRGB)!
    private static let ci = CIContext(options: [.workingColorSpace: space, .outputColorSpace: space])

    static func pixels(_ image: CGImage) throws -> ACPixels {
        let w=image.width,h=image.height
        guard w > 0, h > 0, w*h <= 100_000_000,
              let context=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,
                                    bitmapInfo:CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue)
        else { throw ACError.tooLarge }
        context.setBlendMode(.copy)
        context.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
        guard let data=context.data else { throw ACError.invalidPixels }
        return try ACPixels(width:w,height:h,bytes:Array(UnsafeBufferPointer(start:data.assumingMemoryBound(to:UInt8.self),count:w*h*4)))
    }
    static func image(_ pixels: ACPixels) throws -> CGImage {
        guard let provider=CGDataProvider(data:Data(pixels.bytes) as CFData),
              let image=CGImage(width:pixels.width,height:pixels.height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:pixels.width*4,
                space:space,bitmapInfo:CGBitmapInfo(rawValue:CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue),
                provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent) else { throw ACError.invalidPixels }
        return image
    }
    static func gray(_ values: [UInt8], width: Int, height: Int) throws -> CGImage {
        guard width > 0,height > 0,width <= 30_000,height <= 30_000, values.count == width*height,
              let provider=CGDataProvider(data:Data(values) as CFData),
              let image=CGImage(width:width,height:height,bitsPerComponent:8,bitsPerPixel:8,bytesPerRow:width,
                space:CGColorSpaceCreateDeviceGray(),bitmapInfo:[],provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent)
        else { throw ACError.invalidPixels }
        return image
    }
    static func grayValues(_ image: CGImage, width: Int? = nil, height: Int? = nil) throws -> [UInt8] {
        let w=width ?? image.width,h=height ?? image.height
        guard w > 0,h > 0,w <= 30_000,h <= 30_000,w*h <= 100_000_000,
              let context=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w,space:CGColorSpaceCreateDeviceGray(),bitmapInfo:CGImageAlphaInfo.none.rawValue)
        else { throw ACError.invalidPixels }
        context.interpolationQuality = .high
        context.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
        guard let data=context.data else { throw ACError.invalidPixels }
        return Array(UnsafeBufferPointer(start:data.assumingMemoryBound(to:UInt8.self),count:w*h))
    }
    static func asset(_ image: CGImage, name: String) throws -> ImportedImage {
        ImportedImage(image:image,thumbnail:try PixelAdjust.thumbnail(of:image),name:name)
    }
    static func sha256(_ data: Data) -> String { SHA256.hash(data:data).map { String(format:"%02x",$0) }.joined() }
    static func hash(_ image: CGImage) throws -> String {
        let p=try pixels(image)
        // Dimensions are part of identity; 1x4 and 2x2 cannot share an image fingerprint.
        var data=Data("RGBA8-PREMULTIPLIED:\(p.width)x\(p.height):".utf8); data.append(contentsOf:p.bytes)
        return sha256(data)
    }
    static func png(_ image: CGImage) throws -> Data {
        guard image.width*image.height <= 100_000_000 else { throw ACError.tooLarge }
        let data=NSMutableData()
        guard let dest=CGImageDestinationCreateWithData(data,UTType.png.identifier as CFString,1,nil) else { throw ACError.invalidPixels }
        CGImageDestinationAddImage(dest,image,nil)
        guard CGImageDestinationFinalize(dest),data.length <= maximumEncodedBytes else { throw ACError.tooLarge }
        return data as Data
    }
    static func decode(_ data: Data, limit: Int = maximumAIPixels) throws -> CGImage {
        guard data.count <= maximumEncodedBytes,
              let source=CGImageSourceCreateWithData(data as CFData,[kCGImageSourceShouldCache:false] as CFDictionary),
              CGImageSourceGetCount(source)==1,
              let properties=CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any],
              let w=properties[kCGImagePropertyPixelWidth] as? Int,let h=properties[kCGImagePropertyPixelHeight] as? Int,
              w>0,h>0,w<=30_000,h<=30_000,w*h<=limit,
              let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary)
        else { throw ACError.invalidPixels }
        return image
    }
    static func decodeBase64(_ value: String, limit: Int = maximumAIPixels) throws -> CGImage {
        guard value.utf8.count <= maximumEncodedBytes*4/3+4,let data=Data(base64Encoded:value) else { throw ACError.invalidPixels }
        return try decode(data,limit:limit)
    }
    static func resized(_ image: CGImage, width: Int, height: Int) throws -> CGImage {
        guard width>0,height>0,width<=30_000,height<=30_000,width*height<=maximumAIPixels,
              let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,
                bitmapInfo:CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue) else { throw ACError.tooLarge }
        context.interpolationQuality = .high; context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
        guard let result=context.makeImage() else { throw ACError.invalidPixels }; return result
    }
    static func preview(_ image: CGImage, longestSide: Int = 1536) throws -> CGImage {
        let factor=min(1,Double(longestSide)/Double(max(image.width,image.height)))
        if factor==1 { return image }
        return try resized(image,width:max(1,Int(Double(image.width)*factor)),height:max(1,Int(Double(image.height)*factor)))
    }
    static func dilated(_ mask: [UInt8], width: Int, height: Int, radius: Double = 3) throws -> [UInt8] {
        guard radius.isFinite,(0...64).contains(radius) else { throw ACError.invalidPixels }
        let input=CIImage(cgImage:try gray(mask,width:width,height:height))
        let output=input.applyingFilter("CIMorphologyMaximum",parameters:[kCIInputRadiusKey:radius]).cropped(to:input.extent)
        guard let image=ci.createCGImage(output,from:input.extent) else { throw ACError.invalidPixels }
        return try grayValues(image)
    }
    static func refined(_ mask: CGImage, guide: CGImage) throws -> CGImage {
        let refined=try GuidedMatte.refine(mask:mask,guide:guide,radius:3,limit:2_048)
        return try gray(try grayValues(refined,width:guide.width,height:guide.height),width:guide.width,height:guide.height)
    }
    /// The existing Compositor C texture synthesizer. This is a local, non-neural repair,
    /// not mislabeled generative-model output. AI generative repair is a separate provider.
    static func textureFill(_ image: CGImage, mask: [UInt8]) throws -> CGImage {
        let p=try pixels(image),w=p.width,h=p.height
        guard mask.count==w*h,w*h<=maximumAIPixels else { throw ACError.invalidPixels }
        let hard=mask.map { $0 > 8 ? UInt8(255) : 0 }
        let count=hard.filter { $0 != 0 }.count
        if count==0 { return image }
        guard count < w*h*95/100 else { throw ACError.provider("Too little surrounding image remains for local texture repair. Use generative repair or a smaller selection.") }
        // Work at a bounded resolution; exact original pixels outside the repair stay intact.
        let small=try preview(image,longestSide:1024)
        var output=try pixels(small)
        let maskImage=try gray(hard,width:w,height:h)
        var workMask=try grayValues(maskImage,width:small.width,height:small.height).map { $0 > 8 ? UInt8(255) : 0 }
        let result=output.bytes.withUnsafeMutableBufferPointer { rgba in
            workMask.withUnsafeMutableBufferPointer { m in
                content_fill(rgba.baseAddress!,small.width*4,m.baseAddress!,small.width,Int32(small.width),Int32(small.height))
            }
        }
        guard result==1 else { throw ACError.provider("Local texture repair found insufficient opaque source pixels.") }
        let candidate=try resized(self.image(output),width:w,height:h)
        return try self.image(p.replacing(with:pixels(candidate),inside:hard))
    }
    static func cropAlpha(_ image: CGImage, name: String) throws -> (ImportedImage, CGPoint) {
        let p=try pixels(image),alpha=stride(from:3,to:p.bytes.count,by:4).map { p.bytes[$0] }
        guard let bounds=try ACCompositing.bounds(alpha:alpha,width:p.width,height:p.height),
              let cropped=image.cropping(to:CGRect(x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height)) else { throw ACError.noObjects }
        return (try asset(cropped,name:name),CGPoint(x:bounds.x,y:bounds.y))
    }
    static func alpha(_ image: CGImage) throws -> [UInt8] {
        let p=try pixels(image);return stride(from:3,to:p.bytes.count,by:4).map { p.bytes[$0] }
    }
    static func recolor(_ image: CGImage, hex: String) throws -> CGImage {
        guard let color=ACPlan.rgb(hex) else { throw ACError.invalidPlan("Invalid color") }
        var p=try pixels(image)
        let rgb=[Double(color.0),Double(color.1),Double(color.2)]
        // Retain local luminance variation (texture/highlights), not a flat color silhouette.
        for i in stride(from:0,to:p.bytes.count,by:4) where p.bytes[i+3]>0 {
            let a=Double(p.bytes[i+3])/255
            let luminance=(0.2126*Double(p.bytes[i])+0.7152*Double(p.bytes[i+1])+0.0722*Double(p.bytes[i+2]))/a/255
            let shade=0.45+0.9*luminance
            for c in 0..<3 { p.bytes[i+c]=UInt8(min(Double(p.bytes[i+3]),max(0,(rgb[c]*shade*a).rounded()))) }
        }
        return try self.image(p)
    }
    static func blur(_ image: CGImage, radius: Double) throws -> CGImage {
        guard radius.isFinite,(0...100).contains(radius) else { throw ACError.invalidPixels }
        let input=CIImage(cgImage:image)
        guard let output=ci.createCGImage(input.clampedToExtent().applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:radius]).cropped(to:input.extent),from:input.extent) else { throw ACError.invalidPixels }
        return output
    }
    static func harmonize(_ image: CGImage, reference: CGImage, strength: Double) throws -> CGImage {
        let s=max(0,min(1,strength/100)),small=try pixels(preview(reference,longestSide:128))
        var total=[Double](repeating:0,count:3),weight=0.0
        for i in stride(from:0,to:small.bytes.count,by:4) { let a=Double(small.bytes[i+3])/255; weight+=a;for c in 0..<3 { total[c]+=Double(small.bytes[i+c]) } }
        guard weight>0 else { return image }
        let mean=total.map { $0/weight },neutral=mean.reduce(0,+)/3
        var p=try pixels(image)
        for i in stride(from:0,to:p.bytes.count,by:4) where p.bytes[i+3]>0 {
            for c in 0..<3 { let gain=(mean[c]+32)/(neutral+32);p.bytes[i+c]=UInt8(max(0,min(Double(p.bytes[i+3]),(Double(p.bytes[i+c])*(1+s*(gain-1))).rounded()))) }
        }
        return try self.image(p)
    }
}
