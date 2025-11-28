import React, { useRef, useEffect, useCallback } from 'react';
import { Difficulty, Entity, ItemType } from '../types';

interface GameCanvasProps {
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
}

// Game Constants
const BULLET_SPEED = 15;
const ENEMY_SPEED_BASE = 2;
const SPAWN_RATE_BASE = 60; // Frames
const BOSS_SPAWN_SCORE = 1000; // Spawn boss every 1000 points

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ difficulty, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const shakeRef = useRef(0);
  const nextBossScoreRef = useRef(BOSS_SPAWN_SCORE);
  const bossActiveRef = useRef(false);
  
  // Game State Refs
  const playerRef = useRef({ 
    x: 0, y: 0, width: 40, height: 48, 
    hp: 100, maxHp: 100, 
    dragging: false, vx: 0, 
    weaponLevel: 0 // 0: Normal, 1: Spread
  });
  const lastTouchX = useRef(0);
  
  const bulletsRef = useRef<Entity[]>([]);
  const enemiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Entity[]>([]);
  const itemsRef = useRef<Entity[]>([]); // New: Items
  const starsRef = useRef<Star[]>([]);
  const difficultyMultiplierRef = useRef(1);

  // Set difficulty params
  useEffect(() => {
    switch (difficulty) {
      case Difficulty.EASY: difficultyMultiplierRef.current = 1; break;
      case Difficulty.NORMAL: difficultyMultiplierRef.current = 1.5; break;
      case Difficulty.HARDCORE: difficultyMultiplierRef.current = 2.5; break;
    }
    // Reset boss threshold on start
    nextBossScoreRef.current = BOSS_SPAWN_SCORE;
    bossActiveRef.current = false;
  }, [difficulty]);

  // Init Stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 100; i++) {
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

  // --- SPAWNERS ---

  const spawnPlayerBullet = (x: number, y: number, angleOffset: number = 0) => {
    const vx = Math.sin(angleOffset) * BULLET_SPEED;
    const vy = -Math.cos(angleOffset) * BULLET_SPEED;
    
    bulletsRef.current.push({
      x: x - 2, y, width: 4, height: 16, 
      vx: vx, vy: vy, 
      color: '#00ffff', hp: 1, type: 'PLAYER_BULLET'
    });
    // Gunfire particle
    particlesRef.current.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 2, vy: 2, life: 0.3, decay: 0.1, color: '#00ffff', size: 2, type: 'PARTICLE', hp: 0
    });
  };

  const spawnEnemyBullet = (x: number, y: number, vx: number, vy: number, color: string = '#ff0055') => {
    bulletsRef.current.push({
      x: x - 4, y, width: 8, height: 8, 
      vx: vx, vy: vy, 
      color: color, hp: 1, type: 'ENEMY_BULLET'
    });
  };

  const spawnEnemy = (canvasWidth: number) => {
    const size = 30 + Math.random() * 20;
    const x = Math.random() * (canvasWidth - size);
    const speed = (ENEMY_SPEED_BASE + Math.random() * 2) * difficultyMultiplierRef.current;
    
    enemiesRef.current.push({
      x,
      y: -60,
      width: size,
      height: size,
      vx: (Math.random() - 0.5) * difficultyMultiplierRef.current, 
      vy: speed,
      hp: difficulty === Difficulty.HARDCORE ? 3 : 1,
      maxHp: difficulty === Difficulty.HARDCORE ? 3 : 1,
      color: difficulty === Difficulty.HARDCORE ? '#ff0055' : '#ff9900',
      type: 'ENEMY_BASIC',
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.1
    });
  };

  const spawnBoss = (canvasWidth: number) => {
    bossActiveRef.current = true;
    const width = 120;
    const height = 100;
    enemiesRef.current.push({
      x: canvasWidth / 2 - width / 2,
      y: -150, // Start well above screen
      width: width,
      height: height,
      vx: 0,
      vy: 1, // Move down slowly initially
      hp: 200 * difficultyMultiplierRef.current,
      maxHp: 200 * difficultyMultiplierRef.current,
      color: '#aa00ff', // Purple Boss
      type: 'BOSS',
      rotation: 0,
      rotationSpeed: 0,
      attackTimer: 0
    });
    
    // Warning Effect
    shakeRef.current = 10;
  };

  const spawnItem = (x: number, y: number) => {
    const rand = Math.random();
    let type: ItemType = 'HEAL';
    let color = '#00ff00';
    
    if (rand > 0.6) {
      type = 'WEAPON_UPGRADE';
      color = '#ffff00';
    }

    itemsRef.current.push({
      x, y, width: 24, height: 24,
      vx: 0, vy: 1.5,
      hp: 1, type: 'ITEM',
      itemType: type,
      color: color,
      rotation: 0
    });
  };

  const createExplosion = (x: number, y: number, color: string, scale: number = 1) => {
    const count = 20 * scale;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03,
        color: color,
        size: Math.random() * 4 + 1,
        type: 'PARTICLE', hp: 0
      });
    }
    // Shockwave
    particlesRef.current.push({
        x, y, vx: 0, vy: 0, life: 0.5, decay: 0.1, color: 'white', size: 10, isShockwave: true, type: 'PARTICLE', hp: 0
    });
  };

  const spawnEngineTrail = (p: typeof playerRef.current) => {
     particlesRef.current.push({
        x: p.x + p.width / 2 + (Math.random() - 0.5) * 10,
        y: p.y + p.height,
        vx: (Math.random() - 0.5) * 2,
        vy: 4 + Math.random() * 4,
        life: 0.8,
        decay: 0.08,
        color: p.weaponLevel > 0 ? '#ffff00' : '#00ccff', // Trail changes color with weapon
        size: Math.random() * 3 + 2,
        type: 'PARTICLE', hp: 0
     });
  };

  // --- MAIN UPDATE LOOP ---
  const update = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    frameCountRef.current++;

    // Shake Decay
    if (shakeRef.current > 0) {
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    // Clear & Shake Transform
    ctx.save();
    if (shakeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(dx, dy);
    }
    
    // Clear Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

    // 0. Draw Stars
    ctx.fillStyle = '#ffffff';
    starsRef.current.forEach(star => {
        star.y += star.speed;
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

    // 1. Player Logic
    const p = playerRef.current;
    if (p.x < 0) p.x = 0;
    if (p.x > canvas.width - p.width) p.x = canvas.width - p.width;
    
    // Engine Trail
    if (frameCountRef.current % 2 === 0 && p.hp > 0) {
        spawnEngineTrail(p);
    }

    // Auto Shoot
    if (frameCountRef.current % 8 === 0 && p.hp > 0) {
       const centerX = p.x + p.width / 2;
       spawnPlayerBullet(centerX, p.y);
       
       // Weapon Upgrade: Spread Shot
       if (p.weaponLevel >= 1) {
           spawnPlayerBullet(centerX, p.y + 10, -0.2); // Left spread
           spawnPlayerBullet(centerX, p.y + 10, 0.2);  // Right spread
       }
    }

    // 2. Spawning Logic (Boss vs Normal)
    if (!bossActiveRef.current && scoreRef.current >= nextBossScoreRef.current) {
        spawnBoss(canvas.width);
        nextBossScoreRef.current += BOSS_SPAWN_SCORE * 1.5; // Increase gap next time
    }

    const spawnRate = Math.max(15, Math.floor(SPAWN_RATE_BASE / difficultyMultiplierRef.current));
    // Don't spawn normal enemies if Boss is active
    if (!bossActiveRef.current && frameCountRef.current % spawnRate === 0) {
      spawnEnemy(canvas.width);
    }

    // 3. Update Entities
    
    // Bullets
    bulletsRef.current.forEach(b => { b.x += b.vx; b.y += b.vy; });
    bulletsRef.current = bulletsRef.current.filter(b => b.y > -50 && b.y < canvas.height + 50);

    // Items
    itemsRef.current.forEach(item => {
        item.y += item.vy;
        item.rotation = (item.rotation || 0) + 0.05;
    });
    itemsRef.current = itemsRef.current.filter(i => i.y < canvas.height + 50 && !i.dead);

    // Enemies (and BOSS)
    enemiesRef.current.forEach(e => { 
        if (e.type === 'BOSS') {
            // Boss AI
            if (e.y < 80) e.y += 1; // Enter phase
            else {
                // Strafe phase
                e.x += Math.sin(frameCountRef.current * 0.02) * 3 * difficultyMultiplierRef.current;
                e.x = Math.max(0, Math.min(canvas.width - e.width, e.x));
                
                // Attack logic
                e.attackTimer = (e.attackTimer || 0) + 1;
                if (e.attackTimer > 60) {
                    e.attackTimer = 0;
                    // Shoot fan
                    const cx = e.x + e.width/2;
                    const cy = e.y + e.height;
                    for(let angle = -0.5; angle <= 0.5; angle += 0.25) {
                        spawnEnemyBullet(cx, cy, Math.sin(angle) * 5, Math.cos(angle) * 5, '#ff00ff');
                    }
                }
            }
        } else {
            // Normal Enemy
            e.x += e.vx; 
            e.y += e.vy; 
            e.rotation = (e.rotation || 0) + (e.rotationSpeed || 0);
        }
    });
    enemiesRef.current = enemiesRef.current.filter(e => !e.dead && e.y < canvas.height + 200);

    // 4. Collision
    
    // Item Pickup
    itemsRef.current.forEach(item => {
        if (
            p.hp > 0 && !item.dead &&
            p.x < item.x + item.width && p.x + p.width > item.x &&
            p.y < item.y + item.height && p.y + p.height > item.y
        ) {
            item.dead = true;
            // Effect
            if (item.itemType === 'HEAL') {
                p.hp = Math.min(p.maxHp, p.hp + 30);
                particlesRef.current.push({ x: p.x, y: p.y, vx: 0, vy: -2, life: 1, decay: 0.02, color: '#00ff00', size: 20, isShockwave: true, type: 'PARTICLE', hp: 0 });
            } else if (item.itemType === 'WEAPON_UPGRADE') {
                p.weaponLevel = 1;
                particlesRef.current.push({ x: p.x, y: p.y, vx: 0, vy: -2, life: 1, decay: 0.02, color: '#ffff00', size: 20, isShockwave: true, type: 'PARTICLE', hp: 0 });
            }
        }
    });

    enemiesRef.current.forEach(enemy => {
      // Bullet vs Enemy/Boss
      bulletsRef.current.forEach(bullet => {
        if (bullet.type !== 'PLAYER_BULLET') return;

        if (
          !bullet.dead && !enemy.dead &&
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.height + bullet.y > enemy.y
        ) {
          enemy.hp--;
          bullet.dead = true;
          // Spark on hit
          particlesRef.current.push({
              x: bullet.x, y: bullet.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, 
              life: 0.3, decay: 0.1, color: '#fff', size: 2, type: 'PARTICLE', hp: 0
          });

          if (enemy.hp <= 0) {
            enemy.dead = true;
            
            if (enemy.type === 'BOSS') {
                scoreRef.current += 5000 * difficultyMultiplierRef.current;
                createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 4);
                shakeRef.current = 20;
                bossActiveRef.current = false;
                // Boss always drops weapon upgrade
                spawnItem(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
            } else {
                scoreRef.current += 100 * difficultyMultiplierRef.current;
                createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
                shakeRef.current += 2;
                // Chance to drop item
                if (Math.random() < 0.05) { // 5% drop rate
                    spawnItem(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
                }
            }
          }
        }
      });

      // Player vs Enemy/Boss (Crash)
      if (
        !enemy.dead && p.hp > 0 &&
        p.x < enemy.x + enemy.width &&
        p.x + p.width > enemy.x &&
        p.y < enemy.y + enemy.height &&
        p.height + p.y > enemy.y
      ) {
        if (enemy.type !== 'BOSS') enemy.dead = true; // Boss doesn't die on crash
        p.hp -= 20;
        p.weaponLevel = 0; // Lose upgrade on hit
        shakeRef.current += 20;
        createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ffaa00', 1.5);
        createExplosion(p.x + p.width/2, p.y, '#00ffff', 0.5);
      }
    });

    // Enemy Bullets vs Player
    bulletsRef.current.forEach(bullet => {
        if (bullet.type !== 'ENEMY_BULLET') return;
        if (
            !bullet.dead && p.hp > 0 &&
            bullet.x < p.x + p.width && bullet.x + bullet.width > p.x &&
            bullet.y < p.y + p.height && bullet.height + bullet.y > p.y
        ) {
            bullet.dead = true;
            p.hp -= 10;
            p.weaponLevel = 0; // Lose upgrade on hit
            shakeRef.current += 10;
            createExplosion(p.x + p.width/2, p.y + p.height/2, '#ff0000', 0.5);
        }
    });

    bulletsRef.current = bulletsRef.current.filter(b => !b.dead);

    // 5. Particles
    particlesRef.current.forEach(p => {
      if (p.isShockwave) {
          p.size = (p.size || 1) + 3;
          p.life = (p.life || 1) - (p.decay || 0.1);
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.life = (p.life || 1) - (p.decay || 0.1);
      }
    });
    particlesRef.current = particlesRef.current.filter(p => (p.life || 0) > 0);


    // --- DRAWING ---

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life || 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.isShockwave) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
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
        // Bobbing effect
        const scale = 1 + Math.sin(frameCountRef.current * 0.1) * 0.2;
        ctx.scale(scale, scale);
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = item.color;
        
        if (item.itemType === 'HEAL') {
             // Draw Cross
             ctx.fillStyle = item.color;
             ctx.fillRect(-8, -3, 16, 6);
             ctx.fillRect(-3, -8, 6, 16);
        } else {
             // Draw Bolt
             ctx.fillStyle = item.color;
             ctx.beginPath();
             ctx.moveTo(5, -8);
             ctx.lineTo(-2, 0);
             ctx.lineTo(2, 0);
             ctx.lineTo(-5, 8);
             ctx.lineTo(2, 0);
             ctx.lineTo(-2, 0);
             ctx.closePath();
             ctx.fill();
        }
        
        ctx.restore();
    });

    // Draw Bullets
    bulletsRef.current.forEach(b => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color === '#ff00ff' ? '#ffccff' : '#ccffff'; // Boss bullets brighter
      
      if (b.type === 'ENEMY_BULLET') {
          ctx.beginPath();
          ctx.arc(b.x + b.width/2, b.y + b.height/2, b.width/2, 0, Math.PI*2);
          ctx.fill();
      } else {
          ctx.fillRect(b.x, b.y, b.width, b.height);
      }
    });
    ctx.shadowBlur = 0;

    // Draw Enemies & Boss
    enemiesRef.current.forEach(e => {
      ctx.save();
      ctx.translate(e.x + e.width/2, e.y + e.height/2);
      
      if (e.type === 'BOSS') {
          ctx.shadowBlur = 20;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          
          // Complex Boss Shape
          ctx.beginPath();
          ctx.moveTo(0, e.height/2);
          ctx.lineTo(-e.width/2, -e.height/4);
          ctx.lineTo(-e.width/4, -e.height/2);
          ctx.lineTo(e.width/4, -e.height/2);
          ctx.lineTo(e.width/2, -e.height/4);
          ctx.closePath();
          ctx.fill();
          
          // Glowing Core
          ctx.fillStyle = '#fff';
          const pulse = Math.sin(frameCountRef.current * 0.2) * 5;
          ctx.beginPath();
          ctx.arc(0, 0, 15 + pulse, 0, Math.PI*2);
          ctx.fill();
          
          // Draw Boss HP Bar above it
          ctx.fillStyle = 'red';
          ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width, 10);
          ctx.fillStyle = '#00ff00';
          const hpPercent = Math.max(0, e.hp / (e.maxHp || 1));
          ctx.fillRect(-e.width/2, -e.height/2 - 20, e.width * hpPercent, 10);

      } else {
          ctx.rotate(e.rotation || 0);
          ctx.shadowBlur = 15;
          ctx.shadowColor = e.color;
          ctx.fillStyle = e.color;
          
          // Enemy Shape
          ctx.beginPath();
          ctx.moveTo(0, e.height/2);
          ctx.lineTo(-e.width/2, -e.height/2);
          ctx.lineTo(0, -e.height/4); 
          ctx.lineTo(e.width/2, -e.height/2);
          ctx.closePath();
          ctx.fill();
          
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI*2);
          ctx.fill();
      }
      ctx.restore();
    });
    ctx.shadowBlur = 0;

    // Draw Player
    if (p.hp > 0) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = p.weaponLevel > 0 ? '#ffff00' : '#00ff99';
      ctx.fillStyle = p.weaponLevel > 0 ? '#ffffaa' : '#00ff99'; // Turn yellow if powered up
      
      ctx.save();
      ctx.translate(p.x + p.width/2, p.y + p.height/2);
      // Ship Shape
      ctx.beginPath();
      ctx.moveTo(0, -p.height/2); 
      ctx.lineTo(p.width/2, p.height/2); 
      ctx.lineTo(p.width/6, p.height/3); 
      ctx.lineTo(0, p.height/2); 
      ctx.lineTo(-p.width/6, p.height/3); 
      ctx.lineTo(-p.width/2, p.height/2); 
      ctx.closePath();
      ctx.fill();
      
      // Weapon Upgrade Visuals (Wings)
      if (p.weaponLevel > 0) {
          ctx.fillStyle = '#ff9900';
          ctx.fillRect(-p.width, 0, 10, 20);
          ctx.fillRect(p.width - 10, 0, 10, 20);
      }
      
      // Cockpit
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(0, -p.height/4);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-4, 0);
      ctx.fill();

      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // Restore shake transform
    ctx.restore();

    // UI Overlay (No Shake)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`得分: ${Math.floor(scoreRef.current)}`, 20, 40);
    
    // Boss Warning Text
    if (bossActiveRef.current) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        const alpha = Math.abs(Math.sin(frameCountRef.current * 0.1));
        ctx.globalAlpha = alpha;
        ctx.fillText("BOSS 警报", canvas.width / 2, 120);
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'left';
    }

    // Health Bar
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, 60, 200, 10);
    ctx.fillStyle = p.hp > 30 ? '#00ff00' : '#ff0000';
    ctx.fillRect(22, 62, Math.max(0, (p.hp/p.maxHp) * 196), 6);

    // Check Game Over
    if (p.hp <= 0 && p.hp > -100) {
      setTimeout(() => onGameOver(Math.floor(scoreRef.current)), 1000); 
      p.hp = -100; // Permanently dead
      createExplosion(p.x + 20, p.y + 20, '#00ff99', 3);
      shakeRef.current = 50; 
    }

    requestRef.current = requestAnimationFrame(() => update(canvas));
  }, [difficulty, onGameOver]);


  // Touch Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    playerRef.current.dragging = true;
    lastTouchX.current = e.touches[0].clientX;
    updatePlayerPos(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (playerRef.current.dragging) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      playerRef.current.vx = x - lastTouchX.current;
      lastTouchX.current = x;
      updatePlayerPos(x, y);
    }
  };

  const handleTouchEnd = () => {
    playerRef.current.dragging = false;
    playerRef.current.vx = 0;
  };

  // Mouse fallback
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

    // Resize handling
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
      onMouseDown={(e) => { playerRef.current.dragging = true; updatePlayerPos(e.clientX, e.clientY); }}
      onMouseMove={handleMouseMove}
      onMouseUp={() => playerRef.current.dragging = false}
    />
  );
};

export default GameCanvas;