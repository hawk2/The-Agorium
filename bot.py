#!/usr/bin/env python3
"""
Agorium Bot — Posts debate content every 4 hours as Athena.
Always argues on the most recent debate post.
"""

import os
import random
import sys
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

try:
    from supabase import create_client, Client
except ImportError:
    print("Run: pip install supabase openai")
    sys.exit(1)

try:
    from openai import OpenAI as OpenAIClient
except ImportError:
    print("Run: pip install supabase openai")
    sys.exit(1)


# ── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://auboquhnqswseneeosyj.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
OPENAI_KEY   = os.environ.get("OPENAI_API_KEY", "")

MODEL = "gpt-5-mini-2025-08-07"
SIDES = ["for", "against"]

PERSONAS = [
    {
        "display_name": "Athena",
        "bio": "Stoic strategist. Logic-first, sharp, and precise.",
        "prompt_style": (
            "You are Athena — a disciplined, high-IQ debate tactician. "
            "You argue from logic, evidence, and clear causal reasoning. "
            "You stay composed, incisive, and direct. "
            "No fluff, no vague claims, no hedging. "
            "Be respectful but decisive. You mean every point."
        ),
    },
    {
        "display_name": "RighteousPaul",
        "bio": "Christian conservative. Faith, family, and freedom.",
        "prompt_style": (
            "You are RighteousPaul — a devout Christian conservative and debate-forum regular. "
            "You argue from Scripture, natural law, and the wisdom of the Founding Fathers. "
            "You genuinely believe in faith and tradition as civilizational anchors. "
            "Be earnest, a little fired up, and human — not a caricature. "
            "Occasionally quote the Bible or appeal to 'what the Founders intended'. "
            "You're respectful but firm. No hedging. You mean it."
        ),
    },
    {
        "display_name": "ProgressiveMaya",
        "bio": "Progressive policy wonk. Climate, equity, and public investment.",
        "prompt_style": (
            "You are ProgressiveMaya — a sharp progressive debater focused on data and policy outcomes. "
            "You argue for strong social programs, climate action, labor protections, and civil rights. "
            "You cite evidence, historical context, and practical policy tradeoffs. "
            "Be confident, clear, and persuasive without sounding robotic. "
            "You're respectful but direct. No hedging. You mean it."
        ),
    },
    {
        "display_name": "LibertyJake",
        "bio": "Civil libertarian. Skeptical of state power and censorship.",
        "prompt_style": (
            "You are LibertyJake — a civil libertarian and constitutional stickler. "
            "You prioritize free speech, due process, privacy rights, and limits on government power. "
            "You challenge paternalism and mission creep in institutions. "
            "Use plain language and principled reasoning. "
            "Be respectful but unflinching. No hedging. You mean it."
        ),
    },
    {
        "display_name": "PragmaticNora",
        "bio": "Centrist pragmatist. Outcomes over ideology.",
        "prompt_style": (
            "You are PragmaticNora — a practical centrist who values what actually works. "
            "You weigh costs, implementation details, and second-order effects. "
            "You dislike purity tests and ideological slogans. "
            "Argue with clarity, concrete examples, and policy realism. "
            "Be civil, firm, and candid. No hedging. You mean it."
        ),
    },
]

PERSONA = next((p for p in PERSONAS if p["display_name"] == "Athena"), PERSONAS[0])


# ── Supabase helpers ──────────────────────────────────────────────────────────

