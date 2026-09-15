//! Sordi IQ — the in-app AI assistant. Talks to OpenRouter's
//! OpenAI-compatible /chat/completions endpoint and gives the model a small,
//! fixed set of read-only tools over the local SQLite database (revenue,
//! overdue invoices, top clients, recent expenses) so answers reflect the
//! user's actual data instead of being generic chat.
//!
//! The API key is supplied by the frontend on every call (read from the
//! `settings` table's `sordi_iq_api_key` key via the normal useSettings/
//! update_settings path — see InvoiceCustomizeDrawer.tsx's own pattern for
//! why secrets live in that schemaless key-value store rather than a
//! dedicated column), never hardcoded here or persisted by this module
//! itself.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL: &str = "https://openrouter.ai/api/v1/models";
pub const DEFAULT_MODEL: &str = "anthropic/claude-3.5-sonnet";
// Hard cap on the tool-call round-trip loop — a well-behaved model settles
// in 1-3 iterations; this only exists to guarantee the command always
// terminates instead of looping forever against a misbehaving model/tool.
const MAX_TOOL_ITERATIONS: u8 = 6;

const SYSTEM_PROMPT: &str = "Tu es Sordi IQ, l'assistant intelligent intégré à Sordi, une application desktop de facturation et de gestion financière pour des entreprises en Algérie. \
Réponds de manière directe, professionnelle et précise, sans formules de politesse inutiles. \
Utilise le Markdown (tableaux, listes, gras) pour structurer les réponses analytiques. \
Formate toujours les montants en Dinars Algériens (DZD) avec le séparateur de milliers. \
Tu as accès à des outils. Certains sont en lecture seule sur la base de données réelle de l'utilisateur (chiffre d'affaires, factures en retard, meilleurs clients, dépenses récentes) — utilise-les systématiquement dès qu'une question porte sur des données réelles de l'entreprise plutôt que de deviner ou d'halluciner des chiffres. Si une donnée n'est pas disponible via les outils, dis-le clairement plutôt que d'inventer un chiffre. \
D'autres outils EXÉCUTENT une action réelle dans l'application (créer un client, un fournisseur, une facture, une dépense). Si l'utilisateur demande de créer, ajouter ou enregistrer une donnée, tu DOIS utiliser l'outil approprié — ne décris jamais l'action en texte à la place de l'appeler, et ne prétends jamais qu'une action a été effectuée sans avoir appelé l'outil correspondant.";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SordiIqToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SordiIqToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: SordiIqToolCallFunction,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SordiIqMessage {
    pub role: String,
    // `default` (not just `skip_serializing_if`) on every Option field here
    // — the frontend only ever sends `{ role, content }` (see SordiIQ.tsx's
    // sendMessage), omitting tool_calls/tool_call_id entirely. serde
    // requires a field to be PRESENT in the incoming JSON unless `default`
    // says otherwise, even for an Option<T> — skip_serializing_if only
    // affects the OUTGOING side. Without `default` here, every single
    // sordi_iq_chat call failed Tauri's IPC deserialization before this
    // command's body ever ran, let alone reached OpenRouter.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<SordiIqToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Serialize)]
struct OpenRouterToolFunctionDef {
    name: &'static str,
    description: &'static str,
    parameters: Value,
}

#[derive(Serialize)]
struct OpenRouterToolDef {
    #[serde(rename = "type")]
    kind: &'static str,
    function: OpenRouterToolFunctionDef,
}

#[derive(Serialize)]
struct OpenRouterRequest<'a> {
    model: &'a str,
    messages: &'a [SordiIqMessage],
    tools: &'a [OpenRouterToolDef],
    tool_choice: &'a str,
    temperature: f32,
    // Hardcapped — some models default to their full context window (up to
    // 131,072 tokens) when this is omitted, which the free OpenRouter tier
    // rejects outright. 1024 is plenty for a chat reply or a tool call.
    max_tokens: u32,
}

const MAX_RESPONSE_TOKENS: u32 = 1024;

#[derive(Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}

#[derive(Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterResponseMessage,
}

#[derive(Deserialize)]
struct OpenRouterResponseMessage {
    // Some OpenAI-compatible providers omit `content` entirely (rather than
    // sending it as `null`) on a tool-calls-only response — `default` here
    // covers that instead of failing deserialization on that specific
    // response shape.
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<SordiIqToolCall>>,
}

