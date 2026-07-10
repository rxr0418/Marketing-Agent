export type Verdict = "ambiguous_discard" | "convergent_keep";
export type Confidence = "high" | "medium" | "low";

export type TraceStep =
  | { kind: "thought"; text: string }
  | { kind: "evaluate_signal"; item: string; verdict: Verdict; group?: string; reasoning: string }
  | {
      kind: "identify_need";
      need: string;
      confidence: Confidence;
      supporting_items: string[];
      considered_but_avoided_labels?: string[];
    }
  | {
      kind: "web_search";
      query: string;
      results: { title: string; url: string }[];
      error?: string;
    }
  | { kind: "capstone"; text: string };

export interface Product {
  name: string;
  reason: string;
  sourceUrl?: string; // set when the live agent verified this is a real product via web_search
}

export interface Campaign {
  need: string;
  confidence: Confidence;
  headline: string;
  subheadline: string;
  products: Product[];
}

export interface PurchaseHistory {
  id: "A" | "B";
  label: string;
  items: string[];
  cached: {
    trace: TraceStep[];
    campaigns: Campaign[]; // sorted highest-confidence first; each is single-theme
  };
}

export const PURCHASE_HISTORIES: PurchaseHistory[] = [
  {
    id: "A",
    label: "Purchase History 1",
    items: [
      "NOW Foods Glycine 1000mg, 120 capsules — picked up Jul 7",
      "Huggies Simply Clean Unscented Baby Wipes, 704 ct (Huge Value Pack) — picked up Jun 27",
      "Whole Foods Market purchase: 2x dark tonic/juice bottles + 2 more items",
      "Allergy Asthma Clean — Allergen Spray, concentrate refill — picked up Jun 19",
      "LIASTRON Tennis Ball Hopper Basket — picked up Jun 15",
      "Life Extension Neuro-Mag Magnesium L-Threonate, 90 capsules — picked up Jun 14",
      "Swihauk 600-Sheet Extra Sticky Lint Roller Refill — picked up Jun 5",
    ],
    cached: {
      trace: [
        {
          kind: "thought",
          text: "Scanning the purchase history for signals. I'll flag ambiguous single-item signals separately from convergent groups before drawing any conclusions.",
        },
        {
          kind: "evaluate_signal",
          item: "Huggies Simply Clean Baby Wipes, 704 ct",
          verdict: "ambiguous_discard",
          reasoning:
            "Bulk wipes alone are compatible with many situations (infant, pet, general cleaning). No reinforcing item elsewhere ties this to one specific cause — not using this to draw any conclusion about who this customer is.",
        },
        {
          kind: "evaluate_signal",
          item: "Allergy Asthma Clean Allergen Spray (refill)",
          verdict: "ambiguous_discard",
          reasoning:
            "A refill shows recurring use, but on its own it doesn't specify what's disrupting the household. Kept only as light supporting context.",
        },
        {
          kind: "evaluate_signal",
          item: "Tennis Ball Hopper Basket + 600ct Lint Roller Refill",
          verdict: "ambiguous_discard",
          reasoning:
            "Informative about shopping style (bulk buyer, keeps an active hobby) but not about a core, addressable need.",
        },
        {
          kind: "evaluate_signal",
          item: "NOW Glycine 1000mg + Life Extension Neuro-Mag Magnesium L-Threonate",
          verdict: "convergent_keep",
          group: "sleep_stack",
          reasoning:
            "This exact two-supplement pairing is a well-known sleep-support combination (calming amino acid + a magnesium form associated with sleep and cognition). Two independent purchases reinforcing the same mechanism is much stronger evidence than either alone.",
        },
        {
          kind: "identify_need",
          need: "Poor sleep quality, likely frequent nighttime waking (e.g. around 3am)",
          confidence: "high",
          supporting_items: ["NOW Glycine 1000mg", "Life Extension Neuro-Mag Magnesium L-Threonate"],
          considered_but_avoided_labels: ["new parent", "pet owner", "elderly"],
        },
        { kind: "capstone", text: "Proposed 1 single-theme campaign (only one need cleared the confidence bar)." },
      ],
      campaigns: [
        {
          need: "Poor sleep quality, likely frequent nighttime waking (e.g. around 3am)",
          confidence: "high",
          headline: "Still Waking Up at 3am? Prime Day Has You Covered.",
          subheadline:
            "Restock the sleep stack you already trust — plus a few upgrades that might help more than another supplement.",
          products: [
            {
              name: "NOW Foods Glycine 1000mg, 100 Veg Capsules",
              reason: "Your usual sleep stack, restocked automatically so one bad night never turns into a bad week.",
              sourceUrl: "https://www.nowfoods.com/products/supplements/glycine-1000-mg-veg-capsules",
            },
            {
              name: "Life Extension Neuro-Mag Magnesium L-Threonate, 90 Capsules",
              reason: "The other half of the stack you already buy — restocked at the same time so you're never missing one half of the combo.",
              sourceUrl: "https://www.lifeextension.com/vitamins-supplements/item01603/neuro-mag-magnesium-l-threonate",
            },
            {
              name: "NICETOWN Blackout Thermal Insulated Grommet Curtains",
              reason:
                "Light exposure is one of the most common reasons a sleep stack alone doesn't fully fix 3am wake-ups.",
              sourceUrl: "https://nicetown.com/products/blackout-thermal-insulated-grommet-drapes",
            },
            {
              name: "LectroFan EVO White Noise Machine",
              reason: "Built for exactly the symptom you're dealing with — staying asleep, not just falling asleep.",
              sourceUrl: "https://www.lectrofan.com/products/lectrofan-evo",
            },
          ],
        },
      ],
    },
  },
  {
    id: "B",
    label: "Purchase History 2",
    items: [
      "Whole Foods Market purchase: jalapeño pepper",
      "Philips CR2025 3V Lithium Coin Battery, 5-pack — picked up Jun 29",
      "IWOOFI Washing Machine Cleaner, pet formula, 1-year supply — picked up Jun 29",
      "Vital Essentials Freeze Dried Raw Chicken Hearts, cat treats — picked up Jun 29",
      "Return started: lavender diaper-style backpack (refund pending)",
      "ARM & HAMMER Clump & Seal Slide Platinum Cat Litter, 18 lb, multi-cat formula — delivered Jun 25",
      "VOCH GALA Nipple Covers, 2 pairs — delivered Jun 25",
      "Instinct Ultimate Protein Natural Dry Cat Food, grain-free — picked up Jun 26",
      "Small Trash Bags, 4 Gallon Drawstring — picked up Jun 25",
      "Grocery delivery (Jun 24): potatoes, avocado, peaches, Just Bare chicken thighs, cacao nibs, oranges",
      "Energizer Alkaline AAA Battery, 32-pack — picked up Jun 24",
      "Return started: Dyson pet-hair motorized brush attachment (refund pending)",
      "Whole Foods Market purchase: fresh herb sprig",
      "Whole Foods Market purchase: juice bottle + 9 more items",
      "curble Wider — Ergonomic Kneeling Desk Chair — delivered Jun 17",
      "FREETOO Lower Back Support Brace — delivered Jun 16",
    ],
    cached: {
      trace: [
        {
          kind: "thought",
          text: "Longer history this time — I'll work through the ambiguous items first so they don't leak into the needs I'm more confident about.",
        },
        {
          kind: "evaluate_signal",
          item: "VOCH GALA Nipple Covers, 2 pairs",
          verdict: "ambiguous_discard",
          reasoning:
            "A common fashion/apparel item, not specific to pregnancy, parenting, or any single demographic. No reinforcing signal elsewhere — not using this for any conclusion.",
        },
        {
          kind: "evaluate_signal",
          item: "Return started: diaper-style backpack",
          verdict: "ambiguous_discard",
          reasoning:
            "This item was returned, not kept — that weakens rather than supports any baby-related conclusion.",
        },
        {
          kind: "evaluate_signal",
          item: "Coin battery, AAA 32-pack, drawstring trash bags",
          verdict: "ambiguous_discard",
          reasoning: "Routine household restocking — not informative about a specific need on its own.",
        },
        {
          kind: "evaluate_signal",
          item: "Whole Foods / grocery basket: jalapeño, herbs, potatoes, avocado, chicken thighs, cacao nibs, oranges",
          verdict: "ambiguous_discard",
          reasoning:
            "Indicates general health-conscious cooking, but doesn't sharpen either core need further. Kept only as light supporting context.",
        },
        {
          kind: "evaluate_signal",
          item:
            "ARM & HAMMER multi-cat litter + Vital Essentials freeze-dried chicken hearts + Instinct grain-free dry cat food + IWOOFI pet-formula washing machine cleaner",
          verdict: "convergent_keep",
          group: "multi_cat_household",
          reasoning:
            "Four independent purchases spanning litter, treats, staple food, and pet-bedding cleaning all reinforce an established, premium multi-cat care routine.",
        },
        {
          kind: "evaluate_signal",
          item: "Return started: Dyson pet-hair motorized brush attachment",
          verdict: "convergent_keep",
          group: "unsolved_pet_hair",
          reasoning:
            "Combined with the multi-cat signal, this shows an attempted-but-unsatisfying solution to shedding/hair — an open, unresolved need rather than a settled one.",
        },
        {
          kind: "evaluate_signal",
          item: "curble Wider ergonomic kneeling chair + FREETOO lower-back support brace",
          verdict: "convergent_keep",
          group: "back_pain",
          reasoning:
            "Two different solution types (long-term posture correction and immediate support) purchased about a day apart, targeting the same body area — a strong signal of active, unresolved back pain, likely linked to prolonged sitting.",
        },
        {
          kind: "identify_need",
          need: "Lower back / posture pain, likely from prolonged sitting",
          confidence: "high",
          supporting_items: ["curble Wider ergonomic kneeling chair", "FREETOO lower-back support brace"],
          considered_but_avoided_labels: ["office worker", "elderly", "pregnant"],
        },
        {
          kind: "identify_need",
          need: "Ongoing multi-cat shedding / hair management, not yet solved",
          confidence: "medium",
          supporting_items: ["ARM & HAMMER multi-cat litter", "Return: Dyson pet-hair attachment"],
          considered_but_avoided_labels: ["single person", "\"crazy cat lady\""],
        },
        {
          kind: "capstone",
          text: "Proposed 2 single-theme campaigns — kept separate rather than blended into one headline.",
        },
      ],
      campaigns: [
        {
          need: "Lower back / posture pain, likely from prolonged sitting",
          confidence: "high",
          headline: "Your Back Isn't Getting Better On Its Own.",
          subheadline: "Prime Day deals to complement your desk chair setup.",
          products: [
            {
              name: "Everlasting Comfort Lumbar Support Pillow for Office Chair",
              reason: "Adds lower-back-specific support your kneeling chair alone may not fully provide.",
              sourceUrl: "https://everlastingcomfort.com/products/back-cushion-lumbar-support-pillow",
            },
            {
              name: "FEZIBO Height Adjustable Standing Desk Converter (Series DC)",
              reason:
                "If the chair swap hasn't fully fixed it, alternating sit/stand often helps more than any single chair.",
              sourceUrl: "https://www.fezibo.com/products/fezibo-standing-desk-converter-series-dc",
            },
          ],
        },
        {
          need: "Ongoing multi-cat shedding / hair management, not yet solved",
          confidence: "medium",
          headline: "The Shedding Problem Your Last Fix Didn't Solve",
          subheadline: "A different approach to multi-cat hair control this Prime Day.",
          products: [
            {
              name: "ChomChom Roller Reusable Pet Hair Remover",
              reason: "Since the motorized brush attachment got returned, here's a different approach to the same shedding problem.",
              sourceUrl: "https://www.amazon.com/Pet-Dog-Cat-Hair-Remover-Couch/dp/B00BAGTNAQ",
            },
            {
              name: "ARM & HAMMER Slide Easy Clean-Up Clumping Litter, Multi-Cat",
              reason: "Your usual multi-cat formula, restocked automatically.",
              sourceUrl:
                "https://www.armandhammer.com/en/cat-litter/premium-cat-litter/slide-cat-litter/slide-easy-clean-up-clumping-litter-multi-cat-40-lb",
            },
          ],
        },
      ],
    },
  },
];

export function getHistory(id: "A" | "B"): PurchaseHistory {
  const h = PURCHASE_HISTORIES.find((h) => h.id === id);
  if (!h) throw new Error(`Unknown history: ${id}`);
  return h;
}
