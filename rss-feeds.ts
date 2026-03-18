export type FeedTier = 'A' | 'B' | 'C';

export interface RssFeedSource {
  name: string;
  url: string;
  tier: FeedTier;
  domains: string[];
}

interface InterestFeedDefinition {
  query: string;
  tier: FeedTier;
  domains: string[];
}

const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const GOOGLE_NEWS_SUFFIX = "hl=en-US&gl=US&ceid=US:en";

function googleNewsUrl(query: string): string {
  return `${GOOGLE_NEWS_BASE}?q=${encodeURIComponent(query)}&${GOOGLE_NEWS_SUFFIX}`;
}

function siteQuery(topic: string, sites: string[]): string {
  return `${topic} (${sites.map((s) => `site:${s}`).join(" OR ")})`;
}

const TIERS = {
  authorityGlobal: ["reuters.com", "apnews.com", "bbc.com"],
  authorityBusiness: ["reuters.com", "bloomberg.com", "wsj.com", "economist.com"],
  authorityTech: ["technologyreview.com", "arstechnica.com", "theverge.com", "wired.com"],
  authorityHealth: ["who.int", "cdc.gov", "nih.gov", "statnews.com"],
  authorityScience: ["nasa.gov", "esa.int", "nature.com", "sciencemag.org"],
  specialistTech: ["techcrunch.com", "venturebeat.com", "infoq.com", "spectrum.ieee.org"],
  specialistPolicy: ["politico.com", "thehill.com", "foreignpolicy.com", "npr.org"],
  specialistFinance: ["cnbc.com", "marketwatch.com", "ft.com", "yahoo.com"],
  specialistCyber: ["krebsonsecurity.com", "bleepingcomputer.com", "darkreading.com", "thehackernews.com"],
  specialistLifestyle: ["seriouseats.com", "cntraveler.com", "lonelyplanet.com", "travelandleisure.com"],
  specialistCulture: ["variety.com", "hollywoodreporter.com", "billboard.com", "pitchfork.com"],
  communityTech: ["github.blog", "web.dev", "smashingmagazine.com", "dev.to"],
  communityCreative: ["uxdesign.cc", "dezeen.com", "creativebloq.com", "petapixel.com"],
};

