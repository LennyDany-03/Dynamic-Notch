import { motion, AnimatePresence } from "framer-motion";
import { useHotzone } from "../hooks/useHotzone";
import { useMediaSession } from "../hooks/useMediaSession";
import { SkipBack, Play, Pause, SkipForward, Music2 } from "lucide-react";

const FONT = "'Segoe UI', -apple-system, sans-serif";

export default function NotchWidget() {
  const { isOpen } = useHotzone();
  const { track, isPlaying, progress, duration, playPause, next, prev, seek } =
    useMediaSession();

  const pct = duration > 0 ? Math.min((progress / duration) * 100, 100) : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "80px",
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
            initial={{ y: -80, opacity: 0, scale: 0.94 }}
            animate={{ y: 6, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.75 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
          >
            {/* Main pill */}
            <div
              style={{
                width: "500px",
                height: "62px",
                background: "linear-gradient(145deg, #18181d 0%, #111114 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "36px",
                display: "flex",
                alignItems: "center",
                padding: "0 16px 0 10px",
                gap: "10px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Album Art */}
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#1e1e24",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                {track?.albumArt ? (
                  <img
                    src={track.albumArt}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Music2 size={18} color="rgba(255,255,255,0.25)" />
                )}
              </div>

              {/* Track Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#f0f0f5",
                    fontFamily: FONT,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: "1.25",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {track?.title || "Nothing playing"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6e6e82",
                    fontFamily: FONT,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: "1.4",
                    marginTop: "1px",
                  }}
                >
                  {track?.artist || "—"}
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
                <CtrlBtn onClick={prev}>
                  <SkipBack size={14} />
                </CtrlBtn>

                {/* Play/Pause — accented */}
                <button
                  onClick={playPause}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "rgba(167,139,250,0.18)",
                    border: "1px solid rgba(167,139,250,0.3)",
                    color: "#c4b5fd",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    margin: "0 2px",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(167,139,250,0.28)";
                    e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(167,139,250,0.18)";
                    e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)";
                  }}
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                </button>

                <CtrlBtn onClick={next}>
                  <SkipForward size={14} />
                </CtrlBtn>
              </div>
            </div>

            {/* Progress bar — below pill */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - rect.left) / rect.width) * duration);
              }}
              style={{
                width: "480px",
                height: "3px",
                background: "rgba(255,255,255,0.07)",
                borderRadius: "2px",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #a78bfa, #c4b5fd)",
                  borderRadius: "2px",
                  transition: "width 1s linear",
                  boxShadow: "0 0 6px rgba(167,139,250,0.5)",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CtrlBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        background: "transparent",
        border: "none",
        color: "rgba(255,255,255,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        e.currentTarget.style.color = "rgba(255,255,255,0.9)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "rgba(255,255,255,0.55)";
      }}
    >
      {children}
    </button>
  );
}
