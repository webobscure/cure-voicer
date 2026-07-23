import ApplicationServices
import AppKit
import CoreGraphics
import Foundation

private enum InputError: LocalizedError {
    case accessibilityPermissionMissing
    case invalidArguments
    case invalidText
    case focusedElementUnavailable
    case accessibilityInsertionFailed(AXError)

    var errorDescription: String? {
        switch self {
        case .accessibilityPermissionMissing:
            "Cure Voicer requires Accessibility permission"
        case .invalidArguments:
            "Expected an input command and base64 encoded UTF-8 text"
        case .invalidText:
            "Input text is not valid base64 encoded UTF-8"
        case .focusedElementUnavailable:
            "The focused text element is unavailable"
        case .accessibilityInsertionFailed(let error):
            "Accessibility insertion failed with code \(error.rawValue)"
        }
    }
}

@main
struct CureVoicerInput {
    static func main() {
        do {
            guard CommandLine.arguments.count >= 2 else { throw InputError.invalidArguments }
            guard AXIsProcessTrusted() else { throw InputError.accessibilityPermissionMissing }
            let command = CommandLine.arguments[1]
            if command == "context" {
                try emitContext()
                return
            }
            guard CommandLine.arguments.count == 3 else { throw InputError.invalidArguments }
            guard
                let data = Data(base64Encoded: CommandLine.arguments[2]),
                let text = String(data: data, encoding: .utf8)
            else { throw InputError.invalidText }

            switch command {
            case "type":
                try typeUnicode(text)
            case "accessibility":
                try insertThroughAccessibility(text)
            default:
                throw InputError.invalidArguments
            }
        } catch {
            fputs("\(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }
}

private struct ApplicationContext: Encodable {
    let applicationName: String?
    let applicationId: String?
    let processId: Int32?
    let isSecureField: Bool
}

private func emitContext() throws {
    let application = NSWorkspace.shared.frontmostApplication
    let system = AXUIElementCreateSystemWide()
    var focusedValue: CFTypeRef?
    let focusedResult = AXUIElementCopyAttributeValue(
        system,
        kAXFocusedUIElementAttribute as CFString,
        &focusedValue
    )
    var isSecureField = false
    if
        focusedResult == .success,
        let focusedValue,
        CFGetTypeID(focusedValue) == AXUIElementGetTypeID()
    {
        let focused = unsafeDowncast(focusedValue, to: AXUIElement.self)
        var subroleValue: CFTypeRef?
        if AXUIElementCopyAttributeValue(
            focused,
            kAXSubroleAttribute as CFString,
            &subroleValue
        ) == .success {
            isSecureField = (subroleValue as? String) == kAXSecureTextFieldSubrole
        }
    }
    let context = ApplicationContext(
        applicationName: application?.localizedName,
        applicationId: application?.bundleIdentifier,
        processId: application?.processIdentifier,
        isSecureField: isSecureField
    )
    let data = try JSONEncoder().encode(context)
    guard let output = String(data: data, encoding: .utf8) else {
        throw InputError.focusedElementUnavailable
    }
    print(output)
}

private func typeUnicode(_ text: String) throws {
    let units = Array(text.utf16)
    for start in stride(from: 0, to: units.count, by: 32) {
        let end = min(start + 32, units.count)
        var chunk = Array(units[start..<end])
        guard
            let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true),
            let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)
        else { throw InputError.focusedElementUnavailable }
        keyDown.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: &chunk)
        keyUp.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: &chunk)
        keyDown.post(tap: .cghidEventTap)
        keyUp.post(tap: .cghidEventTap)
        usleep(2_000)
    }
}

private func insertThroughAccessibility(_ text: String) throws {
    let system = AXUIElementCreateSystemWide()
    var focusedValue: CFTypeRef?
    let focusedResult = AXUIElementCopyAttributeValue(
        system,
        kAXFocusedUIElementAttribute as CFString,
        &focusedValue
    )
    guard
        focusedResult == .success,
        let focusedValue,
        CFGetTypeID(focusedValue) == AXUIElementGetTypeID()
    else { throw InputError.focusedElementUnavailable }
    let focused = unsafeDowncast(focusedValue, to: AXUIElement.self)
    let result = AXUIElementSetAttributeValue(
        focused,
        kAXSelectedTextAttribute as CFString,
        text as CFString
    )
    guard result == .success else { throw InputError.accessibilityInsertionFailed(result) }
}
