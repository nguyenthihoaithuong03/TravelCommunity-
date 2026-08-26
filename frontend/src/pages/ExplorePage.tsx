import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import axiosClient from "../api/axiosClient";

import DestinationMap from "../components/DestinationMap";

import "../styles/explore.css";

interface ExploreAuthor {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

interface ExplorePost {
  _id: string;
  author: ExploreAuthor;
  content: string;
  location: string;
  imageUrls: string[];
  likes: string[];
  commentsCount?: number;
  createdAt: string;
}

interface ExploreTripMember {
  _id: string;
  fullName: string;
}

interface ExploreTrip {
  _id: string;

  owner: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
  };

  title: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: number;
  coverImageUrl: string;
  members: ExploreTripMember[];
  maxMembers: number;
  createdAt: string;
}

interface PostsResponse {
  success: boolean;
  posts: ExplorePost[];
}

interface TripsResponse {
  success: boolean;
  trips: ExploreTrip[];
}

interface FavoriteDestination {
  name: string;
  address: string;
  imageUrl: string;
  latitude: number | null;
  longitude: number | null;
  savedAt: string;
}

interface FavoriteDestinationsResponse {
  success: boolean;
  favoriteDestinations: FavoriteDestination[];
  total: number;
}

interface ToggleFavoriteDestinationResponse {
  success: boolean;
  message: string;
  isSaved: boolean;
  favoriteDestinations: FavoriteDestination[];
}

interface OpenStreetMapResult {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  addresstype?: string;
  imageUrl?: string;
  wikipedia?: string;
  wikidata?: string;
  extratags?: {
    image?: string;
    wikimedia_commons?: string;
    wikipedia?: string;
    wikidata?: string;
  };
  osm_id?: number;
  osm_type?: "node" | "way" | "relation";
  boundingbox?: [string, string, string, string];
}

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface DestinationSearchCategory {
  keywords: string[];
  filters: string[];
}

interface ParsedDestinationSearch {
  category: DestinationSearchCategory | null;
  location: string;
  keyword: string;
}

const DESTINATION_SEARCH_CATEGORIES: DestinationSearchCategory[] = [
  {
    keywords: [
      "chua",
      "den",
      "dinh",
      "mieu",
      "tu vien",
      "thien vien",
    ],
    filters: [
      '["amenity"="place_of_worship"]["religion"="buddhist"]',
      '["building"="temple"]',
      '["historic"="temple"]',
    ],
  },
  {
    keywords: ["bai bien", "bai tam", "bien"],
    filters: [
      '["natural"="beach"]',
      '["leisure"="beach_resort"]',
    ],
  },
  {
    keywords: [
      "quan ca phe",
      "quan cafe",
      "ca phe",
      "cafe",
    ],
    filters: ['["amenity"="cafe"]'],
  },
  {
    keywords: [
      "khu vui choi",
      "cong vien giai tri",
      "cong vien nuoc",
    ],
    filters: [
      '["tourism"="theme_park"]',
      '["leisure"="amusement_arcade"]',
      '["leisure"="water_park"]',
      '["leisure"="playground"]',
    ],
  },
  {
    keywords: ["bao tang"],
    filters: ['["tourism"="museum"]'],
  },
  {
    keywords: ["nui", "dinh nui"],
    filters: ['["natural"="peak"]'],
  },
  {
    keywords: ["thac", "thac nuoc"],
    filters: [
      '["natural"="waterfall"]',
      '["waterway"="waterfall"]',
    ],
  },
  {
    keywords: [
      "khach san",
      "resort",
      "homestay",
      "nha nghi",
    ],
    filters: [
      '["tourism"="hotel"]',
      '["tourism"="guest_house"]',
      '["tourism"="hostel"]',
      '["tourism"="resort"]',
    ],
  },
  {
    keywords: ["nha hang", "quan an", "an uong"],
    filters: [
      '["amenity"="restaurant"]',
      '["amenity"="food_court"]',
      '["amenity"="fast_food"]',
    ],
  },
];

const destinationSearchCache = new Map<
  string,
  OpenStreetMapResult[]
>();

const destinationImageCache = new Map<
  string,
  string
>();

function getCommonsImageUrl(value: string) {
  const commonsValue = value.trim();

  if (!commonsValue) {
    return "";
  }

  if (/^file:/i.test(commonsValue)) {
    return (
      "https://commons.wikimedia.org/wiki/Special:FilePath/" +
      encodeURIComponent(
        commonsValue.replace(/^file:/i, "").trim()
      ) +
      "?width=1200"
    );
  }

  return "";
}

async function getImageFromWikidata(
  wikidataId: string,
  signal: AbortSignal
) {
  if (!/^Q\d+$/i.test(wikidataId)) {
    return "";
  }

  const parameters = new URLSearchParams({
    action: "wbgetentities",
    ids: wikidataId,
    props: "claims",
    format: "json",
    origin: "*",
  });

  const data = await fetchJsonWithTimeout<{
    entities?: Record<
      string,
      {
        claims?: {
          P18?: Array<{
            mainsnak?: {
              datavalue?: {
                value?: string;
              };
            };
          }>;
        };
      }
    >;
  }>(
    "https://www.wikidata.org/w/api.php?" +
      parameters.toString(),
    { headers: { Accept: "application/json" } },
    signal,
    7000
  );

  const fileName =
    data.entities?.[wikidataId]?.claims?.P18?.[0]
      ?.mainsnak?.datavalue?.value;

  return typeof fileName === "string"
    ? getCommonsImageUrl(`File:${fileName}`)
    : "";
}

async function getImageFromWikipedia(
  wikipediaTag: string,
  signal: AbortSignal
) {
  const separatorIndex = wikipediaTag.indexOf(":");

  if (separatorIndex < 1) {
    return "";
  }

  const language = wikipediaTag
    .slice(0, separatorIndex)
    .toLowerCase();
  const title = wikipediaTag
    .slice(separatorIndex + 1)
    .trim();

  if (!/^[a-z-]{2,12}$/.test(language) || !title) {
    return "";
  }

  const parameters = new URLSearchParams({
    action: "query",
    prop: "pageimages",
    piprop: "original|thumbnail",
    pithumbsize: "1200",
    titles: title,
    redirects: "1",
    format: "json",
    origin: "*",
  });

  const data = await fetchJsonWithTimeout<{
    query?: {
      pages?: Record<
        string,
        {
          original?: { source?: string };
          thumbnail?: { source?: string };
        }
      >;
    };
  }>(
    `https://${language}.wikipedia.org/w/api.php?` +
      parameters.toString(),
    { headers: { Accept: "application/json" } },
    signal,
    7000
  );

  const page = Object.values(
    data.query?.pages || {}
  )[0];

  return (
    page?.original?.source ||
    page?.thumbnail?.source ||
    ""
  );
}

async function resolveExactDestinationImage(
  result: OpenStreetMapResult,
  signal: AbortSignal
) {
  const extraTags = result.extratags || {};
  const directImage =
    result.imageUrl?.trim() ||
    extraTags.image?.trim() ||
    getCommonsImageUrl(
      extraTags.wikimedia_commons || ""
    );

  if (directImage) {
    return directImage;
  }

  const wikidataId =
    result.wikidata || extraTags.wikidata || "";
  const wikipediaTag =
    result.wikipedia || extraTags.wikipedia || "";
  const cacheKey =
    wikidataId || wikipediaTag || String(result.place_id);

  if (destinationImageCache.has(cacheKey)) {
    return destinationImageCache.get(cacheKey) || "";
  }

  let imageUrl = "";

  try {
    if (wikidataId) {
      imageUrl = await getImageFromWikidata(
        wikidataId,
        signal
      );
    }

    if (!imageUrl && wikipediaTag) {
      imageUrl = await getImageFromWikipedia(
        wikipediaTag,
        signal
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw error;
    }

    console.warn(
      `Không lấy được ảnh chính xác của ${getMapResultName(result)}:`,
      error
    );
  }

  destinationImageCache.set(cacheKey, imageUrl);
  return imageUrl;
}

async function enrichDestinationImages(
  results: OpenStreetMapResult[],
  signal: AbortSignal
) {
  const enrichedResults: OpenStreetMapResult[] = [];
  const batchSize = 6;

  for (
    let index = 0;
    index < results.length;
    index += batchSize
  ) {
    if (signal.aborted) {
      break;
    }

    const batch = results.slice(index, index + batchSize);
    const enrichedBatch = await Promise.all(
      batch.map(async (result) => ({
        ...result,
        wikipedia:
          result.wikipedia || result.extratags?.wikipedia,
        wikidata:
          result.wikidata || result.extratags?.wikidata,
        imageUrl:
          (await resolveExactDestinationImage(
            result,
            signal
          )) || "",
      }))
    );

    enrichedResults.push(...enrichedBatch);
  }

  return enrichedResults;
}

const CATEGORY_SEARCH_LABELS: Record<string, string> = {
  chua: "chùa",
  den: "đền",
  dinh: "đình",
  mieu: "miếu",
  "tu vien": "tu viện",
  "thien vien": "thiền viện",
  bien: "bãi biển",
  "bai bien": "bãi biển",
  "bai tam": "bãi tắm",
  "quan ca phe": "quán cà phê",
  "quan cafe": "quán cà phê",
  "ca phe": "quán cà phê",
  cafe: "quán cà phê",
  "khu vui choi": "khu vui chơi",
  "cong vien giai tri": "công viên giải trí",
  "cong vien nuoc": "công viên nước",
  "bao tang": "bảo tàng",
  nui: "núi",
  "dinh nui": "đỉnh núi",
  thac: "thác nước",
  "thac nuoc": "thác nước",
  "khach san": "khách sạn",
  resort: "resort",
  homestay: "homestay",
  "nha nghi": "nhà nghỉ",
  "nha hang": "nhà hàng",
  "quan an": "quán ăn",
  "an uong": "nhà hàng",
};

async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit,
  parentSignal: AbortSignal,
  timeoutMilliseconds = 12000
): Promise<T> {
  const controller = new AbortController();

  const abortRequest = () => controller.abort();
  parentSignal.addEventListener("abort", abortRequest);

  const timeoutId = window.setTimeout(
    abortRequest,
    timeoutMilliseconds
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Yêu cầu thất bại: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal.removeEventListener("abort", abortRequest);
  }
}

