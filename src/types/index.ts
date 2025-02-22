export interface GameBasic {
    id: string;
    title: string;
    lastActivity: string;
    lastActivityDate: string;
    platform: string | null;
    url: string;
}

export interface GameDetailed extends GameBasic {
    playTime: string | null;
    playCount: number;
    added: string | null;
    modified: string | null;
    isFavorite: boolean;
    isCompleted: boolean;
    isCustomGame: boolean;
    isInstalled: boolean;
    isInstalling: boolean;
    isLaunching: boolean;
    isRunning: boolean;
    isUninstalling: boolean;
    userScore?: string | null;
    communityScore?: string | null;
    criticScore?: string | null;
    version?: string | null;
    notes?: string | null;
}

export interface ShareniteProfile {
    username: string;
    nickname?: string;
    totalGames: number;
    lastUpdated: string;
}

export interface ShareniteState {
    profile?: ShareniteProfile;
    games: GameDetailed[];
    isLoading: boolean;
    error?: string;
    viewMode: 'list' | 'grid';
}

export interface GameCache {
    timestamp: number;
    data: GameDetailed[];
    profile: ShareniteProfile;
}

export interface OnboardingState {
    url?: string;
    step: number;
    error?: string;
    isChecking: boolean;
}

export interface ShareniteGameData {
    id: string;
    name: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    url: string;
}

export interface RawGame {
    id: string;
    title: string;
    lastActivity: string;
    lastActivityDate: string;
    url: string;
  }