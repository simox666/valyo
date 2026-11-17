// Répétition générale PRODUCTION (next start + pilote pg). Hors npm test.
// Contre un PostgreSQL de TEST uniquement (jamais la base des membres) : crée des comptes et sessions de test.
// Ex. local : npx pglite-server --db=memory:// --port=55432 (paquet @electric-sql/pglite-socket, hors dépendances),
// puis next build && NODE_ENV=production DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres APP_URL=http://localhost:3100 PORT=3100 npx next start,
// puis : node tests/acceptance/repetition-production.cjs
// Répétition générale PRODUCTION : `next start` + pilote `pg` réel (protocole PostgreSQL).
// Sessions de test créées directement en base (pas d'e-mail en répétition).
const { Client } = require("pg");
const { createHash, randomBytes } = require("node:crypto");
const BASE = "http://localhost:3100";
const results = [];
const check = (label, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`); };

(async () => {
  const pg = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:55432/postgres" });
  await pg.connect();
  async function member(handle, role = "member") {
    const { rows: [u] } = await pg.query(
      `INSERT INTO users (email, handle, display_name, role, rules_accepted_at) VALUES ($1, $2, $3, $4, now()) RETURNING id`,
      [`${handle}@example.test`, handle, handle, role],
    );
    const token = randomBytes(32).toString("base64url");
    await pg.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')`, [createHash("sha256").update(token).digest("hex"), u.id]);
    const cookie = `valyo_session=${token}`;
    const req = async (method, path, body) => {
      const r = await fetch(BASE + path, { method, headers: { Origin: BASE, Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      let data = null; try { data = await r.json(); } catch {}
      return { status: r.status, data };
    };
    return { id: u.id, cookie, req };
  }
  const run = Date.now().toString(36);
  const ana = await member(`ana_${run}`);
  const bob = await member(`bob_${run}`);
  const { rows: [theme] } = await pg.query(`SELECT id FROM themes WHERE slug = 'espace'`);

  const post = await ana.req("POST", "/api/posts", { kind: "question", title: `Question production ${run}`, body: "Contexte.", themeIds: [theme.id] });
  check("publication", post.status === 201, `HTTP ${post.status}`);
  const comment = await bob.req("POST", `/api/posts/${post.data.id}/comments`, { body: "Une réponse." });
  check("commentaire + notification", comment.status === 201 && (await ana.req("GET", "/api/notifications")).data.unread >= 1);
  const reaction = await bob.req("POST", `/api/posts/${post.data.id}/reactions`, { kind: "appris", on: true });
  check("réaction", reaction.status === 200 && reaction.data.counts.appris === 1);

  const room = await ana.req("POST", "/api/rooms", { name: `Salon prod ${run}`, description: "", themeId: theme.id, visibility: "public", format: "chat", postId: post.data.id });
  check("salon créé depuis la publication", room.status === 201, `HTTP ${room.status}`);
  check("adhésion", (await bob.req("POST", `/api/rooms/${room.data.roomId}/join`)).status === 200);

  // Flux SSE en production : Bob écoute, Ana écrit.
  const controller = new AbortController();
  const streamRes = await fetch(`${BASE}/api/rooms/${room.data.roomId}/stream`, { headers: { Cookie: bob.cookie }, signal: controller.signal });
  const reader = streamRes.body.getReader();
  let buffer = "";
  const reading = (async () => {
    const until = Date.now() + 12000;
    while (Date.now() < until && !buffer.includes("Bonjour depuis la production")) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += new TextDecoder().decode(value);
    }
  })();
  await new Promise((r) => setTimeout(r, 800));
  const sentAt = Date.now();
  const msg = await ana.req("POST", `/api/rooms/${room.data.roomId}/messages`, { clientId: "prod-1", body: "Bonjour depuis la production" });
  await reading.catch(() => {});
  controller.abort();
  check("chat : message reçu en direct (SSE) par l'autre membre", msg.status === 201 && buffer.includes("Bonjour depuis la production"), `${Date.now() - sentAt} ms`);
  check("flux non mis en tampon (en-têtes SSE)", streamRes.headers.get("content-type").includes("text/event-stream"));

  const inv = await ana.req("POST", "/api/platform-invitations", { note: "Test" });
  check("invitation créée", inv.status === 201 && inv.data.path.startsWith("/rejoindre/"));
  const join = await fetch(BASE + inv.data.path);
  check("page d'invitation rendue", join.status === 200 && (await join.text()).includes("vous invite sur Valyo"));
  const avis = await bob.req("POST", "/api/avis", { kind: "idee", body: "Très bien en production.", page: "/" });
  check("avis enregistré", avis.status === 201);

  const pages = await Promise.all(["/", `/p/${post.data.id}`, `/s/${room.data.roomId}`, "/bienvenue/premiers-pas", "/notifications", `/m/ana_${run}`].map(async (p) => {
    const r = await fetch(BASE + p, { headers: { Cookie: bob.cookie } });
    return [p, r.status];
  }));
  check("pages connectées en production", pages.every(([, s]) => s === 200), pages.map(([p, s]) => `${p.split("/").slice(0, 2).join("/")}:${s}`).join(" "));

  await pg.end();
  console.log(`\n${results.filter(Boolean).length}/${results.length} contrôles réussis (production + pg).`);
})().catch((e) => { console.error(e); process.exit(1); });
