import XCTest
@testable import KnittingCore

final class KnittingProjectTests: XCTestCase {
    func testRowAndStitchCounting() {
        var project = KnittingProject(name: "Scarf")
        project.incrementStitch()
        project.incrementStitch()
        XCTAssertEqual(project.stitches, 2)

        project.incrementRow()
        XCTAssertEqual(project.rows, 1)
        XCTAssertEqual(project.stitches, 0, "Stitches reset on a new row by default")

        project.resetStitchesOnNewRow = false
        project.incrementStitch()
        project.incrementRow()
        XCTAssertEqual(project.stitches, 1)
    }

    func testCountsNeverGoNegative() {
        var project = KnittingProject(name: "Hat")
        project.decrementRow()
        project.decrementStitch()
        XCTAssertEqual(project.rows, 0)
        XCTAssertEqual(project.stitches, 0)
    }

    func testResetCounts() {
        var project = KnittingProject(name: "Hat", rows: 12, stitches: 7)
        project.resetCounts()
        XCTAssertEqual(project.rows, 0)
        XCTAssertEqual(project.stitches, 0)
    }

    func testNoRepeatProgressWhenNotTracked() {
        XCTAssertNil(KnittingProject(name: "Plain", rows: 5).repeatProgress)
        XCTAssertNil(KnittingProject(name: "Zero", rows: 5, rowsPerRepeat: 0).repeatProgress)
    }

    func testRepeatProgressAtStart() {
        let progress = KnittingProject(name: "Cable", rowsPerRepeat: 8, totalRepeats: 12).repeatProgress
        XCTAssertEqual(progress?.currentRepeat, 1)
        XCTAssertEqual(progress?.rowInRepeat, 1)
        XCTAssertEqual(progress?.isComplete, false)
        XCTAssertEqual(progress?.overallFraction, 0)
    }

    func testRepeatProgressMidPattern() {
        // 13 rows done with an 8-row repeat: repeat 1 finished, 5 rows into repeat 2.
        let progress = KnittingProject(name: "Cable", rows: 13, rowsPerRepeat: 8, totalRepeats: 12).repeatProgress
        XCTAssertEqual(progress?.currentRepeat, 2)
        XCTAssertEqual(progress?.rowInRepeat, 6)
        XCTAssertEqual(progress?.repeatFraction, 5.0 / 8.0)
        XCTAssertEqual(progress?.overallFraction, 13.0 / 96.0)
    }

    func testRepeatBoundary() {
        let progress = KnittingProject(name: "Cable", rows: 8, rowsPerRepeat: 8).repeatProgress
        XCTAssertEqual(progress?.currentRepeat, 2)
        XCTAssertEqual(progress?.rowInRepeat, 1)
        XCTAssertNil(progress?.totalRepeats)
        XCTAssertNil(progress?.overallFraction)
    }

    func testRepeatsComplete() {
        let progress = KnittingProject(name: "Cable", rows: 30, rowsPerRepeat: 4, totalRepeats: 6).repeatProgress
        XCTAssertEqual(progress?.isComplete, true)
        XCTAssertEqual(progress?.currentRepeat, 6)
        XCTAssertEqual(progress?.overallFraction, 1)
    }

    func testArchiveRoundTrip() throws {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let projects = [
            KnittingProject(name: "Socks", rows: 40, stitches: 3, rowsPerRepeat: 4, totalRepeats: nil,
                            resetStitchesOnNewRow: false, notes: "2.5mm", createdAt: date),
            KnittingProject(name: "Blanket", createdAt: date),
        ]
        let decoded = try ProjectArchive.decode(ProjectArchive.encode(projects))
        XCTAssertEqual(decoded, projects)
    }
}
