import { useState, useMemo, useEffect, useRef } from "react";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FULL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const GENRES = ["Drama","Comedy","Thriller","Sci-Fi","Fantasy","Horror","Documentary","Animation","Reality","Crime","Romance","Action"];
const SERVICES = ["Netflix","HBO Max","Disney+","Hulu","Apple TV+","Amazon Prime","Peacock","Paramount+","Other"];
const SC = { "Watching":"#4ade80","Upcoming":"#60a5fa","On Hold":"#fbbf24","Completed":"#a78bfa" };
const GC = { "Drama":"#ef4444","Comedy":"#f97316","Thriller":"#eab308","Sci-Fi":"#06b6d4","Fantasy":"#8b5cf6","Horror":"#dc2626","Documentary":"#10b981","Animation":"#f59e0b","Reality":"#ec4899","Crime":"#6366f1","Romance":"#fb7185","Action":"#f43f5e" };
const ff = "'DM Sans',sans-serif";
const pf = "'Playfair Display',serif";
const LS = { display:"block",color:"#8888aa",fontSize:"11px",fontFamily:ff,fontWeight:500,letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:"6px" };
const IS = { width:"100%",background:"#13131e",border:"1px solid #2a2a3a",borderRadius:"8px",color:"#e0e0f0",padding:"9px 12px",fontSize:"13px",fontFamily:ff };

const DEFAULT_SHOWS = [
  { id:1, title:"The Last of Us", emoji:"🍄", genre:"Drama", service:"HBO Max", status:"Watching", multiSeason:true,
    seasons:[{totalEpisodes:9,episodesOut:7,episodeLength:60},{totalEpisodes:7,episodesOut:0,episodeLength:60}],
    currentSeason:1, episodesWatchedInSeason:5, airDays:["Sun"], watchDays:["Mon","Tue"], notes:"Amazing show", rating:5, sortOrder:0 },
  { id:2, title:"Silo", emoji:"🏚️", genre:"Sci-Fi", service:"Apple TV+", status:"Watching", multiSeason:false,
    totalEpisodes:10, episodesOut:6, episodesWatched:3, episodeLength:50, airDays:["Fri"], watchDays:[], notes:"", rating:4, sortOrder:1 },
  { id:3, title:"The Wire", emoji:"🔫", genre:"Drama", service:"HBO Max", status:"Upcoming", multiSeason:true,
    seasons:[{totalEpisodes:13,episodesOut:13,episodeLength:58},{totalEpisodes:12,episodesOut:12,episodeLength:58},{totalEpisodes:12,episodesOut:12,episodeLength:58},{totalEpisodes:13,episodesOut:13,episodeLength:58},{totalEpisodes:10,episodesOut:10,episodeLength:58}],
    currentSeason:1, episodesWatchedInSeason:0, airDays:[], watchDays:[], notes:"Been meaning to watch forever", rating:0, sortOrder:2 },
];
const DEFAULT_PREFS = { offDays:["Sun"], minutesPerDay:{ Mon:90,Tue:60,Wed:60,Thu:60,Fri:90,Sat:120,Sun:0 } };

