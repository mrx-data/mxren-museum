export type ArtifactCategory = "games" | "landscapes" | "personal-works";

export type Artifact = {
  id: string;
  title: string;
  category: ArtifactCategory;
  categoryLabel: string;
  volume: string;
  year: string;
  medium: string;
  rarity: string;
  featured: boolean;
  symbol: string;
  coverAlt: string;
  coverImage: string;
  galleryImages: Array<{
    src: string;
    alt: string;
    label: string;
  }>;
  palette: {
    from: string;
    via: string;
    to: string;
    accent: string;
  };
  summary: string;
  note: string;
};

export const categories: Array<{ id: "all" | ArtifactCategory; label: string }> = [
  { id: "all", label: "全部馆藏" },
  { id: "games", label: "游戏藏品" },
  { id: "landscapes", label: "风景切片" },
  { id: "personal-works", label: "个人作品" }
];

export const artifacts: Artifact[] = [
  {
    id: "nocturne-game",
    title: "夜行者存档",
    category: "games",
    categoryLabel: "游戏藏品",
    volume: "I",
    year: "2026",
    medium: "Screenshot / Save Memory",
    rarity: "蜡封精选",
    featured: true,
    symbol: "♜",
    coverAlt: "一张暗金色游戏城堡封面",
    coverImage: "/artifacts/nocturne-game-cover.png",
    galleryImages: [
      { src: "/artifacts/nocturne-game-detail.png", alt: "夜行者存档的暗金城堡细节图", label: "细节" },
      { src: "/artifacts/nocturne-game-memory.png", alt: "夜行者存档的光晕记忆图", label: "记忆" },
      { src: "/artifacts/nocturne-game-plate.png", alt: "夜行者存档的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#15100F",
      via: "#463021",
      to: "#9D6B36",
      accent: "#D4B872"
    },
    summary: "一次通关后的私人战利品：不是装备，而是深夜里仍记得的光线、地图和胜利后的安静。",
    note: "适合记录游戏名、角色、关卡、截图位置，以及这段体验为什么值得被收藏。"
  },
  {
    id: "emerald-cliff",
    title: "翡翠山崖",
    category: "landscapes",
    categoryLabel: "风景切片",
    volume: "II",
    year: "2025",
    medium: "Travel Photo / Color Study",
    rarity: "自然标本",
    featured: true,
    symbol: "◇",
    coverAlt: "一张绿色山崖与金色雾光封面",
    coverImage: "/artifacts/emerald-cliff-cover.png",
    galleryImages: [
      { src: "/artifacts/emerald-cliff-detail.png", alt: "翡翠山崖的绿色岩壁细节图", label: "细节" },
      { src: "/artifacts/emerald-cliff-memory.png", alt: "翡翠山崖的雾光记忆图", label: "记忆" },
      { src: "/artifacts/emerald-cliff-plate.png", alt: "翡翠山崖的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#12201B",
      via: "#355845",
      to: "#B58E47",
      accent: "#A7C08B"
    },
    summary: "把一段风景从相册里拿出来，像夹在旧书里的植物标本一样保存它的空气感。",
    note: "后续可补充真实地点、拍摄时间、设备、天气和当时的心情。"
  },
  {
    id: "first-gallery-poster",
    title: "第一张展馆海报",
    category: "personal-works",
    categoryLabel: "个人作品",
    volume: "III",
    year: "2026",
    medium: "Design Work / Poster",
    rarity: "创作精选",
    featured: true,
    symbol: "✦",
    coverAlt: "一张黄铜边框的个人海报作品封面",
    coverImage: "/artifacts/first-gallery-poster-cover.png",
    galleryImages: [
      { src: "/artifacts/first-gallery-poster-detail.png", alt: "第一张展馆海报的版式细节图", label: "细节" },
      { src: "/artifacts/first-gallery-poster-memory.png", alt: "第一张展馆海报的记忆图", label: "记忆" },
      { src: "/artifacts/first-gallery-poster-plate.png", alt: "第一张展馆海报的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#231A16",
      via: "#6A2633",
      to: "#C9A962",
      accent: "#E8DFD4"
    },
    summary: "个人作品不只归档成文件，而是拥有封面、题名和编号的馆藏条目。",
    note: "适合收录设计稿、文章、视频、Prompt、实验页面和任何愿意反复回看的创作。"
  },
  {
    id: "silent-harbor",
    title: "静港黄昏",
    category: "landscapes",
    categoryLabel: "风景切片",
    volume: "IV",
    year: "2024",
    medium: "Photo / Evening Archive",
    rarity: "光线样本",
    featured: false,
    symbol: "☾",
    coverAlt: "一张黄昏港口与深蓝海面封面",
    coverImage: "/artifacts/silent-harbor-cover.png",
    galleryImages: [
      { src: "/artifacts/silent-harbor-detail.png", alt: "静港黄昏的海面细节图", label: "细节" },
      { src: "/artifacts/silent-harbor-memory.png", alt: "静港黄昏的暮色记忆图", label: "记忆" },
      { src: "/artifacts/silent-harbor-plate.png", alt: "静港黄昏的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#101820",
      via: "#3A4C57",
      to: "#B7814C",
      accent: "#C9A962"
    },
    summary: "一张为了色温留下的风景，适合作为未来视觉项目的情绪参考。",
    note: "藏馆可以把风景变成灵感索引，而不是只做旅行相册。"
  },
  {
    id: "arcade-relic",
    title: "像素圣物柜",
    category: "games",
    categoryLabel: "游戏藏品",
    volume: "V",
    year: "2023",
    medium: "Pixel Memory / Arcade",
    rarity: "复古样本",
    featured: false,
    symbol: "▣",
    coverAlt: "一张像素街机风格的数字藏品封面",
    coverImage: "/artifacts/arcade-relic-cover.png",
    galleryImages: [
      { src: "/artifacts/arcade-relic-detail.png", alt: "像素圣物柜的像素细节图", label: "细节" },
      { src: "/artifacts/arcade-relic-memory.png", alt: "像素圣物柜的街机记忆图", label: "记忆" },
      { src: "/artifacts/arcade-relic-plate.png", alt: "像素圣物柜的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#1C1714",
      via: "#4F2A39",
      to: "#8660A8",
      accent: "#C9A962"
    },
    summary: "用于记录那些不一定宏大，却和某个阶段强绑定的游戏片段。",
    note: "可以补充平台、通关状态、最喜欢的机制和推荐理由。"
  },
  {
    id: "mist-library",
    title: "雾中书房",
    category: "landscapes",
    categoryLabel: "风景切片",
    volume: "VI",
    year: "2026",
    medium: "AI Landscape / Moodboard",
    rarity: "氛围标本",
    featured: false,
    symbol: "❧",
    coverAlt: "一张雾中书房与窗光封面",
    coverImage: "/artifacts/mist-library-cover.png",
    galleryImages: [
      { src: "/artifacts/mist-library-detail.png", alt: "雾中书房的窗格细节图", label: "细节" },
      { src: "/artifacts/mist-library-memory.png", alt: "雾中书房的雾光记忆图", label: "记忆" },
      { src: "/artifacts/mist-library-plate.png", alt: "雾中书房的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#1D1A17",
      via: "#5B5144",
      to: "#A99B7D",
      accent: "#D4B872"
    },
    summary: "不是现实地标，而是一种愿意反复进入的精神风景。",
    note: "数字藏馆也可以收纳 AI 生成图、梦境草图和概念场景。"
  },
  {
    id: "interface-study",
    title: "界面标本 01",
    category: "personal-works",
    categoryLabel: "个人作品",
    volume: "VII",
    year: "2026",
    medium: "Frontend Study / UI",
    rarity: "实验稿",
    featured: false,
    symbol: "⌁",
    coverAlt: "一张前端界面研究作品封面",
    coverImage: "/artifacts/interface-study-cover.png",
    galleryImages: [
      { src: "/artifacts/interface-study-detail.png", alt: "界面标本 01 的界面细节图", label: "细节" },
      { src: "/artifacts/interface-study-memory.png", alt: "界面标本 01 的实验记忆图", label: "记忆" },
      { src: "/artifacts/interface-study-plate.png", alt: "界面标本 01 的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#171D1B",
      via: "#305B52",
      to: "#C9A962",
      accent: "#E8DFD4"
    },
    summary: "把一次界面练习变成可以回看的作品档案，保留当时的审美假设和技术取舍。",
    note: "后续每个作品条目都应包含截图、链接、技术栈和复盘。"
  },
  {
    id: "boss-room",
    title: "终局房间",
    category: "games",
    categoryLabel: "游戏藏品",
    volume: "VIII",
    year: "2025",
    medium: "Boss Arena / Memory",
    rarity: "挑战记录",
    featured: false,
    symbol: "✠",
    coverAlt: "一张终局战斗房间的红金色封面",
    coverImage: "/artifacts/boss-room-cover.png",
    galleryImages: [
      { src: "/artifacts/boss-room-detail.png", alt: "终局房间的战斗场地细节图", label: "细节" },
      { src: "/artifacts/boss-room-memory.png", alt: "终局房间的挑战记忆图", label: "记忆" },
      { src: "/artifacts/boss-room-plate.png", alt: "终局房间的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#1B1111",
      via: "#6F2330",
      to: "#B8953F",
      accent: "#C9A962"
    },
    summary: "不是为了炫耀难度，而是记录那种投入、失败、熟悉节奏之后抵达终点的感觉。",
    note: "适合记录挑战次数、装备路线、截图和一句复盘。"
  },
  {
    id: "essay-cover",
    title: "长文封面手稿",
    category: "personal-works",
    categoryLabel: "个人作品",
    volume: "IX",
    year: "2024",
    medium: "Writing / Cover Draft",
    rarity: "手稿",
    featured: false,
    symbol: "✎",
    coverAlt: "一张长文封面与手稿质感的个人作品封面",
    coverImage: "/artifacts/essay-cover-cover.png",
    galleryImages: [
      { src: "/artifacts/essay-cover-detail.png", alt: "长文封面手稿的排版细节图", label: "细节" },
      { src: "/artifacts/essay-cover-memory.png", alt: "长文封面手稿的写作记忆图", label: "记忆" },
      { src: "/artifacts/essay-cover-plate.png", alt: "长文封面手稿的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#251E19",
      via: "#704631",
      to: "#C9A962",
      accent: "#E8DFD4"
    },
    summary: "把文章、封面和观点一起归档，让作品不只散落在文件夹和发布平台里。",
    note: "后续可以加入原文链接、发布日期、版本和二次编辑记录。"
  }
];
