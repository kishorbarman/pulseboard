export type FeedTier = 'A' | 'B' | 'C';

export interface RssFeedSource {
  name: string;
  url: string;
  tier: FeedTier;
  domains: string[];
}

interface InterestFeedDefinition {
  name: string;
  tier: FeedTier;
  domains: string[];
  directUrl?: string;
  searchQuery?: string;
}

const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const GOOGLE_NEWS_SUFFIX = "hl=en-US&gl=US&ceid=US:en";

function googleNewsUrl(query: string): string {
  return `${GOOGLE_NEWS_BASE}?q=${encodeURIComponent(query)}&${GOOGLE_NEWS_SUFFIX}`;
}

function siteQuery(topic: string, sites: string[]): string {
  return `${topic} (${sites.map((s) => `site:${s}`).join(" OR ")})`;
}

function direct(name: string, directUrl: string, tier: FeedTier, domains: string[]): InterestFeedDefinition {
  return { name, directUrl, tier, domains };
}

function search(name: string, searchQuery: string, tier: FeedTier, domains: string[]): InterestFeedDefinition {
  return { name, searchQuery, tier, domains };
}

const TIERS = {
  authorityGlobal: ["nytimes.com", "bbc.com", "apnews.com", "ft.com"],
  authorityBusiness: ["nytimes.com", "bloomberg.com", "ft.com", "cnbc.com", "marketwatch.com"],
  authorityTech: ["technologyreview.com", "arstechnica.com", "theverge.com", "wired.com", "nytimes.com"],
  authorityScience: ["nature.com", "sciencemag.org", "nasa.gov", "esa.int"],
  authorityHealth: ["cdc.gov", "statnews.com", "nytimes.com"],
  specialistCyber: ["krebsonsecurity.com", "bleepingcomputer.com", "darkreading.com", "thehackernews.com"],
  specialistClimate: ["carbonbrief.org", "nature.com", "bbc.com", "nytimes.com"],
  specialistCulture: ["variety.com", "hollywoodreporter.com", "billboard.com", "pitchfork.com"],
  specialistLifestyle: ["seriouseats.com", "lonelyplanet.com", "cntraveler.com", "petapixel.com"],
};

