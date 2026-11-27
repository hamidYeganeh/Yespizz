export const steps = ['name', 'location', 'handle', 'specialties'] as const;
export type Step = (typeof steps)[number];
export type Profile = {
  name: string;
  city: string;
  handle: string;
  specialties: string[];
};
export const groups = {
  'From the kitchen': [
    'Pizza',
    'Pasta',
    'Burgers',
    'Sushi',
    'Bakery',
    'Seasonal',
  ],
  'Dining options': ['Dine-in', 'Takeaway', 'Delivery', 'Catering'],
  'Dietary options': ['Vegetarian', 'Vegan', 'Gluten-free'],
};
export function nextStep(profile: Profile) {
  if (!profile.name) return 'name';
  if (!profile.city) return 'location';
  if (!profile.handle) return 'handle';
  if (!profile.specialties.length) return 'specialties';
  return 'complete';
}
