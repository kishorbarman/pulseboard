export const AVAILABLE_INTERESTS = [
  "Artificial Intelligence",
  "Cybersecurity",
  "Software Development",
  "Gadgets & Consumer Tech",
  "Space & Science",
  "Robotics",
  "World News",
  "US Politics",
  "Global Affairs",
  "Climate & Energy",
  "Economy",
  "Markets & Investing",
  "Startups & Business",
  "Personal Finance",
  "Crypto & Web3",
  "Health & Wellness",
  "Fitness",
  "Food & Cooking",
  "Travel",
  "Fashion & Style",
  "Photography",
  "Gaming",
  "Movies & TV",
  "Music",
  "Sports",
  "Books",
  "Design",
  "Productivity",
  "Education & Learning",
  "Careers & Work"
];

export const ONBOARDING_MIN_TOPICS = 3;
export const ONBOARDING_MAX_TOPICS = 10;
export const PROFILE_MAX_TOPICS = 20;

export function shuffleTopics(topics: string[]): string[] {
  const items = [...topics];
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