interface ExploreDestination {
  key: string;

  name: string;

  address: string;

  imageUrl: string;

  posts: ExplorePost[];

  trips: ExploreTrip[];

  totalLikes: number;

  latestDate: string;

  isMapResult: boolean;

  latitude?: number;

  longitude?: number;
}

type ExploreFilter =
  | "all"
  | "with_posts"
  | "with_trips";

function normalizeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    "vi-VN"
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    "vi-VN"
  ).format(value);
}

function getFirstLetter(fullName: string) {
  return (
    fullName
      .trim()
      .charAt(0)
      .toUpperCase() || "U"
  );
}

function getMapResultName(
  result: OpenStreetMapResult
) {
  const resultName = result.name?.trim();

  if (resultName) {
    return resultName;
  }

  return (
    result.display_name
      .split(",")[0]
      ?.trim() || result.display_name
  );
}

function isValidSearchKeyword(
  value: string
) {
  const keyword = normalizeText(value);

  // Một ký tự chỉ dùng để lọc danh sách gợi ý có sẵn.
  // Từ hai ký tự trở lên mới gửi yêu cầu lên bản đồ.
  if (keyword.length < 2) {
    return false;
  }

  // Phải có chữ cái, không tìm chuỗi chỉ gồm số/ký hiệu.
  if (!/[a-z]/.test(keyword)) {
    return false;
  }

  // Không tìm các chuỗi lặp vô nghĩa: aa, hhh, 111...
  if (
    /^([a-z0-9])\1+$/.test(keyword)
  ) {
    return false;
  }

  return true;
}

function isTravelDestination(
  result: OpenStreetMapResult,
  searchKeyword: string
) {
  const name = getMapResultName(result);

  const normalizedName = normalizeText(name);

  const normalizedAddress = normalizeText(
    result.display_name
  );

  const normalizedKeyword = normalizeText(
    searchKeyword
  );

  if (
    normalizedName.length < 2 ||
    !Number.isFinite(Number(result.lat)) ||
    !Number.isFinite(Number(result.lon))
  ) {
    return false;
  }

  // Tên hoặc địa chỉ phải liên quan trực tiếp từ khóa để
  // tránh trả về địa điểm ngẫu nhiên khi người dùng gõ linh tinh.
  const keywordParts = normalizedKeyword
    .split(/\s+/)
    .filter(Boolean);

  const matchesEveryWord = keywordParts.every(
    (part) =>
      normalizedName.includes(part) ||
      normalizedAddress.includes(part)
  );

  if (
    !normalizedName.includes(normalizedKeyword) &&
    !normalizedKeyword.includes(normalizedName) &&
    !normalizedAddress.includes(normalizedKeyword) &&
    !matchesEveryWord
  ) {
    return false;
  }

  // Chỉ loại các kết quả quá chi tiết, không hữu ích cho khám phá
  // du lịch. Các tỉnh/thành, đảo, biển, núi, thác, bảo tàng,
  // di tích, công viên, khu nghỉ dưỡng... đều được giữ lại.
  const blockedTypes = new Set([
    "house",
    "house_number",
    "postcode",
    "road",
    "residential",
    "service",
    "path",
    "footway",
  ]);

  return !blockedTypes.has(
    result.type || result.addresstype || ""
  );
}

function buildDestinationSearchQueries(
  keyword: string
) {
  const trimmedKeyword = keyword.trim();
  const normalizedKeyword = normalizeText(
    trimmedKeyword
  );

  return Array.from(
    new Set([
      trimmedKeyword,
      `${trimmedKeyword}, Việt Nam`,
      normalizedKeyword,
    ])
  );
}

function parseDestinationSearch(
  searchText: string
): ParsedDestinationSearch {
  const originalText = searchText
    .trim()
    .replace(/\s+/g, " ");

  const normalizedText = normalizeText(
    originalText
  );

  let selectedCategory:
    | DestinationSearchCategory
    | null = null;

  let selectedKeyword = "";

  DESTINATION_SEARCH_CATEGORIES.forEach(
    (category) => {
      category.keywords.forEach(
        (categoryKeyword) => {
          const normalizedCategoryKeyword =
            normalizeText(categoryKeyword);

          if (
            (normalizedText ===
              normalizedCategoryKeyword ||
              normalizedText.startsWith(
                `${normalizedCategoryKeyword} `
              )) &&
            normalizedCategoryKeyword.length >
              selectedKeyword.length
          ) {
            selectedCategory = category;
            selectedKeyword =
              normalizedCategoryKeyword;
          }
        }
      );
    }
  );

  if (!selectedCategory) {
    return {
      category: null,
      location: "",
      keyword: "",
    };
  }

  const categoryWordCount = selectedKeyword
    .split(" ")
    .filter(Boolean).length;

  const location = originalText
    .split(" ")
    .slice(categoryWordCount)
    .join(" ")
    .replace(
      /^(ở|tại|thuộc|gần|khu vực|o|tai|thuoc|gan|khu vuc)\s+/i,
      ""
    )
    .trim();

  return {
    category: selectedCategory,
    location,
    keyword: selectedKeyword,
  };
}

function matchesDestinationCategoryName(
  normalizedName: string,
  keyword: string
) {
  if (
    ["chua", "den", "dinh", "mieu", "tu vien", "thien vien"].includes(
      keyword
    )
  ) {
    return new RegExp(`(^|\\s)${keyword}(\\s|$)`).test(
      normalizedName
    );
  }

  if (["bien", "bai bien", "bai tam"].includes(keyword)) {
    return (
      /^bien(\s|$)/.test(normalizedName) ||
      /(^|\s)bai bien(\s|$)/.test(normalizedName) ||
      /(^|\s)bai tam(\s|$)/.test(normalizedName)
    );
  }

  return normalizedName.includes(keyword);
}

