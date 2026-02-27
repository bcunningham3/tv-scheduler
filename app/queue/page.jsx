"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { supabase } from "../../lib/supabaseClient";

const DEFAULT_PREFS = { offDays:["Sun"], minutesPerDay:{ Mon:90,Tue:60,Wed:60,Thu:60,Fri:90,Sat:120,Sun:0 }, soloMins:{ Mon:60,Tue:45,Wed:45,Thu:45,Fri:60,Sat:75,Sun:0 }, togetherMins:{ Mon:30,Tue:15,Wed:15,Thu:15,Fri:30,Sat:45,Sun:0 } };

function normalizePrefs(p) {
  const src = p && typeof p === "object" ? p : {};

  // Start with defaults
  const merged = {
    ...DEFAULT_PREFS,
    ...src,
    minutesPerDay: { ...DEFAULT_PREFS.minutesPerDay, ...(src.minutesPerDay || {}) },
    soloMins: { ...DEFAULT_PREFS.soloMins, ...(src.soloMins || {}) },
    togetherMins: { ...DEFAULT_PREFS.togetherMins, ...(src.togetherMins || {}) },
    offDays: Array.isArray(src.offDays) ? src.offDays : DEFAULT_PREFS.offDays,
  };

  // Migration: if an older cloud/local prefs object only has minutesPerDay,
  // generate soloMins/togetherMins from it (65/35 split)
  const missingSolo = !src.soloMins || Object.keys(src.soloMins || {}).length === 0;
  const missingTogether = !src.togetherMins || Object.keys(src.togetherMins || {}).length === 0;

  if ((missingSolo && missingTogether) && src.minutesPerDay) {
    const solo = {};
    const together = {};
    DAYS.forEach(d => {
      const max = Number(src.minutesPerDay?.[d] ?? DEFAULT_PREFS.minutesPerDay[d] ?? 0);
      const s = Math.round(max * 0.65);
      solo[d] = s;
      together[d] = Math.max(0, max - s);
    });
    merged.soloMins = solo;
    merged.togetherMins = together;
  }

  return merged;
}

function normalizeShows(arr) {
  const list = Array.isArray(arr) ? arr : [];
  return list.map(s => {
    const vm = (s.viewingMode || "solo").toString().toLowerCase(); // normalize "Solo"/"Together"
    return {
      ...s,
      viewingMode: vm === "together" ? "together" : "solo",
      airDays: Array.isArray(s.airDays) ? s.airDays : [],
      watchDays: Array.isArray(s.watchDays) ? s.watchDays : [],
    };
  });
}

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
  { id:1, title:"The Last of Us", emoji:"🍄", genre:"Drama", service:"HBO Max", status:"Watching", viewingMode:"together", multiSeason:true,
    seasons:[{totalEpisodes:9,episodesOut:7,episodeLength:60},{totalEpisodes:7,episodesOut:0,episodeLength:60}],
    currentSeason:1, episodesWatchedInSeason:5, airDays:["Sun"], watchDays:["Mon","Tue"], notes:"Amazing show", rating:5, sortOrder:0 },
  { id:2, title:"Silo", emoji:"🏚️", genre:"Sci-Fi", service:"Apple TV+", status:"Watching", viewingMode:"solo", multiSeason:false,
    totalEpisodes:10, episodesOut:6, episodesWatched:3, episodeLength:50, airDays:["Fri"], watchDays:[], notes:"", rating:4, sortOrder:1 },
  { id:3, title:"The Wire", emoji:"🔫", genre:"Drama", service:"HBO Max", status:"Upcoming", viewingMode:"solo", multiSeason:true,
    seasons:[{totalEpisodes:13,episodesOut:13,episodeLength:58},{totalEpisodes:12,episodesOut:12,episodeLength:58},{totalEpisodes:12,episodesOut:12,episodeLength:58},{totalEpisodes:13,episodesOut:13,episodeLength:58},{totalEpisodes:10,episodesOut:10,episodeLength:58}],
    currentSeason:1, episodesWatchedInSeason:0, airDays:[], watchDays:[], notes:"Been meaning to watch forever", rating:0, sortOrder:2 },
];

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

