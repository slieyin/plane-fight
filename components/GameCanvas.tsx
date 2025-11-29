import React, { useEffect, useRef } from 'react';
import { Difficulty, Entity } from '../types';

interface GameCanvasProps {
    difficulty: Difficulty;
    onGameOver: (score: number) => void;
    onGameWin: (score: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ difficulty, onGameOver, onGameWin }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const scoreRef = useRef(0);
    const isGameOverRef = useRef(false);
    
    // Game State
    const playerRef = useRef<Entity>({
        x: 0, y: 0, width: 40, height: 40, vx: 0, vy: 0,
        color: '#00ffff', hp: 100, maxHp: 100, type: 'PLAYER',
        shootTimer: 0, invulnerableTimer: 0
    });
    
    const entitiesRef = useRef<Entity[]>([]);
    const particlesRef = useRef<Entity[]>([]);
    const lastTimeRef = useRef<number>(0);
    const spawnTimerRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset state on mount
        scoreRef.current = 0;
        isGameOverRef.current = false;
        entitiesRef.current = [];
        particlesRef.current = [];
        playerRef.current = {
            x: canvas.width / 2, y: canvas.height - 100, width: 40, height: 40, vx: 0, vy: 0,
            color: '#00ffff', hp: 100, maxHp: 100, type: 'PLAYER',
            shootTimer: 0, invulnerableTimer: 0
        };

        const handleInput = (e: MouseEvent | TouchEvent) => {
             if (isGameOverRef.current) return;
             const rect = canvas.getBoundingClientRect();
             let clientX;
             if ('touches' in e) {
                 // @ts-ignore
                 clientX = e.touches[0].clientX;
             } else {
                 // @ts-ignore
                 clientX = e.clientX;
             }
             const x = clientX - rect.left;
             // Clamp player x
             playerRef.current.x = Math.max(20, Math.min(canvas.width - 20, x));
        };

        window.addEventListener('mousemove', handleInput);
        window.addEventListener('touchmove', handleInput, { passive: false });

        const spawnEnemy = () => {
             const hardMode = difficulty === Difficulty.HARDCORE || difficulty === Difficulty.ENDLESS;
             const currentScore = scoreRef.current;
             
             // Determine Enemy Type
             const rand = Math.random();
             let type: Entity['type'] = 'ENEMY_BASIC';
             
             if (currentScore > 500 && rand > 0.95) type = 'ENEMY_ELITE';
             else if (currentScore > 200 && rand > 0.85) type = 'ENEMY_MISSILE_DRONE';
             else if (currentScore > 100 && rand > 0.8) type = 'ENEMY_KAMIKAZE';
             else if (rand > 0.7) type = 'ENEMY_SHOOTER';
             else if (rand > 0.65 && hardMode) type = 'ENEMY_JAMMER';
             else if (rand > 0.6) type = 'ENEMY_BASIC'; 
             
             const x = Math.random() * (canvas.width - 60) + 30;
             let hp = 2;
             let speed = 2 + (currentScore / 1000);
             let color = '#ff3333';
             let vx = (Math.random() - 0.5) * 1;
             let width = 30;
             let height = 30;

             // Logic adapted from original snippet
             const hpScaling = Math.floor(currentScore / 600) * 4;

             if (type === 'ENEMY_ELITE') {
                 hp = 15 + (hardMode ? 10 : 0) + (hpScaling * 2);
                 speed *= 0.4; 
                 color = '#cc0000'; 
                 width = 60; height = 60;
             } else if (type === 'ENEMY_SHOOTER') {
                 hp = 3 + hpScaling;
                 speed *= 0.7;
                 color = '#aa00ff';
                 width = 35; height = 35;
             } else if (type === 'ENEMY_KAMIKAZE') {
                 hp = 5 + hpScaling;
                 speed *= 2.0; 
                 vx = 0; 
                 color = '#00ffcc';
                 width = 25; height = 25;
             } else if (type === 'ENEMY_MISSILE_DRONE') {
                 hp = 8 + hpScaling;
                 speed *= 1.2; // Fast approach
                 color = '#ff5500';
                 width = 40; height = 40;
             } else if (type === 'ENEMY_JAMMER') {
                 hp = 10 + hpScaling;
                 speed *= 0.5;
                 color = '#ffff00';
                 width = 45; height = 45;
             }

             entitiesRef.current.push({
                 type, x, y: -50, width, height, vx, vy: speed, color, hp, maxHp: hp,
                 shootTimer: Math.random() * 2 // random initial offset
             });
        };

