import React from "react";
import { getProgressionOverview } from "../services/storage";

export function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

export function LibraryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6c3-1.5 6-1.5 8 0s5 1.5 8 0" />
      <path d="M4 12c3-1.5 6-1.5 8 0s5 1.5 8 0" />
      <path d="M4 18c3-1.5 6-1.5 8 0s5 1.5 8 0" />
    </svg>
  );
}

export function CustomizationsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C12 7.5 7.5 12 2 12C7.5 12 12 16.5 12 22C12 16.5 16.5 12 22 12C16.5 12 12 7.5 12 2Z" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function AppShell({
  currentScreen,
  onNavigate,
  userProfile,
  children,
}) {
  const progression = getProgressionOverview();

  const isHome = currentScreen === "menu";
  const isSearch = currentScreen === "search";
  const isLibrary = currentScreen === "playlists" || currentScreen === "library" || currentScreen === "tracks" || currentScreen === "top-tracks";
  const isCustomizations = currentScreen === "sprites";
  const isSettings = currentScreen === "settings" || currentScreen === "themes";

  return (
    <div className="app-shell">
      {/* Desktop / Tablet Persistent Side Navigation */}
      <aside className="desktop-side-nav" aria-label="Desktop navigation">
        <div className="side-nav-brand">
          <h1>FLAPPYFY</h1>
        </div>

        <button className="side-nav-profile" onClick={() => onNavigate("settings")} aria-label="Open settings">
          {userProfile?.images?.[0]?.url ? (
            <img src={userProfile.images[0].url} alt="" className="side-nav-avatar" />
          ) : (
            <span className="side-nav-avatar-fallback">{userProfile?.display_name?.[0] || "L"}</span>
          )}
          <div className="side-nav-profile-info">
            <strong className="side-nav-user-name">{userProfile?.display_name || "LOCAL PLAYER"}</strong>
            <small className="side-nav-user-rank">{progression.level?.name || "Silver"} Rank</small>
          </div>
        </button>

        <nav className="side-nav-menu" aria-label="Main menu">
          <button
            className={`side-nav-btn ${isHome ? "active" : ""}`}
            onClick={() => onNavigate("menu")}
          >
            <span className="nav-icon"><HomeIcon /></span>
            <span className="nav-label">HOME</span>
          </button>
          <button
            className={`side-nav-btn ${isSearch ? "active" : ""}`}
            onClick={() => onNavigate("search")}
          >
            <span className="nav-icon"><SearchIcon /></span>
            <span className="nav-label">SEARCH</span>
          </button>
          <button
            className={`side-nav-btn ${isLibrary ? "active" : ""}`}
            onClick={() => onNavigate("playlists")}
          >
            <span className="nav-icon"><LibraryIcon /></span>
            <span className="nav-label">LIBRARY</span>
          </button>
          <button
            className={`side-nav-btn ${isCustomizations ? "active" : ""}`}
            onClick={() => onNavigate("sprites")}
          >
            <span className="nav-icon"><CustomizationsIcon /></span>
            <span className="nav-label">CUSTOMIZATIONS</span>
          </button>
          <button
            className={`side-nav-btn ${isSettings ? "active" : ""}`}
            onClick={() => onNavigate("settings")}
          >
            <span className="nav-icon"><SettingsIcon /></span>
            <span className="nav-label">SETTINGS</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="app-shell-content">
        {children}
      </div>

      {/* Mobile Persistent Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Primary navigation">
        <button
          className={`bottom-nav-btn ${isHome ? "active" : ""}`}
          onClick={() => onNavigate("menu")}
        >
          <span className="nav-icon"><HomeIcon /></span>
          HOME
        </button>
        <button
          className={`bottom-nav-btn ${isSearch ? "active" : ""}`}
          onClick={() => onNavigate("search")}
        >
          <span className="nav-icon"><SearchIcon /></span>
          SEARCH
        </button>
        <button
          className={`bottom-nav-btn ${isLibrary ? "active" : ""}`}
          onClick={() => onNavigate("playlists")}
        >
          <span className="nav-icon"><LibraryIcon /></span>
          LIBRARY
        </button>
        <button
          className={`bottom-nav-btn ${isCustomizations ? "active" : ""}`}
          onClick={() => onNavigate("sprites")}
        >
          <span className="nav-icon"><CustomizationsIcon /></span>
          CUSTOMIZATIONS
        </button>
        <button
          className={`bottom-nav-btn ${isSettings ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
        >
          <span className="nav-icon"><SettingsIcon /></span>
          SETTINGS
        </button>
      </nav>
    </div>
  );
}