const INTEREST_FEEDS: Record<string, InterestFeedDefinition[]> = {
  "Artificial Intelligence": [
    { query: siteQuery("artificial intelligence", ["technologyreview.com", "reuters.com", "theverge.com", "openai.com"]), tier: 'A', domains: ["technologyreview.com", "reuters.com", "theverge.com", "openai.com"] },
    { query: siteQuery("AI regulation policy", [...TIERS.authorityGlobal, "ft.com"]), tier: 'A', domains: [...TIERS.authorityGlobal, "ft.com"] },
    { query: siteQuery("generative AI product launch", TIERS.specialistTech), tier: 'B', domains: TIERS.specialistTech },
    { query: "open source LLM benchmark updates", tier: 'C', domains: TIERS.communityTech },
  ],
  "Machine Learning": [
    { query: siteQuery("machine learning research", ["nature.com", "sciencemag.org", "technologyreview.com", "reuters.com"]), tier: 'A', domains: ["nature.com", "sciencemag.org", "technologyreview.com", "reuters.com"] },
    { query: siteQuery("deep learning model release", ["arstechnica.com", "theverge.com", "venturebeat.com", "ai.googleblog.com"]), tier: 'B', domains: ["arstechnica.com", "theverge.com", "venturebeat.com", "ai.googleblog.com"] },
    { query: siteQuery("ML engineering best practices", ["infoq.com", "github.blog", "web.dev", "dev.to"]), tier: 'C', domains: ["infoq.com", "github.blog", "web.dev", "dev.to"] },
  ],
  "Web Development": [
    { query: siteQuery("web platform browser standards", ["web.dev", "w3.org", "developer.mozilla.org", "arstechnica.com"]), tier: 'A', domains: ["web.dev", "w3.org", "developer.mozilla.org", "arstechnica.com"] },
    { query: siteQuery("frontend backend framework release", ["infoq.com", "smashingmagazine.com", "css-tricks.com", "theverge.com"]), tier: 'B', domains: ["infoq.com", "smashingmagazine.com", "css-tricks.com", "theverge.com"] },
    { query: siteQuery("javascript react tutorials", ["web.dev", "smashingmagazine.com", "dev.to", "css-tricks.com"]), tier: 'C', domains: ["web.dev", "smashingmagazine.com", "dev.to", "css-tricks.com"] },
  ],
  "Cybersecurity": [
    { query: siteQuery("cybersecurity critical vulnerability", ["cisa.gov", "reuters.com", "apnews.com", "bbc.com"]), tier: 'A', domains: ["cisa.gov", "reuters.com", "apnews.com", "bbc.com"] },
    { query: siteQuery("ransomware zero day incident", TIERS.specialistCyber), tier: 'A', domains: TIERS.specialistCyber },
    { query: siteQuery("security analysis threat intel", ["darkreading.com", "krebsonsecurity.com", "bleepingcomputer.com", "thehackernews.com"]), tier: 'B', domains: ["darkreading.com", "krebsonsecurity.com", "bleepingcomputer.com", "thehackernews.com"] },
  ],
  "Space Exploration": [
    { query: siteQuery("space mission launch", ["nasa.gov", "esa.int", "reuters.com", "apnews.com"]), tier: 'A', domains: ["nasa.gov", "esa.int", "reuters.com", "apnews.com"] },
    { query: siteQuery("space station satellite policy", ["spacenews.com", "arstechnica.com", "bbc.com", "nature.com"]), tier: 'B', domains: ["spacenews.com", "arstechnica.com", "bbc.com", "nature.com"] },
  ],
  Robotics: [
    { query: siteQuery("robotics industrial automation", ["spectrum.ieee.org", "reuters.com", "technologyreview.com", "apnews.com"]), tier: 'A', domains: ["spectrum.ieee.org", "reuters.com", "technologyreview.com", "apnews.com"] },
    { query: siteQuery("humanoid robot deployment", ["therobotreport.com", "roboticsbusinessreview.com", "techcrunch.com", "arstechnica.com"]), tier: 'B', domains: ["therobotreport.com", "roboticsbusinessreview.com", "techcrunch.com", "arstechnica.com"] },
  ],
  "Data Science": [
    { query: siteQuery("data science analytics platform", ["reuters.com", "technologyreview.com", "databricks.com", "oreilly.com"]), tier: 'A', domains: ["reuters.com", "technologyreview.com", "databricks.com", "oreilly.com"] },
    { query: siteQuery("data engineering lakehouse", ["infoq.com", "kdnuggets.com", "towardsdatascience.com", "venturebeat.com"]), tier: 'B', domains: ["infoq.com", "kdnuggets.com", "towardsdatascience.com", "venturebeat.com"] },
  ],
  Gadgets: [
    { query: siteQuery("new smartphone laptop launch", ["theverge.com", "arstechnica.com", "reuters.com", "cnet.com"]), tier: 'A', domains: ["theverge.com", "arstechnica.com", "reuters.com", "cnet.com"] },
    { query: siteQuery("gadget reviews wearables", ["engadget.com", "theverge.com", "wired.com", "cnet.com"]), tier: 'B', domains: ["engadget.com", "theverge.com", "wired.com", "cnet.com"] },
  ],
  "World News": [
    { query: siteQuery("world news", [...TIERS.authorityGlobal, "aljazeera.com"]), tier: 'A', domains: [...TIERS.authorityGlobal, "aljazeera.com"] },
    { query: siteQuery("global diplomacy conflict", ["reuters.com", "apnews.com", "bbc.com", "foreignpolicy.com"]), tier: 'A', domains: ["reuters.com", "apnews.com", "bbc.com", "foreignpolicy.com"] },
    { query: siteQuery("world analysis", ["npr.org", "theguardian.com", "bbc.com", "reuters.com"]), tier: 'B', domains: ["npr.org", "theguardian.com", "bbc.com", "reuters.com"] },
  ],
  "US Politics": [
    { query: siteQuery("US congress white house", ["reuters.com", "apnews.com", "politico.com", "thehill.com"]), tier: 'A', domains: ["reuters.com", "apnews.com", "politico.com", "thehill.com"] },
    { query: siteQuery("federal policy regulation", ["npr.org", "wsj.com", "politico.com", "reuters.com"]), tier: 'B', domains: ["npr.org", "wsj.com", "politico.com", "reuters.com"] },
  ],
  "Global Politics": [
    { query: siteQuery("geopolitics diplomacy sanctions", ["reuters.com", "bbc.com", "apnews.com", "foreignpolicy.com"]), tier: 'A', domains: ["reuters.com", "bbc.com", "apnews.com", "foreignpolicy.com"] },
    { query: siteQuery("UN NATO treaty negotiations", ["foreignpolicy.com", "npr.org", "aljazeera.com", "bbc.com"]), tier: 'B', domains: ["foreignpolicy.com", "npr.org", "aljazeera.com", "bbc.com"] },
  ],
  Economics: [
    { query: siteQuery("inflation GDP interest rates", TIERS.authorityBusiness), tier: 'A', domains: TIERS.authorityBusiness },
    { query: siteQuery("central bank labor market", ["reuters.com", "bloomberg.com", "wsj.com", "cnbc.com"]), tier: 'A', domains: ["reuters.com", "bloomberg.com", "wsj.com", "cnbc.com"] },
    { query: siteQuery("economic outlook analysis", TIERS.specialistFinance), tier: 'B', domains: TIERS.specialistFinance },
  ],
  "Climate Change": [
    { query: siteQuery("climate policy emissions", ["reuters.com", "bbc.com", "apnews.com", "carbonbrief.org"]), tier: 'A', domains: ["reuters.com", "bbc.com", "apnews.com", "carbonbrief.org"] },
    { query: siteQuery("renewable energy adaptation", ["carbonbrief.org", "climatechangenews.com", "theguardian.com", "nature.com"]), tier: 'B', domains: ["carbonbrief.org", "climatechangenews.com", "theguardian.com", "nature.com"] },
  ],
  Startups: [
    { query: siteQuery("startup funding series A", ["reuters.com", "wsj.com", "bloomberg.com", "techcrunch.com"]), tier: 'A', domains: ["reuters.com", "wsj.com", "bloomberg.com", "techcrunch.com"] },
    { query: siteQuery("founder venture funding", ["techcrunch.com", "ycombinator.com", "venturebeat.com", "forbes.com"]), tier: 'B', domains: ["techcrunch.com", "ycombinator.com", "venturebeat.com", "forbes.com"] },
  ],
  Cryptocurrency: [
    { query: siteQuery("bitcoin ethereum regulation ETF", ["reuters.com", "bloomberg.com", "wsj.com", "coindesk.com"]), tier: 'A', domains: ["reuters.com", "bloomberg.com", "wsj.com", "coindesk.com"] },
    { query: siteQuery("crypto market blockchain protocol", ["coindesk.com", "theblock.co", "cointelegraph.com", "decrypt.co"]), tier: 'B', domains: ["coindesk.com", "theblock.co", "cointelegraph.com", "decrypt.co"] },
  ],
  "Venture Capital": [
    { query: siteQuery("venture capital fund close", ["reuters.com", "bloomberg.com", "wsj.com", "pitchbook.com"]), tier: 'A', domains: ["reuters.com", "bloomberg.com", "wsj.com", "pitchbook.com"] },
    { query: siteQuery("VC deal flow valuation", ["pitchbook.com", "techcrunch.com", "nvca.org", "forbes.com"]), tier: 'B', domains: ["pitchbook.com", "techcrunch.com", "nvca.org", "forbes.com"] },
  ],
  Fintech: [
    { query: siteQuery("fintech regulation digital payments", ["reuters.com", "bloomberg.com", "wsj.com", "cnbc.com"]), tier: 'A', domains: ["reuters.com", "bloomberg.com", "wsj.com", "cnbc.com"] },
    { query: siteQuery("neobank payment rails", ["finextra.com", "techcrunch.com", "forbes.com", "cnbc.com"]), tier: 'B', domains: ["finextra.com", "techcrunch.com", "forbes.com", "cnbc.com"] },
  ],
  "Stock Market": [
    { query: siteQuery("stock market S&P Nasdaq earnings", ["reuters.com", "bloomberg.com", "wsj.com", "marketwatch.com"]), tier: 'A', domains: ["reuters.com", "bloomberg.com", "wsj.com", "marketwatch.com"] },
    { query: siteQuery("analyst downgrade upgrade guidance", ["cnbc.com", "marketwatch.com", "yahoo.com", "reuters.com"]), tier: 'B', domains: ["cnbc.com", "marketwatch.com", "yahoo.com", "reuters.com"] },
  ],
  Cooking: [
    { query: siteQuery("cooking chef recipe", ["seriouseats.com", "nytimes.com", "bonappetit.com", "food52.com"]), tier: 'A', domains: ["seriouseats.com", "nytimes.com", "bonappetit.com", "food52.com"] },
    { query: siteQuery("seasonal recipe meal planning", ["seriouseats.com", "bonappetit.com", "food52.com", "theguardian.com"]), tier: 'B', domains: ["seriouseats.com", "bonappetit.com", "food52.com", "theguardian.com"] },
  ],
  "Fitness & Health": [
    { query: siteQuery("public health guidelines fitness", [...TIERS.authorityHealth]), tier: 'A', domains: [...TIERS.authorityHealth] },
    { query: siteQuery("exercise nutrition recovery", ["nytimes.com", "statnews.com", "who.int", "healthline.com"]), tier: 'B', domains: ["nytimes.com", "statnews.com", "who.int", "healthline.com"] },
  ],
  Travel: [
    { query: siteQuery("travel advisories airline disruptions", ["reuters.com", "bbc.com", "apnews.com", "thepointsguy.com"]), tier: 'A', domains: ["reuters.com", "bbc.com", "apnews.com", "thepointsguy.com"] },
    { query: siteQuery("destination guide tourism", ["lonelyplanet.com", "cntraveler.com", "travelandleisure.com", "thepointsguy.com"]), tier: 'B', domains: ["lonelyplanet.com", "cntraveler.com", "travelandleisure.com", "thepointsguy.com"] },
  ],
  Fashion: [
    { query: siteQuery("fashion industry earnings runway", ["businessoffashion.com", "wwd.com", "reuters.com", "vogue.com"]), tier: 'A', domains: ["businessoffashion.com", "wwd.com", "reuters.com", "vogue.com"] },
    { query: siteQuery("fashion trend report", ["vogue.com", "fashionista.com", "wwd.com", "businessoffashion.com"]), tier: 'B', domains: ["vogue.com", "fashionista.com", "wwd.com", "businessoffashion.com"] },
  ],
  Photography: [
    { query: siteQuery("camera industry launch", ["reuters.com", "dpreview.com", "petapixel.com", "digitalcameraworld.com"]), tier: 'A', domains: ["reuters.com", "dpreview.com", "petapixel.com", "digitalcameraworld.com"] },
    { query: siteQuery("photography editing workflow", ["petapixel.com", "fstoppers.com", "dpreview.com", "digitalcameraworld.com"]), tier: 'B', domains: ["petapixel.com", "fstoppers.com", "dpreview.com", "digitalcameraworld.com"] },
  ],
  Gaming: [
    { query: siteQuery("gaming industry release earnings", ["reuters.com", "ign.com", "polygon.com", "gamesradar.com"]), tier: 'A', domains: ["reuters.com", "ign.com", "polygon.com", "gamesradar.com"] },
    { query: siteQuery("game patch esports", ["ign.com", "polygon.com", "gamesradar.com", "kotaku.com"]), tier: 'B', domains: ["ign.com", "polygon.com", "gamesradar.com", "kotaku.com"] },
  ],
  "Movies & TV": [
    { query: siteQuery("streaming box office", ["variety.com", "hollywoodreporter.com", "deadline.com", "reuters.com"]), tier: 'A', domains: ["variety.com", "hollywoodreporter.com", "deadline.com", "reuters.com"] },
    { query: siteQuery("movie trailer casting", ["variety.com", "hollywoodreporter.com", "indiewire.com", "deadline.com"]), tier: 'B', domains: ["variety.com", "hollywoodreporter.com", "indiewire.com", "deadline.com"] },
  ],
  Music: [
    { query: siteQuery("music charts industry", ["billboard.com", "reuters.com", "rollingstone.com", "pitchfork.com"]), tier: 'A', domains: ["billboard.com", "reuters.com", "rollingstone.com", "pitchfork.com"] },
    { query: siteQuery("album release tour", ["billboard.com", "pitchfork.com", "rollingstone.com", "nme.com"]), tier: 'B', domains: ["billboard.com", "pitchfork.com", "rollingstone.com", "nme.com"] },
  ],
  Sports: [
    { query: siteQuery("sports major league updates", ["reuters.com", "apnews.com", "espn.com", "bbc.com"]), tier: 'A', domains: ["reuters.com", "apnews.com", "espn.com", "bbc.com"] },
    { query: siteQuery("playoff championship transfer", ["espn.com", "skysports.com", "bbc.com", "reuters.com"]), tier: 'B', domains: ["espn.com", "skysports.com", "bbc.com", "reuters.com"] },
  ],
  "Books & Literature": [
    { query: siteQuery("book release literary prize", ["nytimes.com", "theguardian.com", "lithub.com", "parisreview.org"]), tier: 'A', domains: ["nytimes.com", "theguardian.com", "lithub.com", "parisreview.org"] },
    { query: siteQuery("author interview review", ["lithub.com", "bookriot.com", "parisreview.org", "nytimes.com"]), tier: 'B', domains: ["lithub.com", "bookriot.com", "parisreview.org", "nytimes.com"] },
  ],
  Design: [
    { query: siteQuery("design industry product design", ["dezeen.com", "smashingmagazine.com", "reuters.com", "creativebloq.com"]), tier: 'A', domains: ["dezeen.com", "smashingmagazine.com", "reuters.com", "creativebloq.com"] },
    { query: siteQuery("UX accessibility interaction", ["smashingmagazine.com", "uxdesign.cc", "creativebloq.com", "dezeen.com"]), tier: 'B', domains: ["smashingmagazine.com", "uxdesign.cc", "creativebloq.com", "dezeen.com"] },
  ],
  "Open Source": [
    { query: siteQuery("open source security patch", ["reuters.com", "lwn.net", "github.blog", "infoq.com"]), tier: 'A', domains: ["reuters.com", "lwn.net", "github.blog", "infoq.com"] },
    { query: siteQuery("maintainer release changelog", ["github.blog", "lwn.net", "opensource.com", "infoq.com"]), tier: 'B', domains: ["github.blog", "lwn.net", "opensource.com", "infoq.com"] },
  ],
  Productivity: [
    { query: siteQuery("workplace productivity research", ["hbr.org", "nytimes.com", "theguardian.com", "reuters.com"]), tier: 'A', domains: ["hbr.org", "nytimes.com", "theguardian.com", "reuters.com"] },
    { query: siteQuery("workflow automation tools", ["zapier.com", "notion.com", "todoist.com", "lifehacker.com"]), tier: 'B', domains: ["zapier.com", "notion.com", "todoist.com", "lifehacker.com"] },
    { query: siteQuery("productivity habits", ["lifehacker.com", "todoist.com", "zapier.com", "notion.com"]), tier: 'C', domains: ["lifehacker.com", "todoist.com", "zapier.com", "notion.com"] },
  ],
};

