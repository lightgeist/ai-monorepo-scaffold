import Foundation
import Testing
@testable import AtlasCanvasCore

@Test func sourceRecompositionAndLocality() throws {
    var rng = SeededGenerator(seed: 0xA71A5)
    for transparent in [false, true] {
        for _ in 0..<20 {
            let w=19,h=13
            var source = try ACPixels(width:w,height:h), back=source
            var mask = [UInt8](repeating:0,count:w*h)
            for p in mask.indices {
                let ia = transparent ? UInt8.random(in:0...255,using:&rng) : 255
                let ba = UInt8.random(in:0...255,using:&rng)
                for c in 0..<3 {
                    source.bytes[p*4+c] = UInt8.random(in:0...ia,using:&rng)
                    back.bytes[p*4+c] = UInt8.random(in:0...ba,using:&rng)
                }
                source.bytes[p*4+3]=ia; back.bytes[p*4+3]=ba
                mask[p] = p % 7 == 0 ? 0 : UInt8.random(in:0...255,using:&rng)
            }
            let peeled=try ACCompositing.peel(source:source,reconstructed:back,mask:mask)
            let result=try peeled.foreground.over(peeled.background)
            #expect(try result.maxDifference(from:source) <= 1)
            try peeled.foreground.validatedPremultiplication()
            try peeled.background.validatedPremultiplication()
            for p in mask.indices where mask[p] == 0 {
                #expect(Array(peeled.background.bytes[p*4..<p*4+4]) == Array(source.bytes[p*4..<p*4+4]))
                #expect(peeled.foreground.bytes[p*4+3] == 0)
            }
        }
    }
}
@Test func opaquePixelsAreOriginal() throws {
    let source=try ACPixels(width:3,height:1,bytes:[31,42,93,255, 140,8,18,255, 7,9,3,255])
    let back=try ACPixels(width:3,height:1,fill:(200,200,200,255))
    let peeled=try ACCompositing.peel(source:source,reconstructed:back,mask:[255,0,255])
    #expect(peeled.foreground.bytes[0..<4] == source.bytes[0..<4])
    #expect(peeled.foreground.bytes[8..<12] == source.bytes[8..<12])
    #expect(try peeled.foreground.over(peeled.background) == source)
}
@Test func adversarialNonlocalEditIsClipped() throws {
    let source=try ACPixels(width:3,height:1,fill:(10,20,30,255))
    let candidate=try ACPixels(width:3,height:1,fill:(255,0,255,255))
    let result=try source.replacing(with:candidate,inside:[0,255,0])
    #expect(result.bytes == [10,20,30,255,255,0,255,255,10,20,30,255])
}
@Test func rejectBrokenInputs() throws {
    #expect(throws: ACError.self) { try ACPixels(width:-1,height:1) }
    #expect(throws: ACError.self) { try ACPixels(width:1,height:1,bytes:[]) }
    #expect(throws: ACError.self) { try ACCompositing.peel(source:ACPixels(width:2,height:1),reconstructed:ACPixels(width:1,height:1),mask:[0]) }
    #expect(throws: ACError.self) { try ACPixels(width:1,height:1,bytes:[255,0,0,1]).validatedPremultiplication() }
}
@Test func sceneValidationAndCycleRejection() throws {
    let a=UUID(),b=UUID(),s=UUID()
    var scene=ACScene(sourceAssetID:s,sourceSHA256:String(repeating:"a",count:64),objects:[ACObject(id:a,label:"Chair",bounds:ACRect(x:0,y:0,width:5,height:5)),ACObject(id:b,label:"Shadow",role:.shadow,bounds:ACRect(x:0,y:0,width:5,height:5))])
    try scene.validated(layerIDs:[a,b],assetIDs:[s])
    scene.relationships = [ACRelation(source:a,target:b,kind:.follows,basis:"user"),ACRelation(source:b,target:a,kind:.follows,basis:"user")]
    #expect(throws: ACError.cyclicDependency) { try scene.validated(layerIDs:[a,b],assetIDs:[s]) }
    scene.relationships=[]; scene.objects[0].confidence=Double.nan
    #expect(throws: ACError.self) { try scene.validated(layerIDs:[a,b],assetIDs:[s]) }
}
@Test func plansRejectUnknownProtectedAndDeletedTargets() throws {
    let id=UUID()
    let object=ACObject(id:id,label:"Chair",bounds:ACRect(x:0,y:0,width:5,height:5))
    try ACPlan(summary:"Move",steps:[ACAction(op:.move,target:id,dx:10)]).validate(objects:[object],availableLayerIDs:[id])
    #expect(throws: ACError.self) { try ACPlan(summary:"Bad",steps:[ACAction(op:.move,target:UUID(),dx:10)]).validate(objects:[object],availableLayerIDs:[id]) }
    var protected=object; protected.protected=true
    #expect(throws: ACError.self) { try ACPlan(summary:"Bad",steps:[ACAction(op:.delete,target:id)]).validate(objects:[protected],availableLayerIDs:[id]) }
    #expect(throws: ACError.self) { try ACPlan(summary:"Bad",steps:[ACAction(op:.delete,target:id),ACAction(op:.move,target:id,dx:1)]).validate(objects:[object],availableLayerIDs:[id]) }
    #expect(throws: (any Error).self) { try JSONDecoder().decode(ACPlan.self,from:Data(#"{"summary":"Bad","steps":[{"op":"shell","prompt":"rm -rf"}]}"#.utf8)) }
}
@Test func planBudgetAndWireRoundtrip() throws {
    let id=UUID(), p=ACPlan(summary:"Silver chair",steps:[ACAction(op:.recolor,target:id,color:"#c0c0c0"),ACAction(op:.move,target:id,dx:42,dy:-8)])
    #expect(try JSONDecoder().decode(ACPlan.self,from:JSONEncoder().encode(p)) == p)
    #expect(throws: ACError.self) { try ACPlan(summary:"Bad",steps:[ACAction(op:.add,prompt:"chair"),ACAction(op:.add,prompt:"chair")]).validate(objects:[],availableLayerIDs:[],imageCallLimit:1) }
    #expect(ACPlan.rgb("abcdef") != nil)
    #expect(ACPlan.rgb("zz0000") == nil)
}
@Test func boundsUseTopLeftCoordinates() throws {
    #expect(try ACCompositing.bounds(alpha:[0,0,255,0,0,255],width:3,height:2) == ACRect(x:2,y:0,width:1,height:2))
    #expect(try ACCompositing.bounds(alpha:[0,0],width:1,height:2) == nil)
}
private struct SeededGenerator: RandomNumberGenerator { var seed: UInt64; mutating func next()->UInt64 { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return seed } }
