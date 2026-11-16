"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine, type HudState } from "@/game/engine";
import { VEHICLES, getVehicle, type Brand } from "@/game/vehicles";

interface Toast {
  id: number;
  text: string;
  kind: "info" | "money" | "bad";
}

const MAX_SPEED = Math.max(...VEHICLES.map((v) => v.maxSpeed));
const MAX_ACCEL = Math.max(...VEHICLES.map((v) => v.accel));
const FONT = '"Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif';

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/15">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(5, value * 100)}%`, background: color }} />
    </div>
  );
}

const BRAND_COLORS: Record<string, string> = {
  Kawasaki: "#3f8f1f",
  Kukirin: "#ff7a00",
  Fiat: "#b71c1c",
  VW: "#1565c0",
  BMW: "#0d47a1",
  Porsche: "#6d4c41",
  Ferrari: "#d40000",
  Lamborghini: "#b8960b",
};

function BrandChip({ brand }: { brand: Brand }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider text-white"
      style={{ background: BRAND_COLORS[brand] ?? "#555555" }}
    >
      {brand.toUpperCase()}
    </span>
  );
}

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const hudRef = useRef<HudState | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [atmOpen, setAtmOpen] = useState(false);
  const [atmCode, setAtmCode] = useState("");
  const [atmMsg, setAtmMsg] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [brand, setBrand] = useState<"Alle" | "Kawasaki" | "Kukirin" | "Autos">("Alle");
  const [started, setStarted] = useState(() => new URLSearchParams(window.location.search).has("start"));

  useEffect(() => {
    const engine = new GameEngine(containerRef.current!, minimapRef.current!, {
      onHud: (s) => {
        hudRef.current = s;
        setHud(s);
      },
      onMessage: (text, kind) => {
        const id = Math.random();
        setToasts((t) => [...t.slice(-3), { id, text, kind }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
      },
    });
    engineRef.current = engine;
    // Test-Schalter: ?shop öffnet direkt die Garage, ?phone das Job-Handy
    const q = new URLSearchParams(window.location.search);
    if (q.has("shop")) {
      setShopOpen(true);
      engine.setShowroom(true);
      setPreviewId(q.get("shop") || "ke100");
      if (q.get("shop")) engine.preview(q.get("shop")!);
    }
    if (q.has("phone")) setPhoneOpen(true);
    // Cheat: ?geld=1000 gibt einmalig Geld (danach wird es aus der Adresse entfernt)
    const geld = Number(q.get("geld"));
    if (q.has("allesweg")) {
      q.delete("allesweg");
      const rest = q.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
      engine.resetProgress();
    }
    if (q.has("ninjaweg")) {
      q.delete("ninjaweg");
      const rest = q.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
      engine.removeNinjasAndMoney();
    }
    if (geld > 0) {
      q.delete("geld");
      const rest = q.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
      engine.addMoney(Math.floor(geld));
    }
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(!started || shopOpen || atmOpen);
  }, [started, shopOpen, atmOpen]);

  const atmPress = (k: string) => {
    if (k === "C") return setAtmCode("");
    if (k === "OK") {
      const ok = engineRef.current?.atmWithdraw(atmCode);
      setAtmMsg(ok ? "✅ 10000 € ausgezahlt!" : "❌ Falscher Code");
      setAtmCode("");
      return;
    }
    setAtmMsg(null);
    setAtmCode((c) => (c.length < 4 ? c + k : c));
  };

  const openShop = () => {
    setShopOpen(true);
    setPhoneOpen(false);
    setPreviewId(hudRef.current?.vehicleId ?? null);
    engineRef.current?.setShowroom(true);
  };
  const closeShop = () => {
    setShopOpen(false);
    engineRef.current?.setShowroom(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && !started) setStarted(true);
      if (!started) return;
      if (hudRef.current?.match) {
        if (e.code === "Escape" || (e.code === "Enter" && hudRef.current.match.state === "end")) engineRef.current?.leaveMatch();
        return;
      }
      if (atmOpen) {
        if (/^(Digit|Numpad)[0-9]$/.test(e.code)) atmPress(e.code.slice(-1));
        if (e.code === "Enter" || e.code === "NumpadEnter") atmPress("OK");
        if (e.code === "Backspace") setAtmCode((c) => c.slice(0, -1));
        if (e.code === "Escape" || e.code === "KeyE") setAtmOpen(false);
        return;
      }
      if (e.code === "KeyE") {
        if (shopOpen) closeShop();
        else if (hudRef.current?.atAtm) {
          setAtmOpen(true);
          setAtmCode("");
          setAtmMsg(null);
          setPhoneOpen(false);
        } else if (hudRef.current?.inGarage) openShop();
      }
      if (e.code === "Escape") {
        if (shopOpen) closeShop();
        setPhoneOpen(false);
      }
      if (e.code === "KeyJ" && !shopOpen) setPhoneOpen((p) => !p);
      if (phoneOpen && !shopOpen && /^Digit[1-4]$/.test(e.code)) {
        engineRef.current?.acceptOfferIndex(Number(e.code.slice(5)) - 1);
        setPhoneOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, shopOpen, phoneOpen, atmOpen, atmCode]);

  const vehicle = hud ? getVehicle(hud.vehicleId) : VEHICLES[0];
  const m = hud?.match ?? null;
  const o = hud?.order;
  const shown = VEHICLES.filter((v) => brand === "Alle" || (brand === "Autos" ? v.kind === "car" : v.brand === brand));

  return (
    <div className="fixed inset-0 select-none overflow-hidden text-white" style={{ fontFamily: FONT }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Geld & Fahrzeug */}
      {!shopOpen && !m && (
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          <div className="rounded-2xl border-4 border-white/70 bg-black/55 px-4 py-2 text-3xl text-yellow-300 shadow-lg backdrop-blur-sm">
            💰 {hud?.money ?? 0} €
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-black/45 px-3 py-1 text-sm backdrop-blur-sm">
            <BrandChip brand={vehicle.brand} /> {vehicle.name.replace(`${vehicle.brand} `, "")}
          </div>
          <div className="rounded-xl bg-black/45 px-3 py-1 text-sm backdrop-blur-sm">
            📦 {hud?.delivered ?? 0} geliefert {hud && hud.combo > 1 && <span className="text-orange-300">· 🔥 Combo {hud.combo}</span>}
          </div>
        </div>
      )}

      {/* Auftrag */}
      {started && !shopOpen && !m && (
        <div className="absolute left-1/2 top-4 w-[min(90vw,400px)] -translate-x-1/2">
          {o ? (
            <div className="flex items-center gap-3 rounded-2xl border-4 border-white/70 bg-black/55 px-4 py-2 shadow-lg backdrop-blur-sm">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-3xl"
                style={{ background: o.stage === "pickup" ? "#ff9800" : "#00c853" }}
              >
                <span style={{ display: "inline-block", transform: `rotate(${-o.angle}rad)` }}>⬆</span>
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-lg">
                  {o.stage === "pickup" ? `Abholen: ${o.emoji} ${o.restaurant}` : `Liefern: ${o.emoji} zum Kunden 🏠`}
                </div>
                <div className="text-sm text-white/80">
                  {Math.round(o.distance)} m · {o.pay} € + Trinkgeld
                </div>
                {o.stage === "deliver" && (
                  <div className="mt-1">
                    <Bar value={Math.max(0, o.timeLeft / o.timeLimit)} color={o.timeLeft / o.timeLimit > 0.3 ? "#00e676" : "#ff5252"} />
                    <div className="text-xs text-white/80">
                      {o.timeLeft > 0 ? `⏱️ ${Math.ceil(o.timeLeft)} s` : "⏱️ Zu spät! Trotzdem liefern."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPhoneOpen(true)}
              className="w-full animate-pulse rounded-2xl border-4 border-white/70 bg-green-600/90 px-4 py-2 text-center text-lg shadow-lg"
            >
              📱 Drücke <b>J</b> für neue Jobs
            </button>
          )}
        </div>
      )}

      {/* Minimap */}
      <canvas
        ref={minimapRef}
        width={220}
        height={220}
        className={`absolute right-4 top-4 h-[220px] w-[220px] rounded-2xl border-4 border-white/80 shadow-lg ${shopOpen || m ? "hidden" : ""}`}
      />

      {/* Tacho */}
      {!shopOpen && !m && (
        <div className="absolute bottom-4 right-4 rounded-2xl border-4 border-white/70 bg-black/55 px-5 py-2 text-right shadow-lg backdrop-blur-sm">
          <div className="text-5xl tabular-nums">{Math.round(hud?.speedKmh ?? 0)}</div>
          <div className="text-sm text-white/80">km/h</div>
        </div>
      )}

      {/* Wheelie-Modus */}
      {hud && hud.wheelieMode && hud.pitch <= 0.05 && !shopOpen && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 rounded-2xl border-4 border-white/70 bg-purple-600/85 px-5 py-2 text-center text-lg shadow-lg">
          🤸 Wheelie-Modus AN – gib Gas!
        </div>
      )}

      {/* Wheelie-Anzeige */}
      {hud && hud.pitch > 0.05 && !shopOpen && (
        <div className="absolute bottom-28 left-1/2 w-72 -translate-x-1/2 rounded-2xl bg-black/50 px-4 py-2 text-center backdrop-blur-sm">
          <div className="text-xl">🤸 Wheelie {hud.wheelie.toFixed(1)}s</div>
          <Bar value={hud.pitch} color={hud.pitch > 0.75 ? "#ff5252" : hud.pitch > 0.5 ? "#ffd600" : "#00e676"} />
          <div className="text-xs text-white/80">
            {hud.pitch > 0.75 ? <span className="text-red-300">Zu hoch! Gas loslassen!</span> : "Gas = hoch · Gas loslassen = runter"}
          </div>
        </div>
      )}

      {/* Garage-Hinweis */}
      {started && hud?.inGarage && !shopOpen && (
        <button
          onClick={openShop}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce rounded-2xl border-4 border-white bg-blue-600 px-6 py-3 text-xl shadow-lg"
        >
          🏍️ Drücke E für die Garage
        </button>
      )}

      {/* Geldautomat-Hinweis */}
      {started && hud?.atAtm && !atmOpen && !shopOpen && (
        <button
          onClick={() => {
            setAtmOpen(true);
            setAtmCode("");
            setAtmMsg(null);
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce rounded-2xl border-4 border-white bg-yellow-500 px-6 py-3 text-xl shadow-lg"
        >
          💶 Drücke E für den Geldautomat
        </button>
      )}

      {/* Geldautomat */}
      {atmOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[320px] rounded-3xl border-4 border-yellow-400 bg-blue-900 p-5 shadow-2xl">
            <div className="mb-3 text-center text-2xl">💶 Geldautomat</div>
            <div className="mb-1 text-center text-sm text-white/70">Bitte Code eingeben</div>
            <div className="mb-3 rounded-xl bg-sky-200 py-3 text-center font-mono text-4xl tracking-[0.5em] text-blue-950">
              {(atmCode.replace(/./g, "●") + "____").slice(0, 4)}
            </div>
            {atmMsg && <div className="mb-3 rounded-lg bg-white/15 py-1 text-center">{atmMsg}</div>}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((k) => (
                <button
                  key={k}
                  onClick={() => atmPress(k)}
                  className={`rounded-xl py-3 text-2xl shadow active:scale-95 ${
                    k === "OK" ? "bg-green-500 hover:bg-green-600" : k === "C" ? "bg-red-500 hover:bg-red-600" : "bg-slate-200 text-slate-800 hover:bg-white"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <button onClick={() => setAtmOpen(false)} className="mt-3 w-full rounded-xl bg-black/30 py-2 hover:bg-black/40">
              Schließen (E)
            </button>
          </div>
        </div>
      )}

      {/* Steuerung */}
      {!shopOpen && !m && (
        <div className="absolute bottom-4 left-4 rounded-xl bg-black/40 px-3 py-2 text-xs leading-5 text-white/90 backdrop-blur-sm">
          <b>W/↑</b> Gas · <b>S/↓</b> Bremse · <b>A/D</b> Lenken
          <br />
          {vehicle.kind === "car" ? (
            <>
              <b>Leertaste</b> Handbremse (Drift)
            </>
          ) : (
            <>
              <b>Leertaste</b> Wheelie-Modus (dann Gas = hoch)
            </>
          )}{" "}
          · <b>J</b> Jobs · <b>E</b> Garage · <b>R</b> Reset
          <br />
          🎢 In der Luft: <b>Leertaste halten</b> = Backflip
        </div>
      )}

      {/* Job-Handy */}
      {phoneOpen && hud && !shopOpen && (
        <div className="absolute left-4 top-1/2 w-[300px] -translate-y-1/2 rounded-[2rem] border-[6px] border-neutral-800 bg-neutral-900 p-2 shadow-2xl">
          <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-neutral-700" />
          <div className="rounded-[1.4rem] bg-gradient-to-b from-orange-500 to-orange-600 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-lg">⚡ Lieferblitz Jobs</div>
              <button onClick={() => setPhoneOpen(false)} className="rounded-full bg-black/25 px-2 text-sm">
                ✕
              </button>
            </div>
            {hud.order ? (
              <div className="rounded-xl bg-white p-3 text-slate-800">
                <div className="text-sm text-slate-500">Aktueller Auftrag</div>
                <div className="text-lg">
                  {hud.order.emoji} {hud.order.restaurant}
                </div>
                <div className="text-sm">{hud.order.stage === "pickup" ? "Noch abholen" : "Zum Kunden bringen"}</div>
                <button
                  onClick={() => engineRef.current?.cancelJob()}
                  className="mt-2 w-full rounded-lg bg-red-500 py-1.5 text-white hover:bg-red-600"
                >
                  Auftrag abbrechen
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {hud.offers.map((j, i) => (
                  <button
                    key={j.id}
                    onClick={() => {
                      engineRef.current?.acceptJob(j.id);
                      setPhoneOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-white p-2 text-left text-slate-800 shadow hover:scale-[1.02] hover:bg-orange-50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl" style={{ background: j.color }}>
                      {j.emoji}
                    </div>
                    <div className="flex-1 leading-tight">
                      <div className="text-sm">{j.restaurant}</div>
                      <div className="text-[11px] text-slate-500">
                        📍 {Math.round(j.toRestaurant)} m entfernt · 🛣️ {Math.round(j.route)} m
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg text-green-600">{j.pay} €</div>
                      <div className="text-[10px] text-slate-400">Taste {i + 1}</div>
                    </div>
                  </button>
                ))}
                <div className="text-center text-[11px] text-white/80">+ Trinkgeld, wenn du schnell bist!</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fußballspiel */}
      {m && (
        <>
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-2xl border-4 border-white/80 bg-black/70 px-5 py-2 text-2xl shadow-lg">
            <span className="rounded-lg bg-orange-500 px-2">Lieferblitz FC</span>
            <span className="tabular-nums text-4xl">
              {m.home} : {m.away}
            </span>
            <span className="rounded-lg bg-blue-600 px-2">FC Blau</span>
            <span className={`ml-2 tabular-nums ${m.time < 10 ? "text-red-400" : ""}`}>
              ⏱️ 0:{String(Math.ceil(m.time)).padStart(2, "0")}
            </span>
          </div>
          {m.state === "countdown" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
              {Math.ceil(m.countdown) > 0 ? Math.ceil(m.countdown) : "LOS!"}
            </div>
          )}
          {m.state === "goal" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`rounded-3xl border-8 border-white px-12 py-6 text-8xl shadow-2xl ${m.lastGoal === 0 ? "bg-orange-500" : "bg-blue-600"}`}>
                TOR! ⚽
              </div>
            </div>
          )}
          {m.state !== "end" && (
            <>
              <div className="absolute bottom-6 right-6 flex items-end gap-3">
                <button
                  onPointerDown={() => engineRef.current?.matchToggleCamera()}
                  className="rounded-full border-4 border-white bg-slate-700 px-4 py-3 text-base shadow-lg active:scale-95"
                >
                  🎥 {m.ego ? "TV-Sicht" : "Ego-Sicht"}
                  <div className="text-xs">Taste C</div>
                </button>
                <button
                  onPointerDown={() => engineRef.current?.matchPass()}
                  className="rounded-full border-4 border-white bg-blue-500 px-6 py-5 text-xl shadow-lg active:scale-95"
                >
                  ↪ Passen
                  <div className="text-xs">Taste E</div>
                </button>
                <button
                  onPointerDown={() => engineRef.current?.matchShoot()}
                  className={`rounded-full border-4 border-white px-8 py-6 text-2xl shadow-lg active:scale-95 ${m.hasBall ? "animate-pulse bg-red-500" : "bg-red-500/70"}`}
                >
                  ⚽ Schießen
                  <div className="text-xs">Leertaste</div>
                </button>
              </div>
              <div className="absolute bottom-6 left-6 rounded-xl bg-black/50 px-3 py-2 text-sm leading-6">
                {m.ego ? (
                  <>
                    <b>W</b> vorwärts · <b>S</b> zurück · <b>A / D</b> drehen
                  </>
                ) : (
                  <>
                    <b>W A S D</b> laufen · du hast den <span className="text-yellow-300">gelben Ring</span>
                  </>
                )}
                <br />
                Ball berühren = am Fuß · <b>Leertaste</b> schießen · <b>E</b> passen
                <br />
                <b>C</b> Kamera wechseln · <b>Esc</b> aufhören
              </div>
              {/* Radar */}
              <div className="absolute right-4 top-24 rounded-xl border-4 border-white/80 bg-green-700/80 p-1 shadow-lg">
                <svg width="200" height="130" viewBox="-1.05 -1.05 2.1 2.1" preserveAspectRatio="none">
                  <rect x="-1" y="-1" width="2" height="2" fill="none" stroke="white" strokeWidth="0.02" />
                  <line x1="0" y1="-1" x2="0" y2="1" stroke="white" strokeWidth="0.015" />
                  <rect x="-1.04" y="-0.13" width="0.06" height="0.26" fill="#ffffff" />
                  <rect x="0.98" y="-0.13" width="0.06" height="0.26" fill="#ffffff" />
                  {m.radar.dots.map((d, i) => (
                    <circle
                      key={i}
                      cx={d.x}
                      cy={d.z}
                      r={d.human ? 0.07 : 0.05}
                      fill={d.team === 0 ? "#ff7a00" : "#1e88e5"}
                      stroke={d.human ? "#ffeb3b" : "white"}
                      strokeWidth={d.human ? 0.03 : 0.012}
                    />
                  ))}
                  <circle cx={m.radar.ball.x} cy={m.radar.ball.z} r={0.035} fill="#ffffff" stroke="#000" strokeWidth={0.01} />
                </svg>
                <div className="text-center text-[10px]">→ Angriff nach rechts</div>
              </div>
            </>
          )}
          {m.state === "end" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div
                className={`rounded-3xl border-4 border-white p-8 text-center shadow-2xl ${
                  m.result === "win" ? "bg-green-600" : m.result === "draw" ? "bg-slate-600" : "bg-red-700"
                }`}
              >
                <div className="text-6xl">{m.result === "win" ? "🏆" : m.result === "draw" ? "🤝" : "😢"}</div>
                <div className="mt-2 text-4xl">{m.result === "win" ? "Gewonnen!" : m.result === "draw" ? "Unentschieden" : "Verloren"}</div>
                <div className="mt-1 text-5xl tabular-nums">
                  {m.home} : {m.away}
                </div>
                {m.result === "win" && <div className="mt-2 text-3xl text-yellow-300">+300 €</div>}
                <button
                  onClick={() => engineRef.current?.leaveMatch()}
                  className="mt-5 rounded-2xl border-4 border-white bg-white/20 px-8 py-3 text-2xl hover:bg-white/30"
                >
                  Weiter (Enter)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Meldungen */}
      <div className="pointer-events-none absolute left-1/2 top-32 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border-4 border-white/80 px-5 py-2 text-lg shadow-lg"
            style={{ background: t.kind === "money" ? "#2e7d32e6" : t.kind === "bad" ? "#c62828e6" : "#1565c0e6" }}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Shop / Showroom */}
      {shopOpen && hud && (
        <>
          <div className="absolute left-6 top-6 rounded-2xl bg-black/50 px-5 py-3 backdrop-blur-sm">
            <div className="text-3xl">🏍️ Garage</div>
            <div className="text-yellow-300">💰 {hud.money} €</div>
          </div>
          {previewId && (
            <div className="absolute bottom-6 left-6 max-w-sm rounded-2xl bg-black/55 px-5 py-3 backdrop-blur-sm">
              <BrandChip brand={getVehicle(previewId).brand} />
              <div className="text-2xl">{getVehicle(previewId).name}</div>
              <div className="text-sm text-white/80">{getVehicle(previewId).desc}</div>
            </div>
          )}
          <div className="absolute bottom-0 right-0 top-0 flex w-[min(100vw,430px)] flex-col bg-sky-50/95 text-slate-800 shadow-2xl">
            <div className="flex gap-2 p-4 pb-2">
              {(["Alle", "Kawasaki", "Kukirin", "Autos"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`flex-1 rounded-xl py-2 text-sm ${brand === b ? "bg-slate-800 text-white" : "bg-white text-slate-600 shadow"}`}
                >
                  {b === "Alle" ? "Alle" : b === "Kawasaki" ? "🏍️ Kawasaki" : b === "Kukirin" ? "🛴 Kukirin" : "🚗 Autos"}
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 pt-2">
              {shown.map((v) => {
                const owned = hud.owned.includes(v.id);
                const active = hud.vehicleId === v.id;
                const canBuy = hud.money >= v.price;
                const selected = previewId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setPreviewId(v.id);
                      engineRef.current?.preview(v.id);
                    }}
                    className={`cursor-pointer rounded-2xl border-4 bg-white p-3 shadow transition ${
                      selected ? "border-sky-500" : active ? "border-green-500" : "border-transparent hover:border-sky-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <BrandChip brand={v.brand} />
                        <div className="text-lg leading-tight">{v.name.replace(`${v.brand} `, "")}</div>
                      </div>
                      <div className="h-8 w-8 shrink-0 rounded-lg border-2 border-white shadow" style={{ background: `linear-gradient(135deg, ${v.color} 50%, ${v.accent} 50%)` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-[90px_1fr] items-center gap-x-2 gap-y-1 text-xs">
                      <span>{Math.round(v.maxSpeed * 3.6)} km/h</span>
                      <Bar value={v.maxSpeed / MAX_SPEED} color="#2979ff" />
                      <span>Beschleunigung</span>
                      <Bar value={v.accel / MAX_ACCEL} color="#ff9100" />
                      {v.kind === "car" ? (
                        <>
                          <span>Handbremse</span>
                          <span className="text-slate-500">🚗 Drift mit Leertaste</span>
                        </>
                      ) : (
                        <>
                          <span>Wheelie</span>
                          <Bar value={(v.wheelie - 4) / 3} color="#d500f9" />
                        </>
                      )}
                    </div>
                    <button
                      disabled={active || (!owned && !canBuy)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (owned) engineRef.current?.select(v.id);
                        else engineRef.current?.buy(v.id);
                        setPreviewId(v.id);
                      }}
                      className={`mt-2 w-full rounded-xl px-4 py-1.5 text-white shadow ${
                        active
                          ? "bg-green-500"
                          : owned
                            ? "bg-blue-500 hover:bg-blue-600"
                            : canBuy
                              ? "bg-orange-500 hover:bg-orange-600"
                              : "cursor-not-allowed bg-slate-400"
                      }`}
                    >
                      {active ? "✔ Ausgewählt" : owned ? "Auswählen" : canBuy ? `Kaufen: ${v.price} €` : `🔒 ${v.price} €`}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 p-4">
              <button
                onClick={() => {
                  if (confirm("Wirklich alles zurücksetzen? Geld und Fahrzeuge sind dann weg!")) engineRef.current?.resetProgress();
                }}
                className="text-xs text-slate-500 underline"
              >
                Spielstand zurücksetzen
              </button>
              <button onClick={closeShop} className="rounded-xl bg-slate-800 px-6 py-2 text-lg text-white hover:bg-slate-900">
                Losfahren (E)
              </button>
            </div>
          </div>
        </>
      )}

      {/* Startbildschirm */}
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border-4 border-white bg-gradient-to-b from-orange-400 to-orange-600 p-8 text-center shadow-2xl">
            <h1 className="text-5xl drop-shadow">⚡ Lieferblitz 3D</h1>
            <p className="mt-3 text-lg">
              Nimm Jobs auf deinem Handy an 📱, hol das Essen ab 🍕 und bring es zu den Kunden 🏠. Verdiene Geld für schnellere
              Kawasaki-Motorräder und Kukirin-Scooter!
            </p>
            <div className="mt-4 rounded-2xl bg-black/25 p-3 text-left text-sm leading-6">
              📱 <b>J</b> = Job-Handy (geht überall)
              <br />
              🟠 Orange Säule = Restaurant · 🟢 Grüne Säule = Kunde
              <br />
              🔵 Blaue Säule = Garage (Fahrzeuge kaufen)
              <br />
              🤸 <b>Leertaste</b> einmal drücken = Wheelie-Modus: Gas = hoch, Gas loslassen = runter
              <br />
              🎢 Jump Park mit Rampen &amp; Loopings! In der Luft Leertaste halten = Backflip
              <br />
              🔥 Pünktlich liefern = Combo-Bonus!
            </div>
            <button
              onClick={() => setStarted(true)}
              className="mt-6 rounded-2xl border-4 border-white bg-green-500 px-10 py-3 text-2xl shadow-lg hover:bg-green-600"
            >
              ▶ Start
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
