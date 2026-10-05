/**
 * species.ts — Common lumber species catalog with approximate weight data.
 *
 * Densities are approximate pounds per board foot at ~12% moisture content
 * (air-dried/kiln-dried reference). They are estimates for planning and
 * shipping, NOT engineering values. The weight calculator on
 * https://boardfootcalc.net/ is the reference for the same approach.
 */

export type SpeciesType = 'hardwood' | 'softwood';

export interface Species {
  name: string;
  aliases: string[];
  scientificName: string;
  type: SpeciesType;
  /** Approximate lb per board foot at ~12% MC. */
  lbPerBF: number;
  notes: string;
}

export const SPECIES: Species[] = [
  { name: 'Black Walnut', aliases: ['walnut', 'american walnut'], scientificName: 'Juglans nigra', type: 'hardwood', lbPerBF: 3.5, notes: 'Premium furniture species; bills by quarter thickness.' },
  { name: 'White Oak', aliases: ['oak', 'white oak'], scientificName: 'Quercus alba', type: 'hardwood', lbPerBF: 4.6, notes: 'Heavier than red oak; common for millwork.' },
  { name: 'Red Oak', aliases: ['red oak', 'northern red oak'], scientificName: 'Quercus rubra', type: 'hardwood', lbPerBF: 4.3, notes: 'Most common cabinet hardwood in North America.' },
  { name: 'Hard Maple', aliases: ['maple', 'sugar maple', 'hard maple'], scientificName: 'Acer saccharum', type: 'hardwood', lbPerBF: 4.4, notes: 'Dense; used for butcher blocks and flooring.' },
  { name: 'Soft Maple', aliases: ['soft maple', 'silver maple'], scientificName: 'Acer rubrum', type: 'hardwood', lbPerBF: 3.4, notes: 'Easier to machine than hard maple.' },
  { name: 'Cherry', aliases: ['black cherry', 'american cherry'], scientificName: 'Prunus serotina', type: 'hardwood', lbPerBF: 3.4, notes: 'Stable, prized for furniture.' },
  { name: 'White Ash', aliases: ['ash', 'american ash'], scientificName: 'Fraxinus americana', type: 'hardwood', lbPerBF: 4.0, notes: 'Bends well; tool handles and furniture.' },
  { name: 'Hickory', aliases: ['pecan'], scientificName: 'Carya spp.', type: 'hardwood', lbPerBF: 5.1, notes: 'Very heavy and strong.' },
  { name: 'Yellow Poplar', aliases: ['poplar', 'tulip poplar', 'tulipwood'], scientificName: 'Liriodendron tulipifera', type: 'hardwood', lbPerBF: 3.0, notes: 'Cheap, stable paint-grade hardwood.' },
  { name: 'Honduran Mahogany', aliases: ['mahogany', 'genuine mahogany'], scientificName: 'Swietenia macrophylla', type: 'hardwood', lbPerBF: 3.3, notes: 'Classic boat and furniture wood.' },
  { name: 'Yellow Birch', aliases: ['birch', 'paper birch'], scientificName: 'Betula alleghaniensis', type: 'hardwood', lbPerBF: 4.4, notes: 'Plywood face veneer and millwork.' },
  { name: 'American Beech', aliases: ['beech'], scientificName: 'Fagus grandifolia', type: 'hardwood', lbPerBF: 4.8, notes: 'Heavy, hard; steam bending.' },
  { name: 'Red Alder', aliases: ['alder'], scientificName: 'Alnus rubra', type: 'hardwood', lbPerBF: 3.0, notes: 'Pacific NW paint-grade hardwood.' },
  { name: 'Teak', aliases: [], scientificName: 'Tectona grandis', type: 'hardwood', lbPerBF: 3.9, notes: 'Weather-resistant; decks and outdoor furniture.' },
  { name: 'Eastern White Pine', aliases: ['white pine', 'pine'], scientificName: 'Pinus strobus', type: 'softwood', lbPerBF: 2.5, notes: 'Knotty or clear; furniture and trim.' },
  { name: 'Douglas Fir', aliases: ['doug fir', 'fir'], scientificName: 'Pseudotsuga menziesii', type: 'softwood', lbPerBF: 3.5, notes: 'Structural and appearance grades.' },
  { name: 'Western Red Cedar', aliases: ['cedar', 'red cedar'], scientificName: 'Thuja plicata', type: 'softwood', lbPerBF: 2.4, notes: 'Light, rot-resistant; outdoor.' },
  { name: 'Southern Yellow Pine', aliases: ['syp', 'yellow pine'], scientificName: 'Pinus palustris & spp.', type: 'softwood', lbPerBF: 3.6, notes: 'Strong softwood; framing and decking.' },
  { name: 'Sitka Spruce', aliases: ['spruce'], scientificName: 'Picea sitchensis', type: 'softwood', lbPerBF: 2.6, notes: 'Light and stiff; aircraft and soundboards.' },
];

export function lookupSpecies(name: string): Species | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return (
    SPECIES.find((s) => s.name.toLowerCase() === key) ??
    SPECIES.find((s) => s.aliases.some((a) => a.toLowerCase() === key)) ??
    SPECIES.find((s) => s.name.toLowerCase().includes(key) || s.aliases.some((a) => a.toLowerCase().includes(key))) ??
    null
  );
}

export function speciesNames(): string[] {
  return SPECIES.map((s) => s.name);
}

export type MoistureState = 'green' | 'air-dried' | 'kiln-dried';

/**
 * Approximate weight multiplier vs the 12% MC reference density.
 * Green lumber can be substantially heavier than kiln-dried.
 */
export const MOISTURE_FACTOR: Record<MoistureState, number> = {
  green: 1.25,
  'air-dried': 0.95,
  'kiln-dried': 0.85,
};

/** Estimated weight in pounds for a volume of lumber. */
export function weightLbs(bf: number, species: Species, moisture: MoistureState = 'air-dried'): number {
  return bf * species.lbPerBF * MOISTURE_FACTOR[moisture];
}

/** Estimated weight for a volume of lumber by species name (null when unknown). */
export function weightLbsByName(bf: number, speciesName: string, moisture: MoistureState = 'air-dried'): number | null {
  const sp = lookupSpecies(speciesName);
  if (!sp) return null;
  return weightLbs(bf, sp, moisture);
}
