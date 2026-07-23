// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "CureVoicerAsr",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "cure-voicer-asr", targets: ["CureVoicerAsr"]),
        .executable(name: "cure-voicer-input", targets: ["CureVoicerInput"])
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
        ),
        .executableTarget(name: "CureVoicerInput")
    ]
)