const INTEREST_FEEDS: Record<string, InterestFeedDefinition[]> = {
  "Artificial Intelligence": [
    direct("MIT Technology Review", "https://www.technologyreview.com/feed/", 'A', ["technologyreview.com"]),
    direct("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", 'A', ["arstechnica.com"]),
    direct("The Verge", "https://www.theverge.com/rss/index.xml", 'A', ["theverge.com"]),
    direct("NYTimes Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", 'A', ["nytimes.com"]),
    direct("VentureBeat AI", "https://venturebeat.com/ai/feed/", 'B', ["venturebeat.com"]),
    direct("OpenAI News", "https://openai.com/news/rss.xml", 'B', ["openai.com"]),
    search(
      "AI policy and governance",
      siteQuery("AI policy regulation safety governance", ["ft.com", "nytimes.com", "reuters.com", "apnews.com", "wsj.com"]),
      'A',
      ["ft.com", "nytimes.com", "reuters.com", "apnews.com", "wsj.com"]
    ),
    search(
      "AI model launches",
      siteQuery("AI model launch inference chips datacenter", ["technologyreview.com", "arstechnica.com", "theverge.com", "wired.com", "bloomberg.com"]),
      'A',
      ["technologyreview.com", "arstechnica.com", "theverge.com", "wired.com", "bloomberg.com"]
    ),
    search(
      "AI product updates",
      siteQuery("generative AI enterprise adoption copilots", ["techcrunch.com", "theverge.com", "nytimes.com", "wsj.com", "infoq.com"]),
      'B',
      ["techcrunch.com", "theverge.com", "nytimes.com", "wsj.com", "infoq.com"]
    ),
  ],
  "Cybersecurity": [
    direct("Krebs on Security", "https://krebsonsecurity.com/feed/", 'A', ["krebsonsecurity.com"]),
    direct("BleepingComputer", "https://www.bleepingcomputer.com/feed/", 'A', ["bleepingcomputer.com"]),
    direct("Dark Reading", "https://www.darkreading.com/rss.xml", 'A', ["darkreading.com"]),
    search("Cyber incidents", siteQuery("cybersecurity critical vulnerability", ["cisa.gov", ...TIERS.authorityGlobal]), 'A', ["cisa.gov", ...TIERS.authorityGlobal]),
  ],
  "Software Development": [
    direct("InfoQ", "https://www.infoq.com/feed/", 'A', ["infoq.com"]),
    direct("GitHub Blog", "https://github.blog/feed/", 'A', ["github.blog"]),
    direct("web.dev", "https://web.dev/feed.xml", 'B', ["web.dev"]),
    direct("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", 'B', ["arstechnica.com"]),
  ],
  "Gadgets & Consumer Tech": [
    direct("The Verge", "https://www.theverge.com/rss/index.xml", 'A', ["theverge.com"]),
    direct("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", 'A', ["arstechnica.com"]),
    direct("Wired", "https://www.wired.com/feed/rss", 'A', ["wired.com"]),
    direct("NYTimes Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", 'A', ["nytimes.com"]),
  ],
  "Space & Science": [
    direct("NASA News", "https://www.nasa.gov/news-release/feed/", 'A', ["nasa.gov"]),
    direct("ESA", "https://www.esa.int/rssfeed/Our_Activities", 'A', ["esa.int"]),
    direct("Nature", "https://www.nature.com/nature.rss", 'A', ["nature.com"]),
    direct("Science AAAS", "https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science", 'A', ["sciencemag.org"]),
  ],
  Robotics: [
    direct("IEEE Spectrum", "https://spectrum.ieee.org/rss/fulltext", 'A', ["spectrum.ieee.org"]),
    direct("MIT Technology Review", "https://www.technologyreview.com/feed/", 'A', ["technologyreview.com"]),
    search("Industrial robotics", siteQuery("robotics industrial automation", ["spectrum.ieee.org", "technologyreview.com", "reuters.com", "apnews.com"]), 'B', ["spectrum.ieee.org", "technologyreview.com", "reuters.com", "apnews.com"]),
  ],
  "World News": [
    direct("BBC World", "http://feeds.bbci.co.uk/news/world/rss.xml", 'A', ["bbc.com"]),
    direct("NYTimes World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", 'A', ["nytimes.com"]),
    direct("NPR News", "https://feeds.npr.org/1001/rss.xml", 'A', ["npr.org"]),
    direct("FT World", "https://www.ft.com/world?format=rss", 'A', ["ft.com"]),
    search("Breaking world developments", siteQuery("world diplomacy conflict", ["apnews.com", "bbc.com", "nytimes.com", "ft.com"]), 'B', ["apnews.com", "bbc.com", "nytimes.com", "ft.com"]),
  ],
  "US Politics": [
    direct("NYTimes US", "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", 'A', ["nytimes.com"]),
    direct("NPR Politics", "https://feeds.npr.org/1014/rss.xml", 'A', ["npr.org"]),
    search("US congress white house", siteQuery("US congress white house federal policy", ["apnews.com", "nytimes.com", "bbc.com", "politico.com"]), 'A', ["apnews.com", "nytimes.com", "bbc.com", "politico.com"]),
  ],
  "Global Affairs": [
    direct("BBC World", "http://feeds.bbci.co.uk/news/world/rss.xml", 'A', ["bbc.com"]),
    direct("FT World", "https://www.ft.com/world?format=rss", 'A', ["ft.com"]),
    direct("NYTimes World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", 'A', ["nytimes.com"]),
    search("Geopolitics diplomacy", siteQuery("geopolitics diplomacy sanctions", ["bbc.com", "ft.com", "nytimes.com", "apnews.com"]), 'A', ["bbc.com", "ft.com", "nytimes.com", "apnews.com"]),
  ],
  "Global Politics": [
    direct("BBC World", "http://feeds.bbci.co.uk/news/world/rss.xml", 'A', ["bbc.com"]),
    direct("FT World", "https://www.ft.com/world?format=rss", 'A', ["ft.com"]),
    direct("NYTimes World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", 'A', ["nytimes.com"]),
    search("Global political developments", siteQuery("UN NATO treaty negotiations", ["bbc.com", "ft.com", "nytimes.com", "foreignpolicy.com"]), 'B', ["bbc.com", "ft.com", "nytimes.com", "foreignpolicy.com"]),
  ],
  Economy: [
    direct("Bloomberg Economics", "https://feeds.bloomberg.com/economics/news.rss", 'A', ["bloomberg.com"]),
    direct("NYTimes Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", 'A', ["nytimes.com"]),
    direct("CNBC Top", "https://www.cnbc.com/id/100003114/device/rss/rss.html", 'A', ["cnbc.com"]),
    direct("MarketWatch Top", "https://feeds.content.dowjones.io/public/rss/mw_topstories", 'A', ["marketwatch.com"]),
    search("Macro policy and inflation", siteQuery("inflation GDP interest rates", TIERS.authorityBusiness), 'B', TIERS.authorityBusiness),
  ],
  Economics: [
    direct("Bloomberg Economics", "https://feeds.bloomberg.com/economics/news.rss", 'A', ["bloomberg.com"]),
    direct("NYTimes Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", 'A', ["nytimes.com"]),
    direct("CNBC Top", "https://www.cnbc.com/id/100003114/device/rss/rss.html", 'A', ["cnbc.com"]),
    direct("MarketWatch Top", "https://feeds.content.dowjones.io/public/rss/mw_topstories", 'A', ["marketwatch.com"]),
  ],
  "Markets & Investing": [
    direct("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss", 'A', ["bloomberg.com"]),
    direct("CNBC Top", "https://www.cnbc.com/id/100003114/device/rss/rss.html", 'A', ["cnbc.com"]),
    direct("MarketWatch Top", "https://feeds.content.dowjones.io/public/rss/mw_topstories", 'A', ["marketwatch.com"]),
    direct("NYTimes Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", 'A', ["nytimes.com"]),
  ],
  "Personal Finance": [
    direct("NYTimes Your Money", "https://rss.nytimes.com/services/xml/rss/nyt/YourMoney.xml", 'A', ["nytimes.com"]),
    direct("NYTimes Real Estate", "https://rss.nytimes.com/services/xml/rss/nyt/RealEstate.xml", 'A', ["nytimes.com"]),
    direct("NerdWallet", "https://www.nerdwallet.com/blog/feed/", 'A', ["nerdwallet.com"]),
    direct("Money.com", "https://www.money.com/feed/", 'A', ["money.com"]),
    direct("Motley Fool", "https://www.fool.com/feeds/index.aspx", 'B', ["fool.com"]),
    search("Taxes retirement debt", siteQuery("tax filing retirement 401k ira debt credit card mortgage", ["nytimes.com", "nerdwallet.com", "money.com", "fool.com"]), 'A', ["nytimes.com", "nerdwallet.com", "money.com", "fool.com"]),
    search("Household money planning", siteQuery("budget emergency fund student loans insurance personal finance", ["nytimes.com", "nerdwallet.com", "money.com", "bankrate.com"]), 'B', ["nytimes.com", "nerdwallet.com", "money.com", "bankrate.com"]),
  ],
  "Stock Market": [
    direct("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss", 'A', ["bloomberg.com"]),
    direct("CNBC Top", "https://www.cnbc.com/id/100003114/device/rss/rss.html", 'A', ["cnbc.com"]),
    direct("MarketWatch Top", "https://feeds.content.dowjones.io/public/rss/mw_topstories", 'A', ["marketwatch.com"]),
    direct("NYTimes Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", 'A', ["nytimes.com"]),
  ],
  "Climate & Energy": [
    direct("Carbon Brief", "https://www.carbonbrief.org/feed/", 'A', ["carbonbrief.org"]),
    direct("Nature", "https://www.nature.com/nature.rss", 'A', ["nature.com"]),
    direct("BBC Science", "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml", 'A', ["bbc.com"]),
    direct("NYTimes Climate", "https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml", 'A', ["nytimes.com"]),
  ],
  "Climate Change": [
    direct("Carbon Brief", "https://www.carbonbrief.org/feed/", 'A', ["carbonbrief.org"]),
    direct("Nature", "https://www.nature.com/nature.rss", 'A', ["nature.com"]),
    direct("BBC Science", "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml", 'A', ["bbc.com"]),
    direct("NYTimes Climate", "https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml", 'A', ["nytimes.com"]),
  ],
  "Health & Wellness": [
    direct("CDC Newsroom", "https://tools.cdc.gov/api/v2/resources/media/404952.rss", 'A', ["cdc.gov"]),
    direct("STAT News", "https://www.statnews.com/feed/", 'A', ["statnews.com"]),
    direct("NYTimes Health", "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", 'A', ["nytimes.com"]),
    search("Public health guidance", siteQuery("public health guidance", TIERS.authorityHealth), 'B', TIERS.authorityHealth),
  ],
  Fitness: [
    direct("STAT News", "https://www.statnews.com/feed/", 'A', ["statnews.com"]),
    direct("NYTimes Health", "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", 'A', ["nytimes.com"]),
    search("Fitness science", siteQuery("fitness exercise training workout", ["nytimes.com", "statnews.com", "healthline.com", "cnn.com"]), 'A', ["nytimes.com", "statnews.com", "healthline.com", "cnn.com"]),
    search("Nutrition and recovery", siteQuery("nutrition recovery strength conditioning", ["nytimes.com", "statnews.com", "menshealth.com", "womenshealthmag.com"]), 'B', ["nytimes.com", "statnews.com", "menshealth.com", "womenshealthmag.com"]),
  ],
  "Fitness & Health": [
    direct("CDC Newsroom", "https://tools.cdc.gov/api/v2/resources/media/404952.rss", 'A', ["cdc.gov"]),
    direct("STAT News", "https://www.statnews.com/feed/", 'A', ["statnews.com"]),
    direct("NYTimes Health", "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", 'A', ["nytimes.com"]),
    search("Fitness and nutrition", siteQuery("exercise nutrition recovery", ["nytimes.com", "statnews.com", "healthline.com", "who.int"]), 'B', ["nytimes.com", "statnews.com", "healthline.com", "who.int"]),
  ],
  "Startups & Business": [
    direct("TechCrunch", "https://www.techcrunch.com/feed/", 'A', ["techcrunch.com"]),
    direct("NYTimes Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", 'A', ["nytimes.com"]),
    direct("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss", 'A', ["bloomberg.com"]),
    search("Startup funding", siteQuery("startup funding series A", ["techcrunch.com", "nytimes.com", "bloomberg.com", "ft.com"]), 'B', ["techcrunch.com", "nytimes.com", "bloomberg.com", "ft.com"]),
  ],
  Startups: [
    direct("TechCrunch", "https://www.techcrunch.com/feed/", 'A', ["techcrunch.com"]),
    direct("NYTimes Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", 'A', ["nytimes.com"]),
    direct("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss", 'A', ["bloomberg.com"]),
    search("Startup funding", siteQuery("startup funding series A", ["techcrunch.com", "nytimes.com", "bloomberg.com", "ft.com"]), 'B', ["techcrunch.com", "nytimes.com", "bloomberg.com", "ft.com"]),
  ],
  "Crypto & Web3": [
    direct("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/", 'A', ["coindesk.com"]),
    direct("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss", 'A', ["bloomberg.com"]),
    direct("CNBC Top", "https://www.cnbc.com/id/100003114/device/rss/rss.html", 'B', ["cnbc.com"]),
    search("Crypto regulation and ETF", siteQuery("bitcoin ethereum regulation ETF", ["coindesk.com", "bloomberg.com", "cnbc.com", "nytimes.com"]), 'B', ["coindesk.com", "bloomberg.com", "cnbc.com", "nytimes.com"]),
  ],
  Cryptocurrency: [
    direct("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/", 'A', ["coindesk.com"]),
    direct("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss", 'A', ["bloomberg.com"]),
    direct("CNBC Top", "https://www.cnbc.com/id/100003114/device/rss/rss.html", 'B', ["cnbc.com"]),
  ],
  "Food & Cooking": [
    direct("NYTimes Food", "https://rss.nytimes.com/services/xml/rss/nyt/Food.xml", 'A', ["nytimes.com"]),
    direct("Serious Eats", "https://www.seriouseats.com/rss", 'A', ["seriouseats.com"]),
    search("Cooking and recipes", siteQuery("cooking recipe chef", ["nytimes.com", "seriouseats.com", "bonappetit.com", "food52.com"]), 'B', ["nytimes.com", "seriouseats.com", "bonappetit.com", "food52.com"]),
  ],
  Cooking: [
    direct("NYTimes Food", "https://rss.nytimes.com/services/xml/rss/nyt/Food.xml", 'A', ["nytimes.com"]),
    direct("Serious Eats", "https://www.seriouseats.com/rss", 'A', ["seriouseats.com"]),
    search("Cooking and recipes", siteQuery("cooking recipe chef", ["nytimes.com", "seriouseats.com", "bonappetit.com", "food52.com"]), 'B', ["nytimes.com", "seriouseats.com", "bonappetit.com", "food52.com"]),
  ],
  Travel: [
    direct("NYTimes Travel", "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml", 'A', ["nytimes.com"]),
    direct("BBC World", "http://feeds.bbci.co.uk/news/world/rss.xml", 'A', ["bbc.com"]),
    search("Travel advisories", siteQuery("travel advisories airline disruptions", ["nytimes.com", "bbc.com", "apnews.com", "thepointsguy.com"]), 'A', ["nytimes.com", "bbc.com", "apnews.com", "thepointsguy.com"]),
    search("Destination guides", siteQuery("destination guide tourism", ["lonelyplanet.com", "cntraveler.com", "travelandleisure.com", "nytimes.com"]), 'B', ["lonelyplanet.com", "cntraveler.com", "travelandleisure.com", "nytimes.com"]),
  ],
  "Fashion & Style": [
    search("Fashion industry", siteQuery("fashion industry earnings runway", ["businessoffashion.com", "wwd.com", "nytimes.com", "vogue.com"]), 'A', ["businessoffashion.com", "wwd.com", "nytimes.com", "vogue.com"]),
    search("Fashion trend report", siteQuery("fashion trend report", ["vogue.com", "fashionista.com", "wwd.com", "businessoffashion.com"]), 'B', ["vogue.com", "fashionista.com", "wwd.com", "businessoffashion.com"]),
  ],
  Fashion: [
    search("Fashion industry", siteQuery("fashion industry earnings runway", ["businessoffashion.com", "wwd.com", "nytimes.com", "vogue.com"]), 'A', ["businessoffashion.com", "wwd.com", "nytimes.com", "vogue.com"]),
    search("Fashion trend report", siteQuery("fashion trend report", ["vogue.com", "fashionista.com", "wwd.com", "businessoffashion.com"]), 'B', ["vogue.com", "fashionista.com", "wwd.com", "businessoffashion.com"]),
  ],
  Photography: [
    direct("PetaPixel", "https://petapixel.com/feed/", 'A', ["petapixel.com"]),
    search("Camera and photography", siteQuery("camera industry launch", ["petapixel.com", "dpreview.com", "digitalcameraworld.com", "nytimes.com"]), 'B', ["petapixel.com", "dpreview.com", "digitalcameraworld.com", "nytimes.com"]),
  ],
  Gaming: [
    direct("Polygon", "https://www.polygon.com/rss/index.xml", 'A', ["polygon.com"]),
    direct("NYTimes Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", 'B', ["nytimes.com"]),
    search("Gaming industry", siteQuery("gaming industry release earnings", ["polygon.com", "gamesradar.com", "ign.com", "nytimes.com"]), 'B', ["polygon.com", "gamesradar.com", "ign.com", "nytimes.com"]),
  ],
  "Movies & TV": [
    direct("Variety", "https://variety.com/feed/", 'A', ["variety.com"]),
    search("Streaming and box office", siteQuery("streaming box office", ["variety.com", "hollywoodreporter.com", "deadline.com", "nytimes.com"]), 'A', ["variety.com", "hollywoodreporter.com", "deadline.com", "nytimes.com"]),
    search("Movie casting trailers", siteQuery("movie trailer casting", ["variety.com", "hollywoodreporter.com", "indiewire.com", "deadline.com"]), 'B', ["variety.com", "hollywoodreporter.com", "indiewire.com", "deadline.com"]),
  ],
  Music: [
    direct("Billboard", "https://www.billboard.com/feed/", 'A', ["billboard.com"]),
    direct("Pitchfork", "https://pitchfork.com/rss/news/", 'A', ["pitchfork.com"]),
    search("Music industry and charts", siteQuery("music charts industry", ["billboard.com", "pitchfork.com", "rollingstone.com", "nytimes.com"]), 'B', ["billboard.com", "pitchfork.com", "rollingstone.com", "nytimes.com"]),
  ],
  Sports: [
    direct("BBC Sport", "http://feeds.bbci.co.uk/sport/rss.xml?edition=uk", 'A', ["bbc.com"]),
    direct("NYTimes Sports", "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", 'A', ["nytimes.com"]),
    search("Major sports updates", siteQuery("sports major league updates", ["apnews.com", "bbc.com", "nytimes.com", "espn.com"]), 'B', ["apnews.com", "bbc.com", "nytimes.com", "espn.com"]),
  ],
  Books: [
    direct("NYTimes Books", "https://rss.nytimes.com/services/xml/rss/nyt/Books.xml", 'A', ["nytimes.com"]),
    search("Books and literary prizes", siteQuery("book release literary prize", ["nytimes.com", "theguardian.com", "lithub.com", "parisreview.org"]), 'B', ["nytimes.com", "theguardian.com", "lithub.com", "parisreview.org"]),
  ],
  "Books & Literature": [
    direct("NYTimes Books", "https://rss.nytimes.com/services/xml/rss/nyt/Books.xml", 'A', ["nytimes.com"]),
    search("Books and literary prizes", siteQuery("book release literary prize", ["nytimes.com", "theguardian.com", "lithub.com", "parisreview.org"]), 'B', ["nytimes.com", "theguardian.com", "lithub.com", "parisreview.org"]),
  ],
  Design: [
    direct("Smashing Magazine", "https://www.smashingmagazine.com/feed/", 'A', ["smashingmagazine.com"]),
    search("Design and UX", siteQuery("UX accessibility interaction", ["smashingmagazine.com", "uxdesign.cc", "creativebloq.com", "dezeen.com"]), 'B', ["smashingmagazine.com", "uxdesign.cc", "creativebloq.com", "dezeen.com"]),
  ],
  "Open Source": [
    direct("GitHub Blog", "https://github.blog/feed/", 'A', ["github.blog"]),
    direct("InfoQ", "https://www.infoq.com/feed/", 'A', ["infoq.com"]),
    search("Open source updates", siteQuery("open source security patch", ["github.blog", "infoq.com", "lwn.net", "nytimes.com"]), 'B', ["github.blog", "infoq.com", "lwn.net", "nytimes.com"]),
  ],
  Productivity: [
    direct("NYTimes Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", 'A', ["nytimes.com"]),
    search("Workplace productivity", siteQuery("workplace productivity research", ["hbr.org", "nytimes.com", "theguardian.com", "npr.org"]), 'A', ["hbr.org", "nytimes.com", "theguardian.com", "npr.org"]),
    search("Workflow automation", siteQuery("workflow automation tools", ["zapier.com", "notion.com", "todoist.com", "lifehacker.com"]), 'B', ["zapier.com", "notion.com", "todoist.com", "lifehacker.com"]),
  ],
};