        const update = (time: number) => {
            if (isGameOverRef.current) return;
            const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1); // Cap dt
            lastTimeRef.current = time;

            // Clear
            ctx.fillStyle = '#050510';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Grid effect
            ctx.strokeStyle = '#00ffff22';
            ctx.lineWidth = 1;
            const gridSize = 40;
            const offset = (time / 50) % gridSize;
            for (let i = 0; i < canvas.width / gridSize; i++) {
                ctx.beginPath();
                ctx.moveTo(i * gridSize, 0);
                ctx.lineTo(i * gridSize, canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i < canvas.height / gridSize; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * gridSize + offset);
                ctx.lineTo(canvas.width, i * gridSize + offset);
                ctx.stroke();
            }

            // Player Logic
            if (playerRef.current.invulnerableTimer && playerRef.current.invulnerableTimer > 0) {
                 playerRef.current.invulnerableTimer -= dt;
            }

            playerRef.current.shootTimer = (playerRef.current.shootTimer || 0) - dt;
            if (playerRef.current.shootTimer <= 0) {
                entitiesRef.current.push({
                    type: 'PLAYER_BULLET',
                    x: playerRef.current.x,
                    y: playerRef.current.y - 20,
                    width: 4, height: 12,
                    vx: 0, vy: -12,
                    color: '#00ffff',
                    hp: 1
                });
                playerRef.current.shootTimer = 0.15; 
            }

            // Render Player
            if (!playerRef.current.invulnerableTimer || playerRef.current.invulnerableTimer <= 0 || Math.floor(time / 100) % 2 === 0) {
                 ctx.fillStyle = playerRef.current.color;
                 // Simple triangle ship
                 ctx.beginPath();
                 ctx.moveTo(playerRef.current.x, playerRef.current.y - 20);
                 ctx.lineTo(playerRef.current.x - 20, playerRef.current.y + 20);
                 ctx.lineTo(playerRef.current.x, playerRef.current.y + 10);
                 ctx.lineTo(playerRef.current.x + 20, playerRef.current.y + 20);
                 ctx.fill();
                 
                 // Engine flame
                 ctx.fillStyle = `rgba(0, 255, 255, ${0.5 + Math.random() * 0.5})`;
                 ctx.beginPath();
                 ctx.moveTo(playerRef.current.x - 10, playerRef.current.y + 20);
                 ctx.lineTo(playerRef.current.x, playerRef.current.y + 35 + Math.random() * 10);
                 ctx.lineTo(playerRef.current.x + 10, playerRef.current.y + 20);
                 ctx.fill();
            }

            // Spawn Enemies
            spawnTimerRef.current -= dt;
            if (spawnTimerRef.current <= 0) {
                spawnEnemy();
                let spawnRate = Math.max(0.5, 2.0 - (scoreRef.current / 5000));
                if (difficulty === Difficulty.HARDCORE) spawnRate *= 0.6;
                if (difficulty === Difficulty.ENDLESS) spawnRate = Math.max(0.2, spawnRate * 0.8);
                spawnTimerRef.current = spawnRate;
            }

            // Entity Loop
            for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
                const ent = entitiesRef.current[i];
                ent.x += ent.vx;
                ent.y += ent.vy;

                // Enemy Shooting
                if (ent.type.startsWith('ENEMY')) {
                     if (ent.shootTimer !== undefined) {
                         ent.shootTimer -= dt;
                         if (ent.shootTimer <= 0) {
                             if (ent.type === 'ENEMY_SHOOTER') {
                                 entitiesRef.current.push({
                                     type: 'ENEMY_BULLET',
                                     x: ent.x, y: ent.y + ent.height/2,
                                     width: 6, height: 6,
                                     vx: 0, vy: 5,
                                     color: '#ff00ff', hp: 1
                                 });
                                 ent.shootTimer = 2.0;
                             } else if (ent.type === 'ENEMY_ELITE') {
                                 for(let k=-1; k<=1; k++) {
                                     entitiesRef.current.push({
                                         type: 'ENEMY_BULLET',
                                         x: ent.x, y: ent.y + ent.height/2,
                                         width: 8, height: 8,
                                         vx: k * 2, vy: 4,
                                         color: '#ff0000', hp: 1
                                     });
                                 }
                                 ent.shootTimer = 1.5;
                             }
                         }
                     }
                }

                // Render Entity
                ctx.fillStyle = ent.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = ent.color;
                ctx.fillRect(ent.x - ent.width/2, ent.y - ent.height/2, ent.width, ent.height);
                ctx.shadowBlur = 0;