function normalizeInterestKey(interest: string): string {
  return interest.trim().toLowerCase();
}

const NORMALIZED_INTEREST_FEEDS = new Map<string, InterestFeedDefinition[]>(
  Object.entries(INTEREST_FEEDS).map(([key, feeds]) => [normalizeInterestKey(key), feeds])
);

function fallbackFeedsForInterest(interest: string): InterestFeedDefinition[] {
  return [
    { query: siteQuery(`${interest} latest`, [...TIERS.authorityGlobal, "reuters.com"]), tier: 'A', domains: [...TIERS.authorityGlobal, "reuters.com"] },
    { query: siteQuery(`${interest} analysis`, ["wsj.com", "bloomberg.com", "ft.com", "bbc.com"]), tier: 'A', domains: ["wsj.com", "bloomberg.com", "ft.com", "bbc.com"] },
    { query: siteQuery(`${interest} updates`, ["theverge.com", "techcrunch.com", "theguardian.com", "npr.org"]), tier: 'B', domains: ["theverge.com", "techcrunch.com", "theguardian.com", "npr.org"] },
  ];
}

function tierRank(tier: FeedTier): number {
  if (tier === 'A') return 0;
  if (tier === 'B') return 1;
  return 2;
}

export function getRssFeedsForInterest(interest: string): { feeds: RssFeedSource[]; isCurated: boolean } {
  const normalized = normalizeInterestKey(interest);
  const curatedFeeds = NORMALIZED_INTEREST_FEEDS.get(normalized);
  const isCurated = Array.isArray(curatedFeeds) && curatedFeeds.length > 0;
  const defs = isCurated ? curatedFeeds : fallbackFeedsForInterest(interest);

  const ordered = [...defs].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  return {
    feeds: ordered.map((def, index) => ({
      name: isCurated ? `${interest} tier-${def.tier} ${index + 1}` : `${interest} fallback tier-${def.tier} ${index + 1}`,
      url: googleNewsUrl(def.query),
      tier: def.tier,
      domains: def.domains,
    })),
    isCurated,
  };
}

export function getRssInterestCoverage(): string[] {
  return Object.keys(INTEREST_FEEDS);
}
