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

export type ItemType = 'HEAL' | 'WEAPON_UPGRADE' | 'BOSS_REWARD';

export interface Entity {
  id?: string; // Optional for some temp particles
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  color: string;
  hp: number;
  maxHp?: number;
  type: 'PLAYER' | 'ENEMY_BASIC' | 'ENEMY_SHOOTER' | 'PLAYER_BULLET' | 'ENEMY_BULLET' | 'PARTICLE' | 'BOSS' | 'ITEM';
  
  // Specific properties
  rotation?: number;
  rotationSpeed?: number;
  dead?: boolean;
  life?: number; // For particles
  decay?: number; // For particles
  size?: number; // For particles/stars
  isShockwave?: boolean; // For particles
  
  // Item/Boss specific
  itemType?: ItemType;
  attackTimer?: number;
  bossTier?: number; // 1 for normal, 2 for elite/infinite
}

export interface MissionBriefing {
  title: string;
  message: string;
}