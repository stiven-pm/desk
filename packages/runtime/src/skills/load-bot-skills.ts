export type BotSkillRow = {
  slug: string;
  title: string;
  description: string;
  body_md: string;
  status: "draft" | "published" | "archived";
};

export type SkillsPromptMode = "full" | "summary";

const SKILLS_SYSTEM_CHAR_LIMIT = 2000;

export async function loadBotSkills(
  db: D1Database,
  botId: string,
  mode: "published" | "draft_and_published",
  limit = 24,
): Promise<BotSkillRow[]> {
  const statusClause =
    mode === "published"
      ? `status = 'published'`
      : `status IN ('draft', 'published')`;
  const rows = await db
    .prepare(
      `SELECT slug, title, description, body_md, status
       FROM bot_skills
       WHERE bot_id = ? AND ${statusClause}
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .bind(botId, limit)
    .all<BotSkillRow>();
  return rows.results ?? [];
}

export function formatSkillsForPrompt(
  skills: BotSkillRow[],
  promptMode: SkillsPromptMode = "full",
): string {
  if (!skills.length) return "";
  const blocks = skills.map((s) => {
    const head = `### Skill: ${s.title} (\`${s.slug}\`)${s.status === "draft" ? " [borrador]" : ""}`;
    if (promptMode === "summary") {
      const desc = s.description.trim() || "(sin descripción)";
      return `${head}\n${desc}`;
    }
    const desc = s.description.trim()
      ? `${s.description.trim()}\n\n`
      : "";
    return `${head}\n${desc}${s.body_md.trim()}`;
  });
  let body = `## Procedimientos (skills)\nSigue estos métodos cuando encajen con la petición del usuario.\n\n${blocks.join("\n\n---\n\n")}`;
  if (body.length > SKILLS_SYSTEM_CHAR_LIMIT) {
    body = `${body.slice(0, SKILLS_SYSTEM_CHAR_LIMIT)}\n\n… (recortado; usa desk_skill_read en configuración para el texto completo)`;
  }
  return body;
}
