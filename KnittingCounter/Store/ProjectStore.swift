import Foundation
import Observation

/// Holds every project and saves the list to disk after each change.
@MainActor
@Observable
final class ProjectStore {
    private(set) var projects: [KnittingProject] = []
    private(set) var loadError: String?

    private let fileURL: URL

    init(fileURL: URL = ProjectStore.defaultFileURL) {
        self.fileURL = fileURL
        load()
    }

    static var defaultFileURL: URL {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return directory.appendingPathComponent("projects.json")
    }

    func project(id: KnittingProject.ID) -> KnittingProject? {
        projects.first { $0.id == id }
    }

    func add(_ project: KnittingProject) {
        projects.insert(project, at: 0)
        save()
    }

    func update(_ id: KnittingProject.ID, _ change: (inout KnittingProject) -> Void) {
        guard let index = projects.firstIndex(where: { $0.id == id }) else { return }
        change(&projects[index])
        save()
    }

    func replace(_ project: KnittingProject) {
        update(project.id) { $0 = project }
    }

    func delete(at offsets: IndexSet) {
        projects.remove(atOffsets: offsets)
        save()
    }

    func move(from source: IndexSet, to destination: Int) {
        projects.move(fromOffsets: source, toOffset: destination)
        save()
    }

    // MARK: - Persistence

    private func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            projects = try ProjectArchive.decode(Data(contentsOf: fileURL))
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func save() {
        // Never overwrite a file we failed to read, or the user's projects would be lost.
        guard loadError == nil else { return }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try ProjectArchive.encode(projects).write(to: fileURL, options: .atomic)
        } catch {
            print("Failed to save projects: \(error)")
        }
    }
}
