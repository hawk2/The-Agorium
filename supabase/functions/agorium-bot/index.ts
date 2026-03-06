import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js";

const PERSONAS = {
  RighteousPaul: {
    display_name: "RighteousPaul",
    bio: "Christian conservative. Faith, family, and freedom.",
    prompt_style:
      "You are RighteousPaul — a devout Christian conservative and debate-forum regular. " +
      "You argue from Scripture, natural law, and the wisdom of the Founding Fathers. " +
      "You genuinely believe in faith and tradition as civilizational anchors. " +
      "Be earnest, a little fired up, and human — not a caricature. " +
      "Occasionally quote the Bible or appeal to 'what the Founders intended'. " +
      "You're respectful but firm. No hedging. You mean it.",
  },
  AtheaReason: {
    display_name: "AtheaReason",
    bio: "Secular humanist. Evidence over ideology.",
    prompt_style:
      "You are AtheaReason — a progressive secular humanist who lives for a good debate. " +
      "You cite empirical studies, philosophers (Rawls, Mill, Singer, hooks), and social science. " +
      "You find religious-based arguments frustrating and say so diplomatically. " +
      "You're sharp, a little self-righteous, but you always bring receipts. " +
      "Use phrases like 'the data actually shows', 'that's a category error', 'empirically speaking'. " +
      "Push for systemic solutions. Call out logical fallacies by name.",
  },
  VibezOfChaos: {
    display_name: "VibezOfChaos",
    bio: "Philosopher-gremlin. Questions everything including this bio.",
    prompt_style:
      "You are VibezOfChaos — an unclassifiable internet philosopher who refuses to be put in a box. " +
      "You're equal parts Zizek, Baudrillard, and extremely online. " +
      "You question the premise of every debate. You find the paradox. " +
      "Your takes are chaotic but they land — there's always a real point buried in the chaos. " +
      "Mix dense philosophical references with meme-aware language. " +
      "Be genuinely surprising. The goal is to reframe the debate entirely, not just argue a side.",
  },
} as const;

type PersonaKey = keyof typeof PERSONAS;

async function discoverTables(sb: ReturnType<typeof createClient>): Promise<string[]> {
  const candidates = ["posts", "threads", "debates", "topics", "forum_posts", "replies", "comments", "responses", "profiles", "users"];
  const found: string[] = [];
  for (const t of candidates) {
    try {
      const { error } = await sb.from(t).select("id").limit(1);
      if (!error) { found.push(t); console.log(`  ✓ ${t}`); }
    } catch (_) {}
  }
  return found;
}

function pickTable(tables: string[], options: string[]): string | null {
  return options.find((t) => tables.includes(t)) ?? null;
}

async function getOrCreateProfile(sb: ReturnType<typeof createClient>, profileTable: string, persona: (typeof PERSONAS)[PersonaKey]): Promise<string | null> {
  const { data } = await sb.from(profileTable).select("id").eq("username", persona.display_name).maybeSingle();
  if (data?.id) return data.id;
  const { data: created } = await sb.from(profileTable).insert({ username: persona.display_name, bio: persona.bio }).select("id").maybeSingle();
  return created?.id ?? null;
}

async function generateReply(ai: OpenAI, persona: (typeof PERSONAS)[PersonaKey], post: Record<string, unknown>): Promise<string> {
  const title = post.title ?? "";
  const body = post.content ?? post.body ?? post.text ?? "";
  const msg = await ai.chat.completions.create({
    model: "gpt-4o", max_tokens: 700,
    messages: [
      { role: "system", content: persona.prompt_style },
      { role: "user", content: `The debate you're replying to:\nTitle: ${title}\n\n${body}\n\nWrite your reply. Be 2–4 paragraphs. No markdown. Argue hard. Make a real point. Be true to your character.` },
    ],
  });
  return msg.choices[0].message.content!.trim();
}

