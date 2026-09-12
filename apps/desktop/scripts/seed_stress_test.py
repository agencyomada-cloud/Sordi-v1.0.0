#!/usr/bin/env python3
"""
Sordi dev-database realistic data seeder.

SAFETY: this script will refuse to run against anything whose basename is
not EXACTLY "database-dev.db". It never touches the production
"database.db" file, even though both live in the same app-data directory.

Usage:
    python3 seed_stress_test.py            # clears demo data and reseeds
    python3 seed_stress_test.py --reset    # same thing (alias, for clarity)

The script wraps the entire clear+seed sequence in one transaction so it
is atomic and fast (sub-second). It never touches schema (no CREATE/DROP/
ALTER) — only DELETE/UPDATE/INSERT against existing tables.
"""
import json
import os
import random
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# 0. Locate + verify the dev database path (hard safety guard)
# ---------------------------------------------------------------------------

APP_DATA_DIR = os.path.expanduser(
    "~/Library/Application Support/com.sordi.app"
)
DB_PATH = os.path.join(APP_DATA_DIR, "database-dev.db")

if os.path.basename(DB_PATH) != "database-dev.db":
    sys.exit("REFUSING: resolved path does not have basename 'database-dev.db'")
if not os.path.isfile(DB_PATH):
    sys.exit(f"REFUSING: dev database not found at {DB_PATH}")

print(f"Target database (verified dev-only): {DB_PATH}")

random.seed(42)

NOW = datetime.now()


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000000+00:00")