async function searchDestinationsByCategory(
  parsedSearch: ParsedDestinationSearch,
  signal: AbortSignal
): Promise<OpenStreetMapResult[]> {
  const category = parsedSearch.category;

  if (!category) {
    return [];
  }

  const normalizedLocation = normalizeText(
    parsedSearch.location
  );
  const searchLabel =
    CATEGORY_SEARCH_LABELS[parsedSearch.keyword] ||
    parsedSearch.keyword;

  const matchesRequestedCategory = (
    result: OpenStreetMapResult
  ) => {
    const name = normalizeText(getMapResultName(result));
    const kind = normalizeText(
      `${result.class || ""} ${result.type || ""}`
    );
    const keyword = parsedSearch.keyword;

    if (keyword === "chua") {
      return matchesDestinationCategoryName(name, keyword);
    }

    if (["bien", "bai bien", "bai tam"].includes(keyword)) {
      return (
        matchesDestinationCategoryName(name, keyword) ||
        kind.includes("beach")
      );
    }

    if (["quan ca phe", "quan cafe", "ca phe", "cafe"].includes(keyword)) {
      return (
        name.includes("ca phe") ||
        name.includes("cafe") ||
        kind.includes("cafe")
      );
    }

    if (["bao tang"].includes(keyword)) {
      return name.includes("bao tang") || kind.includes("museum");
    }

    if (["thac", "thac nuoc"].includes(keyword)) {
      return name.includes("thac") || kind.includes("waterfall");
    }

    if (["nui", "dinh nui"].includes(keyword)) {
      return (
        name.includes("nui") ||
        name.includes("dinh") ||
        kind.includes("peak")
      );
    }

    if (
      [
        "khu vui choi",
        "cong vien giai tri",
        "cong vien nuoc",
      ].includes(keyword)
    ) {
      return (
        name.includes("khu vui choi") ||
        name.includes("cong vien") ||
        kind.includes("theme_park") ||
        kind.includes("amusement") ||
        kind.includes("water_park") ||
        kind.includes("playground")
      );
    }

    if (
      [
        "khach san",
        "resort",
        "homestay",
        "nha nghi",
      ].includes(keyword)
    ) {
      return (
        name.includes("khach san") ||
        name.includes("resort") ||
        name.includes("homestay") ||
        name.includes("nha nghi") ||
        kind.includes("hotel") ||
        kind.includes("guest_house") ||
        kind.includes("hostel") ||
        kind.includes("resort")
      );
    }

    if (
      ["nha hang", "quan an", "an uong"].includes(keyword)
    ) {
      return (
        name.includes("nha hang") ||
        name.includes("quan an") ||
        kind.includes("restaurant") ||
        kind.includes("food_court") ||
        kind.includes("fast_food")
      );
    }

    return true;
  };

  const uniqueResults = new Map<string, OpenStreetMapResult>();

  const addResult = (
    result: OpenStreetMapResult,
    isAlreadyInsideRequestedArea = false
  ) => {
    if (!matchesRequestedCategory(result)) {
      return;
    }

    if (
      normalizedLocation &&
      !isAlreadyInsideRequestedArea &&
      !normalizeText(result.display_name || "").includes(
        normalizedLocation
      )
    ) {
      return;
    }

    const name = normalizeText(getMapResultName(result));
    uniqueResults.set(
      `${name}-${result.lat}-${result.lon}`,
      result
    );
  };

  // Tìm nhanh trước để giao diện không phải chờ Overpass quá lâu.
  const quickQueries = parsedSearch.location
    ? [
        `${searchLabel}, ${parsedSearch.location}, Việt Nam`,
        `${searchLabel} ở ${parsedSearch.location}, Việt Nam`,
      ]
    : [`${searchLabel}, Việt Nam`];

  const quickSearches = await Promise.allSettled(
    quickQueries.map((queryText) => {
      const parameters = new URLSearchParams({
        format: "jsonv2",
        q: queryText,
        countrycodes: "vn",
        addressdetails: "1",
        namedetails: "1",
        extratags: "1",
        limit: "40",
        "accept-language": "vi",
      });

      return fetchJsonWithTimeout<OpenStreetMapResult[]>(
        "https://nominatim.openstreetmap.org/search?" +
          parameters.toString(),
        { headers: { Accept: "application/json" } },
        signal,
        5000
      );
    })
  );

  quickSearches.forEach((search) => {
    if (search.status === "fulfilled") {
      search.value.forEach((result) => {
        addResult(result);
      });
    }
  });

  // Giới hạn mặc định trong lãnh thổ Việt Nam. Dùng bounding box
  // giúp truy vấn loại địa điểm nhanh và ổn định hơn area toàn quốc.
  let searchTarget = "";
  let locationExpression =
    "(8.1790665,102.14441,23.393395,109.469265)";
  let resolvedLocationName = parsedSearch.location;

  if (parsedSearch.location) {
    const parameters = new URLSearchParams({
      format: "jsonv2",
      q: `${parsedSearch.location}, Việt Nam`,
      countrycodes: "vn",
      addressdetails: "1",
      limit: "5",
      "accept-language": "vi",
    });

    let locations: Array<{
        display_name?: string;
        osm_id?: number;
        osm_type?: "node" | "way" | "relation";
        boundingbox?: [string, string, string, string];
      }> = [];

    try {
      locations = await fetchJsonWithTimeout(
        "https://nominatim.openstreetmap.org/search?" +
          parameters.toString(),
        { headers: { Accept: "application/json" } },
        signal,
        5000
      );
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
    }

    const selectedLocation =
      locations.find((location) =>
        normalizeText(location.display_name || "").includes(
          normalizedLocation
        )
      ) || locations[0];

    const boundingBox = selectedLocation?.boundingbox;

    if (!selectedLocation || !boundingBox) {
      return Array.from(uniqueResults.values());
    }

    resolvedLocationName =
      selectedLocation.display_name
        ?.split(",")
        .slice(0, 2)
        .join(", ") || parsedSearch.location;

    const [south, north, west, east] = boundingBox;
    locationExpression =
      `(${south},${west},${north},${east})`;
  }

  const nameFilter = parsedSearch.keyword === "chua"
    ? '["name"~"Chùa|chùa|CHÙA|Chua|chua"]'
    : '["name"]';

  const categoryQueries = category.filters
    .map(
      (filter) =>
        `nwr${filter}${nameFilter}${locationExpression};`
    )
    .join("\n");

  const query = `
    [out:json][timeout:25];
    ${searchTarget}
    (
      ${categoryQueries}
    );
    out center 250;
  `;

  const servers = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];

  let elements: OverpassElement[] = [];

  // Chỉ chuyển sang máy chủ tiếp theo khi máy chủ trước lỗi.
  // Không gọi đồng thời cả ba máy chủ công cộng để tránh bị chặn.
  for (const server of servers) {
    try {
      const response =
        await fetchJsonWithTimeout<OverpassResponse>(
          server,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              Accept: "application/json",
            },
            body: new URLSearchParams({
              data: query,
            }).toString(),
          },
          signal,
          12000
        );

      if (Array.isArray(response.elements)) {
        elements = response.elements;
        break;
      }
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      console.warn(
        `Máy chủ bản đồ ${server} chưa phản hồi, đang thử máy chủ khác.`,
        error
      );
    }
  }

  elements.forEach((element) => {
    const name = element.tags?.name?.trim();
    const coordinates =
      getOverpassCoordinates(element);

    if (!name || !coordinates) {
      return;
    }

    const imageTag = element.tags?.image || "";
    const commonsTag = element.tags?.wikimedia_commons || "";
    const imageUrl = /^https?:\/\//i.test(imageTag)
      ? imageTag
      : /^file:/i.test(commonsTag)
        ? "https://commons.wikimedia.org/wiki/Special:FilePath/" +
          encodeURIComponent(
            commonsTag.replace(/^file:/i, "").trim()
          ) +
          "?width=1000"
        : "";

    const addressParts = [
      element.tags?.["addr:street"],
      element.tags?.["addr:suburb"],
      element.tags?.["addr:district"],
      element.tags?.["addr:city"] ||
        element.tags?.["addr:province"] ||
        resolvedLocationName,
      "Việt Nam",
    ].filter(Boolean);

    const result: OpenStreetMapResult = {
      place_id: -(
        element.id * 10 +
        (element.type === "node"
          ? 1
          : element.type === "way"
            ? 2
            : 3)
      ),
      name,
      display_name: [name, ...addressParts].join(", "),
      lat: String(coordinates.latitude),
      lon: String(coordinates.longitude),
      class:
        element.tags?.amenity ||
        element.tags?.tourism ||
        element.tags?.natural ||
        element.tags?.leisure ||
        "tourism",
      type:
        element.tags?.tourism ||
        element.tags?.amenity ||
        element.tags?.natural ||
        element.tags?.leisure ||
        "attraction",
      imageUrl,
      wikipedia: element.tags?.wikipedia,
      wikidata: element.tags?.wikidata,
    };

    // Kết quả này đã được Overpass giới hạn bằng bounding box
    // của tỉnh/thành, không lọc lại bằng chuỗi địa chỉ.
    addResult(result, true);
  });

  if (uniqueResults.size === 0) {
    const queryText = parsedSearch.location
      ? `${parsedSearch.keyword} ${parsedSearch.location}`
      : `${parsedSearch.keyword} Việt Nam`;

    const parameters = new URLSearchParams({
      format: "jsonv2",
      q: queryText,
      countrycodes: "vn",
      addressdetails: "1",
      namedetails: "1",
      extratags: "1",
      limit: "40",
      "accept-language": "vi",
    });

    try {
      const fallbackResults = await fetchJsonWithTimeout<
        OpenStreetMapResult[]
      >(
        "https://nominatim.openstreetmap.org/search?" +
          parameters.toString(),
        { headers: { Accept: "application/json" } },
        signal,
        5000
      );

      fallbackResults.forEach((result) => {
        addResult(result);
      });
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
    }
  }

  return Array.from(uniqueResults.values()).sort((first, second) =>
    getMapResultName(first).localeCompare(
      getMapResultName(second),
      "vi"
    )
  );
}