const INTEREST_ALIASES: Record<string, string> = {
  "ai": "Artificial Intelligence",
  "machine learning": "Artificial Intelligence",
  "web development": "Software Development",
  "gadgets": "Gadgets & Consumer Tech",
  "space exploration": "Space & Science",
  "data science": "Software Development",
  "global politics": "Global Politics",
  "economics": "Economy",
  "stock market": "Markets & Investing",
  "climate change": "Climate & Energy",
  "startups": "Startups & Business",
  "cryptocurrency": "Crypto & Web3",
  "fitness & health": "Health & Wellness",
  "cooking": "Food & Cooking",
  "fashion": "Fashion & Style",
  "books & literature": "Books",
  "movies & tv": "Movies & TV",
};

function normalizeInterestKey(interest: string): string {
  return interest.trim().toLowerCase();
}

const NORMALIZED_INTEREST_FEEDS = new Map<string, InterestFeedDefinition[]>(
  Object.entries(INTEREST_FEEDS).map(([key, feeds]) => [normalizeInterestKey(key), feeds])
);

function fallbackFeedsForInterest(interest: string): InterestFeedDefinition[] {
  return [
    search(
      "Authoritative global",
      siteQuery(`${interest} latest`, TIERS.authorityGlobal),
      'A',
      TIERS.authorityGlobal
    ),
    search(
      "Authoritative business",
      siteQuery(`${interest} analysis`, TIERS.authorityBusiness),
      'A',
      TIERS.authorityBusiness
    ),
    search(
      "Specialist mix",
      siteQuery(`${interest} updates`, [...TIERS.authorityTech.slice(0, 3), "npr.org"]),
      'B',
      [...TIERS.authorityTech.slice(0, 3), "npr.org"]
    ),
  ];
}

