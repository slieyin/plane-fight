import React, { useRef, useEffect, useCallback } from 'react';
import { Difficulty } from '../types';

interface GameCanvasProps {
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
}

// Game Constants
const BULLET_SPEED = 15;
const ENEMY_SPEED_BASE = 2;
const SPAWN_RATE_BASE = 60; // Frames

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
  
  // Game State Refs
  const playerRef = useRef({ x: 0, y: 0, width: 40, height: 48, hp: 100, dragging: false, vx: 0 });
  const lastTouchX = useRef(0); // To calculate player velocity for banking effect
  
  const bulletsRef = useRef<any[]>([]);
  const enemiesRef = useRef<any[]>([]);
  const particlesRef = useRef<any[]>([]);
  const starsRef = useRef<Star[]>([]);
  const difficultyMultiplierRef = useRef(1);

  // Set difficulty params
  useEffect(() => {
    switch (difficulty) {
      case Difficulty.EASY: difficultyMultiplierRef.current = 1; break;
      case Difficulty.NORMAL: difficultyMultiplierRef.current = 1.5; break;
      case Difficulty.HARDCORE: difficultyMultiplierRef.current = 2.5; break;
    }
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

  // Spawn Helpers
  const spawnBullet = (x: number, y: number) => {
    bulletsRef.current.push({
      x: x - 2, y, width: 4, height: 16, vx: 0, vy: -BULLET_SPEED, color: '#00ffff'
    });
    // Gunfire particle
    particlesRef.current.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 2, vy: 2, life: 0.5, color: '#00ffff', size: 2
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
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.1
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
        size: Math.random() * 4 + 1
      });
    }
    // Shockwave
    particlesRef.current.push({
        x, y, vx: 0, vy: 0, life: 0.5, decay: 0.1, color: 'white', size: 10, isShockwave: true
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
        color: '#00ccff',
        size: Math.random() * 3 + 2
     });
  };

  // Main Loop
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
    ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20); // Oversize clear for shake

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
    if (playerRef.current.x < 0) playerRef.current.x = 0;
    if (playerRef.current.x > canvas.width - playerRef.current.width) playerRef.current.x = canvas.width - playerRef.current.width;
    
    // Engine Trail
    if (frameCountRef.current % 2 === 0 && playerRef.current.hp > 0) {
        spawnEngineTrail(playerRef.current);
    }

    // Auto Shoot
    if (frameCountRef.current % 8 === 0 && playerRef.current.hp > 0) {
       spawnBullet(playerRef.current.x + playerRef.current.width / 2, playerRef.current.y);
    }

    // 2. Spawning
    const spawnRate = Math.max(15, Math.floor(SPAWN_RATE_BASE / difficultyMultiplierRef.current));
    if (frameCountRef.current % spawnRate === 0) {
      spawnEnemy(canvas.width);
    }

    // 3. Update Entities
    bulletsRef.current.forEach(b => { b.x += b.vx; b.y += b.vy; });
    bulletsRef.current = bulletsRef.current.filter(b => b.y > -50 && b.y < canvas.height + 50);

    enemiesRef.current.forEach(e => { 
        e.x += e.vx; 
        e.y += e.vy; 
        e.rotation += e.rotationSpeed;
    });
    enemiesRef.current = enemiesRef.current.filter(e => !e.dead && e.y < canvas.height + 100);

    // 4. Collision
    enemiesRef.current.forEach(enemy => {
      // Bullet vs Enemy
      bulletsRef.current.forEach(bullet => {
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
              life: 0.3, decay: 0.1, color: '#fff', size: 2
          });

          if (enemy.hp <= 0) {
            enemy.dead = true;
            scoreRef.current += 100 * difficultyMultiplierRef.current;
            createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
            shakeRef.current += 2; // Slight shake on enemy kill
          }
        }
      });

      // Player vs Enemy
      if (
        !enemy.dead && playerRef.current.hp > 0 &&
        playerRef.current.x < enemy.x + enemy.width &&
        playerRef.current.x + playerRef.current.width > enemy.x &&
        playerRef.current.y < enemy.y + enemy.height &&
        playerRef.current.height + playerRef.current.y > enemy.y
      ) {
        enemy.dead = true;
        playerRef.current.hp -= 20;
        shakeRef.current += 20; // Big shake on player hit
        createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ffaa00', 1.5); // Enemy explode
        createExplosion(playerRef.current.x + playerRef.current.width/2, playerRef.current.y, '#00ffff', 0.5); // Player shield hit
      }
    });
    bulletsRef.current = bulletsRef.current.filter(b => !b.dead);

    // 5. Particles
    particlesRef.current.forEach(p => {
      if (p.isShockwave) {
          p.size += 3;
          p.life -= p.decay;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
      }
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);


    // --- DRAWING ---

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.isShockwave) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
      } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
      }
    });
    ctx.globalAlpha = 1.0;

    // Draw Bullets (Glowing)
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = '#ccffff';
    bulletsRef.current.forEach(b => {
      ctx.fillRect(b.x, b.y, b.width, b.height);
    });
    ctx.shadowBlur = 0;

    // Draw Enemies
    enemiesRef.current.forEach(e => {
      ctx.save();
      ctx.translate(e.x + e.width/2, e.y + e.height/2);
      ctx.rotate(e.rotation);
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      
      // Enemy Shape
      ctx.beginPath();
      ctx.moveTo(0, e.height/2);
      ctx.lineTo(-e.width/2, -e.height/2);
      ctx.lineTo(0, -e.height/4); // Notch
      ctx.lineTo(e.width/2, -e.height/2);
      ctx.closePath();
      ctx.fill();
      
      // Inner Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();
    });
    ctx.shadowBlur = 0;

    // Draw Player
    const p = playerRef.current;
    if (p.hp > 0) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff99';
      ctx.fillStyle = '#00ff99';
      
      // Compute tilt based on velocity/dragging
      const tilt = (p.vx || 0) * -2; // Simple tilt logic if we tracked vx properly
      
      ctx.save();
      ctx.translate(p.x + p.width/2, p.y + p.height/2);
      // ctx.rotate(tilt * Math.PI / 180); // Optional tilt

      // Advanced Ship Shape
      ctx.beginPath();
      ctx.moveTo(0, -p.height/2); // Nose
      ctx.lineTo(p.width/2, p.height/2); // Right wing tip
      ctx.lineTo(p.width/6, p.height/3); // Right inner
      ctx.lineTo(0, p.height/2); // Engine
      ctx.lineTo(-p.width/6, p.height/3); // Left inner
      ctx.lineTo(-p.width/2, p.height/2); // Left wing tip
      ctx.closePath();
      ctx.fill();
      
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
    // Translate "SCORE" to Chinese
    ctx.fillText(`得分: ${Math.floor(scoreRef.current)}`, 20, 40);
    
    // Health Bar
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, 60, 200, 10);
    ctx.fillStyle = p.hp > 30 ? '#00ff00' : '#ff0000';
    ctx.fillRect(22, 62, Math.max(0, (p.hp/100) * 196), 6);

    // Check Game Over
    if (playerRef.current.hp <= 0) {
      setTimeout(() => onGameOver(Math.floor(scoreRef.current)), 1000); // Delay for explosion effect
      playerRef.current.hp = -1; // Ensure single trigger
      createExplosion(playerRef.current.x + 20, playerRef.current.y + 20, '#00ff99', 3);
      shakeRef.current = 50; // Massive death shake
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
      // Calc simple velocity for effects
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
     if (e.buttons === 1) { // Only drag if clicked
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