function getOverpassCoordinates(
  element: OverpassElement
) {
  const latitude =
    element.lat ?? element.center?.lat;
  const longitude =
    element.lon ?? element.center?.lon;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

async function searchNearbyTouristPlaces(
  location: OpenStreetMapResult,
  signal: AbortSignal
): Promise<OpenStreetMapResult[]> {
  const latitude = Number(location.lat);
  const longitude = Number(location.lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return [];
  }

  const radius = 18000;
  const around =
    `(around:${radius},${latitude},${longitude})`;

  const query = `
    [out:json][timeout:20];
    (
      nwr["tourism"~"attraction|museum|viewpoint|theme_park|zoo|aquarium|gallery|artwork|camp_site|picnic_site"]${around};
      nwr["leisure"~"park|garden|nature_reserve|water_park|resort|beach_resort"]${around};
      nwr["historic"~"monument|memorial|castle|ruins|archaeological_site|heritage"]${around};
      nwr["natural"~"beach|bay|peak|waterfall|cave_entrance|island|hot_spring"]${around};
      nwr["waterway"="waterfall"]${around};
      nwr["amenity"="place_of_worship"]${around};
    );
    out center 100;
  `;

  const response = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json",
      },
      body: new URLSearchParams({ data: query }),
    }
  );

  if (!response.ok) {
    return [];
  }

  const data =
    (await response.json()) as OverpassResponse;

  return (data.elements || []).flatMap(
    (element): OpenStreetMapResult[] => {
      const name = element.tags?.name?.trim();
      const coordinates =
        getOverpassCoordinates(element);

      if (!name || !coordinates) {
        return [];
      }

      const typeOffset =
        element.type === "node"
          ? 1
          : element.type === "way"
            ? 2
            : 3;

      return [
        {
          place_id:
            -(element.id * 10 + typeOffset),
          name,
          display_name:
            `${name}, ${location.display_name}`,
          lat: String(coordinates.latitude),
          lon: String(coordinates.longitude),
          class:
            element.tags?.tourism ||
            element.tags?.leisure ||
            element.tags?.historic ||
            element.tags?.natural ||
            "tourism",
          type:
            element.tags?.tourism ||
            element.tags?.leisure ||
            element.tags?.historic ||
            element.tags?.natural ||
            "attraction",
        },
      ];
    }
  );
}

const suggestedDestinations = [
  "An Giang",
  "Bà Rịa - Vũng Tàu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Định",
  "Bình Dương",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cần Thơ",
  "Cao Bằng",
  "Côn Đảo",
  "Đà Lạt",
  "Đà Nẵng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Nội",
  "Hà Tĩnh",
  "Hạ Long",
  "Hải Dương",
  "Hải Phòng",
  "Hậu Giang",
  "Hòa Bình",
  "Hội An",
  "Huế",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Mộc Châu",
  "Mù Cang Chải",
  "Mũi Né",
  "Nam Định",
  "Nghệ An",
  "Nha Trang",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Quốc",
  "Phú Thọ",
  "Phú Yên",
  "Phan Thiết",
  "Phong Nha",
  "Rạch Giá",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Quy Nhơn",
  "Sa Pa",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Tà Xùa",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thành phố Hồ Chí Minh",
  "Tiền Giang",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Vũng Tàu",
  "Yên Bái",
];
interface DestinationImageProps {
  name: string;
  address?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}

function convertOverpassPlace(
  element: OverpassElement,
  regionName: string
): OpenStreetMapResult | null {
  const name = element.tags?.name?.trim();
  const coordinates = getOverpassCoordinates(element);

  if (!name || !coordinates) {
    return null;
  }

  const imageTag = element.tags?.image || "";
  const commonsTag =
    element.tags?.wikimedia_commons || "";
  const imageUrl = /^https?:\/\//i.test(imageTag)
    ? imageTag
    : /^file:/i.test(commonsTag)
      ? "https://commons.wikimedia.org/wiki/Special:FilePath/" +
        encodeURIComponent(
          commonsTag.replace(/^file:/i, "").trim()
        ) +
        "?width=1000"
      : "";

  const typeOffset =
    element.type === "node"
      ? 1
      : element.type === "way"
        ? 2
        : 3;

  return {
    place_id: -(element.id * 10 + typeOffset),
    name,
    display_name: `${name}, ${regionName}`,
    lat: String(coordinates.latitude),
    lon: String(coordinates.longitude),
    class:
      element.tags?.tourism ||
      element.tags?.leisure ||
      element.tags?.historic ||
      element.tags?.natural ||
      element.tags?.amenity ||
      "tourism",
    type:
      element.tags?.tourism ||
      element.tags?.leisure ||
      element.tags?.historic ||
      element.tags?.natural ||
      element.tags?.amenity ||
      "attraction",
    imageUrl,
    wikipedia: element.tags?.wikipedia,
    wikidata: element.tags?.wikidata,
  };
}

async function searchTouristPlacesInRegion(
  region: OpenStreetMapResult,
  signal: AbortSignal
): Promise<OpenStreetMapResult[]> {
  let searchTarget = "";
  let locationExpression = "";

  if (
    region.osm_type === "relation" &&
    typeof region.osm_id === "number"
  ) {
    const areaId = region.osm_id + 3600000000;
    searchTarget = `area(${areaId})->.searchArea;`;
    locationExpression = "(area.searchArea)";
  } else if (region.boundingbox?.length === 4) {
    const [south, north, west, east] =
      region.boundingbox;
    locationExpression =
      `(${south},${west},${north},${east})`;
  } else {
    return searchNearbyTouristPlaces(region, signal);
  }

  // Khi chỉ nhập tên tỉnh/thành, lấy nhiều nhóm điểm tham quan
  // trong toàn khu vực. Khách sạn/nhà hàng chỉ được tìm khi
  // người dùng nhập rõ loại để tránh hàng nghìn kết quả rác.
  const filters = [
    '["tourism"~"attraction|museum|viewpoint|theme_park|zoo|aquarium|gallery|artwork"]',
    '["leisure"~"park|garden|nature_reserve|water_park|beach_resort"]',
    '["historic"~"monument|memorial|castle|ruins|archaeological_site|heritage"]',
    '["natural"~"beach|bay|peak|waterfall|cave_entrance|island|hot_spring"]',
    '["waterway"="waterfall"]',
    '["amenity"="place_of_worship"]',
  ];

  const placeQueries = filters
    .map(
      (filter) =>
        `nwr${filter}["name"]${locationExpression};`
    )
    .join("\n");

  const query = `
    [out:json][timeout:25];
    ${searchTarget}
    (
      ${placeQueries}
    );
    out center 140;
  `;

  const servers = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];

  const responses = await Promise.allSettled(
    servers.map((server) =>
      fetchJsonWithTimeout<OverpassResponse>(
        server,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "application/json",
          },
          body: new URLSearchParams({ data: query }).toString(),
        },
        signal,
        9000
      )
    )
  );

  const uniquePlaces = new Map<
    string,
    OpenStreetMapResult
  >();

  responses.forEach((response) => {
    if (response.status !== "fulfilled") {
      return;
    }

    (response.value.elements || []).forEach((element) => {
      const place = convertOverpassPlace(
        element,
        region.display_name
      );

      if (!place) {
        return;
      }

      const key = normalizeText(
        `${getMapResultName(place)}-${place.lat}-${place.lon}`
      );
      uniquePlaces.set(key, place);
    });
  });

  return Array.from(uniquePlaces.values())
    .sort((first, second) =>
      getMapResultName(first).localeCompare(
        getMapResultName(second),
        "vi"
      )
    )
    .slice(0, 100);
}

function DestinationImage({
  name,
  imageUrl = "",
}: DestinationImageProps) {
  const [hasImageError, setHasImageError] =
    useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl]);

  // Chế độ ảnh chính xác: chỉ dùng URL ảnh được gắn trực tiếp
  // với địa điểm/bài viết. Không tự đoán ảnh theo tên hoặc vị trí.
  if (imageUrl.trim() && !hasImageError) {
    return (
      <img
        className="destination-real-image"
        src={imageUrl}
        alt={`Hình ảnh ${name}`}
        loading="lazy"
        onError={() => {
          setHasImageError(true);
        }}
      />
    );
  }

  return (
    <span className="destination-image-placeholder">
      🗺️
    </span>
  );
}

