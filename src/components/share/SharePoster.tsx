"use client";

import Image from "next/image";
import { useState } from "react";
import type { ShareCardData, ShareHeader } from "@/lib/share";
import type { Lang } from "@/lib/i18n/config";
import { toPlainCardText } from "@/lib/rich-content";
import { t, type DictKey } from "@/lib/i18n/dict";
import { tagDisplayName } from "@/lib/tags/tag-names";
import styles from "./SharePoster.module.css";

function PosterImage({ src, className, alt, avatar = false }: { src: string; className: string; alt: string; avatar?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className={[className, styles.initial].join(" ")}>{alt.slice(0, 1)}</div> : <Image src={src} width={avatar ? 96 : 800} height={avatar ? 96 : 500} sizes={avatar ? "64px" : "400px"} alt={alt} loading="eager" onError={() => setFailed(true)} className={className} />;
}

function DetailIcon({ location = false }: { location?: boolean }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{location ? <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></> : <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18" /></>}</svg>;
}

/** 作品状态标签直接用站内词典，避免分享卡和详情页出现两套文案。 */
const WORK_TYPE_KEYS: Record<string, DictKey> = {
  IN_DEVELOPMENT: "work.status.IN_DEVELOPMENT",
  TRIAL_DEMO: "work.status.TRIAL_DEMO",
  MINI_GAME: "work.status.MINI_GAME",
  OFFICIAL_RELEASE: "work.status.OFFICIAL_RELEASE",
};

export default function SharePoster({ data, lang, header, qr }: { data: ShareCardData; lang: Lang; header: ShareHeader; qr: string }) {
  const en = lang === "en";
  const member = data.kind === "member";
  const imageHeader = header.kind === "image";
  return <article data-share-poster className={styles.poster} data-header-color={header.kind === "color" ? header.color : "blue"} data-header-mode={imageHeader ? "image" : "color"} data-card={member ? "member" : "activity"}>
    <div className={styles.hero}>
      {imageHeader ? <><PosterImage key={header.url} src={header.url} alt="" className={member ? `${styles.heroImage} ${styles.heroImageFit}` : styles.heroImage} /><div className={member ? styles.heroShadeFit : styles.heroShade} aria-hidden /></> : <div className={styles.pattern} aria-hidden />}
      <header className={styles.brand}>
        <img src="/images/logo.png" width="34" height="34" alt="" />
        <span>{en ? "Bugoo Studio" : "布谷工作室"}</span>
      </header>
      {member ? <div className={styles.identity}>
        {data.image ? <PosterImage key={data.image} avatar src={data.image} alt={data.title} className={styles.avatar} /> : <div className={[styles.avatar, styles.initial].join(" ")}>{data.title.slice(0, 1)}</div>}
        <div className={styles.memberDetails}>
          <h2 className={styles.title}>{data.title}</h2>
          {!!data.tags?.length && <div className={styles.tags}>{data.tags.slice(0, 8).map((tag, i) => <span key={i}>{tag}</span>)}</div>}
          {data.summary && <p className={styles.bio}>{data.summary}</p>}
        </div>
      </div> : <div className={styles.activityHeading}>
        <h2 className={styles.title}>{data.title}</h2>
        <span className={styles.accent} aria-hidden />
      </div>}
    </div>

    <div className={styles.body}>
      {member ? !!data.works?.length && <div>
        <div className={styles.works}>{data.works.map((work, index) => <a key={`${work.slug}-${index}`} href={`/works/${encodeURIComponent(work.slug)}`} className={styles.workCard}>
          <div className={styles.workMedia}>{work.image ? <PosterImage src={work.image} alt={work.title} className={styles.workImage} /> : <div className={[styles.workImage, styles.workFallback].join(" ")}>🎮</div>}</div>
          <div className={styles.workInfo}>
            <div className={styles.workHeading}><p className={styles.workTitle}>{work.title}</p>{work.subtitle && <span className={styles.workSubtitle}>{work.subtitle}</span>}</div>
            {work.description && <p className={styles.workDescription}>{toPlainCardText(work.description)}</p>}
            {!!work.tags?.length && <div className={styles.workTags}>{work.tags.slice(0, 4).map(tag => <span key={tag.slug} style={{ color: tag.color || "#3388BB", backgroundColor: `${tag.color || "#3388BB"}18` }}>{tagDisplayName(tag.slug, tag.name, lang)}</span>)}</div>}
            <div className={styles.workMeta}>{work.type && <span>{WORK_TYPE_KEYS[work.type] ? t(lang, WORK_TYPE_KEYS[work.type]) : work.type}</span>}{work.year && <span>{work.year}</span>}</div>
          </div>
        </a>)}</div>
      </div> : <>
        <div className={styles.details}>
          <div className={styles.detail}><DetailIcon /><p className={styles.date}>{data.date}{data.time ? <><span className={styles.dateSeparator} aria-hidden> · </span><span className={styles.time}>{data.time}</span></> : null}</p></div>
          <div className={styles.detail}><DetailIcon location /><p className={styles.location}>{data.location}</p></div>
        </div>
        {(!!data.agenda?.length || !!data.summary || data.talkSubmissionOpen) && <div className={styles.agenda}>
          <div className={styles.contentHeading}><p className={styles.label}>{en ? "This event" : "本次内容"}</p>{data.talkSubmissionOpen && <span className={styles.signupBadge}>{en ? "Talk submissions open" : "分享报名征集中"}</span>}</div>
          {!!data.agenda?.length && <div className={styles.topics}>{data.agenda.map((item, i) => <p key={i} className={styles.topic}><span className={styles.topicDot} aria-hidden /><span className={styles.topicTitle}>{item.title}{item.speaker && <span className={styles.topicBy}>{en ? `by ${item.speaker}` : `· ${item.speaker}`}</span>}</span></p>)}</div>}
          {!data.agenda?.length && data.summary && <p className={styles.summary}>{data.summary}</p>}
        </div>}
      </>}

      <footer className={styles.footer}>
        <div><p className={styles.cta}>{member ? (en ? "Profile & works" : "主页与作品") : (en ? "Scan to learn more" : "扫码了解")}</p><p className={styles.qrHint}>{member ? (en ? "Scan to view" : "扫码查看") : (en ? "View event details & submit a talk" : "查看活动详情与报名分享")} <span aria-hidden>↗</span></p></div>
        {qr ? <img src={qr} width="80" height="80" alt={en ? "Page QR code" : "页面二维码"} className={styles.qr} /> : <div className={styles.qr} />}
      </footer>
    </div>
  </article>;
}

