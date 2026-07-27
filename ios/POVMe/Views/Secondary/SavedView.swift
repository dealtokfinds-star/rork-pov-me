import SwiftUI

/// Saved POVs screen — bookmarked episodes list.
struct SavedView: View {
    @Environment(AppState.self) private var app
    @Environment(Router.self) private var router

    private var saved: [Episode] { Mock.episodes.filter { app.savedEpisodes.contains($0.id) } }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if saved.isEmpty {
                    EmptyState(
                        title: "No saved POVs yet",
                        message: "Bookmark episodes to watch later — they'll show up here.",
                        iconName: "bookmark.fill",
                        action: "Browse episodes"
                    ) {
                        router.selectedTab = .feed
                    }
                    .padding(.top, 40)
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 168), spacing: 12)], spacing: 12) {
                        ForEach(saved) { e in EpisodeTile(episode: e, width: 168) }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 16)
                }
            }
            .padding(.bottom, 40)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle("Saved POVs")
        .navigationBarTitleDisplayMode(.inline)
    }
}