function ExplorePage() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState<
    ExplorePost[]
  >([]);

  const [trips, setTrips] = useState<
    ExploreTrip[]
  >([]);

  const [
    mapSearchResults,
    setMapSearchResults,
  ] = useState<OpenStreetMapResult[]>([]);

  const [searchText, setSearchText] =
    useState("");

  const [isSearchFocused, setIsSearchFocused] =
    useState(false);

  const [activeFilter, setActiveFilter] =
    useState<ExploreFilter>("all");

  const [
    favoriteDestinations,
    setFavoriteDestinations,
  ] = useState<FavoriteDestination[]>([]);

  const [
    savingDestinationName,
    setSavingDestinationName,
  ] = useState("");

  const [
    selectedDestination,
    setSelectedDestination,
  ] = useState<ExploreDestination | null>(
    null
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isSearchingLocations,
    setIsSearchingLocations,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [
    searchMessage,
    setSearchMessage,
  ] = useState("");

  // Lấy bài viết và chuyến đi hiện có.
  useEffect(() => {
    let isActive = true;

    const loadExploreData = async () => {
      try {
        setIsLoading(true);
        setMessage("");

        const results =
          await Promise.allSettled([
            axiosClient.get<PostsResponse>(
              "/posts"
            ),

            axiosClient.get<TripsResponse>(
              "/trips/companions"
            ),
          ]);

        if (!isActive) {
          return;
        }

        const postsResult = results[0];
        const tripsResult = results[1];

        if (
          postsResult.status === "fulfilled"
        ) {
          setPosts(
            postsResult.value.data.posts || []
          );
        }

        if (
          tripsResult.status === "fulfilled"
        ) {
          setTrips(
            tripsResult.value.data.trips || []
          );
        }

        const unauthorizedError = results.find(
          (result) =>
            result.status === "rejected" &&
            result.reason?.response?.status ===
              401
        );

        if (unauthorizedError) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          navigate("/login");

          return;
        }

        if (
          postsResult.status === "rejected" &&
          tripsResult.status === "rejected"
        ) {
          setMessage(
            "Không thể tải dữ liệu khám phá. Vui lòng thử lại."
          );
        }
      } catch (error) {
        console.error(
          "Lỗi tải dữ liệu khám phá:",
          error
        );

        if (isActive) {
          setMessage(
            "Không thể tải dữ liệu khám phá."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadExploreData();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  // Đồng bộ danh sách địa điểm đã lưu của tài khoản.
  useEffect(() => {
    let isActive = true;

    const getFavoriteDestinations = async () => {
      try {
        const response =
          await axiosClient.get<FavoriteDestinationsResponse>(
            "/favorite-destinations"
          );

        if (isActive) {
          setFavoriteDestinations(
            response.data.favoriteDestinations || []
          );
        }
      } catch (error) {
        console.error(
          "Không thể lấy địa điểm yêu thích:",
          error
        );
      }
    };

    void getFavoriteDestinations();

    return () => {
      isActive = false;
    };
  }, []);

  // Tìm địa danh theo tên, sau đó bổ sung các điểm du lịch,
  // vui chơi và giải trí được OpenStreetMap ghi nhận xung quanh.
  useEffect(() => {
    const keyword = searchText.trim();

    if (!isValidSearchKeyword(keyword)) {
      setMapSearchResults([]);
      setSearchMessage("");
      setIsSearchingLocations(false);
      return;
    }

    const cacheKey = normalizeText(keyword);
    const cachedResults =
      destinationSearchCache.get(cacheKey);

    if (cachedResults) {
      setMapSearchResults(cachedResults);
      setSearchMessage("");
      setIsSearchingLocations(false);
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(
      async () => {
        try {
          setIsSearchingLocations(true);
          setSearchMessage("");

          const parsedSearch =
            parseDestinationSearch(keyword);

          // Tìm theo loại địa điểm, ví dụ:
          // "chùa", "chùa Hà Nội", "biển Đà Nẵng".
          if (parsedSearch.category) {
            let totalTimeoutId = 0;

            const categoryResults = await Promise.race([
              searchDestinationsByCategory(
                parsedSearch,
                controller.signal
              ),
              new Promise<OpenStreetMapResult[]>((resolve) => {
                totalTimeoutId = window.setTimeout(
                  () => resolve([]),
                  40000
                );
              }),
            ]);

            window.clearTimeout(totalTimeoutId);

            if (controller.signal.aborted) {
              return;
            }

            // Hiển thị kết quả tìm kiếm trước, sau đó bổ sung
            // ảnh chính xác từ dữ liệu Wikidata/Wikipedia.
            setMapSearchResults(categoryResults);

            const categoryResultsWithImages =
              await enrichDestinationImages(
                categoryResults,
                controller.signal
              );

            if (controller.signal.aborted) {
              return;
            }

            destinationSearchCache.set(
              cacheKey,
              categoryResultsWithImages
            );

            setMapSearchResults(
              categoryResultsWithImages
            );

            setSearchMessage(
              categoryResults.length > 0
                ? ""
                : parsedSearch.location
                  ? `Không tìm thấy địa điểm phù hợp tại ${parsedSearch.location}.`
                  : "Không tìm thấy địa điểm phù hợp tại Việt Nam."
            );

            return;
          }

          const uniqueResults = new Map<
            string,
            OpenStreetMapResult
          >();

          const addSearchResult = (
            result: OpenStreetMapResult
          ) => {
            const resultKey = normalizeText(
              `${getMapResultName(result)}-${result.lat}-${result.lon}`
            );

            if (!uniqueResults.has(resultKey)) {
              uniqueResults.set(resultKey, result);
            }
          };

          let bestLocation:
            | OpenStreetMapResult
            | undefined;

          for (const query of buildDestinationSearchQueries(
            keyword
          )) {
            const parameters = new URLSearchParams({
              format: "jsonv2",
              q: query,
              countrycodes: "vn",
              addressdetails: "1",
              namedetails: "1",
              extratags: "1",
              dedupe: "1",
              limit: "20",
              "accept-language": "vi",
            });

            const response = await fetch(
              "https://nominatim.openstreetmap.org/search?" +
                parameters.toString(),
              {
                signal: controller.signal,
                headers: {
                  Accept: "application/json",
                },
              }
            );

            if (!response.ok) {
              throw new Error(
                "Không thể tìm kiếm địa điểm"
              );
            }

            const results =
              (await response.json()) as OpenStreetMapResult[];

            const matchingResults = Array.isArray(
              results
            )
              ? results.filter((result) =>
                  isTravelDestination(result, keyword)
                )
              : [];

            matchingResults.forEach(addSearchResult);

            if (!bestLocation && matchingResults[0]) {
              bestLocation = matchingResults[0];
            }

            // Một kết quả rõ ràng đã đủ để xác định khu vực;
            // không cần tiếp tục gọi dịch vụ tìm tên địa điểm.
            if (matchingResults.length > 0) {
              break;
            }
          }

          // Nếu người dùng chỉ nhập tên tỉnh/thành, tìm điểm du
          // lịch trong toàn địa giới. Với một địa danh cụ thể thì
          // chỉ tìm các điểm nổi bật ở khu vực xung quanh.
          if (bestLocation && cacheKey.length >= 3) {
            try {
              const administrativeTypes = new Set([
                "administrative",
                "state",
                "province",
                "city",
                "municipality",
                "county",
              ]);

              const isAdministrativeRegion =
                bestLocation.class === "boundary" ||
                administrativeTypes.has(
                  bestLocation.type || ""
                ) ||
                administrativeTypes.has(
                  bestLocation.addresstype || ""
                );

              const nearbyPlaces = isAdministrativeRegion
                ? await searchTouristPlacesInRegion(
                    bestLocation,
                    controller.signal
                  )
                : await searchNearbyTouristPlaces(
                    bestLocation,
                    controller.signal
                  );

              nearbyPlaces.forEach(addSearchResult);
            } catch (error) {
              if (
                error instanceof Error &&
                error.name === "AbortError"
              ) {
                throw error;
              }

              // Overpass có thể quá tải: vẫn giữ các địa danh
              // đã tìm được thay vì làm hỏng toàn bộ tìm kiếm.
              console.warn(
                "Không thể tải thêm điểm du lịch gần đây:",
                error
              );
            }
          }

          const searchResults = Array.from(
            uniqueResults.values()
          ).slice(0, 60);

          setMapSearchResults(searchResults);

          const searchResultsWithImages =
            await enrichDestinationImages(
              searchResults,
              controller.signal
            );

          if (controller.signal.aborted) {
            return;
          }

          destinationSearchCache.set(
            cacheKey,
            searchResultsWithImages
          );

          setMapSearchResults(
            searchResultsWithImages
          );

          if (uniqueResults.size === 0) {
            setSearchMessage(
              "Không tìm thấy địa điểm phù hợp tại Việt Nam. Hãy nhập tên đầy đủ hơn."
            );
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.name === "AbortError"
          ) {
            return;
          }

          console.error(
            "Lỗi tìm địa điểm trên bản đồ:",
            error
          );

          setMapSearchResults([]);

          setSearchMessage(
            "Không thể tìm thêm địa điểm trên bản đồ. Những địa điểm đã có bài viết vẫn được hiển thị."
          );
        } finally {
          if (!controller.signal.aborted) {
            setIsSearchingLocations(false);
          }
        }
      },
      850
    );

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchText]);

  // Khóa cuộn trang khi mở modal.
  useEffect(() => {
    if (!selectedDestination) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setSelectedDestination(null);
      }
    };

    document.body.style.overflow = "hidden";

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [selectedDestination]);

  // Gom các địa điểm đã có bài viết hoặc chuyến đi.
  const communityDestinations =
    useMemo(() => {
      const destinationMap = new Map<
        string,
        ExploreDestination
      >();

      const getDestination = (
        destinationName: string
      ) => {
        const cleanName =
          destinationName.trim();

        if (!cleanName) {
          return null;
        }

        const key = normalizeText(
          cleanName
        );

        let destination =
          destinationMap.get(key);

        if (!destination) {
          destination = {
            key,
            name: cleanName,
            address: "",
            imageUrl: "",
            posts: [],
            trips: [],
            totalLikes: 0,
            latestDate: "",
            isMapResult: false,
          };

          destinationMap.set(
            key,
            destination
          );
        }

        return destination;
      };

      posts.forEach((post) => {
        if (!post.location?.trim()) {
          return;
        }

        const destination =
          getDestination(post.location);

        if (!destination) {
          return;
        }

        destination.posts.push(post);

        destination.totalLikes +=
          post.likes?.length || 0;

        if (
          !destination.imageUrl &&
          post.imageUrls?.length > 0
        ) {
          destination.imageUrl =
            post.imageUrls[0];
        }

        if (
          !destination.latestDate ||
          new Date(
            post.createdAt
          ).getTime() >
            new Date(
              destination.latestDate
            ).getTime()
        ) {
          destination.latestDate =
            post.createdAt;
        }
      });

      trips.forEach((trip) => {
        if (!trip.destination?.trim()) {
          return;
        }

        const destination =
          getDestination(
            trip.destination
          );

        if (!destination) {
          return;
        }

        destination.trips.push(trip);

        if (
          !destination.imageUrl &&
          trip.coverImageUrl
        ) {
          destination.imageUrl =
            trip.coverImageUrl;
        }

        if (
          !destination.latestDate ||
          new Date(
            trip.createdAt
          ).getTime() >
            new Date(
              destination.latestDate
            ).getTime()
        ) {
          destination.latestDate =
            trip.createdAt;
        }
      });

      return Array.from(
        destinationMap.values()
      ).sort((first, second) => {
        const firstActivity =
          first.posts.length +
          first.trips.length;

        const secondActivity =
          second.posts.length +
          second.trips.length;

        if (
          secondActivity !== firstActivity
        ) {
          return (
            secondActivity - firstActivity
          );
        }

        return (
          new Date(
            second.latestDate
          ).getTime() -
          new Date(
            first.latestDate
          ).getTime()
        );
      });
    }, [posts, trips]);

  // Ghép địa điểm cộng đồng, địa điểm gợi ý
  // và kết quả tìm kiếm trên bản đồ.
  const filteredDestinations = useMemo(() => {
    const keyword = normalizeText(
      searchText
    );

    const parsedSearch =
      parseDestinationSearch(searchText);

    const matchesSelectedFilter = (
      destination: ExploreDestination
    ) => {
      if (
        activeFilter === "with_posts"
      ) {
        return (
          destination.posts.length > 0
        );
      }

      if (
        activeFilter === "with_trips"
      ) {
        return (
          destination.trips.length > 0
        );
      }

      return true;
    };

    if (!keyword) {
      return communityDestinations.filter(
        matchesSelectedFilter
      );
    }

    const results: ExploreDestination[] = [];

    const existingNames = new Set<string>();

    const addDestination = (
      destination: ExploreDestination
    ) => {
      const normalizedName = normalizeText(
        destination.name
      );

      if (
        !normalizedName ||
        existingNames.has(
          normalizedName
        ) ||
        !matchesSelectedFilter(
          destination
        )
      ) {
        return;
      }

      results.push(destination);

      existingNames.add(
        normalizedName
      );
    };

    const matchesCategorySearch = (
      destination: ExploreDestination
    ) => {
      if (!parsedSearch.category) {
        return false;
      }

      const destinationName = normalizeText(
        destination.name
      );

      const destinationAddress = normalizeText(
        destination.address
      );

      const matchesCategory =
        matchesDestinationCategoryName(
          destinationName,
          parsedSearch.keyword
        );

      const matchesLocation =
        !parsedSearch.location ||
        destinationAddress.includes(
          normalizeText(parsedSearch.location)
        );

      return matchesCategory && matchesLocation;
    };

    // Hiện trước địa điểm cộng đồng phù hợp loại hoặc tên tìm kiếm.
    communityDestinations
      .filter((destination) =>
        parsedSearch.category
          ? matchesCategorySearch(destination)
          : normalizeText(destination.name).startsWith(keyword)
      )
      .forEach(addDestination);

    // Sau đó hiện các địa điểm cộng đồng
    // có chứa từ khóa ở những vị trí khác.
    communityDestinations
      .filter((destination) => {
        const normalizedName = normalizeText(
          destination.name
        );

        return (
          !parsedSearch.category &&
          !normalizedName.startsWith(
            keyword
          ) &&
          normalizedName.includes(
            keyword
          )
        );
      })
      .forEach(addDestination);

    if (activeFilter !== "all") {
      return results;
    }

    // Gợi ý địa điểm ngay từ chữ cái đầu tiên.
    // Ví dụ: h → Hà Nội, Hải Phòng, Huế, Hội An.
    suggestedDestinations
      .filter(() => !parsedSearch.category)
      .filter((destinationName) =>
        normalizeText(
          destinationName
        ).startsWith(keyword)
      )
      .forEach((destinationName) => {
        const normalizedName = normalizeText(
          destinationName
        );

        const existingDestination =
          communityDestinations.find(
            (destination) =>
              normalizeText(
                destination.name
              ) === normalizedName
          );

        if (existingDestination) {
          addDestination(
            existingDestination
          );

          return;
        }

        addDestination({
          key: `suggested-${normalizedName}`,
          name: destinationName,
          address: `${destinationName}, Việt Nam`,
          imageUrl: "",
          posts: [],
          trips: [],
          totalLikes: 0,
          latestDate: "",
          isMapResult: true,
        });
      });

    // Với từ khóa đủ dài, bổ sung địa điểm
    // thực tế tìm được từ OpenStreetMap.
    mapSearchResults.forEach(
      (mapResult) => {
        const destinationName =
          getMapResultName(mapResult);

        const normalizedName = normalizeText(
          destinationName
        );

        const normalizedAddress = normalizeText(
          mapResult.display_name
        );

        // Khi tìm theo loại và khu vực, ví dụ
        // "chùa ở Hà Nội", API đã trả về đúng
        // các địa điểm. Không lọc lại bằng toàn bộ
        // câu vì tên từng chùa không chứa nguyên câu.
        if (
          !parsedSearch.category &&
          !normalizedName.includes(keyword) &&
          !normalizedAddress.includes(keyword)
        ) {
          return;
        }

        const existingDestination =
          communityDestinations.find(
            (destination) =>
              normalizeText(
                destination.name
              ) === normalizedName
          );

        if (existingDestination) {
          addDestination({
            ...existingDestination,
            address: mapResult.display_name,
            imageUrl:
              existingDestination.imageUrl ||
              mapResult.imageUrl ||
              "",
            latitude: Number(mapResult.lat),
            longitude: Number(mapResult.lon),
          });

          return;
        }

        addDestination({
          key: `map-${mapResult.place_id}`,
          name: destinationName,
          address: mapResult.display_name,
          imageUrl: mapResult.imageUrl || "",
          posts: [],
          trips: [],
          totalLikes: 0,
          latestDate: "",
          isMapResult: true,
          latitude: Number(mapResult.lat),
          longitude: Number(mapResult.lon),
        });
      }
    );

    return results;
  }, [
    activeFilter,
    communityDestinations,
    mapSearchResults,
    searchText,
  ]);

  const searchSuggestions = useMemo(() => {
    const keyword = normalizeText(searchText);
    const parsedSearch =
      parseDestinationSearch(searchText);

    // Khi nhập loại địa điểm như "biển", "chùa",
    // không gợi ý nhầm tên tỉnh/thành như "Điện Biên".
    if (!keyword || parsedSearch.category) {
      return [];
    }

    const names = [
      ...communityDestinations.map(
        (destination) => destination.name
      ),
      ...suggestedDestinations,
      ...mapSearchResults.map(getMapResultName),
    ];

    const uniqueNames = Array.from(
      new Map(
        names.map((name) => [
          normalizeText(name),
          name,
        ])
      ).values()
    );

    return uniqueNames
      .filter((name) =>
        normalizeText(name).includes(keyword)
      )
      .sort((firstName, secondName) => {
        const firstStartsWith = normalizeText(
          firstName
        ).startsWith(keyword);

        const secondStartsWith = normalizeText(
          secondName
        ).startsWith(keyword);

        if (firstStartsWith !== secondStartsWith) {
          return firstStartsWith ? -1 : 1;
        }

        return firstName.localeCompare(
          secondName,
          "vi"
        );
      })
      .slice(0, 8);
  }, [
    communityDestinations,
    mapSearchResults,
    searchText,
  ]);

  const totalTrips = useMemo(() => {
    return communityDestinations.reduce(
      (total, destination) =>
        total + destination.trips.length,
      0
    );
  }, [communityDestinations]);

  const totalPosts = useMemo(() => {
    return communityDestinations.reduce(
      (total, destination) =>
        total + destination.posts.length,
      0
    );
  }, [communityDestinations]);

  const isFavoriteDestination = (
    destinationName: string
  ) => {
    const normalizedName = normalizeText(
      destinationName
    ).replace(/\s+/g, " ");

    return favoriteDestinations.some(
      (favoriteDestination) =>
        normalizeText(
          favoriteDestination.name
        ).replace(/\s+/g, " ") === normalizedName
    );
  };

  const handleToggleFavoriteDestination = async (
    destination: ExploreDestination
  ) => {
    try {
      setSavingDestinationName(
        destination.name
      );

      const response =
        await axiosClient.post<ToggleFavoriteDestinationResponse>(
          "/favorite-destinations/toggle",
          {
            name: destination.name,
            address: destination.address || "",
            imageUrl: destination.imageUrl || "",
            latitude: destination.latitude ?? null,
            longitude: destination.longitude ?? null,
          }
        );

      setFavoriteDestinations(
        response.data.favoriteDestinations || []
      );
    } catch (error: any) {
      window.alert(
        error.response?.data?.message ||
          "Không thể cập nhật địa điểm yêu thích"
      );
    } finally {
      setSavingDestinationName("");
    }
  };

  return (
    <div className="explore-page">
      <header className="explore-header">
        <Link
          className="explore-brand"
          to="/home"
        >
          Travel Community
        </Link>

        <nav className="explore-navigation">
          <Link to="/home">
            Trang chủ
          </Link>

          <Link
            className="active"
            to="/explore"
          >
            Khám phá
          </Link>

          <Link to="/trips">
            Chuyến đi
          </Link>

          <Link to="/companions">
            Tìm bạn đồng hành
          </Link>
        </nav>

        <Link
          className="explore-home-link"
          to="/home"
        >
          Trang chủ
        </Link>
      </header>

      <main className="explore-container">
        <section className="explore-hero">
          <div className="explore-hero-content">
            <span className="explore-eyebrow">
              KHÁM PHÁ VIỆT NAM
            </span>

            <h1>
              Tìm điểm đến tiếp theo
            </h1>

            <p>
              Tìm kiếm địa điểm du lịch
              trên khắp Việt Nam và khám
              phá bài viết, hình ảnh,
              chuyến đi từ cộng đồng.
            </p>

            <div className="explore-hero-stats">
              <span>
                📍{" "}
                {
                  communityDestinations.length
                }{" "}
                địa điểm có hoạt động
              </span>

              <span>
                📝 {totalPosts} bài viết
              </span>

              <span>
                🧳 {totalTrips} chuyến đi
              </span>
            </div>
          </div>

          <div className="explore-hero-icon">
            🗺️
          </div>
        </section>

        <section className="explore-toolbar">
          <div className="explore-toolbar-heading">
            <h2>
              Khám phá điểm đến
            </h2>

            <p>
              {isSearchingLocations ? (
                "Đang tìm địa điểm trên bản đồ..."
              ) : (
                <>
                  Có{" "}
                  {
                    filteredDestinations.length
                  }{" "}
                  địa điểm phù hợp
                </>
              )}
            </p>
          </div>

          <div
            className="explore-search-wrapper"
            style={{
              position: "relative",
              width: "min(100%, 540px)",
            }}
          >
            <label
              className="explore-search"
              htmlFor="explore-search"
            >
              <span aria-hidden="true">
                🔎
              </span>

              <input
                id="explore-search"
                type="search"
                value={searchText}
                autoComplete="off"
                onFocus={() =>
                  setIsSearchFocused(true)
                }
                onBlur={() =>
                  window.setTimeout(
                    () =>
                      setIsSearchFocused(false),
                    120
                  )
                }
                onChange={(event) => {
                  setSearchText(
                    event.target.value
                  );
                  setActiveFilter("all");
                  setIsSearchFocused(true);
                }}
                placeholder="Tìm Tà Xùa, biển Mỹ Khê, Bà Nà Hills..."
              />
            </label>

            {isSearchFocused &&
              searchText.trim() &&
              searchSuggestions.length > 0 && (
                <div
                  className="explore-search-suggestions"
                  role="listbox"
                  style={{
                    position: "absolute",
                    zIndex: 100,
                    top: "calc(100% + 8px)",
                    right: 0,
                    left: 0,
                    overflow: "hidden",
                    padding: "8px",
                    background: "#ffffff",
                    border: "1px solid #d7e1dd",
                    borderRadius: "14px",
                    boxShadow:
                      "0 14px 35px rgba(24, 56, 47, 0.16)",
                  }}
                >
                  {searchSuggestions.map(
                    (destinationName) => (
                      <button
                        key={destinationName}
                        type="button"
                        role="option"
                        aria-selected="false"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => {
                          setSearchText(
                            destinationName
                          );
                          setActiveFilter("all");
                          setIsSearchFocused(false);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "12px 14px",
                          color: "#18231f",
                          background: "transparent",
                          border: 0,
                          borderRadius: "10px",
                          font: "inherit",
                          fontSize: "16px",
                          fontWeight: 650,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <span aria-hidden="true">
                          📍
                        </span>
                        {destinationName}
                      </button>
                    )
                  )}
                </div>
              )}
          </div>
        </section>

        <div className="explore-filters">
          <button
            className={
              activeFilter === "all"
                ? "explore-filter-button active"
                : "explore-filter-button"
            }
            type="button"
            onClick={() =>
              setActiveFilter("all")
            }
          >
            Tất cả địa điểm
          </button>

          <button
            className={
              activeFilter ===
              "with_posts"
                ? "explore-filter-button active"
                : "explore-filter-button"
            }
            type="button"
            onClick={() =>
              setActiveFilter(
                "with_posts"
              )
            }
          >
            Có bài viết
          </button>

          <button
            className={
              activeFilter ===
              "with_trips"
                ? "explore-filter-button active"
                : "explore-filter-button"
            }
            type="button"
            onClick={() =>
              setActiveFilter(
                "with_trips"
              )
            }
          >
            Đang có chuyến đi
          </button>
        </div>

        {message && (
          <div className="explore-message">
            {message}
          </div>
        )}

        {searchMessage && (
          <div className="explore-message">
            {searchMessage}
          </div>
        )}

        {isLoading ? (
          <div className="explore-status">
            Đang tải dữ liệu khám phá...
          </div>
        ) : isSearchingLocations &&
          filteredDestinations.length ===
            0 ? (
          <div className="explore-status">
            Đang tìm địa điểm trên bản
            đồ...
          </div>
        ) : filteredDestinations.length ===
          0 ? (
          <section className="explore-empty">
            <span>🧭</span>

            <h2>
              Chưa tìm thấy địa điểm
            </h2>

            <p>
              Hãy thử tìm bằng tên tỉnh,
              thành phố hoặc địa điểm du
              lịch khác.
            </p>

            <Link to="/home">
              Về trang chủ
            </Link>
          </section>
        ) : (
          <section className="explore-grid">
            {filteredDestinations.map(
              (destination) => (
                <article
                  className="destination-card"
                  key={destination.key}
                >
                  <button
                    className="destination-image"
                    type="button"
                    onClick={() =>
                      setSelectedDestination(
                        destination
                      )
                    }
                  >
                    <DestinationImage
                      name={destination.name}
                      address={destination.address}
                      imageUrl={destination.imageUrl}
                      latitude={destination.latitude}
                      longitude={destination.longitude}
                    />
                    {destination.trips
                      .length > 0 && (
                      <span className="destination-trip-badge">
                        Đang có chuyến đi
                      </span>
                    )}
                  </button>

                  <div className="destination-content">
                    <span className="destination-label">
                      {destination.isMapResult
                        ? "🌍 ĐỊA ĐIỂM TỪ BẢN ĐỒ"
                        : "📍 ĐIỂM ĐẾN"}
                    </span>

                    <h2>
                      {destination.name}
                    </h2>

                    {destination.address && (
                      <p className="destination-address">
                        {destination.address}
                      </p>
                    )}

                  <div className="destination-statistics">
                  <span>
                 📝 {destination.posts.length} bài viết
                </span>
                <span>
                       🧳 {destination.trips.length} chuyến đi
               </span>
                    <span>
               👍 {destination.totalLikes}
              </span>
                <button
                className={
                   isFavoriteDestination(destination.name)
                 ? "destination-save-icon saved"
               : "destination-save-icon"
            }
               type="button"
                disabled={
                   savingDestinationName ===
                 destination.name
                 }
                   title={
              isFavoriteDestination(destination.name)
                ? "Bỏ lưu địa điểm"
                 : "Lưu địa điểm"
          }
              aria-label={
            isFavoriteDestination(destination.name)
                 ? "Bỏ lưu địa điểm"
                 : "Lưu địa điểm"
            }
             onClick={(event) => {
                event.stopPropagation();
             void handleToggleFavoriteDestination(
                  destination
              );
              }}
           >
             <svg
            viewBox="0 0 24 24"
                aria-hidden="true"
                >
           <path d="M6 4.75A2.75 2.75 0 0 1 8.75 2h6.5A2.75 2.75 0 0 1 18 4.75v15.19a.75.75 0 0 1-1.19.61L12 17.16l-4.81 3.39A.75.75 0 0 1 6 19.94V4.75Z" />
             </svg>
              </button>
               </div>
                    <button
                      className="destination-detail-button"
                      type="button"
                      onClick={() =>
                        setSelectedDestination(
                          destination
                        )
                      }
                    >
                      Khám phá địa điểm
                    </button>

                  </div>
                </article>
              )
            )}
          </section>
        )}
      </main>

      {selectedDestination && (
        <div
          className="destination-modal-overlay"
          onMouseDown={() =>
            setSelectedDestination(
              null
            )
          }
        >
          <section
            className="destination-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="destination-modal-header">
              <div>
                <span>
                  📍 ĐỊA ĐIỂM DU LỊCH
                </span>

                <h2>
                  {
                    selectedDestination.name
                  }
                </h2>
              </div>

              <button
                className="destination-modal-close"
                type="button"
                aria-label="Đóng"
                onClick={() =>
                  setSelectedDestination(
                    null
                  )
                }
              >
                ×
              </button>
            </header>

            <div className="destination-modal-body">
              <div className="destination-modal-cover">
                <DestinationImage
                  name={selectedDestination.name}
                  address={selectedDestination.address}
                  imageUrl={selectedDestination.imageUrl}
                  latitude={selectedDestination.latitude}
                  longitude={selectedDestination.longitude}
                />
              </div>

              {selectedDestination.address && (
                <p className="destination-modal-address">
                  📍{" "}
                  {
                    selectedDestination.address
                  }
                </p>
              )}
              <div
                className="destination-modal-statistics"
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <span>
                  📝 {selectedDestination.posts.length} bài viết
                </span>

                <span>
                  🧳 {selectedDestination.trips.length} chuyến đi
                </span>

                <span>
                  👍 {selectedDestination.totalLikes} lượt thích
                </span>

                <button
                  className={
                    isFavoriteDestination(
                      selectedDestination.name
                    )
                      ? "destination-modal-save-button saved"
                      : "destination-modal-save-button"
                  }
                  type="button"
                  title={
                    isFavoriteDestination(
                      selectedDestination.name
                    )
                      ? "Bỏ lưu địa điểm"
                      : "Lưu địa điểm"
                  }
                  aria-label={
                    isFavoriteDestination(
                      selectedDestination.name
                    )
                      ? "Bỏ lưu địa điểm"
                      : "Lưu địa điểm"
                  }
                  style={{
                    width: "auto",
                    minWidth: "170px",
                    minHeight: "46px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginLeft: "auto",
                    padding: "0 17px",
                    color: isFavoriteDestination(
                      selectedDestination.name
                    )
                      ? "#ffffff"
                      : "#087f67",
                    background: isFavoriteDestination(
                      selectedDestination.name
                    )
                      ? "#087f67"
                      : "#ffffff",
                    border: isFavoriteDestination(
                      selectedDestination.name
                    )
                      ? "1px solid #087f67"
                      : "1px solid #b9ddd3",
                    borderRadius: "999px",
                    font: "inherit",
                    fontSize: "15px",
                    fontWeight: 750,
                    lineHeight: 1,
                    cursor:
                      savingDestinationName ===
                      selectedDestination.name
                        ? "wait"
                        : "pointer",
                  }}
                  disabled={
                    savingDestinationName ===
                    selectedDestination.name
                  }
                  onClick={() => {
                    void handleToggleFavoriteDestination(
                      selectedDestination
                    );
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    style={{
                      width: "20px",
                      height: "20px",
                      minWidth: "20px",
                      display: "block",
                      fill: isFavoriteDestination(
                        selectedDestination.name
                      )
                        ? "currentColor"
                        : "none",
                      stroke: "currentColor",
                      strokeWidth: 1.8,
                      strokeLinejoin: "round",
                    }}
                  >
                    <path d="M6 4.75A2.75 2.75 0 0 1 8.75 2h6.5A2.75 2.75 0 0 1 18 4.75v15.19a.75.75 0 0 1-1.19.61L12 17.16l-4.81 3.39A.75.75 0 0 1 6 19.94V4.75Z" />
                  </svg>

                  <span>
                    {savingDestinationName ===
                    selectedDestination.name
                      ? "Đang xử lý..."
                      : isFavoriteDestination(
                            selectedDestination.name
                          )
                        ? "Đã lưu địa điểm"
                        : "Lưu địa điểm"}
                  </span>
                </button>
              </div>

              <DestinationMap
                destination={
                  selectedDestination.name
                }
                latitude={
                  selectedDestination.latitude
                }
                longitude={
                  selectedDestination.longitude
                }
                address={
                  selectedDestination.address
                }
              />

              {selectedDestination.trips
                .length > 0 && (
                <section className="destination-related-section">
                  <div className="destination-section-heading">
                    <h3>
                      Chuyến đi đang tìm
                      bạn đồng hành
                    </h3>
                  </div>

                  <div className="destination-trip-list">
                    {selectedDestination.trips.map(
                      (trip) => (
                        <article
                          className="destination-trip-item"
                          key={trip._id}
                        >
                          <div>
                            <h4>
                              {trip.title}
                            </h4>

                            <p>
                              📅{" "}
                              {formatDate(
                                trip.startDate
                              )}
                              {" – "}
                              {formatDate(
                                trip.endDate
                              )}
                            </p>

                            <p>
                              💰{" "}
                              {formatMoney(
                                trip.budget
                              )}{" "}
                              đ
                            </p>

                            <p>
                              👥{" "}
                              {Math.min(
                                trip.members
                                  .length + 1,
                                trip.maxMembers
                              )}
                              /
                              {
                                trip.maxMembers
                              }{" "}
                              người
                            </p>
                          </div>

                          <Link
                            to={`/trips/${trip._id}`}
                          >
                            Xem chuyến đi
                          </Link>
                        </article>
                      )
                    )}
                  </div>
                </section>
              )}

              {selectedDestination.posts
                .length > 0 && (
                <section className="destination-related-section">
                  <div className="destination-section-heading">
                    <h3>
                      Bài viết từ cộng
                      đồng
                    </h3>
                  </div>

                  <div className="destination-post-list">
                    {selectedDestination.posts.map(
                      (post) => (
                        <article
                          className="destination-post-item"
                          key={post._id}
                        >
                          <div className="destination-post-author">
                            <div className="destination-post-avatar">
                              {post.author
                                .avatarUrl ? (
                                <img
                                  src={
                                    post.author
                                      .avatarUrl
                                  }
                                  alt={
                                    post.author
                                      .fullName
                                  }
                                />
                              ) : (
                                getFirstLetter(
                                  post.author
                                    .fullName
                                )
                              )}
                            </div>

                            <div>
                              <strong>
                                {
                                  post.author
                                    .fullName
                                }
                              </strong>

                              <span>
                                {formatDate(
                                  post.createdAt
                                )}
                              </span>
                            </div>
                          </div>

                          <p className="destination-post-content">
                            {post.content}
                          </p>

                          {post.imageUrls
                            .length > 0 && (
                            <div className="destination-post-images">
                              {post.imageUrls
                                .slice(0, 2)
                                .map(
                                  (
                                    imageUrl,
                                    index
                                  ) => (
                                    <img
                                      key={`${post._id}-${index}`}
                                      src={
                                        imageUrl
                                      }
                                      alt={`Ảnh ${
                                        index +
                                        1
                                      }`}
                                    />
                                  )
                                )}
                            </div>
                          )}

                          <div className="destination-post-footer">
                            <span>
                              👍{" "}
                              {
                                post.likes
                                  .length
                              }
                            </span>

                            <span>
                              💬{" "}
                              {post.commentsCount ||
                                0}
                            </span>

                            <Link
                              to={`/home?post=${post._id}`}
                            >
                              Xem bài viết
                            </Link>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                </section>
              )}

              {selectedDestination.posts
                .length === 0 &&
                selectedDestination.trips
                  .length === 0 && (
                  <section className="destination-no-activity">
                    <span>🧭</span>

                    <h3>
                      Chưa có hoạt động
                      tại địa điểm này
                    </h3>

                    <p>
                      Hiện chưa có bài viết
                      hoặc chuyến đi nào
                      được chia sẻ tại{" "}
                      {
                        selectedDestination.name
                      }
                      .
                    </p>

                    <Link to="/home">
                      Chia sẻ bài viết
                      đầu tiên
                    </Link>
                  </section>
                )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default ExplorePage;
