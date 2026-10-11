export interface ShowcaseSlideshowProject {
  id: string;
  title: string;
  slug: string;
  description: string;
  tags: { slug: string; name: string }[];
  coverImage: string | null;
  images: { url: string; altText?: string | null }[];
}

export interface ShowcaseSlide {
  project: ShowcaseSlideshowProject;
  src: string;
  alt: string;
  kind: "封面" | "截图";
}

/** Follow catalogue order, then cover and ordered screenshots for each work. */
export function buildShowcaseSlides(projects: ShowcaseSlideshowProject[]): ShowcaseSlide[] {
  return projects.flatMap(project => {
    const slides: ShowcaseSlide[] = [];
    const seen = new Set<string>();
    const add = (src: string | null, alt: string, kind: ShowcaseSlide["kind"]) => {
      if (!src || seen.has(src)) return;
      seen.add(src);
      slides.push({ project, src, alt, kind });
    };
    add(project.coverImage, `${project.title} · 封面`, "封面");
    project.images.forEach((image, i) => add(image.url, image.altText || `${project.title} · 截图 ${i + 1}`, "截图"));
    if (!slides.length) add("/images/logo.png", `${project.title} · 暂无图片`, "封面");
    return slides;
  });
}
