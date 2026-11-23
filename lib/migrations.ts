// Migrations appliquées dans l'ordre, une seule fois chacune (table schema_migrations).
// Ne jamais modifier une migration déjà publiée : en ajouter une nouvelle.

export interface Migration {
  id: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    id: "001_socle_communautaire",
    statements: [
      `CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        handle TEXT,
        display_name TEXT,
        bio TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'agent')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
        rules_accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )`,
      `CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE email IS NOT NULL`,
      `CREATE UNIQUE INDEX users_handle_unique ON users (lower(handle)) WHERE handle IS NOT NULL`,

      `CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE INDEX sessions_user ON sessions (user_id)`,

      `CREATE TABLE login_tokens (
        token_hash TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        next_path TEXT NOT NULL DEFAULT '/',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
      )`,
      `CREATE INDEX login_tokens_email ON login_tokens (lower(email), created_at)`,

      `CREATE TABLE themes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT true,
        position INT NOT NULL DEFAULT 0
      )`,
      `INSERT INTO themes (slug, name, description, position) VALUES
        ('ia', 'Intelligence artificielle', 'Modèles, outils, recherche et usages de l''IA.', 1),
        ('robotique', 'Robotique', 'Robots, automatisation et systèmes autonomes.', 2),
        ('espace', 'Espace', 'Exploration spatiale, astronomie et industrie spatiale.', 3)`,

      `CREATE TABLE theme_follows (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, theme_id)
      )`,

      `CREATE TABLE member_follows (
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (follower_id, followee_id),
        CHECK (follower_id <> followee_id)
      )`,

      `CREATE TABLE posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK (kind IN ('news', 'question', 'experience')),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        demo_url TEXT,
        status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending', 'removed', 'deleted')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        edited_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      )`,
      `CREATE INDEX posts_recent ON posts (status, created_at DESC, id DESC)`,
      `CREATE INDEX posts_author ON posts (author_id, created_at DESC)`,

      `CREATE TABLE post_sources (
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        position INT NOT NULL,
        url TEXT NOT NULL,
        normalized_url TEXT NOT NULL,
        PRIMARY KEY (post_id, position)
      )`,
      `CREATE INDEX post_sources_normalized ON post_sources (normalized_url)`,

      `CREATE TABLE post_themes (
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        theme_id UUID NOT NULL REFERENCES themes(id),
        PRIMARY KEY (post_id, theme_id)
      )`,
      `CREATE INDEX post_themes_theme ON post_themes (theme_id)`,

      `CREATE TABLE comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        parent_id UUID REFERENCES comments(id),
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'removed', 'deleted')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        edited_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      )`,
      `CREATE INDEX comments_post ON comments (post_id, created_at)`,

      // Compte éditorial : les publications automatisées lui seront attribuées (étape 2).
      `INSERT INTO users (handle, display_name, bio, role, rules_accepted_at)
        VALUES ('agent-editorial', 'Agent éditorial', 'Veille automatisée : résumés sourcés des nouvelles en IA, technologie et sciences.', 'agent', now())`,
    ],
  },
  {
    // Un jour actif par membre (aucun contenu, aucune page consultée) : sert à mesurer le retour des membres.
    id: "002_activite_quotidienne",
    statements: [
      `CREATE TABLE user_activity_days (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day DATE NOT NULL,
        PRIMARY KEY (user_id, day)
      )`,
      `CREATE INDEX comments_parent ON comments (parent_id) WHERE parent_id IS NOT NULL`,
    ],
  },
  {
    // Agent éditorial, lot 2A (docs/contrat-agent-editorial.md §3). Tout est désactivé par défaut.
    id: "003_agent_editorial",
    statements: [
      // Configuration unique (id = 1). Pause et mode brouillon par défaut, aucun fournisseur.
      `CREATE TABLE editorial_config (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        version INT NOT NULL DEFAULT 1,
        paused BOOLEAN NOT NULL DEFAULT true,
        mode TEXT NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'public')),
        provider TEXT NOT NULL DEFAULT 'none' CHECK (provider IN ('none', 'test', 'claude')),
        model TEXT,
        prices JSONB,
        currency TEXT,
        budget_cap_micros BIGINT CHECK (budget_cap_micros IS NULL OR budget_cap_micros >= 0),
        timezone TEXT,
        policy JSONB,
        acceptance JSONB NOT NULL DEFAULT '{}'::jsonb,
        estimation_blocked BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by UUID REFERENCES users(id)
      )`,
      `INSERT INTO editorial_config (id) VALUES (1)`,

      `CREATE TABLE editorial_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        feed_url TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL CHECK (source_type IN ('primary', 'scientific', 'press')),
        priority SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 3),
        theme_ids UUID[] NOT NULL DEFAULT '{}',
        fetch_articles BOOLEAN NOT NULL DEFAULT true,
        active BOOLEAN NOT NULL DEFAULT false,
        authorization_checked_at TIMESTAMPTZ,
        authorization_reference TEXT,
        last_collected_at TIMESTAMPTZ,
        last_error TEXT,
        last_error_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (NOT active OR (authorization_checked_at IS NOT NULL AND authorization_reference IS NOT NULL))
      )`,

      `CREATE TABLE editorial_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        primary_document_id UUID,
        recap_id UUID,
        theme_ids UUID[] NOT NULL DEFAULT '{}',
        scientific_status TEXT CHECK (scientific_status IN ('announcement', 'preprint', 'published', 'unknown')),
        status TEXT NOT NULL DEFAULT 'candidate'
          CHECK (status IN ('candidate', 'drafting', 'ready', 'review_required', 'duplicate', 'ignored', 'rejected')),
        block_reason TEXT,
        duplicate_post_id UUID REFERENCES posts(id),
        triage_score NUMERIC,
        draft JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE editorial_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES editorial_sources(id),
        version INT NOT NULL DEFAULT 1,
        is_current BOOLEAN NOT NULL DEFAULT true,
        url TEXT NOT NULL,
        normalized_url TEXT NOT NULL,
        final_url TEXT,
        canonical_url TEXT,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        published_at TIMESTAMPTZ,
        discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        content_hash TEXT NOT NULL,
        extracted_text TEXT,
        status TEXT NOT NULL DEFAULT 'collected' CHECK (status IN ('collected', 'extracted', 'grouped', 'stale', 'error')),
        error_code TEXT,
        subject_id UUID REFERENCES editorial_subjects(id),
        UNIQUE (source_id, normalized_url, version)
      )`,
      `CREATE UNIQUE INDEX editorial_documents_current ON editorial_documents (source_id, normalized_url) WHERE is_current`,
      `CREATE INDEX editorial_documents_status ON editorial_documents (status)`,

      `CREATE TABLE editorial_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT NOT NULL,
        external_id TEXT UNIQUE,
        state TEXT NOT NULL CHECK (state IN ('submitting', 'submitted', 'ended', 'uncertain', 'failed', 'canceled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        submitted_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        usage JSONB,
        reconciled_at TIMESTAMPTZ,
        error JSONB
      )`,

      `CREATE TABLE editorial_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        state TEXT NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'running', 'waiting_provider', 'done', 'review_required', 'cancelled', 'uncertain')),
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 5,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        lease_owner TEXT,
        lease_expires_at TIMESTAMPTZ,
        batch_id UUID REFERENCES editorial_batches(id),
        result JSONB,
        error JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX editorial_tasks_ready ON editorial_tasks (state, next_attempt_at)`,
      `CREATE INDEX editorial_tasks_batch ON editorial_tasks (batch_id)`,

      // Montants en micro-unités entières (calcul exact) ; période = mois UTC de la réservation.
      `CREATE TABLE editorial_spend (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID NOT NULL UNIQUE REFERENCES editorial_batches(id),
        period TEXT NOT NULL,
        currency TEXT NOT NULL,
        reserved_micros BIGINT NOT NULL CHECK (reserved_micros >= 0),
        actual_micros BIGINT CHECK (actual_micros IS NULL OR actual_micros >= 0),
        state TEXT NOT NULL CHECK (state IN ('reserved', 'settled', 'uncertain', 'released')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        settled_at TIMESTAMPTZ
      )`,
      `CREATE INDEX editorial_spend_period ON editorial_spend (period, state)`,

      `CREATE TABLE editorial_recaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slot_key TEXT NOT NULL UNIQUE,
        slot_at TIMESTAMPTZ NOT NULL,
        version INT NOT NULL DEFAULT 1,
        state TEXT NOT NULL CHECK (state IN ('planned', 'draft', 'ready', 'review_required', 'published', 'withdrawn', 'missed', 'empty')),
        post_id UUID UNIQUE REFERENCES posts(id),
        freshness_dropped INT NOT NULL DEFAULT 0,
        notes JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE editorial_recap_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recap_id UUID NOT NULL REFERENCES editorial_recaps(id),
        subject_id UUID NOT NULL REFERENCES editorial_subjects(id),
        position INT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        scientific_status TEXT NOT NULL,
        sources JSONB NOT NULL,
        claims JSONB NOT NULL,
        UNIQUE (recap_id, subject_id),
        UNIQUE (recap_id, position)
      )`,

      `CREATE TABLE editorial_developments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recap_item_id UUID NOT NULL REFERENCES editorial_recap_items(id),
        subject_id UUID NOT NULL REFERENCES editorial_subjects(id),
        task_id UUID REFERENCES editorial_tasks(id),
        state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'ready', 'review_required', 'published', 'withdrawn')),
        post_id UUID UNIQUE REFERENCES posts(id),
        content JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE UNIQUE INDEX editorial_developments_active ON editorial_developments (subject_id) WHERE state <> 'withdrawn'`,

      // Demandes de développement : pas de contrainte d'unicité tant que la politique D8 n'est pas validée.
      `CREATE TABLE editorial_dev_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL REFERENCES users(id),
        subject_id UUID NOT NULL REFERENCES editorial_subjects(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE editorial_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        before JSONB,
        after JSONB,
        reason TEXT NOT NULL,
        actor_id UUID REFERENCES users(id),
        actor_label TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX editorial_revisions_entity ON editorial_revisions (entity, entity_id, created_at)`,

      // Lots du fournisseur de test déterministe uniquement (aucun usage avec un vrai fournisseur).
      `CREATE TABLE editorial_test_batches (
        external_id TEXT PRIMARY KEY,
        internal_id UUID NOT NULL UNIQUE,
        requests JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    // Corrections de la revue du lot 2A (docs/revue-lot-2a.md).
    id: "004_editorial_bail_et_tarifs",
    statements: [
      // B004 : jeton unique par réclamation, vérifié dans la transaction qui applique les écritures métier.
      `ALTER TABLE editorial_tasks ADD COLUMN lease_token UUID`,
      // B002 : instantané du modèle, des tarifs et de la devise au moment de la soumission du lot.
      `ALTER TABLE editorial_batches ADD COLUMN model TEXT`,
      `ALTER TABLE editorial_batches ADD COLUMN prices JSONB`,
      `ALTER TABLE editorial_batches ADD COLUMN currency TEXT`,
      `ALTER TABLE editorial_batches ADD COLUMN reconcile_attempts INT NOT NULL DEFAULT 0`,
      `ALTER TABLE editorial_batches ADD COLUMN reconcile_error TEXT`,
      `CREATE INDEX editorial_batches_unreconciled ON editorial_batches (state) WHERE reconciled_at IS NULL`,
    ],
  },
  {
    // Revue du lot 2B : identifiants attendus par lot (C201) et estimation conservée à côté de la borne réservée (C202).
    id: "005_editorial_lot_attendu",
    statements: [
      `ALTER TABLE editorial_batches ADD COLUMN task_ids UUID[] NOT NULL DEFAULT '{}'`,
      `ALTER TABLE editorial_batches ADD COLUMN estimate_micros BIGINT`,
    ],
  },
  {
    // Essai borné (protocole-premier-essai-claude.md, C008) : état persistant de l'essai,
    // sur une base DÉDIÉE uniquement. Une seule ligne ; la reprise relit cet état et ne
    // soumet jamais deux fois. La table existe partout mais reste vide hors base d'essai.
    id: "006_essai_borne",
    statements: [
      `CREATE TABLE editorial_trial (
        id INT PRIMARY KEY CHECK (id = 1),
        recap_id UUID NOT NULL REFERENCES editorial_recaps(id),
        max_batches INT NOT NULL,
        stopped_reason TEXT,
        finished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    // Regroupement règle 3 (decisions.md §3.3, lot d'accélération A6) : fusion non
    // destructrice (statut `merged` + lien vers le sujet absorbant) et preuves de la
    // comparaison conservées. Le doute reste `doublon_incertain`, jamais une fusion.
    id: "007_regroupement_regle_3",
    statements: [
      `ALTER TABLE editorial_subjects DROP CONSTRAINT editorial_subjects_status_check`,
      `ALTER TABLE editorial_subjects ADD CONSTRAINT editorial_subjects_status_check
        CHECK (status IN ('candidate', 'drafting', 'ready', 'review_required', 'duplicate', 'ignored', 'rejected', 'merged'))`,
      `ALTER TABLE editorial_subjects ADD COLUMN merged_into_subject_id UUID REFERENCES editorial_subjects(id)`,
      `ALTER TABLE editorial_subjects ADD COLUMN grouping JSONB`,
    ],
  },
  {
    // Révision éditoriale administrative (lot d'accélération A7) : correction humaine
    // d'un élément de récapitulatif, avec motif ; la vérification de fidélité est
    // invalidée dès que le texte change (claims remis à NULL, trace conservée).
    id: "008_revision_editoriale",
    statements: [
      `ALTER TABLE editorial_recap_items ADD COLUMN human_revision JSONB`,
      // La vérification invalidée se matérialise par claims NULL : la contrainte est levée.
      `ALTER TABLE editorial_recap_items ALTER COLUMN claims DROP NOT NULL`,
    ],
  },
  {
    // Développement lié (lot d'accélération A10) : demandeur tracé, état « origine
    // indisponible » distinct du cycle de vie, correction humaine et horodatage.
    id: "009_developpement_lie",
    statements: [
      `ALTER TABLE editorial_developments ADD COLUMN requested_by UUID REFERENCES users(id)`,
      `ALTER TABLE editorial_developments ADD COLUMN origin_unavailable BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE editorial_developments ADD COLUMN human_revision JSONB`,
      `ALTER TABLE editorial_developments ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
    ],
  },
  {
    // Salons et droits (lot d'accélération B, tâches 11 à 20 ; spec F10-F12, decisions D5/D6).
    // - adhésions : une seule par membre et par salon (clé primaire) ;
    // - messages : un seul par (salon, auteur, identifiant client) — une relance ne duplique pas ;
    // - invitations : jeton stocké HACHÉ uniquement, à usage unique, révocable, expirant ;
    // - transferts : un seul transfert ouvert par salon ;
    // - repère de lecture : last_read_seq, monotone (imposé par le code) ;
    // - `seq` des messages : identité monotone, support de la reprise du flux (lot C).
    id: "010_salons",
    statements: [
      `CREATE TABLE rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
        description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
        theme_id UUID REFERENCES themes(id),
        owner_id UUID NOT NULL REFERENCES users(id),
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
        format TEXT NOT NULL DEFAULT 'chat' CHECK (format IN ('chat', 'chat_vocal')),
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX rooms_directory ON rooms (visibility, archived_at, created_at DESC)`,

      `CREATE TABLE room_posts (
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (room_id, post_id)
      )`,
      `CREATE INDEX room_posts_post ON room_posts (post_id)`,

      `CREATE TABLE room_members (
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
        following BOOLEAN NOT NULL DEFAULT false,
        last_read_seq BIGINT NOT NULL DEFAULT 0,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (room_id, user_id)
      )`,
      `CREATE INDEX room_members_user ON room_members (user_id)`,

      `CREATE TABLE room_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        used_at TIMESTAMPTZ,
        used_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX room_invitations_room ON room_invitations (room_id, created_at DESC)`,

      `CREATE TABLE room_sanctions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK (kind IN ('kick', 'ban')),
        reason TEXT NOT NULL DEFAULT '',
        expires_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        lifted_at TIMESTAMPTZ,
        lifted_by UUID REFERENCES users(id)
      )`,
      `CREATE INDEX room_sanctions_lookup ON room_sanctions (room_id, user_id, created_at DESC)`,

      `CREATE TABLE room_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        from_user_id UUID NOT NULL REFERENCES users(id),
        to_user_id UUID NOT NULL REFERENCES users(id),
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        declined_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE UNIQUE INDEX room_transfers_open ON room_transfers (room_id)
        WHERE accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL`,

      `CREATE TABLE room_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        client_id TEXT NOT NULL CHECK (char_length(client_id) BETWEEN 1 AND 64),
        body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
        seq BIGINT GENERATED ALWAYS AS IDENTITY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        edited_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        deleted_by UUID REFERENCES users(id),
        delete_reason TEXT,
        UNIQUE (room_id, author_id, client_id)
      )`,
      `CREATE INDEX room_messages_room ON room_messages (room_id, seq)`,
    ],
  },
  {
    // Chat réel (lot d'accélération C ; architecture C009) : les événements sont écrits
    // dans la MÊME transaction que l'écriture métier (table transactionnelle), puis lus
    // par les flux SSE avec un curseur `seq` : reprise après coupure ou redémarrage sans
    // rien perdre. `revoke` ferme côté serveur les flux d'un membre sanctionné.
    id: "011_chat_evenements",
    statements: [
      `CREATE TABLE room_events (
        seq BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('message', 'edit', 'delete', 'revoke')),
        message_id UUID,
        target_user_id UUID,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX room_events_room ON room_events (room_id, seq)`,
    ],
  },
  {
    // Lot d'accélération D28-D31 : notifications persistantes (réponses et salons suivis,
    // regroupées par salon) et blocage entre membres. Une notification de salon privé est
    // SUPPRIMÉE à la perte d'accès (D30) ; aucune auto-notification.
    id: "012_notifications_blocage",
    statements: [
      `CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('reply', 'room_message')),
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id),
        count INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        read_at TIMESTAMPTZ
      )`,
      `CREATE INDEX notifications_user ON notifications (user_id, read_at, updated_at DESC)`,
      // Regroupement : UNE notification non lue par salon et par membre (compteur incrémenté).
      `CREATE UNIQUE INDEX notifications_room_grouped ON notifications (user_id, room_id) WHERE kind = 'room_message' AND read_at IS NULL`,

      `CREATE TABLE user_blocks (
        blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (blocker_id, blocked_id),
        CHECK (blocker_id <> blocked_id)
      )`,
      `CREATE INDEX user_blocks_blocked ON user_blocks (blocked_id)`,
    ],
  },
  {
    // Lot d'accélération D32-D35 : signalements, actions humaines de modération
    // (retrait, avertissement, suspension datée, bannissement distinct), contexte
    // privé journalisé et contestation. La confidentialité du signalant est
    // structurelle : reporter_id n'est jamais servi hors modération.
    id: "013_moderation",
    statements: [
      // Bannissement de plateforme distinct de la suspension (D5 §4.3) ; suspension datée.
      `ALTER TABLE users DROP CONSTRAINT users_status_check`,
      `ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'banned', 'deleted'))`,
      `ALTER TABLE users ADD COLUMN suspended_until TIMESTAMPTZ`,
      // Les notifications portent aussi les décisions de modération motivées.
      `ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check`,
      `ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('reply', 'room_message', 'moderation'))`,
      `ALTER TABLE notifications ADD COLUMN body TEXT`,

      `CREATE TABLE reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID NOT NULL REFERENCES users(id),
        target_kind TEXT NOT NULL CHECK (target_kind IN ('post', 'comment', 'message', 'member')),
        target_id UUID NOT NULL,
        target_user_id UUID REFERENCES users(id),
        room_id UUID REFERENCES rooms(id),
        reason TEXT NOT NULL CHECK (reason IN ('regles', 'spam', 'harcelement', 'illegal', 'autre')),
        details TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
        handled_by UUID REFERENCES users(id),
        handled_at TIMESTAMPTZ,
        decision TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX reports_queue ON reports (status, created_at)`,

      `CREATE TABLE moderation_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        moderator_id UUID NOT NULL REFERENCES users(id),
        target_user_id UUID NOT NULL REFERENCES users(id),
        report_id UUID REFERENCES reports(id),
        kind TEXT NOT NULL CHECK (kind IN ('remove_content', 'warn', 'suspend', 'ban', 'lift')),
        content_kind TEXT CHECK (content_kind IN ('post', 'comment', 'message')),
        content_id UUID,
        reason TEXT NOT NULL,
        duration_days INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX moderation_actions_user ON moderation_actions (target_user_id, created_at DESC)`,

      // Une contestation par sanction (index unique), dans les 14 jours (vérifié par le code).
      `CREATE TABLE sanction_appeals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_id UUID NOT NULL UNIQUE REFERENCES moderation_actions(id),
        user_id UUID NOT NULL REFERENCES users(id),
        body TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        decided_by UUID REFERENCES users(id),
        decided_at TIMESTAMPTZ,
        decision TEXT CHECK (decision IN ('maintenue', 'levee')),
        decision_reason TEXT
      )`,

      // Journal des consultations du contexte privé d'un signalement (D5 §4.4).
      `CREATE TABLE report_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES reports(id),
        moderator_id UUID NOT NULL REFERENCES users(id),
        viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    // Corrections de la recette Codex C010 (ACC01-ACC09).
    // - ACC02 : chaque sanction se lève INDIVIDUELLEMENT (revoked_*) ; le statut du compte
    //   est recalculé depuis les sanctions encore applicables, jamais remis à « active »
    //   par la levée d'une sanction ancienne.
    // - ACC06 : watermark de purge des événements PAR SALON (les numéros de séquence
    //   viennent d'une suite globale : un trou n'implique pas une purge).
    // - ACC09 : contestation d'un bannissement SANS session communautaire, par jeton
    //   dédié à durée courte (haché en base), qui n'ouvre aucune session.
    id: "014_corrections_acceptation",
    statements: [
      `ALTER TABLE moderation_actions ADD COLUMN revoked_at TIMESTAMPTZ`,
      `ALTER TABLE moderation_actions ADD COLUMN revoked_by UUID REFERENCES users(id)`,
      `ALTER TABLE moderation_actions ADD COLUMN revoked_reason TEXT`,
      `ALTER TABLE rooms ADD COLUMN events_purged_seq BIGINT NOT NULL DEFAULT 0`,
      `CREATE TABLE appeal_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    // Réactions rapides sous les publications (fonctionnalité visible, 14 novembre 2026).
    // Une réaction de chaque sorte par membre et par publication (clé primaire).
    id: "015_reactions",
    statements: [
      `CREATE TABLE post_reactions (
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('interessant', 'appris', 'a_creuser')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, user_id, kind)
      )`,
      `CREATE INDEX post_reactions_post ON post_reactions (post_id, kind)`,
    ],
  },
  {
    // Bêta sur invitation (D1 : 30 à 50 invités) et retours des testeurs (14 novembre 2026).
    // - Invitation à la plateforme : lien à usage unique, haché en base, expirant, révocable ;
    //   portée par le lien de connexion jusqu'à la création du compte, consommée atomiquement.
    // - Avis des testeurs : un message libre typé, traité par l'administration.
    id: "016_beta_invitations_avis",
    statements: [
      `CREATE TABLE platform_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_by UUID NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 120),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        used_at TIMESTAMPTZ,
        used_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX platform_invitations_creator ON platform_invitations (created_by, created_at DESC)`,
      `ALTER TABLE login_tokens ADD COLUMN invitation_id UUID REFERENCES platform_invitations(id)`,
      `CREATE TABLE feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        kind TEXT NOT NULL CHECK (kind IN ('bug', 'idee', 'autre')),
        body TEXT NOT NULL CHECK (char_length(body) BETWEEN 5 AND 2000),
        page TEXT NOT NULL DEFAULT '' CHECK (char_length(page) <= 300),
        status TEXT NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'traite')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX feedback_status ON feedback (status, created_at DESC)`,
    ],
  },
  {
    // Actus réelles importées automatiquement (fil jamais vide) : image et nom de la source
    // sur la publication ; horodatage de la dernière importation (une seule à la fois).
    id: "017_actus_importees",
    statements: [
      `ALTER TABLE posts ADD COLUMN image_url TEXT`,
      `ALTER TABLE posts ADD COLUMN source_name TEXT`,
      `CREATE TABLE actus_runs (
        id INT PRIMARY KEY CHECK (id = 1),
        started_at TIMESTAMPTZ NOT NULL DEFAULT '2000-01-01',
        finished_at TIMESTAMPTZ,
        report JSONB
      )`,
      `INSERT INTO actus_runs (id) VALUES (1)`,
      // Couvrir toute l'actualité des passionnés, pas seulement IA, robotique et espace.
      `INSERT INTO themes (slug, name, description, position) VALUES
        ('sciences', 'Sciences', 'Découvertes, recherche, santé, climat, physique, biologie…', 4),
        ('tech', 'Tech & numérique', 'Innovations, gadgets, logiciels, internet et industrie du numérique.', 5)
       ON CONFLICT (slug) DO NOTHING`,
      // Compte d'importation distinct de l'agent éditorial : les actus affichent leur source.
      `INSERT INTO users (handle, display_name, bio, role, rules_accepted_at)
       VALUES ('valyo-actus', 'Valyo Actus', 'Les dernières nouvelles tech et sciences, avec un lien vers chaque source.', 'agent', now())
       ON CONFLICT DO NOTHING`,
    ],
  },
  {
    id: "018_categories_syntheses",
    statements: [
      `INSERT INTO themes (slug, name, description, position) VALUES
        ('sante', 'Santé & médecine', 'Médecine, recherche biomédicale, traitements et santé publique.', 6),
        ('climat', 'Climat & environnement', 'Climat, biodiversité, océans, pollution et écologie.', 7),
        ('energie', 'Énergie', 'Nucléaire, renouvelables, batteries, hydrogène et réseaux.', 8),
        ('physique', 'Physique & quantique', 'Physique fondamentale, quantique, particules et mathématiques.', 9),
        ('biologie', 'Biologie & vivant', 'Génétique, évolution, animaux, plantes et origines du vivant.', 10),
        ('cyber', 'Cybersécurité', 'Piratages, failles, fuites de données et protection de la vie privée.', 11)
       ON CONFLICT (slug) DO NOTHING`,
      `UPDATE themes SET description = 'Découvertes et recherche, toutes disciplines.' WHERE slug = 'sciences'`,
      // Sources payantes retirées : leurs actus déjà importées ne s'affichent plus.
      `UPDATE posts SET status = 'deleted', deleted_at = now()
       WHERE source_name IN ('Le Monde Sciences', 'Sciences et Avenir', 'Ciel et Espace')
         AND author_id = (SELECT id FROM users WHERE handle = 'valyo-actus') AND status = 'published'`,
      // Synthèse IA d'un article (« Développer ») : une seule par publication, partagée par tous.
      `CREATE TABLE post_syntheses (
        post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed', 'unavailable')),
        content JSONB,
        error TEXT,
        model TEXT,
        requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX post_syntheses_recent ON post_syntheses (created_at)`,
    ],
  },
  {
    id: "019_photos_membres",
    statements: [
      // Photos jointes par les membres : fichier WebP sur disque (UPLOADS_DIR), métadonnées ici.
      // post_id NULL = envoyée mais pas encore publiée (nettoyée après 24 h).
      `CREATE TABLE post_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        position INT NOT NULL DEFAULT 0,
        width INT NOT NULL,
        height INT NOT NULL,
        bytes INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX post_images_post ON post_images (post_id, position)`,
      `CREATE INDEX post_images_uploader ON post_images (uploader_id, created_at)`,
    ],
  },
  {
    id: "020_messages_prives",
    statements: [
      // Conversation privée entre deux membres : une seule par paire (user_a < user_b).
      `CREATE TABLE conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_message_at TIMESTAMPTZ,
        CHECK (user_a < user_b),
        UNIQUE (user_a, user_b)
      )`,
      `CREATE INDEX conversations_b ON conversations (user_b)`,
      `CREATE TABLE direct_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      )`,
      `CREATE INDEX direct_messages_conversation ON direct_messages (conversation_id, created_at)`,
      `CREATE INDEX direct_messages_sender ON direct_messages (sender_id, created_at)`,
      `CREATE TABLE conversation_reads (
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (conversation_id, user_id)
      )`,
    ],
  },
  {
    id: "021_syntheses_relecture",
    statements: [
      // Lecture des pages corrigée (plusieurs blocs <article>) : les articles jugés illisibles
      // à tort redeviennent réessayables au prochain clic sur « Développer ».
      `UPDATE post_syntheses SET status = 'failed', updated_at = now()
       WHERE status = 'unavailable' AND error LIKE 'Le texte de l%'`,
    ],
  },
  {
    id: "022_profil_passionne",
    statements: [
      `ALTER TABLE users ADD COLUMN headline TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN specialties TEXT[] NOT NULL DEFAULT '{}'`,
      `ALTER TABLE users ADD COLUMN links TEXT[] NOT NULL DEFAULT '{}'`,
      `ALTER TABLE users ADD COLUMN ask_me TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN looking_for TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN avatar_image_id UUID REFERENCES post_images(id) ON DELETE SET NULL`,
      `ALTER TABLE users ADD COLUMN banner_image_id UUID REFERENCES post_images(id) ON DELETE SET NULL`,
    ],
  },
  {
    id: "023_publication_epinglee",
    statements: [`ALTER TABLE users ADD COLUMN pinned_post_id UUID REFERENCES posts(id) ON DELETE SET NULL`],
  },
  {
    id: "024_progression",
    statements: [
      // Paliers atteints (éléments découverts, niveaux de thème, découvertes) : acquis pour
      // toujours, même si une réaction est retirée ensuite. seen_at : le toast a été montré.
      `CREATE TABLE user_achievements (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL CHECK (char_length(key) BETWEEN 1 AND 80),
        unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        seen_at TIMESTAMPTZ,
        PRIMARY KEY (user_id, key)
      )`,
      // Premier calcul : les paliers déjà mérités sont enregistrés sans toast (pas d'avalanche).
      `ALTER TABLE users ADD COLUMN progress_synced_at TIMESTAMPTZ`,
    ],
  },
  {
    id: "025_mentions_meilleure_reponse",
    statements: [
      // Lot social : mentions @pseudo et meilleure réponse d'une question.
      `ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check`,
      `ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('reply', 'room_message', 'moderation', 'mention', 'best_answer'))`,
      `ALTER TABLE posts ADD COLUMN best_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL`,
    ],
  },
  {
    id: "026_relais_rendezvous",
    statements: [
      // Relais : republier une publication vers ses abonnés, avec un avis facultatif.
      `CREATE TABLE post_relays (
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, user_id)
      )`,
      `CREATE INDEX post_relays_user ON post_relays (user_id, created_at DESC)`,
      // Rendez-vous d'un salon (journal club, session « demandez-moi »…).
      `CREATE TABLE room_meetups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id),
        title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
        details TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 500),
        starts_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        canceled_at TIMESTAMPTZ
      )`,
      `CREATE INDEX room_meetups_room ON room_meetups (room_id, starts_at)`,
      `ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check`,
      `ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('reply', 'room_message', 'moderation', 'mention', 'best_answer', 'relay'))`,
    ],
  },
  {
    id: "027_quotas_syntheses",
    statements: [
      // SEC-03 : chaque TENTATIVE d'appel IA est journalisée ; les quotas comptent ces lignes,
      // jamais la ligne de cache. user_id NULL = synthèse automatique de l'import.
      `CREATE TABLE synthesis_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        outcome TEXT,
        cost_micros BIGINT NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX synthesis_attempts_recent ON synthesis_attempts (created_at)`,
      `CREATE INDEX synthesis_attempts_post ON synthesis_attempts (post_id, created_at)`,
      // SEC-04 : les synthèses de publications déjà retirées ne doivent plus être servies.
      `DELETE FROM post_syntheses WHERE post_id IN (SELECT id FROM posts WHERE status <> 'published')`,
    ],
  },
  {
    id: "028_reservation_budget",
    statements: [
      // C020-01 : réservation monétaire prudente posée À LA RÉSERVATION, rapprochée du coût
      // réel à la clôture ; cost_estimated marque un coût inconnu remplacé par l'estimation.
      `ALTER TABLE synthesis_attempts ADD COLUMN reserved_micros BIGINT NOT NULL DEFAULT 0`,
      `ALTER TABLE synthesis_attempts ADD COLUMN cost_estimated BOOLEAN NOT NULL DEFAULT false`,
    ],
  },
  {
    id: "029_index_par_membre",
    statements: [
      // Audit performance du 17 novembre : les agrégations « par membre » (profil, progression,
      // série, fil social) parcouraient ces tables sans index dédié. Posés avant que ça coûte.
      `CREATE INDEX comments_author ON comments (author_id, created_at)`,
      `CREATE INDEX post_reactions_user ON post_reactions (user_id, created_at)`,
      `CREATE INDEX room_messages_author ON room_messages (author_id)`,
      `CREATE INDEX member_follows_followee ON member_follows (followee_id)`,
    ],
  },
  {
    id: "030_statut_analyse",
    statements: [
      // Recette D4 du 18 novembre 2026, décision du porteur : les articles d'ANALYSE
      // (fond, synthèse, point de vue argumenté) sont une catégorie légitime, pas un
      // « statut incertain ». Nouveau statut 'analysis' de bout en bout.
      `ALTER TABLE editorial_subjects DROP CONSTRAINT editorial_subjects_scientific_status_check`,
      `ALTER TABLE editorial_subjects ADD CONSTRAINT editorial_subjects_scientific_status_check
        CHECK (scientific_status IN ('announcement', 'preprint', 'published', 'unknown', 'analysis'))`,
    ],
  },
  {
    id: "031_scores_jeux",
    statements: [
      // Points des jeux et classement entre membres (23 novembre 2026). Une ligne par membre,
      // par jour et par jeu : seule la première partie du jour compte, d'où la clé primaire.
      // `marks` garde le détail des réponses (« 1011011 ») pour réafficher le défi du jour.
      `CREATE TABLE game_scores (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day DATE NOT NULL,
        game TEXT NOT NULL CHECK (game IN ('defi', 'quiz', 'vf', 'duel', 'frise')),
        correct SMALLINT NOT NULL CHECK (correct >= 0),
        total SMALLINT NOT NULL CHECK (total > 0 AND correct <= total),
        points INTEGER NOT NULL CHECK (points >= 0),
        marks TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, day, game)
      )`,
      `CREATE INDEX game_scores_day ON game_scores (day)`,
    ],
  },
  {
    id: "032_notifications_push",
    statements: [
      // Notifications push (23 novembre 2026). Un abonnement par appareil ; les clés VAPID
      // du serveur sont générées une fois et gardées ici si l'environnement n'en fournit pas.
      `CREATE TABLE push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX push_subscriptions_user ON push_subscriptions (user_id)`,
      `CREATE TABLE push_keys (
        id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      // File d'envoi : une notification ou un message privé « pas encore poussé » a pushed_at nul.
      // Tout l'existant est marqué comme déjà traité : aucun envoi rétroactif à l'activation.
      `ALTER TABLE notifications ADD COLUMN pushed_at TIMESTAMPTZ`,
      `UPDATE notifications SET pushed_at = now()`,
      `CREATE INDEX notifications_to_push ON notifications (created_at) WHERE pushed_at IS NULL`,
      `ALTER TABLE direct_messages ADD COLUMN pushed_at TIMESTAMPTZ`,
      `UPDATE direct_messages SET pushed_at = now()`,
      `CREATE INDEX direct_messages_to_push ON direct_messages (created_at) WHERE pushed_at IS NULL`,
    ],
  },
  {
    id: "033_messages_vocaux",
    statements: [
      // Messages vocaux des salons (23 novembre 2026). Le fichier est sur disque (volume des
      // photos, sous-dossier audio) ; la ligne porte ce qu'il faut pour le servir. Un message
      // vocal est un message ordinaire (corps « Message vocal ») relié à son enregistrement.
      `CREATE TABLE room_audio (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        mime TEXT NOT NULL CHECK (mime IN ('audio/mp4', 'audio/webm', 'audio/ogg')),
        duration_ms INTEGER NOT NULL CHECK (duration_ms BETWEEN 1 AND 125000),
        bytes INTEGER NOT NULL CHECK (bytes > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX room_audio_author ON room_audio (author_id, created_at)`,
      `ALTER TABLE room_messages ADD COLUMN audio_id UUID REFERENCES room_audio(id) ON DELETE SET NULL`,
    ],
  },
  {
    id: "034_lecture_audio",
    statements: [
      // Lecture audio des publications par une voix naturelle (23 novembre 2026) : un fichier par
      // publication et par type, fabriqué au premier clic puis conservé (dossier lecture/ du volume).
      // `chars` sert au plafond quotidien ; `text_hash` fait refaire le son si le texte change.
      `CREATE TABLE post_audio (
        id UUID PRIMARY KEY,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('article', 'synthese')),
        text_hash TEXT NOT NULL,
        bytes INTEGER NOT NULL CHECK (bytes > 0),
        chars INTEGER NOT NULL CHECK (chars > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (post_id, kind)
      )`,
      `CREATE INDEX post_audio_created ON post_audio (created_at)`,
    ],
  },
];
