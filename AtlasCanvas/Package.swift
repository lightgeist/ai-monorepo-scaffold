// swift-tools-version: 6.2
import PackageDescription
let package = Package(name: "AtlasCanvasCore", products: [.library(name: "AtlasCanvasCore", targets: ["AtlasCanvasCore"])], targets: [
    .target(name: "AtlasCanvasCore", path: "Compositor/Atlas/Core"),
    .testTarget(name: "AtlasCanvasCoreTests", dependencies: ["AtlasCanvasCore"], path: "CoreTests")
])
