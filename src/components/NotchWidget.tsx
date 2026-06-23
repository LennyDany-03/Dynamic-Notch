import React, { useEffect, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useHotzone } from "../hooks/useHotzone";
import { useMediaSession } from "../hooks/useMediaSession";
import { Music2, Play, Pause, SkipBack, SkipForward, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <div
    onClick={(e) => {
      e.stopPropagation();
      onChange();
    }}
    style={{
      width: "36px",
      height: "20px",
      borderRadius: "10px",
      background: checked ? "linear-gradient(90deg, var(--acc), var(--acc2))" : "rgba(255, 255, 255, 0.15)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      position: "relative",
      cursor: "pointer",
      transition: "background 0.3s ease",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: "#fff",
        position: "absolute",
        top: "2px",
        left: checked ? "18px" : "2px",
        transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
      }}
    />
  </div>
);

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

  // Settings states with localStorage persistence
  const [isOpaque, setIsOpaque] = useState(() => {
    return localStorage.getItem("notch_isOpaque") === "true";
  });
  const [bgOpacity, setBgOpacity] = useState(() => {
    const val = localStorage.getItem("notch_bgOpacity");
    return val ? parseFloat(val) : 0.75;
  });
  const [blurStrength, setBlurStrength] = useState(() => {
    const val = localStorage.getItem("notch_blurStrength");
    return val ? parseInt(val, 10) : 28;
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem("notch_isOpaque", String(isOpaque));
  }, [isOpaque]);

  useEffect(() => {
    localStorage.setItem("notch_bgOpacity", String(bgOpacity));
  }, [bgOpacity]);

  useEffect(() => {
    localStorage.setItem("notch_blurStrength", String(blurStrength));
  }, [blurStrength]);
  
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
          await win.setSize(new LogicalSize(560, 390));
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
    }, 300);
  };

  const onLeave = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    setHolding(false);
    setMode("idle");
    setShowSettings(false); // Reset settings panel on collapse
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
    expanded: [438, 340, 26]
  }[mode];
  const [w, hh, r] = dims;

  // Background and translucency styling variables
  const dynamicBackground = isOpaque
    ? "rgba(18, 18, 22, 1)"
    : "rgba(0, 0, 0, 0.02)"; // near-transparent; inner glass layer handles the look

  const dynamicBackdropFilter = isOpaque
    ? "none"
    : "blur(12px) saturate(160%)"; // bonus: blurs any OS content behind on supporting systems

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
                  background: dynamicBackground,
                  backdropFilter: dynamicBackdropFilter,
                  WebkitBackdropFilter: dynamicBackdropFilter,
                  border: "1px solid rgba(255,255,255,.15)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.2), inset 0 -1px 0 rgba(255,255,255,.06), 0 14px 50px rgba(0,0,0,.55)",
                  overflow: "hidden",
                  transition: "width .7s cubic-bezier(.34,1.45,.5,1), height .7s cubic-bezier(.34,1.45,.5,1), border-radius .5s ease",
                  animation: "breath 6s ease-in-out infinite",
                  animationPlayState: mode === "idle" ? "running" : "paused",
                }}
              >
                {/* ---- LIQUID GLASS BACKGROUND (only when not opaque) ---- */}
                {!isOpaque && (
                  <>
                    {/* Base dark translucent layer */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(160deg, rgba(24,20,40,${bgOpacity}) 0%, rgba(12,12,22,${bgOpacity * 0.93}) 100%)`,
                      }}
                    />
                    {/* Iridescent color blobs — blurred to create the liquid glass refraction */}
                    <div
                      style={{
                        position: "absolute",
                        top: "-30%",
                        left: "-20%",
                        right: "-20%",
                        bottom: "-30%",
                        background: `
                          radial-gradient(ellipse 55% 45% at 22% 5%, rgba(167,139,250,0.55) 0%, transparent 100%),
                          radial-gradient(ellipse 45% 40% at 80% 95%, rgba(96,165,250,0.45) 0%, transparent 100%),
                          radial-gradient(ellipse 38% 55% at 55% 45%, rgba(240,171,252,0.22) 0%, transparent 100%)
                        `,
                        filter: `blur(${Math.max(3, blurStrength * 0.65)}px)`,
                      }}
                    />
                    {/* Top specular highlight — simulates light catching the glass edge */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: "8%",
                        right: "8%",
                        height: "1.5px",
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.65) 30%, rgba(255,255,255,0.55) 70%, transparent)",
                      }}
                    />
                    {/* Subtle bottom rim */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: "20%",
                        right: "20%",
                        height: "1px",
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 50%, transparent)",
                      }}
                    />
                  </>
                )}

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
                    transition: holding ? "width 0.3s linear" : "width 0.15s ease",
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
                  <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: "16px", fontWeight: 600, letterSpacing: ".5px", fontVariantNumeric: "tabular-nums" }}>
                    {timeStr}
                  </span>

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
                    height: "340px",
                    padding: "14px 15px",
                    opacity: mode === "expanded" ? 1 : 0,
                    transition: "opacity .35s ease .05s",
                    pointerEvents: mode === "expanded" ? "auto" : "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  {/* Top center pill handle */}
                  <div style={{ width: "38px", height: "4px", borderRadius: "3px", background: "rgba(255,255,255,.28)", margin: "1px auto 2px" }} />

                  {/* Header Row with Settings toggle button */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "0 4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.2px", color: "rgba(255,255,255,.45)", textTransform: "uppercase" }}>
                      {showSettings ? "Settings" : "Now Playing"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettings(!showSettings);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                      <Settings
                        size={15}
                        color="rgba(255,255,255,0.6)"
                        style={{
                          transform: showSettings ? "rotate(45deg)" : "rotate(0deg)",
                          transition: "transform 0.3s ease",
                        }}
                      />
                    </button>
                  </div>

                  {/* Content: Music Hero OR Settings Panel with cross-fade transition */}
                  <div style={{ position: "relative", height: "154px" }}>
                    <AnimatePresence mode="wait">
                      {!showSettings ? (
                        <motion.div
                          key="music-hero"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            borderRadius: "18px",
                            padding: "12px",
                            background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.035))",
                            border: "1px solid rgba(255,255,255,.1)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
                            height: "154px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
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
                        </motion.div>
                      ) : (
                        <motion.div
                          key="settings-panel"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            borderRadius: "18px",
                            padding: "12px 16px",
                            background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.035))",
                            border: "1px solid rgba(255,255,255,.1)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
                            height: "154px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          {/* ROW 1: SOLID OPAQUE BACKGROUND */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "36px" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 700 }}>Opaque Background</span>
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>Disable glass translucency</span>
                            </div>
                            <Toggle checked={isOpaque} onChange={() => setIsOpaque(!isOpaque)} />
                          </div>

                          {/* ROW 2: OPACITY SLIDER */}
                          <div style={{ display: "flex", alignItems: "center", gap: "16px", height: "36px", opacity: isOpaque ? 0.4 : 1, transition: "opacity 0.2s" }}>
                            <div style={{ display: "flex", flexDirection: "column", width: "120px", flexShrink: 0 }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 700 }}>Opacity</span>
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{Math.round(bgOpacity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="0.98"
                              step="0.02"
                              value={bgOpacity}
                              disabled={isOpaque}
                              onChange={(e) => {
                                e.stopPropagation();
                                setBgOpacity(parseFloat(e.target.value));
                              }}
                              style={{ flex: 1 }}
                            />
                          </div>

                          {/* ROW 3: BLUR STRENGTH SLIDER */}
                          <div style={{ display: "flex", alignItems: "center", gap: "16px", height: "36px", opacity: isOpaque ? 0.4 : 1, transition: "opacity 0.2s" }}>
                            <div style={{ display: "flex", flexDirection: "column", width: "120px", flexShrink: 0 }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 700 }}>Blur Strength</span>
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{blurStrength}px</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="40"
                              step="1"
                              value={blurStrength}
                              disabled={isOpaque}
                              onChange={(e) => {
                                e.stopPropagation();
                                setBlurStrength(parseInt(e.target.value));
                              }}
                              style={{ flex: 1 }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
