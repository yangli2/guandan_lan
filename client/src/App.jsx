import React, { useState, useEffect, useMemo } from 'react';
import io from 'socket.io-client';
import * as Icons from 'lucide-react';
import './index.css';

const socket = io();

const RANKS_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const translations = {
  en: {
    title: "GUANDAN 掼蛋",
    subtitle: "Multiplayer Strategy Card Game",
    roomStatus: "Room Status",
    reconnect: "Reconnect",
    roomEmpty: "Room is empty awaiting players.",
    serverConnected: "Server Connected",
    connecting: "Connecting to Server...",
    yourName: "Your Name",
    joinTable: "Join Table",
    joining: "Joining...",
    connectingBtn: "Connecting...",
    reconnectAs: (name) => `Reconnect as ${name}`,
    resetState: "Reset All Server State",
    level: "Level",
    teamLevel: (val) => `Level ${val}`,
    teamInfo: (id, val) => `Team ${id}: Level ${val}`,
    startGame: "Start Game",
    resetTable: "Reset Table",
    tributing: "TRIBUTING...",
    returningTribute: "RETURNING TRIBUTE...",
    gameLog: "Game Log",
    playCards: "Play Cards",
    pass: "Pass",
    returnCard: "Return Selected Card",
    gameOver: "GAME OVER",
    nextRound: "Next Round",
    rank: (val) => `Rank ${val}`,
    cardsCount: (val) => `${val} cards`,
    offline: "Offline",
    acting: "ACTING...",
    you: "(You)",
    playSuccess: "Play successful",
    selectOne: "Select exactly one card to return",
    someonePlay: (name) => `${name}'s Play`,
    wild: "WILD",
    resistance: "RESISTANCE! Tribute cancelled due to 2 Big Jokers."
  },
  cn: {
    title: "掼蛋",
    subtitle: "多人策略扑克游戏",
    roomStatus: "房间状态",
    reconnect: "重新连接",
    roomEmpty: "房间为空，等待玩家...",
    serverConnected: "服务器已连接",
    connecting: "正在连接服务器...",
    yourName: "您的名字",
    joinTable: "加入游戏",
    joining: "正在加入...",
    connectingBtn: "正在连接...",
    reconnectAs: (name) => `以 ${name} 身份重连`,
    resetState: "重置所有服务器状态",
    level: "级别",
    teamLevel: (val) => `级别 ${val}`,
    teamInfo: (id, val) => `队伍 ${id}: 级别 ${val}`,
    startGame: "开始游戏",
    resetTable: "重置牌局",
    tributing: "正在进贡...",
    returningTribute: "正在还贡...",
    gameLog: "游戏日志",
    playCards: "出牌",
    pass: "过牌",
    returnCard: "还贡所选牌",
    gameOver: "游戏结束",
    nextRound: "下一局",
    rank: (val) => `第 ${val} 名`,
    cardsCount: (val) => `${val} 张牌`,
    offline: "离线",
    acting: "执行中...",
    you: "(你)",
    playSuccess: "出牌成功",
    selectOne: "请选择恰好一张牌还贡",
    someonePlay: (name) => `${name} 的出牌`,
    wild: "百搭",
    resistance: "抗贡！由于拥有两张大王，进贡取消"
  }
};

const translateLog = (msg, lang) => {
  if (lang === 'en') return msg;
  return msg
    .replace(/joined the table\./g, "加入了房间。")
    .replace(/Game started!/g, "游戏开始！")
    .replace(/Team (\d) is level (\w+)/g, "队伍 $1 级别为 $2")
    .replace(/Team (\d) double win! Level up 3\./g, "队伍 $1 双红！级别上升 3 级。")
    .replace(/Team (\d) took 1st and 3rd! Level up 2\./g, "队伍 $1 获得第一和第三！级别上升 2 级。")
    .replace(/Team (\d) took 1st and 4th! Level up 1\./g, "队伍 $1 获得第一和第四！级别上升 1 级。")
    .replace(/tributed (.*?) to (.*?)/g, "向 $2 进贡了 $1")
    .replace(/returned a card to (.*?)/g, "向 $1 还贡了")
    .replace(/RESISTANCE! Tribute cancelled due to 2 Big Jokers\./g, "抗贡！由于拥有两张大王，进贡取消。")
    .replace(/finished in (\d)(\w+) place!/g, "获得了第 $1 名！")
    .replace(/Game Over!/g, "游戏结束！")
    .replace(/passed\./g, "过牌。")
    .replace(/played: /g, "打了：")
    .replace(/WINS THE MATCH!/g, "赢得了比赛！")
    .replace(/failed Level A 3 times\. Reset to Level 2\./g, "打 A 失败 3 次，重置为级别 2。")
    .replace(/Rank 1/g, "第一名")
    .replace(/Rank 2/g, "第二名")
    .replace(/Rank 3/g, "第三名")
    .replace(/Rank 4/g, "第四名");
};

