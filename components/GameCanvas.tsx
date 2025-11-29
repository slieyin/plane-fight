
import React, { useRef, useEffect, useCallback } from 'react';
import { Difficulty, Entity, ItemType } from '../types';

interface GameCanvasProps {
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
  onGameWin: (score: number) => void;
}

// Game Constants
// These are now "Pixels per frame at 60FPS"
const BULLET_SPEED = 15;
const ENEMY_SPEED_BASE = 2;
// Spawn rates (now in equivalent 60hz frames)
const SPAWN_RATE_BASE = 70; 
const SUPPLY_DROP_INTERVAL = 1200; 

// Boss Milestones
const BOSS_START_SCORE = 5000;
const FINAL_BOSS_SCORE = 20000;
const MAX_WEAPON_LEVEL = 10;

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ difficulty, onGameOver, onGameWin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0); // For Delta Time
  const wonRef = useRef<boolean>(false);
  const finalBossSpawnedRef = useRef<boolean>(false);
  
  // Logic Accumulators (replacing frameCount modulo checks)
  const accumulatorsRef = useRef({
    playerFire: 0,
    enemySpawn: 0,
    supplyDrop: 0,
    engineTrail: 0,
    bossPattern: 0, // For sine wave movement
    bossMinionSpawn: 0
  });

  const shakeRef = useRef(0);
  
  // Boss Logic Refs
  const nextBossScoreRef = useRef(BOSS_START_SCORE);
  const bossActiveRef = useRef(false);

  // Floating Text Logic
  const floatingTextsRef = useRef<{x: number, y: number, text: string, life: number, color: string}[]>([]);

  // Game State Refs
  // HP is now "Segments". Max 5.
  const playerRef = useRef<Entity>({ 
    x: 0, y: 0, width: 40, height: 48, 
    hp: 5, maxHp: 5, vx: 0, vy: 0, 
    color: '#00ff99', type: 'PLAYER',
    invulnerableTimer: 0,
    jammedTimer: 0
  });

  const playerStats = useRef({
    dragging: false,
    spreadLevel: 0, 
    fireDelay: 15, 
    damage: 1,
    maxSpread: 5, // Increased to allow sum to reach 10
    maxDamage: 5
  });

  const lastTouchX = useRef(0);
  
  const bulletsRef = useRef<Entity[]>([]);
  const enemiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Entity[]>([]);
  const itemsRef = useRef<Entity[]>([]); 
  const starsRef = useRef<Star[]>([]);
  const difficultyMultiplierRef = useRef(1);

  // Set difficulty params
  useEffect(() => {
    switch (difficulty) {
      case Difficulty.EASY: difficultyMultiplierRef.current = 0.7; break; 
      case Difficulty.NORMAL: difficultyMultiplierRef.current = 1.0; break; 
      case Difficulty.HARDCORE: difficultyMultiplierRef.current = 1.8; break;
      case Difficulty.ENDLESS: difficultyMultiplierRef.current = 1.5; break; 
    }
    nextBossScoreRef.current = BOSS_START_SCORE;
    bossActiveRef.current = false;
    accumulatorsRef.current.supplyDrop = 0;
    wonRef.current = false;
    finalBossSpawnedRef.current = false;
  }, [difficulty]);

  // Init Stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 3 + 1,
        brightness: Math.random()
      });
    }
    starsRef.current = stars;
  }, []);

  const showFloatingText = (x: number, y: number, text: string, color: string = '#fff') => {
    floatingTextsRef.current.push({ x, y, text, life: 60, color });
  };

  // --- HELPER: SCALING FACTORS ---
  const getDifficultyScaling = () => {
      const score = scoreRef.current;
      let aggressiveness = 1.0;

      if (difficulty === Difficulty.EASY) aggressiveness = 0.5;
      else if (difficulty === Difficulty.HARDCORE || difficulty === Difficulty.ENDLESS) aggressiveness = 1.5;

      // Density increases with score
      const densityFactor = 1 + (score / 15000) * aggressiveness;
      
      // Speed increases with score (capped to prevent unplayable speeds)
      const speedFactor = Math.min(2.0, 1 + (score / 25000) * aggressiveness);

      return { densityFactor, speedFactor };
  };

  // --- SPAWNERS ---

  const spawnPlayerBullet = (x: number, y: number, angleOffset: number = 0) => {
    const stats = playerStats.current;
    const isJammed = (playerRef.current.jammedTimer || 0) > 0;

    const speed = BULLET_SPEED;
    const vx = Math.sin(angleOffset) * speed;
    const vy = -Math.cos(angleOffset) * speed;
    
    // Debuff: Reduced bullet size and damage calculation effectiveness if jammed
    let effectiveDamage = stats.damage;
    if (isJammed) effectiveDamage = Math.max(1, Math.floor(stats.damage / 2));

    const size = Math.min(12, 4 + (effectiveDamage - 1) * 2);
    const color = isJammed ? '#888888' : (stats.damage > 3 ? '#ffaaee' : (stats.damage > 1 ? '#ffff00' : '#00ffff'));

    bulletsRef.current.push({
      x: x - size/2, y, width: size, height: 16 + (effectiveDamage * 2), 
      vx: vx, vy: vy, 
      color: color, 
      hp: effectiveDamage, 
      type: 'PLAYER_BULLET'
    });
    
    // Muzzle flash
    particlesRef.current.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 2, vy: 2, life: 0.2, decay: 0.1, color: color, size: 3, type: 'PARTICLE', hp: 0, width: 0, height: 0
    });
  };

  const spawnEnemyBullet = (x: number, y: number, vx: number, vy: number, color: string = '#ff0055', size: number = 8) => {
    bulletsRef.current.push({
      x: x - size/2, y, width: size, height: size, 
      vx: vx, vy: vy, 
      color: color, hp: 1, type: 'ENEMY_BULLET'
    });
  };

  const spawnMissile = (x: number, y: number) => {
    bulletsRef.current.push({
        x: x, y: y, width: 10, height: 20,
        vx: 0, vy: 2, // Initial speed
        color: '#ff3300', hp: 1, type: 'ENEMY_MISSILE',
        rotation: 0
    });
  };

  const spawnWave = (x: number, y: number) => {
      bulletsRef.current.push({
          x: x, y: y, width: 20, height: 20, // Start small
          vx: 0, vy: 0,
          color: '#00ccff', hp: 999, type: 'ENEMY_WAVE',
          life: 2.0 // Seconds duration
      });
  };

  const spawnEnemy = (canvasWidth: number) => {
    // Stop spawning basic enemies if Final Boss (Tier 3) is active
    const boss = enemiesRef.current.find(e => e.type === 'BOSS');
    if (boss && boss.bossTier === 3) return;

    const rand = Math.random();
    let type: 'ENEMY_BASIC' | 'ENEMY_SHOOTER' | 'ENEMY_ELITE' | 'ENEMY_KAMIKAZE' | 'ENEMY_MISSILE_DRONE' | 'ENEMY_JAMMER' = 'ENEMY_BASIC';
    
    const hardMode = difficulty === Difficulty.HARDCORE || difficulty === Difficulty.ENDLESS;
    const currentScore = scoreRef.current;
    
    // Spawn Probabilities
    if (rand > 0.94) type = 'ENEMY_MISSILE_DRONE';
    else if (rand > 0.88) type = 'ENEMY_JAMMER';
    else if (rand > 0.80) type = 'ENEMY_ELITE';
    else if (rand > 0.65) type = 'ENEMY_SHOOTER';
    else if (rand > 0.50 && (hardMode || currentScore > 500)) type = 'ENEMY_KAMIKAZE';

    const size = type === 'ENEMY_ELITE' ? 60 : (type === 'ENEMY_MISSILE_DRONE' || type === 'ENEMY_JAMMER' ? 50 : 30);
    const x = Math.random() * (canvasWidth - size);
    
    const { speedFactor } = getDifficultyScaling();
    let speed = (ENEMY_SPEED_BASE + Math.random() * 1.5) * difficultyMultiplierRef.current * speedFactor;
    
    let hp = 1;
    let color = '#ff9900';
    let vx = (Math.random() - 0.5) * difficultyMultiplierRef.current * 0.5;

    const hpScaling = Math.floor(currentScore / 600) * 4;

    if (type === 'ENEMY_ELITE') {
        hp = 15 + (hardMode ? 10 : 0) + (hpScaling * 2);
        speed *= 0.4; 
        color = '#cc0000'; 
    } else if (type === 'ENEMY_SHOOTER') {
        hp = 3 + hpScaling;
        speed *= 0.7;
        color = '#aa00ff';
    } else if (type === 'ENEMY_KAMIKAZE') {
        hp = 1;
        speed *= 2.0; 
        vx = 0; 
        color = '#00ffcc';
    } else if (type === 'ENEMY_MISSILE_DRONE') {
        hp = 8 + hpScaling;
        speed *= 1.2; // Fast approach
        color = '#ff5500';
    } else if (type === 'ENEMY_JAMMER') {
        hp = 10 + hpScaling;
        speed *= 0.5; // Slow
        color = '#0088ff';
    } else {
        const baseHp = hardMode ? 2 : 1;
        hp = baseHp + hpScaling;
        color = '#ff9900'; 
    }
    
    enemiesRef.current.push({
      x,
      y: -60,
      width: size,
      height: size,
      vx: vx,
      vy: speed,
      hp: hp,
      maxHp: hp,
      color: color,
      type: type,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      shootTimer: Math.random() * 60
    });
  };

  const spawnBoss = (canvasWidth: number) => {
    bossActiveRef.current = true;
    
    const currentScore = scoreRef.current;
    
    // Determine Boss Tier
    let tier = 1;
    if (difficulty !== Difficulty.ENDLESS && currentScore >= FINAL_BOSS_SCORE) {
        tier = 3; // Final Boss
        finalBossSpawnedRef.current = true;
    } else if (currentScore >= 10000) {
        tier = 2; // Elite Boss
    }

    const scoreScaling = Math.floor(currentScore / 5000); 
    
    let baseHp = 3000;
    if (tier === 2) baseHp = 6000;
    if (tier === 3) baseHp = 30000;

    if (difficulty === Difficulty.HARDCORE || difficulty === Difficulty.ENDLESS) {
        baseHp *= 1.5;
    } else if (difficulty === Difficulty.EASY) {
        baseHp *= 0.6;
    }

    const growthPerStage = 1500 * difficultyMultiplierRef.current;
    const totalHp = baseHp + (tier === 3 ? 0 : scoreScaling * growthPerStage);

    let width = 140;
    let height = 100;
    let color = '#aa00ff';

    if (tier === 2) {
        width = 180;
        height = 140;
        color = '#ff0033';
    } else if (tier === 3) {
        width = 240;
        height = 180;
        color = '#FFD700';
    }

    enemiesRef.current.push({
      x: canvasWidth / 2 - width / 2,
      y: -180, 
      width: width,
      height: height,
      vx: 0,
      vy: 1, 
      hp: totalHp,
      maxHp: totalHp,
      color: color, 
      type: 'BOSS',
      bossTier: tier,
      rotation: 0,
      rotationSpeed: 0,
      attackTimer: 0,
      bossPhase: 0
    });
    
    shakeRef.current = tier === 3 ? 30 : 15;
    
    let text = "⚠️ 强敌出现 ⚠️";
    if (tier === 2) text = "⚠️ 歼灭模式 ⚠️";
    if (tier === 3) text = "☠️ 终极审判 ☠️";

    showFloatingText(canvasWidth/2, 200, text, color);
  };

  const spawnItem = (x: number, y: number, forcedType?: ItemType) => {
    let type: ItemType = 'HEAL';
    let color = '#00ff00';
    
    if (forcedType) {
        type = forcedType;
    } else {
        const rand = Math.random();
        if (rand < 0.20) type = 'WEAPON_UPGRADE';
        else type = 'HEAL';
    }

    if (type === 'BOSS_REWARD') color = '#00ffff'; 
    else if (type === 'WEAPON_UPGRADE') color = '#ffff00';

    itemsRef.current.push({
      x, y, width: 30, height: 30,
      vx: 0, vy: 1.5,
      hp: 1, type: 'ITEM',
      itemType: type,
      color: color,
      rotation: 0
    });
  };

  const createExplosion = (x: number, y: number, color: string, scale: number = 1) => {
    const count = 15 * scale;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.04 + Math.random() * 0.03,
        color: color,
        size: Math.random() * 4 + 1,
        type: 'PARTICLE', hp: 0, width: 0, height: 0
      });
    }
  };

  const triggerSmartBomb = (canvasWidth: number, canvasHeight: number) => {
     bulletsRef.current = bulletsRef.current.filter(b => b.type === 'PLAYER_BULLET');
     enemiesRef.current.forEach(e => {
         e.hp -= 20;
         if (e.hp <= 0) e.dead = true;
     });
     shakeRef.current = 30;
     particlesRef.current.push({
         x: canvasWidth/2, y: canvasHeight/2, vx: 0, vy: 0,
         life: 2.0, decay: 0.05, size: 10, isShockwave: true, color: '#ffffff',
         type: 'PARTICLE', hp: 0, width: 0, height: 0
     });
     showFloatingText(canvasWidth/2, canvasHeight/2, "OVERLOAD!!!", "#ffffff");
  };

  const upgradePlayerRandomly = (canvasWidth: number, canvasHeight: number) => {
    const p = playerRef.current;
    const s = playerStats.current;
    const currentLevel = s.spreadLevel + s.damage;
    
    if (currentLevel >= MAX_WEAPON_LEVEL) {
        triggerSmartBomb(canvasWidth, canvasHeight);
        return;
    }

    const rand = Math.random();
    let upgraded = false;

    if (rand < 0.5) {
        if (s.damage < s.maxDamage) {
            s.damage++;
            showFloatingText(p.x, p.y - 50, "火力强化!", "#ff0000");
            upgraded = true;
        } else if (s.spreadLevel < s.maxSpread) {
            s.spreadLevel++;
            showFloatingText(p.x, p.y - 50, "多重火力 UP!", "#ffff00");
            upgraded = true;
        }
    } else {
        if (s.spreadLevel < s.maxSpread) {
            s.spreadLevel++;
            showFloatingText(p.x, p.y - 50, "多重火力 UP!", "#ffff00");
            upgraded = true;
        } else if (s.damage < s.maxDamage) {
            s.damage++;
            showFloatingText(p.x, p.y - 50, "火力强化!", "#ff0000");
            upgraded = true;
        }
    }
    
    if (s.fireDelay > 8) {
        s.fireDelay -= 1;
        if (!upgraded) showFloatingText(p.x, p.y - 50, "射速 UP!", "#00ffff");
    }
  };

  // --- MAIN UPDATE LOOP ---
  const update = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- DELTA TIME CALCULATION ---
    const now = performance.now();
    if (lastTimeRef.current === 0) lastTimeRef.current = now - 16;
    
    const deltaTime = now - lastTimeRef.current;
    lastTimeRef.current = now;

    const timeScale = Math.min(Math.max(deltaTime / (1000 / 60), 0.1), 4.0);
    // -----------------------------

    if (shakeRef.current > 0) {
        shakeRef.current -= 0.5 * timeScale; 
        if (shakeRef.current < 0) shakeRef.current = 0;
    }

    ctx.save();
    if (shakeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(dx, dy);
    }
    
    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

    // Draw Stars
    ctx.fillStyle = '#ffffff';
    starsRef.current.forEach(star => {
        const { speedFactor } = getDifficultyScaling();
        star.y += star.speed * timeScale * speedFactor;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
        ctx.globalAlpha = star.brightness;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Player Update
    const p = playerRef.current;
    const stats = playerStats.current;
    
    if (p.invulnerableTimer && p.invulnerableTimer > 0) {
        p.invulnerableTimer -= 1 * timeScale;
    } else {
        p.invulnerableTimer = 0;
    }

    // Jammed Timer Debuff Update
    if (p.jammedTimer && p.jammedTimer > 0) {
        p.jammedTimer -= 1 * timeScale;
        if (p.jammedTimer <= 0) p.jammedTimer = 0;
    }

    // Movement Clamping
    if (p.x < 0) p.x = 0;
    if (p.x > canvas.width - p.width) p.x = canvas.width - p.width;
    
    // Engine Trail
    if (p.hp > 0) {
        accumulatorsRef.current.engineTrail += timeScale;
        if (accumulatorsRef.current.engineTrail >= 3) {
            accumulatorsRef.current.engineTrail = 0;
            // Trail is gray/glitchy if jammed
            const isJammed = (p.jammedTimer || 0) > 0;
            const trailColor = isJammed ? '#555555' : (stats.spreadLevel > 2 ? '#ff9900' : '#00ccff');

            particlesRef.current.push({
                x: p.x + p.width / 2 + (Math.random() - 0.5) * 10,
                y: p.y + p.height,
                vx: (Math.random() - 0.5) * 2,
                vy: 4 + Math.random() * 4,
                life: 0.6,
                decay: 0.1,
                color: trailColor, 
                size: Math.random() * 3 + 2,
                type: 'PARTICLE', hp: 0, width: 0, height: 0
            });
        }
    }

    // Auto Fire
    if (p.hp > 0) {
        accumulatorsRef.current.playerFire += timeScale;
        // Jammed Effect: Fire rate halved (Delay doubled)
        const isJammed = (p.jammedTimer || 0) > 0;
        const currentFireDelay = isJammed ? stats.fireDelay * 2 : stats.fireDelay;

        if (accumulatorsRef.current.playerFire >= currentFireDelay) {
           accumulatorsRef.current.playerFire = 0;
           const centerX = p.x + p.width / 2;
           spawnPlayerBullet(centerX, p.y); 
           
           if (!isJammed) { // Spread shots disabled if jammed? Or just weak? Let's keep them but weak
               if (stats.spreadLevel >= 1) { 
                   spawnPlayerBullet(centerX - 10, p.y + 10, -0.1); 
                   spawnPlayerBullet(centerX + 10, p.y + 10, 0.1); 
               }
               if (stats.spreadLevel >= 2) { 
                   spawnPlayerBullet(centerX - 20, p.y + 20, -0.2); 
                   spawnPlayerBullet(centerX + 20, p.y + 20, 0.2); 
               }
               if (stats.spreadLevel >= 3) {
                   spawnPlayerBullet(centerX, p.y, -0.05);
                   spawnPlayerBullet(centerX, p.y, 0.05);
               }
               if (stats.spreadLevel >= 4) {
                   spawnPlayerBullet(centerX - 30, p.y + 20, -0.4);
                   spawnPlayerBullet(centerX + 30, p.y + 20, 0.4);
               }
           }
        }
    }

    // Supply Drop
    if (p.hp > 0) {
      accumulatorsRef.current.supplyDrop += timeScale;
      if (accumulatorsRef.current.supplyDrop > SUPPLY_DROP_INTERVAL) {
        accumulatorsRef.current.supplyDrop = 0;
        const x = Math.random() * (canvas.width - 40);
        spawnItem(x, -50, 'WEAPON_UPGRADE');
        showFloatingText(canvas.width / 2, 150, ">> 武器补给抵达 <<", "#ffff00");
      }
    }

    // Boss Spawning
    if (!bossActiveRef.current) {
        if (scoreRef.current >= nextBossScoreRef.current) {
             spawnBoss(canvas.width);
        }
    }

    // Enemy Spawning
    const { densityFactor } = getDifficultyScaling();
    const spawnRate = Math.max(15, Math.floor(SPAWN_RATE_BASE / (difficultyMultiplierRef.current * densityFactor)));

    const bossEntity = enemiesRef.current.find(e => e.type === 'BOSS');
    const shouldSpawnMinions = bossEntity && bossEntity.bossTier && bossEntity.bossTier >= 2 && bossEntity.bossTier < 3;
    
    if (shouldSpawnMinions) {
        accumulatorsRef.current.bossMinionSpawn += timeScale;
        if (accumulatorsRef.current.bossMinionSpawn >= 120 / densityFactor) {
            accumulatorsRef.current.bossMinionSpawn = 0;
            spawnEnemy(canvas.width);
        }
    }

    if (!bossActiveRef.current) {
        accumulatorsRef.current.enemySpawn += timeScale;
        if (accumulatorsRef.current.enemySpawn >= spawnRate) {
             accumulatorsRef.current.enemySpawn = 0;
             spawnEnemy(canvas.width);
        }
    }

    // Update Projectiles (Bullets, Missiles, Waves)
    bulletsRef.current.forEach(b => { 
        if (b.type === 'ENEMY_MISSILE') {
             // Homing Logic
             const targetX = p.x + p.width/2;
             const targetY = p.y + p.height/2;
             const dx = targetX - b.x;
             const dy = targetY - b.y;
             const dist = Math.sqrt(dx*dx + dy*dy);
             if (dist > 0) {
                 // Steering
                 const speed = 4;
                 const steerStrength = 0.08 * timeScale;
                 b.vx += (dx/dist * speed - b.vx) * steerStrength;
                 b.vy += (dy/dist * speed - b.vy) * steerStrength;
                 // Cap speed
                 const currentSpeed = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
                 b.vx = (b.vx / currentSpeed) * speed;
                 b.vy = (b.vy / currentSpeed) * speed;
                 
                 // Rotate missile to face velocity
                 b.rotation = Math.atan2(b.vy, b.vx) + Math.PI/2;
             }
             b.x += b.vx * timeScale;
             b.y += b.vy * timeScale;

        } else if (b.type === 'ENEMY_WAVE') {
             // Expanding Wave
             const expansion = 4 * timeScale;
             b.x -= expansion/2;
             b.y -= expansion/2;
             b.width += expansion;
             b.height += expansion;
             
             // Fade out based on life
             b.life = (b.life || 0) - 0.03 * timeScale;
             if ((b.life || 0) <= 0) b.dead = true;
        } else {
             // Standard Linear Bullet
             b.x += b.vx * timeScale; 
             b.y += b.vy * timeScale; 
        }
    });
    bulletsRef.current = bulletsRef.current.filter(b => !b.dead && b.y > -50 && b.y < canvas.height + 50 && (b.type !== 'ENEMY_WAVE' || (b.life && b.life > 0)));

    // Update Items
    itemsRef.current.forEach(item => {
        item.y += item.vy * timeScale;
        item.rotation = (item.rotation || 0) + (0.05 * timeScale);
    });
    itemsRef.current = itemsRef.current.filter(i => i.y < canvas.height + 50 && !i.dead);

    // Update Enemies
    enemiesRef.current.forEach(e => { 
        if (e.type === 'BOSS') {
            accumulatorsRef.current.bossPattern += timeScale;
            
            if (e.y < 80) e.y += 1 * timeScale; 
            else {
                e.x += Math.sin(accumulatorsRef.current.bossPattern * 0.02) * 2 * difficultyMultiplierRef.current * timeScale;
                e.x = Math.max(0, Math.min(canvas.width - e.width, e.x));
                
                e.attackTimer = (e.attackTimer || 0) + 1 * timeScale;
                
                if (Math.floor(accumulatorsRef.current.bossPattern) % 300 < timeScale) {
                    e.bossPhase = (e.bossPhase || 0) + 1;
                    if (e.bossPhase > 2) e.bossPhase = 0;
                }

                let attackRate = (e.bossTier === 2 ? 30 : 50);
                if (e.bossTier === 3) attackRate = 20; 

                if (difficulty === Difficulty.HARDCORE || difficulty === Difficulty.ENDLESS) attackRate *= 0.6; 
                if (difficulty === Difficulty.EASY) attackRate *= 1.5; 

                if (e.attackTimer > attackRate) {
                    e.attackTimer = 0;
                    const cx = e.x + e.width/2;
                    const cy = e.y + e.height;
                    const phase = e.bossPhase || 0;

                    if (e.bossTier === 3) {
                        if (phase === 0) { 
                             const pCx = p.x + p.width/2;
                             const pCy = p.y + p.height/2;
                             const dx = pCx - cx;
                             const dy = pCy - cy;
                             const dist = Math.sqrt(dx*dx + dy*dy);
                             spawnEnemyBullet(cx, cy, (dx/dist)*12, (dy/dist)*12, '#ffaa00', 12);
                             spawnEnemyBullet(cx - 40, cy, -2, 8, '#ffaa00', 10);
                             spawnEnemyBullet(cx + 40, cy, 2, 8, '#ffaa00', 10);
                        } else if (phase === 1) { 
                             const spiralDensity = 0.4;
                             const timeOffset = accumulatorsRef.current.bossPattern * 0.1;
                             for(let angle = 0; angle < Math.PI * 2; angle += spiralDensity) {
                                 const finalAngle = angle + timeOffset;
                                 spawnEnemyBullet(cx, cy, Math.cos(finalAngle) * 7, Math.sin(finalAngle) * 7, '#FFD700', 10);
                             }
                        } else if (phase === 2) { 
                             for(let i=0; i<3; i++) {
                                 const rx = Math.random() * canvas.width;
                                 spawnEnemyBullet(rx, -10, 0, 10 + Math.random()*5, '#ffffff', 8);
                             }
                             spawnEnemyBullet(cx, cy, (Math.random()-0.5)*10, 8, '#ff0000', 10);
                        }
                    } else {
                        if (phase === 0) { 
                            const density = (difficulty === Difficulty.HARDCORE || difficulty === Difficulty.ENDLESS) ? 0.15 : 0.25;
                            for(let angle = -0.7; angle <= 0.7; angle += density) {
                                spawnEnemyBullet(cx, cy, Math.sin(angle) * 5, Math.cos(angle) * 5, e.color);
                            }
                        } else if (phase === 1) { 
                            const dx = (p.x + p.width/2) - cx;
                            const dy = (p.y + p.height/2) - cy;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            spawnEnemyBullet(cx, cy, (dx/dist)*9, (dy/dist)*9, '#ffffff', 10);
                            if (e.bossTier === 2) {
                                spawnEnemyBullet(cx - 20, cy, (dx/dist)*9, (dy/dist)*9, '#ffffff', 10);
                                spawnEnemyBullet(cx + 20, cy, (dx/dist)*9, (dy/dist)*9, '#ffffff', 10);
                            }
                        } else if (phase === 2) { 
                            const count = (difficulty === Difficulty.HARDCORE || difficulty === Difficulty.ENDLESS) ? 8 : 4;
                            for(let i=0; i<count; i++) {
                                const angle = (Math.random() - 0.5) * Math.PI; 
                                spawnEnemyBullet(cx, cy, Math.sin(angle) * 6, Math.cos(angle) * 6, '#ff9900', 8);
                            }
                        }
                    }
                }
            }
        } else if (e.type === 'ENEMY_MISSILE_DRONE') {
            if (e.y < 80) e.y += e.vy * timeScale;
            else {
                // Hover oscillation
                e.x += Math.sin(now * 0.002) * 2 * timeScale;
                e.x = Math.max(0, Math.min(canvas.width - e.width, e.x));
            }

            e.shootTimer = (e.shootTimer || 0) + 1 * timeScale;
            if (e.shootTimer > 200) { // Slower fire rate for missiles
                e.shootTimer = 0;
                spawnMissile(e.x + e.width/2, e.y + e.height);
            }
        } else if (e.type === 'ENEMY_JAMMER') {
            e.y += e.vy * timeScale;
            
            e.shootTimer = (e.shootTimer || 0) + 1 * timeScale;
            if (e.shootTimer > 150) {
                e.shootTimer = 0;
                spawnWave(e.x + e.width/2, e.y + e.height/2);
            }
        } else if (e.type === 'ENEMY_KAMIKAZE') {
            e.y += e.vy * timeScale;
            const targetX = p.x + p.width/2 - e.width/2;
            const diff = targetX - e.x;
            e.x += diff * 0.05 * timeScale; 
            e.rotation = (diff * 0.01);
            
            if (Math.random() < 0.3 * timeScale) {
                 particlesRef.current.push({
                    x: e.x + e.width/2, y: e.y, vx: 0, vy: -1, life: 0.4, decay: 0.1, color: '#00ffcc', size: 2, type: 'PARTICLE', hp: 0, width: 0, height: 0
                 });
            }
        } else if (e.type === 'ENEMY_SHOOTER') {
            e.x += e.vx * timeScale; 
            e.y += e.vy * timeScale; 
            e.shootTimer = (e.shootTimer || 0) + 1 * timeScale;
            if (e.shootTimer > 120) {
                e.shootTimer = 0;
                const cx = e.x + e.width/2;
                const cy = e.y + e.height;
                const dx = (p.x + p.width/2) - cx;
                const dy = (p.y + p.height/2) - cy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                spawnEnemyBullet(cx, cy, (dx/dist)*4, (dy/dist)*4, '#aa00ff', 8);
            }
        } else if (e.type === 'ENEMY_ELITE') {
            e.x += e.vx * timeScale; 
            e.y += e.vy * timeScale; 
            e.rotation = (e.rotation || 0) + (e.rotationSpeed || 0) * timeScale;
            
            e.shootTimer = (e.shootTimer || 0) + 1 * timeScale;
            if (e.shootTimer > 120) { 
                e.shootTimer = 0;
                const cx = e.x + e.width/2;
                const cy = e.y + e.height;
                spawnEnemyBullet(cx, cy, 0, 4, '#cc0000', 10);
                spawnEnemyBullet(cx, cy, -1.5, 3.5, '#cc0000', 10);
                spawnEnemyBullet(cx, cy, 1.5, 3.5, '#cc0000', 10);
            }
        } else {
            e.x += e.vx * timeScale; 
            e.y += e.vy * timeScale; 
            e.rotation = (e.rotation || 0) + (e.rotationSpeed || 0) * timeScale;
        }
    });
    enemiesRef.current = enemiesRef.current.filter(e => !e.dead && e.y < canvas.height + 200);

    // --- COLLISION ---

    // 1. Items -> Player
    itemsRef.current.forEach(item => {
        if (
            p.hp > 0 && !item.dead &&
            p.x < item.x + item.width && p.x + p.width > item.x &&
            p.y < item.y + item.height && p.y + p.height > item.y
        ) {
            item.dead = true;
            if (item.itemType === 'HEAL') {
                p.hp = Math.min(p.maxHp || 5, p.hp + 2); 
                showFloatingText(p.x, p.y, "+HP", "#00ff00");
                particlesRef.current.push({ x: p.x, y: p.y, vx: 0, vy: -2, life: 1, decay: 0.02, color: '#00ff00', size: 20, isShockwave: true, type: 'PARTICLE', hp: 0, width: 0, height: 0 });
            } else if (item.itemType === 'WEAPON_UPGRADE') {
                upgradePlayerRandomly(canvas.width, canvas.height);
                scoreRef.current += 100;
                particlesRef.current.push({ x: p.x, y: p.y, vx: 0, vy: -2, life: 1.5, decay: 0.01, color: '#ffff00', size: 40, isShockwave: true, type: 'PARTICLE', hp: 0, width: 0, height: 0 });
            } else if (item.itemType === 'BOSS_REWARD') {
                upgradePlayerRandomly(canvas.width, canvas.height);
                scoreRef.current += 500;
                particlesRef.current.push({ x: p.x, y: p.y, vx: 0, vy: -2, life: 1.5, decay: 0.01, color: '#00ffff', size: 60, isShockwave: true, type: 'PARTICLE', hp: 0, width: 0, height: 0 });
            }
        }
    });

    // 2. Player Bullets -> Enemies
    enemiesRef.current.forEach(enemy => {
      bulletsRef.current.forEach(bullet => {
        if (bullet.type !== 'PLAYER_BULLET') return;

        if (
          !bullet.dead && !enemy.dead &&
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.height + bullet.y > enemy.y
        ) {
          enemy.hp -= bullet.hp;
          bullet.dead = true;
          particlesRef.current.push({
              x: bullet.x, y: bullet.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, 
              life: 0.3, decay: 0.1, color: '#fff', size: 2, type: 'PARTICLE', hp: 0, width: 0, height: 0
          });

          if (enemy.hp <= 0) {
            enemy.dead = true;
            
            if (enemy.type === 'BOSS') {
                scoreRef.current += 0; 
                createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 6);
                shakeRef.current = 40;
                bossActiveRef.current = false;
                
                if (enemy.bossTier === 3 && !wonRef.current) {
                    wonRef.current = true;
                    onGameWin(Math.floor(scoreRef.current));
                    return;
                }

                spawnItem(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 'BOSS_REWARD');
                
                const currentScore = scoreRef.current;
                const nextStep = 5000; 
                nextBossScoreRef.current = Math.ceil((currentScore + 1) / nextStep) * nextStep;
                
            } else {
                let scoreGain = 50; 
                if (enemy.type === 'ENEMY_ELITE') scoreGain = 400;
                if (enemy.type === 'ENEMY_KAMIKAZE') scoreGain = 200;
                if (enemy.type === 'ENEMY_MISSILE_DRONE') scoreGain = 300;
                if (enemy.type === 'ENEMY_JAMMER') scoreGain = 300;
                
                if (bossActiveRef.current) {
                    scoreGain = Math.ceil(scoreGain * 0.2);
                }

                scoreRef.current += scoreGain * difficultyMultiplierRef.current;
                createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                shakeRef.current += 2;
                
                if (Math.random() < 0.10) { 
                    spawnItem(enemy.x + enemy.width/2, enemy.y + enemy.height/2); 
                }
            }
          }
        }
      });

      // 3. Enemy Body -> Player (Crash)
      const pCx = p.x + p.width/2;
      const pCy = p.y + p.height/2;
      const hitboxW = p.width * 0.5;
      const hitboxH = p.height * 0.5;

      if (
        !enemy.dead && p.hp > 0 &&
        p.invulnerableTimer === 0 &&
        pCx - hitboxW/2 < enemy.x + enemy.width &&
        pCx + hitboxW/2 > enemy.x &&
        pCy - hitboxH/2 < enemy.y + enemy.height &&
        pCy + hitboxH/2 > enemy.y
      ) {
        if (enemy.type !== 'BOSS') enemy.dead = true; 
        p.hp -= 1; 
        p.invulnerableTimer = 60; 
        shakeRef.current += 20;
        createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ffaa00', 1.5);
      }
    });

    // 4. Enemy Bullets / Missiles / Waves -> Player
    bulletsRef.current.forEach(bullet => {
        if (bullet.type === 'PLAYER_BULLET') return;
        
        const pCx = p.x + p.width/2;
        const pCy = p.y + p.height/2;
        const hitboxW = p.width * 0.4; 
        const hitboxH = p.height * 0.4;

        // WAVE COLLISION (Circle vs Rect approximation)
        if (bullet.type === 'ENEMY_WAVE') {
             if (bullet.dead) return;
             const r = bullet.width / 2;
             const bCx = bullet.x + r;
             const bCy = bullet.y + r;
             // Distance to player center
             const dx = pCx - bCx;
             const dy = pCy - bCy;
             const dist = Math.sqrt(dx*dx + dy*dy);
             
             // If player touches the wave ring
             if (dist < r + hitboxW && dist > r - 20) {
                 if ((p.jammedTimer || 0) <= 0) {
                     showFloatingText(p.x, p.y - 40, "警告: 系统干扰!", "#ff00ff");
                 }
                 p.jammedTimer = 600; // 10 seconds (at 60fps)
             }
             return; // Wave doesn't die on contact
        }

        // Standard Bullet/Missile Collision
        if (
            !bullet.dead && p.hp > 0 &&
            p.invulnerableTimer === 0 &&
            bullet.x < pCx + hitboxW/2 && bullet.x + bullet.width > pCx - hitboxW/2 &&
            bullet.y < pCy + hitboxH/2 && bullet.height + bullet.y > pCy - hitboxH/2
        ) {
            bullet.dead = true;
            p.hp -= 1; 
            p.invulnerableTimer = 60;
            shakeRef.current += 10;
            createExplosion(pCx, pCy, '#ff0000', 0.5);
        }
    });

    bulletsRef.current = bulletsRef.current.filter(b => !b.dead);

    // Particle update
    particlesRef.current.forEach(p => {
      if (p.isShockwave) {
          p.size = (p.size || 1) + 4 * timeScale;
          p.life = (p.life || 1) - (p.decay || 0.1) * timeScale;
      } else {
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        p.life = (p.life || 1) - (p.decay || 0.1) * timeScale;
      }
    });
    particlesRef.current = particlesRef.current.filter(p => (p.life || 0) > 0);
    
    floatingTextsRef.current.forEach(t => { t.y -= 1 * timeScale; t.life -= 1 * timeScale; });
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.life > 0);

    // --- DRAWING ---
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life || 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.isShockwave) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4;
          ctx.arc(p.x, p.y, p.size || 1, 0, Math.PI * 2);
          ctx.stroke();
      } else {
          ctx.arc(p.x, p.y, p.size || 1, 0, Math.PI * 2);
          ctx.fill();
      }
    });
    ctx.globalAlpha = 1.0;

    // Draw Items
    itemsRef.current.forEach(item => {
        ctx.save();
        ctx.translate(item.x + item.width/2, item.y + item.height/2);
        const scale = 1 + Math.sin(accumulatorsRef.current.bossPattern * 0.1) * 0.2;
        ctx.scale(scale, scale);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = item.color;
        
        if (item.itemType === 'WEAPON_UPGRADE') {
             ctx.fillStyle = '#222';
             ctx.fillRect(-15, -15, 30, 30); 
             ctx.strokeStyle = item.color;
             ctx.lineWidth = 2;
             ctx.strokeRect(-15, -15, 30, 30);
             ctx.beginPath();
             ctx.moveTo(-15, -15); ctx.lineTo(15, 15);
             ctx.moveTo(15, -15); ctx.lineTo(-15, 15);
             ctx.stroke();
             ctx.fillStyle = item.color;
             ctx.beginPath();
             ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0);
             ctx.fill();
        } else if (item.itemType === 'HEAL') {
             ctx.fillStyle = item.color;
             ctx.fillRect(-8, -3, 16, 6);
             ctx.fillRect(-3, -8, 6, 16);
        } else if (item.itemType === 'BOSS_REWARD') {
             ctx.fillStyle = item.color;
             ctx.beginPath();
             ctx.arc(0, 0, 10, 0, Math.PI*2);
             ctx.fill();
             ctx.strokeStyle = '#fff';
             ctx.lineWidth = 2;
             ctx.stroke();
        }
        ctx.restore();
    });

    bulletsRef.current.forEach(b => {
      ctx.shadowBlur = 8;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      
      if (b.type === 'ENEMY_MISSILE') {
          ctx.save();
          ctx.translate(b.x, b.y); // Pivot at position
          ctx.rotate(b.rotation || 0);
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(5, 5);
          ctx.lineTo(0, 3);
          ctx.lineTo(-5, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
      } else if (b.type === 'ENEMY_WAVE') {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(0, 204, 255, ${Math.min(1, b.life || 1)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(b.x + b.width/2, b.y + b.height/2, b.width/2, 0, Math.PI * 2);
          ctx.stroke();
      } else if (b.type === 'ENEMY_BULLET') {
          ctx.beginPath();
          ctx.arc(b.x + b.width/2, b.y + b.height/2, b.width/2, 0, Math.PI*2);
          ctx.fill();
      } else {
          ctx.fillRect(b.x, b.y, b.width, b.height);
      }
    });
    ctx.shadowBlur = 0;

    enemiesRef.current.forEach(e => {
      ctx.save();
      ctx.translate(e.x + e.width/2, e.y + e.height/2);
      
      if (e.type === 'BOSS') {
          ctx.shadowBlur = 20;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(0, e.height/2);
          ctx.lineTo(-e.width/2, -e.height/4);
          ctx.lineTo(-e.width/4, -e.height/2);
          ctx.lineTo(e.width/4, -e.height/2);
          ctx.lineTo(e.width/2, -e.height/4);
          ctx.closePath();
          ctx.fill();
          
          if (e.bossTier && e.bossTier >= 2) {
             ctx.fillStyle = e.bossTier === 3 ? '#ffffff' : '#ff0000';
             ctx.beginPath();
             ctx.moveTo(0, e.height/2 + 20);
             ctx.lineTo(-15, 0);
             ctx.lineTo(15, 0);
             ctx.fill();
          }

          ctx.fillStyle = '#fff';
          const pulse = Math.sin(accumulatorsRef.current.bossPattern * 0.2) * 5;
          ctx.beginPath();
          ctx.arc(0, 0, 15 + pulse, 0, Math.PI*2);
          ctx.fill();
          
          ctx.fillStyle = 'red';
          ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width, 10);
          ctx.fillStyle = '#00ff00';
          const hpPercent = Math.max(0, e.hp / (e.maxHp || 1));
          ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width * hpPercent, 10);

      } else if (e.type === 'ENEMY_ELITE') {
          ctx.rotate(e.rotation || 0);
          ctx.shadowBlur = 10;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(0, -e.height/2);
          ctx.lineTo(e.width/2, 0);
          ctx.lineTo(e.width/4, e.height/2);
          ctx.lineTo(-e.width/4, e.height/2);
          ctx.lineTo(-e.width/2, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ff5555';
          ctx.fillRect(-e.width/4, -e.height/4, e.width/2, e.height/2);
      } else if (e.type === 'ENEMY_KAMIKAZE') {
          ctx.rotate(e.rotation || 0);
          ctx.shadowBlur = 15;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(0, -e.height/2);
          ctx.lineTo(e.width/2, 0);
          ctx.lineTo(0, e.height/2);
          ctx.lineTo(-e.width/2, 0);
          ctx.closePath();
          ctx.fill();
      } else if (e.type === 'ENEMY_MISSILE_DRONE') {
          ctx.shadowBlur = 10;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          // Drone shape
          ctx.fillRect(-15, -10, 30, 20);
          ctx.fillStyle = '#333';
          ctx.fillRect(-5, 0, 10, 15); // launcher
      } else if (e.type === 'ENEMY_JAMMER') {
          ctx.shadowBlur = 10;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          // Dish shape
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI, true);
          ctx.fill();
          ctx.fillRect(-2, 0, 4, 15);
      } else if (e.type === 'ENEMY_SHOOTER') {
          ctx.shadowBlur = 10;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(0, e.height/2);
          ctx.lineTo(-e.width/2, -e.height/2);
          ctx.lineTo(e.width/2, -e.height/2);
          ctx.closePath();
          ctx.fill();
      } else {
          ctx.rotate(e.rotation || 0);
          ctx.shadowBlur = 10;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(0, e.height/2);
          ctx.lineTo(-e.width/2, -e.height/2);
          ctx.lineTo(0, -e.height/4); 
          ctx.lineTo(e.width/2, -e.height/2);
          ctx.closePath();
          ctx.fill();
      }
      ctx.restore();
    });
    ctx.shadowBlur = 0;

    // Draw Player
    if (p.hp > 0) {
      if (!p.invulnerableTimer || Math.floor(accumulatorsRef.current.bossPattern / 4) % 2 === 0) {
          const isJammed = (p.jammedTimer || 0) > 0;
          
          ctx.shadowBlur = 20;
          ctx.shadowColor = isJammed ? '#555' : (stats.spreadLevel > 0 ? '#ffff00' : '#00ff99');
          ctx.fillStyle = isJammed ? '#888' : (stats.damage > 2 ? '#ffccaa' : (stats.spreadLevel > 0 ? '#ffffaa' : '#00ff99')); 
          
          // Glitch effect if jammed
          if (isJammed && Math.random() < 0.3) {
              ctx.translate((Math.random()-0.5)*5, 0);
          }

          ctx.save();
          ctx.translate(p.x + p.width/2, p.y + p.height/2);

          ctx.beginPath();
          ctx.moveTo(0, -p.height/2); 
          ctx.lineTo(p.width/2, p.height/2); 
          ctx.lineTo(p.width/6, p.height/3); 
          ctx.lineTo(0, p.height/2); 
          ctx.lineTo(-p.width/6, p.height/3); 
          ctx.lineTo(-p.width/2, p.height/2); 
          ctx.closePath();
          ctx.fill();
          
          if (stats.spreadLevel > 0) {
              ctx.fillStyle = isJammed ? '#555' : '#ff9900';
              const wingSize = 10 + (stats.spreadLevel * 2);
              ctx.fillRect(-p.width, 0, 10, wingSize);
              ctx.fillRect(p.width - 10, 0, 10, wingSize);
          }
          
          ctx.restore();
          ctx.shadowBlur = 0;
          
          if (isJammed) {
              ctx.fillStyle = "#ff0000";
              ctx.font = "bold 12px monospace";
              ctx.fillText("! JAMMED !", p.x - 10, p.y - 10);
          }
      }
    }

    ctx.restore();
    
    floatingTextsRef.current.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.font = 'bold 16px monospace';
        ctx.globalAlpha = Math.min(1, t.life / 20);
        ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;

    // UI Overlay
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`得分: ${Math.floor(scoreRef.current)}`, 20, 40);
    
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`武器: LV ${stats.damage + stats.spreadLevel}/${MAX_WEAPON_LEVEL}`, 20, 90);

    if (bossActiveRef.current) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        const alpha = Math.abs(Math.sin(accumulatorsRef.current.bossPattern * 0.1));
        ctx.globalAlpha = alpha;
        const bossEntity = enemiesRef.current.find(e => e.type === 'BOSS');
        let bossText = "BOSS 警报";
        if (bossEntity && bossEntity.bossTier === 3) bossText = "☠️ 终极审判 ☠️";
        ctx.fillText(bossText, canvas.width / 2, 120);
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'left';
    }

    // Health UI (Discrete Segments)
    const segmentWidth = 30;
    const segmentGap = 5;
    const startX = 20;
    const startY = 60;
    const maxHp = p.maxHp || 5;

    for (let i = 0; i < maxHp; i++) {
        const x = startX + i * (segmentWidth + segmentGap);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, startY, segmentWidth, 10);

        if (i < p.hp) {
            ctx.fillStyle = p.hp <= 1 ? '#ff0000' : '#00ff00';
            ctx.fillRect(x + 2, startY + 2, segmentWidth - 4, 6);
        }
    }

    if (p.hp <= 0 && p.hp > -100) {
      setTimeout(() => onGameOver(Math.floor(scoreRef.current)), 1000); 
      p.hp = -100; 
      createExplosion(p.x + 20, p.y + 20, '#00ff99', 3);
      shakeRef.current = 50; 
    }

    requestRef.current = requestAnimationFrame(() => update(canvas));
  }, [difficulty, onGameOver, onGameWin]);

  const handleTouchStart = (e: React.TouchEvent) => {
    playerStats.current.dragging = true;
    lastTouchX.current = e.touches[0].clientX;
    updatePlayerPos(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (playerStats.current.dragging) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const vx = x - lastTouchX.current;
      playerRef.current.vx = vx;
      lastTouchX.current = x;
      updatePlayerPos(x, y);
    }
  };

  const handleTouchEnd = () => {
    playerStats.current.dragging = false;
    playerRef.current.vx = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
     if (e.buttons === 1) { 
         playerRef.current.vx = e.movementX;
         updatePlayerPos(e.clientX, e.clientY);
     }
  };

  const updatePlayerPos = (clientX: number, clientY: number) => {
     playerRef.current.x = clientX - playerRef.current.width / 2;
     playerRef.current.y = clientY - playerRef.current.height / 2 - 50; 
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      playerRef.current.x = canvas.width / 2 - 20;
      playerRef.current.y = canvas.height - 150;
    };
    window.addEventListener('resize', resize);
    resize();
    requestRef.current = requestAnimationFrame(() => update(canvas));
    return () => {
      window.removeEventListener('resize', resize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full touch-none cursor-crosshair bg-transparent"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={(e) => { playerStats.current.dragging = true; updatePlayerPos(e.clientX, e.clientY); }}
      onMouseMove={handleMouseMove}
      onMouseUp={() => playerStats.current.dragging = false}
    />
  );
};

export default GameCanvas;
