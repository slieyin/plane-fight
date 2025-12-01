
export enum GameState {
  MENU = 'MENU',
  LOADING_BRIEFING = 'LOADING_BRIEFING',
  BRIEFING = 'BRIEFING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  GAME_WON = 'GAME_WON'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARDCORE = 'HARDCORE',
  ENDLESS = 'ENDLESS'
}

export interface Point {
  x: number;
  y: number;
}

export type ItemType = 'HEAL' | 'WEAPON_UPGRADE' | 'BOSS_REWARD';

export interface Entity {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  color: string;
  hp: number;
  maxHp?: number;
  type: 'PLAYER' | 'ENEMY_BASIC' | 'ENEMY_SHOOTER' | 'ENEMY_ELITE' | 'ENEMY_KAMIKAZE' | 'ENEMY_MISSILE_DRONE' | 'ENEMY_JAMMER' | 'PLAYER_BULLET' | 'ENEMY_BULLET' | 'ENEMY_MISSILE' | 'ENEMY_WAVE' | 'PARTICLE' | 'BOSS' | 'ITEM';
  
  // Specific properties
  rotation?: number;
  rotationSpeed?: number;
  dead?: boolean;
  life?: number; // For particles
  decay?: number; // For particles
  size?: number; // For particles/stars
  isShockwave?: boolean; // For particles
  isBouncing?: boolean; // New: For Boss scatter bullets
  
  // Player specific
  invulnerableTimer?: number;
  jammedTimer?: number; // New: Debuff timer

  // Item/Boss/Enemy specific
  itemType?: ItemType;
  attackTimer?: number;
  shootTimer?: number; // For shooter enemies
  bossTier?: number; // 1 for normal, 2 for elite/infinite
  bossPhase?: number; // 0, 1, 2 for different attack patterns
  
  // Boss Phase 4 Laser
  beamAngle?: number; 
  hasSplit?: boolean;
}

export interface MissionBriefing {
  title: string;
  message: string;
}