import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js";

const MODEL = "gpt-5-mini-2025-08-07";
const SIDES = ["for", "against"] as const;

// ── Personas ─────────────────────────────────────────────────────────────────

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

// ── User helper ───────────────────────────────────────────────────────────────

async function ensurePersonaUser(
  sb: ReturnType<typeof createClient>,
  persona: (typeof PERSONAS)[PersonaKey],
): Promise<void> {
  const nameLc = persona.display_name.toLowerCase();
  const { data } = await sb.from("users").select("username_lc").eq("username_lc", nameLc).maybeSingle();
  if (data) return;
  const { error } = await sb.from("users").insert({
    username_lc: nameLc,
    username: persona.display_name,
    bio: persona.bio,
  });
  if (error) console.warn(`  Could not create user ${persona.display_name}: ${error.message}`);
  else console.log(`  Created user: ${persona.display_name}`);
}

// ── Content generation ────────────────────────────────────────────────────────

async function generateArgument(
  ai: OpenAI,
  persona: (typeof PERSONAS)[PersonaKey],
  post: Record<string, unknown>,
): Promise<string> {
  const title = post.title ?? "";
  const body  = post.body ?? "";
  const msg = await ai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 700,
    messages: [
      { role: "system", content: persona.prompt_style },
      {
        role: "user",
        content:
          `You're arguing in this debate:\nTitle: ${title}\n\n${body}\n\n` +
          `Write your argument. Be 2–4 paragraphs. No markdown. No headers. ` +
          `Argue hard. Make a real point. Be true to your character.`,
      },
    ],
  });
  return msg.choices[0].message.content!.trim();
}

async function generateNewPost(
  ai: OpenAI,
  persona: (typeof PERSONAS)[PersonaKey],
): Promise<{ title: string; body: string }> {
  const msg = await ai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 700,
    messages: [
      { role: "system", content: persona.prompt_style },
      {
        role: "user",
        content:
          `Start a brand-new debate on a topic you genuinely care about. ` +
          `Pick something political, ethical, or social — something real and contentious. ` +
          `Format: first line is the TITLE only (no label), blank line, then 2–4 paragraphs. ` +
          `No markdown. Be opinionated. Don't be bland.`,
      },
    ],
  });
  const raw = msg.choices[0].message.content!.trim();
  const allLines = raw.split("\n");
  let title = "";
  const bodyLines: string[] = [];
  let titleFound = false;
  for (const line of allLines) {
    if (!titleFound) { if (line.trim()) { title = line.trim(); titleFound = true; } }
    else bodyLines.push(line);
  }
  const bodyText = bodyLines.join("\n").trim() || raw;
  return { title: title || "A Debate Worth Having", body: bodyText };
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  try {
    console.log(`\n🤖 Agorium Bot — ${new Date().toUTCString()}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey   = Deno.env.get("OPENAI_API_KEY")!;

    const sb = createClient(supabaseUrl, supabaseKey);
    const ai = new OpenAI({ apiKey: openaiKey });

    // Pick persona
    const keys = Object.keys(PERSONAS) as PersonaKey[];
    const persona = PERSONAS[keys[Math.floor(Math.random() * keys.length)]];
    console.log(`\n🎭 Persona: ${persona.display_name}`);

    // Ensure user exists
    await ensurePersonaUser(sb, persona);

    // Fetch recent posts
    const { data: posts } = await sb
      .from("posts")
      .select("*")
      .order("createdat", { ascending: false })
      .limit(10);

    const now = new Date().toISOString();

    if (posts?.length && Math.random() < 0.7) {
      // 70%: argue in an existing debate
      const target = posts.slice(0, 5)[Math.floor(Math.random() * Math.min(5, posts.length))];
      console.log(`   Action: argue on "${target.title ?? target.id}"`);

      const body = await generateArgument(ai, persona, target);
      const side = SIDES[Math.floor(Math.random() * SIDES.length)];

      const { error } = await sb.from("arguments").insert({
        id:        crypto.randomUUID(),
        postid:    target.id,
        side,
        body,
        author:    persona.display_name,
        createdat: now,
      });

      if (error) console.error(`❌ Failed to post argument: ${error.message}`);
      else console.log(`✅ ${persona.display_name} argued (${side}) on: "${target.title ?? target.id}"`);
    } else {
      // 30%: start a new debate
      console.log("   Action: new debate");
      const { title, body } = await generateNewPost(ai, persona);

      const { error } = await sb.from("posts").insert({
        id:        crypto.randomUUID(),
        type:      "debate",
        title,
        body,
        author:    persona.display_name,
        createdat: now,
        tags:      [],
      });

      if (error) console.error(`❌ Failed to create debate: ${error.message}`);
      else console.log(`✅ ${persona.display_name} started: "${title}"`);
    }

    return new Response("✅ Done", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(`Error: ${err}`, { status: 500 });
  }
});
