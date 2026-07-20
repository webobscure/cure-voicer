// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "CureVoicerAsr",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "cure-voicer-asr", targets: ["CureVoicerAsr"])
    ],
    dependencies: [
        .package(
            url: "https://github.com/FluidInference/FluidAudio.git",
            exact: "0.15.5"
        )
    ],
    targets: [
        .executableTarget(
            name: "CureVoicerAsr",
            dependencies: [
                .product(name: "FluidAudio", package: "FluidAudio")
            ]
        )
    ]
)
