import SwiftUI

@main
struct KnittingCounterApp: App {
    @State private var store = ProjectStore()

    var body: some Scene {
        WindowGroup {
            ProjectListView()
                .environment(store)
        }
    }
}
