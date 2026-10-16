import SwiftUI

struct CounterView: View {
    @Environment(ProjectStore.self) private var store
    let projectID: KnittingProject.ID

    @State private var isEditing = false
    @State private var isConfirmingReset = false

    var body: some View {
        if let project = store.project(id: projectID) {
            counter(for: project)
        } else {
            ContentUnavailableView("Project Not Found", systemImage: "questionmark.circle")
        }
    }

    private func counter(for project: KnittingProject) -> some View {
        VStack(spacing: 16) {
            if let progress = project.repeatProgress {
                RepeatCard(progress: progress)
            }

            rowCounter(project)

            stitchCounter(project)
        }
        .padding()
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu("More", systemImage: "ellipsis.circle") {
                    Button("Edit Project", systemImage: "pencil") { isEditing = true }
                    Button("Reset Counters", systemImage: "arrow.counterclockwise", role: .destructive) {
                        isConfirmingReset = true
                    }
                }
            }
        }
        .confirmationDialog("Reset rows and stitches to 0?", isPresented: $isConfirmingReset, titleVisibility: .visible) {
            Button("Reset", role: .destructive) { store.update(projectID) { $0.resetCounts() } }
        }
        .sheet(isPresented: $isEditing) {
            ProjectEditorView(project: project, isNew: false) { store.replace($0) }
        }
        .sensoryFeedback(.increase, trigger: project.rows)
        .sensoryFeedback(.selection, trigger: project.stitches)
        // Keep the screen on while the knitter's hands are busy.
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }

    private func rowCounter(_ project: KnittingProject) -> some View {
        VStack(spacing: 12) {
            Button {
                store.update(projectID) { $0.incrementRow() }
            } label: {
                VStack(spacing: 4) {
                    Text("ROWS")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("\(project.rows)")
                        .font(.system(size: 96, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(project.rows)))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text("Tap to add a row")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.tint.opacity(0.12), in: .rect(cornerRadius: 24))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Rows: \(project.rows)")
            .accessibilityHint("Adds one row")

            Button {
                store.update(projectID) { $0.decrementRow() }
            } label: {
                Label("Undo Row", systemImage: "minus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .disabled(project.rows == 0)
        }
        .animation(.snappy, value: project.rows)
    }

    private func stitchCounter(_ project: KnittingProject) -> some View {
        HStack {
            Button {
                store.update(projectID) { $0.decrementStitch() }
            } label: {
                Image(systemName: "minus")
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.bordered)
            .disabled(project.stitches == 0)
            .accessibilityLabel("Remove stitch")

            VStack(spacing: 2) {
                Text("STITCHES")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text("\(project.stitches)")
                    .font(.system(size: 44, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(project.stitches)))
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .combine)

            Button {
                store.update(projectID) { $0.incrementStitch() }
            } label: {
                Image(systemName: "plus")
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityLabel("Add stitch")
        }
        .padding()
        .background(.quaternary.opacity(0.5), in: .rect(cornerRadius: 20))
        .animation(.snappy, value: project.stitches)
    }
}

private struct RepeatCard: View {
    let progress: RepeatProgress

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if progress.isComplete {
                Label("All \(progress.currentRepeat) repeats done", systemImage: "checkmark.seal.fill")
                    .font(.headline)
                    .foregroundStyle(.green)
            } else {
                HStack {
                    Text(repeatTitle)
                        .font(.headline)
                    Spacer()
                    Text("Row \(progress.rowInRepeat) of \(progress.rowsPerRepeat)")
                        .font(.headline)
                        .monospacedDigit()
                }
                ProgressView(value: progress.repeatFraction)
            }
            if let overall = progress.overallFraction, !progress.isComplete {
                Text("\(Int((overall * 100).rounded()))% of all repeats")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.5), in: .rect(cornerRadius: 20))
        .accessibilityElement(children: .combine)
    }

    private var repeatTitle: String {
        if let total = progress.totalRepeats {
            return "Repeat \(progress.currentRepeat) of \(total)"
        }
        return "Repeat \(progress.currentRepeat)"
    }
}

#Preview {
    let store = ProjectStore(fileURL: URL.temporaryDirectory.appendingPathComponent("preview.json"))
    let project = KnittingProject(name: "Cabled Scarf", rows: 13, stitches: 4, rowsPerRepeat: 8, totalRepeats: 12)
    store.add(project)
    return NavigationStack {
        CounterView(projectID: project.id)
    }
    .environment(store)
}