async function generateNewPost(ai: OpenAI, persona: (typeof PERSONAS)[PersonaKey]): Promise<{ title: string; body: string }> {
  const msg = await ai.chat.completions.create({
    model: "gpt-4o", max_tokens: 700,
    messages: [
      { role: "system", content: persona.prompt_style },
      { role: "user", content: `Start a brand-new debate on a topic you genuinely care about. Pick something political, ethical, or social — real and contentious. Format: first line is the TITLE only, blank line, then 2–4 paragraphs. No markdown. Be opinionated.` },
    ],
  });
  const raw = msg.choices[0].message.content!.trim();
  const [titleLine, ...rest] = raw.split("\n");
  return { title: titleLine.trim(), body: rest.join("\n").trim() };
}

async function tryInsert(sb: ReturnType<typeof createClient>, table: string, data: Record<string, unknown>): Promise<boolean> {
  const { error } = await sb.from(table).insert(data);
  if (error) { console.warn(`  Insert failed on ${table}: ${error.message}`); return false; }
  return true;
}

Deno.serve(async (_req) => {
  try {
    console.log(`\n🤖 Agorium Bot — ${new Date().toUTCString()}`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey   = Deno.env.get("OPENAI_API_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const ai = new OpenAI({ apiKey: openaiKey });

    console.log("\nDiscovering tables...");
    const tables = await discoverTables(sb);
    if (!tables.length) return new Response("No tables found", { status: 500 });

    const postTable    = pickTable(tables, ["posts", "threads", "debates", "topics", "forum_posts"]);
    const replyTable   = pickTable(tables, ["replies", "comments", "responses"]);
    const profileTable = pickTable(tables, ["profiles", "users"]);
    if (!postTable) return new Response(`No post table. Found: ${tables.join(", ")}`, { status: 500 });

    console.log(`\npost=${postTable} reply=${replyTable} profile=${profileTable}`);

    const keys = Object.keys(PERSONAS) as PersonaKey[];
    const personaKey = keys[Math.floor(Math.random() * keys.length)];
    const persona = PERSONAS[personaKey];
    console.log(`\n🎭 Persona: ${persona.display_name}`);

    let userId: string | null = null;
    if (profileTable) {
      userId = await getOrCreateProfile(sb, profileTable, persona);
      console.log(`   User ID: ${userId ?? "not found"}`);
    }

    const { data: posts } = await sb.from(postTable).select("*").order("created_at", { ascending: false }).limit(10);
    const now = new Date().toISOString();
    const base: Record<string, unknown> = { created_at: now };
    if (userId) base.user_id = userId;

    const fkKeys = [`${postTable.replace(/s$/, "")}_id`, "post_id", "thread_id", "parent_id", "topic_id"];

    if (posts?.length && Math.random() < 0.7) {
      const target = posts.slice(0, 5)[Math.floor(Math.random() * Math.min(5, posts.length))];
      console.log(`   Action: reply to "${target.title ?? target.id}"`);
      const content = await generateReply(ai, persona, target);
      let posted = false;
      if (replyTable) {
        for (const fk of fkKeys) {
          if (await tryInsert(sb, replyTable, { ...base, content, [fk]: target.id })) {
            console.log(`✅ Replied to: "${target.title ?? target.id}"`); posted = true; break;
          }
        }
      }
      if (!posted) {
        for (const fk of fkKeys) {
          if (await tryInsert(sb, postTable, { ...base, content, title: `Re: ${target.title ?? ""}`, [fk]: target.id })) {
            console.log(`✅ Replied (as post) to: "${target.title ?? target.id}"`); break;
          }
        }
      }
    } else {
      console.log("   Action: new debate");
      const { title, body } = await generateNewPost(ai, persona);
      for (const attempt of [{ ...base, content: body, title }, { ...base, content: body }, { ...base, body, title }]) {
        if (await tryInsert(sb, postTable, attempt)) { console.log(`✅ Started: "${title}"`); break; }
      }
    }

    return new Response("✅ Done", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(`Error: ${err}`, { status: 500 });
  }
});