def day(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# 1. Static reference data
# ---------------------------------------------------------------------------

COMPANY_ID = "182bab8f-2b19-44c4-b4dc-49a3fe9558d3"

COMPANY_PROFILE = {
    "name": "ATLAS DIGITAL SOLUTIONS",
    "legal_form": "SARL",
    "capital": "1 000 000,00 DA",
    "address": "14 Boulevard Colonel Amirouche, Alger Centre, 16000 Alger",
    "phone": "+213 (0) 23 45 67 89",
    "phones": json.dumps(["+213 (0) 23 45 67 89"]),
    "email": "contact@atlas-digital.dz",
    "website": "",
    "nif": "001916012345678",
    "nis": "099816010012345",
    "rc": "16/00-0987654B20",
    "article_imposition": "16012345678",
    "rib": "001 00624 0300012345 88",
    "bank_agency": "BNA (Banque Nationale d'Algérie) - Agence Didouche Mourad",
    "activity": "Services numériques, conseil & développement web",
    "cnas_adherent": "",
    "extra_info": json.dumps([]),
}

WILAYAS = [
    "Alger", "Oran", "Constantine", "Sétif", "Annaba", "Blida", "Batna",
    "Tlemcen", "Béjaïa", "Tizi Ouzou", "Boumerdès", "Skikda", "Chlef",
    "Mostaganem", "Bouira",
]

CITY_BY_WILAYA = {
    "Alger": ["Alger Centre", "Hydra", "Bab Ezzouar", "El Biar", "Kouba"],
    "Oran": ["Oran", "Es Senia", "Bir El Djir"],
    "Constantine": ["Constantine", "El Khroub"],
    "Sétif": ["Sétif", "El Eulma"],
    "Annaba": ["Annaba"],
    "Blida": ["Blida", "Boufarik"],
    "Batna": ["Batna"],
    "Tlemcen": ["Tlemcen"],
    "Béjaïa": ["Béjaïa", "Akbou"],
    "Tizi Ouzou": ["Tizi Ouzou"],
    "Boumerdès": ["Boumerdès"],
    "Skikda": ["Skikda"],
    "Chlef": ["Chlef"],
    "Mostaganem": ["Mostaganem"],
    "Bouira": ["Bouira"],
}

CLIENT_LEGAL_FORMS = ["SARL", "EURL", "SPA"]

CLIENT_NAME_STEMS = [
    "Nour Tech", "Atlas Média", "Elite Consulting", "Digital Vision", "Kahina Trade",
    "Sahara Web", "Numidia Solutions", "Amazigh Group", "Rif Communication", "Casbah Design",
    "El Djazair Services", "Maghreb Digital", "Tell Innovation", "Meridien Business",
    "Horizon Corp", "Zenith Group", "Novatech", "Prestige Trading", "Alger Business Center",
    "Batna Industries", "Sétif Agro", "Oran Import Export", "Constantine Bâtiment",
    "Média Plus", "Web Factory", "SmartCom", "Data Vision", "Cyber Atlas", "Green Tech DZ",
    "Blue Ocean Trading", "Solaris Énergie", "Phoenix Distribution", "Alpha Négoce",
    "Delta Construction", "Fenix Marketing", "Orient Express Logistique", "Golden Palm Hôtel",
    "Silver Line Transport", "Diamond Retail", "Emerald Consulting", "Prime Immobilier",
    "Nexa Systems", "Vega Software", "Orion Studio", "Atlas Print", "Kabylie Artisanat",
    "Sahel Agro Business", "Djurdjura Export", "Sirocco Events", "Palmeraie Hôtellerie",
    "Ksar Design", "Casbah Café Group", "Tafat Éclairage", "Anza Pharma", "Ryma Cosmetics",
    "Yasmine Boutique", "Aghna Musique Prod", "Iris Optique", "Lumière Studio Photo",
    "Cèdre Bâtiment", "Oasis Voyage",
]

INDIVIDUAL_FIRST = ["Karim", "Sofiane", "Amine", "Yacine", "Nadia", "Sarah", "Leïla", "Fatima",
                    "Mohamed", "Ahmed", "Rachid", "Samir", "Riad", "Hakim", "Nassim"]
INDIVIDUAL_LAST = ["Benali", "Meziane", "Haddad", "Belkacem", "Cherif", "Bouzid", "Amrani",
                   "Ferhat", "Boudiaf", "Larbi", "Saidi", "Guerroudj", "Mansouri"]

PAYMENT_TERMS_OPTIONS = [0, 15, 30, 60]

PRODUCTS_SPEC = [
    # (name, description, unit, unit_price, tva_rate)
    ("Abonnement Maintenance Site Web - Mensuel", "Maintenance corrective + mises à jour mensuelles", "Abonnement Mensuel", 15000, 19),
    ("Abonnement Hébergement Cloud - Standard", "Hébergement VPS mutualisé mensuel", "Abonnement Mensuel", 8000, 19),
    ("Abonnement Hébergement Cloud - Premium", "VPS dédié + sauvegardes quotidiennes", "Abonnement Mensuel", 22000, 19),
    ("Abonnement Community Management - Mensuel", "Gestion réseaux sociaux (3 plateformes)", "Abonnement Mensuel", 35000, 19),
    ("Abonnement Support Technique Prioritaire", "Support niveau 1/2 avec SLA 24h", "Abonnement Mensuel", 12000, 19),
    ("Retainer Conseil Stratégie Digitale", "Accompagnement mensuel conseil digital", "Abonnement Mensuel", 60000, 19),
    ("Pack Branding Complet", "Logo, charte graphique, guidelines", "Forfait / Projet", 120000, 19),
    ("Pack Identité Visuelle Starter", "Logo + carte de visite + en-tête", "Forfait / Projet", 45000, 19),
    ("Refonte Charte Graphique", "Modernisation identité existante", "Forfait / Projet", 75000, 19),
    ("Développement Site Vitrine", "Site 5 pages responsive", "Forfait / Projet", 150000, 19),
    ("Développement Site E-commerce", "Boutique en ligne complète", "Forfait / Projet", 350000, 19),
    ("Développement Application Web Sur-Mesure", "Application métier full-stack", "Forfait / Projet", 600000, 19),
    ("Développement API REST", "API backend documentée", "Forfait / Projet", 200000, 19),
    ("Audit SEO Complet", "Analyse technique + recommandations", "Forfait / Projet", 40000, 19),
    ("Campagne SEA Google Ads - Setup", "Configuration + optimisation campagne", "Forfait / Projet", 30000, 19),
    ("Formation Équipe - Outils Digitaux", "Session de formation 1 jour", "Forfait / Projet", 50000, 9),
    ("Formation WordPress Utilisateur", "Formation prise en main CMS", "Forfait / Projet", 25000, 9),
    ("Conception UX/UI - Application Mobile", "Maquettes Figma complètes", "Forfait / Projet", 180000, 19),
    ("Motion Design - Vidéo Promotionnelle", "Vidéo animée 60 secondes", "Forfait / Projet", 90000, 19),
    ("Shooting Photo Produits", "Séance photo studio (jusqu'à 30 produits)", "Forfait / Projet", 35000, 19),
    ("Développement Heure Supplémentaire - Dev", "Heure de développement additionnelle", "Heure", 4500, 19),
    ("Consulting Heure - Stratégie", "Heure de conseil stratégique", "Heure", 6000, 19),
    ("Design Heure - Graphiste", "Heure de conception graphique", "Heure", 3500, 19),
    ("Rédaction Heure - Contenu Web", "Heure de rédaction de contenu", "Heure", 3000, 9),
    ("Support Technique Heure - Hors Contrat", "Intervention technique ponctuelle", "Heure", 4000, 19),
    ("Cartes de Visite Premium (x1000)", "Impression carte de visite pelliculée", "Unité", 6000, 19),
    ("Flyers A5 Recto-Verso (x500)", "Impression flyers publicitaires", "Unité", 8500, 19),
    ("Brochures A4 Pliées (x200)", "Impression brochure institutionnelle", "Unité", 15000, 19),
    ("Banderole Publicitaire (2x1m)", "Impression grand format extérieur", "Unité", 5000, 19),
    ("Roll-Up Publicitaire", "Support d'exposition enroulable", "Unité", 12000, 19),
    ("Enseigne Lumineuse - Petit Format", "Fabrication enseigne LED", "Unité", 45000, 19),
    ("Ordinateur Portable Pro - Config Standard", "Poste de travail développeur", "Unité", 220000, 19),
    ("Écran 27\" Professionnel", "Moniteur haute résolution", "Unité", 55000, 19),
    ("Licence Logiciel Design - Annuelle", "Licence suite créative annuelle", "Unité", 38000, 0),
    ("Nom de Domaine - Enregistrement Annuel", "Réservation domaine .dz / .com", "Unité", 3500, 0),
    ("Certificat SSL - Annuel", "Certificat de sécurité HTTPS", "Unité", 4500, 0),
    ("Licence Antivirus Entreprise - Annuelle", "Protection poste de travail", "Unité", 9000, 9),
    ("Clé USB Personnalisée (x50)", "Goodies entreprise personnalisés", "Unité", 22000, 19),
    ("Prestation Impression Grand Format", "Bâche publicitaire sur mesure", "Unité", 18000, 19),
    ("Pack Réseaux Sociaux - Création Visuels (x30)", "Création de visuels mensuels", "Forfait / Projet", 28000, 19),
]

EXPENSE_CATEGORIES = [
    "Salaires", "Loyer", "Hébergement / Cloud VPS", "Matériel & Outils",
    "Marketing", "Électricité", "Eau", "Fournitures de bureau",
]

EXPENSE_DESCRIPTIONS = {
    "Salaires": ["Salaire net mensuel - équipe technique", "Salaire net mensuel - équipe commerciale", "Prime de performance", "Salaire net mensuel - direction"],
    "Loyer": ["Loyer mensuel bureau Alger Centre", "Charges de copropriété"],
    "Hébergement / Cloud VPS": ["Facture hébergement AWS", "Facture VPS OVH", "Renouvellement nom de domaine", "Abonnement stockage cloud"],
    "Matériel & Outils": ["Achat licence logicielle", "Réparation matériel informatique", "Achat périphérique bureau", "Maintenance parc informatique"],
    "Marketing": ["Campagne publicitaire Facebook Ads", "Campagne Google Ads", "Impression supports marketing", "Frais influenceur / partenariat"],
    "Électricité": ["Facture Sonelgaz - électricité bureau"],
    "Eau": ["Facture SEAAL - eau bureau"],
    "Fournitures de bureau": ["Achat fournitures papeterie", "Consommables imprimante", "Achat mobilier de bureau"],
}

PAYMENT_METHODS = ["virement", "cheque", "especes", "carte"]

ACTIVITY_TITLES = {
    "call": ["Appel de relance paiement", "Appel de suivi commercial", "Appel qualification besoin"],
    "email": ["Envoi relance facture par email", "Email de suivi proposition", "Email confirmation livraison"],
    "meeting": ["Réunion présentation projet", "Réunion de cadrage", "Rendez-vous signature contrat"],
    "todo": ["Préparer devis personnalisé", "Vérifier statut paiement", "Mettre à jour dossier client"],
}


def random_wilaya_city():
    w = random.choice(WILAYAS)
    c = random.choice(CITY_BY_WILAYA[w])
    return w, c


def gen_nif():
    return "".join(str(random.randint(0, 9)) for _ in range(15))


def gen_nis():
    return "".join(str(random.randint(0, 9)) for _ in range(15))


def gen_rc(wilaya_code: str):
    return f"{wilaya_code}/00-{random.randint(1000000, 9999999)}{random.choice('ABCD')}{random.randint(10,25)}"


WILAYA_CODES = {
    "Alger": "16", "Oran": "31", "Constantine": "25", "Sétif": "19", "Annaba": "23",
    "Blida": "09", "Batna": "05", "Tlemcen": "13", "Béjaïa": "06", "Tizi Ouzou": "15",
    "Boumerdès": "35", "Skikda": "21", "Chlef": "02", "Mostaganem": "27", "Bouira": "10",
}


def timbre_for(subtotal_ht: float, payment_method: str) -> float:
    if payment_method == "especes":
        return min(2500, round(subtotal_ht * 0.01))
    return 0.0


# ---------------------------------------------------------------------------
# 2. Connect + seed inside one transaction
# ---------------------------------------------------------------------------

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")
cur = conn.cursor()

try:
    cur.execute("BEGIN")

    # --- 2.0 Clear previous demo data (FK-safe order), schema untouched ---
    cur.execute("DELETE FROM activities")
    cur.execute("DELETE FROM payments")
    cur.execute("DELETE FROM delivery_notes")
    cur.execute("DELETE FROM invoice_items")
    cur.execute("DELETE FROM invoices")
    cur.execute("DELETE FROM partner_withdrawals")
    cur.execute("DELETE FROM partners")
    cur.execute("DELETE FROM expenses")
    cur.execute("DELETE FROM clients")
    cur.execute("DELETE FROM products")

    # --- 2.1 Company settings profile ---
    cur.execute(
        """UPDATE companies SET
            name = ?, legal_form = ?, capital = ?, address = ?, phone = ?, phones = ?,
            email = ?, website = ?, nif = ?, nis = ?, rc = ?, article_imposition = ?,
            rib = ?, bank_agency = ?, activity = ?, cnas_adherent = ?, extra_info = ?
           WHERE id = ?""",
        (
            COMPANY_PROFILE["name"], COMPANY_PROFILE["legal_form"], COMPANY_PROFILE["capital"],
            COMPANY_PROFILE["address"], COMPANY_PROFILE["phone"], COMPANY_PROFILE["phones"],
            COMPANY_PROFILE["email"], COMPANY_PROFILE["website"], COMPANY_PROFILE["nif"],
            COMPANY_PROFILE["nis"], COMPANY_PROFILE["rc"], COMPANY_PROFILE["article_imposition"],
            COMPANY_PROFILE["rib"], COMPANY_PROFILE["bank_agency"], COMPANY_PROFILE["activity"],
            COMPANY_PROFILE["cnas_adherent"], COMPANY_PROFILE["extra_info"], COMPANY_ID,
        ),
    )

    # --- 2.2 Partners (2, 50/50) + withdrawals ---
    partner_names = ["Karim Bensalah", "Yasmine Boudraa"]
    partner_ids = []
    for name in partner_names:
        pid = new_id()
        partner_ids.append(pid)
        cur.execute(
            """INSERT INTO partners (id, name, email, phone, role, equity_percentage,
                is_active, created_at, updated_at, company_id)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
            (
                pid, name,
                name.lower().replace(" ", ".") + "@atlas-digital.dz",
                f"+213 5{random.randint(50,79)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}",
                "Associé Gérant" if name == partner_names[0] else "Associée",
                50.0,
                iso(NOW - timedelta(days=400)), iso(NOW - timedelta(days=400)), COMPANY_ID,
            ),
        )

    # monthly withdrawals for the past 10 months, both partners
    for m in range(10, 0, -1):
        wdate = NOW - timedelta(days=30 * m)
        for pid in partner_ids:
            cur.execute(
                """INSERT INTO partner_withdrawals (id, partner_id, withdrawal_date, amount,
                    payment_method, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    new_id(), pid, day(wdate), random.choice([60000, 70000, 80000, 90000, 100000]),
                    random.choice(PAYMENT_METHODS), "Retrait mensuel", iso(wdate),
                ),
            )
    # occasional dividend distributions
    for m in [8, 4]:
        ddate = NOW - timedelta(days=30 * m)
        for pid in partner_ids:
            cur.execute(
                """INSERT INTO partner_withdrawals (id, partner_id, withdrawal_date, amount,
                    payment_method, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    new_id(), pid, day(ddate), random.choice([150000, 200000, 250000]),
                    "virement", "Distribution de dividendes", iso(ddate),
                ),
            )

    # --- 2.3 Products (40) ---
    product_ids = []
    for i, (name, desc, unit, price, tva) in enumerate(PRODUCTS_SPEC, start=1):
        pid = new_id()
        product_ids.append((pid, name, price, tva))
        cur.execute(
            """INSERT INTO products (id, code, name, description, unit, unit_price,
                timbre_exempt, is_active, display_order, created_at, updated_at, tva_rate, company_id)
               VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)""",
            (
                pid, f"PRD-{i:03d}", name, desc, unit, price, i,
                iso(NOW - timedelta(days=300)), iso(NOW - timedelta(days=300)), tva, COMPANY_ID,
            ),
        )

    # --- 2.4 Clients (100) ---
    client_ids = []
    used_names = set()
    for i in range(100):
        is_company = i < 80  # 80 companies, 20 individuals
        wilaya, city = random_wilaya_city()
        code = WILAYA_CODES[wilaya]
        cid = new_id()
        if is_company:
            stem = CLIENT_NAME_STEMS[i % len(CLIENT_NAME_STEMS)]
            suffix = f" {i // len(CLIENT_NAME_STEMS) + 1}" if stem in used_names else ""
            used_names.add(stem)
            form = random.choice(CLIENT_LEGAL_FORMS)
            name = f"{stem}{suffix} {form}"
            nif, nis, rc, ai = gen_nif(), gen_nis(), gen_rc(code), str(random.randint(10**14, 10**15 - 1))
            activite = "Prestation de services"
            contact = random.choice(INDIVIDUAL_FIRST) + " " + random.choice(INDIVIDUAL_LAST)
        else:
            first, last = random.choice(INDIVIDUAL_FIRST), random.choice(INDIVIDUAL_LAST)
            name = f"{first} {last}"
            nif, nis, rc, ai = gen_nif(), "", "", ""
            activite = "Activité commerciale individuelle"
            contact = name

        client_ids.append(cid)
        cur.execute(
            """INSERT INTO clients (id, code, name, contact_person, phone, email, address,
                city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite,
                credit_limit, payment_terms_days, notes, is_active, created_at, updated_at,
                initial_balance, advance_payment, company_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, 1, ?, ?, 0, 0, ?)""",
            (
                cid, f"CLI-{i+1:04d}", name, contact,
                f"+213 {random.choice(['5','6','7'])}{random.randint(1,9)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}",
                f"contact{i+1}@{name.split()[0].lower().replace('é','e').replace('è','e')}.dz",
                f"{random.randint(1,150)} Rue {random.choice(['des Frères Bouadou','Larbi Ben Mhidi','Didouche Mourad','de l Indépendance','Emir Abdelkader'])}, {city}",
                city, wilaya, nif, nis, rc, ai, activite,
                random.choice([0, 200000, 500000, 1000000]),
                random.choice(PAYMENT_TERMS_OPTIONS),
                iso(NOW - timedelta(days=random.randint(30, 380))),
                iso(NOW - timedelta(days=random.randint(1, 29))),
                COMPANY_ID,
            ),
        )

    # --- 2.5 Invoices + line items (200) ---
    # Status distribution: 40% paid, 30% pending/due, 15% overdue, 10% devis, 5% avoir
    n_total = 200
    n_paid = int(n_total * 0.40)
    n_pending = int(n_total * 0.30)
    n_overdue = int(n_total * 0.15)
    n_devis = int(n_total * 0.10)
    n_avoir = n_total - n_paid - n_pending - n_overdue - n_devis  # remainder -> 5%

    plan = (
        [("paid", "invoice")] * n_paid
        + [("pending", "invoice")] * n_pending
        + [("overdue", "invoice")] * n_overdue
        + [("devis", "quote")] * n_devis
        + [("avoir", "credit_note")] * n_avoir
    )
    random.shuffle(plan)

    aging_buckets = [(1, 29), (30, 60), (61, 90), (91, 200)]
    invoice_counter = 1

    for kind, doc_type in plan:
        # spread across the past 8-12 months
        days_back = random.randint(0, 365)
        invoice_date = NOW - timedelta(days=days_back)

        client_id = random.choice(client_ids)
        payment_terms = random.choice(PAYMENT_TERMS_OPTIONS)
        due_date = invoice_date + timedelta(days=payment_terms if payment_terms else 30)

        # line items: 1-5 products
        n_items = random.randint(1, 5)
        chosen_products = random.sample(product_ids, n_items)

        subtotal_ht = 0.0
        items = []
        for pid, pname, price, tva in chosen_products:
            qty = round(random.choice([1, 1, 1, 2, 3, 5, 10]) * (1 if doc_type != "credit_note" else 1), 2)
            discount_pct = random.choice([0, 0, 0, 5, 10])
            line_price = price * (1 - discount_pct / 100.0)
            amount = round(qty * line_price, 2)
            subtotal_ht += amount
            items.append((pid, pname, qty, line_price, amount, tva))

        subtotal_ht = round(subtotal_ht, 2)
        avg_tva = round(sum(t for *_, t in items) / len(items), 2)
        tva_amount = round(subtotal_ht * avg_tva / 100.0, 2)
        payment_method = random.choice(PAYMENT_METHODS)
        timbre = timbre_for(subtotal_ht, payment_method) if doc_type == "invoice" else 0.0
        total_ttc = round(subtotal_ht + tva_amount + timbre, 2)

        if doc_type == "credit_note":
            subtotal_ht, tva_amount, timbre, total_ttc = -subtotal_ht, -tva_amount, 0.0, -total_ttc

        if kind == "paid":
            status = "paid"
            amount_paid = total_ttc
            balance_due = 0.0
        elif kind == "pending":
            status = "issued"
            amount_paid = round(total_ttc * random.choice([0, 0, 0.3, 0.5]), 2)
            balance_due = round(total_ttc - amount_paid, 2)
            due_date = NOW + timedelta(days=random.randint(1, 30))
        elif kind == "overdue":
            status = "overdue"
            amount_paid = round(total_ttc * random.choice([0, 0, 0.2]), 2)
            balance_due = round(total_ttc - amount_paid, 2)
            bucket = random.choice(aging_buckets)
            overdue_days = random.randint(bucket[0], bucket[1])
            due_date = NOW - timedelta(days=overdue_days)
            invoice_date = due_date - timedelta(days=payment_terms if payment_terms else 30)
        elif kind == "devis":
            status = "draft"
            amount_paid = 0.0
            balance_due = total_ttc
        else:  # avoir
            status = "issued"
            amount_paid = 0.0
            balance_due = total_ttc

        inv_id = new_id()
        prefix = {"invoice": "FAC", "quote": "DEV", "credit_note": "AV"}[doc_type]
        invoice_number = f"{prefix}-2026-{invoice_counter:04d}"
        invoice_counter += 1

        cur.execute(
            """INSERT INTO invoices (id, invoice_number, client_id, invoice_date, due_date,
                month_period, subtotal_ht, tva_rate, tva_amount, timbre, total_ttc,
                amount_paid, balance_due, status, invoice_type, original_invoice_id,
                notes, header_note, discount, discount_type, discount_value,
                use_secondary_register, selected_secondary_rc, selected_secondary_address,
                custom_title, created_at, updated_at, payment_method, tax_mode,
                project_id, converted_to_invoice_id, company_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0,
                'percent', 0, 0, NULL, NULL, NULL, ?, ?, ?, 'standard', NULL, NULL, ?)""",
            (
                inv_id, invoice_number, client_id, day(invoice_date), day(due_date),
                invoice_date.strftime("%Y-%m"), subtotal_ht, avg_tva, tva_amount, timbre,
                total_ttc, amount_paid, balance_due, status, doc_type,
                iso(invoice_date), iso(invoice_date), payment_method, COMPANY_ID,
            ),
        )

        for pid, pname, qty, line_price, amount, tva in items:
            signed_qty = qty if doc_type != "credit_note" else -qty
            signed_amount = amount if doc_type != "credit_note" else -amount
            cur.execute(
                """INSERT INTO invoice_items (id, invoice_id, product_id, product_name,
                    product_code, product_description, quantity, unit_price, amount,
                    tva_rate, timbre_exempt, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                (
                    new_id(), inv_id, pid, pname, None, None, signed_qty, line_price,
                    signed_amount, tva, iso(invoice_date),
                ),
            )

        # Mirror amount_paid into the payments table so cash-flow reports
        # (which aggregate payments.payment_date, not invoices.amount_paid)
        # reflect the same collected revenue.
        if amount_paid > 0:
            if kind == "paid":
                payment_date = invoice_date + timedelta(days=random.randint(0, min(payment_terms, 20) if payment_terms else 10))
            else:
                payment_date = invoice_date + timedelta(days=random.randint(1, 15))
            if payment_date > NOW:
                payment_date = NOW
            cur.execute(
                """INSERT INTO payments (id, invoice_id, payment_date, amount, payment_method,
                    cheque_number, bank_name, value_date, notes, created_at, employee_id, company_id)
                   VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, NULL, ?)""",
                (
                    new_id(), inv_id, day(payment_date), amount_paid, payment_method,
                    iso(payment_date), COMPANY_ID,
                ),
            )

    # --- 2.6 Expenses (400) ---
    for i in range(400):
        category = random.choice(EXPENSE_CATEGORIES)
        edate = NOW - timedelta(days=random.randint(0, 365))
        if category == "Salaires":
            amount = random.choice([80000, 90000, 100000, 120000, 150000])
        elif category == "Loyer":
            amount = random.choice([60000, 65000, 70000])
        elif category == "Hébergement / Cloud VPS":
            amount = random.choice([5000, 8000, 12000, 22000])
        elif category == "Matériel & Outils":
            amount = random.choice([10000, 25000, 50000, 120000])
        elif category == "Marketing":
            amount = random.choice([15000, 30000, 50000])
        elif category == "Électricité":
            amount = random.choice([4000, 6000, 8000])
        elif category == "Eau":
            amount = random.choice([1500, 2500])
        else:
            amount = random.choice([3000, 5000, 8000])

        cur.execute(
            """INSERT INTO expenses (id, expense_date, category, description, amount,
                payment_method, reference, notes, month_period, created_at, updated_at,
                project_id, is_recurring, recurrence_interval, supplier_id, is_paid, company_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)""",
            (
                new_id(), day(edate), category, random.choice(EXPENSE_DESCRIPTIONS[category]),
                amount, random.choice(PAYMENT_METHODS), f"REF-{i+1:05d}",
                edate.strftime("%Y-%m"), iso(edate), iso(edate),
                1 if category in ("Salaires", "Loyer", "Hébergement / Cloud VPS") else 0,
                random.choice([0, 1]), COMPANY_ID,
            ),
        )

    # --- 2.7 Activities (~50) ---
    cur.execute("SELECT id FROM invoices")
    invoice_id_pool = [r[0] for r in cur.fetchall()]

    for i in range(50):
        entity_type = random.choice(["client", "invoice"])
        entity_id = random.choice(client_ids) if entity_type == "client" else random.choice(invoice_id_pool)
        activity_type = random.choice(["call", "email", "meeting", "todo"])
        title = random.choice(ACTIVITY_TITLES[activity_type])

        outcome = random.choice(["done", "pending", "overdue"])
        created_at = NOW - timedelta(days=random.randint(1, 60))
        if outcome == "done":
            due = created_at + timedelta(days=random.randint(0, 5))
            done_at = iso(due)
        elif outcome == "pending":
            due = NOW + timedelta(days=random.randint(1, 20))
            done_at = None
        else:  # overdue
            due = NOW - timedelta(days=random.randint(1, 15))
            done_at = None

        cur.execute(
            """INSERT INTO activities (id, entity_type, entity_id, title, activity_type,
                due_date, done_at, notes, created_at, company_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)""",
            (
                new_id(), entity_type, entity_id, title, activity_type,
                day(due), done_at, iso(created_at), COMPANY_ID,
            ),
        )

    conn.commit()
    print("Seed committed successfully.")

except Exception:
    conn.rollback()
    raise
finally:
    conn.close()

# ---------------------------------------------------------------------------
# 3. Report
# ---------------------------------------------------------------------------

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
for t in ["companies", "partners", "partner_withdrawals", "products", "clients",
          "invoices", "invoice_items", "payments", "expenses", "activities"]:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"{t}: {cur.fetchone()[0]}")
conn.close()
