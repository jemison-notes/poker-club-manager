// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, collection, query, addDoc, getDocs 
} from 'firebase/firestore';
import { 
  Clock, Users, Trophy, DollarSign, Settings, Plus, Play, Pause, 
  SkipForward, Download, X, Edit2, Trash2, CheckCircle, AlertCircle,
  Menu, ChevronRight, Lock, LogOut
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
// Substitua os valores abaixo com os dados do SEU projeto Firebase!
const firebaseConfig = {
  apiKey: "AIzaSyCfC9eSmqTHsQPZ1yaoAlwwE34qb11mlLQ",
  authDomain: "poker-mananger-club.firebaseapp.com",
  projectId: "poker-mananger-club",
  storageBucket: "poker-mananger-club.firebasestorage.app",
  messagingSenderId: "313023322968",
  appId: "1:313023322968:web:407089e67d4bb7db3ce32d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'meu-clube-de-poker-app'; // Pode deixar esse nome ou mudar para o do seu clube

// --- UTILS ---
const generateId = () => Math.random().toString(36).substring(2, 15);
const formatMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value || 0);

// --- DEFAULT BLIND STRUCTURE ---
const DEFAULT_BLINDS = [
  { level: 1, sb: 100, bb: 100, ante: 0, duration: 20, isBreak: false },
  { level: 2, sb: 100, bb: 200, ante: 200, duration: 20, isBreak: false },
  { level: 3, sb: 200, bb: 400, ante: 400, duration: 20, isBreak: false },
  { level: 4, sb: 300, bb: 600, ante: 600, duration: 20, isBreak: false },
  { level: '', title: "Break / Fim do Late", isBreak: true, duration: 15 },
  { level: 5, sb: 500, bb: 1000, ante: 1000, duration: 20, isBreak: false },
];

const DEFAULT_ACTIONS = [
  { id: 'a1', name: 'Buy-in', chips: 15000, price: 100, isTimeChip: false },
  { id: 'a2', name: 'Re-buy', chips: 15000, price: 100, isTimeChip: false },
  { id: 'a3', name: 'Add-on', chips: 30000, price: 100, isTimeChip: false },
  { id: 'a4', name: 'Time Chip', chips: 3000, price: 0, isTimeChip: true, maxLevel: 1 },
  { id: 'a5', name: 'Lista', chips: 2000, price: 0, isTimeChip: true, maxLevel: 1 }
];

// --- MAIN COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clock');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  // Data States
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [entries, setEntries] = useState([]); // Entries for the currently active tournament view
  const [activeTournamentId, setActiveTournamentId] = useState(null);

  // Global Modals/Alerts
  const [modal, setModal] = useState({ show: false, content: null, title: '' });

  // 1. AUTHENTICATION
  useEffect(() => {
    if (!auth) return;
    
    // Ouve as mudanças de login de forma segura e direta no Firebase
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Libera o ecrã de carregamento assim que o Firebase responde
    });

    return () => unsubscribe();
  }, []);

  // 2. DATA FETCHING (Players & Tournaments)
  useEffect(() => {
    if (!user || !db) return;
    
    // Listen to Players
    const qPlayers = query(collection(db, 'artifacts', appId, 'users', user.uid, 'players'));
    const unsubPlayers = onSnapshot(qPlayers, (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error);

    // Listen to Tournaments
    const qTournaments = query(collection(db, 'artifacts', appId, 'users', user.uid, 'tournaments'));
    const unsubTournaments = onSnapshot(qTournaments, (snap) => {
      setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error);

    return () => { unsubPlayers(); unsubTournaments(); };
  }, [user]);

  // 3. FETCH ENTRIES FOR ACTIVE TOURNAMENT
  useEffect(() => {
    if (!user || !db || !activeTournamentId) {
      setEntries([]);
      return;
    }
    const qEntries = query(collection(db, 'artifacts', appId, 'users', user.uid, `tournaments/${activeTournamentId}/entries`));
    const unsubEntries = onSnapshot(qEntries, (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, console.error);
    
    return () => unsubEntries();
  }, [user, activeTournamentId]);

  // Set active tournament automatically if none selected but one exists
  useEffect(() => {
    if (!activeTournamentId && tournaments.length > 0) {
      // Prefer running tournament, otherwise newest
      const running = tournaments.find(t => t.status === 'Running');
      if (running) setActiveTournamentId(running.id);
      else setActiveTournamentId(tournaments[0].id);
    }
  }, [tournaments, activeTournamentId]);

  const activeTournament = tournaments.find(t => t.id === activeTournamentId) || null;

  const openModal = (title, content) => setModal({ show: true, title, content });
  const closeModal = () => setModal({ show: false, content: null, title: '' });

  const handleSignOut = async () => {
    await signOut(auth);
    window.location.reload();
  };

  // 1. Se o Firebase ainda estiver a carregar, mostra o ecrã de carregamento
  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Autenticando...</div>;

  // 2. Se terminou de carregar e ninguém estiver logado, mostra o ecrã de Login
  if (!user) return <AuthScreen auth={auth} />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex overflow-hidden">
      {/* SIDEBAR */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-zinc-900 border-r border-zinc-800 flex flex-col z-20 shrink-0`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
          {isSidebarOpen && <span className="font-bold text-xl text-amber-500 tracking-wider">POKER PRO</span>}
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
            <Menu size={20} />
          </button>
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-2 px-2 overflow-y-auto">
          <NavItem icon={<Clock />} label="Relógio" active={activeTab === 'clock'} onClick={() => setActiveTab('clock')} isOpen={isSidebarOpen} />
          <NavItem icon={<Play />} label="Controle" active={activeTab === 'control'} onClick={() => setActiveTab('control')} isOpen={isSidebarOpen} />
          <NavItem icon={<Users />} label="Jogadores" active={activeTab === 'players'} onClick={() => setActiveTab('players')} isOpen={isSidebarOpen} />
          <NavItem icon={<Settings />} label="Torneios" active={activeTab === 'tournaments'} onClick={() => setActiveTab('tournaments')} isOpen={isSidebarOpen} />
          <NavItem icon={<Trophy />} label="Ranking" active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')} isOpen={isSidebarOpen} />
          <NavItem icon={<DollarSign />} label="Financeiro" active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} isOpen={isSidebarOpen} />
        </nav>
        
        {/* LOGOUT BUTTON */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 w-full text-zinc-400 hover:bg-zinc-800 hover:text-red-400">
            <div className="shrink-0"><LogOut size={20} /></div>
            {isSidebarOpen && <span className="whitespace-nowrap font-medium">Sair da Conta</span>}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 to-zinc-950">
        {/* Header selector for active tournament */}
        <header className="h-16 border-b border-zinc-800/50 flex items-center px-6 justify-between shrink-0 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">Torneio Ativo:</span>
            <select 
              value={activeTournamentId || ''} 
              onChange={(e) => setActiveTournamentId(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">Selecione um Torneio</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
              ))}
            </select>
          </div>
          {activeTournament && (
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700">
              <span className={`w-2 h-2 rounded-full ${activeTournament.status === 'Running' ? 'bg-green-500 animate-pulse' : activeTournament.status === 'Finished' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
              {activeTournament.status}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'clock' && <ClockView tournament={activeTournament} entries={entries} user={user} db={db} appId={appId} />}
          {activeTab === 'control' && <ControlView tournament={activeTournament} entries={entries} players={players} user={user} db={db} appId={appId} openModal={openModal} closeModal={closeModal} />}
          {activeTab === 'players' && <PlayersView players={players} user={user} db={db} appId={appId} />}
          {activeTab === 'tournaments' && <TournamentsView tournaments={tournaments} user={user} db={db} appId={appId} openModal={openModal} closeModal={closeModal} />}
          {activeTab === 'ranking' && <RankingView tournaments={tournaments} user={user} db={db} appId={appId} />}
          {activeTab === 'finance' && <FinanceView tournament={activeTournament} entries={entries} />}
        </div>
      </main>

      {/* GLOBAL MODAL */}
      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 shrink-0">
              <h2 className="text-xl font-bold text-zinc-100">{modal.title}</h2>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {modal.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, isOpen }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 w-full
        ${active ? 'bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
      `}
    >
      <div className="shrink-0">{icon}</div>
      {isOpen && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

// --- TAB VIEWS ---

// 1. CLOCK VIEW
function ClockView({ tournament, entries, user, db, appId }) {
  const [now, setNow] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const clockContainerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250); // High frequency for smooth updates
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!tournament) return;
    
    // Logic to calculate remaining time locally
    if (tournament.clockState?.isRunning && tournament.clockState?.endTime) {
      const remaining = Math.max(0, Math.floor((tournament.clockState.endTime - now) / 1000));
      setTimeRemaining(remaining);
      
      // Auto-stop if time is up (handled properly by control panel usually, but safety here)
      if (remaining === 0) {
        // Just keep it at 0
      }
    } else {
      setTimeRemaining(tournament.clockState?.savedTimeLeft || 0);
    }
  }, [tournament, now]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      clockContainerRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  if (!tournament) return <EmptyState icon={<Clock size={48} />} title="Nenhum torneio ativo" subtitle="Selecione ou crie um torneio para usar o relógio." />;

  const lvlIdx = tournament.currentLevelIndex || 0;
  const currentLevel = tournament.blinds?.[lvlIdx] || { title: "Fim", isBreak: true };
  const nextLevel = tournament.blinds?.[lvlIdx + 1];

  // Stats Calculations
  const stats = useMemo(() => {
    let totalChips = 0;
    let totalEntries = 0; // count of financial buy-ins/re-buys
    let activePlayersCount = 0;

    entries.forEach(e => {
      totalChips += (e.totalChips || 0);
      
      // Calculate valid entries (buy-ins + re-entries). Let's say all non-time-chips count as entries for field size.
      let pEntries = 0;
      Object.keys(e.actions || {}).forEach(k => {
        const actionDef = tournament.actions.find(a => a.id === k);
        if (actionDef && !actionDef.isTimeChip) pEntries += e.actions[k];
      });
      totalEntries += pEntries;

      if (!e.isEliminated) activePlayersCount++;
    });

    const avgStack = activePlayersCount > 0 ? Math.floor(totalChips / activePlayersCount) : 0;

    // Find next break
    let nextBreak = null;
    for (let i = lvlIdx + 1; i < tournament.blinds?.length; i++) {
      if (tournament.blinds[i].isBreak) {
        nextBreak = tournament.blinds[i];
        break;
      }
    }

    return { totalChips, totalEntries, activePlayersCount, avgStack, nextBreak };
  }, [entries, tournament, lvlIdx]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div ref={clockContainerRef} className="h-full flex flex-col bg-zinc-950 text-white p-4 relative rounded-2xl shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
      <button onClick={toggleFullScreen} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10 bg-zinc-900/50 p-2 rounded">
        {isFullScreen ? 'Sair Tela Cheia' : 'Tela Cheia'}
      </button>

      {/* TOP BAR: Info */}
      <div className="flex justify-between items-start pt-2 px-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-amber-500 tracking-wider uppercase drop-shadow-lg">{tournament.name}</h1>
          <p className="text-zinc-400 text-xl font-medium mt-1">{tournament.type}</p>
        </div>
        <div className="text-right">
          <p className="text-zinc-400 text-xl uppercase font-bold tracking-widest">{currentLevel.isBreak ? 'Intervalo' : `Nível ${currentLevel.level}`}</p>
          <p className="text-2xl text-white font-medium">{currentLevel.isBreak ? currentLevel.title || 'PAUSA' : currentLevel.title || 'JOGO'}</p>
        </div>
      </div>

      {/* CENTER: Blinds & Clock */}
      <div className="flex-1 flex flex-col items-center justify-center my-8">
        {currentLevel.isBreak ? (
          <div className="text-[10vw] md:text-[150px] font-black leading-none text-amber-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.5)] uppercase">
            BREAK
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-zinc-400 text-2xl md:text-4xl font-bold tracking-widest uppercase mb-2">Blinds</div>
            <div className="text-[12vw] md:text-[180px] font-black leading-none tracking-tighter drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              {formatNumber(currentLevel.sb)} / {formatNumber(currentLevel.bb)}
            </div>
            {currentLevel.ante > 0 && (
              <div className="text-4xl md:text-6xl font-bold text-amber-500 mt-4 tracking-wider">
                ANTE: {formatNumber(currentLevel.ante)}
              </div>
            )}
          </div>
        )}

        <div className={`text-[15vw] md:text-[220px] font-black leading-none font-mono mt-8 drop-shadow-[0_0_50px_rgba(0,0,0,1)]
          ${timeRemaining <= 60 && tournament.clockState?.isRunning ? 'text-red-500 animate-pulse' : 'text-zinc-100'}
        `}>
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* BOTTOM BAR: Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8 pb-4">
        <StatBox label="Entradas" value={stats.totalEntries} />
        <StatBox label="Jogadores" value={`${stats.activePlayersCount} / ${entries.length}`} />
        <StatBox label="Stack Médio" value={formatNumber(stats.avgStack)} />
        <StatBox label="Próximo Level" value={nextLevel ? (nextLevel.isBreak ? 'Break' : `${formatNumber(nextLevel.sb)}/${formatNumber(nextLevel.bb)}`) : 'Fim'} />
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center backdrop-blur-sm">
      <span className="text-zinc-500 text-sm md:text-lg uppercase font-bold tracking-wider">{label}</span>
      <span className="text-2xl md:text-4xl font-bold text-zinc-100 mt-1">{value}</span>
    </div>
  );
}

// 2. CONTROL VIEW (Tournament Manager)
function ControlView({ tournament, entries, players, user, db, appId, openModal, closeModal }) {
  if (!tournament) return <EmptyState icon={<Play size={48} />} title="Controle do Torneio" subtitle="Selecione um torneio ativo no topo da tela." />;

  const lvlIdx = tournament.currentLevelIndex || 0;
  const isRunning = tournament.clockState?.isRunning || false;

  const toggleClock = async () => {
    try {
      const tRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tournaments', tournament.id);
      if (isRunning) {
        // PAUSE: Calculate how much time was left
        const remaining = Math.max(0, Math.floor((tournament.clockState.endTime - Date.now()) / 1000));
        await updateDoc(tRef, {
          'clockState.isRunning': false,
          'clockState.savedTimeLeft': remaining
        });
      } else {
        // START/RESUME
        const savedTime = tournament.clockState?.savedTimeLeft ?? (tournament.blinds[lvlIdx]?.duration * 60);
        await updateDoc(tRef, {
          'clockState.isRunning': true,
          'clockState.endTime': Date.now() + (savedTime * 1000),
          status: 'Running'
        });
      }
    } catch (e) { console.error("Error toggling clock", e); }
  };

  const changeLevel = async (direction) => {
    let newIdx = lvlIdx + direction;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= tournament.blinds.length) newIdx = tournament.blinds.length - 1;
    
    try {
      const tRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tournaments', tournament.id);
      const newDuration = tournament.blinds[newIdx].duration * 60;
      await updateDoc(tRef, {
        currentLevelIndex: newIdx,
        'clockState.isRunning': false,
        'clockState.savedTimeLeft': newDuration
      });
    } catch (e) { console.error(e); }
  };

  const showRegisterModal = () => {
    openModal("Registrar Jogador", <RegisterPlayerForm 
      players={players} 
      tournament={tournament} 
      entries={entries}
      onSave={async (playerId) => {
        try {
          const entryRef = collection(db, 'artifacts', appId, 'users', user.uid, `tournaments/${tournament.id}/entries`);
          await addDoc(entryRef, {
            playerId,
            actions: {},
            totalSpent: 0,
            totalChips: 0,
            isEliminated: false,
            registeredAt: Date.now()
          });
          closeModal();
        } catch (e) { console.error(e); }
      }} 
    />);
  };

  const handleAction = async (entryId, actionDef, isAdding) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    // RULE CHECK: Time Chip / Max Level
    if (actionDef.isTimeChip && isAdding) {
      const currentLvlNum = tournament.blinds[lvlIdx].level || 0;
      if (currentLvlNum > actionDef.maxLevel) {
         openModal("Ação Não Permitida", <div className="text-red-400 p-4">{actionDef.name} só permitida até o nível {actionDef.maxLevel}. Nível atual: {currentLvlNum}</div>);
         return;
      }
    }

    const currentQty = entry.actions[actionDef.id] || 0;
    const newQty = isAdding ? currentQty + 1 : Math.max(0, currentQty - 1);
    
    // Recalculate totals
    let newTotalSpent = 0;
    let newTotalChips = 0;
    const newActions = { ...entry.actions, [actionDef.id]: newQty };
    
    Object.keys(newActions).forEach(k => {
      const aDef = tournament.actions.find(a => a.id === k);
      if (aDef) {
        newTotalSpent += newActions[k] * Number(aDef.price || 0);
        newTotalChips += newActions[k] * Number(aDef.chips || 0);
      }
    });

    try {
      const eRef = doc(db, 'artifacts', appId, 'users', user.uid, `tournaments/${tournament.id}/entries`, entryId);
      await updateDoc(eRef, { actions: newActions, totalSpent: newTotalSpent, totalChips: newTotalChips });
    } catch (e) { console.error(e); }
  };

  const eliminatePlayer = async (entryId) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    
    const activeCount = entries.filter(e => !e.isEliminated).length;
    const finalPosition = activeCount; // e.g., if 10 left and 1 busts, he is 10th.

    try {
      const eRef = doc(db, 'artifacts', appId, 'users', user.uid, `tournaments/${tournament.id}/entries`, entryId);
      await updateDoc(eRef, { 
        isEliminated: !entry.isEliminated,
        finalPosition: !entry.isEliminated ? finalPosition : null,
        eliminatedAt: !entry.isEliminated ? Date.now() : null
      });
    } catch (e) { console.error(e); }
  };

  const getPlayerName = (pId) => players.find(p => p.id === pId)?.name || 'Desconhecido';

  const openEditTournament = () => {
    openModal(
      "Editar Estrutura em Tempo Real", 
      <EditTournamentModal tournament={tournament} entries={entries} db={db} user={user} appId={appId} closeModal={closeModal} />
    );
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Clock Controls Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between shadow-lg gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-bold text-amber-500">
            {tournament.blinds[lvlIdx]?.isBreak ? 'BRK' : `L${tournament.blinds[lvlIdx]?.level || '-'}`}
          </div>
          <div>
            <h2 className="text-xl font-bold">{tournament.blinds[lvlIdx]?.title || 'Blind Level'}</h2>
            <p className="text-zinc-400">
              {tournament.blinds[lvlIdx]?.isBreak ? 'Intervalo' : `${tournament.blinds[lvlIdx]?.sb} / ${tournament.blinds[lvlIdx]?.bb}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={openEditTournament} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-300 mr-2 border border-zinc-700" title="Editar Estrutura e Premiação">
            <Edit2 size={20} />
          </button>
          <button onClick={() => changeLevel(-1)} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            <SkipForward size={20} className="rotate-180 text-zinc-300" />
          </button>
          <button onClick={toggleClock} className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
            isRunning ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 hover:bg-amber-500/30' : 'bg-green-600 text-white hover:bg-green-500'
          }`}>
            {isRunning ? <><Pause size={20} /> Pausar Relógio</> : <><Play size={20} /> Iniciar Relógio</>}
          </button>
          <button onClick={() => changeLevel(1)} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            <SkipForward size={20} className="text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Players List in Tournament */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/30">
          <h3 className="font-bold text-lg">Jogadores Registrados ({entries.length})</h3>
          <button onClick={showRegisterModal} className="flex items-center gap-2 bg-amber-500 text-zinc-950 px-4 py-2 rounded-lg font-bold hover:bg-amber-400 transition-colors">
            <Plus size={18} /> Registrar Jogador
          </button>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-950/50 text-zinc-400 text-sm sticky top-0 z-10">
              <tr>
                <th className="p-4 font-medium border-b border-zinc-800">Jogador</th>
                <th className="p-4 font-medium border-b border-zinc-800">Status</th>
                {tournament.actions.map(a => (
                  <th key={a.id} className="p-4 font-medium border-b border-zinc-800 text-center">{a.name}</th>
                ))}
                <th className="p-4 font-medium border-b border-zinc-800 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${entry.isEliminated ? 'opacity-50 grayscale' : ''}`}>
                  <td className="p-4 font-medium">{getPlayerName(entry.playerId)}</td>
                  <td className="p-4">
                    {entry.isEliminated ? (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full border border-red-500/20">Eliminado ({entry.finalPosition}º)</span>
                    ) : (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/20">Ativo</span>
                    )}
                  </td>
                  
                  {tournament.actions.map(action => (
                    <td key={action.id} className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleAction(entry.id, action, false)} 
                          disabled={entry.isEliminated}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30"
                        >-</button>
                        <span className="w-4 font-bold">{entry.actions[action.id] || 0}</span>
                        <button 
                          onClick={() => handleAction(entry.id, action, true)} 
                          disabled={entry.isEliminated}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-amber-500 hover:bg-zinc-700 disabled:opacity-30"
                        >+</button>
                      </div>
                    </td>
                  ))}

                  <td className="p-4 text-right">
                    <button 
                      onClick={() => eliminatePlayer(entry.id)}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                        entry.isEliminated 
                          ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                      }`}
                    >
                      {entry.isEliminated ? 'Desfazer' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-zinc-500">Nenhum jogador registrado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RegisterPlayerForm({ players, tournament, entries, onSave }) {
  const [selectedId, setSelectedId] = useState('');
  
  const availablePlayers = players.filter(p => !entries.find(e => e.playerId === p.id));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">Selecione o Jogador da Base</label>
        <select 
          value={selectedId} 
          onChange={e => setSelectedId(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">-- Selecione --</option>
          {availablePlayers.map(p => (
            <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>
          ))}
        </select>
        {availablePlayers.length === 0 && <p className="text-xs text-amber-500 mt-2">Todos os jogadores da base já estão no torneio ou a base está vazia.</p>}
      </div>
      <button 
        disabled={!selectedId}
        onClick={() => onSave(selectedId)}
        className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 mt-4"
      >
        Adicionar ao Torneio
      </button>
    </div>
  );
}


// 3. PLAYERS VIEW (CRUD)
function PlayersView({ players, user, db, appId }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const savePlayer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'players'), {
        name, phone, createdAt: Date.now()
      });
      setName(''); setPhone('');
    } catch (err) { console.error(err); }
  };

  const deletePlayer = async (id) => {
    // Note: in a real app, check if player has history before hard deleting.
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'players', id));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex gap-6 h-full flex-col md:flex-row">
      <div className="w-full md:w-1/3 bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-fit shrink-0">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users size={20}/> Novo Jogador</h2>
        <form onSubmit={savePlayer} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider">Nome Completo</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 mt-1 focus:border-amber-500 outline-none" required />
          </div>
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider">Telefone (Opcional)</label>
            <input type="text" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 mt-1 focus:border-amber-500 outline-none" />
          </div>
          <button type="submit" className="bg-amber-500 text-zinc-950 font-bold py-3 rounded-lg hover:bg-amber-400 transition-colors mt-2">
            Salvar Jogador
          </button>
        </form>
      </div>

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/30">
          <h3 className="font-bold">Base de Jogadores ({players.length})</h3>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map(p => (
              <div key={p.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex justify-between items-center group">
                <div>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-sm text-zinc-500">{p.phone || 'Sem telefone'}</div>
                </div>
                <button onClick={() => deletePlayer(p.id)} className="text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {players.length === 0 && <p className="text-zinc-500 col-span-full">Nenhum jogador cadastrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. TOURNAMENTS VIEW
function TournamentsView({ tournaments, user, db, appId, openModal, closeModal }) {
  
  const createTournament = () => {
    openModal("Criar Novo Torneio", <TournamentForm user={user} db={db} appId={appId} onSuccess={closeModal} />);
  };

  const editTournament = (t) => {
    openModal("Editar Torneio", <TournamentForm user={user} db={db} appId={appId} initialData={t} onSuccess={closeModal} />);
  };

  const deleteTournament = async (id) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tournaments', id)); } 
    catch (err) { console.error(err); }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Torneios</h1>
          <p className="text-zinc-400 text-sm">Crie e configure etapas, dias classificatórios e finais.</p>
        </div>
        <button onClick={createTournament} className="bg-amber-500 text-zinc-950 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-400">
          <Plus size={20} /> Novo Torneio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map(t => (
          <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col hover:border-zinc-700 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                  t.status === 'Running' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                  t.status === 'Finished' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 
                  'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  {t.status}
                </span>
                <h3 className="font-bold text-xl mt-2 line-clamp-1">{t.name}</h3>
                <p className="text-zinc-400 text-sm">{t.type} • Peso: {t.weight}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editTournament(t)} className="text-zinc-600 hover:text-amber-500 transition-colors" title="Editar Torneio">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => deleteTournament(t.id)} className="text-zinc-600 hover:text-red-500 transition-colors" title="Excluir Torneio">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-zinc-800 flex justify-between items-center text-sm text-zinc-500">
              <span>{new Date(t.date).toLocaleDateString('pt-BR')}</span>
              <span>{t.actions?.length || 0} Ações config.</span>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-xl">
            Nenhum torneio criado. Clique em "Novo Torneio" para começar.
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentForm({ user, db, appId, initialData, onSuccess }) {
  const recalculateLevels = (currentBlinds) => {
    let lvlCount = 1;
    return currentBlinds.map(b => ({
      ...b,
      level: b.isBreak ? '' : lvlCount++,
      title: b.isBreak ? (b.title || 'Break') : b.title
    }));
  };

  const [formData, setFormData] = useState({
    name: initialData?.name || '', type: initialData?.type || 'Single Day', date: initialData?.date || new Date().toISOString().split('T')[0], weight: initialData?.weight || 1
  });
  const [actions, setActions] = useState(initialData?.actions || [...DEFAULT_ACTIONS]);
  const [blinds, setBlinds] = useState(initialData?.blinds ? recalculateLevels(initialData.blinds) : recalculateLevels(DEFAULT_BLINDS));
  const [payouts, setPayouts] = useState(initialData?.payouts || [
    { pos: 1, percent: 50 }, { pos: 2, percent: 30 }, { pos: 3, percent: 20 }
  ]);
  const [activeConfigTab, setActiveConfigTab] = useState('geral'); // geral, actions, blinds, payouts

  const handleSave = async () => {
    if (!formData.name) return;
    try {
      if (initialData?.id) {
        // Edit mode
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tournaments', initialData.id), {
          ...formData, actions, blinds: recalculateLevels(blinds), payouts
        });
      } else {
        // Create mode
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tournaments'), {
          ...formData,
          actions,
          blinds: recalculateLevels(blinds),
          payouts,
          status: 'Upcoming', // Upcoming, Running, Finished
          createdAt: Date.now(),
          currentLevelIndex: 0,
          clockState: { isRunning: false, savedTimeLeft: blinds[0]?.duration * 60 || 1200, endTime: null }
        });
      }
      onSuccess();
    } catch (e) { console.error(e); }
  };

  const updateAction = (idx, field, val) => {
    const newActions = [...actions];
    newActions[idx][field] = field === 'isTimeChip' ? val : (field === 'name' ? val : Number(val));
    setActions(newActions);
  };

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 mb-4 shrink-0 overflow-x-auto">
        {['geral', 'ações (buy-ins)', 'blinds', 'premiação'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveConfigTab(tab.split(' ')[0])}
            className={`px-4 py-2 capitalize font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeConfigTab === tab.split(' ')[0] ? 'border-amber-500 text-amber-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >{tab}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-2 pb-4">
        {activeConfigTab === 'geral' && (
          <div className="grid gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1 uppercase">Nome do Torneio</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-3" placeholder="Ex: BSOP Main Event" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 uppercase">Data</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 uppercase">Tipo</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-white">
                  <option>Single Day</option>
                  <option>Dia 1A</option>
                  <option>Dia 1B</option>
                  <option>Dia Final</option>
                  <option>Satélite</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1 uppercase">Peso da Etapa (Ranking)</label>
              <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-3" />
              <p className="text-xs text-zinc-500 mt-1">Multiplicador usado na fórmula final do ranking.</p>
            </div>
          </div>
        )}

        {activeConfigTab === 'ações' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400 mb-2">Configure os tipos de buy-ins e compras. Itens como "Time Chip" ou "Lista" devem ter o switch ativado para não contabilizar no valor financeiro da premiação e aplicar regras de nível.</p>
            {actions.map((act, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg grid grid-cols-12 gap-3 items-center">
                <input type="text" value={act.name} onChange={e => updateAction(i, 'name', e.target.value)} className="col-span-4 bg-zinc-900 border border-zinc-700 rounded p-2 text-sm" placeholder="Nome" />
                <input type="number" value={act.chips} onChange={e => updateAction(i, 'chips', e.target.value)} className="col-span-3 bg-zinc-900 border border-zinc-700 rounded p-2 text-sm" placeholder="Fichas" title="Fichas" />
                <input type="number" value={act.price} onChange={e => updateAction(i, 'price', e.target.value)} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-2 text-sm" placeholder="R$" title="Valor R$" disabled={act.isTimeChip} />
                
                <label className="col-span-2 flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={act.isTimeChip} onChange={e => updateAction(i, 'isTimeChip', e.target.checked)} className="accent-amber-500" />
                  Especial?
                </label>
                
                <button onClick={() => setActions(actions.filter((_, idx) => idx !== i))} className="col-span-1 text-red-500 flex justify-center"><Trash2 size={16} /></button>
                
                {act.isTimeChip && (
                  <div className="col-span-12 flex items-center gap-2 mt-1">
                    <span className="text-xs text-amber-500">Trava máx. nível:</span>
                    <input type="number" value={act.maxLevel || 1} onChange={e => updateAction(i, 'maxLevel', e.target.value)} className="w-16 bg-zinc-900 border border-zinc-700 rounded p-1 text-xs" />
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setActions([...actions, { id: generateId(), name: 'Nova Ação', chips: 1000, price: 10, isTimeChip: false }])} className="text-amber-500 text-sm font-bold flex items-center gap-1 mt-2">
              <Plus size={16} /> Adicionar Ação
            </button>
          </div>
        )}

        {activeConfigTab === 'blinds' && (
          <div className="flex flex-col gap-3">
             <p className="text-sm text-zinc-400 mb-2">Configure os níveis de blinds, antes e intervalos. Os níveis em andamento poderão ser editados no painel.</p>
             <div className="grid grid-cols-12 gap-2 text-xs font-bold text-zinc-500 uppercase">
                <span className="col-span-2 text-center">Nível</span>
                <span className="col-span-2">SB</span>
                <span className="col-span-2">BB</span>
                <span className="col-span-2">Ante</span>
                <span className="col-span-2">Min.</span>
                <span className="col-span-1 text-center" title="Break">Brk</span>
             </div>
             {blinds.map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                  <span className="col-span-2 text-center text-sm font-bold text-zinc-400">{b.isBreak ? 'Brk' : `Lvl ${b.level}`}</span>
                  <input type="number" value={b.sb || ''} onChange={e => { const nb = [...blinds]; nb[i].sb = Number(e.target.value); setBlinds(nb); }} disabled={b.isBreak} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                  <input type="number" value={b.bb || ''} onChange={e => { const nb = [...blinds]; nb[i].bb = Number(e.target.value); setBlinds(nb); }} disabled={b.isBreak} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                  <input type="number" value={b.ante || ''} onChange={e => { const nb = [...blinds]; nb[i].ante = Number(e.target.value); setBlinds(nb); }} disabled={b.isBreak} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                  <input type="number" value={b.duration || 20} onChange={e => { const nb = [...blinds]; nb[i].duration = Number(e.target.value); setBlinds(nb); }} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                  <div className="col-span-1 flex justify-center">
                    <input type="checkbox" checked={b.isBreak || false} onChange={e => { const nb = [...blinds]; nb[i].isBreak = e.target.checked; if(e.target.checked){ nb[i].title = "Break"; nb[i].sb=0; nb[i].bb=0; nb[i].ante=0; } else { nb[i].title = ""; } setBlinds(recalculateLevels(nb)); }} className="accent-amber-500" />
                  </div>
                  <button onClick={() => { const nb = blinds.filter((_, idx)=>idx!==i); setBlinds(recalculateLevels(nb)); }} className="col-span-1 text-red-500 flex justify-center"><Trash2 size={16}/></button>
                </div>
             ))}
             <button onClick={() => { const nb = [...blinds, { level: '', sb: 0, bb: 0, ante: 0, duration: 20, isBreak: false }]; setBlinds(recalculateLevels(nb)); }} className="text-amber-500 text-sm font-bold flex items-center gap-1 mt-2 w-max">
              <Plus size={16} /> Adicionar Nível
            </button>
          </div>
        )}

        {activeConfigTab === 'premiação' && (
          <div className="flex flex-col gap-3">
             <p className="text-sm text-zinc-400 mb-2">Defina o % do Payout ou o valor fixo (em R$). Se marcar "Fixo?", o sistema pagará o valor absoluto ignorando a porcentagem.</p>
             <div className="grid grid-cols-12 gap-2 text-xs font-bold text-zinc-500 uppercase">
                <span className="col-span-2 text-center">Pos</span>
                <span className="col-span-3 text-center">% Rateio</span>
                <span className="col-span-4 text-center">Valor Fixo (R$)</span>
                <span className="col-span-2 text-center" title="Usar valor fixo ao invés de porcentagem">Fixo?</span>
             </div>
             {payouts.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                  <span className="col-span-2 text-center font-bold text-sm">{p.pos}º</span>
                  <input type="number" value={p.percent} onChange={e => {
                    const newP = [...payouts]; newP[i].percent = Number(e.target.value); setPayouts(newP);
                  }} className="col-span-3 bg-zinc-900 border border-zinc-700 p-1 rounded text-sm text-center text-white" disabled={p.useFixed} />
                  
                  <input type="number" value={p.fixedValue || ''} onChange={e => {
                    const newP = [...payouts]; newP[i].fixedValue = Number(e.target.value); setPayouts(newP);
                  }} className="col-span-4 bg-zinc-900 border border-zinc-700 p-1 rounded text-sm text-center text-white" disabled={!p.useFixed} placeholder="Ex: 5000" />
                  
                  <div className="col-span-2 flex justify-center">
                    <input type="checkbox" checked={p.useFixed || false} onChange={e => {
                       const newP = [...payouts]; newP[i].useFixed = e.target.checked; setPayouts(newP);
                    }} className="accent-amber-500" />
                  </div>

                  <button onClick={() => setPayouts(payouts.filter((_, idx)=>idx!==i))} className="col-span-1 text-red-500 flex justify-center"><Trash2 size={16}/></button>
                </div>
             ))}
             <button onClick={() => setPayouts([...payouts, { pos: payouts.length + 1, percent: 0, fixedValue: 0, useFixed: false }])} className="text-amber-500 text-sm font-bold flex items-center gap-1 mt-2 w-max">
              <Plus size={16} /> Adicionar Posição
            </button>
            <div className="mt-4 p-3 bg-zinc-900 border border-zinc-800 rounded">
              <span className="text-sm text-zinc-400">Total Distribuído em %: </span>
              <span className={`font-bold ${payouts.filter(p=>!p.useFixed).reduce((acc, p)=>acc+p.percent, 0) !== 100 ? 'text-amber-500' : 'text-green-400'}`}>
                {payouts.filter(p=>!p.useFixed).reduce((acc, p)=>acc+p.percent, 0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Save */}
      <div className="pt-4 border-t border-zinc-800 shrink-0 mt-auto">
        <button onClick={handleSave} className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-lg hover:bg-amber-400 transition-colors">
          {initialData?.id ? 'Salvar Alterações' : 'Criar Torneio e Iniciar Controle'}
        </button>
      </div>
    </div>
  );
}


// 5. RANKING VIEW (Calculation)
function RankingView({ tournaments, user, db, appId }) {
  const [rankingData, setRankingData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Calculate global ranking
    const calculateRanking = async () => {
      setLoading(true);
      try {
        const finishedTournaments = tournaments.filter(t => t.status === 'Finished' || t.status === 'Running'); // Or just Finished.
        
        const playerScores = {}; // { playerId: { name, points, tourneysPlayed } }

        for (const t of finishedTournaments) {
          const weight = t.weight || 1;
          const eSnap = await getDocs(collection(db, 'artifacts', appId, 'users', user.uid, `tournaments/${t.id}/entries`));
          const tEntries = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          // Find total tournament actions for the formula. Usually this is field size (total buy-ins)
          let totalTournamentActions = 0;
          tEntries.forEach(e => {
            Object.keys(e.actions || {}).forEach(k => {
              const aDef = t.actions?.find(a => a.id === k);
              if (aDef && !aDef.isTimeChip) totalTournamentActions += e.actions[k];
            });
          });

          // Process each player
          for (const e of tEntries) {
            if (!e.isEliminated && t.status !== 'Finished') continue; // Only score eliminated or finished
            
            // Need player name
            const pNameDoc = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'players', e.playerId));
            const pName = pNameDoc.exists() ? pNameDoc.data().name : 'Desconhecido';

            const pos = e.finalPosition || 1; // Default to 1 if not eliminated but tournament finished (winner)
            
            // The Requested Formula: (((ações ÷ posição final do jogador) × 100) ^ 0.5) × peso da etapa.
            // Ações = total valid actions of the tournament (field size)
            if (totalTournamentActions > 0 && pos > 0) {
              const score = Math.pow((totalTournamentActions / pos) * 100, 0.5) * weight;
              
              if (!playerScores[e.playerId]) playerScores[e.playerId] = { name: pName, points: 0, played: 0 };
              playerScores[e.playerId].points += score;
              playerScores[e.playerId].played += 1;
            }
          }
        }

        const sorted = Object.values(playerScores).sort((a, b) => b.points - a.points);
        setRankingData(sorted);
      } catch (e) { console.error(e); }
      setLoading(false);
    };

    if (tournaments.length > 0) calculateRanking();
  }, [tournaments, user, db, appId]);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="text-amber-500" /> Ranking Geral</h1>
          <p className="text-zinc-400 text-sm">Baseado na fórmula: (((Total Ações / Posição Final) × 100) ^ 0.5) × Peso da Etapa</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-full text-zinc-500">Calculando ranking...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-950/50 text-zinc-400 text-sm">
              <tr>
                <th className="p-4 font-medium border-b border-zinc-800 w-20 text-center">Pos</th>
                <th className="p-4 font-medium border-b border-zinc-800">Jogador</th>
                <th className="p-4 font-medium border-b border-zinc-800 text-center">Torneios</th>
                <th className="p-4 font-medium border-b border-zinc-800 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {rankingData.map((row, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="p-4 text-center font-bold">
                    {i === 0 ? <span className="text-yellow-500 text-xl">1º</span> : 
                     i === 1 ? <span className="text-zinc-300 text-lg">2º</span> : 
                     i === 2 ? <span className="text-amber-700 text-lg">3º</span> : `${i+1}º`}
                  </td>
                  <td className="p-4 font-medium">{row.name}</td>
                  <td className="p-4 text-center text-zinc-400">{row.played}</td>
                  <td className="p-4 text-right font-mono font-bold text-amber-500">{row.points.toFixed(2)}</td>
                </tr>
              ))}
              {rankingData.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Dados insuficientes para ranking. Finalize torneios para gerar pontos.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// 6. FINANCE VIEW (Closing & Export)
function FinanceView({ tournament, entries }) {
  if (!tournament) return <EmptyState icon={<DollarSign size={48}/>} title="Fechamento Financeiro" subtitle="Selecione um torneio ativo para ver o financeiro." />;

  const stats = useMemo(() => {
    let grossRevenue = 0;
    entries.forEach(e => grossRevenue += (e.totalSpent || 0));

    // Calculate payouts based on config
    const payoutsList = [];
    let totalPaidOut = 0;
    
    if (tournament.payouts && grossRevenue > 0) {
       tournament.payouts.forEach(p => {
         const value = p.useFixed ? Number(p.fixedValue || 0) : (grossRevenue * p.percent) / 100;
         payoutsList.push({ pos: p.pos, percent: p.percent, value, isFixed: p.useFixed });
         totalPaidOut += value;
       });
    }

    const netProfit = grossRevenue - totalPaidOut;

    return { grossRevenue, totalPaidOut, netProfit, payoutsList };
  }, [entries, tournament]);

  const exportCSV = () => {
    let csv = "Torneio,Data,Receita Bruta,Premios Pagos,Lucro Liquido\n";
    csv += `"${tournament.name}",${new Date(tournament.date).toLocaleDateString('pt-BR')},${stats.grossRevenue},${stats.totalPaidOut},${stats.netProfit}\n\n`;
    
    csv += "POSICAO,PERCENTUAL,VALOR PAGO\n";
    stats.payoutsList.forEach(p => {
      csv += `${p.pos},${p.percent}%,${p.value}\n`;
    });

    csv += "\nJOGADOR,TOTAL GASTO\n";
    entries.forEach(e => {
       // Ideally we map playerId to name, but we don't have players prop here easily. We'll use ID for now or skip.
       csv += `${e.playerId},${e.totalSpent}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `fechamento_${tournament.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <div>
          <h2 className="text-2xl font-bold">{tournament.name}</h2>
          <p className="text-zinc-400">Resumo Financeiro</p>
        </div>
        <button onClick={exportCSV} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 border border-zinc-700 transition-colors">
          <Download size={18} /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
          <p className="text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2">Arrecadação Bruta</p>
          <p className="text-3xl font-black text-white">{formatMoney(stats.grossRevenue)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
          <p className="text-zinc-400 uppercase text-xs font-bold tracking-wider mb-2">Premiações (Payout)</p>
          <p className="text-3xl font-black text-red-400">- {formatMoney(stats.totalPaidOut)}</p>
        </div>
        <div className="bg-zinc-900 border-t-4 border-amber-500 p-6 rounded-xl text-center shadow-[0_0_30px_rgba(245,158,11,0.1)]">
          <p className="text-amber-500 uppercase text-xs font-bold tracking-wider mb-2">Lucro do Clube (Net)</p>
          <p className="text-3xl font-black text-amber-500">{formatMoney(stats.netProfit)}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mt-4">
        <div className="p-4 bg-zinc-950/50 border-b border-zinc-800">
          <h3 className="font-bold">Distribuição de Prêmios (BSOP Configurado)</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-zinc-400 text-sm border-b border-zinc-800">
              <th className="p-4 font-medium">Posição</th>
              <th className="p-4 font-medium text-center">% / Fixo</th>
              <th className="p-4 font-medium text-right">Valor do Prêmio</th>
            </tr>
          </thead>
          <tbody>
            {stats.payoutsList.map(p => (
              <tr key={p.pos} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="p-4 font-bold">{p.pos}º Lugar</td>
                <td className="p-4 text-center text-zinc-400">{p.isFixed ? 'Valor Fixo' : `${p.percent}%`}</td>
                <td className="p-4 text-right text-green-400 font-bold">{formatMoney(p.value)}</td>
              </tr>
            ))}
            {stats.payoutsList.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-zinc-500">Nenhuma estrutura de premiação definida para este torneio.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- GENERIC COMPONENTS ---
function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
      <div className="text-zinc-800">{icon}</div>
      <h2 className="text-xl font-bold text-zinc-400">{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

// 7. EDIT TOURNAMENT MODAL (Real-time editor)
function EditTournamentModal({ tournament, entries, db, user, appId, closeModal }) {
  const recalculateLevels = (currentBlinds) => {
    let lvlCount = 1;
    return currentBlinds.map(b => ({
      ...b,
      level: b.isBreak ? '' : lvlCount++,
      title: b.isBreak ? (b.title || 'Break') : b.title
    }));
  };

  const [activeTab, setActiveTab] = useState('blinds');
  const [blinds, setBlinds] = useState(tournament.blinds ? recalculateLevels(tournament.blinds) : []);
  const [payouts, setPayouts] = useState(tournament.payouts ? [...tournament.payouts] : []);

  const grossRevenue = useMemo(() => entries.reduce((acc, e) => acc + (e.totalSpent || 0), 0), [entries]);

  const handleSave = async () => {
     try {
       await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tournaments', tournament.id), {
         blinds: recalculateLevels(blinds), payouts
       });
       closeModal();
     } catch(e) { console.error(e); }
  }

  return (
    <div className="flex flex-col h-[65vh]">
      <div className="flex gap-2 border-b border-zinc-800 mb-4 shrink-0">
        {['blinds', 'premiação'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab ? 'border-amber-500 text-amber-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >{tab}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-4">
         {activeTab === 'blinds' && (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-400 mb-2">Edite os blinds e breaks. As alterações afetam o relógio imediatamente após salvar.</p>
                <div className="grid grid-cols-12 gap-2 text-xs font-bold text-zinc-500 uppercase">
                    <span className="col-span-2 text-center">Nível</span>
                    <span className="col-span-2">SB</span>
                    <span className="col-span-2">BB</span>
                    <span className="col-span-2">Ante</span>
                    <span className="col-span-2">Min.</span>
                    <span className="col-span-1 text-center" title="Break">Brk</span>
                </div>
                {blinds.map((b, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                    <span className="col-span-2 text-center text-sm font-bold text-zinc-400">{b.isBreak ? 'Brk' : `Lvl ${b.level}`}</span>
                    <input type="number" value={b.sb || ''} onChange={e => { const nb = [...blinds]; nb[i].sb = Number(e.target.value); setBlinds(nb); }} disabled={b.isBreak} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                    <input type="number" value={b.bb || ''} onChange={e => { const nb = [...blinds]; nb[i].bb = Number(e.target.value); setBlinds(nb); }} disabled={b.isBreak} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                    <input type="number" value={b.ante || ''} onChange={e => { const nb = [...blinds]; nb[i].ante = Number(e.target.value); setBlinds(nb); }} disabled={b.isBreak} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                    <input type="number" value={b.duration || 20} onChange={e => { const nb = [...blinds]; nb[i].duration = Number(e.target.value); setBlinds(nb); }} className="col-span-2 bg-zinc-900 border border-zinc-700 rounded p-1 text-sm text-white" />
                    <div className="col-span-1 flex justify-center">
                        <input type="checkbox" checked={b.isBreak || false} onChange={e => { const nb = [...blinds]; nb[i].isBreak = e.target.checked; if(e.target.checked){ nb[i].title = "Break"; nb[i].sb=0; nb[i].bb=0; nb[i].ante=0; } else { nb[i].title = ""; } setBlinds(recalculateLevels(nb)); }} className="accent-amber-500" />
                    </div>
                    <button onClick={() => { const nb = blinds.filter((_, idx)=>idx!==i); setBlinds(recalculateLevels(nb)); }} className="col-span-1 text-red-500 flex justify-center"><Trash2 size={16}/></button>
                    </div>
                ))}
                <button onClick={() => { const nb = [...blinds, { level: '', sb: 0, bb: 0, ante: 0, duration: 20, isBreak: false }]; setBlinds(recalculateLevels(nb)); }} className="text-amber-500 text-sm font-bold flex items-center gap-1 mt-2 w-max">
                <Plus size={16} /> Adicionar Nível
                </button>
            </div>
         )}

         {activeTab === 'premiação' && (
            <div className="flex flex-col gap-3">
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg mb-2 shadow-inner">
                    <span className="text-amber-500 text-sm font-bold block mb-1">Arrecadação Atual (Bruta):</span>
                    <span className="text-2xl font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grossRevenue)}</span>
                </div>
                
                <div className="grid grid-cols-12 gap-2 text-xs font-bold text-zinc-500 uppercase mt-2">
                    <span className="col-span-2 text-center">Pos</span>
                    <span className="col-span-3 text-center">% Rateio</span>
                    <span className="col-span-4 text-center">Valor Fixo (R$)</span>
                    <span className="col-span-2 text-center" title="Usar valor fixo ao invés de porcentagem">Fixo?</span>
                </div>
                {payouts.map((p, i) => {
                    const calculatedValue = p.useFixed ? Number(p.fixedValue || 0) : (grossRevenue * p.percent) / 100;
                    return (
                    <div key={i} className="flex flex-col gap-1 bg-zinc-950 p-2 rounded border border-zinc-800">
                        <div className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-2 text-center font-bold text-sm text-white">{p.pos}º</span>
                            <input type="number" value={p.percent} onChange={e => {
                                const newP = [...payouts]; newP[i].percent = Number(e.target.value); setPayouts(newP);
                            }} className="col-span-3 bg-zinc-900 border border-zinc-700 p-1 rounded text-sm text-center text-white" disabled={p.useFixed} />
                            
                            <input type="number" value={p.fixedValue || ''} onChange={e => {
                                const newP = [...payouts]; newP[i].fixedValue = Number(e.target.value); setPayouts(newP);
                            }} className="col-span-4 bg-zinc-900 border border-zinc-700 p-1 rounded text-sm text-center text-white" disabled={!p.useFixed} placeholder="Ex: 5000" />
                            
                            <div className="col-span-2 flex justify-center">
                                <input type="checkbox" checked={p.useFixed || false} onChange={e => {
                                const newP = [...payouts]; newP[i].useFixed = e.target.checked; setPayouts(newP);
                                }} className="accent-amber-500" />
                            </div>
                            <button onClick={() => setPayouts(payouts.filter((_, idx)=>idx!==i))} className="col-span-1 text-red-500 flex justify-center"><Trash2 size={16}/></button>
                        </div>
                        <div className="text-right text-xs font-medium text-green-400 mt-1">
                            Prêmio a pagar: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedValue)}
                        </div>
                    </div>
                )})}
                <button onClick={() => setPayouts([...payouts, { pos: payouts.length + 1, percent: 0, fixedValue: 0, useFixed: false }])} className="text-amber-500 text-sm font-bold flex items-center gap-1 mt-2 w-max">
                <Plus size={16} /> Adicionar Posição
                </button>
            </div>
         )}
      </div>
      
      <div className="pt-4 border-t border-zinc-800 shrink-0 mt-auto flex gap-3 justify-end bg-zinc-900">
        <button onClick={closeModal} className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white transition-colors">Cancelar</button>
        <button onClick={handleSave} className="bg-amber-500 text-zinc-950 px-6 py-2 rounded-lg font-bold hover:bg-amber-400 transition-colors">Salvar Alterações</button>
      </div>
    </div>
  );
}

// 8. TELA DE LOGIN / BLOQUEIO (Impede o acesso de não-autorizados)
function AuthScreen({ auth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.includes('auth/invalid-credential') ? 'E-mail ou senha incorretos.' : 'Ocorreu um erro. Verifique se a senha tem pelo menos 6 caracteres.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 to-zinc-950 text-zinc-100">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-amber-500 tracking-wider mb-2">POKER PRO</h1>
          <p className="text-zinc-400">Acesso Restrito ao Clube</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">E-mail do Clube</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contato@meuclube.com" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 transition-colors" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Senha</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="******" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 transition-colors" required />
          </div>
          
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg text-center">{error}</div>}

          <button type="submit" disabled={loading} className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-lg hover:bg-amber-400 transition-colors mt-4 flex justify-center items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            {loading ? 'Aguarde...' : (isLogin ? <><Lock size={18} /> Entrar no Sistema</> : 'Criar Conta do Clube')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-500">
          {isLogin ? 'Primeiro acesso do seu clube?' : 'Já registrou o seu clube?'}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-amber-500 hover:text-amber-400 ml-2 font-bold transition-colors">
            {isLogin ? 'Criar Nova Conta' : 'Fazer Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
