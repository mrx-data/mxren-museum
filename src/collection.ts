export type ArtifactCategory = string;
export type ArtifactVisibility = "draft" | "published" | "unlisted";

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
  visibility: ArtifactVisibility;
  symbol: string;
  coverAlt: string;
  coverImage: string;
  coverThumbnailImage?: string;
  galleryImages: Array<{
    src: string;
    alt: string;
    label: string;
    storagePath?: string;
  }>;
  palette: {
    from: string;
    via: string;
    to: string;
    accent: string;
  };
  summary: string;
  note: string;
  source?: "sample" | "local" | "remote";
  updatedAt?: string;
  coverStoragePath?: string;
  coverThumbnailStoragePath?: string;
  remoteId?: string;
  sourceArtifactId?: string;
};

export const categories: Array<{ id: "all" | ArtifactCategory; label: string }> = [
  { id: "all", label: "全部馆藏" },
  { id: "games", label: "游戏藏品" },
  { id: "landscapes", label: "风景切片" },
  { id: "personal-works", label: "个人作品" }
];

export const artifacts: Artifact[] = [
  {
    id: "black-myth-wukong",
    title: "黑神话：悟空",
    category: "games",
    categoryLabel: "游戏藏品",
    volume: "I",
    year: "2024",
    medium: "Game Cover / Myth Archive",
    rarity: "东方神话标本",
    featured: true,
    visibility: "published",
    symbol: "☄",
    coverAlt: "一张黑神话悟空竖版封面，悟空站在云雾山崖前",
    coverImage: "/artifacts/blackMyth.png",
    galleryImages: [
      { src: "/artifacts/blackMyth.png", alt: "黑神话悟空的封面图细节", label: "细节" },
      { src: "/artifacts/blackMyth.png", alt: "黑神话悟空的云雾山崖记忆图", label: "记忆" },
      { src: "/artifacts/blackMyth.png", alt: "黑神话悟空的馆藏图板", label: "图板" }
    ],
    palette: {
      from: "#14100D",
      via: "#4D2A1C",
      to: "#B88A3D",
      accent: "#D4B872"
    },
    summary: "把一次东方神话旅程收进馆藏：山崖、云海、金箍和踏上取经路之前的那一口安静。",
    note: "后续可继续补充通关进度、最喜欢的章节、关键截图和一句战斗复盘。"
  }
];