def get_client() -> Client:
    if not SUPABASE_KEY:
        raise ValueError("SUPABASE_KEY is not set.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def ensure_persona_user(sb: Client) -> None:
    name    = PERSONA["display_name"]
    name_lc = name.lower()
    try:
        res = sb.table("users").select("username_lc").eq("username_lc", name_lc).execute()
        if res.data:
            return
        sb.table("users").insert({
            "username_lc": name_lc,
            "username":    name,
            "bio":         PERSONA["bio"],
        }).execute()
        print(f"  Created user: {name}")
    except Exception as e:
        print(f"  Could not ensure user {name}: {e}")


def get_recent_posts(sb: Client, limit: int = 10) -> list[dict]:
    try:
        res = sb.table("posts").select("*").order("createdat", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as e:
        print(f"  Could not fetch posts: {e}")
        return []


def get_most_recent_debate(sb: Client) -> Optional[dict]:
    try:
        res = (
            sb.table("posts")
            .select("*")
            .eq("type", "debate")
            .order("createdat", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
        # Fallback for datasets that may not have a "type" field on older rows.
        fallback = sb.table("posts").select("*").order("createdat", desc=True).limit(1).execute()
        return (fallback.data or [None])[0]
    except Exception as e:
        print(f"  Could not fetch most recent debate: {e}")
        return None


# ── OpenAI helpers ────────────────────────────────────────────────────────────

def extract_text(msg) -> str:
    """Robustly extract text from an OpenAI response regardless of SDK version."""
    choice = msg.choices[0]
    content = choice.message.content

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text", ""))
            elif hasattr(block, "text"):
                parts.append(block.text or "")
            else:
                parts.append(str(block))
        return " ".join(p for p in parts if p).strip()

    # Fallback: try output_text (some SDK versions)
    if hasattr(choice.message, "output_text"):
        return (choice.message.output_text or "").strip()

    return ""


# ── Content generation ────────────────────────────────────────────────────────

def generate_argument(post: dict) -> str:
    client = OpenAIClient(api_key=OPENAI_KEY)
    title  = post.get("title", "")
    body   = post.get("body", "")

    msg = client.chat.completions.create(
        model=MODEL,
        max_completion_tokens=5000,
        messages=[
            {"role": "system", "content": PERSONA["prompt_style"]},
            {
                "role": "user",
                "content": (
                    f"You're arguing in this debate:\nTitle: {title}\n\n{body}\n\n"
                    "Write your argument. Be 2–4 paragraphs. Plain text only, no markdown, no headers. "
                    "Argue hard. Make a real point. Be true to your character."
                ),
            },
        ],
    )
    print(f"  [debug] finish_reason: {msg.choices[0].finish_reason}")
    print(f"  [debug] message type: {type(msg.choices[0].message.content)}")
    print(f"  [debug] message raw: {repr(msg.choices[0].message)}")
    result = extract_text(msg)
    print(f"  [debug] extracted length: {len(result)} chars")
    return result


def generate_new_post() -> tuple[str, str]:
    client = OpenAIClient(api_key=OPENAI_KEY)

    msg = client.chat.completions.create(
        model=MODEL,
        max_completion_tokens=5000,
        messages=[
            {"role": "system", "content": PERSONA["prompt_style"]},
            {
                "role": "user",
                "content": (
                    "Start a brand-new debate on a topic you genuinely care about. "
                    "Pick something political, ethical, or social — something real and contentious. "
                    "Output format: first line is the TITLE only (no label, no colon), "
                    "then a blank line, then 2–4 paragraphs of your argument. "
                    "Plain text only, no markdown, no bullet points. Be opinionated."
                ),
            },
        ],
    )
    raw = extract_text(msg)
    print(f"  [debug] new post length: {len(raw)} chars")
    print(f"  [debug] raw preview: {raw[:120]!r}")

    all_lines = raw.split("\n")
    title = ""
    body_lines = []
    title_found = False
    for line in all_lines:
        if not title_found:
            if line.strip():
                title = line.strip()
                title_found = True
        else:
            body_lines.append(line)
    body = "\n".join(body_lines).strip() or raw
    title = title or "A Debate Worth Having"
    return title, body


# ── Posting logic ─────────────────────────────────────────────────────────────

def post_argument(sb: Client, post: dict):
    body = generate_argument(post)
    if not body:
        print("❌ Empty argument body — skipping insert")
        return
    side = random.choice(SIDES)
    now  = datetime.now(timezone.utc).isoformat()
    try:
        sb.table("arguments").insert({
            "id":        str(uuid4()),
            "postid":    post["id"],
            "side":      side,
            "body":      body,
            "author":    PERSONA["display_name"],
            "createdat": now,
        }).execute()
        print(f"✅ {PERSONA['display_name']} argued ({side}) on: \"{post.get('title', post['id'])}\"")
    except Exception as e:
        print(f"❌ Failed to post argument: {e}")


def post_new_debate(sb: Client):
    title, body = generate_new_post()
    if not body:
        print("❌ Empty post body — skipping insert")
        return
    now = datetime.now(timezone.utc).isoformat()
    try:
        sb.table("posts").insert({
            "id":        str(uuid4()),
            "type":      "debate",
            "title":     title,
            "body":      body,
            "author":    PERSONA["display_name"],
            "createdat": now,
            "tags":      [],
        }).execute()
        print(f"✅ {PERSONA['display_name']} started new debate: \"{title}\"")
    except Exception as e:
        print(f"❌ Failed to create debate: {e}")


# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    print(f"\n🤖 Agorium Bot — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

    if not OPENAI_KEY:
        print("❌ OPENAI_API_KEY not set.")
        sys.exit(1)

    sb = get_client()

    print(f"\n🎭 Persona: {PERSONA['display_name']}")
    ensure_persona_user(sb)

    target = get_most_recent_debate(sb)
    if not target:
        print("❌ No debates found to argue.")
        return

    print(f"   Action: argue on latest debate \"{target.get('title', target.get('id'))}\"")
    post_argument(sb, target)

    print("\n✅ Done.\n")


if __name__ == "__main__":
    run()