fn tool_definitions() -> Vec<OpenRouterToolDef> {
    vec![
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "get_business_snapshot",
                description: "Vue d'ensemble instantanée de l'entreprise : nombre de clients, nombre de factures, chiffre d'affaires facturé et encaissé (tous temps confondus), créances en cours, factures en retard, total des dépenses de l'année en cours.",
                parameters: json!({ "type": "object", "properties": {}, "additionalProperties": false }),
            },
        },
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "get_overdue_invoices",
                description: "Liste les factures en retard de paiement (échéance dépassée, solde restant > 0), triées par ancienneté de retard décroissante.",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "limit": { "type": "integer", "description": "Nombre maximum de factures à retourner (défaut 10, max 50)" }
                    },
                    "additionalProperties": false
                }),
            },
        },
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "get_top_clients",
                description: "Classe les clients par chiffre d'affaires facturé (tous temps confondus), du plus élevé au plus faible.",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "limit": { "type": "integer", "description": "Nombre maximum de clients à retourner (défaut 10, max 50)" }
                    },
                    "additionalProperties": false
                }),
            },
        },
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "get_revenue_by_period",
                description: "Chiffre d'affaires facturé/encaissé, dépenses et résultat net pour une période donnée (un mois ou une année entière).",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "period": { "type": "string", "enum": ["month", "year"], "description": "Granularité de la période" },
                        "value": { "type": "string", "description": "Valeur de la période : 'YYYY-MM' pour un mois (ex: '2026-01'), 'YYYY' pour une année (ex: '2026')" }
                    },
                    "required": ["period", "value"],
                    "additionalProperties": false
                }),
            },
        },
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "get_recent_expenses",
                description: "Liste les dépenses les plus récentes de l'entreprise, toutes catégories confondues.",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "limit": { "type": "integer", "description": "Nombre maximum de dépenses à retourner (défaut 10, max 50)" }
                    },
                    "additionalProperties": false
                }),
            },
        },
        // --- Write tools — see WRITE_TOOL_NAMES below. Unlike the 5 tools
        // above, these are NEVER executed here: the sordi_iq_chat loop
        // detects a write-tool call and returns it unresolved to the
        // frontend (SordiIQ.tsx), which runs the exact same React Query
        // mutation hooks (useCreateClient/useCreateSupplier/useCreateInvoice/
        // useCreateExpense) the pre-existing AiCopilotBar omnibar used —
        // same validated, cache-invalidating, toast-producing path, not a
        // second parallel write path implemented in Rust.
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "create_client",
                description: "Crée un nouveau client dans Sordi. Utilise cet outil dès que l'utilisateur demande d'ajouter, créer ou enregistrer un client.",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "name": { "type": "string", "description": "Nom ou raison sociale du client" },
                        "phone": { "type": "string", "description": "Numéro de téléphone (optionnel)" }
                    },
                    "required": ["name"],
                    "additionalProperties": false
                }),
            },
        },
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "create_supplier",
                description: "Crée un nouveau fournisseur dans Sordi. Utilise cet outil dès que l'utilisateur demande d'ajouter, créer ou enregistrer un fournisseur.",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "name": { "type": "string", "description": "Nom ou raison sociale du fournisseur" },
                        "phone": { "type": "string", "description": "Numéro de téléphone (optionnel)" }
                    },
                    "required": ["name"],
                    "additionalProperties": false
                }),
            },
        },
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "create_invoice",
                description: "Crée une facture pour un client existant (ou nouvellement nommé) avec un seul article. Utilise cet outil dès que l'utilisateur demande de créer, générer ou établir une facture.",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "client_name": { "type": "string", "description": "Nom du client destinataire — résolu par correspondance approximative contre les clients existants ; un client est créé automatiquement si aucune correspondance n'est trouvée" },
                        "description": { "type": "string", "description": "Désignation de l'article/prestation facturé" },
                        "amount": { "type": "number", "description": "Montant unitaire HT de l'article" },
                        "date": { "type": "string", "description": "Date de la facture au format YYYY-MM-DD (défaut : aujourd'hui)" }
                    },
                    "required": ["client_name", "amount"],
                    "additionalProperties": false
                }),
            },
        },
        OpenRouterToolDef {
            kind: "function",
            function: OpenRouterToolFunctionDef {
                name: "create_expense",
                description: "Enregistre une nouvelle dépense de l'entreprise. Utilise cet outil dès que l'utilisateur demande d'ajouter, créer ou enregistrer une dépense.",
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "category": { "type": "string", "description": "Catégorie de la dépense (ex: Internet, Loyer, Fournitures)" },
                        "amount": { "type": "number", "description": "Montant de la dépense" },
                        "description": { "type": "string", "description": "Description de la dépense (optionnel)" },
                        "date": { "type": "string", "description": "Date de la dépense au format YYYY-MM-DD (défaut : aujourd'hui)" }
                    },
                    "required": ["category", "amount"],
                    "additionalProperties": false
                }),
            },
        },
    ]
}

/// Tool names that EXECUTE a real mutation rather than just reading data —
/// see tool_definitions()'s own note. sordi_iq_chat checks a tool_call's
/// name against this list to decide whether to resolve it locally (a read
/// tool, via run_tool below) or hand it back to the frontend unresolved.
const WRITE_TOOL_NAMES: &[&str] = &["create_client", "create_supplier", "create_invoice", "create_expense"];

fn is_write_tool(name: &str) -> bool {
    WRITE_TOOL_NAMES.contains(&name)
}

