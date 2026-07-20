import FluidAudio
import Foundation

private let protocolPrefix = "CVJSON:"

private struct Request: Decodable {
    let id: String
    let type: String
    let audioPath: String?
}

private struct Response: Encodable {
    let id: String?
    let event: String?
    let text: String?
    let error: String?

    static func ready() -> Response {
        Response(id: nil, event: "ready", text: nil, error: nil)
    }

    static func transcription(id: String, text: String) -> Response {
        Response(id: id, event: nil, text: text, error: nil)
    }

    static func failure(id: String?, error: Error) -> Response {
        Response(id: id, event: nil, text: nil, error: error.localizedDescription)
    }
}

private func emit(_ response: Response) {
    do {
        let data = try JSONEncoder().encode(response)
        guard let json = String(data: data, encoding: .utf8) else { return }
        print(protocolPrefix + json)
        fflush(stdout)
    } catch {
        fputs("Failed to encode protocol response: \(error)\n", stderr)
    }
}

@main
struct CureVoicerAsr {
    static func main() async {
        do {
            let models = try await AsrModels.downloadAndLoad(version: .v3)
            let manager = AsrManager(config: .default)
            try await manager.loadModels(models)
            emit(.ready())

            while let line = readLine() {
                guard let data = line.data(using: .utf8) else { continue }

                do {
                    let request = try JSONDecoder().decode(Request.self, from: data)
                    guard request.type == "transcribe", let audioPath = request.audioPath else {
                        throw ProtocolError.invalidRequest
                    }

                    let audioURL = URL(fileURLWithPath: audioPath)
                    var decoderState = TdtDecoderState.make(
                        decoderLayers: await manager.decoderLayerCount
                    )
                    let result = try await manager.transcribe(
                        audioURL,
                        decoderState: &decoderState
                    )
                    emit(.transcription(id: request.id, text: result.text))
                } catch {
                    let requestId = try? JSONDecoder().decode(Request.self, from: data).id
                    emit(.failure(id: requestId, error: error))
                }
            }
        } catch {
            emit(.failure(id: nil, error: error))
            exit(EXIT_FAILURE)
        }
    }
}

private enum ProtocolError: LocalizedError {
    case invalidRequest

    var errorDescription: String? {
        "Invalid ASR helper request"
    }
}
