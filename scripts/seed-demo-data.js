/**
 * 演示数据脚本
 * 用法：docker compose exec app node scripts/seed-demo-data.js
 */

const { PrismaClient } = require("@prisma/client");
const { scrypt, randomBytes } = require("crypto");
const prisma = new PrismaClient();

// ----- 生成 scrypt 哈希 -----
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(32).toString("hex");
    scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1 },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve("scrypt:" + salt + ":" + derivedKey.toString("hex"));
      }
    );
  });
}

async function seed() {
  console.log("Seeding demo data...\n");

  // ============ 1. 修复管理员密码 ============
  const adminHash = await hashPassword("admin123456");
  await prisma.user.updateMany({
    where: { email: "admin@bugu.local" },
    data: { passwordHash: adminHash, emailVerified: new Date() },
  });
  console.log("✓ 管理员密码已更新（scrypt 格式）");
  console.log("  邮箱: admin@bugu.local  密码: admin123456\n");

  // ============ 2. 创建测试用户 ============
  const demoHash = await hashPassword("demo1234");
  const users = [];
  const userData = [
    { email: "zhang3@bugu.local", name: "张三", role: "MEMBER" },
    { email: "li4@bugu.local", name: "李四", role: "MEMBER" },
    { email: "wang5@bugu.local", name: "王五", role: "USER" },
    { email: "zhao6@bugu.local", name: "赵六", role: "REVIEWER" },
    { email: "sun7@bugu.local", name: "孙七", role: "MEMBER" },
  ];

  for (const u of userData) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      users.push(existing);
    } else {
      const created = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash: demoHash,
          name: u.name,
          role: u.role,
          emailVerified: new Date(),
        },
      });
      users.push(created);
      console.log("  + 用户:", u.name, `<${u.email}> [${u.role}]`);
    }
  }
  console.log("✓ 测试用户就绪\n");

  // ============ 3. 创建社团成员 ============
  const memberMap = {};
  const memberData = [
    { userId: users[0].id, displayName: "张三", bio: "擅长 Unity 和 C#，做过两个 Steam 游戏", grade: "2022级", joinYear: 2022, skills: ["Unity", "C#", "Blender"] },
    { userId: users[1].id, displayName: "李四", bio: "美术出身，喜欢像素风格和 indie 独立游戏", grade: "2022级", joinYear: 2022, skills: ["Pixel Art", "Aseprite", "Photoshop"] },
    { userId: users[4].id, displayName: "孙七", bio: "主攻 UE5 和 C++，热衷技术美术", grade: "2023级", joinYear: 2023, skills: ["Unreal Engine 5", "C++", "HLSL"] },
    { userId: "admin-member-placeholder", displayName: "管理员-布谷", bio: "社团管理员，负责维护网站和审核作品", grade: "2020级", joinYear: 2020, skills: ["Web Dev", "项目管理", "Unity"] },
  ];

  const adminUser = await prisma.user.findUnique({ where: { email: "admin@bugu.local" } });
  memberData[3].userId = adminUser.id;

  for (const m of memberData) {
    const existing = await prisma.clubMember.findUnique({ where: { userId: m.userId } });
    if (existing) {
      memberMap[m.userId] = existing;
    } else {
      const created = await prisma.clubMember.create({
        data: {
          userId: m.userId,
          displayName: m.displayName,
          bio: m.bio,
          grade: m.grade,
          joinYear: m.joinYear,
          skills: m.skills,
        },
      });
      memberMap[m.userId] = created;
      console.log("  + 成员:", m.displayName, "-", m.grade);
    }
  }
  console.log("✓ 社团成员就绪\n");

  // ============ 4. 创建标签 ============
  const tagData = [
    { name: "Unity", slug: "unity", color: "#5568d3" },
    { name: "Unreal Engine", slug: "unreal", color: "#8b5cf6" },
    { name: "2D", slug: "2d", color: "#06b6d4" },
    { name: "3D", slug: "3d", color: "#f59e0b" },
    { name: "像素风格", slug: "pixel-art", color: "#ec4899" },
    { name: "Roguelike", slug: "roguelike", color: "#ef4444" },
    { name: "解谜", slug: "puzzle", color: "#10b981" },
    { name: "多人联机", slug: "multiplayer", color: "#f97316" },
    { name: "Game Jam", slug: "game-jam", color: "#14b8a6" },
    { name: "毕业设计", slug: "graduation", color: "#a855f7" },
  ];

  const tags = {};
  for (const t of tagData) {
    const existing = await prisma.tag.findUnique({ where: { slug: t.slug } });
    if (existing) {
      tags[t.slug] = existing;
    } else {
      const created = await prisma.tag.create({ data: t });
      tags[t.slug] = created;
    }
  }
  console.log("✓ 标签就绪\n");

  // ============ 5. 创建示例作品 ============
  const adminUserId = adminUser.id;
  const member1Id = memberMap[users[0].id].id;
  const member2Id = memberMap[users[1].id].id;
  const member3Id = memberMap[users[4].id].id;

  const projects = [
    {
      slug: "starlight-drifter",
      title: "星光漂流者",
      subtitle: "一个太空探索 Roguelike 游戏",
      description:
        "《星光漂流者》是一款以太空探索为主题的 2D Roguelike 游戏。玩家驾驶一艘破旧的飞船在随机生成的星系中冒险，收集资源、升级装备、对抗外星生物。每局都有完全不同的星球和事件组合。",
      status: "PUBLISHED",
      type: "GAME_JAM",
      developYear: 2024,
      submitterId: adminUserId,
      submittedAt: new Date("2024-06-15"),
      steamUrl: "https://store.steampowered.com/app/123456/starlight_drifter",
      githubUrl: "https://github.com/bugu-studio/starlight-drifter",
      techStack: ["Unity", "C#", "FMOD"],
      isFeatured: true,
      tags: ["unity", "2d", "roguelike", "game-jam"],
    },
    {
      slug: "neon-runner",
      title: "霓虹跑者",
      subtitle: "赛博朋克风格无尽跑酷",
      description:
        "在霓虹闪烁的未来都市中狂奔！《霓虹跑者》是一款快节奏的赛博朋克风格无尽跑酷游戏。流畅的操作手感、绚丽的视觉特效、随音乐节奏变化的关卡，让你沉浸在这个迷幻的世界中。",
      status: "PUBLISHED",
      type: "INDIE",
      developYear: 2024,
      submitterId: adminUserId,
      submittedAt: new Date("2024-09-01"),
      itchUrl: "https://bugu-studio.itch.io/neon-runner",
      videoUrl: "https://www.youtube.com/watch?v=example",
      techStack: ["Unity", "C#"],
      isFeatured: true,
      tags: ["unity", "2d", "pixel-art"],
    },
    {
      slug: "ancient-maze",
      title: "古墓迷踪",
      subtitle: "受古墓丽影启发的 3D 解谜冒险",
      description:
        "探索被遗忘的古墓，破解机关谜题，揭开千年前的秘密。《古墓迷踪》致敬经典古墓丽影系列，融合了 3D 平台跳跃和解谜元素，通过 UE5 引擎打造了令人惊叹的地下世界。",
      status: "PUBLISHED",
      type: "GRADUATION",
      developYear: 2024,
      submitterId: adminUserId,
      submittedAt: new Date("2024-05-20"),
      steamUrl: "https://store.steampowered.com/app/789012/ancient_maze",
      techStack: ["Unreal Engine 5", "C++", "Blender"],
      isFeatured: true,
      tags: ["unreal", "3d", "puzzle", "graduation"],
    },
    {
      slug: "meow-wars",
      title: "喵星人大战",
      subtitle: "本地多人派对游戏",
      description:
        "四只猫咪为了占领客厅展开了滑稽的大乱斗！《喵星人大战》是一款最多支持 4 人本地联机的派对游戏，简单易上手但充满策略，适合朋友聚会时一起游玩。",
      status: "PUBLISHED",
      type: "GAME_JAM",
      developYear: 2023,
      submitterId: adminUserId,
      submittedAt: new Date("2023-12-01"),
      itchUrl: "https://bugu-studio.itch.io/meow-wars",
      techStack: ["Unity", "C#"],
      isFeatured: false,
      tags: ["unity", "2d", "multiplayer", "game-jam"],
    },
    {
      slug: "pixel-dungeon-remake",
      title: "像素地牢：重制版",
      subtitle: "经典 Roguelike 的像素重制",
      description:
        "这是一款致敬经典 Roguelike 游戏的像素风格地牢探索游戏。随机生成的地图、丰富的道具系统、多样的敌人类型，让你永远不知道下一层会有什么在等着你。",
      status: "PUBLISHED",
      type: "INDIE",
      developYear: 2023,
      submitterId: adminUserId,
      submittedAt: new Date("2023-08-10"),
      githubUrl: "https://github.com/bugu-studio/pixel-dungeon",
      techStack: ["Unity", "C#", "Aseprite"],
      isFeatured: false,
      tags: ["unity", "2d", "pixel-art", "roguelike"],
    },
  ];

  for (const p of projects) {
    const existing = await prisma.project.findUnique({ where: { slug: p.slug } });
    if (existing) {
      console.log("  ~ 作品已存在:", p.title);
      continue;
    }

    const { tags: tagSlugs, ...data } = p;
    const project = await prisma.project.create({
      data: {
        ...data,
        tags: {
          create: tagSlugs.map((slug) => ({
            tag: { connect: { slug } },
          })),
        },
      },
    });

    // 关联成员到作品
    if (p.slug === "starlight-drifter") {
      await prisma.projectMember.createMany({
        data: [
          { projectId: project.id, memberId: member1Id, role: "主程序员" },
          { projectId: project.id, memberId: member2Id, role: "美术" },
        ],
      });
    }
    if (p.slug === "neon-runner") {
      await prisma.projectMember.createMany({
        data: [
          { projectId: project.id, memberId: member2Id, role: "美术 & 策划" },
        ],
      });
    }
    if (p.slug === "ancient-maze") {
      await prisma.projectMember.createMany({
        data: [
          { projectId: project.id, memberId: member3Id, role: "主程序 & TA" },
        ],
      });
    }
    if (p.slug === "meow-wars") {
      await prisma.projectMember.createMany({
        data: [
          { projectId: project.id, memberId: member1Id, role: "程序" },
          { projectId: project.id, memberId: member2Id, role: "美术" },
        ],
      });
    }

    console.log("  + 作品:", p.title, `[${p.status}]`);
  }

  // ============ 6. 创建历史事件 ============
  const events = [
    { year: 2020, title: "布谷工作室成立", description: "一群热爱游戏开发的同好聚在一起，正式成立了布谷工作室。", sortOrder: 1 },
    { year: 2021, title: "首次参加 Global Game Jam", description: "48 小时内完成了第一款 Game Jam 作品《星际快递》，获得了校内最佳创意奖。", sortOrder: 2 },
    { year: 2022, title: "社团人数突破 50 人", description: "随着新学期的招新，社团规模首次突破 50 人，成为校内最活跃的技术社团之一。", sortOrder: 3 },
    { year: 2023, title: "首款 Steam 游戏上线", description: "《像素地牢》在 Steam 正式发布，上线首周获得 96% 好评率。", sortOrder: 4 },
    { year: 2024, title: "三款作品登陆 Steam Next Fest", description: "《星光漂流者》《古墓迷踪》《霓虹跑者》同时入选 Steam Next Fest 展示。", sortOrder: 5 },
  ];

  for (const e of events) {
    await prisma.yearEvent.upsert({
      where: { id: e.year.toString() + "-" + e.sortOrder },
      update: {},
      create: { ...e, id: e.year.toString() + "-" + e.sortOrder },
    });
  }
  console.log("✓ 历史事件就绪\n");

  // ============ 7. 站点设置 ============
  await prisma.siteSetting.upsert({
    where: { key: "site_name" },
    update: { value: "布谷工作室" },
    create: { key: "site_name", value: "布谷工作室" },
  });
  await prisma.siteSetting.upsert({
    where: { key: "site_description" },
    update: { value: "我们是一群热爱游戏开发的同学，一起创造有趣的游戏世界。" },
    create: { key: "site_description", value: "我们是一群热爱游戏开发的同学，一起创造有趣的游戏世界。" },
  });
  console.log("✓ 站点设置\n");

  console.log("========== 全部完成 ==========");
  console.log("\n测试账号:");
  console.log("  管理员: admin@bugu.local / admin123456");
  console.log("  成员-张三: zhang3@bugu.local / demo1234");
  console.log("  审核员-赵六: zhao6@bugu.local / demo1234");
  console.log("  普通用户-王五: wang5@bugu.local / demo1234");
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
