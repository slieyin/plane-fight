export enum GameState {
  MENU = 'MENU',
  LOADING_BRIEFING = 'LOADING_BRIEFING',
  BRIEFING = 'BRIEFING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARDCORE = 'HARDCORE'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  color: string;
  hp: number;
  type: 'PLAYER' | 'ENEMY_BASIC' | 'ENEMY_SHOOTER' | 'PLAYER_BULLET' | 'ENEMY_BULLET' | 'PARTICLE';
}

export interface MissionBriefing {
  title: string;
  message: string;
}
