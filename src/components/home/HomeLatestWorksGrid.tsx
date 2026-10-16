"use client";

import { useEffect, useState } from "react";
import ProjectCard, { type ProjectCardProject } from "@/components/projects/ProjectCard";
import { HOME_WORKS_MAX, HOME_WORKS_MQ, homeWorksShowAt } from "@/lib/layout/homeWorksGrid";

export default function HomeLatestWorksGrid({
  projects,
}: {
  projects: ProjectCardProject[];
}) {
  const [show, setShow] = useState(HOME_WORKS_MAX);

  useEffect(() => {
    const apply = () => setShow(homeWorksShowAt(window.innerWidth));
    apply();
    const mqs = HOME_WORKS_MQ.map((query) => window.matchMedia(query));
    mqs.forEach((mq) => mq.addEventListener("change", apply));
    return () => mqs.forEach((mq) => mq.removeEventListener("change", apply));
  }, []);

  return (
    <div className="home-latest-works-grid grid gap-4 mt-8 items-stretch">
      {projects.slice(0, show).map((p, i) => (
        <ProjectCard key={p.id} project={p} compact idx={i} />
      ))}
    </div>
  );
}
