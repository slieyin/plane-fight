import React, { useState } from 'react';
import { GameState, Difficulty, MissionBriefing } from './types';
import { generateMissionBriefing } from './services/geminiService';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [briefing, setBriefing] = useState<MissionBriefing | null>(null);
  const [score, setScore] = useState(0);

  const startGameSequence = async (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    setGameState(GameState.LOADING_BRIEFING);
    
    // Fetch AI Briefing
    const data = await generateMissionBriefing(selectedDifficulty);
    setBriefing(data);
    setGameState(GameState.BRIEFING);
  };

  const launchGame = () => {
    setScore(0);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setGameState(GameState.GAME_OVER);
  };

  const goToMenu = () => {
    setGameState(GameState.MENU);
  };

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden font-mono select-none">
      <div className="scanline" />
      
      {/* BACKGROUND DECORATION */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
           <div className="w-96 h-96 bg-cyan-500 rounded-full blur-[100px] animate-pulse"></div>
        </div>
      )}

      {/* --- MENU STATE --- */}
      {gameState === GameState.MENU && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-8 p-6">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 tracking-tighter drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] text-center">
            霓虹<br/>空战
          </h1>
          
          <div className="flex flex-col space-y-4 w-full max-w-xs">
            <p className="text-cyan-200 text-center text-sm mb-2 opacity-70">选择任务难度</p>
            
            <button 
              onClick={() => startGameSequence(Difficulty.EASY)}
              className="w-full py-4 bg-gray-900 border-2 border-green-500 text-green-400 font-bold text-xl hover:bg-green-900/20 active:scale-95 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] uppercase rounded-lg"
            >
              简单
            </button>
            <button 
              onClick={() => startGameSequence(Difficulty.NORMAL)}
              className="w-full py-4 bg-gray-900 border-2 border-cyan-500 text-cyan-400 font-bold text-xl hover:bg-cyan-900/20 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] uppercase rounded-lg"
            >
              普通
            </button>
            <button 
              onClick={() => startGameSequence(Difficulty.HARDCORE)}
              className="w-full py-4 bg-gray-900 border-2 border-red-500 text-red-500 font-bold text-xl hover:bg-red-900/20 active:scale-95 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] uppercase rounded-lg"
            >
              困难
            </button>
          </div>
        </div>
      )}

      {/* --- LOADING BRIEFING --- */}
      {gameState === GameState.LOADING_BRIEFING && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-cyan-400">
           <div className="w-16 h-16 border-4 border-t-cyan-400 border-r-transparent border-b-cyan-400 border-l-transparent rounded-full animate-spin mb-6"></div>
           <p className="animate-pulse tracking-widest uppercase">正在解密任务指令...</p>
           <p className="text-xs text-cyan-700 mt-2">正在连接指挥链路</p>
        </div>
      )}

      {/* --- BRIEFING DISPLAY --- */}
      {gameState === GameState.BRIEFING && briefing && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 max-w-lg mx-auto">
          <div className="w-full bg-gray-900/90 border border-cyan-500/50 p-6 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6 border-b border-cyan-500/30 pb-4">
              <h2 className="text-2xl font-bold text-cyan-400 uppercase">{briefing.title}</h2>
              <span className="text-xs text-yellow-500 border border-yellow-500 px-2 py-1 rounded">
                {difficulty === Difficulty.EASY ? '简单' : difficulty === Difficulty.NORMAL ? '普通' : '困难'}
              </span>
            </div>
            
            <div className="mb-8">
              <p className="text-lg text-gray-200 leading-relaxed font-light">
                "{briefing.message}"
              </p>
            </div>

            <button 
              onClick={launchGame}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xl tracking-widest hover:from-cyan-500 hover:to-blue-500 active:scale-95 transition-all shadow-lg rounded"
            >
              开始任务
            </button>
          </div>
        </div>
      )}

      {/* --- GAME LOOP --- */}
      {gameState === GameState.PLAYING && (
        <GameCanvas difficulty={difficulty} onGameOver={handleGameOver} />
      )}

      {/* --- GAME OVER --- */}
      {gameState === GameState.GAME_OVER && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
          <h2 className="text-6xl font-black text-red-600 mb-2 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)] tracking-tighter">
            任务失败
          </h2>
          <div className="text-center mb-12">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">最终得分</p>
            <p className="text-5xl font-mono text-white">{score}</p>
          </div>

          <div className="flex flex-col space-y-4 w-full max-w-xs">
            <button 
              onClick={launchGame}
              className="w-full py-3 bg-white text-black font-bold text-lg hover:bg-gray-200 active:scale-95 transition-all rounded"
            >
              重试任务
            </button>
            <button 
              onClick={goToMenu}
              className="w-full py-3 border border-white/20 text-gray-300 font-bold text-lg hover:bg-white/10 active:scale-95 transition-all rounded"
            >
              返回主菜单
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;