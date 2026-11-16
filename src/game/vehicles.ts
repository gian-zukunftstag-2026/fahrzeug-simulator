export type Brand = "Kawasaki" | "Kukirin" | "Fiat" | "VW" | "BMW" | "Porsche" | "Ferrari" | "Lamborghini";
export type VehicleKind = "moto" | "scooter" | "car";
export type VehicleStyle =
  | "classic"
  | "naked"
  | "sport"
  | "hyper"
  | "commuter"
  | "offroad"
  | "city"
  | "hatch"
  | "sedan"
  | "coupe"
  | "super"
  | "lambo"
  | "van";

export interface VehicleDef {
  id: string;
  name: string;
  brand: Brand;
  kind: VehicleKind;
  style: VehicleStyle;
  /** Hauptfarbe */
  color: string;
  /** Akzentfarbe (Streifen, Felgen, Federn) */
  accent: string;
  price: number;
  /** Höchstgeschwindigkeit in m/s */
  maxSpeed: number;
  /** Beschleunigung in m/s² */
  accel: number;
  /** Lenkgeschwindigkeit */
  turn: number;
  /** Wie stark das Vorderrad beim Wheelie hochgeht */
  wheelie: number;
  /** Größe (kleine 125er sind etwas kleiner) */
  size: number;
  desc: string;
}

const KAWA_GREEN = "#62bb2a";

export const VEHICLES: VehicleDef[] = [
  {
    id: "ke100",
    name: "Kawasaki KE100 (Oldtimer)",
    brand: "Kawasaki",
    kind: "moto",
    style: "classic",
    color: "#8e3b2c",
    accent: "#c46a2b",
    price: 0,
    maxSpeed: 12.5,
    accel: 3.5,
    turn: 2.0,
    wheelie: 4.6,
    size: 0.92,
    desc: "Baujahr 1982. Rostig, laut und langsam – aber deine erste eigene Maschine!",
  },
  {
    id: "g2",
    name: "Kukirin G2",
    brand: "Kukirin",
    kind: "scooter",
    style: "commuter",
    color: "#1f2226",
    accent: "#2f80ff",
    price: 60,
    maxSpeed: 15,
    accel: 6,
    turn: 2.6,
    wheelie: 5.0,
    size: 1,
    desc: "Leichter Stadt-Scooter. Leise und wendig.",
  },
  {
    id: "z125",
    name: "Kawasaki Z125 Pro",
    brand: "Kawasaki",
    kind: "moto",
    style: "naked",
    color: KAWA_GREEN,
    accent: "#1f2226",
    price: 150,
    maxSpeed: 17,
    accel: 7,
    turn: 2.5,
    wheelie: 5.3,
    size: 0.82,
    desc: "Klein, frech und perfekt für Wheelies.",
  },
  {
    id: "g2pro",
    name: "Kukirin G2 Pro",
    brand: "Kukirin",
    kind: "scooter",
    style: "commuter",
    color: "#1f2226",
    accent: "#e53935",
    price: 280,
    maxSpeed: 19,
    accel: 9,
    turn: 2.7,
    wheelie: 5.4,
    size: 1,
    desc: "Stärkerer Motor und größerer Akku.",
  },
  {
    id: "ninja125",
    name: "Kawasaki Ninja 125",
    brand: "Kawasaki",
    kind: "moto",
    style: "sport",
    color: KAWA_GREEN,
    accent: "#ffffff",
    price: 450,
    maxSpeed: 21,
    accel: 10,
    turn: 2.5,
    wheelie: 5.5,
    size: 0.86,
    desc: "Die kleine Ninja – sieht aus wie ein Rennmotorrad!",
  },
  {
    id: "g3",
    name: "Kukirin G3",
    brand: "Kukirin",
    kind: "scooter",
    style: "offroad",
    color: "#1f2226",
    accent: "#43a047",
    price: 650,
    maxSpeed: 23,
    accel: 11,
    turn: 2.7,
    wheelie: 5.7,
    size: 1,
    desc: "Dicke Reifen und Federung – fährt auch über Wiesen.",
  },
  {
    id: "z650",
    name: "Kawasaki Z650",
    brand: "Kawasaki",
    kind: "moto",
    style: "naked",
    color: "#2b2f36",
    accent: KAWA_GREEN,
    price: 950,
    maxSpeed: 26,
    accel: 13,
    turn: 2.4,
    wheelie: 5.9,
    size: 1,
    desc: "Starkes Naked Bike mit grünem Gitterrahmen.",
  },
  {
    id: "g4",
    name: "Kukirin G4",
    brand: "Kukirin",
    kind: "scooter",
    style: "offroad",
    color: "#1f2226",
    accent: "#ff7a00",
    price: 1300,
    maxSpeed: 27,
    accel: 15,
    turn: 2.8,
    wheelie: 6.0,
    size: 1.05,
    desc: "Der Offroad-Scooter mit richtig Power.",
  },
  {
    id: "ninja650",
    name: "Kawasaki Ninja 650",
    brand: "Kawasaki",
    kind: "moto",
    style: "sport",
    color: KAWA_GREEN,
    accent: "#1f2226",
    price: 1800,
    maxSpeed: 32,
    accel: 15,
    turn: 2.4,
    wheelie: 6.1,
    size: 1,
    desc: "Sportlich, schnell und bequem.",
  },
  {
    id: "g4max",
    name: "Kukirin G4 Max",
    brand: "Kukirin",
    kind: "scooter",
    style: "offroad",
    color: "#1f2226",
    accent: "#ffc400",
    price: 2400,
    maxSpeed: 33,
    accel: 18,
    turn: 2.8,
    wheelie: 6.3,
    size: 1.1,
    desc: "Der stärkste Kukirin mit Doppelmotor und LED-Licht!",
  },
  {
    id: "z900",
    name: "Kawasaki Z900",
    brand: "Kawasaki",
    kind: "moto",
    style: "naked",
    color: "#50555c",
    accent: KAWA_GREEN,
    price: 3200,
    maxSpeed: 38,
    accel: 18,
    turn: 2.4,
    wheelie: 6.4,
    size: 1.03,
    desc: "Vier Zylinder, viel Kraft, toller Sound.",
  },
  {
    id: "zx6r",
    name: "Kawasaki Ninja ZX-6R",
    brand: "Kawasaki",
    kind: "moto",
    style: "sport",
    color: KAWA_GREEN,
    accent: "#1a1a1a",
    price: 4500,
    maxSpeed: 43,
    accel: 21,
    turn: 2.45,
    wheelie: 6.6,
    size: 1.02,
    desc: "Echte Supersport-Maschine für die Rennstrecke.",
  },
  {
    id: "zx10r",
    name: "Kawasaki Ninja ZX-10R",
    brand: "Kawasaki",
    kind: "moto",
    style: "sport",
    color: "#1a1a1a",
    accent: KAWA_GREEN,
    price: 6500,
    maxSpeed: 49,
    accel: 24,
    turn: 2.5,
    wheelie: 6.8,
    size: 1.05,
    desc: "Superbike-Weltmeister-Technik.",
  },
  {
    id: "h2",
    name: "Kawasaki Ninja H2",
    brand: "Kawasaki",
    kind: "moto",
    style: "hyper",
    color: "#2a2d33",
    accent: KAWA_GREEN,
    price: 9500,
    maxSpeed: 56,
    accel: 28,
    turn: 2.5,
    wheelie: 7.0,
    size: 1.06,
    desc: "Mit Kompressor! Das schnellste Motorrad der Stadt.",
  },
];

