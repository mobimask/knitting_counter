import SwiftUI

/// Sheet for creating a project or changing an existing one's settings.
struct ProjectEditorView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var draft: KnittingProject
    @State private var tracksRepeats: Bool
    @State private var rowsPerRepeat: Int
    @State private var hasFixedRepeats: Bool
    @State private var totalRepeats: Int

    private let isNew: Bool
    private let onSave: (KnittingProject) -> Void

    init(project: KnittingProject, isNew: Bool, onSave: @escaping (KnittingProject) -> Void) {
        _draft = State(initialValue: project)
        _tracksRepeats = State(initialValue: project.rowsPerRepeat != nil)
        _rowsPerRepeat = State(initialValue: project.rowsPerRepeat ?? 4)
        _hasFixedRepeats = State(initialValue: project.totalRepeats != nil)
        _totalRepeats = State(initialValue: project.totalRepeats ?? 10)
        self.isNew = isNew
        self.onSave = onSave
    }

    private var trimmedName: String {
        draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Project name", text: $draft.name)
                        .textInputAutocapitalization(.words)
                }

                Section {
                    Toggle("Track pattern repeats", isOn: $tracksRepeats.animation())
                    if tracksRepeats {
                        Stepper("Rows per repeat: \(rowsPerRepeat)", value: $rowsPerRepeat, in: 1...999)
                        Toggle("Set number of repeats", isOn: $hasFixedRepeats.animation())
                        if hasFixedRepeats {
                            Stepper("Repeats: \(totalRepeats)", value: $totalRepeats, in: 1...999)
                        }
                    }
                } header: {
                    Text("Pattern")
                } footer: {
                    if tracksRepeats {
                        Text("For example, a cable that repeats every \(rowsPerRepeat) rows.")
                    }
                }

                Section("Stitches") {
                    Toggle("Reset stitches on each new row", isOn: $draft.resetStitchesOnNewRow)
                }

                if !isNew {
                    Section {
                        Stepper("Rows: \(draft.rows)", value: $draft.rows, in: 0...99_999)
                        Stepper("Stitches: \(draft.stitches)", value: $draft.stitches, in: 0...99_999)
                    } header: {
                        Text("Counts")
                    } footer: {
                        Text("Fix a miscount without tapping through every row.")
                    }
                }

                Section("Notes") {
                    TextField("Needle size, yarn, pattern page…", text: $draft.notes, axis: .vertical)
                        .lineLimit(3...8)
                }
            }
            .navigationTitle(isNew ? "New Project" : "Edit Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Create" : "Save") {
                        save()
                        dismiss()
                    }
                    .disabled(trimmedName.isEmpty)
                }
            }
        }
    }

    private func save() {
        var project = draft
        project.name = trimmedName
        project.rowsPerRepeat = tracksRepeats ? rowsPerRepeat : nil
        project.totalRepeats = tracksRepeats && hasFixedRepeats ? totalRepeats : nil
        project.updatedAt = Date()
        onSave(project)
    }
}

#Preview {
    ProjectEditorView(project: KnittingProject(name: ""), isNew: true) { _ in }
}