function tierRank(tier: FeedTier): number {
  if (tier === 'A') return 0;
  if (tier === 'B') return 1;
  return 2;
}

export function getRssFeedsForInterest(interest: string): { feeds: RssFeedSource[]; isCurated: boolean } {
  const normalized = normalizeInterestKey(interest);
  const directCurated = NORMALIZED_INTEREST_FEEDS.get(normalized);
  const aliasTarget = INTEREST_ALIASES[normalized];
  const aliasedCurated = aliasTarget ? NORMALIZED_INTEREST_FEEDS.get(normalizeInterestKey(aliasTarget)) : undefined;
  const curatedFeeds = directCurated || aliasedCurated;
  const resolvedInterest = directCurated ? interest : (aliasTarget || interest);
  const isCurated = Array.isArray(curatedFeeds) && curatedFeeds.length > 0;
  const defs = isCurated ? curatedFeeds : fallbackFeedsForInterest(interest);

  const ordered = [...defs].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  return {
    feeds: ordered.map((def, index) => ({
      name: `${isCurated ? resolvedInterest : interest} ${def.name || `tier-${def.tier} ${index + 1}`}`,
      url: def.directUrl || googleNewsUrl(def.searchQuery || interest),
      tier: def.tier,
      domains: def.domains,
    })),
    isCurated,
  };
}

export function getRssInterestCoverage(): string[] {
  return Object.keys(INTEREST_FEEDS);
}
