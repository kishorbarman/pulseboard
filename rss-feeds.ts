export interface RssFeedSource {
  name: string;
  url: string;
}

const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const GOOGLE_NEWS_SUFFIX = "hl=en-US&gl=US&ceid=US:en";

function googleNewsUrl(query: string): string {
  return `${GOOGLE_NEWS_BASE}?q=${encodeURIComponent(query)}&${GOOGLE_NEWS_SUFFIX}`;
}

function siteQuery(topic: string, sites: string[]): string {
  return `${topic} (${sites.map((s) => `site:${s}`).join(" OR ")})`;
}

const RSS_SITE_PACKS = {
  tech: ["theverge.com", "arstechnica.com", "techcrunch.com", "wired.com"],
  business: ["reuters.com", "bloomberg.com", "cnbc.com", "marketwatch.com"],
  world: ["reuters.com", "apnews.com", "bbc.com", "aljazeera.com"],
  lifestyle: ["nytimes.com", "theguardian.com", "forbes.com", "lifehacker.com"],
  entertainment: ["variety.com", "hollywoodreporter.com", "billboard.com", "ign.com"],
};

// Covers the built-in onboarding interests.
const INTEREST_QUERIES: Record<string, string[]> = {
  "Artificial Intelligence": [
    siteQuery("artificial intelligence", ["technologyreview.com", "theverge.com", "arstechnica.com", "openai.com"]),
    siteQuery("generative AI model launch", RSS_SITE_PACKS.tech),
    "OpenAI Anthropic Google AI updates",
  ],
  "Machine Learning": [
    siteQuery("machine learning", ["kdnuggets.com", "towardsdatascience.com", "venturebeat.com", "ai.googleblog.com"]),
    siteQuery("deep learning research", RSS_SITE_PACKS.tech),
  ],
  "Web Development": [
    siteQuery("web development", ["web.dev", "css-tricks.com", "smashingmagazine.com", "dev.to"]),
    "JavaScript React browser platform updates",
  ],
  "Cybersecurity": [
    siteQuery("cybersecurity breach vulnerability", ["krebsonsecurity.com", "bleepingcomputer.com", "thehackernews.com", "darkreading.com"]),
    "ransomware zero-day incident response",
  ],
  "Space Exploration": [
    siteQuery("space exploration", ["nasa.gov", "spacenews.com", "esa.int", "arstechnica.com"]),
    "rocket launch mission space station",
  ],
  Robotics: [
    siteQuery("robotics automation humanoid", ["spectrum.ieee.org", "therobotreport.com", "roboticsbusinessreview.com", "techcrunch.com"]),
    "warehouse robot industrial automation",
  ],
  "Data Science": [
    siteQuery("data science analytics", ["kdnuggets.com", "towardsdatascience.com", "oreilly.com", "databricks.com"]),
    "data engineering lakehouse analytics platform",
  ],
  Gadgets: [
    siteQuery("gadgets smartphone wearable review", ["theverge.com", "engadget.com", "cnet.com", "arstechnica.com"]),
    "new phone laptop device launch",
  ],
  "World News": [
    siteQuery("world news", ["reuters.com", "apnews.com", "bbc.com", "aljazeera.com"]),
    "global diplomacy conflict elections",
  ],
  "US Politics": [
    siteQuery("US politics congress white house", ["politico.com", "thehill.com", "npr.org", "reuters.com"]),
    "senate house federal policy vote",
  ],
  "Global Politics": [
    siteQuery("global politics geopolitics diplomacy", ["foreignpolicy.com", "reuters.com", "aljazeera.com", "bbc.com"]),
    "UN NATO sanctions treaty negotiations",
  ],
  Economics: [
    siteQuery("economy inflation GDP rates", ["reuters.com", "bloomberg.com", "economist.com", "wsj.com"]),
    "central bank labor market growth forecast",
  ],
  "Climate Change": [
    siteQuery("climate change emissions renewable", ["carbonbrief.org", "climatechangenews.com", "theguardian.com", "reuters.com"]),
    "extreme weather adaptation policy",
  ],
  Startups: [
    siteQuery("startup funding founder", ["techcrunch.com", "ycombinator.com", "venturebeat.com", "forbes.com"]),
    "seed round series A venture funding",
  ],
  Cryptocurrency: [
    siteQuery("bitcoin ethereum crypto", ["coindesk.com", "cointelegraph.com", "theblock.co", "decrypt.co"]),
    "crypto regulation ETF blockchain protocol",
  ],
  "Venture Capital": [
    siteQuery("venture capital fund investment", ["techcrunch.com", "pitchbook.com", "nvca.org", "forbes.com"]),
    "fund close LP deal flow valuation",
  ],
  Fintech: [
    siteQuery("fintech digital payments", ["finextra.com", "techcrunch.com", "cnbc.com", "forbes.com"]),
    "neobank payment rails financial infrastructure",
  ],
  "Stock Market": [
    siteQuery("stock market S&P Nasdaq", ["marketwatch.com", "cnbc.com", "reuters.com", "yahoo.com"]),
    "earnings guidance analyst downgrade upgrade",
  ],
  Cooking: [
    siteQuery("cooking recipe chef", ["seriouseats.com", "bonappetit.com", "food52.com", "nytimes.com"]),
    "quick dinner recipe seasonal food",
  ],
  "Fitness & Health": [
    siteQuery("fitness health nutrition", ["healthline.com", "verywellfit.com", "who.int", "nytimes.com"]),
    "exercise training recovery wellness",
  ],
  Travel: [
    siteQuery("travel destination guide", ["lonelyplanet.com", "cntraveler.com", "travelandleisure.com", "thepointsguy.com"]),
    "flight hotel tourism destination alerts",
  ],
  Fashion: [
    siteQuery("fashion runway style", ["vogue.com", "fashionista.com", "businessoffashion.com", "wwd.com"]),
    "designer collection trend report",
  ],
  Photography: [
    siteQuery("photography camera editing", ["petapixel.com", "fstoppers.com", "dpreview.com", "digitalcameraworld.com"]),
    "camera lens review photo editing workflow",
  ],
  Gaming: [
    siteQuery("gaming video game", ["ign.com", "polygon.com", "gamesradar.com", "kotaku.com"]),
    "game release esports patch notes",
  ],
  "Movies & TV": [
    siteQuery("movies TV streaming", ["variety.com", "hollywoodreporter.com", "deadline.com", "indiewire.com"]),
    "box office trailer casting",
  ],
  Music: [
    siteQuery("music album artist", ["billboard.com", "pitchfork.com", "rollingstone.com", "nme.com"]),
    "tour release chart performance",
  ],
  Sports: [
    siteQuery("sports football basketball soccer", ["espn.com", "bbc.com", "skysports.com", "reuters.com"]),
    "playoff championship transfer",
  ],
  "Books & Literature": [
    siteQuery("books literature authors", ["bookriot.com", "lithub.com", "parisreview.org", "nytimes.com"]),
    "book release prize literary review",
  ],
  Design: [
    siteQuery("design UI UX", ["creativebloq.com", "smashingmagazine.com", "uxdesign.cc", "dezeen.com"]),
    "product design accessibility interaction",
  ],
  "Open Source": [
    siteQuery("open source GitHub", ["github.blog", "lwn.net", "opensource.com", "infoq.com"]),
    "maintainer release security patch",
  ],
  Productivity: [
    siteQuery("productivity workflow time management", ["zapier.com", "todoist.com", "lifehacker.com", "notion.com"]),
    "focus habits automation remote work",
  ],
};

