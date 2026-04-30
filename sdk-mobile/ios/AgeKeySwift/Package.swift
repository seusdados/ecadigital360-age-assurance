// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "AgeKeySwift",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(name: "AgeKeySwift", targets: ["AgeKeySwift"])
    ],
    targets: [
        .target(name: "AgeKeySwift"),
        .testTarget(name: "AgeKeySwiftTests", dependencies: ["AgeKeySwift"])
    ]
)