function App() {
  const [language, setLanguage] = useState(localStorage.getItem('guandan_lang') || 'en');
  const t = (key, ...args) => {
    const val = translations[language][key];
    return typeof val === 'function' ? val(...args) : val;
  };

  useEffect(() => {
    localStorage.setItem('guandan_lang', language);
  }, [language]);

  const [roomId, setRoomId] = useState('main');
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [hand, setHand] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    console.log("Socket attempt:", socket.io.uri);
    const onConnect = () => {
        console.log("Socket connected!");
        setIsConnected(true);
    };
    const onDisconnect = () => {
        console.log("Socket disconnected");
        setIsConnected(false);
    };
    const onConnectError = (err) => {
        console.error("Socket connect_error:", err.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('game_update', (state) => {
        setGameState(state);
        setRoomInfo(state); // keeps lobby updated if not joined
    });
    socket.on('room_info', (info) => setRoomInfo(info));
    socket.on('join_success', () => { setJoined(true); setIsJoining(false); });
    socket.on('play_success', () => setSelectedCards([]));
    socket.on('private_hand', (h) => setHand(h));
    socket.on('error', (err) => { alert(err); setIsJoining(false); });
    socket.on('force_reload', () => { window.location.reload(); });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game_update');
      socket.off('room_info');
      socket.off('join_success');
      socket.off('play_success');
      socket.off('private_hand');
      socket.off('error');
      socket.off('force_reload');
    };
  }, []);

  useEffect(() => {
    if (isConnected && !joined) {
      socket.emit('get_room_info', roomId);
    }
  }, [roomId, isConnected, joined]);

  // Tribute Logic Helpers
  const isMyTributeTurn = useMemo(() => {
    if (!gameState) return false;
    const myPlayer = gameState.players.find(p => p.socketId === socket.id);
    if (!myPlayer) return false;
    
    if (gameState.state === 'RETURN_TRIBUTE') {
       return gameState.tributeInfo?.returnerId === myPlayer.id;
    }
    return false;
  }, [gameState]);

  // Sorting and Grouping Hand
  const sortedHandGroups = useMemo(() => {
    if (!gameState) return [];
    const level = gameState.currentLevel;

    const getTrumpingValue = (card) => {
      if (card.rank === 'BJ') return 20;
      if (card.rank === 'SJ') return 19;
      if (card.rank === level) return 18;
      
      const rankMap = {
        'A': 17, 'K': 16, 'Q': 15, 'J': 14, '10': 13, '9': 12, '8': 11, '7': 10, '6': 9, '5': 8, '4': 7, '3': 6, '2': 5
      };
      return rankMap[card.rank] || 0;
    };

    const sorted = [...hand].sort((a, b) => getTrumpingValue(a) - getTrumpingValue(b));
    
    const SUITS_ORDER = ['S', 'H', 'C', 'D'];

    // Group by rank for vertical stacking
    const groups = [];
    sorted.forEach((card) => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup[0].card.rank === card.rank) {
            lastGroup.push({ card, index: hand.indexOf(card) });
        } else {
            groups.push([{ card, index: hand.indexOf(card) }]);
        }
    });

    // Sort within each group by suit (S -> H -> C -> D)
    groups.forEach(group => {
        group.sort((a, b) => SUITS_ORDER.indexOf(a.card.suit) - SUITS_ORDER.indexOf(b.card.suit));
    });
    
    return groups;
  }, [hand, gameState]);

  // Seating Positions (Robust)
  const orderedPlayers = useMemo(() => {
    if (!gameState || !gameState.players) return [];
    
    // Find my index, if not found (drop/observer), default to 0 for stable layout
    let myIdx = gameState.players.findIndex(p => p.socketId === socket.id);
    const baseIdx = myIdx === -1 ? 0 : myIdx;
    
    const positions = ['bottom', 'right', 'top', 'left'];
    return positions.map((pos, i) => {
        const player = gameState.players[(baseIdx + i) % 4];
        if (!player) return null;
        let isActive = false;
        if (gameState.state === 'PLAYING') {
            isActive = gameState.turn === (baseIdx + i) % 4;
        } else if (gameState.state === 'RETURN_TRIBUTE') {
            isActive = gameState.tributeInfo?.returnerId === player.id;
        }
        return { ...player, position: pos, isActive };
    }).filter(Boolean);
  }, [gameState, isConnected]);

  const toggleCard = (idx) => {
    setSelectedCards(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const playCards = () => {
    socket.emit('play_cards', { roomId, cardIndices: selectedCards });
  };

  const returnTribute = () => {
    if (selectedCards.length !== 1) return alert(language === 'cn' ? translations.cn.selectOne : translations.en.selectOne);
    socket.emit('return_tribute', { roomId, cardIndex: selectedCards[0] });
    setSelectedCards([]);
  };

  if (!joined) {
    return (
      <div className="lobby-container">
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 2000 }}>
          <button className="btn-secondary" onClick={() => setLanguage(language === 'en' ? 'cn' : 'en')} style={{ padding: '8px 15px', backdropFilter: 'blur(5px)' }}>
            {language === 'en' ? '中文' : 'English'}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', minWidth: '350px' }}>
          <h1 style={{ color: '#1a1a1a' }}>{t('title')}</h1>
          <p style={{ color: '#444' }}>{t('subtitle')}</p>
          
          <div style={{ marginBottom: '20px', textAlign: 'left', padding: '15px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--accent)' }}>{t('roomStatus')} ({roomInfo?.players?.length || 0}/4)</h3>
            {roomInfo && roomInfo.players && roomInfo.players.length > 0 ? (
                roomInfo.players.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', color: '#1a1a1a' }}>
                        <span>{p.name} <span style={{ fontSize: '12px', opacity: 0.7 }}>{p.connected ? `(${t('serverConnected')})` : `(${t('offline')})`}</span></span>
                        {!p.connected && (
                            <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }} onClick={() => socket.emit('reconnect_player', { roomId, playerId: p.id })}>{t('reconnect')}</button>
                        )}
                    </div>
                ))
            ) : (
                <div style={{ opacity: 0.7, fontSize: '14px', color: '#1a1a1a' }}>{t('roomEmpty')}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
            <div id="connection-status" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', opacity: 0.8, color: '#1a1a1a' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#4ade80' : '#f87171', boxShadow: isConnected ? '0 0 10px #4ade80' : 'none' }}></div>
                {isConnected ? t('serverConnected') : t('connecting')}
            </div>
            
            <input 
                type="text" 
                placeholder={t('yourName')} 
                value={playerName} 
                onChange={e => setPlayerName(e.target.value)} 
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '240px', fontSize: '16px', color: '#1a1a1a' }}
                disabled={isJoining || !isConnected}
            />

            {(() => {
                const match = roomInfo?.players?.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase() && !p.connected);
                if (match) {
                    return (
                        <button 
                            className="btn-primary" 
                            style={{ width: '264px', justifyContent: 'center' }} 
                            onClick={() => { setIsJoining(true); socket.emit('reconnect_player', { roomId, playerId: match.id }); }}
                            disabled={isJoining || !isConnected}
                        >
                            {isJoining ? t('joining') : t('reconnectAs', match.name)}
                        </button>
                    );
                }
                return (
                    <button 
                        className="btn-primary" 
                        style={{ width: '264px', justifyContent: 'center', opacity: !isConnected ? 0.5 : 1 }} 
                        onClick={() => { 
                            if (!playerName) return alert(language === 'cn' ? '请输入名字' : 'Enter name'); 
                            setIsJoining(true); 
                            socket.emit('join_room', { roomId, playerName }); 
                        }}
                        disabled={isJoining || !isConnected}
                    >
                        {isJoining ? t('joining') : t('joinTable')}
                    </button>
                );
            })()}

            <button className="btn-secondary reset-btn" onClick={() => socket.emit('reset_room', roomId)}>
                <Icons.Trash2 size={16}/> {t('resetState')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {!isConnected && (
        <div className="glass-panel" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, padding: '20px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
          <Icons.RefreshCw className="animate-spin" /> Connecting to server...
        </div>
      )}

      {/* HUD */}
      <div className="glass-panel" style={{ padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'white' }}>{t('title')}</h2>
            <div className="glass-panel" style={{ padding: '4px 12px', borderRadius: '8px', color: 'white' }}>{t('level')} <strong>{gameState?.currentLevel}</strong></div>
            <div style={{ fontSize: '12px', opacity: 0.8, color: 'white' }}>
                {t('teamInfo', 0, gameState?.teamLevels[0])} | {t('teamInfo', 1, gameState?.teamLevels[1])}
            </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={() => setLanguage(language === 'en' ? 'cn' : 'en')} style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
            {language === 'en' ? '中文' : 'English'}
          </button>
          {gameState?.state === 'LOBBY' && gameState.players.length === 4 && (
            <button className="btn-primary" onClick={() => socket.emit('start_game', roomId)}><Icons.Play size={18}/> {t('startGame')}</button>
          )}
          <button className="btn-secondary reset-btn" style={{ marginTop: 0 }} onClick={() => socket.emit('reset_room', roomId)}>
             <Icons.RotateCcw size={16}/> {t('resetTable')}
          </button>
        </div>
      </div>

      <div className="table-area">
        {/* Turn Indicator */}
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
            {gameState?.state === 'TRIBUTE' && <div className="turn-indicator">{t('tributing')}</div>}
            {gameState?.state === 'RETURN_TRIBUTE' && <div className="turn-indicator">{t('returningTribute')}</div>}
        </div>

        {/* Game Log */}
        <div id="game-log" style={{position: 'absolute', top: '10px', right: '10px', width: '250px', background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '10px', fontSize: '11px', maxHeight: '150px', overflowY: 'auto', zIndex: 50, color: 'white'}}>
           <div style={{fontWeight: 'bold', marginBottom: '5px', color: 'var(--accent)'}}>{t('gameLog')}</div>
           <div className="log-entries">
               {[...(gameState?.log || [])].reverse().map((msg, i) => <div key={i} style={{opacity: 0.8, marginBottom: '2px'}}>{translateLog(msg, language)}</div>)}
           </div>
        </div>

        {/* Relative Players */}
        {orderedPlayers.map(p => {
            const Icon = Icons[p.icon] || Icons.User;
            const isMe = p.socketId === socket.id;
            return (
                <div key={p.id} className={`player-box ${p.position} ${p.isActive ? 'active' : ''}`} style={{ opacity: p.connected ? 1 : 0.5 }}>
                    <div className="avatar-icon" style={{ color: 'white' }}><Icon size={32}/></div>
                    <div style={{ fontWeight: 800, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                      {p.name} {isMe ? t('you') : ''}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#4ade80' }}>
                        {p.winRank ? t('rank', p.winRank) : (p.connected ? t('cardsCount', p.cardCount) : t('offline'))}
                    </div>
                    {p.isActive && <div className="turn-indicator" style={{ position: 'static', fontSize: '12px', padding: '4px 8px', marginTop: '5px' }}>{t('acting')}</div>}
                </div>
            )
        })}

        {/* Played Cards Area */}
        {gameState?.lastPlay && (
          <div className="last-play-area">
            <div className="last-play-indicator">
              <div className="last-play-label">
                {t('someonePlay', gameState.players.find(p => p.id === gameState.lastPlay.playerId)?.name || 'Someone')}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {gameState.lastPlay.cards.map((c, i) => <Card key={i} card={c} small currentLevel={gameState.currentLevel} t={t} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* My Hand (Stacked) */}
      <div className="player-hand">
        {sortedHandGroups.map((group, gIdx) => (
          <div key={gIdx} className="card-stack">
            {group.map(({card, index}) => (
              <Card 
                key={index} 
                card={card} 
                selected={selectedCards.includes(index)} 
                onClick={() => toggleCard(index)}
                currentLevel={gameState?.currentLevel}
                t={t}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Actions - Repositioned to Bottom Right */}
      <div style={{ position: 'fixed', bottom: '40px', right: '40px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 1000 }}>
        {gameState?.turn !== undefined && gameState.players[gameState.turn]?.socketId === socket.id && gameState.state === 'PLAYING' && (
            <>
                <button className="btn-primary" style={{ padding: '20px 40px', fontSize: '20px' }} onClick={playCards}><Icons.Send size={24}/> {t('playCards')}</button>
                <button className="btn-secondary" style={{ padding: '15px', fontSize: '18px' }} onClick={() => { socket.emit('play_cards', { roomId, cardIndices: [] }); setSelectedCards([]); }}>{t('pass')}</button>
            </>
        )}
        
        {isMyTributeTurn && (
            <button className="btn-primary" style={{ padding: '20px 40px', fontSize: '20px', background: '#3b82f6' }} onClick={returnTribute}>
                <Icons.Repeat size={24}/> {t('returnCard')}
            </button>
        )}
      </div>

      {/* Finished State Overlay */}
      {gameState?.state === 'FINISHED' && (
        <div className="finished-overlay glass-panel" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10000, padding: '40px', background: 'rgba(255,255,255,0.95)', textAlign: 'center', minWidth: '400px', border: '5px solid var(--accent)' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '20px', fontSize: '48px' }}>{t('gameOver')}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gameState.winners.map((wid, idx) => {
                const p = gameState.players.find(p => p.id === wid);
                return (
                    <div key={wid} style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', display: 'flex', justifyContent: 'space-between', padding: '10px', background: idx === 0 ? '#fef3c7' : 'transparent', borderRadius: '8px' }}>
                        <span>{t('rank', idx + 1)}</span>
                        <span>{p?.name}</span>
                    </div>
                );
              })}
          </div>
          <button className="btn-primary" style={{ margin: '30px auto 0', padding: '15px 40px' }} onClick={() => socket.emit('start_game', roomId)}>{t('nextRound')}</button>
        </div>
      )}
    </div>
  );
}

function Card({ card, selected, onClick, small, currentLevel, t }) {
  const isRed = ['H', 'D'].includes(card.suit);
  const isJoker = card.rank === 'BJ' || card.rank === 'SJ';
  const colorClass = card.rank === 'BJ' ? 'red' : card.rank === 'SJ' ? 'gray' : isRed ? 'red' : 'black';
  
  const getSuitSymbol = (suit) => {
    switch (suit) {
      case 'H': return '♥';
      case 'D': return '♦';
      case 'C': return '♣';
      case 'S': return '♠';
      default: return '';
    }
  };

  const CenterIcon = card.rank === 'BJ' ? Icons.Crown : card.rank === 'SJ' ? Icons.Ghost : null;

  return (
    <div 
      className={`card ${colorClass} ${selected ? 'selected' : ''}`} 
      onClick={onClick}
      style={small ? { width: '70px', height: '100px', pointerEvents: 'none' } : {}}
    >
      <div className="card-top-left">
        <div className="rank" style={small ? { fontSize: '14px' } : {}}>{card.rank}</div>
        {!isJoker && <div className="suit-small" style={small ? { fontSize: '10px' } : {}}>{getSuitSymbol(card.suit)}</div>}
      </div>
      
      <div className="card-center">
        {CenterIcon ? <CenterIcon /> : <span style={{ fontSize: '40px' }}>{getSuitSymbol(card.suit)}</span>}
      </div>

      {card.suit === 'H' && card.rank === currentLevel && (
          <div style={{ position: 'absolute', bottom: '5px', right: '5px', fontSize: '10px', color: 'gold' }}>{t('wild')}</div>
      )}
    </div>
  );
}

export default App;