function normalizeInterestKey(interest: string): string {
  return interest.trim().toLowerCase();
}

const NORMALIZED_INTEREST_QUERIES = new Map<string, string[]>(
  Object.entries(INTEREST_QUERIES).map(([key, queries]) => [normalizeInterestKey(key), queries])
);

function fallbackQueriesForInterest(interest: string): string[] {
  return [
    `${interest} latest news`,
    `${interest} analysis`,
    siteQuery(interest, [...RSS_SITE_PACKS.world, ...RSS_SITE_PACKS.tech]),
  ];
}

export function getRssFeedsForInterest(interest: string): { feeds: RssFeedSource[]; isCurated: boolean } {
  const normalized = normalizeInterestKey(interest);
  const curatedQueries = NORMALIZED_INTEREST_QUERIES.get(normalized);
  const isCurated = Array.isArray(curatedQueries) && curatedQueries.length > 0;
  const queries = isCurated ? curatedQueries : fallbackQueriesForInterest(interest);

  return {
    feeds: queries.map((query, index) => ({
      name: isCurated ? `${interest} curated ${index + 1}` : `${interest} fallback ${index + 1}`,
      url: googleNewsUrl(query),
    })),
    isCurated,
  };
}

export function getRssInterestCoverage(): string[] {
  return Object.keys(INTEREST_QUERIES);
}