function buildSchedule(shows, prefs, weekStart, today, startingEpOverride, watchedEps, skippedDays) {
  const { offDays, minutesPerDay, soloMins, togetherMins } = prefs;
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
  DAYS.forEach((day, i) => { sched[day] = { items: [], date: addDays(weekStart, i), usedMins: 0 }; });

  // Carryover queues for preferred-day shows that couldn't fit on their preferred day
  let carrySolo = [];
  let carryTogether = [];
// Only allow ONE "rolled-forward air-day placeholder" per show per week
const weekPlaceholderUsed = new Set();

  DAYS.forEach((day, i) => {
    const dayDate = addDays(weekStart, i);
    if (today && dayDate < today) return;
    if (offDays.includes(day)) return;
    if (skippedDays && skippedDays.has(day)) return; // pulled forward — skip this day

    const maxM = minutesPerDay[day] ?? 90;

    // Use per-mode budgets exactly as configured.
    // Only fall back to a split if BOTH modes are missing/empty for this day.
    const rawSolo = soloMins ? (soloMins[day] ?? null) : null;
    const rawTogether = togetherMins ? (togetherMins[day] ?? null) : null;

    const hasSolo = rawSolo !== null;
    const hasTogether = rawTogether !== null;

    let soloBudget, togetherBudget;
    if (!hasSolo && !hasTogether) {
      soloBudget = Math.round(maxM * 0.65);
      togetherBudget = Math.round(maxM * 0.35);
    } else {
      soloBudget = hasSolo ? Number(rawSolo) : 0;
      togetherBudget = hasTogether ? Number(rawTogether) : 0;
    }

    // Pull in anything that couldn't fit on prior days
    const queuedSolo = carrySolo.slice();
    const queuedTogether = carryTogether.slice();
    carrySolo = [];
    carryTogether = [];

    const items = [];
    let soloUsed = 0;
    let togetherUsed = 0;
    const placed = new Set();

    const dayIdx = DAYS.indexOf(day);
    const dayFull = dayIdx >= 0 ? FULL_DAYS[dayIdx] : day;

    // Preferred today = pinned via watchDays OR it's an air day (release day)
    const preferredToday = active.filter(s => {
      const wd = s.watchDays || [];
      const ad = s.airDays || [];
      const preferredByWatchDay = wd.includes(day) || wd.includes(dayFull);
      const preferredByAirDay = ad.includes(day) || ad.includes(dayFull);
      return preferredByWatchDay || preferredByAirDay;
    });

    // Auto shows = no watchDays set
    const autoShows = active.filter(s => !s.watchDays || s.watchDays.length === 0);

    // Sort so true air-day shows get first dibs on the day they release
    const byAirDay = (a, b) => {
      const aIsAir = (a.airDays || []).includes(day) || (a.airDays || []).includes(dayFull);
      const bIsAir = (b.airDays || []).includes(day) || (b.airDays || []).includes(dayFull);
      return (aIsAir ? 0 : 1) - (bIsAir ? 0 : 1);
    };
    preferredToday.sort(byAirDay);
    autoShows.sort(byAirDay);

    // Returns true if placed OR nothing to schedule; false if it wanted to schedule but couldn't fit today
    const placeShow = (show, flags) => {
      if (placed.has(show.id)) return true;

      const st = showStats(show);
      const len = st.episodeLength || 45;

      const isTogether = show.viewingMode === "together";
      const modeBudget = isTogether ? togetherBudget : soloBudget;
      if (modeBudget <= 0) return false;

      const modeUsed = isTogether ? togetherUsed : soloUsed;
      const remaining = modeBudget - modeUsed;
      if (remaining < len) return false;

      const isAirDay = (show.airDays || []).includes(day) || (show.airDays || []).includes(dayFull);

      const { ep: startEp, season, maxEp } = nextEp[show.id];
      if (maxEp === 0 || startEp > maxEp) return true;

      const releasedMax = st.episodesOutInCurrentSeason;
      const availableReleased = Math.max(0, releasedMax - startEp + 1);

      let count = 0;

      if (availableReleased > 0) {
        const slots = Math.floor(remaining / Math.max(len, 1));
        count = Math.min(slots, maxEp - startEp + 1);
      } else {
  // If we don't have confirmed released episodes (episodesOutInCurrentSeason not updated),
  // allow the "new ep" placeholder to roll forward for the rest of the week after the air day.
  const airIdx = (() => {
    const ad = show.airDays || [];
    for (let di = 0; di < 7; di++) {
      const d = DAYS[di];
      const df = FULL_DAYS[di];
      if (ad.includes(d) || ad.includes(df)) return di;
    }
    return -1;
  })();

  const hasAiredThisWeek = airIdx >= 0 && i >= airIdx;

  if (hasAiredThisWeek) {
    count = 1;
  } else {
    return true;
  }
}

      if (count <= 0) return false;

      for (let ii = 0; ii < count; ii++) {
        const epNum = startEp + ii;
        const key = `${show.id}:s${season}e${epNum}`;
     const assumedReleased = (() => {
  const ad = show.airDays || [];
  let airIdx = -1;
  for (let di = 0; di < 7; di++) {
    const d = DAYS[di];
    const df = FULL_DAYS[di];
    if (ad.includes(d) || ad.includes(df)) { airIdx = di; break; }
  }
  return airIdx >= 0 && i > airIdx; // after the air day, assume it's released
})();

const isUnreleased = (epNum > releasedMax) && !isAirDay;

items.push({
  show,
  key,
  episodeNum: epNum,
  seasonNum: season,
  epLength: len,
  isNewAirday: isAirDay && ii === 0,
  isUnreleased,
  isTogether,
  ...flags
});
      }

      if (isTogether) togetherUsed += len * count;
      else soloUsed += len * count;

      nextEp[show.id] = { ...nextEp[show.id], ep: startEp + count };
      placed.add(show.id);
      return true;
    };

    // 1) Place carryovers first (so preferred items roll forward)
    queuedSolo.forEach(s => {
      const ok = placeShow(s, { isPinned: true });
      if (!ok) carrySolo.push(s);
    });
    queuedTogether.forEach(s => {
      const ok = placeShow(s, { isPinned: true });
      if (!ok) carryTogether.push(s);
    });

    // 2) Try preferred shows for today; if they can't fit, roll them forward
    preferredToday.forEach(s => {
      if (placed.has(s.id)) return;
      const ok = placeShow(s, { isPinned: true });
      if (!ok) {
        if (s.viewingMode === "together") carryTogether.push(s);
        else carrySolo.push(s);
      }
    });

    // 3) Fill remaining time with auto shows
    autoShows.forEach(s => {
      if (placed.has(s.id)) return;
      placeShow(s, { isAuto: true });
    });

    // Sort items: solo first, then together
    items.sort((a, b) => (a.isTogether ? 1 : 0) - (b.isTogether ? 1 : 0));

    const dayUsedMins = soloUsed + togetherUsed;
    sched[day].items = items;
    sched[day].usedMins = dayUsedMins;
    sched[day].soloUsed = soloUsed;
    sched[day].togetherUsed = togetherUsed;
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
const DFORM = { title:"", emoji:"", genre:"", service:"", status:"Watching", viewingMode:"solo", multiSeason:false,
  totalEpisodes:"", episodesOut:"", episodesWatched:"", episodeLength:"",
  seasons:[{...DSEASON}], currentSeason:1, episodesWatchedInSeason:"", airDays:[], watchDays:[], notes:"", rating:0 };

export default function App() {
  const [shows, setShows] = useState(() => {
  try {
    const s = localStorage.getItem("tvq-shows");
    if (s) return normalizeShows(JSON.parse(s));
  } catch {}
  return normalizeShows(DEFAULT_SHOWS);
});

const [prefs, setPrefs] = useState(() => {
  try {
    const p = localStorage.getItem("tvq-prefs");
    if (p) return normalizePrefs(JSON.parse(p));
  } catch {}
  return normalizePrefs(DEFAULT_PREFS);
});
  const [watchedEps, setWatchedEps] = useState(() => { try{const w=localStorage.getItem("tvq-watched");if(w)return JSON.parse(w);}catch{}return {}; });
  const [pulledDays, setPulledDays] = useState(new Set()); // days that have been pulled forward
  useEffect(()=>{ try{localStorage.setItem("tvq-shows",JSON.stringify(shows));}catch{} },[shows]);
  useEffect(()=>{ try{localStorage.setItem("tvq-prefs",JSON.stringify(prefs));}catch{} },[prefs]);
  useEffect(()=>{ try{localStorage.setItem("tvq-watched",JSON.stringify(watchedEps));}catch{} },[watchedEps]);

  // ── Supabase auth + cloud sync ──
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("signup"); // signup | login | magic
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // Prevent cloud-save from immediately overwriting cloud data before we load it.
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setCloudHydrated(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;

  const signUp = async () => {
    if (!authEmail || !authPassword) { setAuthMsg("Enter email + password."); return; }
    setAuthBusy(true); setAuthMsg("");
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
      options: { emailRedirectTo: `${window.location.origin}/queue` },
    });
    setAuthBusy(false);
    setAuthMsg(error ? error.message : "Account created. Check your email to confirm (if required), then log in.");
  };

  const signIn = async () => {
    if (!authEmail || !authPassword) { setAuthMsg("Enter email + password."); return; }
    setAuthBusy(true); setAuthMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setAuthBusy(false);
    setAuthMsg(error ? error.message : "");
  };

  const magicLink = async () => {
    if (!authEmail) { setAuthMsg("Enter your email."); return; }
    setAuthBusy(true); setAuthMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: `${window.location.origin}/queue` },
    });
    setAuthBusy(false);
    setAuthMsg(error ? error.message : "Check your email for the login link.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Load from cloud once after login
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("tvq_state")
        .select("shows,prefs,watched")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Cloud load failed:", error);
        setCloudHydrated(true); // allow saving anyway
        return;
      }

      if (data?.shows) setShows(normalizeShows(data.shows));
if (data?.prefs) setPrefs(normalizePrefs(data.prefs));
if (data?.watched) setWatchedEps(data.watched);

      setCloudHydrated(true);
    })();
  }, [userId]);

  // Save to cloud (debounced) when local state changes
  useEffect(() => {
    if (!userId || !cloudHydrated) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const payload = {
        user_id: userId,
        shows,
        prefs,
        watched: watchedEps,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("tvq_state")
        .upsert(payload, { onConflict: "user_id" });

      if (error) console.error("Cloud save failed:", error);
    }, 600);

    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [userId, cloudHydrated, shows, prefs, watchedEps]);


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

  // Pull forward: mark the NEXT day as skipped so buildSchedule shifts its episodes to today
  const pullForward = (day) => {
    const dayIdx = DAYS.indexOf(day);
    if (dayIdx < 0) return;
    let nextIdx = dayIdx + 1;
    while (nextIdx < DAYS.length && prefs.offDays.includes(DAYS[nextIdx])) nextIdx++;
    if (nextIdx >= DAYS.length) return;
    const nextDay = DAYS[nextIdx];
    // Skip the next day so its episodes roll into today via buildSchedule
    setPulledDays(prev => new Set([...prev, nextDay]));
  };

  const { sched, projectedEp } = useMemo(() => {
    const todayWeekStart = getWeekStart(today);
    if (weekOffset <= 0) return buildSchedule(shows, prefs, weekStart, isCurrentWeek?today:null, null, watchedEps, pulledDays);
    let result = buildSchedule(shows, prefs, todayWeekStart, today, null, watchedEps, pulledDays);
    for (let w=1; w<=weekOffset; w++) result = buildSchedule(shows, prefs, addDays(todayWeekStart,w*7), null, result.projectedEp, {});
    return result;
  }, [shows, prefs, weekStart, weekOffset, today, isCurrentWeek, watchedEps, pulledDays]);

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


  const del = id=>setShows(s=>s.filter(x=>x.id!==id));
  const toggleFDay = (day,field)=>setForm(f=>({...f,[field]:f[field].includes(day)?f[field].filter(d=>d!==day):[...f[field],day]}));
  const toggleOff = day=>setPrefs(p=>{const isOff=p.offDays.includes(day);const offDays=isOff?p.offDays.filter(d=>d!==day):[...p.offDays,day];const mpd={...p.minutesPerDay};if(!isOff)mpd[day]=0;else if(mpd[day]===0)mpd[day]=60;return{...p,offDays,minutesPerDay:mpd};});
  const setMins=(day,v)=>setPrefs(p=>({...p,minutesPerDay:{...p.minutesPerDay,[day]:parseInt(v)||0}}));

  const filtered = useMemo(()=>{
    const base=filter==="All"?shows:shows.filter(s=>s.status===filter);
    return [...base].sort((a,b)=>(a.sortOrder??9999)-(b.sortOrder??9999));
  },[shows,filter]);

  // ── Login screen ──
  if (!session) return (
    <div style={{ minHeight:"100vh",background:"#050508",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",position:"relative",overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}input{outline:none}button{cursor:pointer;border:none}
        .login-input:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.15)!important}
        @keyframes floatup{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
        .login-card{animation:floatup .5s ease forwards}
      `}</style>
      <div style={{ position:"absolute",top:"-20%",left:"50%",transform:"translateX(-50%)",width:"600px",height:"600px",background:"radial-gradient(ellipse,rgba(99,102,241,0.12) 0%,transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ position:"absolute",bottom:"-10%",right:"-10%",width:"400px",height:"400px",background:"radial-gradient(ellipse,rgba(168,85,247,0.08) 0%,transparent 70%)",pointerEvents:"none" }}/>
      <div className="login-card" style={{ width:"100%",maxWidth:"420px",position:"relative",zIndex:1 }}>
        <div style={{ textAlign:"center",marginBottom:"44px" }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:"10px",marginBottom:"12px" }}>
            <div style={{ width:"42px",height:"42px",borderRadius:"12px",background:"linear-gradient(135deg,#6366f1,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(99,102,241,0.4)" }}>
              <span style={{ fontSize:"20px" }}>▶</span>
            </div>
            <h1 style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:"38px",fontWeight:700,letterSpacing:"-1.5px",background:"linear-gradient(135deg,#c7d2fe,#e879f9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>NextUp</h1>
          </div>
          <p style={{ fontFamily:"'DM Sans',sans-serif",fontSize:"14px",color:"#4a4a6a" }}>Track what to watch, when to watch it.</p>
        </div>
        <div style={{ background:"rgba(15,15,24,0.95)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"24px",padding:"36px 32px",boxShadow:"0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(99,102,241,0.08)",backdropFilter:"blur(20px)" }}>
          <div style={{ display:"flex",gap:"6px",marginBottom:"24px",background:"#0a0a12",borderRadius:"12px",padding:"4px" }}>
            {[["login","Sign in"],["signup","Create account"]].map(([m,l])=>(
              <button key={m} onClick={()=>{setAuthMode(m);setAuthMsg("");}}
                style={{ flex:1,padding:"8px",borderRadius:"9px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:500,transition:"all .15s",
                  background:authMode===m?"linear-gradient(135deg,#6366f1,#a855f7)":"transparent",
                  color:authMode===m?"#fff":"#5a5a8a",boxShadow:authMode===m?"0 2px 8px rgba(99,102,241,0.3)":"none" }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:"14px" }}>
            <div>
              <label style={{ display:"block",fontFamily:"'DM Sans',sans-serif",fontSize:"11px",color:"#5a5a8a",fontWeight:500,letterSpacing:"0.7px",textTransform:"uppercase",marginBottom:"8px" }}>Email</label>
              <input className="login-input" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?signIn():signUp())}
                placeholder="you@example.com"
                style={{ width:"100%",background:"#0a0a12",border:"1px solid #1e1e30",borderRadius:"12px",color:"#e0e0f0",padding:"13px 16px",fontSize:"14px",fontFamily:"'DM Sans',sans-serif",transition:"border-color .2s,box-shadow .2s" }}/>
            </div>
            <div>
              <label style={{ display:"block",fontFamily:"'DM Sans',sans-serif",fontSize:"11px",color:"#5a5a8a",fontWeight:500,letterSpacing:"0.7px",textTransform:"uppercase",marginBottom:"8px" }}>Password</label>
              <input className="login-input" type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?signIn():signUp())}
                placeholder="••••••••"
                style={{ width:"100%",background:"#0a0a12",border:"1px solid #1e1e30",borderRadius:"12px",color:"#e0e0f0",padding:"13px 16px",fontSize:"14px",fontFamily:"'DM Sans',sans-serif",transition:"border-color .2s,box-shadow .2s" }}/>
            </div>
            {authMsg&&(
              <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"10px 14px",borderRadius:"10px",background:authMsg.includes("Check")||authMsg.includes("created")?"#0c2010":"#1a0c0c",border:`1px solid ${authMsg.includes("Check")||authMsg.includes("created")?"#4ade8030":"#ef444430"}` }}>
                <p style={{ fontFamily:"'DM Sans',sans-serif",fontSize:"13px",color:authMsg.includes("Check")||authMsg.includes("created")?"#4ade80":"#f87171" }}>{authMsg}</p>
              </div>
            )}
            <button disabled={authBusy||!authEmail||!authPassword}
              onClick={()=>authMode==="login"?signIn():signUp()}
              style={{ width:"100%",background:authBusy?"#1a1a2a":"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",padding:"14px",borderRadius:"12px",fontFamily:"'Space Grotesk',sans-serif",fontSize:"15px",fontWeight:600,letterSpacing:"-0.2px",opacity:authBusy?.5:1,boxShadow:authBusy?"none":"0 8px 24px rgba(99,102,241,0.35)",marginTop:"4px",transition:"opacity .2s" }}>
              {authBusy?"Working…":authMode==="login"?"Sign in →":"Create account →"}
            </button>
            <div style={{ borderTop:"1px solid #1a1a28",paddingTop:"14px",display:"flex",flexDirection:"column",alignItems:"center",gap:"10px" }}>
              <button onClick={()=>setAuthMode(authMode==="login"?"signup":"login")}
                style={{ background:"none",color:"#3a3a5a",fontFamily:"'DM Sans',sans-serif",fontSize:"12px",padding:"4px" }}>
                {authMode==="login"?"Don't have an account? Sign up":"Already have an account? Sign in"}
              </button>
              <button onClick={()=>setSession("guest")}
                style={{ width:"100%",background:"transparent",color:"#6a6a8a",border:"1px solid #1e1e30",padding:"12px",borderRadius:"12px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:500,transition:"all .15s" }}>
                Continue as Guest
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
      <div style={{ background:"linear-gradient(180deg,rgba(15,15,24,0.98),rgba(7,7,13,0.98))",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",flexWrap:"wrap",position:"sticky",top:0,zIndex:50 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
          <div style={{ width:"32px",height:"32px",borderRadius:"9px",background:"linear-gradient(135deg,#6366f1,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(99,102,241,0.4)",flexShrink:0 }}>
            <span style={{ fontSize:"15px",lineHeight:1 }}>▶</span>
          </div>
          <div>
            <h1 style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:"22px",fontWeight:700,letterSpacing:"-0.8px",lineHeight:1,background:"linear-gradient(135deg,#c7d2fe,#e879f9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>NextUp</h1>
            <p style={{ color:"#3a3a5a",fontSize:"11px",marginTop:"2px",fontFamily:ff }}>{shows.filter(s=>s.status==="Watching").length} watching · {(weekMins/60).toFixed(1)}h this week</p>
          </div>
        </div>
        <div style={{ display:"flex",gap:"7px",alignItems:"center",flexWrap:"wrap" }}>
          <button onClick={signOut} style={{ background:"rgba(255,255,255,0.04)",color:"#5a5a7a",border:"1px solid rgba(255,255,255,0.07)",padding:"8px 13px",borderRadius:"10px",fontFamily:ff,fontSize:"12px" }}>Sign out</button>
          <button onClick={openAdd} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"9px 18px",borderRadius:"10px",fontFamily:ff,fontWeight:600,fontSize:"13px",boxShadow:"0 4px 16px rgba(99,102,241,.35)",whiteSpace:"nowrap",letterSpacing:"-0.1px" }}>+ Add Show</button>
        </div>
      </div>

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
                            {show.viewingMode==="together"?<span style={{ background:"#f472b622",color:"#f472b6",fontSize:"10px",padding:"2px 7px",borderRadius:"10px",fontFamily:ff,border:"1px solid #f472b644" }}>❤️ Together</span>:<span style={{ background:"#6366f122",color:"#a5b4fc",fontSize:"10px",padding:"2px 7px",borderRadius:"10px",fontFamily:ff,border:"1px solid #6366f144" }}>🎧 Solo</span>}
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
            <div style={{ display:"flex",flexDirection:"column",gap:"16px",marginTop:"4px" }}>
              {[["solo","🎧 Solo time","soloMins","#6366f1"],["together","❤️ Together time","togetherMins","#f472b6"]].map(([mode,label,key,col])=>(
                <div key={mode}>
                  <label style={{...LS,color:col,marginBottom:"8px"}}>{label}</label>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:"8px" }}>
                    {DAYS.map(d=>{ const isOff=prefs.offDays.includes(d),mins=(prefs[key]||{})[d]??0; return (
                      <div key={d} style={{ background:"#13131e",border:`1px solid ${col}22`,borderRadius:"9px",padding:"10px",opacity:isOff?.45:1 }}>
                        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"7px" }}><span style={{ fontFamily:ff,fontSize:"12px",fontWeight:500,color:"#c0c0d8" }}>{d}</span><span style={{ fontFamily:ff,fontSize:"12px",color:col,fontWeight:500 }}>{isOff?"Off":`${mins}m`}</span></div>
                        <input type="range" min="0" max="240" step="15" value={mins} disabled={isOff} onChange={e=>setPrefs(p=>({...p,[key]:{...(p[key]||{}),[d]:parseInt(e.target.value)||0}}))}
                          style={{"--thumb-color":col}}/>
                      </div>
                    ); })}
                  </div>
                </div>
              ))}
            </div>
          </div>}
          <div style={{ background:"#0f0f18",border:"1px solid #1e1e2e",borderRadius:"14px",overflow:"hidden" }}>
            {DAYS.map((day,dayIdx)=>{
              const {items,date,usedMins,soloUsed,togetherUsed}=sched[day]||{items:[],date:addDays(weekStart,dayIdx),usedMins:0,soloUsed:0,togetherUsed:0};
              const soloBudget=(prefs.soloMins||{})[day]??0;
              const togetherBudget=(prefs.togetherMins||{})[day]??0;
              const isOff=prefs.offDays.includes(day);
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
                        {allDone&&!isPast&&isCurrentWeek&&dayIdx<6&&(()=>{
                          let ni=dayIdx+1;while(ni<DAYS.length&&prefs.offDays.includes(DAYS[ni]))ni++;
                          const hasNext=ni<DAYS.length&&(sched[DAYS[ni]]?.items||[]).some(i=>!i.isUnreleased);
                          const nextDay2=DAYS[ni];
          return hasNext&&!pulledDays.has(nextDay2)?<button onClick={e=>{e.stopPropagation();pullForward(day);}} style={{ background:"linear-gradient(135deg,#6366f133,#a855f722)",color:"#a5b4fc",border:"1px solid #6366f144",fontSize:"9px",padding:"2px 8px",borderRadius:"8px",fontFamily:ff,fontWeight:600,cursor:"pointer" }}>▶▶ Pull forward</button>:null;
                        })()}
                      </div>
                      <div style={{ fontFamily:ff,fontSize:"11px",color:"#3a3a4a",marginTop:"1px" }}>{fmtDate(date)}</div>
                    </div>
                    {isPast?<span style={{ fontFamily:ff,fontSize:"11px",color:"#2a2a3a" }}>Nothing scheduled</span>
                :!isOff&&(soloBudget>0||togetherBudget>0)?<div style={{ flex:1,display:"flex",flexDirection:"column",gap:"4px" }}>
                      {allDone&&<span style={{ fontFamily:ff,fontSize:"10px",color:"#4ade80",fontWeight:500,marginBottom:"2px" }}>All watched 🎉</span>}
                      {soloBudget>0&&<div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                        <span style={{ fontFamily:ff,fontSize:"9px",color:"#6366f1",fontWeight:500,width:"12px" }}>🎧</span>
                        <div style={{ flex:1,background:"#1a1a28",borderRadius:"3px",height:"3px",overflow:"hidden" }}>
                          <div style={{ height:"100%",width:`${Math.min(100,Math.round(soloUsed/Math.max(soloBudget,1)*100))}%`,background:allDone?"#4ade80":"#6366f1",borderRadius:"3px",transition:"width .3s" }}/>
                        </div>
                        <span style={{ fontFamily:ff,fontSize:"9px",color:"#3a3a5a",minWidth:"50px",textAlign:"right" }}>{soloUsed}m/{soloBudget}m</span>
                      </div>}
                      {togetherBudget>0&&<div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                        <span style={{ fontFamily:ff,fontSize:"9px",color:"#f472b6",fontWeight:500,width:"12px" }}>❤️</span>
                        <div style={{ flex:1,background:"#1a1a28",borderRadius:"3px",height:"3px",overflow:"hidden" }}>
                          <div style={{ height:"100%",width:`${Math.min(100,Math.round(togetherUsed/Math.max(togetherBudget,1)*100))}%`,background:allDone?"#4ade80":"#f472b6",borderRadius:"3px",transition:"width .3s" }}/>
                        </div>
                        <span style={{ fontFamily:ff,fontSize:"9px",color:"#3a3a5a",minWidth:"50px",textAlign:"right" }}>{togetherUsed}m/{togetherBudget}m</span>
                      </div>}
                    </div>:<span style={{ fontFamily:ff,fontSize:"11px",color:"#3a3a5a" }}>{isOff?"Day off":"Free"}</span>}
                  </div>
                  {!isPast&&items.length>0&&(
                    <div style={{ padding:"0 14px 10px",display:"flex",flexDirection:"column",gap:"5px" }}>
                      {items.map((item,itemIdx)=>{
                        const {show,key,episodeNum,seasonNum,epLength,isNewAirday,isPinned,isAuto,isUnreleased,isTogether,isPulledForward}=item;
                        const prevItem=items[itemIdx-1];
                        const showDivider=itemIdx>0&&isTogether&&!prevItem.isTogether;
                        const watched=!isUnreleased&&!!watchedEps[key];
                        const sc2=SC[show.status]||"#6366f1";
                        const isMS2=show.multiSeason&&show.seasons&&show.seasons.length>1;
                        const curS=isMS2?(show.seasons[seasonNum-1]||{}):null;
                        const epMax=isMS2?(curS.totalEpisodes||"?"):(show.totalEpisodes||"?");
                        return (
                          <Fragment key={key}>
                          {showDivider&&<div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"4px 0 2px" }}>
                            <div style={{ flex:1,height:"1px",background:"#f472b622" }}/>
                            <span style={{ fontFamily:ff,fontSize:"9px",color:"#f472b6",fontWeight:600,letterSpacing:"0.5px" }}>❤️ TOGETHER</span>
                            <div style={{ flex:1,height:"1px",background:"#f472b622" }}/>
                          </div>}
                          <div className="ep-row" onClick={()=>{if(!isUnreleased)toggleWatched(key,show);}}
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
                                {isPulledForward&&<span style={{ background:"#6366f115",color:"#a5b4fc",fontSize:"9px",padding:"1px 6px",borderRadius:"8px",fontFamily:ff,fontWeight:500,border:"1px solid #6366f130" }}>▶▶ pulled</span>}
                              </div>
                            </div>
                          </div>
                          </Fragment>
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
          <div style={{ background:"#13131e",border:"1px solid #2a2a3a",borderRadius:"10px",padding:"12px" }}>
            <label style={LS}>Viewing Mode</label>
            <div style={{ display:"flex",gap:"7px",marginTop:"4px" }}>
              {[["solo","🎧 Solo","#6366f1"],["together","❤️ Together","#f472b6"]].map(([m,l,col])=>(
                <button key={m} onClick={()=>setForm(f=>({...f,viewingMode:m}))}
                  style={{ flex:1,background:form.viewingMode===m?col+"22":"#1a1a28",color:form.viewingMode===m?col:"#5a5a7a",border:`1px solid ${form.viewingMode===m?col+"66":"#2a2a3a"}`,padding:"8px 12px",borderRadius:"9px",fontSize:"13px",fontFamily:ff,fontWeight:500 }}>{l}</button>
              ))}
            </div>
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
