"use client";

import React, { useState, useEffect, useRef } from "react";

interface LuxuryLoginProps {
  onLogin: (username: string, password: string) => Promise<boolean> | boolean;
}

// ─────────────────────────────────────────────
// Munim Ji SVG Character (Pixar-style, CSS animated)
// ─────────────────────────────────────────────
function MunimJi({ state }: { state: "idle" | "smile" | "coverEyes" | "shake" | "celebrate" }) {
  const faceRef = useRef<SVGGElement>(null);

  // eye blink controller
  const [eyeOpen, setEyeOpen] = useState(true);
  useEffect(() => {
    const blink = () => {
      setEyeOpen(false);
      setTimeout(() => setEyeOpen(true), 130);
    };
    const id = setInterval(blink, 3200);
    return () => clearInterval(id);
  }, []);

  const isSmile = state === "smile" || state === "celebrate";
  const isCoverEyes = state === "coverEyes";
  const isShake = state === "shake";
  const isCelebrate = state === "celebrate";

  return (
    <div
      className="relative w-full flex flex-col items-center"
      style={{ maxWidth: 320 }}
    >
      {/* sparkles on celebrate */}
      {isCelebrate && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {["10%,15%", "80%,10%", "50%,5%", "20%,60%", "85%,55%", "40%,70%", "70%,30%", "15%,40%"].map((pos, i) => (
            <div
              key={i}
              className="absolute text-xl animate-bounce"
              style={{
                left: pos.split(",")[0], top: pos.split(",")[1],
                animationDelay: `${i * 0.15}s`,
                animationDuration: "0.6s",
              }}
            >✨</div>
          ))}
        </div>
      )}

      {/* Speech Bubble */}
      <div
        className="relative mb-4 px-4 py-3 rounded-2xl text-sm font-semibold text-center max-w-[280px] transition-all duration-500 shadow-md"
        style={{
          background: "white",
          border: "2px solid #D4AF37",
          color: "#4A3426",
          fontFamily: "'Segoe UI', sans-serif",
          lineHeight: 1.5,
          minHeight: 64,
        }}
      >
        {state === "idle" && <span>🙏 Ram Ram Seth Ji! Apna Login ID aur Password daaliye, aaj ka hisaab shuru karein.</span>}
        {state === "smile" && <span>😊 Bahut Achha! Apna Login ID daliye Seth Ji!</span>}
        {state === "coverEyes" && <span>🙈 Main dekh nahi raha! Password daalo aur safe raho!</span>}
        {state === "shake" && <span style={{ color: "#dc2626" }}>❌ Arre Seth Ji, lagta hai kuch galat hai!</span>}
        {state === "celebrate" && <span style={{ color: "#16a34a" }}>🎉 Swagat Hai Seth Ji! Aaj Ka Potha Tayyar Hai!</span>}
        {/* Bubble tail */}
        <div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0"
          style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "12px solid #D4AF37" }}
        />
        <div
          className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 w-0 h-0"
          style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid white" }}
        />
      </div>

      {/* Character SVG */}
      <div
        className={`transition-all duration-300 ${isShake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        style={{
          transform: isCelebrate ? "scale(1.05)" : "scale(1)",
          animation: isShake ? "shake 0.4s ease-in-out" : undefined,
        }}
      >
        <style>{`
          @keyframes shake {
            0%,100% { transform: translateX(0); }
            15% { transform: translateX(-8px) rotate(-3deg); }
            30% { transform: translateX(8px) rotate(3deg); }
            45% { transform: translateX(-6px) rotate(-2deg); }
            60% { transform: translateX(6px) rotate(2deg); }
            75% { transform: translateX(-3px); }
          }
          @keyframes breathe {
            0%,100% { transform: scaleY(1); }
            50% { transform: scaleY(1.015); }
          }
          @keyframes float-char {
            0%,100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes page-turn {
            0%,80%,100% { transform: rotateY(0deg); }
            40% { transform: rotateY(-30deg); }
          }
          @keyframes spectacles-adjust {
            0%,85%,100% { transform: translateY(0); }
            90% { transform: translateY(-2px); }
            95% { transform: translateY(1px); }
          }
          @keyframes hand-wave {
            0%,100% { transform: rotate(0deg); }
            25% { transform: rotate(-15deg); }
            75% { transform: rotate(15deg); }
          }
          @keyframes sparkle-pop {
            0% { opacity: 0; transform: scale(0); }
            50% { opacity: 1; transform: scale(1.3); }
            100% { opacity: 0; transform: scale(0); }
          }
        `}</style>

        <svg
          width="220"
          height="340"
          viewBox="0 0 220 340"
          style={{ animation: "float-char 3s ease-in-out infinite", display: "block" }}
        >
          {/* ── BODY (kurta – white with subtle shadow) ── */}
          <g style={{ animation: "breathe 3s ease-in-out infinite", transformOrigin: "110px 220px" }}>
            {/* kurta body */}
            <ellipse cx="110" cy="235" rx="52" ry="68" fill="#F8F8F8" stroke="#E0D0C0" strokeWidth="1.5" />
            {/* kurta collar */}
            <path d="M95 170 Q110 185 125 170" fill="none" stroke="#D0C0A0" strokeWidth="2" />
            {/* kurta buttons */}
            <circle cx="110" cy="192" r="2.5" fill="#D4AF37" />
            <circle cx="110" cy="205" r="2.5" fill="#D4AF37" />
            <circle cx="110" cy="218" r="2.5" fill="#D4AF37" />
            {/* left arm */}
            <path d="M58 195 Q30 220 28 255" stroke="#F5E6D0" strokeWidth="22" strokeLinecap="round" fill="none" />
            {/* right arm */}
            <path d="M162 195 Q190 220 192 255" stroke="#F5E6D0" strokeWidth="22" strokeLinecap="round" fill="none" />
            {/* left hand */}
            <ellipse cx="28" cy="258" rx="13" ry="10" fill="#F0C890" />
            {/* right hand */}
            <ellipse cx="192" cy="258" rx="13" ry="10" fill="#F0C890" />
            {/* dhoti (legs) */}
            <path d="M72 295 Q90 330 110 330 Q130 330 148 295" fill="#F0E8D8" stroke="#E0C8A0" strokeWidth="1" />
          </g>

          {/* ── BAHI KHATA (held in left hand) ── */}
          <g style={{ transformOrigin: "45px 270px", animation: "page-turn 4s ease-in-out infinite 2s" }}>
            {/* khata cover */}
            <rect x="8" y="248" width="40" height="52" rx="4" fill="#8B1A1A" stroke="#6B1010" strokeWidth="1.5" />
            {/* khata spine */}
            <rect x="8" y="248" width="5" height="52" rx="2" fill="#6B1010" />
            {/* khata title text area */}
            <rect x="14" y="255" width="28" height="10" rx="2" fill="#D4AF37" opacity="0.8" />
            <rect x="14" y="269" width="28" height="2" rx="1" fill="#F0C830" opacity="0.6" />
            <rect x="14" y="274" width="28" height="2" rx="1" fill="#F0C830" opacity="0.6" />
            <rect x="14" y="279" width="20" height="2" rx="1" fill="#F0C830" opacity="0.4" />
            {/* khata golden lock */}
            <rect x="42" y="268" width="6" height="8" rx="1" fill="#D4AF37" />
            {/* "पोथा" text on khata */}
            <text x="28" y="263" textAnchor="middle" fontSize="5" fill="#4A2010" fontWeight="bold" fontFamily="serif">पोथा</text>
          </g>

          {/* ── POINTING RIGHT HAND ── */}
          <g style={{ transformOrigin: "180px 240px", animation: "hand-wave 2s ease-in-out infinite" }}>
            <path d="M162 200 Q185 235 195 250" stroke="#F5E6D0" strokeWidth="22" strokeLinecap="round" fill="none" />
            <ellipse cx="196" cy="253" rx="13" ry="10" fill="#F0C890" />
            {/* pointing finger */}
            <path d="M200 245 L214 228" stroke="#F0C890" strokeWidth="9" strokeLinecap="round" />
            <circle cx="215" cy="226" r="5" fill="#F0C890" />
          </g>

          {/* ── NECK ── */}
          <rect x="100" y="158" width="20" height="22" rx="6" fill="#F0C890" />

          {/* ── HEAD ── */}
          <g>
            {/* head shape - rounded, friendly */}
            <ellipse cx="110" cy="130" rx="48" ry="52" fill="#F0C890" />
            {/* cheeks */}
            <ellipse cx="80" cy="145" rx="12" ry="8" fill="#FFB8C0" opacity="0.5" />
            <ellipse cx="140" cy="145" rx="12" ry="8" fill="#FFB8C0" opacity="0.5" />

            {/* ── EYES ── */}
            {/* eye whites */}
            <ellipse cx="93" cy="125" rx="13" ry={eyeOpen ? 12 : 2} fill="white" stroke="#4A3426" strokeWidth="1.5" style={{ transition: "ry 0.08s" }} />
            <ellipse cx="127" cy="125" rx="13" ry={eyeOpen ? 12 : 2} fill="white" stroke="#4A3426" strokeWidth="1.5" style={{ transition: "ry 0.08s" }} />

            {/* cover eyes – hands over face */}
            {isCoverEyes && (
              <g>
                <ellipse cx="93" cy="125" rx="16" ry="14" fill="#F0C890" stroke="#E0B070" strokeWidth="1" />
                <ellipse cx="127" cy="125" rx="16" ry="14" fill="#F0C890" stroke="#E0B070" strokeWidth="1" />
                {/* finger lines */}
                <line x1="82" y1="118" x2="82" y2="132" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="88" y1="115" x2="88" y2="133" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="94" y1="115" x2="94" y2="133" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="100" y1="117" x2="100" y2="133" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="116" y1="118" x2="116" y2="132" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="122" y1="115" x2="122" y2="133" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="128" y1="115" x2="128" y2="133" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="134" y1="117" x2="134" y2="133" stroke="#D4A870" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            )}

            {!isCoverEyes && eyeOpen && (
              <>
                {/* pupils */}
                <circle cx="93" cy="126" r={isSmile ? 7 : 6} fill="#3D2800" />
                <circle cx="127" cy="126" r={isSmile ? 7 : 6} fill="#3D2800" />
                {/* eye shine */}
                <circle cx="90" cy="122" r="2.5" fill="white" />
                <circle cx="124" cy="122" r="2.5" fill="white" />
                {/* eyebrows */}
                <path
                  d={isSmile ? "M82 110 Q93 105 104 110" : isShake ? "M82 107 Q93 112 104 107" : "M82 109 Q93 106 104 109"}
                  fill="none" stroke="#4A3426" strokeWidth="3.5" strokeLinecap="round"
                />
                <path
                  d={isSmile ? "M116 110 Q127 105 138 110" : isShake ? "M116 107 Q127 112 138 107" : "M116 109 Q127 106 138 109"}
                  fill="none" stroke="#4A3426" strokeWidth="3.5" strokeLinecap="round"
                />
              </>
            )}

            {/* MOUTH */}
            <path
              d={isSmile ? "M96 148 Q110 162 124 148" : isShake ? "M96 152 Q110 144 124 152" : "M98 150 Q110 158 122 150"}
              fill="none" stroke="#4A3426" strokeWidth="3" strokeLinecap="round"
            />
            {isSmile && <ellipse cx="110" cy="154" rx="10" ry="6" fill="#FF8090" opacity="0.5" />}

            {/* NOSE */}
            <ellipse cx="110" cy="138" rx="6" ry="4" fill="#E0A870" />

            {/* SPECTACLES */}
            <g style={{ animation: "spectacles-adjust 5s ease-in-out infinite 1s" }}>
              {/* left lens frame */}
              <ellipse cx="93" cy="125" rx="16" ry="14" fill="none" stroke="#4A3426" strokeWidth="2.5" />
              {/* right lens frame */}
              <ellipse cx="127" cy="125" rx="16" ry="14" fill="none" stroke="#4A3426" strokeWidth="2.5" />
              {/* bridge */}
              <path d="M109 125 L111 125" stroke="#4A3426" strokeWidth="2.5" strokeLinecap="round" />
              {/* left temple */}
              <path d="M77 120 L62 115" stroke="#4A3426" strokeWidth="2" strokeLinecap="round" />
              {/* right temple */}
              <path d="M143 120 L158 115" stroke="#4A3426" strokeWidth="2" strokeLinecap="round" />
            </g>
          </g>

          {/* ── PAGDI (Rajasthani turban) ── */}
          <g>
            {/* main pagdi wrap */}
            <ellipse cx="110" cy="88" rx="52" ry="24" fill="#C0392B" />
            {/* pagdi layers/folds */}
            <path d="M60 88 Q85 75 110 72 Q135 75 160 88" fill="#A93226" />
            <path d="M65 90 Q90 80 110 76 Q130 80 155 90" fill="#E74C3C" opacity="0.4" />
            {/* pagdi bottom band */}
            <rect x="64" y="98" width="92" height="12" rx="6" fill="#8B2020" />
            {/* pagdi jewel */}
            <ellipse cx="110" cy="82" rx="8" ry="6" fill="#D4AF37" />
            <ellipse cx="110" cy="82" rx="5" ry="4" fill="#F0D060" />
            <circle cx="110" cy="82" r="2" fill="#D4AF37" />
            {/* pagdi feather */}
            <path d="M110 76 Q118 55 115 40 Q120 55 125 52 Q118 60 116 72" fill="#D4AF37" opacity="0.8" />
          </g>

          {/* ears */}
          <ellipse cx="63" cy="132" rx="8" ry="10" fill="#F0C890" />
          <ellipse cx="157" cy="132" rx="8" ry="10" fill="#F0C890" />
          <ellipse cx="63" cy="132" rx="5" ry="7" fill="#E8A870" />
          <ellipse cx="157" cy="132" rx="5" ry="7" fill="#E8A870" />

          {/* mustache */}
          <path d="M98 143 Q104 138 110 142 Q116 138 122 143" fill="#4A3426" />

          {/* ── FEET ── */}
          <ellipse cx="90" cy="330" rx="18" ry="8" fill="#E8D0A0" />
          <ellipse cx="130" cy="330" rx="18" ry="8" fill="#E8D0A0" />
          {/* sandal straps */}
          <path d="M76 327 Q90 322 104 327" fill="none" stroke="#B8900C" strokeWidth="2" />
          <path d="M116 327 Q130 322 144 327" fill="none" stroke="#B8900C" strokeWidth="2" />

          {/* ── SHADOW ── */}
          <ellipse cx="110" cy="338" rx="55" ry="7" fill="rgba(0,0,0,0.1)" />
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Login Component
// ─────────────────────────────────────────────
export default function LuxuryLogin({ onLogin }: LuxuryLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [munimState, setMunimState] = useState<"idle" | "smile" | "coverEyes" | "shake" | "celebrate">("idle");
  const [slideIn, setSlideIn] = useState(false);

  // slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setSlideIn(true), 100);
    return () => clearTimeout(t);
  }, []);

  // live clock
  useEffect(() => {
    // Set initial time only on client to avoid SSR hydration mismatch
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 700));
    const ok = await onLogin(username, password);
    if (!ok) {
      setError("Arre Seth Ji, lagta hai kuch galat hai! Check your credentials.");
      setMunimState("shake");
      setTimeout(() => setMunimState("idle"), 2500);
    } else {
      setMunimState("celebrate");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #FFF9F2 0%, #FFF5E8 50%, #FEF2E0 100%)" }}
    >
      <style>{`
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-120px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(80px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes gold-shimmer {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes card-float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .input-field {
          width: 100%;
          padding: 12px 40px 12px 42px;
          border: 1.5px solid #E8D8C0;
          border-radius: 12px;
          background: #FFFBF5;
          color: #4A3426;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: 'Segoe UI', sans-serif;
        }
        .input-field:focus {
          border-color: #D4AF37;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.15);
        }
        .input-field::placeholder { color: #C0A888; }
        @media (max-width: 768px) {
          .split-left { display: none; }
        }
      `}</style>

      {/* ══════════════════════════════════════
          LEFT SIDE – Munim Ji
      ══════════════════════════════════════ */}
      <div
        className="split-left flex-1 flex flex-col items-center justify-center px-6 py-12 relative"
        style={{
          animation: slideIn ? "slide-in-left 0.9s cubic-bezier(0.22,1,0.36,1) forwards" : "none",
          opacity: slideIn ? 1 : 0,
          maxWidth: 420,
        }}
      >
        {/* Decorative background circle */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 380,
            height: 380,
            background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
          }}
        />

        <MunimJi state={munimState} />

        {/* App badge below character */}
        <div
          className="mt-6 px-5 py-2 rounded-full text-xs font-bold tracking-widest uppercase"
          style={{
            background: "rgba(212,175,55,0.12)",
            border: "1px solid rgba(212,175,55,0.3)",
            color: "#9A7010",
          }}
        >
          ✦ Powered by Potha Bahi ✦
        </div>
      </div>

      {/* ══════════════════════════════════════
          RIGHT SIDE – Login Card
      ══════════════════════════════════════ */}
      <div
        className="flex-1 flex items-center justify-center px-4 py-10"
        style={{
          animation: slideIn ? "slide-in-right 0.9s cubic-bezier(0.22,1,0.36,1) forwards" : "none",
          opacity: slideIn ? 1 : 0,
          maxWidth: 480,
        }}
      >
        <div
          className="w-full"
          style={{
            maxWidth: 400,
            animation: "card-float 4s ease-in-out infinite 1s",
          }}
        >
          {/* Card */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(212,175,55,0.25)",
              boxShadow: "0 24px 64px rgba(74,52,38,0.12), 0 4px 16px rgba(212,175,55,0.08)",
            }}
          >
            {/* Gold top bar */}
            <div
              className="h-1.5"
              style={{
                backgroundImage: "linear-gradient(90deg, #c8960c, #f5d060 35%, #D4AF37 50%, #f5d060 65%, #c8960c)",
                backgroundSize: "200% auto",
                animation: "gold-shimmer 3s linear infinite",
              }}
            />

            <div className="px-8 py-8">
              {/* Header */}
              <div className="text-center mb-7">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">📒</span>
                  <h1
                    className="font-black tracking-wider"
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: "26px",
                      color: "#4A3426",
                      letterSpacing: "0.1em",
                    }}
                  >
                    POTHA BAHI
                  </h1>
                </div>
                <p style={{ fontSize: "12px", color: "#8B6914", fontWeight: 600, letterSpacing: "0.05em" }}>
                  Digital Daily Book for Jewellers
                </p>
                <p style={{ fontSize: "11px", color: "#B8A080", fontStyle: "italic", marginTop: 4 }}>
                  "Every Rupee Accounted, Every Gram Remembered"
                </p>

                {/* Live clock – client-only to avoid SSR hydration mismatch */}
                <div
                  className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full"
                  style={{ background: "#FFFBF0", border: "1px solid rgba(212,175,55,0.2)" }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span style={{ fontSize: "10px", color: "#9A7010", fontFamily: "monospace" }}>
                    {currentTime
                      ? `${currentTime.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${currentTime.toLocaleTimeString("en-IN")}`
                      : "Loading…"}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div
                className="mb-6"
                style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)" }}
              />

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Login ID */}
                <div>
                  <label
                    htmlFor="login-username"
                    style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8B6914", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}
                  >
                    👤 &nbsp;Login ID
                  </label>
                  <div className="relative">
                    <input
                      id="login-username"
                      type="text"
                      className="input-field"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your login ID"
                      required
                      autoComplete="username"
                      onFocus={() => setMunimState("smile")}
                      onBlur={() => setMunimState("idle")}
                      style={{ paddingLeft: 42 }}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">👤</span>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="login-password"
                    style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8B6914", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}
                  >
                    🔒 &nbsp;Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      className="input-field"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      onFocus={() => setMunimState("coverEyes")}
                      onBlur={() => setMunimState("idle")}
                      style={{ paddingLeft: 42, paddingRight: 56 }}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔒</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold transition-colors"
                      style={{ color: "#B8A080" }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#8B6914")}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#B8A080")}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setRememberMe(!rememberMe)}
                      className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                      style={{
                        border: "1.5px solid",
                        borderColor: rememberMe ? "#D4AF37" : "#D0B888",
                        background: rememberMe ? "#D4AF37" : "white",
                        boxShadow: rememberMe ? "0 2px 8px rgba(212,175,55,0.3)" : "none",
                      }}
                    >
                      {rememberMe && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 13, color: "#7A5C3A", fontWeight: 500 }}>☑ Remember Me</span>
                  </label>
                  <button
                    type="button"
                    className="transition-colors"
                    style={{ fontSize: 12, color: "#B8860B", fontWeight: 600 }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#8B6914")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#B8860B")}
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <div
                    className="flex items-start gap-2 rounded-xl px-4 py-3"
                    style={{ background: "#FFF5F5", border: "1px solid rgba(220,38,38,0.2)" }}
                  >
                    <span>⚠️</span>
                    <p style={{ fontSize: 12, color: "#dc2626", lineHeight: 1.4 }}>{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all relative overflow-hidden"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 13,
                    letterSpacing: "0.15em",
                    color: loading ? "rgba(100,70,0,0.5)" : "#4A2800",
                    backgroundImage: loading
                      ? "none"
                      : "linear-gradient(135deg, #c8960c 0%, #f5d060 35%, #D4AF37 50%, #f5d060 65%, #c8960c 100%)",
                    backgroundColor: loading
                      ? "rgba(212,175,55,0.3)"
                      : "transparent",
                    backgroundSize: "200% auto",
                    animation: loading ? "none" : "gold-shimmer 2.5s linear infinite",
                    boxShadow: loading
                      ? "none"
                      : "0 6px 24px rgba(212,175,55,0.4), 0 2px 4px rgba(212,175,55,0.3)",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border-2 animate-spin inline-block"
                        style={{ borderColor: "rgba(180,140,0,0.3)", borderTopColor: "#8B6914" }}
                      />
                      Verifying…
                    </span>
                  ) : (
                    "📖  OPEN TODAY'S BAHI"
                  )}
                </button>
              </form>
            </div>

            {/* Card Footer */}
            <div
              className="px-8 py-4 text-center"
              style={{
                borderTop: "1px solid rgba(212,175,55,0.12)",
                background: "rgba(255,251,240,0.6)",
              }}
            >
              <p style={{ fontSize: 10, color: "#C0A888", letterSpacing: "0.05em" }}>
                🔐 Secure & Private &nbsp;·&nbsp; Potha Bahi © 2026
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
