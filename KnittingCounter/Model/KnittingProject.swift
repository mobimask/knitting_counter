import Foundation

/// A single knitting project with its row, stitch and pattern-repeat counters.
///
/// `rows` and `stitches` count work that is already done, so a fresh project starts at 0.
struct KnittingProject: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var name: String
    var rows: Int
    var stitches: Int
    /// Rows in one pattern repeat. `nil` turns repeat tracking off.
    var rowsPerRepeat: Int?
    /// How many times the pattern is repeated. `nil` means open-ended.
    var totalRepeats: Int?
    /// Clear the stitch counter whenever a row is added.
    var resetStitchesOnNewRow: Bool
    var notes: String
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        rows: Int = 0,
        stitches: Int = 0,
        rowsPerRepeat: Int? = nil,
        totalRepeats: Int? = nil,
        resetStitchesOnNewRow: Bool = true,
        notes: String = "",
        createdAt: Date = Date(),
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.rows = max(0, rows)
        self.stitches = max(0, stitches)
        self.rowsPerRepeat = rowsPerRepeat
        self.totalRepeats = totalRepeats
        self.resetStitchesOnNewRow = resetStitchesOnNewRow
        self.notes = notes
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
    }

    // MARK: - Counting

    mutating func incrementRow(now: Date = Date()) {
        rows += 1
        if resetStitchesOnNewRow { stitches = 0 }
        updatedAt = now
    }

    mutating func decrementRow(now: Date = Date()) {
        guard rows > 0 else { return }
        rows -= 1
        updatedAt = now
    }

    mutating func incrementStitch(now: Date = Date()) {
        stitches += 1
        updatedAt = now
    }

    mutating func decrementStitch(now: Date = Date()) {
        guard stitches > 0 else { return }
        stitches -= 1
        updatedAt = now
    }

    mutating func resetCounts(now: Date = Date()) {
        rows = 0
        stitches = 0
        updatedAt = now
    }

    // MARK: - Pattern repeats

    /// Where the knitter is within the pattern repeat, or `nil` when repeats aren't tracked.
    var repeatProgress: RepeatProgress? {
        guard let rowsPerRepeat, rowsPerRepeat > 0 else { return nil }
        let total = totalRepeats.flatMap { $0 > 0 ? $0 : nil }

        if let total, rows >= rowsPerRepeat * total {
            return RepeatProgress(
                currentRepeat: total,
                rowInRepeat: rowsPerRepeat,
                rowsPerRepeat: rowsPerRepeat,
                totalRepeats: total,
                isComplete: true
            )
        }
        return RepeatProgress(
            currentRepeat: rows / rowsPerRepeat + 1,
            rowInRepeat: rows % rowsPerRepeat + 1,
            rowsPerRepeat: rowsPerRepeat,
            totalRepeats: total,
            isComplete: false
        )
    }
}

/// Position inside a pattern repeat. Both `currentRepeat` and `rowInRepeat` are 1-based and
/// describe the row the knitter is about to work.
struct RepeatProgress: Equatable {
    let currentRepeat: Int
    let rowInRepeat: Int
    let rowsPerRepeat: Int
    let totalRepeats: Int?
    let isComplete: Bool

    /// Fraction of all repeats finished, when the total is known.
    var overallFraction: Double? {
        guard let totalRepeats, totalRepeats > 0 else { return nil }
        if isComplete { return 1 }
        let rowsDone = (currentRepeat - 1) * rowsPerRepeat + (rowInRepeat - 1)
        return Double(rowsDone) / Double(totalRepeats * rowsPerRepeat)
    }

    /// Fraction of the current repeat finished.
    var repeatFraction: Double {
        isComplete ? 1 : Double(rowInRepeat - 1) / Double(rowsPerRepeat)
    }
}

/// Reads and writes the saved project list.
enum ProjectArchive {
    static func encode(_ projects: [KnittingProject]) throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(projects)
    }

    static func decode(_ data: Data) throws -> [KnittingProject] {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([KnittingProject].self, from: data)
    }
}