                // Cleanup Offscreen
                if (ent.y > canvas.height + 50 || ent.y < -100 || ent.x < -50 || ent.x > canvas.width + 50) {
                    if (ent.type === 'PLAYER_BULLET' || ent.type.startsWith('ENEMY')) {
                         entitiesRef.current.splice(i, 1);
                         continue;
                    }
                }
                
                // Collision: Bullet hits Enemy
                if (ent.type === 'PLAYER_BULLET') {
                    for (let j = 0; j < entitiesRef.current.length; j++) {
                        const target = entitiesRef.current[j];
                        if (target.type.startsWith('ENEMY') && !target.type.includes('BULLET')) {
                             if (Math.abs(ent.x - target.x) < (ent.width + target.width)/2 &&
                                 Math.abs(ent.y - target.y) < (ent.height + target.height)/2) {
                                     target.hp -= 1;
                                     ent.hp = 0; 
                                     
                                     // Hit particle
                                     particlesRef.current.push({
                                         x: target.x, y: target.y, width: 2, height: 2,
                                         vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20,
                                         life: 0.3, color: '#fff', type: 'PARTICLE', hp: 0,
                                     });

                                     if (target.hp <= 0) {
                                         // Score
                                         let points = 100;
                                         if (target.type === 'ENEMY_ELITE') points = 500;
                                         if (target.type === 'ENEMY_SHOOTER') points = 200;
                                         scoreRef.current += points;
                                         
                                         // Explosion particles
                                         for(let p=0; p<10; p++) {
                                              particlesRef.current.push({
                                                  x: target.x, y: target.y, width: 4, height: 4,
                                                  vx: (Math.random()-0.5)*50, vy: (Math.random()-0.5)*50,
                                                  life: 0.5 + Math.random()*0.5, color: target.color, type: 'PARTICLE', hp: 0
                                              });
                                         }
                                     }
                                     break;
                                 }
                        }
                    }
                }

                // Collision: Enemy/Bullet hits Player
                if (ent.type.startsWith('ENEMY') || ent.type === 'ENEMY_BULLET') {
                     if (Math.abs(ent.x - playerRef.current.x) < (ent.width + playerRef.current.width)/2 * 0.8 &&
                         Math.abs(ent.y - playerRef.current.y) < (ent.height + playerRef.current.height)/2 * 0.8) {
                             if ((!playerRef.current.invulnerableTimer || playerRef.current.invulnerableTimer <= 0)) {
                                 playerRef.current.hp -= 10;
                                 playerRef.current.invulnerableTimer = 1.0;
                                 
                                 if (ent.type === 'ENEMY_BULLET') ent.hp = 0;
                                 else ent.hp -= 10; 
                                 
                                 if (playerRef.current.hp <= 0) {
                                     isGameOverRef.current = true;
                                     onGameOver(scoreRef.current);
                                 }
                             }
                     }
                }

                if (ent.hp <= 0) {
                    entitiesRef.current.splice(i, 1);
                }
            }

            // Particles
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life = (p.life || 0) - dt;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillRect(p.x, p.y, p.width, p.height);
                ctx.globalAlpha = 1.0;
                if (p.life <= 0) particlesRef.current.splice(i, 1);
            }

            // Draw HUD
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
            ctx.fillRect(0, 0, canvas.width, 40);
            
            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 20px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`SCORE: ${scoreRef.current}`, 10, 28);
            
            // HP Bar
            const hpWidth = 200;
            const hpPercent = Math.max(0, playerRef.current.hp / playerRef.current.maxHp!);
            ctx.fillStyle = '#330000';
            ctx.fillRect(canvas.width - hpWidth - 10, 10, hpWidth, 20);
            ctx.fillStyle = hpPercent > 0.3 ? '#00ff00' : '#ff0000';
            ctx.fillRect(canvas.width - hpWidth - 10, 10, hpWidth * hpPercent, 20);
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(canvas.width - hpWidth - 10, 10, hpWidth, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.fillText('HP', canvas.width - hpWidth - 35, 25);

            requestRef.current = requestAnimationFrame(() => update(performance.now()));
        };

        requestRef.current = requestAnimationFrame(() => update(performance.now()));

        return () => {
            window.removeEventListener('mousemove', handleInput);
            window.removeEventListener('touchmove', handleInput);
            cancelAnimationFrame(requestRef.current);
        };
    }, [difficulty, onGameOver, onGameWin]);

    return (
        <canvas 
            ref={canvasRef} 
            width={window.innerWidth > 600 ? 600 : window.innerWidth} 
            height={window.innerHeight} 
            className="block mx-auto bg-black cursor-none touch-none"
        />
    );
};

export default GameCanvas;