function getWeekStart(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function fmtDate(date) { return date.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
function fmtMonth(ws) {
  const we = addDays(ws,6);
  const ms = ws.toLocaleDateString("en-US",{month:"short"}), me = we.toLocaleDateString("en-US",{month:"short"});
  const ys = ws.getFullYear(), ye = we.getFullYear();
  if (ms===me) return `${ms} ${ws.getDate()}–${we.getDate()}, ${ys}`;
  if (ys===ye) return `${ms} ${ws.getDate()} – ${me} ${we.getDate()}, ${ys}`;
  return `${ms} ${ws.getDate()}, ${ys} – ${me} ${we.getDate()}, ${ye}`;
}

function showStats(show) {
  if (!show.multiSeason || !show.seasons || show.seasons.length===0) {
    const tot=show.totalEpisodes||0, w=show.episodesWatched||0, out=show.episodesOut>0?show.episodesOut:tot;
    return { currentSeasonNum:1, totalEpisodesAll:tot, episodesWatchedAll:w, episodesOutAll:out,
      episodeLength:show.episodeLength||45, episodesInCurrentSeason:tot, episodesWatchedInCurrentSeason:w,
      episodesOutInCurrentSeason:out, totalSeasons:1 };
  }
  const seasons=show.seasons, cur=show.currentSeason||1, curIdx=cur-1;
  const curSeason=seasons[curIdx]||seasons[seasons.length-1];
  const totalAll=seasons.reduce((a,s)=>a+(s.totalEpisodes||0),0);
  const watchedAll=seasons.slice(0,curIdx).reduce((a,s)=>a+(s.totalEpisodes||0),0)+(show.episodesWatchedInSeason||0);
  const epOut=curSeason.episodesOut>0?curSeason.episodesOut:curSeason.totalEpisodes||0;
  const outAll=seasons.slice(0,curIdx).reduce((a,s)=>a+(s.totalEpisodes||0),0)+epOut;
  return { currentSeasonNum:cur, totalEpisodesAll:totalAll, episodesWatchedAll:watchedAll, episodesOutAll:outAll,
    episodeLength:curSeason.episodeLength||show.episodeLength||45,
    episodesInCurrentSeason:curSeason.totalEpisodes||0, episodesWatchedInCurrentSeason:show.episodesWatchedInSeason||0,
    episodesOutInCurrentSeason:epOut, totalSeasons:seasons.length };
}

function computedStats(show, watchedEps) {
  const base = showStats(show);
  const prefix = show.id + ":";
  const checkedKeys = Object.keys(watchedEps||{}).filter(k => watchedEps[k] && k.startsWith(prefix));
  if (checkedKeys.length === 0) return { ...base, displayStatus: show.status };
  if (!show.multiSeason || !show.seasons || show.seasons.length===0) {
    const w = Math.min(base.totalEpisodesAll, base.episodesWatchedAll + checkedKeys.length);
    const done = base.totalEpisodesAll > 0 && w >= base.totalEpisodesAll;
    return { ...base, episodesWatchedAll:w, episodesWatchedInCurrentSeason:w, displayStatus: done ? "Completed" : "Watching" };
  }
  const seasonPfx = show.id + ":s" + (show.currentSeason||1) + "e";
  const checkedNow = checkedKeys.filter(k => k.startsWith(seasonPfx)).length;
  const wInSeason = base.episodesWatchedInCurrentSeason + checkedNow;
  const wAll = base.episodesWatchedAll - base.episodesWatchedInCurrentSeason + wInSeason;
  const isLast = (show.currentSeason||1) >= (show.seasons||[]).length;
  const done = isLast && wInSeason >= base.episodesInCurrentSeason && base.episodesInCurrentSeason > 0;
  return { ...base, episodesWatchedInCurrentSeason:wInSeason, episodesWatchedAll:wAll, displayStatus: done ? "Completed" : show.status };
}

function buildSchedule(shows, prefs, weekStart, today, startingEpOverride, watchedEps) {
  const { offDays, minutesPerDay } = prefs;
  const active = [...shows.filter(s => s.status==="Watching" || s.status==="Upcoming")]
    .sort((a,b) => (a.sortOrder??9999) - (b.sortOrder??9999));
  const nextEp = {};
  active.forEach(s => {
    const st = showStats(s);
    const hardCap = st.episodesInCurrentSeason || st.episodesOutInCurrentSeason;
    let startEp;
    if (startingEpOverride && startingEpOverride[s.id]) {
      startEp = startingEpOverride[s.id].ep;
    } else {
      // Only use watchedEps to advance startEp for chained/projection weeks (when watchedEps is {}).
      // For the current week, base startEp purely on show data so scheduled slots never disappear
      // when checked. Checked state is applied visually at render time, not at slot-generation time.
      startEp = st.episodesWatchedInCurrentSeason + 1;
    }
    nextEp[s.id] = { ep: startEp, season: st.currentSeasonNum, maxEp: hardCap };
  });
  const sched = {};
  DAYS.forEach((day, i) => { sched[day] = { items:[], date:addDays(weekStart,i), usedMins:0 }; });
  DAYS.forEach((day, dayIdx) => {
    const dayDate = addDays(weekStart, dayIdx);
    if (today && dayDate < today) return;
    if (offDays.includes(day)) return;
    const maxM = minutesPerDay[day] ?? 90;
    const items = []; let usedMins = 0; const placed = new Set();
    const pinnedHere = active.filter(s => s.watchDays && s.watchDays.includes(day));
    const autoShows  = active.filter(s => !s.watchDays || s.watchDays.length === 0);
    const byAirDay = (a,b) => { const an=a.airDays&&a.airDays.includes(day)?0:1, bn=b.airDays&&b.airDays.includes(day)?0:1; return an-bn; };
    pinnedHere.sort(byAirDay);
    autoShows.sort(byAirDay);
    const placeShow = (show, flags, pinned) => {
      if (placed.has(show.id)) return;
      const st = showStats(show); const len = st.episodeLength || 45;
      const isAirDay = show.airDays && show.airDays.includes(day);
      const { ep: startEp, season, maxEp } = nextEp[show.id];
      if (maxEp === 0 || startEp > maxEp) return;
      const releasedMax = st.episodesOutInCurrentSeason;
      const budget = pinned ? maxM : maxM - usedMins;
      const slots = pinned ? Math.max(1, Math.floor(budget / Math.max(len,1))) : Math.floor(budget / Math.max(len,1));
      const availableReleased = Math.max(0, releasedMax - startEp + 1);
      const count = availableReleased > 0 ? Math.min(slots, maxEp - startEp + 1) : isAirDay ? 1 : 0;
      if (count <= 0) return;
      for (let i = 0; i < count; i++) {
        const epNum = startEp + i;
        const key = `${show.id}:s${season}e${epNum}`;
        const isUnreleased = epNum > releasedMax;
        items.push({ show, key, episodeNum:epNum, seasonNum:season, epLength:len, isNewAirday:isAirDay&&i===0, isUnreleased, ...flags });
      }
      usedMins += len * count;
      nextEp[show.id] = { ...nextEp[show.id], ep: startEp + count };
      placed.add(show.id);
    };
    pinnedHere.forEach(s => placeShow(s, { isPinned:true }, true));
    autoShows.forEach(s => placeShow(s, { isAuto:true }, false));
    sched[day].items = items; sched[day].usedMins = usedMins;
  });
  // If watchedEps is provided (current week), advance projectedEp past any checked episodes
  // so that future-week projections start from the right place.
  if (watchedEps && Object.keys(watchedEps).length > 0) {
    active.forEach(s => {
      const st = showStats(s);
      const seasonPfx = `${s.id}:s${st.currentSeasonNum}e`;
      const checkedNums = Object.keys(watchedEps)
        .filter(k => watchedEps[k] && k.startsWith(seasonPfx))
        .map(k => parseInt(k.replace(seasonPfx, ""))).filter(n => !isNaN(n));
      if (checkedNums.length > 0) {
        const highestChecked = Math.max(...checkedNums);
        if (nextEp[s.id] && highestChecked + 1 > nextEp[s.id].ep) {
          nextEp[s.id] = { ...nextEp[s.id], ep: highestChecked + 1 };
        }
      }
    });
  }
  return { sched, projectedEp: nextEp };
}

function Modal({ show, onClose, children }) {
  if (!show) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.87)",backdropFilter:"blur(4px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0f0f14",border:"1px solid #2a2a3a",borderRadius:"16px",padding:"24px",width:"100%",maxWidth:"620px",maxHeight:"93vh",overflowY:"auto",boxShadow:"0 25px 60px rgba(0,0,0,0.95)" }}>
        {children}
      </div>
    </div>
  );
}


function SeasonDoneModal({ show, onNext, onComplete, onDismiss }) {
  const st = showStats(show);
  const isLast = st.currentSeasonNum >= st.totalSeasons;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.93)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <div style={{ background:"#0f0f18",border:"1px solid #4ade8033",borderRadius:"20px",padding:"28px 24px",maxWidth:"360px",width:"100%",textAlign:"center",boxShadow:"0 0 80px rgba(74,222,128,0.12)" }}>
        <div style={{ fontSize:"52px",marginBottom:"10px" }}>🎉</div>
        <h2 style={{ fontFamily:pf,fontSize:"22px",fontWeight:700,color:"#f0f0ff",marginBottom:"6px" }}>Season {st.currentSeasonNum} Complete!</h2>
        <p style={{ fontFamily:ff,fontSize:"13px",color:"#8888aa",marginBottom:"22px" }}>{show.title}</p>
        <div style={{ display:"flex",flexDirection:"column",gap:"9px" }}>
          {!isLast && <button onClick={onNext} style={{ background:"linear-gradient(135deg,#4ade80,#22c55e)",color:"#000",padding:"13px",borderRadius:"11px",fontFamily:ff,fontSize:"15px",fontWeight:600 }}>▶ Start Season {st.currentSeasonNum+1}</button>}
          {isLast && <button onClick={onComplete} style={{ background:"linear-gradient(135deg,#a78bfa,#7c3aed)",color:"#fff",padding:"13px",borderRadius:"11px",fontFamily:ff,fontSize:"15px",fontWeight:600 }}>🏆 Mark as Completed</button>}
          {!isLast && <button onClick={onDismiss} style={{ background:"#1a1a28",color:"#8888aa",border:"1px solid #2a2a3a",padding:"11px",borderRadius:"11px",fontFamily:ff,fontSize:"13px" }}>Stay on Season {st.currentSeasonNum}</button>}
          <button onClick={onDismiss} style={{ background:"none",color:"#3a3a5a",fontFamily:ff,fontSize:"11px",padding:"4px" }}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

const DSEASON = { totalEpisodes:"", episodesOut:"", episodeLength:"" };
const DFORM = { title:"", emoji:"", genre:"", service:"", status:"Watching", multiSeason:false,
  totalEpisodes:"", episodesOut:"", episodesWatched:"", episodeLength:"",
  seasons:[{...DSEASON}], currentSeason:1, episodesWatchedInSeason:"", airDays:[], watchDays:[], notes:"", rating:0 };

export default function App() {
  const [shows, setShows] = useState(() => { try{const s=localStorage.getItem("tvq-shows");if(s)return JSON.parse(s);}catch{}return DEFAULT_SHOWS; });
  const [prefs, setPrefs] = useState(() => { try{const p=localStorage.getItem("tvq-prefs");if(p)return JSON.parse(p);}catch{}return DEFAULT_PREFS; });
  const [watchedEps, setWatchedEps] = useState(() => { try{const w=localStorage.getItem("tvq-watched");if(w)return JSON.parse(w);}catch{}return {}; });
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [showLogin, setShowLogin] = useState(true);

  useEffect(()=>{ try{localStorage.setItem("tvq-shows",JSON.stringify(shows));}catch{} },[shows]);
  useEffect(()=>{ try{localStorage.setItem("tvq-prefs",JSON.stringify(prefs));}catch{} },[prefs]);
  useEffect(()=>{ try{localStorage.setItem("tvq-watched",JSON.stringify(watchedEps));}catch{} },[watchedEps]);
  const saveTimer = useRef(null);


  const [form, setForm] = useState(DFORM);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState("queue");
  const [filter, setFilter] = useState("All");
  const [showPrefPanel, setShowPrefPanel] = useState(false);
  const [expandedShow, setExpandedShow] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [seasonDoneShow, setSeasonDoneShow] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const today = useMemo(()=>{ const d=new Date();d.setHours(0,0,0,0);return d; },[]);
  const weekStart = useMemo(()=>addDays(getWeekStart(today),weekOffset*7),[today,weekOffset]);
  const todayDayIdx = useMemo(()=>{ const d=today.getDay();return d===0?6:d-1; },[today]);
  const isCurrentWeek = weekOffset === 0;

  const toggleWatched = (key, show) => {
    setWatchedEps(w => {
      const next = {...w, [key]: !w[key]};
      // Check for season completion after checking an ep
      if (next[key] && show) {
        const st = showStats(show);
        const seasonPfx = `${show.id}:s${st.currentSeasonNum}e`;
        const checkedCount = Object.keys(next).filter(k=>next[k]&&k.startsWith(seasonPfx)).length;
        const totalWatched = st.episodesWatchedInCurrentSeason + checkedCount;
        if (st.episodesInCurrentSeason > 0 && totalWatched >= st.episodesInCurrentSeason) {
          setTimeout(()=>setSeasonDoneShow(show), 400);
        }
      }
      return next;
    });
  };

  const handleSeasonNext = () => {
    const show = seasonDoneShow; setSeasonDoneShow(null); if (!show) return;
    const st = showStats(show);
    const seasonPfx = `${show.id}:s${st.currentSeasonNum}e`;
    setWatchedEps(w=>{ const n={...w}; Object.keys(n).forEach(k=>{if(k.startsWith(seasonPfx))delete n[k];}); return n; });
    setShows(s=>s.map(x=>x.id!==show.id?x:{...x,currentSeason:st.currentSeasonNum+1,episodesWatchedInSeason:0}));
  };
  const handleSeasonComplete = () => {
    const show = seasonDoneShow; setSeasonDoneShow(null); if (!show) return;
    setShows(s=>s.map(x=>x.id!==show.id?x:{...x,status:"Completed"}));
  };

  const { sched, projectedEp } = useMemo(() => {
    const todayWeekStart = getWeekStart(today);
    if (weekOffset <= 0) return buildSchedule(shows, prefs, weekStart, isCurrentWeek?today:null, null, watchedEps);
    let result = buildSchedule(shows, prefs, todayWeekStart, today, null, watchedEps);
    for (let w=1; w<=weekOffset; w++) result = buildSchedule(shows, prefs, addDays(todayWeekStart,w*7), null, result.projectedEp, {});
    return result;
  }, [shows, prefs, weekStart, weekOffset, today, isCurrentWeek, watchedEps]);

  const weekMins = useMemo(()=>DAYS.reduce((a,d)=>a+(sched[d]?.usedMins||0),0),[sched]);

  const openAdd = ()=>{ setForm({...DFORM,seasons:[{...DSEASON}]}); setEditId(null); setShowModal(true); };
  const openEdit = s=>{ setForm({...s,seasons:s.seasons?s.seasons.map(x=>({...x})):[{...DSEASON}]}); setEditId(s.id); setShowModal(true); };

  const save = () => {
    if (!form.title.trim()) return;
    let d = {...form};
    if (d.multiSeason) {
      d.seasons = d.seasons.map(s=>({totalEpisodes:parseInt(s.totalEpisodes)||0,episodesOut:s.episodesOut!==""?parseInt(s.episodesOut):parseInt(s.totalEpisodes)||0,episodeLength:parseInt(s.episodeLength)||45}));
      d.currentSeason=parseInt(d.currentSeason)||1; d.episodesWatchedInSeason=parseInt(d.episodesWatchedInSeason)||0;
    } else {
      d.totalEpisodes=parseInt(d.totalEpisodes)||0; d.episodesOut=d.episodesOut!==""?parseInt(d.episodesOut):d.totalEpisodes;
      d.episodesWatched=parseInt(d.episodesWatched)||0; d.episodeLength=parseInt(d.episodeLength)||45;
    }
    if (editId) setShows(s=>s.map(x=>x.id===editId?{...d,id:editId,sortOrder:x.sortOrder}:x));
    else { const mx=shows.reduce((m,x)=>Math.max(m,x.sortOrder??0),0); setShows(s=>[...s,{...d,id:Date.now(),sortOrder:mx+1}]); }
    setShowModal(false);
  };

  const reorderShows = (fromId, toId) => {
    if (fromId===toId) return;
    setShows(prev => {
      const sorted=[...prev].sort((a,b)=>(a.sortOrder??9999)-(b.sortOrder??9999));
      const fi=sorted.findIndex(s=>s.id===fromId), ti=sorted.findIndex(s=>s.id===toId);
      if (fi<0||ti<0) return prev;
      const r=[...sorted]; const [m]=r.splice(fi,1); r.splice(ti,0,m);
      return r.map((s,i)=>({...s,sortOrder:i}));
    });
  };

  const [syncPanel, setSyncPanel] = useState(false);
  const [syncData, setSyncData] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncMode, setSyncMode] = useState("export");
  const syncDataRef = useRef(null);
  const importRef = useRef(null);

  const generateExport = ()=>{ setSyncData(JSON.stringify({shows,prefs,watchedEps,version:1})); setSyncMode("export"); setSyncMsg(""); };
  const loadFromPaste = ()=>{
    const text=(syncDataRef.current?.value||syncData).trim();
    if(!text){setSyncMsg("Paste your data first.");return;}
    try{const d=JSON.parse(text);if(d.shows)setShows(d.shows);if(d.prefs)setPrefs(d.prefs);if(d.watchedEps)setWatchedEps(d.watchedEps);setSyncMsg("✓ Loaded!");setTimeout(()=>setSyncPanel(false),1200);}
    catch{setSyncMsg("Invalid data.");}
  };
  const importData = e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.shows)setShows(d.shows);if(d.prefs)setPrefs(d.prefs);if(d.watchedEps)setWatchedEps(d.watchedEps);alert("✓ Imported!");}catch{alert("Invalid file.");}};
    r.readAsText(file);e.target.value="";
  };

  const del = id=>setShows(s=>s.filter(x=>x.id!==id));
  const toggleFDay = (day,field)=>setForm(f=>({...f,[field]:f[field].includes(day)?f[field].filter(d=>d!==day):[...f[field],day]}));
  const toggleOff = day=>setPrefs(p=>{const isOff=p.offDays.includes(day);const offDays=isOff?p.offDays.filter(d=>d!==day):[...p.offDays,day];const mpd={...p.minutesPerDay};if(!isOff)mpd[day]=0;else if(mpd[day]===0)mpd[day]=60;return{...p,offDays,minutesPerDay:mpd};});
  const setMins=(day,v)=>setPrefs(p=>({...p,minutesPerDay:{...p.minutesPerDay,[day]:parseInt(v)||0}}));

  const filtered = useMemo(()=>{
    const base=filter==="All"?shows:shows.filter(s=>s.status===filter);
    return [...base].sort((a,b)=>(a.sortOrder??9999)-(b.sortOrder??9999));
  },[shows,filter]);


  // ── Login screen ──
  if (!session && showLogin) return (
    <div style={{ minHeight:"100vh",background:"#050508",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",position:"relative",overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}input{outline:none}button{cursor:pointer;border:none}
        .login-input:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.15)!important}
        @keyframes floatup{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
        .login-card{animation:floatup .5s ease forwards}
      `}</style>
      {/* Background glow orbs */}
      <div style={{ position:"absolute",top:"-20%",left:"50%",transform:"translateX(-50%)",width:"600px",height:"600px",background:"radial-gradient(ellipse,rgba(99,102,241,0.12) 0%,transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ position:"absolute",bottom:"-10%",right:"-10%",width:"400px",height:"400px",background:"radial-gradient(ellipse,rgba(168,85,247,0.08) 0%,transparent 70%)",pointerEvents:"none" }}/>
      <div className="login-card" style={{ width:"100%",maxWidth:"420px",position:"relative",zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:"center",marginBottom:"44px" }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:"10px",marginBottom:"12px" }}>
            <div style={{ width:"42px",height:"42px",borderRadius:"12px",background:"linear-gradient(135deg,#6366f1,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(99,102,241,0.4)" }}>
              <span style={{ fontSize:"20px" }}>▶</span>
            </div>
            <h1 style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:"38px",fontWeight:700,letterSpacing:"-1.5px",background:"linear-gradient(135deg,#c7d2fe,#e879f9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>NextUp</h1>
          </div>
          <p style={{ fontFamily:"'DM Sans',sans-serif",fontSize:"14px",color:"#4a4a6a",letterSpacing:"0.2px" }}>Track what to watch, when to watch it.</p>
        </div>
        {/* Card */}
        <div style={{ background:"rgba(15,15,24,0.95)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"24px",padding:"36px 32px",boxShadow:"0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(99,102,241,0.08)",backdropFilter:"blur(20px)" }}>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:"18px",fontWeight:600,color:"#e0e0ff",marginBottom:"28px",letterSpacing:"-0.3px" }}>Welcome back</p>
          <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>
            <div>
              <label style={{ display:"block",fontFamily:"'DM Sans',sans-serif",fontSize:"11px",color:"#5a5a8a",fontWeight:500,letterSpacing:"0.7px",textTransform:"uppercase",marginBottom:"8px" }}>Email</label>
              <input className="login-input" type="email" value={email} onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&document.getElementById("nextup-signin-btn").click()}
                placeholder="you@example.com"
                style={{ width:"100%",background:"#0a0a12",border:"1px solid #1e1e30",borderRadius:"12px",color:"#e0e0f0",padding:"13px 16px",fontSize:"14px",fontFamily:"'DM Sans',sans-serif",transition:"border-color .2s,box-shadow .2s" }}/>
            </div>
            <div>
              <label style={{ display:"block",fontFamily:"'DM Sans',sans-serif",fontSize:"11px",color:"#5a5a8a",fontWeight:500,letterSpacing:"0.7px",textTransform:"uppercase",marginBottom:"8px" }}>Password</label>
              <input className="login-input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&document.getElementById("nextup-signin-btn").click()}
                placeholder="••••••••"
                style={{ width:"100%",background:"#0a0a12",border:"1px solid #1e1e30",borderRadius:"12px",color:"#e0e0f0",padding:"13px 16px",fontSize:"14px",fontFamily:"'DM Sans',sans-serif",transition:"border-color .2s,box-shadow .2s" }}/>
            </div>
            {authMsg&&(
              <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"10px 14px",borderRadius:"10px",background:authMsg.startsWith("✓")?"#0c2010":"#1a0c0c",border:`1px solid ${authMsg.startsWith("✓")?"#4ade8030":"#ef444430"}` }}>
                <span style={{ fontSize:"14px" }}>{authMsg.startsWith("✓")?"✓":"⚠"}</span>
                <p style={{ fontFamily:"'DM Sans',sans-serif",fontSize:"13px",color:authMsg.startsWith("✓")?"#4ade80":"#f87171" }}>{authMsg}</p>
              </div>
            )}
            <button id="nextup-signin-btn"
              disabled={authLoading}
              onClick={async()=>{
                if(!email||!password){setAuthMsg("Please enter your email and password.");return;}
                setAuthLoading(true); setAuthMsg("");
                try {
                  const res = await fetch("https://fhmdqlustdhiacufqefl.supabase.co/auth/v1/token?grant_type=password", {
                    method:"POST", headers:{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobWRxbHVzdGRoaWFjdWZxZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTQ5MzQsImV4cCI6MjA4NzY5MDkzNH0.am0qht26J8Gp50-2BmlKSdYY0o-BzzDsm4bEYPVXTIc"},
                    body: JSON.stringify({email, password})
                  });
                  const data = await res.json();
                  if (data.access_token) { setSession(data); setShowLogin(false); setAuthMsg(""); }
                  else setAuthMsg(data.error_description || data.msg || "Incorrect email or password.");
                } catch { setAuthMsg("Network error. Please try again."); }
                setAuthLoading(false);
              }}
              style={{ width:"100%",background:authLoading?"#1a1a2a":"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",padding:"14px",borderRadius:"12px",fontFamily:"'Space Grotesk',sans-serif",fontSize:"15px",fontWeight:600,letterSpacing:"-0.2px",transition:"opacity .2s,transform .1s",opacity:authLoading?0.5:1,boxShadow:authLoading?"none":"0 8px 24px rgba(99,102,241,0.35)",marginTop:"4px" }}>
              {authLoading?"Signing in…":"Sign in →"}
            </button>
            <div style={{ borderTop:"1px solid #1a1a28",paddingTop:"16px",textAlign:"center" }}>
              <button onClick={()=>setShowLogin(false)}
                style={{ background:"none",color:"#3a3a5a",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",padding:"4px 8px" }}>
                Continue without signing in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",background:"#07070d",color:"#e2e2ef" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0f0f14}::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:3px}
        input,select,textarea{outline:none}button{cursor:pointer;border:none}
        .card{transition:box-shadow .2s}.card:hover{box-shadow:0 14px 40px rgba(0,0,0,.65)!important}
        .delbtn{opacity:0;transition:opacity .2s}.card:hover .delbtn{opacity:1}
        .ep-row{transition:background .12s;cursor:pointer}.ep-row:hover{background:rgba(255,255,255,0.04)!important}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:#2a2a3a;outline:none;width:100%}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#6366f1;cursor:pointer}
        input[type=range]:disabled{opacity:.3}
        .drag-over{outline:2px solid #6366f188;outline-offset:3px;border-radius:14px}
      `}</style>


      {seasonDoneShow && <SeasonDoneModal show={seasonDoneShow} onNext={handleSeasonNext} onComplete={handleSeasonComplete} onDismiss={()=>setSeasonDoneShow(null)}/>}

      {/* HEADER */}
      <div style={{ background:"linear-gradient(180deg,rgba(15,15,24,0.98),rgba(7,7,13,0.98))",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",flexWrap:"wrap",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
          <div style={{ width:"32px",height:"32px",borderRadius:"9px",background:"linear-gradient(135deg,#6366f1,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(99,102,241,0.4)",flexShrink:0 }}>
            <span style={{ fontSize:"15px",lineHeight:1 }}>▶</span>
          </div>
          <div>
            <h1 style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:"22px",fontWeight:700,letterSpacing:"-0.8px",lineHeight:1,background:"linear-gradient(135deg,#c7d2fe,#e879f9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>NextUp</h1>
            <p style={{ color:"#3a3a5a",fontSize:"11px",marginTop:"2px",fontFamily:ff,letterSpacing:"0.1px" }}>{shows.filter(s=>s.status==="Watching").length} watching · {(weekMins/60).toFixed(1)}h this week</p>
          </div>
        </div>
        <div style={{ display:"flex",gap:"7px",alignItems:"center",flexWrap:"wrap" }}>
          <input ref={importRef} type="file" accept=".json" onChange={importData} style={{ display:"none" }}/>
          <button onClick={()=>{ setSyncPanel(v=>!v); if(!syncPanel)generateExport(); }} style={{ background:syncPanel?"rgba(99,102,241,0.15)":"rgba(255,255,255,0.04)",color:syncPanel?"#a5b4fc":"#6a6a8a",border:`1px solid ${syncPanel?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)"}`,padding:"8px 13px",borderRadius:"10px",fontFamily:ff,fontSize:"12px",fontWeight:500,transition:"all .15s" }}>🔄 Sync</button>
          {session&&<button onClick={()=>{setSession(null);setShowLogin(true);}} style={{ background:"rgba(255,255,255,0.04)",color:"#5a5a7a",border:"1px solid rgba(255,255,255,0.07)",padding:"8px 13px",borderRadius:"10px",fontFamily:ff,fontSize:"12px",transition:"all .15s" }}>Sign out</button>}
          <button onClick={openAdd} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"9px 18px",borderRadius:"10px",fontFamily:ff,fontWeight:600,fontSize:"13px",boxShadow:"0 4px 16px rgba(99,102,241,.35)",whiteSpace:"nowrap",letterSpacing:"-0.1px" }}>+ Add Show</button>
        </div>
      </div>

      {/* SYNC PANEL */}
      {syncPanel && (
        <div style={{ background:"#0f0f18",borderBottom:"1px solid #2a2a3a",padding:"16px 20px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px" }}>
            <div><p style={{ fontFamily:pf,fontSize:"15px",fontWeight:700,color:"#f0f0ff",marginBottom:"3px" }}>Sync Between Devices</p><p style={{ fontFamily:ff,fontSize:"12px",color:"#5a5a7a" }}>Export your data as text, copy it, paste it on another device.</p></div>
            <button onClick={()=>{setSyncPanel(false);setSyncData("");setSyncMsg("");}} style={{ background:"none",color:"#3a3a5a",fontSize:"18px",padding:"0 4px" }}>✕</button>
          </div>
          <div style={{ display:"flex",gap:"6px",marginBottom:"12px" }}>
            {[["export","📤 Export"],["import","📥 Import"]].map(([m,l])=>(
              <button key={m} onClick={()=>{setSyncMode(m);setSyncMsg("");if(m==="export")generateExport();else setSyncData("");}}
                style={{ flex:1,background:syncMode===m?"#6366f122":"#13131e",color:syncMode===m?"#a5b4fc":"#5a5a7a",border:`1px solid ${syncMode===m?"#6366f144":"#2a2a3a"}`,padding:"9px",borderRadius:"8px",fontFamily:ff,fontSize:"13px",fontWeight:500 }}>{l}</button>
            ))}
          </div>
          {syncMode==="export"&&syncData&&(
            <div>
              <p style={{ fontFamily:ff,fontSize:"12px",color:"#8888aa",marginBottom:"6px" }}>Copy all this text, paste it on your other device using Import:</p>
              <div style={{ display:"flex",gap:"8px",alignItems:"stretch",marginBottom:"8px" }}>
                <textarea ref={syncDataRef} readOnly value={syncData} onFocus={e=>e.target.select()} onClick={e=>e.target.select()}
                  style={{ ...IS,flex:1,fontSize:"11px",fontFamily:"monospace",height:"72px",resize:"none",cursor:"text" }}/>
                <button onClick={async()=>{ try{await navigator.clipboard.writeText(syncData);setSyncMsg("✓ Copied!");}catch{if(syncDataRef.current){syncDataRef.current.focus();syncDataRef.current.select();}setSyncMsg("Press Ctrl+C / Cmd+C to copy");} }}
                  style={{ background:"#6366f1",color:"#fff",padding:"0 16px",borderRadius:"8px",fontFamily:ff,fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",flexShrink:0 }}>📋 Copy</button>
              </div>
            </div>
          )}
          {syncMode==="import"&&(
            <div>
              <p style={{ fontFamily:ff,fontSize:"12px",color:"#8888aa",marginBottom:"6px" }}>Paste exported text below, tap Load:</p>
              <textarea ref={syncDataRef} defaultValue="" placeholder="Paste here..." style={{ ...IS,fontSize:"11px",fontFamily:"monospace",height:"72px",resize:"none",width:"100%",marginBottom:"8px" }}/>
              <button onClick={loadFromPaste} style={{ width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"11px",borderRadius:"9px",fontFamily:ff,fontSize:"14px",fontWeight:500 }}>Load</button>
            </div>
          )}
          {syncMsg&&<p style={{ fontFamily:ff,fontSize:"13px",color:syncMsg.startsWith("✓")?"#4ade80":"#fbbf24",marginTop:"8px" }}>{syncMsg}</p>}
        </div>
      )}

      {/* TABS */}
      <div style={{ padding:"0 20px",borderBottom:"1px solid #1a1a28",display:"flex",gap:"4px",overflowX:"auto" }}>
        {[["queue","Queue"],["schedule","Schedule"],["stats","Stats"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ background:"none",color:tab===k?"#a5b4fc":"#5a5a7a",padding:"12px 14px",fontFamily:ff,fontSize:"14px",borderBottom:tab===k?"2px solid #6366f1":"2px solid transparent",marginBottom:"-1px",fontWeight:tab===k?500:400,whiteSpace:"nowrap" }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:"16px 20px",maxWidth:"1300px" }}>

        {/* ── QUEUE ── */}
        {tab==="queue"&&<>
          <div style={{ display:"flex",gap:"7px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center" }}>
            {["All","Watching","Upcoming","On Hold","Completed"].map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{ background:filter===s?(SC[s]||"#6366f1"):"#1a1a28",color:filter===s?"#000":"#8888aa",border:`1px solid ${filter===s?(SC[s]||"#6366f1"):"#2a2a3a"}`,padding:"5px 13px",borderRadius:"20px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>{s}</button>
            ))}
            <span style={{ marginLeft:"auto",fontFamily:ff,fontSize:"11px",color:"#3a3a5a" }}>≡ drag to reorder</span>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
            {filtered.map(show=>{
              const st=computedStats(show,watchedEps), ds=st.displayStatus||show.status, color=SC[ds]||SC[show.status];
              const isMS=show.multiSeason&&show.seasons&&show.seasons.length>1;
              const proj=projectedEp[show.id];
              const projWIS=proj?Math.min(proj.ep-1,proj.maxEp):st.episodesWatchedInCurrentSeason;
              const projDelta=Math.max(0,projWIS-st.episodesWatchedInCurrentSeason);
              const projWAll=st.episodesWatchedAll+projDelta, hasProj=projDelta>0;
              const pctAll=st.totalEpisodesAll?Math.round(st.episodesWatchedAll/st.totalEpisodesAll*100):0;
              const projPctAll=st.totalEpisodesAll?Math.round(projWAll/st.totalEpisodesAll*100):0;
              const outPctAll=st.totalEpisodesAll?Math.round(st.episodesOutAll/st.totalEpisodesAll*100):0;
              const pctS=st.episodesInCurrentSeason?Math.round(st.episodesWatchedInCurrentSeason/st.episodesInCurrentSeason*100):0;
              const projPctS=st.episodesInCurrentSeason?Math.round(projWIS/st.episodesInCurrentSeason*100):0;
              const outPctS=st.episodesInCurrentSeason?Math.round(st.episodesOutInCurrentSeason/st.episodesInCurrentSeason*100):0;
              const isExp=expandedShow===show.id, isDragging=dragId===show.id, isDragOver=dragOverId===show.id;
              return (
                <div key={show.id} className={`card${isDragOver?" drag-over":""}`}
                  draggable onDragStart={()=>setDragId(show.id)}
                  onDragEnd={()=>{if(dragId&&dragOverId)reorderShows(dragId,dragOverId);setDragId(null);setDragOverId(null);}}
                  onDragOver={e=>{e.preventDefault();setDragOverId(show.id);}} onDragLeave={()=>setDragOverId(null)}
                  style={{ background:"#0f0f18",border:"1px solid #1e1e2e",borderRadius:"14px",boxShadow:"0 4px 20px rgba(0,0,0,.4)",opacity:isDragging?0.45:1,cursor:"grab",transition:"opacity .15s" }}>
                  <div style={{ display:"flex",gap:"14px",padding:"14px" }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"7px" }}>
                        <div style={{ flex:1,paddingRight:"8px" }}>
                          <div style={{ display:"flex",gap:"5px",marginBottom:"4px",flexWrap:"wrap" }}>
                            <span style={{ background:color+"22",color,fontSize:"10px",padding:"2px 7px",borderRadius:"10px",fontFamily:ff,fontWeight:500,border:`1px solid ${color}44` }}>{ds}</span>
                            {show.genre&&<span style={{ background:(GC[show.genre]||"#6366f1")+"22",color:GC[show.genre]||"#6366f1",fontSize:"10px",padding:"2px 7px",borderRadius:"10px",fontFamily:ff,border:`1px solid ${(GC[show.genre]||"#6366f1")}44` }}>{show.genre}</span>}
                            {isMS&&<span style={{ background:"#ffffff08",color:"#6666aa",fontSize:"10px",padding:"2px 7px",borderRadius:"10px",fontFamily:ff,border:"1px solid #2a2a3a" }}>{st.totalSeasons}S</span>}
                          </div>
                          <h3 style={{ fontFamily:pf,fontSize:"16px",fontWeight:700,color:"#f0f0ff",lineHeight:1.2 }}>{show.emoji&&<span style={{marginRight:"6px"}}>{show.emoji}</span>}{show.title}</h3>
                          {show.service&&<p style={{ color:"#5a5a7a",fontSize:"12px",fontFamily:ff,marginTop:"2px" }}>{show.service}</p>}
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"5px",flexShrink:0 }}>
                          {show.rating>0&&<div style={{ color:"#fbbf24",fontSize:"11px" }}>{"★".repeat(show.rating)}{"☆".repeat(5-show.rating)}</div>}
                          <div style={{ display:"flex",gap:"5px" }}>
                            <button onClick={()=>openEdit(show)} style={{ background:"#1e1e2e",color:"#8888aa",padding:"4px 9px",borderRadius:"7px",fontSize:"11px",fontFamily:ff }}>Edit</button>
                            <button className="delbtn" onClick={()=>del(show.id)} style={{ background:"#2a1a1a",color:"#ef4444",padding:"4px 9px",borderRadius:"7px",fontSize:"11px",fontFamily:ff }}>✕</button>
                          </div>
                        </div>
                      </div>
                      {isMS&&ds!=="Completed"&&(
                        <div style={{ background:"#13131e",border:"1px solid #2a2a3a",borderRadius:"9px",padding:"9px 11px",marginBottom:"8px" }}>
                          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px" }}>
                            <span style={{ fontFamily:ff,fontSize:"11px",fontWeight:500,color }}>Season {st.currentSeasonNum}</span>
                            <span style={{ fontFamily:ff,fontSize:"11px",color:"#5a5a7a" }}>Ep {st.episodesWatchedInCurrentSeason}{hasProj&&<span style={{ color:color+"99" }}>→{projWIS}</span>}/{st.episodesInCurrentSeason}{st.episodesOutInCurrentSeason<st.episodesInCurrentSeason&&<span style={{ color:"#3a3a5a" }}> ({st.episodesOutInCurrentSeason} out)</span>}</span>
                          </div>
                          <div style={{ background:"#1a1a28",borderRadius:"3px",height:"4px",overflow:"hidden",position:"relative" }}>
                            <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${outPctS}%`,background:color+"25",borderRadius:"3px" }}/>
                            {hasProj&&<div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${projPctS}%`,background:color+"44",borderRadius:"3px" }}/>}
                            <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${pctS}%`,background:`linear-gradient(90deg,${color},${color}bb)`,borderRadius:"3px" }}/>
                          </div>
                        </div>
                      )}
                      {st.totalEpisodesAll>0&&(
                        <div style={{ marginBottom:"8px" }}>
                          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"3px" }}>
                            <span style={{ color:"#5a5a7a",fontSize:"10px",fontFamily:ff }}>{isMS?"Overall":""}</span>
                            <span style={{ color:"#8888aa",fontSize:"11px",fontFamily:ff }}>{st.episodesWatchedAll}{hasProj&&<span style={{ color:color+"88" }}>→{projWAll}</span>}/{st.totalEpisodesAll} <span style={{ color:"#4a4a6a" }}>{pctAll}%{hasProj&&<span style={{ color:color+"66" }}>→{projPctAll}%</span>}</span></span>
                          </div>
                          <div style={{ background:"#1a1a28",borderRadius:"3px",height:"3px",overflow:"hidden",position:"relative" }}>
                            <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${outPctAll}%`,background:color+"25",borderRadius:"3px" }}/>
                            {hasProj&&<div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${projPctAll}%`,background:color+"44",borderRadius:"3px" }}/>}
                            <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${pctAll}%`,background:`linear-gradient(90deg,${color},${color}bb)`,borderRadius:"3px" }}/>
                          </div>
                        </div>
                      )}
                      <button onClick={()=>setExpandedShow(isExp?null:show.id)} style={{ background:"none",color:"#3a3a5a",fontSize:"11px",fontFamily:ff,padding:"2px 0" }}>{isExp?"▲ less":"▼ more"}</button>
                      {isExp&&(
                        <div style={{ marginTop:"8px",display:"flex",gap:"10px",flexWrap:"wrap" }}>
                          {show.airDays?.length>0&&<span style={{ color:"#5a5a7a",fontSize:"11px",fontFamily:ff }}>📡 {show.airDays.join(", ")}</span>}
                          {show.watchDays?.length>0&&<span style={{ color:"#5a5a7a",fontSize:"11px",fontFamily:ff }}>📅 {show.watchDays.join(", ")}</span>}
                          {show.notes&&<p style={{ color:"#4a4a6a",fontSize:"11px",fontFamily:ff,fontStyle:"italic",width:"100%" }}>"{show.notes}"</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length===0&&<div style={{ textAlign:"center",padding:"60px 20px",color:"#3a3a5a",fontFamily:ff }}><div style={{ fontSize:"40px",marginBottom:"12px" }}>📺</div><div>No shows yet!</div></div>}
          </div>
        </>}

        {/* ── SCHEDULE ── */}
        {tab==="schedule"&&<div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"10px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
              <button onClick={()=>setWeekOffset(w=>w-1)} style={{ background:"#1a1a28",color:"#8888aa",border:"1px solid #2a2a3a",padding:"7px 13px",borderRadius:"8px",fontSize:"16px" }}>‹</button>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:pf,fontSize:"15px",fontWeight:700,color:"#f0f0ff" }}>{fmtMonth(weekStart)}</div>
                <div style={{ fontFamily:ff,fontSize:"11px",color:"#5a5a7a",marginTop:"1px" }}>{isCurrentWeek?"This week":weekOffset===1?"Next week":weekOffset===-1?"Last week":`${weekOffset>0?"+":""}${weekOffset}w`}</div>
              </div>
              <button onClick={()=>setWeekOffset(w=>w+1)} style={{ background:"#1a1a28",color:"#8888aa",border:"1px solid #2a2a3a",padding:"7px 13px",borderRadius:"8px",fontSize:"16px" }}>›</button>
              {weekOffset!==0&&<button onClick={()=>setWeekOffset(0)} style={{ background:"#6366f122",color:"#a5b4fc",border:"1px solid #6366f144",padding:"5px 12px",borderRadius:"8px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>Today</button>}
            </div>
            <button onClick={()=>setShowPrefPanel(x=>!x)} style={{ background:showPrefPanel?"#6366f122":"#1a1a28",color:showPrefPanel?"#a5b4fc":"#8888aa",border:`1px solid ${showPrefPanel?"#6366f144":"#2a2a3a"}`,padding:"7px 14px",borderRadius:"8px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>⚙ Settings</button>
          </div>
          {showPrefPanel&&<div style={{ background:"#0f0f18",border:"1px solid #2a2a3a",borderRadius:"14px",padding:"18px",marginBottom:"16px" }}>
            <h3 style={{ fontFamily:pf,fontSize:"15px",color:"#f0f0ff",marginBottom:"14px" }}>Schedule Preferences</h3>
            <div style={{ marginBottom:"16px" }}>
              <label style={LS}>🚫 Days Off</label>
              <div style={{ display:"flex",gap:"6px",flexWrap:"wrap" }}>
                {DAYS.map(d=><button key={d} onClick={()=>toggleOff(d)} style={{ background:prefs.offDays.includes(d)?"#ef444422":"#1a1a28",color:prefs.offDays.includes(d)?"#ef4444":"#8888aa",border:`1px solid ${prefs.offDays.includes(d)?"#ef444444":"#2a2a3a"}`,padding:"5px 12px",borderRadius:"7px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>{prefs.offDays.includes(d)?"✕ ":""}{d}</button>)}
              </div>
            </div>
            <label style={LS}>⏱ Minutes Available Per Day</label>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:"8px" }}>
              {DAYS.map(d=>{ const isOff=prefs.offDays.includes(d),mins=prefs.minutesPerDay[d]??90; return (
                <div key={d} style={{ background:"#13131e",border:"1px solid #1e1e2e",borderRadius:"9px",padding:"10px",opacity:isOff?.45:1 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"7px" }}><span style={{ fontFamily:ff,fontSize:"12px",fontWeight:500,color:"#c0c0d8" }}>{d}</span><span style={{ fontFamily:ff,fontSize:"12px",color:"#6366f1",fontWeight:500 }}>{isOff?"Off":`${mins}m`}</span></div>
                  <input type="range" min="0" max="300" step="15" value={mins} disabled={isOff} onChange={e=>setMins(d,e.target.value)}/>
                </div>
              ); })}
            </div>
          </div>}
          <div style={{ background:"#0f0f18",border:"1px solid #1e1e2e",borderRadius:"14px",overflow:"hidden" }}>
            {DAYS.map((day,dayIdx)=>{
              const {items,date,usedMins}=sched[day]||{items:[],date:addDays(weekStart,dayIdx),usedMins:0};
              const isOff=prefs.offDays.includes(day), maxM=prefs.minutesPerDay[day]??90;
              const fp=maxM>0?Math.min(100,Math.round(usedMins/maxM*100)):0;
              const isToday=isCurrentWeek&&dayIdx===todayDayIdx, isPast=isCurrentWeek&&dayIdx<todayDayIdx;
              const checkable=items.filter(i=>!i.isUnreleased);
              const allDone=checkable.length>0&&checkable.every(i=>watchedEps[i.key]);
              return (
                <div key={day} style={{ borderBottom:dayIdx<6?"1px solid #1a1a28":"none",opacity:isOff?.45:1,
                  background:allDone&&!isPast?"#091209":"transparent" }}>
                  <div style={{ display:"flex",alignItems:"center",padding:"10px 14px",
                    background:allDone&&!isPast?"#0c180c":isToday?"#131820":"transparent",gap:"12px" }}>
                    <div style={{ minWidth:"100px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                        <span style={{ fontFamily:pf,fontSize:"14px",fontWeight:700,color:allDone&&!isPast?"#4ade80":isToday?"#a5b4fc":isPast?"#3a3a5a":"#f0f0ff" }}>{FULL_DAYS[dayIdx].slice(0,3)}</span>
                        {isToday&&!allDone&&<span style={{ background:"#6366f133",color:"#a5b4fc",fontSize:"9px",padding:"1px 6px",borderRadius:"8px",fontFamily:ff,fontWeight:600 }}>TODAY</span>}
                        {isPast&&<span style={{ color:"#2a2a3a",fontSize:"9px",fontFamily:ff }}>PAST</span>}
                        {allDone&&!isPast&&<span style={{ background:"#4ade8022",color:"#4ade80",fontSize:"9px",padding:"1px 7px",borderRadius:"8px",fontFamily:ff,fontWeight:600 }}>✓ DONE</span>}
                      </div>
                      <div style={{ fontFamily:ff,fontSize:"11px",color:"#3a3a4a",marginTop:"1px" }}>{fmtDate(date)}</div>
                    </div>
                    {isPast?<span style={{ fontFamily:ff,fontSize:"11px",color:"#2a2a3a" }}>Nothing scheduled</span>
                    :!isOff&&maxM>0?<div style={{ flex:1 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"3px" }}>
                        <span style={{ fontFamily:ff,fontSize:"10px",color:"#3a3a5a" }}>{usedMins}m / {maxM}m</span>
                        {allDone&&<span style={{ fontFamily:ff,fontSize:"10px",color:"#4ade80",fontWeight:500 }}>All watched 🎉</span>}
                      </div>
                      <div style={{ background:"#1a1a28",borderRadius:"3px",height:"3px",overflow:"hidden" }}>
                        <div style={{ height:"100%",width:`${fp}%`,background:allDone?"#4ade80":fp>=90?"#ef4444":fp>=60?"#fbbf24":"#4ade80",borderRadius:"3px",transition:"width .3s" }}/>
                      </div>
                    </div>:<span style={{ fontFamily:ff,fontSize:"11px",color:"#3a3a5a" }}>{isOff?"Day off":"Free"}</span>}
                  </div>
                  {!isPast&&items.length>0&&(
                    <div style={{ padding:"0 14px 10px",display:"flex",flexDirection:"column",gap:"5px" }}>
                      {items.map(item=>{
                        const {show,key,episodeNum,seasonNum,epLength,isNewAirday,isPinned,isAuto,isUnreleased}=item;
                        const watched=!isUnreleased&&!!watchedEps[key];
                        const sc2=SC[show.status]||"#6366f1";
                        const isMS2=show.multiSeason&&show.seasons&&show.seasons.length>1;
                        const curS=isMS2?(show.seasons[seasonNum-1]||{}):null;
                        const epMax=isMS2?(curS.totalEpisodes||"?"):(show.totalEpisodes||"?");
                        return (
                          <div key={key} className="ep-row" onClick={()=>{if(!isUnreleased)toggleWatched(key,show);}}
                            style={{ display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"9px",
                              background:isUnreleased?"#0d0d18":watched?"#0c160c":"#13131e",
                              border:`1px solid ${isUnreleased?"#fbbf2418":watched?"#4ade8028":isNewAirday?"#fbbf2430":sc2+"20"}`,
                              borderLeft:`3px solid ${isUnreleased?"#fbbf2466":watched?"#4ade80":isNewAirday?"#fbbf24":sc2}`,
                              cursor:isUnreleased?"default":"pointer",opacity:isUnreleased?.7:1 }}>

                            <div style={{ width:"18px",height:"18px",borderRadius:"5px",flexShrink:0,
                              border:`2px solid ${isUnreleased?"#fbbf2444":watched?"#4ade80":sc2+"55"}`,
                              background:isUnreleased?"transparent":watched?"#4ade8018":"transparent",
                              display:"flex",alignItems:"center",justifyContent:"center" }}>
                              {watched&&<span style={{ color:"#4ade80",fontSize:"11px",fontWeight:700 }}>✓</span>}
                              {isUnreleased&&<span style={{ color:"#fbbf24",fontSize:"10px" }}>🔒</span>}
                            </div>
                            <div style={{ flex:1,minWidth:0,opacity:watched?.65:1 }}>
                              <div style={{ fontFamily:ff,fontSize:"12px",fontWeight:500,color:isUnreleased?"#8888aa":watched?"#4a7a4a":"#e0e0f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{show.emoji&&<span style={{marginRight:"5px"}}>{show.emoji}</span>}{show.title}</div>
                              <div style={{ display:"flex",gap:"8px",alignItems:"center",marginTop:"2px",flexWrap:"wrap" }}>
                                <span style={{ fontFamily:ff,fontSize:"10px",color:watched?"#3a5a3a":isUnreleased?"#6a6a4a":"#6888aa" }}>
                                  {isMS2&&<span style={{ color:watched?"#3a5a3a":"#4a4a7a" }}>S{seasonNum} </span>}
                                  Ep <span style={{ color:isUnreleased?"#fbbf24":watched?"#4ade80":sc2,fontWeight:600 }}>{episodeNum}</span>
                                  <span style={{ color:"#3a3a5a" }}> / {epMax}</span>
                                </span>
                                <span style={{ fontFamily:ff,fontSize:"10px",color:"#3a3a5a" }}>{epLength}m</span>
                                {isUnreleased&&<span style={{ background:"#fbbf2415",color:"#fbbf24",fontSize:"9px",padding:"1px 6px",borderRadius:"8px",fontFamily:ff,fontWeight:500,border:"1px solid #fbbf2428" }}>📡 Drops {day}</span>}
                                {!isUnreleased&&isNewAirday&&<span style={{ background:"#fbbf2415",color:"#fbbf24",fontSize:"9px",padding:"1px 6px",borderRadius:"8px",fontFamily:ff,fontWeight:500,border:"1px solid #fbbf2428" }}>📡 NEW</span>}
                                {!isUnreleased&&isPinned&&!isNewAirday&&<span style={{ color:"#4a4a6a",fontSize:"9px",fontFamily:ff }}>📌</span>}
                                {!isUnreleased&&isAuto&&<span style={{ color:"#3a3a5a",fontSize:"9px",fontFamily:ff }}>✦</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isPast&&items.length===0&&!isOff&&<div style={{ padding:"4px 14px 10px",fontFamily:ff,fontSize:"11px",color:"#2a2a3a" }}>Free</div>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:"12px",display:"flex",gap:"16px",flexWrap:"wrap" }}>
            {[["📡 NEW","#fbbf24","New ep airs"],["📌","#4a4a6a","Pinned"],["✦","#3a3a5a","Auto-filled"],["✓ DONE","#4ade80","All watched"]].map(([icon,c,l])=>(
              <div key={l} style={{ display:"flex",alignItems:"center",gap:"5px" }}><span style={{ color:c,fontSize:"11px" }}>{icon}</span><span style={{ color:"#4a4a6a",fontSize:"11px",fontFamily:ff }}>{l}</span></div>
            ))}
          </div>
          <div style={{ marginTop:"14px",background:"#0f0f18",border:"1px solid #1e1e2e",borderRadius:"12px",padding:"16px",display:"flex",gap:"24px",flexWrap:"wrap" }}>
            {[[(weekMins/60).toFixed(1),"hrs/week","#a5b4fc"],[shows.filter(s=>s.status==="Watching").length,"active","#4ade80"],
              [shows.reduce((a,s)=>{const st=computedStats(s,watchedEps);return a+Math.max(0,st.episodesOutAll-st.episodesWatchedAll)},0),"available now","#60a5fa"],
              [shows.reduce((a,s)=>{const st=computedStats(s,watchedEps);return a+Math.max(0,st.totalEpisodesAll-st.episodesWatchedAll)},0),"total remaining","#fb7185"]
            ].map(([v,l,c])=>(
              <div key={l}><div style={{ fontFamily:pf,fontSize:"20px",fontWeight:700,color:c }}>{v}</div><div style={{ color:"#5a5a7a",fontSize:"11px",fontFamily:ff }}>{l}</div></div>
            ))}
          </div>
        </div>}

        {/* ── STATS ── */}
        {tab==="stats"&&<div style={{ display:"flex",flexDirection:"column",gap:"14px" }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:"10px" }}>
            {Object.entries(SC).map(([status,color])=>(
              <div key={status} style={{ background:"#0f0f18",border:"1px solid #1e1e2e",borderRadius:"12px",padding:"16px" }}>
                <div style={{ fontFamily:pf,fontSize:"26px",fontWeight:700,color }}>{shows.filter(s=>(computedStats(s,watchedEps).displayStatus||s.status)===status).length}</div>
                <div style={{ color:"#5a5a7a",fontSize:"12px",fontFamily:ff }}>{status}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#0f0f18",border:"1px solid #1e1e2e",borderRadius:"12px",padding:"18px" }}>
            <h3 style={{ fontFamily:pf,fontSize:"15px",marginBottom:"14px",color:"#f0f0ff" }}>Progress Overview</h3>
            <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
              {shows.map(show=>{
                const st=computedStats(show,watchedEps), color=SC[st.displayStatus||show.status];
                const isMS=show.multiSeason&&show.seasons&&show.seasons.length>1;
                const pctAll=st.totalEpisodesAll?Math.round(st.episodesWatchedAll/st.totalEpisodesAll*100):0;
                const outPctAll=st.totalEpisodesAll?Math.round(st.episodesOutAll/st.totalEpisodesAll*100):0;
                return (
                  <div key={show.id} style={{ display:"flex",gap:"12px",alignItems:"center" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"4px" }}>
                        <span style={{ fontFamily:ff,fontSize:"13px",color:"#c0c0d8" }}>{show.emoji&&<span style={{marginRight:"5px"}}>{show.emoji}</span>}{show.title}{isMS&&<span style={{ color:"#4a4a7a",fontSize:"11px" }}> S{st.currentSeasonNum}/{st.totalSeasons}</span>}</span>
                        <span style={{ fontFamily:ff,fontSize:"12px",color:"#5a5a7a" }}>{st.episodesWatchedAll}/{st.totalEpisodesAll}</span>
                      </div>
                      <div style={{ background:"#1a1a28",borderRadius:"4px",height:"6px",overflow:"hidden",position:"relative" }}>
                        <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${outPctAll}%`,background:color+"33",borderRadius:"4px" }}/>
                        <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${pctAll}%`,background:`linear-gradient(90deg,${color},${color}99)`,borderRadius:"4px" }}/>
                      </div>
                      {isMS&&<div style={{ display:"flex",gap:"2px",marginTop:"4px" }}>{show.seasons.map((s,i)=>{const sNum=i+1,isDone=sNum<st.currentSeasonNum,isCur=sNum===st.currentSeasonNum;return <div key={i} title={`S${sNum}`} style={{ flex:s.totalEpisodes,height:"3px",background:isDone?color:isCur?color+"66":"#1a1a28",borderRadius:"2px" }}/>;})}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background:"#0f0f18",border:"1px solid #1e1e2e",borderRadius:"12px",padding:"18px" }}>
            <h3 style={{ fontFamily:pf,fontSize:"15px",marginBottom:"14px",color:"#f0f0ff" }}>Time to Finish</h3>
            <div style={{ display:"flex",flexDirection:"column",gap:"9px" }}>
              {shows.filter(s=>(computedStats(s,watchedEps).displayStatus||s.status)!=="Completed").map(show=>{
                const st=computedStats(show,watchedEps);
                const rem=st.totalEpisodesAll-st.episodesWatchedAll, avail=Math.max(0,st.episodesOutAll-st.episodesWatchedAll);
                const hrs=(rem*st.episodeLength/60).toFixed(1);
                return (
                  <div key={show.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",background:"#13131e",borderRadius:"8px" }}>
                    <div style={{ display:"flex",gap:"10px",alignItems:"center" }}>
                      <div>
                        <div style={{ fontFamily:ff,fontSize:"13px",color:"#c0c0d8" }}>{show.emoji&&<span style={{marginRight:"5px"}}>{show.emoji}</span>}{show.title}</div>
                        <div style={{ fontFamily:ff,fontSize:"11px",color:"#5a5a7a" }}>{rem} ep left{avail>0&&<span style={{ color:"#60a5fa" }}> · {avail} available now</span>}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily:pf,fontSize:"17px",fontWeight:700,color:"#a5b4fc" }}>{hrs}h</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>}
      </div>

      {/* MODAL */}
      <Modal show={showModal} onClose={()=>setShowModal(false)}>
        <h2 style={{ fontFamily:pf,fontSize:"20px",fontWeight:700,color:"#f0f0ff",marginBottom:"18px" }}>{editId?"Edit Show":"Add Show"}</h2>
        <div style={{ display:"flex",flexDirection:"column",gap:"14px" }}>
          <div style={{ display:"grid",gridTemplateColumns:"80px 1fr",gap:"10px",alignItems:"end" }}>
            <div><label style={LS}>Emoji</label><input value={form.emoji||""} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="🎬" style={{...IS,fontSize:"22px",textAlign:"center",padding:"8px 6px"}}/></div>
            <div><label style={LS}>Show Title *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. The Bear" style={IS}/></div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" }}>
            <div><label style={LS}>Genre</label><select value={form.genre} onChange={e=>setForm(f=>({...f,genre:e.target.value}))} style={IS}><option value="">Select...</option>{GENRES.map(g=><option key={g}>{g}</option>)}</select></div>
            <div><label style={LS}>Service</label><select value={form.service} onChange={e=>setForm(f=>({...f,service:e.target.value}))} style={IS}><option value="">Select...</option>{SERVICES.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label style={LS}>Status</label>
            <div style={{ display:"flex",gap:"7px",flexWrap:"wrap" }}>
              {Object.keys(SC).map(s=><button key={s} onClick={()=>setForm(f=>({...f,status:s}))} style={{ background:form.status===s?SC[s]+"33":"#1a1a28",color:form.status===s?SC[s]:"#5a5a7a",border:`1px solid ${form.status===s?SC[s]:"#2a2a3a"}`,padding:"5px 12px",borderRadius:"8px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>{s}</button>)}
            </div>
          </div>
          <div style={{ background:"#13131e",border:"1px solid #2a2a3a",borderRadius:"10px",padding:"12px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div><div style={{ fontFamily:ff,fontSize:"13px",fontWeight:500,color:"#c0c0d8" }}>Multi-Season Show</div><div style={{ fontFamily:ff,fontSize:"11px",color:"#5a5a7a",marginTop:"1px" }}>Different episode counts per season</div></div>
              <button onClick={()=>setForm(f=>({...f,multiSeason:!f.multiSeason}))} style={{ background:form.multiSeason?"#6366f1":"#2a2a3a",color:"#fff",padding:"5px 14px",borderRadius:"20px",fontSize:"12px",fontFamily:ff,fontWeight:500,minWidth:"48px" }}>{form.multiSeason?"ON":"OFF"}</button>
            </div>
          </div>
          {!form.multiSeason&&<div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" }}>
            <div><label style={LS}>Total Episodes</label><input type="number" min="0" value={form.totalEpisodes} onChange={e=>setForm(f=>({...f,totalEpisodes:e.target.value}))} placeholder="10" style={IS}/></div>
            <div><label style={LS}>Episodes Out</label><input type="number" min="0" value={form.episodesOut} onChange={e=>setForm(f=>({...f,episodesOut:e.target.value}))} placeholder="blank = all" style={IS}/></div>
            <div><label style={LS}>Episodes Watched</label><input type="number" min="0" value={form.episodesWatched} onChange={e=>setForm(f=>({...f,episodesWatched:e.target.value}))} placeholder="0" style={IS}/></div>
            <div><label style={LS}>Mins / Episode</label><input type="number" min="0" value={form.episodeLength} onChange={e=>setForm(f=>({...f,episodeLength:e.target.value}))} placeholder="45" style={IS}/></div>
          </div>}
          {form.multiSeason&&<div>
            <label style={LS}>Seasons</label>
            <div style={{ display:"flex",flexDirection:"column",gap:"7px" }}>
              {form.seasons.map((s,i)=>(
                <div key={i} style={{ background:"#13131e",border:"1px solid #1e1e2e",borderRadius:"9px",padding:"11px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"9px" }}>
                    <span style={{ fontFamily:ff,fontSize:"12px",fontWeight:500,color:"#a5b4fc" }}>Season {i+1}</span>
                    {form.seasons.length>1&&<button onClick={()=>setForm(f=>({...f,seasons:f.seasons.filter((_,idx)=>idx!==i)}))} style={{ background:"#2a1a1a",color:"#ef4444",padding:"2px 7px",borderRadius:"5px",fontSize:"10px",fontFamily:ff }}>Remove</button>}
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"7px" }}>
                    <div><label style={{...LS,fontSize:"10px"}}>Total Eps</label><input type="number" min="0" value={s.totalEpisodes} onChange={e=>setForm(f=>({...f,seasons:f.seasons.map((ss,idx)=>idx===i?{...ss,totalEpisodes:e.target.value}:ss)}))} placeholder="10" style={{...IS,padding:"7px 9px",fontSize:"12px"}}/></div>
                    <div><label style={{...LS,fontSize:"10px"}}>Eps Out</label><input type="number" min="0" value={s.episodesOut} onChange={e=>setForm(f=>({...f,seasons:f.seasons.map((ss,idx)=>idx===i?{...ss,episodesOut:e.target.value}:ss)}))} placeholder="all" style={{...IS,padding:"7px 9px",fontSize:"12px"}}/></div>
                    <div><label style={{...LS,fontSize:"10px"}}>Mins/Ep</label><input type="number" min="0" value={s.episodeLength} onChange={e=>setForm(f=>({...f,seasons:f.seasons.map((ss,idx)=>idx===i?{...ss,episodeLength:e.target.value}:ss)}))} placeholder="45" style={{...IS,padding:"7px 9px",fontSize:"12px"}}/></div>
                  </div>
                </div>
              ))}
              <button onClick={()=>setForm(f=>({...f,seasons:[...f.seasons,{...DSEASON}]}))} style={{ background:"#1a1a28",color:"#6366f1",border:"1px dashed #6366f144",padding:"7px",borderRadius:"8px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>+ Add Season</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginTop:"10px" }}>
              <div><label style={LS}>Currently on Season</label><select value={form.currentSeason} onChange={e=>setForm(f=>({...f,currentSeason:parseInt(e.target.value),episodesWatchedInSeason:""}))} style={IS}>{form.seasons.map((_,i)=><option key={i} value={i+1}>Season {i+1}</option>)}</select></div>
              <div><label style={LS}>Episodes Watched (this season)</label><input type="number" min="0" value={form.episodesWatchedInSeason} onChange={e=>setForm(f=>({...f,episodesWatchedInSeason:e.target.value}))} placeholder="0" style={IS}/></div>
            </div>
          </div>}
          <div><label style={LS}>📡 New Episodes Air On</label>
            <div style={{ display:"flex",gap:"5px",flexWrap:"wrap" }}>
              {DAYS.map(d=><button key={d} onClick={()=>toggleFDay(d,"airDays")} style={{ background:form.airDays.includes(d)?"#fbbf2422":"#1a1a28",color:form.airDays.includes(d)?"#fbbf24":"#5a5a7a",border:`1px solid ${form.airDays.includes(d)?"#fbbf2444":"#2a2a3a"}`,padding:"5px 11px",borderRadius:"7px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>{d}</button>)}
            </div>
          </div>
          <div><label style={LS}>📅 Pin to Watch Days <span style={{ color:"#3a3a5a",fontSize:"10px",textTransform:"none",letterSpacing:0 }}>(optional — blank = auto)</span></label>
            <div style={{ display:"flex",gap:"5px",flexWrap:"wrap" }}>
              {DAYS.map(d=><button key={d} onClick={()=>toggleFDay(d,"watchDays")} style={{ background:form.watchDays.includes(d)?"#6366f122":"#1a1a28",color:form.watchDays.includes(d)?"#a5b4fc":"#5a5a7a",border:`1px solid ${form.watchDays.includes(d)?"#6366f144":"#2a2a3a"}`,padding:"5px 11px",borderRadius:"7px",fontSize:"12px",fontFamily:ff,fontWeight:500 }}>{d}</button>)}
            </div>
          </div>
          <div><label style={LS}>Rating</label>
            <div style={{ display:"flex",gap:"3px" }}>
              {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setForm(f=>({...f,rating:f.rating===n?0:n}))} style={{ background:"none",fontSize:"22px",color:n<=form.rating?"#fbbf24":"#2a2a3a",padding:"0 2px" }}>★</button>)}
            </div>
          </div>
          <div><label style={LS}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes..." rows={2} style={{...IS,resize:"vertical"}}/></div>
          <div style={{ display:"flex",gap:"9px",marginTop:"2px" }}>
            <button onClick={save} style={{ flex:1,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"11px",borderRadius:"10px",fontFamily:ff,fontWeight:500,fontSize:"14px" }}>{editId?"Save Changes":"Add Show"}</button>
            <button onClick={()=>setShowModal(false)} style={{ background:"#1a1a28",color:"#8888aa",padding:"11px 18px",borderRadius:"10px",fontFamily:ff,fontSize:"14px" }}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}