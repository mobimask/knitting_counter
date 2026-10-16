import SwiftUI

struct ProjectListView: View {
    @Environment(ProjectStore.self) private var store
    @State private var isAddingProject = false

    var body: some View {
        NavigationStack {
            List {
                if let loadError = store.loadError {
                    Section {
                        Label("Saved projects couldn't be read: \(loadError)", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }
                ForEach(store.projects) { project in
                    NavigationLink(value: project.id) {
                        ProjectRow(project: project)
                    }
                }
                .onDelete(perform: store.delete)
                .onMove(perform: store.move)
            }
            .overlay {
                if store.projects.isEmpty {
                    ContentUnavailableView {
                        Label("No Projects", systemImage: "circle.grid.cross")
                    } description: {
                        Text("Tap + to start counting rows and stitches.")
                    }
                }
            }
            .navigationTitle("Knitting Counter")
            .navigationDestination(for: KnittingProject.ID.self) { id in
                CounterView(projectID: id)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if !store.projects.isEmpty { EditButton() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("New Project", systemImage: "plus") { isAddingProject = true }
                }
            }
            .sheet(isPresented: $isAddingProject) {
                ProjectEditorView(project: KnittingProject(name: ""), isNew: true) { project in
                    store.add(project)
                }
            }
        }
    }
}

private struct ProjectRow: View {
    let project: KnittingProject

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(project.name)
                .font(.headline)
            HStack(spacing: 12) {
                Label("\(project.rows) rows", systemImage: "list.number")
                if let progress = project.repeatProgress {
                    Label(progress.isComplete ? "Done" : "Repeat \(progress.currentRepeat)",
                          systemImage: "repeat")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    ProjectListView()
        .environment(ProjectStore(fileURL: URL.temporaryDirectory.appendingPathComponent("preview.json")))
}
