interface IconRule {
  keywords: string[];
  emoji: string;
  bg: string;
}

const RULES: IconRule[] = [
  { keywords: ["magnesium", "glycine", "vitamin", "supplement", "melatonin"], emoji: "💊", bg: "bg-indigo-100" },
  { keywords: ["curtain", "blackout"], emoji: "🪟", bg: "bg-amber-100" },
  { keywords: ["noise", "sound"], emoji: "🔊", bg: "bg-purple-100" },
  { keywords: ["blanket", "duvet", "pillow case"], emoji: "🛏️", bg: "bg-rose-100" },
  { keywords: ["cushion", "lumbar", "chair", "desk", "standing", "kneeling", "posture", "brace"], emoji: "🪑", bg: "bg-orange-100" },
  { keywords: ["litter", "cat food", "cat treat", "cat "], emoji: "🐱", bg: "bg-teal-100" },
  { keywords: ["pet hair", "shedding", "vacuum", "brush", "lint"], emoji: "🧹", bg: "bg-cyan-100" },
  { keywords: ["washing", "cleaner", "detergent"], emoji: "🧼", bg: "bg-sky-100" },
  { keywords: ["battery"], emoji: "🔋", bg: "bg-lime-100" },
];

const FALLBACK: IconRule = { keywords: [], emoji: "🛒", bg: "bg-slate-100" };

export function productIcon(name: string): { emoji: string; bg: string } {
  const lower = name.toLowerCase();
  const rule = RULES.find((r) => r.keywords.some((k) => lower.includes(k))) ?? FALLBACK;
  return { emoji: rule.emoji, bg: rule.bg };
}