fn default_company_id(conn: &Connection) -> Result<String, String> {
    conn.query_row("SELECT id FROM companies ORDER BY created_at LIMIT 1", [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

fn clamp_limit(args: &Value, default: i64, max: i64) -> i64 {
    args.get("limit")
        .and_then(|v| v.as_i64())
        .unwrap_or(default)
        .clamp(1, max)
}

fn tool_business_snapshot(conn: &Connection, company_id: &str) -> Result<Value, String> {
    let clients_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM clients WHERE company_id = ?1", params![company_id], |r| r.get(0))
        .unwrap_or(0);

    let real_invoice_filter = "invoice_type NOT IN ('credit_note', 'proforma', 'quote')";

    let (invoices_count, total_invoiced, total_paid): (i64, f64, f64) = conn
        .query_row(
            &format!(
                "SELECT COUNT(*), COALESCE(SUM(total_ttc), 0.0), COALESCE(SUM(amount_paid), 0.0) FROM invoices WHERE company_id = ?1 AND {}",
                real_invoice_filter
            ),
            params![company_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap_or((0, 0.0, 0.0));

    let (overdue_count, overdue_amount): (i64, f64) = conn
        .query_row(
            &format!(
                "SELECT COUNT(*), COALESCE(SUM(total_ttc - amount_paid), 0.0) FROM invoices \
                 WHERE company_id = ?1 AND {} AND due_date IS NOT NULL AND due_date < date('now') AND (total_ttc - COALESCE(amount_paid, 0.0)) > 0.01",
                real_invoice_filter
            ),
            params![company_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0.0));

    let expenses_this_year: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE company_id = ?1 AND strftime('%Y', expense_date) = strftime('%Y', 'now')",
            params![company_id],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    Ok(json!({
        "clients_count": clients_count,
        "invoices_count": invoices_count,
        "total_invoiced_ttc": total_invoiced,
        "total_paid": total_paid,
        "outstanding_receivables": total_invoiced - total_paid,
        "overdue_invoices_count": overdue_count,
        "overdue_amount": overdue_amount,
        "expenses_this_year": expenses_this_year,
        "currency": "DZD",
    }))
}

fn tool_overdue_invoices(conn: &Connection, company_id: &str, args: &Value) -> Result<Value, String> {
    let limit = clamp_limit(args, 10, 50);
    let mut stmt = conn
        .prepare(
            "SELECT i.invoice_number, c.name, i.total_ttc, i.amount_paid, i.due_date, \
             CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_overdue \
             FROM invoices i JOIN clients c ON c.id = i.client_id \
             WHERE i.company_id = ?1 AND i.invoice_type NOT IN ('credit_note', 'proforma', 'quote') \
             AND i.due_date IS NOT NULL AND i.due_date < date('now') \
             AND (i.total_ttc - COALESCE(i.amount_paid, 0.0)) > 0.01 \
             ORDER BY i.due_date ASC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![company_id, limit], |r| {
            let total_ttc: f64 = r.get(2)?;
            let amount_paid: f64 = r.get(3)?;
            Ok(json!({
                "invoice_number": r.get::<_, String>(0)?,
                "client_name": r.get::<_, String>(1)?,
                "total_ttc": total_ttc,
                "balance_due": total_ttc - amount_paid,
                "due_date": r.get::<_, String>(4)?,
                "days_overdue": r.get::<_, i64>(5)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    Ok(json!({ "overdue_invoices": rows, "currency": "DZD" }))
}

fn tool_top_clients(conn: &Connection, company_id: &str, args: &Value) -> Result<Value, String> {
    let limit = clamp_limit(args, 10, 50);
    let mut stmt = conn
        .prepare(
            "SELECT c.name, COUNT(i.id) AS invoice_count, COALESCE(SUM(i.total_ttc), 0.0) AS total_invoiced, COALESCE(SUM(i.amount_paid), 0.0) AS total_paid \
             FROM clients c LEFT JOIN invoices i ON i.client_id = c.id AND i.company_id = ?1 AND i.invoice_type NOT IN ('credit_note', 'proforma', 'quote') \
             WHERE c.company_id = ?1 \
             GROUP BY c.id ORDER BY total_invoiced DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![company_id, limit], |r| {
            Ok(json!({
                "client_name": r.get::<_, String>(0)?,
                "invoice_count": r.get::<_, i64>(1)?,
                "total_invoiced_ttc": r.get::<_, f64>(2)?,
                "total_paid": r.get::<_, f64>(3)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    Ok(json!({ "top_clients": rows, "currency": "DZD" }))
}

fn tool_revenue_by_period(conn: &Connection, company_id: &str, args: &Value) -> Result<Value, String> {
    let period = args.get("period").and_then(|v| v.as_str()).unwrap_or("month");
    let value = args
        .get("value")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Le paramètre 'value' est requis (ex: '2026-01' ou '2026')".to_string())?;

    let (invoice_date_expr, expense_date_expr) = if period == "year" {
        ("strftime('%Y', i.invoice_date)", "strftime('%Y', expense_date)")
    } else {
        ("strftime('%Y-%m', i.invoice_date)", "strftime('%Y-%m', expense_date)")
    };

    let (total_invoiced, total_paid): (f64, f64) = conn
        .query_row(
            &format!(
                "SELECT COALESCE(SUM(total_ttc), 0.0), COALESCE(SUM(amount_paid), 0.0) FROM invoices i \
                 WHERE i.company_id = ?1 AND i.invoice_type NOT IN ('credit_note', 'proforma', 'quote') AND {} = ?2",
                invoice_date_expr
            ),
            params![company_id, value],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0.0));

    let total_expenses: f64 = conn
        .query_row(
            &format!("SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE company_id = ?1 AND {} = ?2", expense_date_expr),
            params![company_id, value],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    Ok(json!({
        "period": period,
        "value": value,
        "total_invoiced_ttc": total_invoiced,
        "total_paid": total_paid,
        "total_expenses": total_expenses,
        "net_profit_cash_basis": total_paid - total_expenses,
        "currency": "DZD",
    }))
}

fn tool_recent_expenses(conn: &Connection, company_id: &str, args: &Value) -> Result<Value, String> {
    let limit = clamp_limit(args, 10, 50);
    let mut stmt = conn
        .prepare(
            "SELECT expense_date, category, description, amount FROM expenses \
             WHERE company_id = ?1 ORDER BY expense_date DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![company_id, limit], |r| {
            Ok(json!({
                "expense_date": r.get::<_, String>(0)?,
                "category": r.get::<_, String>(1)?,
                "description": r.get::<_, Option<String>>(2)?,
                "amount": r.get::<_, f64>(3)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    Ok(json!({ "recent_expenses": rows, "currency": "DZD" }))
}

fn run_tool(conn: &Connection, name: &str, args: &Value) -> Result<Value, String> {
    let company_id = default_company_id(conn)?;
    match name {
        "get_business_snapshot" => tool_business_snapshot(conn, &company_id),
        "get_overdue_invoices" => tool_overdue_invoices(conn, &company_id, args),
        "get_top_clients" => tool_top_clients(conn, &company_id, args),
        "get_revenue_by_period" => tool_revenue_by_period(conn, &company_id, args),
        "get_recent_expenses" => tool_recent_expenses(conn, &company_id, args),
        other => Err(format!("Outil inconnu: {}", other)),
    }
}

// ---------------------------------------------------------------------------
// Local fallback engine — no NLP, no ML, just a plain keyword match against
// the same read-only tools above, used when there is genuinely no way to
// reach OpenRouter (no API key configured, or the request itself failed).
// This keeps Sordi IQ answering the handful of questions its own local data
// can actually answer without a real LLM, instead of just refusing to
// respond. get_revenue_by_period is deliberately excluded — it requires an
// explicit period/value the user's free-text can't be reliably parsed into
// without an LLM; get_business_snapshot already surfaces total revenue for
// a revenue-shaped question.

/// First matching keyword set wins — checked in a fixed, most-specific-first
/// order so e.g. "clients en retard de paiement" matches "retard" (overdue
/// invoices) rather than "client" (top clients).
fn match_local_intent(text: &str) -> &'static str {
    let lower = text.to_lowercase();
    if lower.contains("retard") || lower.contains("impay") || lower.contains("échu") || lower.contains("echu") {
        "get_overdue_invoices"
    } else if lower.contains("meilleur client")
        || lower.contains("top client")
        || lower.contains("client fréquent")
        || lower.contains("client frequent")
        || lower.contains("clients fréquents")
        || lower.contains("clients frequents")
    {
        "get_top_clients"
    } else if lower.contains("dépense") || lower.contains("depense") || lower.contains("charge") {
        "get_recent_expenses"
    } else {
        // Covers "chiffre d'affaires"/"revenu"/general "comment va
        // l'entreprise" questions, and is also the safe default for
        // anything unrecognized — a snapshot is a reasonable answer to
        // "I don't know exactly what you're asking."
        "get_business_snapshot"
    }
}

/// Formats one tool's JSON result into the same kind of short, readable
/// French text block the model itself would produce — this is what makes
/// the fallback feel like an answer, not a raw data dump.
fn format_local_tool_result(tool_name: &str, value: &Value) -> String {
    let get_str = |v: &Value, key: &str| v.get(key).and_then(Value::as_str).unwrap_or("-").to_string();
    let get_f64 = |v: &Value, key: &str| v.get(key).and_then(Value::as_f64).unwrap_or(0.0);
    let get_i64 = |v: &Value, key: &str| v.get(key).and_then(Value::as_i64).unwrap_or(0);

    match tool_name {
        "get_business_snapshot" => format!(
            "**Vue d'ensemble de l'entreprise**\n\
             - Clients : {}\n\
             - Factures : {}\n\
             - Facturé (TTC) : {}\n\
             - Encaissé : {}\n\
             - Créances en cours : {}\n\
             - Factures en retard : {} ({})",
            get_i64(value, "clients_count"),
            get_i64(value, "invoices_count"),
            format_dzd(get_f64(value, "total_invoiced_ttc")),
            format_dzd(get_f64(value, "total_paid")),
            format_dzd(get_f64(value, "outstanding_receivables")),
            get_i64(value, "overdue_invoices_count"),
            format_dzd(get_f64(value, "overdue_amount")),
        ),
        "get_overdue_invoices" => {
            let list = value.get("overdue_invoices").and_then(Value::as_array).cloned().unwrap_or_default();
            if list.is_empty() {
                "Aucune facture en retard actuellement.".to_string()
            } else {
                let lines: Vec<String> = list
                    .iter()
                    .take(10)
                    .map(|item| {
                        format!(
                            "- {} — {} — {} — {} j de retard",
                            get_str(item, "invoice_number"),
                            get_str(item, "client_name"),
                            format_dzd(get_f64(item, "balance_due")),
                            get_i64(item, "days_overdue"),
                        )
                    })
                    .collect();
                format!("**Factures en retard**\n{}", lines.join("\n"))
            }
        }
        "get_top_clients" => {
            let list = value.get("top_clients").and_then(Value::as_array).cloned().unwrap_or_default();
            if list.is_empty() {
                "Aucun client trouvé.".to_string()
            } else {
                let lines: Vec<String> = list
                    .iter()
                    .take(10)
                    .map(|item| {
                        format!(
                            "- {} — {} ({} factures)",
                            get_str(item, "client_name"),
                            format_dzd(get_f64(item, "total_invoiced_ttc")),
                            get_i64(item, "invoice_count"),
                        )
                    })
                    .collect();
                format!("**Meilleurs clients**\n{}", lines.join("\n"))
            }
        }
        "get_recent_expenses" => {
            let list = value.get("recent_expenses").and_then(Value::as_array).cloned().unwrap_or_default();
            if list.is_empty() {
                "Aucune dépense enregistrée.".to_string()
            } else {
                let lines: Vec<String> = list
                    .iter()
                    .take(10)
                    .map(|item| {
                        format!(
                            "- {} — {} — {}",
                            get_str(item, "expense_date"),
                            get_str(item, "category"),
                            format_dzd(get_f64(item, "amount")),
                        )
                    })
                    .collect();
                format!("**Dépenses récentes**\n{}", lines.join("\n"))
            }
        }
        _ => "Aucune donnée disponible.".to_string(),
    }
}

/// Entry point for the local fallback — matches the latest user message
/// against a known intent, runs the corresponding read-only tool directly
/// against SQLite (no OpenRouter call involved at all), and returns a
/// clearly-labeled assistant message. Used both when no API key is
/// configured and when a live OpenRouter request fails (see
/// sordi_iq_chat) — read-only questions keep working either way; only
/// write actions (handled entirely separately, never routed through this
/// function) require the real API/license.
fn build_local_fallback_response(conn: &Connection, messages: &[SordiIqMessage]) -> SordiIqMessage {
    let last_user_text = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| m.content.clone())
        .unwrap_or_default();

    let tool_name = match_local_intent(&last_user_text);
    let body = match run_tool(conn, tool_name, &json!({})) {
        Ok(value) => format_local_tool_result(tool_name, &value),
        Err(e) => format!("Je n'ai pas pu accéder aux données locales ({}).", e),
    };

    SordiIqMessage {
        role: "assistant".to_string(),
        content: Some(format!("💻 Mode Local (Sans API) :\n\n{}", body)),
        tool_calls: None,
        tool_call_id: None,
    }
}

// ---------------------------------------------------------------------------
// Local self-learning context — a small, cached summary of the user's own
// real usage patterns (frequent clients, typical invoice amount, recurring
// expense categories), injected as an extra system message on every
// sordi_iq_chat call so the model adapts its suggestions without needing a
// tool round-trip for basic "what does this business normally look like"
// awareness. Strictly local: built entirely from SQLite queries against
// this machine's own database, cached in-process (never written to disk or
// sent anywhere except as part of the same OpenRouter request the app
// already makes), and never involves any telemetry or external call of its
// own.
static LOCAL_CONTEXT_CACHE: std::sync::OnceLock<Mutex<Option<LocalContextCache>>> = std::sync::OnceLock::new();
// Rebuilding scans a handful of small, indexed-by-company_id queries — cheap
// even uncached — but caching still avoids redoing it on every single
// message in a back-and-forth conversation. 15 minutes balances "fresh
// enough to reflect a just-created invoice/client" against "don't re-scan
// on every keystroke's worth of chat turns."
const LOCAL_CONTEXT_TTL: Duration = Duration::from_secs(15 * 60);

struct LocalContextCache {
    company_id: String,
    snippet: String,
    built_at: std::time::Instant,
}

fn median(values: &[f64]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 0 {
        Some((sorted[mid - 1] + sorted[mid]) / 2.0)
    } else {
        Some(sorted[mid])
    }
}

/// Scans recent transactions, top clients, and spending patterns for one
/// company and formats them into a short, token-efficient French text block
/// — a handful of lines, not a data dump, so it stays cheap to include on
/// every request. Returns an empty string for a brand-new company with no
/// history yet (nothing adaptive to say), which the caller skips entirely.
fn build_local_context_snippet(conn: &Connection, company_id: &str) -> String {
    let real_invoice_filter = "invoice_type NOT IN ('credit_note', 'proforma', 'quote')";

    // Top 3 clients by invoice count — "who does this business actually
    // bill most," the clearest local self-learning signal available.
    let top_clients: Vec<(String, i64)> = conn
        .prepare(&format!(
            "SELECT c.name, COUNT(i.id) as cnt FROM invoices i JOIN clients c ON c.id = i.client_id \
             WHERE i.company_id = ?1 AND {} GROUP BY c.id ORDER BY cnt DESC LIMIT 3",
            real_invoice_filter
        ))
        .and_then(|mut stmt| {
            stmt.query_map(params![company_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
                .and_then(Iterator::collect)
        })
        .unwrap_or_default();

    // Typical invoice amount — median of the last 20 real invoices (median,
    // not mean, so one unusually large invoice doesn't skew what "normal"
    // means for this business).
    let recent_amounts: Vec<f64> = conn
        .prepare(&format!(
            "SELECT total_ttc FROM invoices WHERE company_id = ?1 AND {} ORDER BY invoice_date DESC LIMIT 20",
            real_invoice_filter
        ))
        .and_then(|mut stmt| stmt.query_map(params![company_id], |r| r.get::<_, f64>(0)).and_then(Iterator::collect))
        .unwrap_or_default();
    let typical_amount = median(&recent_amounts);

    // Top 2 expense categories over the last 90 days — recurring spending
    // pattern, not a full ledger dump.
    let top_expense_categories: Vec<(String, f64)> = conn
        .prepare(
            "SELECT category, SUM(amount) as total FROM expenses \
             WHERE company_id = ?1 AND expense_date >= date('now', '-90 days') \
             GROUP BY category ORDER BY total DESC LIMIT 2",
        )
        .and_then(|mut stmt| {
            stmt.query_map(params![company_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)))
                .and_then(Iterator::collect)
        })
        .unwrap_or_default();

    if top_clients.is_empty() && recent_amounts.is_empty() && top_expense_categories.is_empty() {
        return String::new();
    }

    let mut lines = vec![
        "Contexte local adaptatif (calculé automatiquement à partir de l'historique réel de cette entreprise — usage interne, ne jamais le citer littéralement comme provenant d'un \"contexte système\") :".to_string(),
    ];
    if !top_clients.is_empty() {
        let names: Vec<String> = top_clients.iter().map(|(n, c)| format!("{} ({} factures)", n, c)).collect();
        lines.push(format!("- Clients les plus fréquents : {}", names.join(", ")));
    }
    if let Some(amount) = typical_amount {
        lines.push(format!("- Montant de facture typique (médiane récente) : {}", format_dzd(amount)));
    }
    if !top_expense_categories.is_empty() {
        let cats: Vec<String> = top_expense_categories.iter().map(|(c, t)| format!("{} ({} sur 90j)", c, format_dzd(*t))).collect();
        lines.push(format!("- Catégories de dépenses récurrentes : {}", cats.join(", ")));
    }
    lines.push("Utilise ce contexte pour des suggestions plus pertinentes (ex: proposer un client fréquent, un montant habituel, ou repérer une dépense qui sort de la tendance) — intègre-le naturellement dans tes réponses.".to_string());

    lines.join("\n")
}

fn format_dzd(amount: f64) -> String {
    format!("{:.2} DZD", amount)
}

/// Cache-aware entry point — rebuilds only when the cache is empty, stale
/// (older than LOCAL_CONTEXT_TTL), or belongs to a different company than
/// the one currently active (relevant if the single-enterprise lock is ever
/// lifted; harmless dead branch otherwise).
fn get_local_context_snippet(conn: &Connection) -> String {
    let company_id = match default_company_id(conn) {
        Ok(id) => id,
        Err(_) => return String::new(),
    };

    let cache = LOCAL_CONTEXT_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cache.lock() {
        if let Some(cached) = guard.as_ref() {
            if cached.company_id == company_id && cached.built_at.elapsed() < LOCAL_CONTEXT_TTL {
                return cached.snippet.clone();
            }
        }
    }

    let snippet = build_local_context_snippet(conn, &company_id);

    if let Ok(mut guard) = cache.lock() {
        *guard = Some(LocalContextCache { company_id, snippet: snippet.clone(), built_at: std::time::Instant::now() });
    }

    snippet
}

/// Sends the conversation to OpenRouter, resolving any tool calls the model
/// makes against the local database in between, and returns the final
/// assistant message. `api_key` and `model` come from the frontend's own
/// read of the `settings` table (see InvoiceCustomizeDrawer.tsx's pattern —
/// secrets/preferences live in that generic key-value store, not a
/// dedicated column), not from anything persisted by this module.
#[tauri::command]
pub async fn sordi_iq_chat(
    db: State<'_, Mutex<Connection>>,
    api_key: String,
    model: Option<String>,
    messages: Vec<SordiIqMessage>,
) -> Result<SordiIqMessage, String> {
    // No key configured at all — never even attempt the network, go
    // straight to the local fallback engine (item 1: "intercept the
    // incoming chat query" before any API call is made).
    if api_key.trim().is_empty() {
        let conn = db.lock().map_err(|e| e.to_string())?;
        return Ok(build_local_fallback_response(&conn, &messages));
    }

    let model = model.filter(|m| !m.trim().is_empty()).unwrap_or_else(|| DEFAULT_MODEL.to_string());
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let mut conversation = messages;
    if conversation.first().map(|m| m.role.as_str()) != Some("system") {
        conversation.insert(
            0,
            SordiIqMessage { role: "system".to_string(), content: Some(SYSTEM_PROMPT.to_string()), tool_calls: None, tool_call_id: None },
        );

        // Local self-learning context — a second system message, inserted
        // only on a genuinely new conversation (never re-injected on every
        // turn of an ongoing one, since the base system message above is
        // itself only added once here). Scoped lock, released before this
        // function's first .await below — see the MutexGuard-across-await
        // note elsewhere in this file (e.g. the tool-call loop).
        let local_context = {
            let conn = db.lock().map_err(|e| e.to_string())?;
            get_local_context_snippet(&conn)
        };
        if !local_context.is_empty() {
            conversation.insert(
                1,
                SordiIqMessage { role: "system".to_string(), content: Some(local_context), tool_calls: None, tool_call_id: None },
            );
        }
    }

    let tools = tool_definitions();

    for _ in 0..MAX_TOOL_ITERATIONS {
        let body = OpenRouterRequest { model: &model, messages: &conversation, tools: &tools, tool_choice: "auto", temperature: 0.3, max_tokens: MAX_RESPONSE_TOKENS };

        let send_result = client
            .post(OPENROUTER_URL)
            .bearer_auth(&api_key)
            .header("HTTP-Referer", "https://sordi.app")
            .header("X-Title", "Sordi IQ")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await;

        // Network failure (no connectivity, DNS, timeout, ...) — fall back
        // locally instead of erroring out. This is the "offline" half of
        // item 1; the "no API key" half is handled above, before the loop.
        let resp = match send_result {
            Ok(resp) => resp,
            Err(e) => {
                eprintln!("Sordi IQ: network error reaching OpenRouter: {}", e);
                let conn = db.lock().map_err(|e| e.to_string())?;
                return Ok(build_local_fallback_response(&conn, &conversation));
            }
        };

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            // The raw response body (often a multi-line JSON error object)
            // is logged server-side only — NEVER returned to the frontend.
            eprintln!("Sordi IQ: OpenRouter chat request failed ({}): {}", status.as_u16(), text);
            // 401/402/403 are configuration problems (bad key, no credit,
            // refused access) — genuinely "no working cloud access right
            // now", so fall back locally rather than just erroring, same as
            // a network failure. Other statuses (404 bad model, 429 rate
            // limit, 5xx) are surfaced as an explicit error instead: those
            // are transient/config issues the user should actually see and
            // fix (e.g. picking a valid model), not silently paper over
            // with a degraded local answer every time.
            if matches!(status.as_u16(), 401 | 402 | 403) {
                let conn = db.lock().map_err(|e| e.to_string())?;
                return Ok(build_local_fallback_response(&conn, &conversation));
            }
            // A specific, actionable message per status code — surfaced
            // as-is in the chat UI (see SordiIQ.tsx's catch block), so the
            // user sees "Modèle introuvable" instead of a raw 404 blob.
            let reason = match status.as_u16() {
                404 => "Modèle introuvable sur OpenRouter — vérifiez le nom du modèle sélectionné",
                429 => "Trop de requêtes envoyées à OpenRouter — réessayez dans quelques instants",
                _ if status.is_server_error() => "OpenRouter rencontre un problème temporaire — réessayez plus tard",
                _ => "Erreur de l'API OpenRouter",
            };
            return Err(format!("{} (HTTP {})", reason, status.as_u16()));
        }

        let parsed: OpenRouterResponse = resp.json().await.map_err(|e| format!("Réponse invalide de Sordi IQ: {}", e))?;
        let message = parsed
            .choices
            .into_iter()
            .next()
            .map(|c| c.message)
            .ok_or_else(|| "Réponse vide de Sordi IQ.".to_string())?;

        match message.tool_calls {
            Some(tool_calls) if !tool_calls.is_empty() => {
                // A write-tool call (create_client/create_supplier/
                // create_invoice/create_expense) is never resolved here —
                // it's returned to the frontend as-is so SordiIQ.tsx can run
                // the real mutation hook and append its own confirmation
                // bubble (see WRITE_TOOL_NAMES/is_write_tool's own note).
                // Simplification: if a batch mixes a write call with read
                // calls in the same turn, the whole batch is handed back
                // unresolved rather than partially executing it — models
                // essentially never do this in practice for these prompts.
                if tool_calls.iter().any(|c| is_write_tool(&c.function.name)) {
                    // Security gate — checked here, in the dispatcher itself,
                    // not left solely to the frontend's own useLicenseGate
                    // proactive check or to the eventual create_client/
                    // create_invoice/create_supplier/create_expense command
                    // each draft resolves to (both of which already enforce
                    // this too — this is deliberate defense-in-depth, not a
                    // replacement for either). An expired/inactive license
                    // never even reaches the draft-card review step: the
                    // model is told plainly, in the chat, that the write was
                    // refused, with no tool_calls on the message at all so
                    // the frontend renders it as an ordinary text bubble
                    // rather than an editable draft it could confirm anyway.
                    if crate::license::require_active_license().is_err() {
                        return Ok(SordiIqMessage {
                            role: "assistant".to_string(),
                            content: Some(
                                "La licence est expirée. L'assistant ne peut pas effectuer d'opérations d'écriture. Veuillez activer votre licence pour continuer.".to_string(),
                            ),
                            tool_calls: None,
                            tool_call_id: None,
                        });
                    }

                    return Ok(SordiIqMessage {
                        role: "assistant".to_string(),
                        content: message.content,
                        tool_calls: Some(tool_calls),
                        tool_call_id: None,
                    });
                }

                conversation.push(SordiIqMessage {
                    role: "assistant".to_string(),
                    content: message.content,
                    tool_calls: Some(tool_calls.clone()),
                    tool_call_id: None,
                });

                for call in &tool_calls {
                    let args: Value = serde_json::from_str(&call.function.arguments).unwrap_or_else(|_| json!({}));
                    // Scoped lock — released before the next loop iteration's
                    // .await, never held across it (rusqlite::Connection/
                    // MutexGuard aren't Send; see telemetry.rs's own note on
                    // this exact constraint).
                    let result = {
                        let conn = db.lock().map_err(|e| e.to_string())?;
                        run_tool(&conn, &call.function.name, &args)
                    };
                    let result_value = result.unwrap_or_else(|e| json!({ "error": e }));
                    conversation.push(SordiIqMessage {
                        role: "tool".to_string(),
                        content: Some(result_value.to_string()),
                        tool_calls: None,
                        tool_call_id: Some(call.id.clone()),
                    });
                }
            }
            _ => {
                return Ok(SordiIqMessage { role: "assistant".to_string(), content: message.content, tool_calls: None, tool_call_id: None });
            }
        }
    }

    Err("Trop d'appels d'outils enchaînés — réponse interrompue.".to_string())
}

#[derive(Serialize, Debug, Clone)]
pub struct SordiIqModelOption {
    pub id: String,
    pub name: String,
}

#[derive(Deserialize)]
struct OpenRouterModelEntry {
    id: String,
    name: String,
}

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModelEntry>,
}

/// Live model catalog for the Settings dialog's dropdown — replaces a
/// hardcoded model list (which drifts out of date and invites typos) with
/// whatever OpenRouter actually serves right now. The endpoint itself is
/// public and doesn't strictly require a key, but the key is sent anyway
/// (same headers as sordi_iq_chat) since it's the one the user is about to
/// use, and a bad/expired key should fail here — in the settings dialog,
/// with a clear message — rather than surfacing for the first time mid-chat.
#[tauri::command]
pub async fn sordi_iq_list_models(api_key: String) -> Result<Vec<SordiIqModelOption>, String> {
    if api_key.trim().is_empty() {
        return Err("Clé API OpenRouter manquante.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(OPENROUTER_MODELS_URL)
        .bearer_auth(&api_key)
        .header("HTTP-Referer", "https://sordi.app")
        .header("X-Title", "Sordi IQ")
        .send()
        .await
        .map_err(|e| format!("Erreur réseau lors de la récupération des modèles: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        // Logged server-side only — never returned to the frontend, same
        // reasoning as sordi_iq_chat's own error path above.
        eprintln!("Sordi IQ: OpenRouter models request failed ({}): {}", status.as_u16(), text);
        let reason = match status.as_u16() {
            401 => "Clé API OpenRouter invalide ou expirée",
            403 => "Accès refusé par OpenRouter pour cette clé API",
            429 => "Trop de requêtes envoyées à OpenRouter — réessayez dans quelques instants",
            _ if status.is_server_error() => "OpenRouter rencontre un problème temporaire — réessayez plus tard",
            _ => "Impossible de récupérer la liste des modèles OpenRouter",
        };
        return Err(format!("{} (HTTP {})", reason, status.as_u16()));
    }

    let parsed: OpenRouterModelsResponse = resp
        .json()
        .await
        .map_err(|e| format!("Réponse invalide de la liste des modèles OpenRouter: {}", e))?;

    let mut models: Vec<SordiIqModelOption> = parsed
        .data
        .into_iter()
        .map(|m| SordiIqModelOption { id: m.id, name: m.name })
        .collect();
    models.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(models)
}

// ---------------------------------------------------------------------------
// Chat session history — the sidebar's "past queries" list (Sordi IQ's own
// UI, not the sidebar/Sordi.app nav). Each session is one row in
// sordi_iq_sessions (see database.rs), storing the full turn history as a
// JSON blob (see that table's own doc comment for why). Only user/assistant
// turns are ever persisted here — tool-call plumbing messages stay
// transient, inside sordi_iq_chat's own in-memory conversation array, never
// written to disk (the frontend only ever sends/stores the visible
// user/assistant turns, matching pages/SordiIQ.tsx's own ChatMessage shape).

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SordiIqStoredMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct SordiIqSessionSummary {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    /// So the sidebar can show a one-line preview without fetching the full
    /// session (see get_sordi_iq_session for that).
    pub last_message_preview: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct SordiIqSession {
    pub id: String,
    pub title: String,
    pub messages: Vec<SordiIqStoredMessage>,
    pub created_at: String,
    pub updated_at: String,
}

fn preview_of(messages: &[SordiIqStoredMessage]) -> Option<String> {
    messages.last().map(|m| {
        let text = m.content.trim();
        if text.chars().count() > 80 {
            format!("{}…", text.chars().take(80).collect::<String>())
        } else {
            text.to_string()
        }
    })
}

/// List of past sessions for the sidebar — title, timestamps, and a short
/// preview only, never the full message history (kept light since the
/// sidebar renders every session's row at once).
#[tauri::command]
pub fn get_sordi_iq_sessions(db: State<'_, Mutex<Connection>>) -> Result<Vec<SordiIqSessionSummary>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let company_id = default_company_id(&conn)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, messages_json, created_at, updated_at FROM sordi_iq_sessions \
             WHERE company_id = ?1 ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![company_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(id, title, messages_json, created_at, updated_at)| {
            let messages: Vec<SordiIqStoredMessage> = serde_json::from_str(&messages_json).unwrap_or_default();
            SordiIqSessionSummary { id, title, created_at, updated_at, last_message_preview: preview_of(&messages) }
        })
        .collect();

    Ok(rows)
}

/// Full message history for one session — fetched when the user clicks it
/// in the sidebar.
#[tauri::command]
pub fn get_sordi_iq_session(db: State<'_, Mutex<Connection>>, id: String) -> Result<SordiIqSession, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, title, messages_json, created_at, updated_at FROM sordi_iq_sessions WHERE id = ?1",
        params![id],
        |r| {
            let messages_json: String = r.get(2)?;
            Ok(SordiIqSession {
                id: r.get(0)?,
                title: r.get(1)?,
                messages: serde_json::from_str(&messages_json).unwrap_or_default(),
                created_at: r.get(3)?,
                updated_at: r.get(4)?,
            })
        },
    )
    .map_err(|e| format!("Session Sordi IQ introuvable: {}", e))
}

/// Creates a new, empty session — used by the sidebar's "+ Nouvelle
/// conversation" button, immediately, before any message is sent (so the
/// new session is selectable/navigable right away).
#[tauri::command]
pub fn create_sordi_iq_session(db: State<'_, Mutex<Connection>>) -> Result<SordiIqSessionSummary, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let company_id = default_company_id(&conn)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let title = "Nouvelle conversation".to_string();

    conn.execute(
        "INSERT INTO sordi_iq_sessions (id, company_id, title, messages_json, created_at, updated_at) VALUES (?1, ?2, ?3, '[]', ?4, ?4)",
        params![id, company_id, title, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(SordiIqSessionSummary { id, title, created_at: now.clone(), updated_at: now, last_message_preview: None })
}

/// The first ~48 characters of the first user message, used to auto-title a
/// session the first time it's saved with real content — mirrors how most
/// chat products title a new conversation, so the sidebar never just shows
/// a wall of "Nouvelle conversation" rows.
fn derive_title(messages: &[SordiIqStoredMessage]) -> Option<String> {
    let first_user = messages.iter().find(|m| m.role == "user")?;
    let text = first_user.content.trim();
    if text.is_empty() {
        return None;
    }
    let truncated: String = text.chars().take(48).collect();
    Some(if text.chars().count() > 48 { format!("{}…", truncated) } else { truncated })
}

/// Persists the full turn history for a session after each exchange —
/// called by the frontend right after sordi_iq_chat resolves. Auto-titles
/// the session from the first user message the first time it has one
/// (never re-titles after that, so a user's own rename — if that's ever
/// added — or the auto-title from turn 1 both stick).
#[tauri::command]
pub fn save_sordi_iq_session_messages(
    db: State<'_, Mutex<Connection>>,
    id: String,
    messages: Vec<SordiIqStoredMessage>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let messages_json = serde_json::to_string(&messages).map_err(|e| e.to_string())?;

    let current_title: String = conn
        .query_row("SELECT title FROM sordi_iq_sessions WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| format!("Session Sordi IQ introuvable: {}", e))?;

    let title = if current_title == "Nouvelle conversation" {
        derive_title(&messages).unwrap_or(current_title)
    } else {
        current_title
    };

    conn.execute(
        "UPDATE sordi_iq_sessions SET messages_json = ?1, title = ?2, updated_at = ?3 WHERE id = ?4",
        params![messages_json, title, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_sordi_iq_session(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sordi_iq_sessions WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}
