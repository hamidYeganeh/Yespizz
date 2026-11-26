export const menu = [
  {
    id: "1",
    key: "american",
    price: 24,
    image: "/menu/american.webp",
    rating: 4.5,
    ratings: 232,
  },
  {
    id: "2",
    key: "margherita",
    price: 19,
    image: "/menu/margherita.jpg",
    rating: 4.7,
    ratings: 184,
  },
] as const;

export type MenuItem = (typeof menu)[number];
