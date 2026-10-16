// swift-tools-version:5.9
// Lets the counting logic be tested with `swift test`, without a simulator.
// The app itself is built from KnittingCounter.xcodeproj.
import PackageDescription

let package = Package(
    name: "KnittingCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    targets: [
        .target(name: "KnittingCore", path: "KnittingCounter/Model"),
        .testTarget(name: "KnittingCoreTests", dependencies: ["KnittingCore"], path: "Tests/KnittingCoreTests"),
    ]
)
