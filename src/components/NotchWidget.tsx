import React, { useEffect, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useHotzone } from "../hooks/useHotzone";
import { useMediaSession } from "../hooks/useMediaSession";
import { Music2, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MOCK_TRACKS = [
  {
    title: "Midnight Pulse",
    artist: "Aurora Skye",
    albumArt: null,
  },
  {
    title: "Drifting Auroras",
    artist: "Lenny Dany",
    albumArt: null,
  }
];

export default function NotchWidget() {
  const [mode, setMode] = useState<"idle" | "peek" | "expanded">("idle");
  const [holding, setHolding] = useState(false);
  const [timerSec, setTimerSec] = useState(766); // 12m 46s
  const [now, setNow] = useState(new Date());
  
  // Simulated playback state for fallback if SMTC has nothing playing
  const [simIsPlaying, setSimIsPlaying] = useState(true);
  const [simProgressPercent, setSimProgressPercent] = useState(32);
  const [mockTrackIndex, setMockTrackIndex] = useState(0);

  // Notification state
  const [notification, setNotification] = useState({
    title: "Design Review · in 5 min",
    subtitle: "Calendar — Jump to the meeting room",
    iconBg: "linear-gradient(135deg,#4f46e5,#7c3aed)",
  });

  const { isOpen } = useHotzone(mode);
  const { track, isPlaying, progress, duration, playPause, next, prev, seek } = useMediaSession();

  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTitleRef = useRef<string | null>(null);

  // Keep track of time and update progress percent
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setTimerSec((s) => (s > 0 ? s - 1 : 900));

      if (!track && simIsPlaying) {
        setSimProgressPercent((p) => {
          const nextVal = p + 0.45;
          return nextVal > 100 ? 0 : nextVal;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [track, simIsPlaying]);

  // Handle auto-closing resetting mode to idle
  useEffect(() => {
    if (!isOpen) {
      setMode("idle");
      setHolding(false);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
    }
  }, [isOpen]);

  // Window resizing controller
  useEffect(() => {
    let active = true;
    const updateSize = async () => {
      try {
        const win = getCurrentWindow();
        if (mode === "expanded") {
          await win.setSize(new LogicalSize(560, 500));
        } else if (mode === "peek") {
          await win.setSize(new LogicalSize(560, 100));
        } else {
          // Add a short delay when collapsing to idle to prevent transition clipping
          const t = setTimeout(async () => {
            if (active && mode === "idle") {
              await win.setSize(new LogicalSize(560, 80));
            }
          }, 800);
          return () => clearTimeout(t);
        }
      } catch (err) {
        console.error("Window sizing error:", err);
      }
    };

    updateSize();
    return () => {
      active = false;
    };
  }, [mode]);

  // Helper trigger for peeking at a notification
  const triggerPeek = () => {
    if (mode === "expanded") return;
    if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);

    setMode("peek");
    peekTimeoutRef.current = setTimeout(() => {
      setMode((current) => (current === "peek" ? "idle" : current));
    }, 2800);
  };

  // Trigger simulated notification peek every 20 seconds for demo value
  useEffect(() => {
    const simulation = setInterval(() => {
      if (mode === "idle") {
        setNotification({
          title: "Design Review · in 5 min",
          subtitle: "Calendar — Jump to the meeting room",
          iconBg: "linear-gradient(135deg,#4f46e5,#7c3aed)",
        });
        triggerPeek();
      }
    }, 20000);
    return () => clearInterval(simulation);
  }, [mode]);

  // Peek on actual song changes
  useEffect(() => {
    if (track?.title && prevTitleRef.current !== track.title) {
      if (mode !== "expanded") {
        setNotification({
          title: track.title,
          subtitle: track.artist || "Unknown Artist",
          iconBg: "linear-gradient(135deg, var(--acc), var(--acc2) 52%, #60a5fa)",
        });
        triggerPeek();
      }
      prevTitleRef.current = track.title;
    }
  }, [track?.title, mode]);

  // Hover hold handlers
  const onEnter = () => {
    if (mode === "expanded") return;
    setHolding(true);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = setTimeout(() => {
      setMode("expanded");
      setHolding(false);
    }, 1500);
  };

  const onLeave = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    setHolding(false);
    setMode("idle");
  };

  // Media controls wrapper
  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track) {
      playPause();
    } else {
      setSimIsPlaying(!simIsPlaying);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track) {
      next();
    } else {
      setMockTrackIndex((i) => (i === 0 ? 1 : 0));
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track) {
      prev();
    } else {
      setMockTrackIndex((i) => (i === 0 ? 1 : 0));
    }
  };

  // Formatter for media timeline
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  // Live vs Fallback variables
  const activeTrackTitle = track?.title || MOCK_TRACKS[mockTrackIndex].title;
  const activeTrackArtist = track?.artist || MOCK_TRACKS[mockTrackIndex].artist;
  const activeIsPlaying = track ? isPlaying : simIsPlaying;
  const activeDuration = track && duration > 0 ? duration : 204000; // 3:24 fallback
  const activeProgress = track ? progress : (simProgressPercent / 100) * activeDuration;
  const progL = track && duration > 0 ? (progress / duration) * 100 : simProgressPercent;

  // Date styling variables
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  let h = now.getHours() % 12;
  if (h === 0) h = 12;
  const timeStr = h + ":" + String(now.getMinutes()).padStart(2, "0");
  const dateLong = days[now.getDay()] + ", " + months[now.getMonth()] + " " + now.getDate();
  const monthAbbr = months[now.getMonth()].slice(0, 3).toUpperCase();
  const dayNum = now.getDate();

  // Dimension mapping
  const dims = {
    idle: [224, 34, 17],
    peek: [348, 60, 24],
    expanded: [438, 464, 30]
  }[mode];
  const [w, hh, r] = dims;

  // Circle timer calculations
  const ts = Math.max(0, timerSec);
  const timerStr = Math.floor(ts / 60) + ":" + String(ts % 60).padStart(2, "0");
  const circExp = 2 * Math.PI * 34; // 213.63
  const ringOffset = (circExp * (1 - ts / 900)).toFixed(1);
  const circMini = 2 * Math.PI * 6; // 37.7
  const miniRingOffset = (circMini * (1 - ts / 900)).toFixed(2);

  const waveBars = [0, .3, .15, .45, .2, .5, .1, .35, .25, .4, .05, .3, .18, .42, .12, .48, .22, .38, .08, .28, .16, .44].map((v) => ({ d: v }));

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: "8px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "16px 30px 30px",
    cursor: "pointer",
    zIndex: 5,
    ["--acc" as any]: "#a78bfa",
    ["--acc2" as any]: "#f0abfc",
  };

  const isMusicNotif = notification.title === track?.title;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        background: "transparent",
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notch"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              background: "transparent"
            }}
          >
            <div
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              style={containerStyle}
            >
              <div
                style={{
                  position: "relative",
                  width: `${w}px`,
                  height: `${hh}px`,
                  borderRadius: `${r}px`,
                  background: "linear-gradient(180deg, rgba(255,255,255,.15), rgba(255,255,255,.055))",
                  backdropFilter: "blur(28px) saturate(175%)",
                  WebkitBackdropFilter: "blur(28px) saturate(175%)",
                  border: "1px solid rgba(255,255,255,.2)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), inset 0 -1px 0 rgba(255,255,255,.06), 0 14px 50px rgba(0,0,0,.55)",
                  overflow: "hidden",
                  transition: "width .7s cubic-bezier(.34,1.45,.5,1), height .7s cubic-bezier(.34,1.45,.5,1), border-radius .5s ease",
                  animation: "breath 6s ease-in-out infinite",
                  animationPlayState: mode === "idle" ? "running" : "paused",
                }}
              >
                {/* hold-to-expand progress */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    height: "2px",
                    width: holding ? "100%" : "0%",
                    background: "linear-gradient(90deg, var(--acc), var(--acc2))",
                    boxShadow: "0 0 8px var(--acc)",
                    transition: holding ? "width 1.5s linear" : "width 0.15s ease",
                    zIndex: 9,
                  }}
                />

                {/* ---- IDLE LAYER ---- */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 13px",
                    opacity: mode === "idle" ? 1 : 0,
                    transition: "opacity .3s ease",
                    pointerEvents: "none",
                  }}
                >
                  {/* left: music hint */}
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "5px",
                        background: "linear-gradient(135deg, var(--acc), var(--acc2) 55%, #60a5fa)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,.15) inset",
                      }}
                    />
                    <span style={{ display: "flex", alignItems: "flex-end", gap: "1.5px", height: "13px" }}>
                      {[0, 0.2, 0.35, 0.1].map((delay, idx) => (
                        <span
                          key={idx}
                          style={{
                            width: "2px",
                            height: "100%",
                            borderRadius: "2px",
                            background: "var(--acc)",
                            transformOrigin: "bottom",
                            animation: "wave .9s ease-in-out infinite",
                            animationDelay: `${delay}s`,
                            animationPlayState: activeIsPlaying ? "running" : "paused",
                          }}
                        />
                      ))}
                    </span>
                  </div>
                  {/* center: time */}
                  <span style={{ fontSize: "16px", fontWeight: 600, letterSpacing: ".5px", fontVariantNumeric: "tabular-nums" }}>
                    {timeStr}
                  </span>
                  {/* right: timer ring + notif dot */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="var(--acc)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={circMini}
                        strokeDashoffset={miniRingOffset}
                        style={{ transition: "stroke-dashoffset 0.5s ease" }}
                      />
                    </svg>
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#60a5fa",
                        boxShadow: "0 0 8px #60a5fa",
                        animation: "ringpulse 2.4s ease-in-out infinite",
                      }}
                    />
                  </div>
                </div>

                {/* ---- PEEK LAYER (notification) ---- */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "348px",
                    height: "60px",
                    display: "flex",
                    alignItems: "center",
                    gap: "11px",
                    padding: "0 16px",
                    opacity: mode === "peek" ? 1 : 0,
                    transition: "opacity .3s ease",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: notification.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                      boxShadow: "0 4px 12px rgba(79,70,229,.4)",
                    }}
                  >
                    {isMusicNotif ? (
                      <Music2 size={16} color="#fff" />
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff">
                        <path d="M4 4h16v12H7l-3 3z" />
                      </svg>
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12.5px", fontWeight: 700, letterSpacing: ".2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {notification.title}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {notification.subtitle}
                    </div>
                  </div>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--acc)", boxShadow: "0 0 10px var(--acc)", flex: "none" }} />
                </div>

                {/* ---- EXPANDED LAYER ---- */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "438px",
                    height: "464px",
                    padding: "14px 15px",
                    opacity: mode === "expanded" ? 1 : 0,
                    transition: "opacity .35s ease .05s",
                    pointerEvents: mode === "expanded" ? "auto" : "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  <div style={{ width: "38px", height: "4px", borderRadius: "3px", background: "rgba(255,255,255,.28)", margin: "1px auto 2px" }} />

                  {/* MUSIC HERO */}
                  <div
                    style={{
                      borderRadius: "18px",
                      padding: "12px",
                      background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.035))",
                      border: "1px solid rgba(255,255,255,.1)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "56px",
                          height: "56px",
                          borderRadius: "14px",
                          background: "linear-gradient(135deg, var(--acc), var(--acc2) 52%, #60a5fa)",
                          flex: "none",
                          boxShadow: "0 6px 18px rgba(167,139,250,.4), inset 0 1px 0 rgba(255,255,255,.4)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {track?.albumArt ? (
                          <img src={track.albumArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 60% at 30% 25%, rgba(255,255,255,.5), transparent 60%)" }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {activeTrackTitle}
                        </div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,.58)", fontWeight: 500 }}>
                          {activeTrackArtist}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          onClick={handlePrev}
                          style={{ background: "none", border: "none", padding: "6px", cursor: "pointer", display: "flex", borderRadius: "50%" }}
                        >
                          <SkipBack size={17} color="rgba(255,255,255,.85)" />
                        </button>
                        <button
                          onClick={handlePlayPause}
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            border: "none",
                            cursor: "pointer",
                            background: "linear-gradient(180deg,#fff,#e6dcff)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 14px rgba(167,139,250,.5), inset 0 1px 0 rgba(255,255,255,.8)",
                          }}
                        >
                          {activeIsPlaying ? (
                            <Pause size={15} color="#241046" />
                          ) : (
                            <Play size={15} color="#241046" style={{ transform: "translateX(1px)" }} />
                          )}
                        </button>
                        <button
                          onClick={handleNext}
                          style={{ background: "none", border: "none", padding: "6px", cursor: "pointer", display: "flex", borderRadius: "50%" }}
                        >
                          <SkipForward size={17} color="rgba(255,255,255,.85)" />
                        </button>
                      </div>
                    </div>
                    {/* waveform */}
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "26px", margin: "11px 2px 9px" }}>
                      {waveBars.map((bar, idx) => (
                        <span
                          key={idx}
                          style={{
                            flex: 1,
                            height: "100%",
                            borderRadius: "2px",
                            background: "linear-gradient(180deg, var(--acc), var(--acc2))",
                            transformOrigin: "bottom",
                            opacity: .85,
                            animation: "wave .95s ease-in-out infinite",
                            animationDelay: `${bar.d}s`,
                            animationPlayState: activeIsPlaying ? "running" : "paused",
                          }}
                        />
                      ))}
                    </div>
                    {/* progress */}
                    <div
                      onClick={(e) => {
                        if (activeDuration > 0) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const ratio = (e.clientX - rect.left) / rect.width;
                          seek(ratio * activeDuration);
                        }
                      }}
                      style={{
                        position: "relative",
                        height: "4px",
                        borderRadius: "3px",
                        background: "rgba(255,255,255,.16)",
                        margin: "0 2px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progL}%`, borderRadius: "3px", background: "linear-gradient(90deg,var(--acc),var(--acc2))" }} />
                      <div style={{ position: "absolute", top: "50%", left: `${progL}%`, width: "11px", height: "11px", borderRadius: "50%", background: "#fff", transform: "translate(-50%,-50%)", boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,.45)", margin: "6px 2px 0", fontVariantNumeric: "tabular-nums" }}>
                      <span>{formatTime(activeProgress)}</span>
                      <span>{formatTime(activeDuration)}</span>
                    </div>
                  </div>

                  {/* TILE ROW: calendar + timer */}
                  <div style={{ display: "flex", gap: "9px" }}>
                    {/* calendar */}
                    <div style={{ flex: 1.35, borderRadius: "16px", padding: "11px 12px", background: "linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03))", border: "1px solid rgba(255,255,255,.09)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "9.5px", fontWeight: 800, letterSpacing: "1.4px", color: "var(--acc)", textTransform: "uppercase" }}>Next up</span>
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "8px", padding: "3px 7px" }}>
                          <span style={{ fontSize: "8px", fontWeight: 800, letterSpacing: ".8px", color: "rgba(255,255,255,.55)" }}>{monthAbbr}</span>
                          <span style={{ fontSize: "14px", fontWeight: 700, marginTop: "1px" }}>{dayNum}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, marginTop: "7px", letterSpacing: "-.2px" }}>Design Review</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,.6)", marginTop: "2px", fontWeight: 500 }}>5:30 PM · <span style={{ color: "var(--acc2)" }}>in 25 min</span></div>
                      <div style={{ height: "1px", background: "rgba(255,255,255,.08)", margin: "9px 0 7px" }}></div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        <div style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "rgba(255,255,255,.5)", alignItems: "center" }}><span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#60a5fa" }}></span>6:15 Standup sync</div>
                        <div style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "rgba(255,255,255,.5)", alignItems: "center" }}><span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f0abfc" }}></span>7:00 Dinner — Mara</div>
                      </div>
                    </div>
                    {/* timer */}
                    <div style={{ flex: 1, borderRadius: "16px", padding: "11px", background: "linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03))", border: "1px solid rgba(255,255,255,.09)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <div style={{ position: "relative", width: "84px", height: "84px" }}>
                        <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="6"></circle>
                          <circle cx="42" cy="42" r="34" fill="none" stroke="var(--acc)" stroke-width="6" stroke-linecap="round" strokeDasharray={circExp} style={{ strokeDashoffset: ringOffset, transition: "stroke-dashoffset 1s linear", filter: "drop-shadow(0 0 5px rgba(167,139,250,.6))" }}></circle>
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 700, letterSpacing: "-.5px", fontVariantNumeric: "tabular-nums" }}>{timerStr}</div>
                      </div>
                      <span style={{ fontSize: "9.5px", fontWeight: 700, letterSpacing: "1.2px", color: "rgba(255,255,255,.5)", textTransform: "uppercase" }}>Focus</span>
                    </div>
                  </div>

                  {/* NOTIFICATIONS */}
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: "8px", right: "8px", top: "6px", height: "30px", borderRadius: "14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}></div>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", borderRadius: "14px", padding: "9px 11px", background: "linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.04))", border: "1px solid rgba(255,255,255,.1)" }}>
                      <span style={{ width: "30px", height: "30px", borderRadius: "9px", background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 3px 8px rgba(16,185,129,.35)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M4 5h16v10H7l-3 3z"></path></svg>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 700 }}>Team · #design</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,.58)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Reviewing the notch concept now 👀</div>
                      </div>
                      <span style={{ fontSize: "9.5px", fontWeight: 700, color: "rgba(255,255,255,.4)" }}>+2</span>
                    </div>
                  </div>

                  {/* FOOTER CLOCK */}
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "2px 4px 0" }}>
                    <div>
                      <div style={{ fontSize: "34px", fontWeight: 300, letterSpacing: "1px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{timeStr}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,.55)", fontWeight: 600, marginTop: "5px", letterSpacing: ".3px" }}>{dateLong}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700 }}>18° Clear</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,.5)", fontWeight: 600, marginTop: "3px" }}>Seattle</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