// Autos (kein Wheelie – Leertaste = Handbremse)
const car = (
  id: string,
  name: string,
  brand: Brand,
  style: VehicleStyle,
  color: string,
  accent: string,
  price: number,
  maxSpeed: number,
  accel: number,
  turn: number,
  desc: string,
): VehicleDef => ({ id, name, brand, kind: "car", style, color, accent, price, maxSpeed, accel, turn, wheelie: 0, size: 1, desc });

VEHICLES.push(
  car("fiat500", "Fiat 500", "Fiat", "city", "#7ec8e3", "#ffffff", 400, 26, 7, 2.1, "Klein, süß und passt in jede Lücke."),
  car("transporter", "VW Transporter", "VW", "van", "#ffffff", "#ff7a00", 800, 25, 6, 1.8, "Der echte Lieferwagen – mit Lieferblitz-Streifen!"),
  car("golf", "VW Golf GTI", "VW", "hatch", "#c62828", "#111111", 1500, 34, 11, 2.0, "Flotter Kompaktwagen mit rotem Streifen."),
  car("m3", "BMW M3", "BMW", "sedan", "#1565c0", "#90caf9", 3800, 44, 16, 2.0, "Sportlimousine mit viel Kraft."),
  car("911", "Porsche 911 Turbo", "Porsche", "coupe", "#9e9e9e", "#111111", 6000, 50, 20, 2.05, "Der Klassiker mit Heckflügel."),
  car("sf90", "Ferrari SF90", "Ferrari", "super", "#d40000", "#ffd400", 9000, 55, 24, 2.1, "Italienischer Supersportwagen."),
  car("huracan", "Lamborghini Huracán", "Lamborghini", "lambo", "#9bd531", "#111111", 12000, 58, 25, 2.1, "Flach, laut und das schnellste Auto der Stadt."),
);
VEHICLES.push({
  id: "g5",
  name: "Kukirin G5",
  brand: "Kukirin",
  kind: "scooter",
  style: "offroad",
  color: "#111317",
  accent: "#00e5ff",
  price: 1,
  maxSpeed: 139, // 500 km/h!
  accel: 45,
  turn: 2.9,
  wheelie: 7.2,
  size: 1.12,
  desc: "Raketen-Scooter mit 500 km/h! Nur für echte Profis.",
});
VEHICLES.sort((a, b) => a.price - b.price);

export function getVehicle(id: string): VehicleDef {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
}
