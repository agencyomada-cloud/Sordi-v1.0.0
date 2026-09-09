import {
  Company, CreateCompanyData,
  Client, CreateClientData,
  Supplier, CreateSupplierData, SupplierPurchaseTotal,
  Product, CreateProductData,
  Invoice, CreateInvoiceData, InvoiceWithClient,
  Payment, CreatePaymentData,
  ClientAdvance, CreateClientAdvanceData, UpdateClientAdvanceData,
  Order, CreateOrderData,
  DeliveryNote, CreateDeliveryNoteData,
  Expense, CreateExpenseData, UpdateExpenseData,
  Employee, CreateEmployeeData,
  Project, ProjectStats, ProjectProfitability,
  Partner, CreatePartnerData, UpdatePartnerData, PartnerFinancials,
  PartnerWithdrawal, CreateWithdrawalData,
  MonthlyBusinessReport, MonthlyReportPartnerRow, MonthlyReportProjectRow,
  ActivityLog, DashboardStats, ClientCumulativeRecord
} from "./database";

const STORAGE_PREFIX = "sordi_mock_";

// Web-preview mode has no real multi-company backend — every seed record
// belongs to this single placeholder workspace.
const MOCK_COMPANY_ID = "mock-company-default";

const DEFAULT_COMPANIES: Company[] = [
  {
    id: MOCK_COMPANY_ID,
    name: "Mon Entreprise",
    logo_base64: null,
    activity: null,
    rc: null,
    nif: null,
    nis: null,
    article_imposition: null,
    address: null,
    phone: null,
    phones: null,
    email: null,
    website: null,
    capital: null,
    rib: null,
    bank_agency: null,
    extra_info: null,
    cnas_adherent: null,
    currency: "DZD",
    invoice_prefix: "FAC-2026-",
    created_at: "2025-01-01T00:00:00Z",
  },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: "",
  company_address: "",
  company_rc: "",
  company_nif: "",
  company_nis: "",
  company_ai: "",
  company_rib: "",
  company_capital: "",
  company_bank_agency: "",
  company_website: "",
  company_phone: "",
  company_email: "",
  company_extra_info: "[]",
  primary_color: "#476CFF",
  logo_bg_color: "#000000",
  logo_text_color: "#FFFFFF",
  logo_data: "",
  logo_size: "64",
  company_info_size: "9",
  stamp_data: "",
  stamp_size: "96",
  signature_data: "",
  signature_size: "96",
  footer_logo_data: "",
  body_pattern_data: "",
  qr_code_data: "",
};

function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save mock store to localStorage", e);
  }
}

// Initial Seed Data
const INITIAL_CLIENTS: Client[] = [
  {
    id: "d2ca2c45-669d-4724-9b6e-913b1fe6d605",
    company_id: MOCK_COMPANY_ID,
    code: "CL-ALG-01",
    name: "SARL ALGERIE TELECOM SOLUTIONS",
    contact_person: "Karim Benali",
    phone: "021 68 45 12",
    email: "contact@ats-algerie.com",
    address: "Zone Industrielle Oued Smar, Lot 14",
    city: "Oued Smar",
    wilaya: "Alger (16)",
    nif: "001816098745231",
    nis: "1984160900142",
    rc: "16/00-0984123B18",
    secondary_rc: null,
    secondary_address: null,
    ai: "16091245870",
    activite: "Télécommunications & Réseaux",
    credit_limit: 5000000,
    payment_terms_days: 30,
    notes: "Client grand compte, facturation mensuelle",
    is_active: true,
    initial_balance: 0,
    advance_payment: 250000,
    created_at: "2025-01-10T09:00:00Z",
    updated_at: "2025-01-10T09:00:00Z",
  },
  {
    id: "9bb7f633-dbf7-44de-8705-4f6a588c0a45",
    company_id: MOCK_COMPANY_ID,
    code: "CL-BLI-02",
    name: "EURL ATLAS AGRO INDUSTRIE",
    contact_person: "Samir Khelifi",
    phone: "025 41 89 70",
    email: "achats@atlas-agro.dz",
    address: "Route de Chiffa, Zone d'activité",
    city: "Blida",
    wilaya: "Blida (09)",
    nif: "000909012345678",
    nis: "2001090100234",
    rc: "09/00-0456123A09",
    secondary_rc: null,
    secondary_address: null,
    ai: "09012345678",
    activite: "Agroalimentaire & Conditionnement",
    credit_limit: 3000000,
    payment_terms_days: 15,
    notes: "Paiement par virement bancaire",
    is_active: true,
    initial_balance: 150000,
    advance_payment: 0,
    created_at: "2025-01-15T10:30:00Z",
    updated_at: "2025-01-15T10:30:00Z",
  },
  {
    id: "cd154201-afbc-4b12-82f9-38cd148a6671",
    company_id: MOCK_COMPANY_ID,
    code: "CL-BBA-03",
    name: "SPA CONDOR LOGISTICS & TRANS",
    contact_person: "Amine Bouzid",
    phone: "035 68 20 00",
    email: "logistics@condor-group.dz",
    address: "Zone Industrielle El Anasser",
    city: "Bordj Bou Arreridj",
    wilaya: "Bordj Bou Arréridj (34)",
    nif: "000434019876543",
    nis: "1998340100567",
    rc: "34/00-0123789B04",
    secondary_rc: null,
    secondary_address: null,
    ai: "34019876543",
    activite: "Transport & Entreposage",
    credit_limit: 8000000,
    payment_terms_days: 45,
    notes: "Règlement par chèque de banque",
    is_active: true,
    initial_balance: 0,
    advance_payment: 500000,
    created_at: "2025-02-01T08:15:00Z",
    updated_at: "2025-02-01T08:15:00Z",
  },
  {
    id: "7284dae0-956c-4023-b2df-1931f1fd7784",
    company_id: MOCK_COMPANY_ID,
    code: "CL-ORN-04",
    name: "SARL MEDITERRANEE DISTRIBUTION",
    contact_person: "Fatima Mansouri",
    phone: "041 53 22 11",
    email: "commercial@med-distrib.com",
    address: "Boulevard Millenium, Es Senia",
    city: "Oran",
    wilaya: "Oran (31)",
    nif: "001231087654321",
    nis: "2010310800345",
    rc: "31/00-0876543B12",
    secondary_rc: null,
    secondary_address: null,
    ai: "31087654321",
    activite: "Commerce de Gros Matériel BTP",
    credit_limit: 4500000,
    payment_terms_days: 30,
    notes: "Livraison directe sur chantier",
    is_active: true,
    initial_balance: 200000,
    advance_payment: 0,
    created_at: "2025-02-10T14:00:00Z",
    updated_at: "2025-02-10T14:00:00Z",
  },
  {
    id: "f810f124-ad3a-4db5-88a8-f39916e854a8",
    company_id: MOCK_COMPANY_ID,
    code: "CL-STF-05",
    name: "ETS BENHAMADI & FILS",
    contact_person: "Mustapha Benhamadi",
    phone: "036 84 15 90",
    email: "ets.benhamadi@gmail.com",
    address: "Rue 1er Novembre, Centre Ville",
    city: "Sétif",
    wilaya: "Sétif (19)",
    nif: "197519012345678",
    nis: "1975190100123",
    rc: "19/00-0345678A75",
    secondary_rc: null,
    secondary_address: null,
    ai: "19012345678",
    activite: "Travaux Publics & Terrassement",
    credit_limit: 6000000,
    payment_terms_days: 30,
    notes: "Client régulier depuis 2021",
    is_active: true,
    initial_balance: 0,
    advance_payment: 100000,
    created_at: "2025-02-20T11:45:00Z",
    updated_at: "2025-02-20T11:45:00Z",
  },
  {
    id: "55664ee8-e0f5-4644-a06b-76fc9afea23e",
    company_id: MOCK_COMPANY_ID,
    code: "CL-BJA-06",
    name: "SARL HIGH TECH PACKAGING",
    contact_person: "Yacine Belkacemi",
    phone: "034 12 76 43",
    email: "yacine@hightechpack.dz",
    address: "Zone Industrielle Ibourassen",
    city: "Oued Ghir",
    wilaya: "Béjaïa (06)",
    nif: "001506098712345",
    nis: "2015060900456",
    rc: "06/00-0987654B15",
    secondary_rc: null,
    secondary_address: null,
    ai: "06098712345",
    activite: "Fabrication d'emballage industriel",
    credit_limit: 2500000,
    payment_terms_days: 20,
    notes: "Commandes hebdomadaires",
    is_active: true,
    initial_balance: 0,
    advance_payment: 0,
    created_at: "2025-03-01T10:00:00Z",
    updated_at: "2025-03-01T10:00:00Z",
  },
  {
    id: "5cc275d5-061d-44c8-a58c-43e629aeab72",
    company_id: MOCK_COMPANY_ID,
    code: "CL-CST-07",
    name: "EURL MAGHREB SERVICES PLUS",
    contact_person: "Nadia Chaoui",
    phone: "031 92 40 88",
    email: "contact@maghrebservices.dz",
    address: "Cité Boussouf, Bloc 12",
    city: "Constantine",
    wilaya: "Constantine (25)",
    nif: "001925012398765",
    nis: "2019250100789",
    rc: "25/00-0123987A19",
    secondary_rc: null,
    secondary_address: null,
    ai: "25012398765",
    activite: "Fourniture de Bureau & Électronique",
    credit_limit: 2000000,
    payment_terms_days: 15,
    notes: "Factures par email",
    is_active: true,
    initial_balance: 80000,
    advance_payment: 0,
    created_at: "2025-03-15T15:20:00Z",
    updated_at: "2025-03-15T15:20:00Z",
  },
  {
    id: "fc2fc732-4e86-4591-bcee-75ef52019899",
    company_id: MOCK_COMPANY_ID,
    code: "CL-TPZ-08",
    name: "SARL BIO PHARMA ALGERIE",
    contact_person: "Dr. Khaled Rahal",
    phone: "024 49 11 33",
    email: "appro@biopharma-dz.com",
    address: "Route Nationale 11, Zone d'activités",
    city: "Bou Ismaïl",
    wilaya: "Tipaza (42)",
    nif: "001642087612345",
    nis: "2016420800678",
    rc: "42/00-0765432B16",
    secondary_rc: null,
    secondary_address: null,
    ai: "42087612345",
    activite: "Laboratoire Pharmaceutique",
    credit_limit: 10000000,
    payment_terms_days: 60,
    notes: "Grand compte santé, respect strict des délais",
    is_active: true,
    initial_balance: 0,
    advance_payment: 1200000,
    created_at: "2025-04-01T09:30:00Z",
    updated_at: "2025-04-01T09:30:00Z",
  },
  {
    id: "12685c5d-2243-4109-b1bf-34eb72fb174e",
    company_id: MOCK_COMPANY_ID,
    code: "CL-WRG-09",
    name: "SPA SAHARA TRANS & SERVICES",
    contact_person: "Mourad Touati",
    phone: "029 71 80 50",
    email: "direction@saharatrans.dz",
    address: "Zone Industrielle Hassi Messaoud",
    city: "Hassi Messaoud",
    wilaya: "Ouargla (30)",
    nif: "000530012345987",
    nis: "1995300100890",
    rc: "30/00-0234567B05",
    secondary_rc: null,
    secondary_address: null,
    ai: "30012345987",
    activite: "Services Pétroliers & Logistique Sud",
    credit_limit: 15000000,
    payment_terms_days: 45,
    notes: "Exonération partielle selon bon de commande",
    is_active: true,
    initial_balance: 0,
    advance_payment: 800000,
    created_at: "2025-04-10T16:00:00Z",
    updated_at: "2025-04-10T16:00:00Z",
  },
  {
    id: "145c6262-b0bc-437e-b537-dd5bef72c04b",
    company_id: MOCK_COMPANY_ID,
    code: "CL-ANN-10",
    name: "EURL EL HILAL COMMERCE ET BTP",
    contact_person: "Tariq Guellil",
    phone: "038 86 55 42",
    email: "elhilal.commerce@yahoo.fr",
    address: "Avenue de l'ALN, Port d'Annaba",
    city: "Annaba",
    wilaya: "Annaba (23)",
    nif: "001423076543210",
    nis: "2014230700901",
    rc: "23/00-0654321A14",
    secondary_rc: null,
    secondary_address: null,
    ai: "23076543210",
    activite: "Import & Vente Matériaux",
    credit_limit: 4000000,
    payment_terms_days: 30,
    notes: "Contact commercial dédié",
    is_active: true,
    initial_balance: 50000,
    advance_payment: 0,
    created_at: "2025-05-01T10:15:00Z",
    updated_at: "2025-05-01T10:15:00Z",
  }
];

const PRODUCT_SEED_DATA: Omit<Product, "timbre_exempt" | "is_active" | "company_id">[] = [
  {
    id: "a1ad9717-44b7-44d8-b705-5bdb14851f17",
    code: "0/3",
    name: "Sable Concassé 0/3",
    description: "Sable fin concassé de haute pureté pour mortier et béton",
    unit_price: 650,
    tva_rate: 19,
    unit: "tonne",
    display_order: 1,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "13af0f82-1921-4cf0-988f-b99bf0fd2a27",
    code: "3/8",
    name: "Gravier Concassé 3/8",
    description: "Gravier calibré pour béton armé et préfabrication",
    unit_price: 750,
    tva_rate: 19,
    unit: "tonne",
    display_order: 2,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "2cad951b-651b-4e13-b905-6e8980ccbe92",
    code: "8/15",
    name: "Gravier Calibré 8/15",
    description: "Gravier pour couches de fondation et béton de structure",
    unit_price: 720,
    tva_rate: 19,
    unit: "tonne",
    display_order: 3,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "ca176491-7d9b-4b9d-9365-bb0dbd6608da",
    code: "15/25",
    name: "Gravillon 15/25",
    description: "Granulat grossier pour gros béton et drainage",
    unit_price: 680,
    tva_rate: 19,
    unit: "tonne",
    display_order: 4,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "958a6fd8-a38f-4284-81ed-f56a35c39826",
    code: "TVC",
    name: "Tout Venant Carrière",
    description: "Tout-venant 0/40 non traité pour remblais et voirie",
    unit_price: 380,
    tva_rate: 19,
    unit: "tonne",
    display_order: 5,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "a476a571-c721-4460-b180-6c35b505a6fa",
    code: "TVS",
    name: "Tout Venant Oued Calibré",
    description: "Matériau naturel sélectionné d'oued pour sous-couches",
    unit_price: 480,
    tva_rate: 19,
    unit: "tonne",
    display_order: 6,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "1d009e4a-bf6e-4dcb-9c67-35f56c37c378",
    code: "40/70",
    name: "Ballast & Enrochement 40/70",
    description: "Blocs concassés pour stabilisation des sols et gabions",
    unit_price: 590,
    tva_rate: 19,
    unit: "tonne",
    display_order: 7,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "b0225e65-5810-4339-bd2d-3828ec6efdc2",
    code: "SBL-LAV",
    name: "Sable Fin Lavé Extra",
    description: "Sable lavé d'une grande propreté pour enduits et crépis",
    unit_price: 850,
    tva_rate: 19,
    unit: "tonne",
    display_order: 8,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  }
];

const INITIAL_PRODUCTS: Product[] = PRODUCT_SEED_DATA.map(p => ({
  ...p,
  company_id: MOCK_COMPANY_ID,
  timbre_exempt: false,
  is_active: true,
}));

const INVOICE_SEED_DATA: Omit<Invoice, "month_period" | "balance_due" | "company_id">[] = [
  {
    id: "inv-001",
    invoice_number: "FACT-2025-0001",
    client_id: "d2ca2c45-669d-4724-9b6e-913b1fe6d605",
    invoice_date: "2025-01-15",
    due_date: "2025-02-15",
    subtotal_ht: 385000,
    tva_rate: 19,
    tva_amount: 73150,
    timbre: 2500,
    total_ttc: 460650,
    amount_paid: 460650,
    status: "paid",
    invoice_type: "invoice",
    payment_method: "virement",
    notes: "Règlement reçu par virement BNA",
    header_note: "Facture de vente matériaux janvier",
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture Définitive",
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-20T14:30:00Z",
  },
  {
    id: "inv-002",
    invoice_number: "FACT-2025-0002",
    client_id: "9bb7f633-dbf7-44de-8705-4f6a588c0a45",
    invoice_date: "2025-01-22",
    due_date: "2025-02-06",
    subtotal_ht: 540000,
    tva_rate: 19,
    tva_amount: 102600,
    timbre: 2500,
    total_ttc: 645100,
    amount_paid: 645100,
    status: "paid",
    invoice_type: "invoice",
    payment_method: "cheque",
    notes: "Chèque n° 4891230 BEA",
    header_note: null,
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture de Vente",
    created_at: "2025-01-22T11:00:00Z",
    updated_at: "2025-01-28T09:00:00Z",
  },
  {
    id: "inv-003",
    invoice_number: "FACT-2025-0003",
    client_id: "cd154201-afbc-4b12-82f9-38cd148a6671",
    invoice_date: "2025-02-05",
    due_date: "2025-03-22",
    subtotal_ht: 1250000,
    tva_rate: 19,
    tva_amount: 237500,
    timbre: 2500,
    total_ttc: 1490000,
    amount_paid: 745000,
    status: "partial",
    invoice_type: "invoice",
    payment_method: "virement",
    notes: "Acompte 50% reçu, solde fin de mois",
    header_note: "Chantier autoroute est-ouest",
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture",
    created_at: "2025-02-05T08:30:00Z",
    updated_at: "2025-02-15T16:00:00Z",
  },
  {
    id: "inv-004",
    invoice_number: "FACT-2025-0004",
    client_id: "7284dae0-956c-4023-b2df-1931f1fd7784",
    invoice_date: "2025-02-18",
    due_date: "2025-03-20",
    subtotal_ht: 820000,
    tva_rate: 19,
    tva_amount: 155800,
    timbre: 2500,
    total_ttc: 978300,
    amount_paid: 0,
    status: "unpaid",
    invoice_type: "invoice",
    payment_method: "cheque",
    notes: "Échéance proche, relance prévue",
    header_note: null,
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture de Doit",
    created_at: "2025-02-18T14:15:00Z",
    updated_at: "2025-02-18T14:15:00Z",
  },
  {
    id: "inv-005",
    invoice_number: "FACT-2025-0005",
    client_id: "f810f124-ad3a-4db5-88a8-f39916e854a8",
    invoice_date: "2025-03-02",
    due_date: "2025-04-02",
    subtotal_ht: 460000,
    tva_rate: 19,
    tva_amount: 87400,
    timbre: 2500,
    total_ttc: 549900,
    amount_paid: 549900,
    status: "paid",
    invoice_type: "invoice",
    payment_method: "especes",
    notes: "Payé en espèces avec timbre fiscal réglementaire",
    header_note: null,
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture",
    created_at: "2025-03-02T10:00:00Z",
    updated_at: "2025-03-02T11:00:00Z",
  },
  {
    id: "inv-006",
    invoice_number: "PROF-2025-0001",
    client_id: "55664ee8-e0f5-4644-a06b-76fc9afea23e",
    invoice_date: "2025-03-10",
    due_date: "2025-03-30",
    subtotal_ht: 980000,
    tva_rate: 19,
    tva_amount: 186200,
    timbre: 0,
    total_ttc: 1166200,
    amount_paid: 0,
    status: "draft",
    invoice_type: "proforma",
    payment_method: "virement",
    notes: "Devis proforma valable 30 jours",
    header_note: "Offre de prix projet extension",
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture Proforma",
    created_at: "2025-03-10T09:00:00Z",
    updated_at: "2025-03-10T09:00:00Z",
  },
  {
    id: "inv-007",
    invoice_number: "FACT-2025-0006",
    client_id: "5cc275d5-061d-44c8-a58c-43e629aeab72",
    invoice_date: "2025-03-25",
    due_date: "2025-04-10",
    subtotal_ht: 310000,
    tva_rate: 19,
    tva_amount: 58900,
    timbre: 2500,
    total_ttc: 371400,
    amount_paid: 371400,
    status: "paid",
    invoice_type: "invoice",
    payment_method: "virement",
    notes: "Virement CPA reçu",
    header_note: null,
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture",
    created_at: "2025-03-25T15:30:00Z",
    updated_at: "2025-03-29T10:00:00Z",
  },
  {
    id: "inv-008",
    invoice_number: "FACT-2025-0007",
    client_id: "fc2fc732-4e86-4591-bcee-75ef52019899",
    invoice_date: "2025-04-05",
    due_date: "2025-06-05",
    subtotal_ht: 2150000,
    tva_rate: 19,
    tva_amount: 408500,
    timbre: 2500,
    total_ttc: 2561000,
    amount_paid: 0,
    status: "unpaid",
    invoice_type: "invoice",
    payment_method: "virement",
    notes: "Grand volume de gravier 3/8 et 8/15",
    header_note: "Projet unité pharmaceutique Tipaza",
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture Définitive",
    created_at: "2025-04-05T09:00:00Z",
    updated_at: "2025-04-05T09:00:00Z",
  },
  {
    id: "inv-009",
    invoice_number: "AVOIR-2025-0001",
    client_id: "7284dae0-956c-4023-b2df-1931f1fd7784",
    invoice_date: "2025-04-12",
    due_date: "2025-04-12",
    subtotal_ht: 75000,
    tva_rate: 19,
    tva_amount: 14250,
    timbre: 0,
    total_ttc: 89250,
    amount_paid: 89250,
    status: "paid",
    invoice_type: "credit_note",
    payment_method: "autre",
    notes: "Avoir sur facture FACT-2025-0004 suite à retour partiel",
    header_note: "Note d'Avoir",
    original_invoice_id: "inv-004",
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture d'Avoir",
    created_at: "2025-04-12T11:20:00Z",
    updated_at: "2025-04-12T11:20:00Z",
  },
  {
    id: "inv-010",
    invoice_number: "FACT-2025-0008",
    client_id: "12685c5d-2243-4109-b1bf-34eb72fb174e",
    invoice_date: "2025-04-20",
    due_date: "2025-06-04",
    subtotal_ht: 3400000,
    tva_rate: 19,
    tva_amount: 646000,
    timbre: 2500,
    total_ttc: 4048500,
    amount_paid: 2000000,
    status: "partial",
    invoice_type: "invoice",
    payment_method: "virement",
    notes: "Acompte initial 2M DA reçu",
    header_note: "Plateforme forage Sud Hassi Messaoud",
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture",
    created_at: "2025-04-20T14:00:00Z",
    updated_at: "2025-04-25T17:00:00Z",
  },
  {
    id: "inv-011",
    invoice_number: "FACT-2025-0009",
    client_id: "145c6262-b0bc-437e-b537-dd5bef72c04b",
    invoice_date: "2025-05-02",
    due_date: "2025-06-02",
    subtotal_ht: 620000,
    tva_rate: 19,
    tva_amount: 117800,
    timbre: 2500,
    total_ttc: 740300,
    amount_paid: 740300,
    status: "paid",
    invoice_type: "invoice",
    payment_method: "cheque",
    notes: "Chèque BDL n° 9812401",
    header_note: null,
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture",
    created_at: "2025-05-02T09:40:00Z",
    updated_at: "2025-05-08T12:00:00Z",
  },
  {
    id: "inv-012",
    invoice_number: "FACT-2025-0010",
    client_id: "d2ca2c45-669d-4724-9b6e-913b1fe6d605",
    invoice_date: "2025-05-18",
    due_date: "2025-06-18",
    subtotal_ht: 890000,
    tva_rate: 19,
    tva_amount: 169100,
    timbre: 2500,
    total_ttc: 1061600,
    amount_paid: 0,
    status: "unpaid",
    invoice_type: "invoice",
    payment_method: "virement",
    notes: "Fourniture tout venant et gravillons",
    header_note: "Extension centre télécom Alger",
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture",
    created_at: "2025-05-18T11:00:00Z",
    updated_at: "2025-05-18T11:00:00Z",
  },
  {
    // Linked to project "Refonte Identité Visuelle & Site Web" (see
    // INITIAL_PROJECTS) — seeded so the Rentabilité & Finances Réelles card
    // and Dépenses tab have real, non-zero numbers to render in web preview.
    id: "inv-013",
    invoice_number: "FACT-2025-0011",
    client_id: "d2ca2c45-669d-4724-9b6e-913b1fe6d605",
    invoice_date: "2025-02-20",
    due_date: "2025-03-20",
    subtotal_ht: 150000,
    tva_rate: 19,
    tva_amount: 28500,
    timbre: 3000,
    total_ttc: 181500,
    amount_paid: 181500,
    status: "paid",
    invoice_type: "invoice",
    payment_method: "virement",
    notes: "Acompte projet refonte identité visuelle",
    header_note: "Facture liée au projet Refonte Identité Visuelle & Site Web",
    original_invoice_id: null,
    discount: null,
    discount_type: null,
    discount_value: null,
    use_secondary_register: false,
    selected_secondary_rc: null,
    selected_secondary_address: null,
    custom_title: "Facture Définitive",
    created_at: "2025-02-20T10:00:00Z",
    updated_at: "2025-02-25T14:00:00Z",
    project_id: "3f1a1e9c-2b7d-4b3a-9c4e-8f2a6d1b5e7a",
  }
];

// balance_due and month_period are derived rather than hand-typed on every
// seed record, so they can't drift out of sync with total_ttc/amount_paid.
const INITIAL_INVOICES: Invoice[] = INVOICE_SEED_DATA.map(inv => ({
  ...inv,
  company_id: MOCK_COMPANY_ID,
  month_period: inv.invoice_date.substring(0, 7),
  balance_due: (inv.total_ttc || 0) - (inv.amount_paid || 0),
}));

const INITIAL_INVOICE_ITEMS: Record<string, any[]> = {
  "inv-001": [
    { id: "item-1", invoice_id: "inv-001", product_id: "a1ad9717-44b7-44d8-b705-5bdb14851f17", product_code: "0/3", product_name: "Sable Concassé 0/3", quantity: 300, unit_price: 650, amount: 195000, tva_rate: 19, timbre_exempt: false },
    { id: "item-2", invoice_id: "inv-001", product_id: "13af0f82-1921-4cf0-988f-b99bf0fd2a27", product_code: "3/8", product_name: "Gravier Concassé 3/8", quantity: 200, unit_price: 750, amount: 150000, tva_rate: 19, timbre_exempt: false },
    { id: "item-3", invoice_id: "inv-001", product_id: "958a6fd8-a38f-4284-81ed-f56a35c39826", product_code: "TVC", product_name: "Tout Venant Carrière", quantity: 100, unit_price: 400, amount: 40000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-002": [
    { id: "item-4", invoice_id: "inv-002", product_id: "2cad951b-651b-4e13-b905-6e8980ccbe92", product_code: "8/15", product_name: "Gravier Calibré 8/15", quantity: 500, unit_price: 720, amount: 360000, tva_rate: 19, timbre_exempt: false },
    { id: "item-5", invoice_id: "inv-002", product_id: "b0225e65-5810-4339-bd2d-3828ec6efdc2", product_code: "SBL-LAV", product_name: "Sable Fin Lavé Extra", quantity: 200, unit_price: 900, amount: 180000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-003": [
    { id: "item-6", invoice_id: "inv-003", product_id: "1d009e4a-bf6e-4dcb-9c67-35f56c37c378", product_code: "40/70", product_name: "Ballast & Enrochement 40/70", quantity: 1000, unit_price: 600, amount: 600000, tva_rate: 19, timbre_exempt: false },
    { id: "item-7", invoice_id: "inv-003", product_id: "958a6fd8-a38f-4284-81ed-f56a35c39826", product_code: "TVC", product_name: "Tout Venant Carrière", quantity: 1500, unit_price: 380, amount: 570000, tva_rate: 19, timbre_exempt: false },
    { id: "item-8", invoice_id: "inv-003", product_id: "13af0f82-1921-4cf0-988f-b99bf0fd2a27", product_code: "3/8", product_name: "Gravier Concassé 3/8", quantity: 100, unit_price: 800, amount: 80000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-004": [
    { id: "item-9", invoice_id: "inv-004", product_id: "a1ad9717-44b7-44d8-b705-5bdb14851f17", product_code: "0/3", product_name: "Sable Concassé 0/3", quantity: 800, unit_price: 650, amount: 520000, tva_rate: 19, timbre_exempt: false },
    { id: "item-10", invoice_id: "inv-004", product_id: "ca176491-7d9b-4b9d-9365-bb0dbd6608da", product_code: "15/25", product_name: "Gravillon 15/25", quantity: 400, unit_price: 750, amount: 300000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-005": [
    { id: "item-11", invoice_id: "inv-005", product_id: "b0225e65-5810-4339-bd2d-3828ec6efdc2", product_code: "SBL-LAV", product_name: "Sable Fin Lavé Extra", quantity: 400, unit_price: 850, amount: 340000, tva_rate: 19, timbre_exempt: false },
    { id: "item-12", invoice_id: "inv-005", product_id: "13af0f82-1921-4cf0-988f-b99bf0fd2a27", product_code: "3/8", product_name: "Gravier Concassé 3/8", quantity: 160, unit_price: 750, amount: 120000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-008": [
    { id: "item-13", invoice_id: "inv-008", product_id: "2cad951b-651b-4e13-b905-6e8980ccbe92", product_code: "8/15", product_name: "Gravier Calibré 8/15", quantity: 1500, unit_price: 720, amount: 1080000, tva_rate: 19, timbre_exempt: false },
    { id: "item-14", invoice_id: "inv-008", product_id: "13af0f82-1921-4cf0-988f-b99bf0fd2a27", product_code: "3/8", product_name: "Gravier Concassé 3/8", quantity: 1400, unit_price: 750, amount: 1050000, tva_rate: 19, timbre_exempt: false },
    { id: "item-15", invoice_id: "inv-008", product_id: "a1ad9717-44b7-44d8-b705-5bdb14851f17", product_code: "0/3", product_name: "Sable Concassé 0/3", quantity: 30, unit_price: 666.66, amount: 20000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-010": [
    { id: "item-16", invoice_id: "inv-010", product_id: "1d009e4a-bf6e-4dcb-9c67-35f56c37c378", product_code: "40/70", product_name: "Ballast & Enrochement 40/70", quantity: 3000, unit_price: 600, amount: 1800000, tva_rate: 19, timbre_exempt: false },
    { id: "item-17", invoice_id: "inv-010", product_id: "958a6fd8-a38f-4284-81ed-f56a35c39826", product_code: "TVC", product_name: "Tout Venant Carrière", quantity: 4000, unit_price: 400, amount: 1600000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-011": [
    { id: "item-18", invoice_id: "inv-011", product_id: "a476a571-c721-4460-b180-6c35b505a6fa", product_code: "TVS", product_name: "Tout Venant Oued Calibré", quantity: 1000, unit_price: 480, amount: 480000, tva_rate: 19, timbre_exempt: false },
    { id: "item-19", invoice_id: "inv-011", product_id: "13af0f82-1921-4cf0-988f-b99bf0fd2a27", product_code: "3/8", product_name: "Gravier Concassé 3/8", quantity: 180, unit_price: 777.77, amount: 140000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-012": [
    { id: "item-20", invoice_id: "inv-012", product_id: "a1ad9717-44b7-44d8-b705-5bdb14851f17", product_code: "0/3", product_name: "Sable Concassé 0/3", quantity: 700, unit_price: 650, amount: 455000, tva_rate: 19, timbre_exempt: false },
    { id: "item-21", invoice_id: "inv-012", product_id: "2cad951b-651b-4e13-b905-6e8980ccbe92", product_code: "8/15", product_name: "Gravier Calibré 8/15", quantity: 600, unit_price: 725, amount: 435000, tva_rate: 19, timbre_exempt: false },
  ],
  "inv-013": [
    // Custom (non-catalog) service line item — no product_id, matches the
    // Product Combobox's "add as custom item" shape.
    { id: "item-22", invoice_id: "inv-013", product_id: null, product_name: "Prestation Refonte Identité Visuelle & Site Web", quantity: 1, unit_price: 150000, amount: 150000, tva_rate: 19, timbre_exempt: false },
  ]
};

const INITIAL_PAYMENTS: Payment[] = [
  { id: "pay-001", company_id: MOCK_COMPANY_ID, invoice_id: "inv-001", payment_date: "2025-01-20", amount: 460650, payment_method: "virement", cheque_number: null, bank_name: "BNA", value_date: "2025-01-20", notes: "Règlement total", created_at: "2025-01-20T14:30:00Z", employee_id: null },
  { id: "pay-002", company_id: MOCK_COMPANY_ID, invoice_id: "inv-002", payment_date: "2025-01-28", amount: 645100, payment_method: "cheque", cheque_number: "4891230", bank_name: "BEA", value_date: "2025-01-28", notes: "Chèque déposé", created_at: "2025-01-28T09:00:00Z", employee_id: null },
  { id: "pay-003", company_id: MOCK_COMPANY_ID, invoice_id: "inv-003", payment_date: "2025-02-15", amount: 745000, payment_method: "virement", cheque_number: null, bank_name: "BADR", value_date: "2025-02-15", notes: "Premier acompte 50%", created_at: "2025-02-15T16:00:00Z", employee_id: null },
  { id: "pay-004", company_id: MOCK_COMPANY_ID, invoice_id: "inv-005", payment_date: "2025-03-02", amount: 549900, payment_method: "especes", cheque_number: null, bank_name: null, value_date: "2025-03-02", notes: "Espèces caisse centrale", created_at: "2025-03-02T11:00:00Z", employee_id: null },
  { id: "pay-005", company_id: MOCK_COMPANY_ID, invoice_id: "inv-007", payment_date: "2025-03-29", amount: 371400, payment_method: "virement", cheque_number: null, bank_name: "CPA", value_date: "2025-03-29", notes: "Solde facture", created_at: "2025-03-29T10:00:00Z", employee_id: null },
  { id: "pay-006", company_id: MOCK_COMPANY_ID, invoice_id: "inv-010", payment_date: "2025-04-25", amount: 2000000, payment_method: "virement", cheque_number: null, bank_name: "Gulf Bank Algérie", value_date: "2025-04-25", notes: "Virement partiel", created_at: "2025-04-25T17:00:00Z", employee_id: null },
  { id: "pay-007", company_id: MOCK_COMPANY_ID, invoice_id: "inv-011", payment_date: "2025-05-08", amount: 740300, payment_method: "cheque", cheque_number: "9812401", bank_name: "BDL", value_date: "2025-05-08", notes: "Chèque encaissé", created_at: "2025-05-08T12:00:00Z", employee_id: null }
];

const INITIAL_EXPENSES: Expense[] = [
  { id: "exp-001", company_id: MOCK_COMPANY_ID, expense_date: "2025-01-05", category: "Loyer & Charges", description: "Loyer dépôt et bureau janvier", amount: 180000, payment_method: "virement", reference: "LOY-JAN25", notes: "Propriétaire SARL Immo", month_period: "2025-01", is_paid: true, created_at: "2025-01-05T10:00:00Z", updated_at: "2025-01-05T10:00:00Z" },
  { id: "exp-002", company_id: MOCK_COMPANY_ID, expense_date: "2025-01-18", category: "Carburant & Transport", description: "Carburant camions et engins", amount: 95000, payment_method: "carte", reference: "NAFT-4521", notes: "Cartes Naftal", month_period: "2025-01", is_paid: true, created_at: "2025-01-18T16:00:00Z", updated_at: "2025-01-18T16:00:00Z" },
  { id: "exp-003", company_id: MOCK_COMPANY_ID, expense_date: "2025-02-05", category: "Loyer & Charges", description: "Loyer dépôt et bureau février", amount: 180000, payment_method: "virement", reference: "LOY-FEV25", notes: null, month_period: "2025-02", is_paid: true, created_at: "2025-02-05T10:00:00Z", updated_at: "2025-02-05T10:00:00Z" },
  { id: "exp-004", company_id: MOCK_COMPANY_ID, expense_date: "2025-02-22", category: "Maintenance & Pièces", description: "Réparation chargeur Caterpillar", amount: 145000, payment_method: "cheque", reference: "REP-ENGIN-02", notes: "Société Technique Engins", month_period: "2025-02", is_paid: true, created_at: "2025-02-22T14:30:00Z", updated_at: "2025-02-22T14:30:00Z" },
  { id: "exp-005", company_id: MOCK_COMPANY_ID, expense_date: "2025-03-05", category: "Loyer & Charges", description: "Loyer dépôt et bureau mars", amount: 180000, payment_method: "virement", reference: "LOY-MAR25", notes: null, month_period: "2025-03", is_paid: true, created_at: "2025-03-05T10:00:00Z", updated_at: "2025-03-05T10:00:00Z" },
  { id: "exp-006", company_id: MOCK_COMPANY_ID, expense_date: "2025-03-20", category: "Électricité & Eau", description: "Facture Sonelgaz 1er Trimestre", amount: 64500, payment_method: "virement", reference: "SON-2025-T1", notes: "Site carrière", month_period: "2025-03", is_paid: true, created_at: "2025-03-20T11:00:00Z", updated_at: "2025-03-20T11:00:00Z" },
  { id: "exp-007", company_id: MOCK_COMPANY_ID, expense_date: "2025-04-05", category: "Loyer & Charges", description: "Loyer dépôt et bureau avril", amount: 180000, payment_method: "virement", reference: "LOY-AVR25", notes: null, month_period: "2025-04", is_paid: true, created_at: "2025-04-05T10:00:00Z", updated_at: "2025-04-05T10:00:00Z" },
  { id: "exp-008", company_id: MOCK_COMPANY_ID, expense_date: "2025-04-18", category: "Fournitures & Bureautique", description: "Achat consommables et impressions", amount: 32000, payment_method: "especes", reference: "FOURN-04", notes: "Facture payée", month_period: "2025-04", is_paid: true, created_at: "2025-04-18T15:00:00Z", updated_at: "2025-04-18T15:00:00Z" },
  // Both linked to project "Refonte Identité Visuelle & Site Web" — direct
  // costs for the Rentabilité & Finances Réelles card / Dépenses tab.
  { id: "exp-009", company_id: MOCK_COMPANY_ID, expense_date: "2025-02-25", category: "Sous-traitance Design", description: "Freelance illustration & maquettes", amount: 35000, payment_method: "virement", reference: "FREELANCE-02", notes: "Prestataire externe", month_period: "2025-02", project_id: "3f1a1e9c-2b7d-4b3a-9c4e-8f2a6d1b5e7a", project_name: "Refonte Identité Visuelle & Site Web", is_recurring: false, recurrence_interval: null, is_paid: true, created_at: "2025-02-25T10:00:00Z", updated_at: "2025-02-25T10:00:00Z" },
  { id: "exp-010", company_id: MOCK_COMPANY_ID, expense_date: "2025-03-10", category: "Licences & Outils", description: "Abonnement Adobe Creative Cloud", amount: 18000, payment_method: "carte", reference: "ADOBE-MAR25", notes: "Licence mensuelle équipe design", month_period: "2025-03", project_id: "3f1a1e9c-2b7d-4b3a-9c4e-8f2a6d1b5e7a", project_name: "Refonte Identité Visuelle & Site Web", is_recurring: true, recurrence_interval: "monthly", is_paid: true, created_at: "2025-03-10T10:00:00Z", updated_at: "2025-03-10T10:00:00Z" }
];

const INITIAL_DELIVERIES: DeliveryNote[] = [
  {
    id: "bl-001",
    company_id: MOCK_COMPANY_ID,
    delivery_number: "BL-2025-0001",
    client_id: "d2ca2c45-669d-4724-9b6e-913b1fe6d605",
    delivery_date: "2025-01-14",
    invoice_id: "inv-001",
    order_id: null,
    truck_plate: "00124-116-16",
    driver_name: "Mourad Brahimi",
    deliverer_name: "Dépôt Central",
    deliverer_nin: "1980160900124",
    transporter_name: "Trans Sordi Express",
    transporter_nin: "1985160900456",
    delivery_location: "Alger Oued Smar",
    client_received_date: "2025-01-14",
    client_signature: "Signé",
    supplier_delivered_date: "2025-01-14",
    is_invoiced: true,
    notes: "Marchandise reçue en bon état",
    reserves: null,
    custom_title: "Bon de Livraison",
    status: "signed",
    signed_at: "2025-01-14T10:00:00Z",
    created_at: "2025-01-14T08:00:00Z",
    updated_at: "2025-01-14T10:00:00Z",
  },
  {
    id: "bl-002",
    company_id: MOCK_COMPANY_ID,
    delivery_number: "BL-2025-0002",
    client_id: "9bb7f633-dbf7-44de-8705-4f6a588c0a45",
    delivery_date: "2025-01-21",
    invoice_id: "inv-002",
    order_id: null,
    truck_plate: "04567-112-09",
    driver_name: "Ali Meziane",
    deliverer_name: "Dépôt Carrière",
    deliverer_nin: "1978090100789",
    transporter_name: "Trans Atlas",
    transporter_nin: "1989090100345",
    delivery_location: "Blida Chiffa",
    client_received_date: "2025-01-21",
    client_signature: "Signé",
    supplier_delivered_date: "2025-01-21",
    is_invoiced: true,
    notes: "Conforme au bon de commande",
    reserves: null,
    custom_title: "Bon de Livraison",
    status: "signed",
    signed_at: "2025-01-21T11:30:00Z",
    created_at: "2025-01-21T09:00:00Z",
    updated_at: "2025-01-21T11:30:00Z",
  },
  {
    id: "bl-003",
    company_id: MOCK_COMPANY_ID,
    delivery_number: "BL-2025-0003",
    client_id: "cd154201-afbc-4b12-82f9-38cd148a6671",
    delivery_date: "2025-02-04",
    invoice_id: "inv-003",
    order_id: null,
    truck_plate: "09812-115-34",
    driver_name: "Hocine Kaci",
    deliverer_name: "Dépôt Carrière",
    deliverer_nin: "1982340100456",
    transporter_name: "Condor Transports",
    transporter_nin: "1994340100123",
    delivery_location: "BBA Chantier",
    client_received_date: "2025-02-04",
    client_signature: "Signé",
    supplier_delivered_date: "2025-02-04",
    is_invoiced: true,
    notes: "Livraison échelonnée lot 1",
    reserves: null,
    custom_title: "Bon de Livraison",
    status: "signed",
    signed_at: "2025-02-04T10:00:00Z",
    created_at: "2025-02-04T07:30:00Z",
    updated_at: "2025-02-04T10:00:00Z",
  },
  {
    id: "bl-004",
    company_id: MOCK_COMPANY_ID,
    delivery_number: "BL-2025-0004",
    client_id: "fc2fc732-4e86-4591-bcee-75ef52019899",
    delivery_date: "2025-04-04",
    invoice_id: "inv-008",
    order_id: null,
    truck_plate: "01458-118-42",
    driver_name: "Zoubir Cheniti",
    deliverer_name: "Dépôt Carrière",
    deliverer_nin: "1986420800345",
    transporter_name: "Trans Bio Express",
    transporter_nin: "1990420800678",
    delivery_location: "Bou Ismaïl Tipaza",
    client_received_date: "2025-04-04",
    client_signature: "Signé",
    supplier_delivered_date: "2025-04-04",
    is_invoiced: true,
    notes: "Grande livraison 2900 tonnes",
    reserves: null,
    custom_title: "Bon de Livraison",
    status: "signed",
    signed_at: "2025-04-04T13:00:00Z",
    created_at: "2025-04-04T08:00:00Z",
    updated_at: "2025-04-04T13:00:00Z",
  }
];

const INITIAL_ORDERS: Order[] = [
  {
    id: "ord-001",
    company_id: MOCK_COMPANY_ID,
    order_number: "BC-2025-0001",
    client_id: "d2ca2c45-669d-4724-9b6e-913b1fe6d605",
    supplier_name: "SARL SORDI CARRIERES",
    supplier_address: "Zone Industrielle Oued Smar, Alger",
    supplier_email: "contact@sordi.dz",
    supplier_phone: "021 55 44 33",
    supplier_rc: "16/00-0984123B18",
    supplier_nif: "001816098745231",
    supplier_nis: "1984160900142",
    supplier_ai: "16091245870",
    order_date: "2025-01-10",
    delivery_date: "2025-01-15",
    payment_terms: "30 jours",
    payment_method: "virement",
    status: "delivered",
    subtotal_ht: 385000,
    tva_rate: 19,
    tva_amount: 73150,
    total_ttc: 458150,
    notes: "Commande validée",
    custom_title: "Bon de Commande",
    month_period: "2025-01",
    created_at: "2025-01-10T09:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  },
  {
    id: "ord-002",
    company_id: MOCK_COMPANY_ID,
    order_number: "BC-2025-0002",
    client_id: "9bb7f633-dbf7-44de-8705-4f6a588c0a45",
    supplier_name: "SARL SORDI CARRIERES",
    supplier_address: "Zone Industrielle Oued Smar, Alger",
    supplier_email: "contact@sordi.dz",
    supplier_phone: "021 55 44 33",
    supplier_rc: "16/00-0984123B18",
    supplier_nif: "001816098745231",
    supplier_nis: "1984160900142",
    supplier_ai: "16091245870",
    order_date: "2025-01-18",
    delivery_date: "2025-01-22",
    payment_terms: "15 jours",
    payment_method: "cheque",
    status: "delivered",
    subtotal_ht: 540000,
    tva_rate: 19,
    tva_amount: 102600,
    total_ttc: 642600,
    notes: "Livraison urgente Blida",
    custom_title: "Bon de Commande",
    month_period: "2025-01",
    created_at: "2025-01-18T10:00:00Z",
    updated_at: "2025-01-22T11:00:00Z",
  },
  {
    id: "ord-003",
    company_id: MOCK_COMPANY_ID,
    order_number: "BC-2025-0003",
    client_id: "cd154201-afbc-4b12-82f9-38cd148a6671",
    supplier_name: "SARL SORDI CARRIERES",
    supplier_address: "Zone Industrielle Oued Smar, Alger",
    supplier_email: "contact@sordi.dz",
    supplier_phone: "021 55 44 33",
    supplier_rc: "16/00-0984123B18",
    supplier_nif: "001816098745231",
    supplier_nis: "1984160900142",
    supplier_ai: "16091245870",
    order_date: "2025-02-01",
    delivery_date: "2025-02-10",
    payment_terms: "45 jours",
    payment_method: "virement",
    status: "confirmed",
    subtotal_ht: 1250000,
    tva_rate: 19,
    tva_amount: 237500,
    total_ttc: 1487500,
    notes: "En cours d'expédition échelonnée",
    custom_title: "Bon de Commande",
    month_period: "2025-02",
    created_at: "2025-02-01T08:00:00Z",
    updated_at: "2025-02-01T08:00:00Z",
  }
];

const INITIAL_EMPLOYEES: Employee[] = [
  { id: "emp-001", company_id: MOCK_COMPANY_ID, name: "Rachid Tahiri", role: "Responsable Commercial", email: "r.tahiri@sordi.dz", phone: "0550 12 34 56", address: "Alger Centre", is_active: true, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", base_salary: null, hire_date: null, contract_type: null, rib: null, external_code: null, photo_path: null },
  { id: "emp-002", company_id: MOCK_COMPANY_ID, name: "Hamza Derouiche", role: "Chef de Dépôt", email: "h.derouiche@sordi.dz", phone: "0555 98 76 54", address: "Oued Smar", is_active: true, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", base_salary: null, hire_date: null, contract_type: null, rib: null, external_code: null, photo_path: null },
  { id: "emp-003", company_id: MOCK_COMPANY_ID, name: "Samia Larbi", role: "Comptable Principale", email: "s.larbi@sordi.dz", phone: "0560 45 67 89", address: "Kouba, Alger", is_active: true, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", base_salary: null, hire_date: null, contract_type: null, rib: null, external_code: null, photo_path: null },
  { id: "emp-004", company_id: MOCK_COMPANY_ID, name: "Mourad Brahimi", role: "Chauffeur Poids Lourd", email: "m.brahimi@sordi.dz", phone: "0552 33 22 11", address: "Boufarik, Blida", is_active: true, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", base_salary: null, hire_date: null, contract_type: null, rib: null, external_code: null, photo_path: null }
];

// omada-agency branch only — Projects module mock data. The real backend
// (get_project_stats/get_project_profitability) previously had no mock
// counterpart at all (db.projects.getAll's fallback was a hardcoded []),
// so the Projects module was untestable in web preview. First project is
// deliberately linked to inv-013/exp-009/exp-010 above so the Rentabilité &
// Finances Réelles card and Dépenses tab render real, non-zero numbers.
const INITIAL_PROJECTS: Project[] = [
  {
    id: "3f1a1e9c-2b7d-4b3a-9c4e-8f2a6d1b5e7a",
    company_id: MOCK_COMPANY_ID,
    client_id: "d2ca2c45-669d-4724-9b6e-913b1fe6d605", // SARL ALGERIE TELECOM SOLUTIONS
    name: "Refonte Identité Visuelle & Site Web",
    service_categories: ["branding", "developpement"],
    responsible_person: "Amine Kaddour",
    start_date: "2025-01-10",
    deadline: "2025-06-30",
    planned_budget: 250000,
    created_at: "2025-01-10T09:00:00Z",
    updated_at: "2025-02-25T10:00:00Z",
    freelancer_id: null,
    montant_convenu: null,
    statut_paiement: "non_paye",
    date_paiement: null,
    status: "en_cours",
  },
  {
    id: "7c2b4d8e-1a3f-4e6c-b5d7-9f0a2c4e6b8d",
    company_id: MOCK_COMPANY_ID,
    client_id: "9bb7f633-dbf7-44de-8705-4f6a588c0a45", // EURL ATLAS AGRO INDUSTRIE
    name: "Campagne Marketing Digital Q2",
    service_categories: ["marketing_digital", "design_graphique"],
    responsible_person: "Sarah Belkacem",
    start_date: "2025-03-01",
    deadline: "2025-05-31",
    planned_budget: 180000,
    created_at: "2025-03-01T09:00:00Z",
    updated_at: "2025-03-01T09:00:00Z",
    freelancer_id: null,
    montant_convenu: null,
    statut_paiement: "non_paye",
    date_paiement: null,
    status: "en_cours",
  },
  {
    id: "b4d6f8a0-3c5e-4a7b-9d1f-2e4c6a8b0d2f",
    company_id: MOCK_COMPANY_ID,
    client_id: "cd154201-afbc-4b12-82f9-38cd148a6671", // SPA CONDOR LOGISTICS & TRANS
    name: "Production Vidéo Corporate",
    service_categories: ["production_video"],
    responsible_person: "Karim Toumi",
    start_date: "2025-02-15",
    deadline: "2025-04-15",
    planned_budget: 120000,
    created_at: "2025-02-15T09:00:00Z",
    updated_at: "2025-02-15T09:00:00Z",
    freelancer_id: null,
    montant_convenu: null,
    statut_paiement: "non_paye",
    date_paiement: null,
    status: "en_cours",
  },
];

const INITIAL_PARTNERS: Partner[] = [
  {
    id: "1e2d3c4b-5a69-4f78-8c91-0d2e3f4a5b6c",
    company_id: MOCK_COMPANY_ID,
    name: "Yacine Boudiaf",
    email: "yacine.boudiaf@sordi-agency.dz",
    phone: "0555 12 34 56",
    role: "Gérant associé",
    equity_percentage: 55,
    is_active: true,
    created_at: "2025-01-05T09:00:00Z",
    updated_at: "2025-01-05T09:00:00Z",
  },
  {
    id: "2f3e4d5c-6b7a-4e89-9d02-1e3f4a5b6c7d",
    company_id: MOCK_COMPANY_ID,
    name: "Nadia Cherfaoui",
    email: "nadia.cherfaoui@sordi-agency.dz",
    phone: "0666 78 90 12",
    role: "Associée non gérante",
    equity_percentage: 45,
    is_active: true,
    created_at: "2025-01-05T09:00:00Z",
    updated_at: "2025-01-05T09:00:00Z",
  },
];

const INITIAL_PARTNER_WITHDRAWALS: PartnerWithdrawal[] = [
  {
    id: "3a4b5c6d-7e8f-4091-a2b3-c4d5e6f7a8b9",
    partner_id: "1e2d3c4b-5a69-4f78-8c91-0d2e3f4a5b6c",
    withdrawal_date: "2025-03-15",
    amount: 400000,
    payment_method: "Virement",
    notes: "Acompte T1 2025",
    created_at: "2025-03-15T10:00:00Z",
  },
  {
    id: "4b5c6d7e-8f90-4a12-b3c4-d5e6f7a8b9c0",
    partner_id: "1e2d3c4b-5a69-4f78-8c91-0d2e3f4a5b6c",
    withdrawal_date: "2025-06-20",
    amount: 350000,
    payment_method: "Virement",
    notes: "Acompte T2 2025",
    created_at: "2025-06-20T10:00:00Z",
  },
  {
    id: "5c6d7e8f-9012-4b34-c5d6-e7f8a9b0c1d2",
    partner_id: "2f3e4d5c-6b7a-4e89-9d02-1e3f4a5b6c7d",
    withdrawal_date: "2025-04-10",
    amount: 250000,
    payment_method: "Chèque",
    notes: "Acompte T1 2025",
    created_at: "2025-04-10T10:00:00Z",
  },
];

export const mockStore = {
  // Clients
  getClients: (): Client[] => getStorage("clients", INITIAL_CLIENTS),
  getClient: (id: string): Client | null => {
    const list = getStorage("clients", INITIAL_CLIENTS);
    return list.find(c => c.id === id) || null;
  },
  createClient: (data: CreateClientData): Client => {
    const list = getStorage("clients", INITIAL_CLIENTS);
    const newClient: Client = {
      company_id: data.company_id,
      id: "cli-" + Date.now(),
      code: data.code || `CL-${list.length + 1}`,
      name: data.name,
      contact_person: data.contact_person || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      wilaya: data.wilaya || null,
      nif: data.nif || null,
      nis: data.nis || null,
      rc: data.rc || null,
      secondary_rc: data.secondary_rc || null,
      secondary_address: data.secondary_address || null,
      ai: data.ai || null,
      activite: data.activite || null,
      credit_limit: data.credit_limit || null,
      payment_terms_days: data.payment_terms_days || null,
      notes: data.notes || null,
      is_active: true,
      initial_balance: data.initial_balance || 0,
      advance_payment: data.advance_payment || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newClient, ...list];
    setStorage("clients", updated);
    return newClient;
  },
  updateClient: (id: string, data: CreateClientData): Client => {
    const list = getStorage("clients", INITIAL_CLIENTS);
    const index = list.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Client not found");
    const updatedClient = {
      ...list[index],
      ...data,
      updated_at: new Date().toISOString()
    };
    list[index] = updatedClient;
    setStorage("clients", list);
    return updatedClient;
  },
  deleteClient: (id: string): void => {
    const list = getStorage("clients", INITIAL_CLIENTS);
    setStorage("clients", list.filter(c => c.id !== id));
  },

  // Suppliers (Fournisseurs)
  getSuppliers: (): Supplier[] => getStorage<Supplier[]>("suppliers", []),
  getSupplier: (id: string): Supplier | null => {
    const list = getStorage<Supplier[]>("suppliers", []);
    return list.find(s => s.id === id) || null;
  },
  createSupplier: (data: CreateSupplierData): Supplier => {
    const list = getStorage<Supplier[]>("suppliers", []);
    const newSupplier: Supplier = {
      company_id: data.company_id,
      id: "sup-" + Date.now(),
      name: data.name,
      category: data.category || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      rc: data.rc || null,
      nif: data.nif || null,
      nis: data.nis || null,
      solde_du: data.solde_du || 0,
      notes: data.notes || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setStorage("suppliers", [newSupplier, ...list]);
    return newSupplier;
  },
  updateSupplier: (id: string, data: CreateSupplierData): Supplier => {
    const list = getStorage<Supplier[]>("suppliers", []);
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error("Supplier not found");
    const updatedSupplier = { ...list[index], ...data, updated_at: new Date().toISOString() };
    list[index] = updatedSupplier;
    setStorage("suppliers", list);
    return updatedSupplier;
  },
  deleteSupplier: (id: string): void => {
    const list = getStorage<Supplier[]>("suppliers", []);
    setStorage("suppliers", list.filter(s => s.id !== id));
  },
  getSupplierPurchaseTotals: (): SupplierPurchaseTotal[] => {
    const expenses = getStorage<Expense[]>("expenses", []);
    const totals = new Map<string, number>();
    for (const e of expenses) {
      if (!e.supplier_id) continue;
      totals.set(e.supplier_id, (totals.get(e.supplier_id) || 0) + Number(e.amount));
    }
    return Array.from(totals.entries()).map(([supplier_id, total_achats]) => ({ supplier_id, total_achats }));
  },

  // Client Advances
  getClientAdvances: (client_id: string): ClientAdvance[] => {
    const list = getStorage<ClientAdvance[]>("client_advances", []);
    return list.filter(a => a.client_id === client_id);
  },
  createClientAdvance: (data: CreateClientAdvanceData): ClientAdvance => {
    const list = getStorage<ClientAdvance[]>("client_advances", []);
    const newAdvance: ClientAdvance = { ...data, id: "adv-" + Date.now(), created_at: new Date().toISOString() };
    setStorage("client_advances", [newAdvance, ...list]);
    return newAdvance;
  },
  updateClientAdvance: (data: UpdateClientAdvanceData): ClientAdvance => {
    const list = getStorage<ClientAdvance[]>("client_advances", []);
    const index = list.findIndex(a => a.id === data.id);
    if (index === -1) throw new Error(`Client advance ${data.id} not found`);
    const updated: ClientAdvance = { ...list[index], ...data };
    list[index] = updated;
    setStorage("client_advances", list);
    return updated;
  },
  deleteClientAdvance: (id: string): void => {
    const list = getStorage<ClientAdvance[]>("client_advances", []);
    setStorage("client_advances", list.filter(a => a.id !== id));
  },

  // Products
  getProducts: (): Product[] => getStorage("products", INITIAL_PRODUCTS),
  createProduct: (data: CreateProductData): Product => {
    const list = getStorage("products", INITIAL_PRODUCTS);
    const newProd: Product = {
      company_id: data.company_id,
      id: "prod-" + Date.now(),
      code: data.code,
      name: data.name,
      description: data.description || null,
      unit_price: data.unit_price,
      tva_rate: data.tva_rate ?? 19,
      unit: data.unit || "unité",
      display_order: data.display_order ?? list.length + 1,
      timbre_exempt: data.timbre_exempt ?? false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [...list, newProd];
    setStorage("products", updated);
    return newProd;
  },
  updateProduct: (id: string, data: CreateProductData): Product => {
    const list = getStorage("products", INITIAL_PRODUCTS);
    const index = list.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Product not found");
    const updatedProd = { ...list[index], ...data, updated_at: new Date().toISOString() };
    list[index] = updatedProd;
    setStorage("products", list);
    return updatedProd;
  },
  deleteProduct: (id: string): void => {
    const list = getStorage("products", INITIAL_PRODUCTS);
    setStorage("products", list.filter(p => p.id !== id));
  },

  // Invoices
  getInvoices: (status?: string, invoiceType?: string): Invoice[] => {
    let list = getStorage("invoices", INITIAL_INVOICES);
    if (status && status !== "all") {
      const target = status.toLowerCase();
      list = list.filter(i => {
        const s = i.status?.toLowerCase() || "";
        if (target === "unpaid" || target === "issued") {
          return s === "unpaid" || s === "issued" || s === "overdue" || s === "partial" || s === "partially_paid";
        }
        return s === target;
      });
    }
    if (invoiceType && invoiceType !== "all") {
      const targetType = invoiceType.toLowerCase();
      list = list.filter(i => {
        const t = i.invoice_type?.toLowerCase() || "";
        if (targetType === "invoice") {
          return t === "invoice" || t === "standard";
        }
        return t === targetType;
      });
    }
    return list;
  },
  getInvoicesWithClients: (status?: string, invoiceType?: string): InvoiceWithClient[] => {
    const invoices = mockStore.getInvoices(status, invoiceType);
    const clients = mockStore.getClients();
    return invoices.map(inv => {
      const client = clients.find(c => c.id === inv.client_id) || null;
      return {
        ...inv,
        clients: client
      };
    });
  },
  getInvoice: (id: string): Invoice | null => {
    const list = getStorage("invoices", INITIAL_INVOICES);
    const inv = list.find(i => i.id === id);
    if (!inv) return null;
    const client = mockStore.getClient(inv.client_id);
    return { ...inv, clients: client } as any;
  },
  getInvoiceItems: (invoice_id: string): any[] => {
    const itemsMap = getStorage("invoice_items", INITIAL_INVOICE_ITEMS);
    return itemsMap[invoice_id] || [];
  },
  getNextInvoiceNumber: (): string => {
    const list = getStorage("invoices", INITIAL_INVOICES);
    const year = new Date().getFullYear();
    const count = list.length + 1;
    return `FACT-${year}-${count.toString().padStart(4, "0")}`;
  },
  createInvoice: (data: CreateInvoiceData): Invoice => {
    const list = getStorage("invoices", INITIAL_INVOICES);
    const subtotal_ht = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tva_amount = data.items.reduce((sum, item) => {
      const rate = item.tva_rate ?? 19;
      return sum + (item.quantity * item.unit_price * (rate / 100));
    }, 0);
    // PLACEHOLDER stamp-duty calc (flat 1% of subtotal_ht, capped 2500) —
    // intentional simplification for UI dev speed, not a bug. Source of truth
    // is calculate_timbre() in src-tauri/src/database.rs (graduated 1%/1.5%/2%
    // brackets on subtotal_ht+tva_amount, 5 DA floor, no cap). Must be
    // replaced with the real logic before this path goes to production.
    const timbre = data.payment_method === "especes" ? Math.min(2500, Math.round(subtotal_ht * 0.01)) : 0;
    const total_ttc = subtotal_ht + tva_amount + timbre;
    const amount_paid = data.amount_paid || 0;

    const newInvoice: Invoice = {
      company_id: data.company_id,
      id: "inv-" + Date.now(),
      invoice_number: data.invoice_number || mockStore.getNextInvoiceNumber(),
      client_id: data.client_id,
      invoice_date: data.invoice_date,
      due_date: data.due_date || data.invoice_date,
      month_period: data.invoice_date.substring(0, 7),
      subtotal_ht,
      tva_rate: 19,
      tva_amount,
      timbre,
      total_ttc,
      amount_paid,
      balance_due: total_ttc - amount_paid,
      status: data.status || "unpaid",
      invoice_type: data.invoice_type || "invoice",
      payment_method: data.payment_method || "virement",
      notes: data.notes || null,
      header_note: data.header_note || null,
      original_invoice_id: data.original_invoice_id || null,
      discount: data.discount || null,
      discount_type: data.discount_type || null,
      discount_value: data.discount_value || null,
      use_secondary_register: data.use_secondary_register || false,
      selected_secondary_rc: data.selected_secondary_rc || null,
      selected_secondary_address: data.selected_secondary_address || null,
      custom_title: data.custom_title || "Facture",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [newInvoice, ...list];
    setStorage("invoices", updated);

    // Store items
    const itemsMap = getStorage("invoice_items", INITIAL_INVOICE_ITEMS);
    const products = mockStore.getProducts();
    itemsMap[newInvoice.id] = data.items.map((it, idx) => {
      const prod = products.find(p => p.id === it.product_id);
      return {
        id: `item-${Date.now()}-${idx}`,
        invoice_id: newInvoice.id,
        product_id: it.product_id,
        // Falls back to the item's own product_name/product_code for a
        // custom/one-off line item with no matching catalog product.
        product_code: prod?.code || it.product_code || "PROD",
        product_name: prod?.name || it.product_name || "Produit",
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: it.quantity * it.unit_price,
        tva_rate: it.tva_rate ?? 19,
        timbre_exempt: it.timbre_exempt || false
      };
    });
    setStorage("invoice_items", itemsMap);

    return newInvoice;
  },
  updateInvoice: (id: string, data: CreateInvoiceData): Invoice => {
    const list = getStorage("invoices", INITIAL_INVOICES);
    const index = list.findIndex(i => i.id === id);
    if (index === -1) throw new Error(`Invoice ${id} not found`);

    const existing = list[index];
    const subtotal_ht = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tva_amount = data.items.reduce((sum, item) => {
      const rate = item.tva_rate ?? 19;
      return sum + (item.quantity * item.unit_price * (rate / 100));
    }, 0);
    // PLACEHOLDER stamp-duty calc (flat 1% of subtotal_ht, capped 2500) —
    // intentional simplification for UI dev speed, not a bug. Source of truth
    // is calculate_timbre() in src-tauri/src/database.rs (graduated 1%/1.5%/2%
    // brackets on subtotal_ht+tva_amount, 5 DA floor, no cap). Must be
    // replaced with the real logic before this path goes to production.
    const timbre = data.payment_method === "especes" ? Math.min(2500, Math.round(subtotal_ht * 0.01)) : 0;
    const total_ttc = subtotal_ht + tva_amount + timbre;
    const amount_paid = data.amount_paid ?? existing.amount_paid ?? 0;

    const updatedInvoice: Invoice = {
      ...existing,
      invoice_number: data.invoice_number || existing.invoice_number,
      client_id: data.client_id,
      invoice_date: data.invoice_date,
      due_date: data.due_date || data.invoice_date,
      month_period: data.invoice_date.substring(0, 7),
      subtotal_ht,
      tva_rate: 19,
      tva_amount,
      timbre,
      total_ttc,
      amount_paid,
      balance_due: total_ttc - amount_paid,
      status: data.status || existing.status,
      invoice_type: data.invoice_type || existing.invoice_type,
      payment_method: data.payment_method || existing.payment_method,
      notes: data.notes ?? existing.notes,
      header_note: data.header_note ?? existing.header_note,
      discount: data.discount ?? existing.discount,
      discount_type: data.discount_type ?? existing.discount_type,
      discount_value: data.discount_value ?? existing.discount_value,
      use_secondary_register: data.use_secondary_register ?? existing.use_secondary_register,
      selected_secondary_rc: data.selected_secondary_rc ?? existing.selected_secondary_rc,
      selected_secondary_address: data.selected_secondary_address ?? existing.selected_secondary_address,
      custom_title: data.custom_title || existing.custom_title,
      updated_at: new Date().toISOString(),
    };

    list[index] = updatedInvoice;
    setStorage("invoices", list);

    const itemsMap = getStorage("invoice_items", INITIAL_INVOICE_ITEMS);
    const products = mockStore.getProducts();
    itemsMap[id] = data.items.map((it, idx) => {
      const prod = products.find(p => p.id === it.product_id);
      return {
        id: `item-${Date.now()}-${idx}`,
        invoice_id: id,
        product_id: it.product_id,
        product_code: prod?.code || it.product_code || "PROD",
        product_name: prod?.name || it.product_name || "Produit",
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: it.quantity * it.unit_price,
        tva_rate: it.tva_rate ?? 19,
        timbre_exempt: it.timbre_exempt || false
      };
    });
    setStorage("invoice_items", itemsMap);

    return updatedInvoice;
  },
  updateInvoiceStatus: (id: string, status: string): void => {
    const list = getStorage("invoices", INITIAL_INVOICES);
    const index = list.findIndex(i => i.id === id);
    if (index !== -1) {
      list[index].status = status;
      if (status === "paid") {
        list[index].amount_paid = list[index].total_ttc;
      }
      setStorage("invoices", list);
    }
  },
  updateInvoiceHeader: (id: string, invoiceNumber: string, customTitle: string | null): void => {
    const list = getStorage("invoices", INITIAL_INVOICES);
    const index = list.findIndex(i => i.id === id);
    if (index !== -1) {
      list[index].invoice_number = invoiceNumber;
      list[index].custom_title = customTitle;
      setStorage("invoices", list);
    }
  },
  deleteInvoice: (id: string): void => {
    const list = getStorage("invoices", INITIAL_INVOICES);
    setStorage("invoices", list.filter(i => i.id !== id));
  },

  // Payments
  getPayments: (invoice_id?: string): Payment[] => {
    let list = getStorage("payments", INITIAL_PAYMENTS);
    if (invoice_id) list = list.filter(p => p.invoice_id === invoice_id);
    return list;
  },
  createPayment: (data: CreatePaymentData): Payment => {
    const list = getStorage("payments", INITIAL_PAYMENTS);
    const newPay: Payment = {
      company_id: data.company_id,
      id: "pay-" + Date.now(),
      invoice_id: data.invoice_id,
      payment_date: data.payment_date,
      amount: data.amount,
      payment_method: data.payment_method || "virement",
      cheque_number: data.cheque_number || null,
      bank_name: data.bank_name || null,
      value_date: data.value_date || data.payment_date,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      employee_id: data.employee_id || null,
    };
    setStorage("payments", [newPay, ...list]);
    return newPay;
  },
  deletePayment: (id: string): void => {
    const list = getStorage("payments", INITIAL_PAYMENTS);
    setStorage("payments", list.filter(p => p.id !== id));
  },

  // Expenses
  getExpenses: (month_period?: string, project_id?: string): Expense[] => {
    let list = getStorage("expenses", INITIAL_EXPENSES);
    if (month_period) list = list.filter(e => e.month_period === month_period);
    if (project_id) list = list.filter(e => e.project_id === project_id);
    return list;
  },
  createExpense: (data: CreateExpenseData): Expense => {
    const list = getStorage("expenses", INITIAL_EXPENSES);
    // The Projects module has no mock data backing (db.projects.getAll's mock
    // fallback is always []), so there's nothing to resolve a name from here
    // — project_name stays null in mock/web-preview mode, same as every
    // other project-derived field in this app.
    const newExp: Expense = {
      company_id: data.company_id,
      id: "exp-" + Date.now(),
      expense_date: data.expense_date,
      category: data.category,
      description: data.description || null,
      amount: data.amount,
      payment_method: data.payment_method || "virement",
      reference: data.reference || null,
      notes: data.notes || null,
      month_period: data.expense_date.substring(0, 7),
      project_id: data.project_id || null,
      project_name: null,
      supplier_id: data.supplier_id || null,
      supplier_name: null,
      is_recurring: data.is_recurring || false,
      recurrence_interval: data.recurrence_interval || null,
      is_paid: data.is_paid ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setStorage("expenses", [newExp, ...list]);
    return newExp;
  },
  updateExpense: (data: UpdateExpenseData): Expense => {
    const list = getStorage("expenses", INITIAL_EXPENSES);
    const existing = list.find(e => e.id === data.id);
    if (!existing) throw new Error("Dépense introuvable");
    const updated: Expense = {
      ...existing,
      expense_date: data.expense_date,
      category: data.category,
      description: data.description || null,
      amount: data.amount,
      payment_method: data.payment_method || null,
      project_id: data.project_id || null,
      is_paid: data.is_paid,
      month_period: data.expense_date.substring(0, 7),
      updated_at: new Date().toISOString(),
    };
    setStorage("expenses", list.map(e => (e.id === data.id ? updated : e)));
    return updated;
  },
  deleteExpense: (id: string): void => {
    const list = getStorage("expenses", INITIAL_EXPENSES);
    setStorage("expenses", list.filter(e => e.id !== id));
  },

  // Projects (omada-agency branch only)
  getProjects: (): Project[] => getStorage("projects", INITIAL_PROJECTS),
  getProject: (id: string): Project | null => getStorage("projects", INITIAL_PROJECTS).find(p => p.id === id) || null,
  // Mirrors get_project_stats (Rust): budget_facture/budget_paye are
  // TTC-basis sums of every invoice tied to the project, regardless of type.
  getProjectStats: (project_id?: string): ProjectStats[] => {
    const projects = getStorage("projects", INITIAL_PROJECTS).filter(p => !project_id || p.id === project_id);
    const invoices = getStorage("invoices", INITIAL_INVOICES);
    return projects.map(p => {
      const linked = invoices.filter(i => i.project_id === p.id);
      return {
        project_id: p.id,
        planned_budget: p.planned_budget,
        budget_facture: linked.reduce((sum, i) => sum + (i.total_ttc || 0), 0),
        budget_paye: linked.reduce((sum, i) => sum + (i.amount_paid || 0), 0),
        task_count: 0,
        tasks_approved_count: 0,
        start_date: p.start_date,
        deadline: p.deadline,
      };
    });
  },
  // Mirrors get_project_profitability (Rust): HT revenue net of credit
  // notes, proformas excluded, minus direct expenses tied to the project.
  getProjectProfitability: (project_id: string): ProjectProfitability => {
    const invoices = getStorage("invoices", INITIAL_INVOICES).filter(
      i => i.project_id === project_id && (i.invoice_type === "invoice" || i.invoice_type === "credit_note")
    );
    const revenueHt = invoices.reduce((sum, i) => {
      const ht = i.subtotal_ht || 0;
      return sum + (i.invoice_type === "credit_note" ? -ht : ht);
    }, 0);
    const directExpenses = getStorage("expenses", INITIAL_EXPENSES)
      .filter(e => e.project_id === project_id)
      .reduce((sum, e) => sum + e.amount, 0);
    const netMargin = revenueHt - directExpenses;
    // Mock has no separate payments ledger keyed usefully here, so this
    // mirrors budget_paye above: each linked invoice's own amount_paid.
    const totalCollected = invoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0);
    return {
      project_id,
      revenue_ht: revenueHt,
      total_collected: totalCollected,
      direct_expenses: directExpenses,
      net_margin: netMargin,
      margin_percentage: revenueHt > 0 ? (netMargin / revenueHt) * 100 : 0,
    };
  },

  // Partners & equity distribution (omada-agency branch only)
  // Mirrors get_partners (Rust): same HT-revenue-minus-charges period
  // computation as getDashboardStats' revenueHt/netProfitHt, split by each
  // partner's equity_percentage. total_withdrawn/remaining_balance are
  // all-time, not period-scoped.
  getPartners: (year = 2025, months?: string[]): PartnerFinancials[] => {
    const invoices = mockStore.getInvoices("all", "invoice").filter(inv => {
      const d = new Date(inv.invoice_date);
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString();
      return y === year && (!months || months.length === 0 || months.includes(m));
    });
    const expenses = getStorage("expenses", INITIAL_EXPENSES).filter(exp => {
      const d = new Date(exp.expense_date);
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString();
      return y === year && (!months || months.length === 0 || months.includes(m));
    });
    const revenueHt = invoices.reduce((s, i) => s + (i.subtotal_ht || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netProfitHt = revenueHt - totalExpenses;

    const withdrawals = getStorage("partner_withdrawals", INITIAL_PARTNER_WITHDRAWALS);
    const partners = getStorage("partners", INITIAL_PARTNERS);

    return partners.map(p => {
      const totalWithdrawn = withdrawals.filter(w => w.partner_id === p.id).reduce((s, w) => s + w.amount, 0);
      const allocatedProfit = netProfitHt * (p.equity_percentage / 100);
      return {
        ...p,
        allocated_profit: allocatedProfit,
        total_withdrawn: totalWithdrawn,
        remaining_balance: allocatedProfit - totalWithdrawn,
      };
    });
  },
  // Mirrors get_monthly_partners_report (Rust): a strict single-month
  // aggregation for the executive PDF report, independent of getPartners'
  // year+months-list/all-time-withdrawals shape. Payroll figures always
  // fall back to 0/empty here — there is no mock payroll_runs data, same
  // convention as db.payroll.* elsewhere in this file.
  getMonthlyPartnersReport: (year: number, month: number): MonthlyBusinessReport => {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    const invoices = mockStore.getInvoices("all", "invoice").filter((inv) => {
      const d = new Date(inv.invoice_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const recettes_ht = invoices.reduce((s, i) => s + (i.subtotal_ht || 0), 0);

    const payments = getStorage("payments", INITIAL_PAYMENTS).filter((p) => {
      const d = new Date(p.payment_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const recettes_encaissees = payments.reduce((s, p) => s + p.amount, 0);

    const expenses = getStorage("expenses", INITIAL_EXPENSES).filter((e) => {
      const d = new Date(e.expense_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const charges_operationnelles = expenses.reduce((s, e) => s + e.amount, 0);

    const masse_salariale = 0; // no mock payroll_runs data
    const benefice_net = recettes_encaissees - (charges_operationnelles + masse_salariale);

    // Solde initial: cumulative net cash movement across every prior month.
    const allPayments = getStorage("payments", INITIAL_PAYMENTS).filter((p) => `${new Date(p.payment_date).getFullYear()}-${String(new Date(p.payment_date).getMonth() + 1).padStart(2, "0")}` < monthKey);
    const allExpenses = getStorage("expenses", INITIAL_EXPENSES).filter((e) => `${new Date(e.expense_date).getFullYear()}-${String(new Date(e.expense_date).getMonth() + 1).padStart(2, "0")}` < monthKey);
    const solde_initial = allPayments.reduce((s, p) => s + p.amount, 0) - allExpenses.reduce((s, e) => s + e.amount, 0);
    const solde_final = solde_initial + recettes_encaissees - charges_operationnelles - masse_salariale;

    const withdrawals = getStorage("partner_withdrawals", INITIAL_PARTNER_WITHDRAWALS);
    const partnerList = getStorage("partners", INITIAL_PARTNERS);
    let total_prelevements_mois = 0;
    const partners: MonthlyReportPartnerRow[] = partnerList.map((p) => {
      const prelevements_du_mois = withdrawals
        .filter((w) => w.partner_id === p.id && `${new Date(w.withdrawal_date).getFullYear()}-${String(new Date(w.withdrawal_date).getMonth() + 1).padStart(2, "0")}` === monthKey)
        .reduce((s, w) => s + w.amount, 0);
      total_prelevements_mois += prelevements_du_mois;
      const quote_part_benefice = benefice_net * (p.equity_percentage / 100);
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        equity_percentage: p.equity_percentage,
        quote_part_benefice,
        prelevements_du_mois,
        solde_net_a_verser: quote_part_benefice - prelevements_du_mois,
      };
    });

    const clients = getStorage("clients", INITIAL_CLIENTS);
    const projects = getStorage("projects", INITIAL_PROJECTS).filter((pr) => {
      if (!pr.deadline) return false;
      const d = new Date(pr.deadline);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const allInvoices = getStorage("invoices", []);
    const allExpensesForProjects = getStorage("expenses", INITIAL_EXPENSES);
    const projets_clotures: MonthlyReportProjectRow[] = projects.map((pr) => {
      const revenue_ht = allInvoices
        .filter((i: any) => i.project_id === pr.id && (i.invoice_type === "invoice" || i.invoice_type === "credit_note"))
        .reduce((s: number, i: any) => s + (i.invoice_type === "credit_note" ? -(i.subtotal_ht || 0) : (i.subtotal_ht || 0)), 0);
      const direct_expenses = allExpensesForProjects.filter((e) => e.project_id === pr.id).reduce((s, e) => s + e.amount, 0);
      const net_margin = revenue_ht - direct_expenses;
      return {
        id: pr.id,
        name: pr.name,
        client_name: clients.find((c) => c.id === pr.client_id)?.name || "-",
        deadline: pr.deadline || "-",
        revenue_ht,
        net_margin,
        margin_percentage: revenue_ht > 0 ? (net_margin / revenue_ht) * 100 : 0,
      };
    });

    const employees = getStorage("employees", INITIAL_EMPLOYEES);

    return {
      month: monthKey,
      year,
      month_num: month,
      solde_initial,
      recettes_ht,
      recettes_encaissees,
      charges_operationnelles,
      masse_salariale,
      solde_final,
      benefice_net,
      partners,
      total_prelevements_mois,
      employes_actifs_count: employees.filter((e) => e.is_active !== false).length,
      total_jours_travailles: 0,
      masse_salariale_payee: 0,
      masse_salariale_en_attente: 0,
      projets_clotures,
      generated_at: new Date().toISOString(),
    };
  },
  createPartner: (data: CreatePartnerData): Partner => {
    const list = getStorage("partners", INITIAL_PARTNERS);
    const existingTotal = list.filter(p => p.is_active).reduce((s, p) => s + p.equity_percentage, 0);
    if (existingTotal + data.equity_percentage > 100.0001) {
      throw new Error(`La répartition du capital dépasserait 100% (${existingTotal.toFixed(1)}% déjà attribués aux associés actifs)`);
    }
    const now = new Date().toISOString();
    const newPartner: Partner = {
      id: "partner-" + Date.now(),
      company_id: data.company_id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role || null,
      equity_percentage: data.equity_percentage,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    setStorage("partners", [...list, newPartner]);
    return newPartner;
  },
  updatePartner: (id: string, data: UpdatePartnerData): Partner => {
    const list = getStorage("partners", INITIAL_PARTNERS);
    const index = list.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Partner not found");
    if (data.is_active) {
      const existingTotal = list.filter(p => p.is_active && p.id !== id).reduce((s, p) => s + p.equity_percentage, 0);
      if (existingTotal + data.equity_percentage > 100.0001) {
        throw new Error(`La répartition du capital dépasserait 100% (${existingTotal.toFixed(1)}% déjà attribués par les autres associés actifs)`);
      }
    }
    const updated: Partner = {
      ...list[index],
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role || null,
      equity_percentage: data.equity_percentage,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    };
    list[index] = updated;
    setStorage("partners", list);
    return updated;
  },
  deletePartner: (id: string): void => {
    const list = getStorage("partners", INITIAL_PARTNERS);
    setStorage("partners", list.filter(p => p.id !== id));
  },
  getPartnerWithdrawals: (partner_id: string): PartnerWithdrawal[] =>
    getStorage("partner_withdrawals", INITIAL_PARTNER_WITHDRAWALS)
      .filter(w => w.partner_id === partner_id)
      .sort((a, b) => b.withdrawal_date.localeCompare(a.withdrawal_date)),
  recordPartnerWithdrawal: (data: CreateWithdrawalData): PartnerWithdrawal => {
    const list = getStorage("partner_withdrawals", INITIAL_PARTNER_WITHDRAWALS);
    const newWithdrawal: PartnerWithdrawal = {
      id: "withdrawal-" + Date.now(),
      partner_id: data.partner_id,
      withdrawal_date: data.withdrawal_date,
      amount: data.amount,
      payment_method: data.payment_method || null,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
    };
    setStorage("partner_withdrawals", [newWithdrawal, ...list]);
    return newWithdrawal;
  },
  deletePartnerWithdrawal: (id: string): void => {
    const list = getStorage("partner_withdrawals", INITIAL_PARTNER_WITHDRAWALS);
    setStorage("partner_withdrawals", list.filter(w => w.id !== id));
  },

  // Deliveries
  getDeliveryNotes: (client_id?: string): DeliveryNote[] => {
    let list = getStorage("deliveries", INITIAL_DELIVERIES);
    if (client_id) list = list.filter(d => d.client_id === client_id);
    const clients = mockStore.getClients();
    return list.map(d => ({
      ...d,
      clients: clients.find(c => c.id === d.client_id) || null
    }));
  },
  getDeliveryNote: (id: string): DeliveryNote | null => {
    const list = getStorage("deliveries", INITIAL_DELIVERIES);
    const note = list.find(d => d.id === id);
    if (!note) return null;
    const client = mockStore.getClient(note.client_id);
    return { ...note, clients: client } as any;
  },
  createDeliveryNote: (data: CreateDeliveryNoteData): DeliveryNote => {
    const list = getStorage("deliveries", INITIAL_DELIVERIES);
    const newNote: DeliveryNote = {
      company_id: data.company_id,
      id: "bl-" + Date.now(),
      delivery_number: data.delivery_number || `BL-${new Date().getFullYear()}-${(list.length + 1).toString().padStart(4, "0")}`,
      client_id: data.client_id,
      delivery_date: data.delivery_date,
      invoice_id: null,
      order_id: data.order_id || null,
      truck_plate: data.truck_plate || null,
      driver_name: data.driver_name || null,
      deliverer_name: data.deliverer_name || null,
      deliverer_nin: data.deliverer_nin || null,
      transporter_name: data.transporter_name || null,
      transporter_nin: data.transporter_nin || null,
      delivery_location: data.delivery_location || null,
      client_received_date: null,
      client_signature: null,
      supplier_delivered_date: data.delivery_date,
      is_invoiced: false,
      notes: data.notes || null,
      reserves: data.reserves || null,
      custom_title: data.custom_title || "Bon de Livraison",
      status: "draft",
      signed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setStorage("deliveries", [newNote, ...list]);
    return newNote;
  },
  updateDeliveryNote: (id: string, data: CreateDeliveryNoteData): DeliveryNote => {
    const list = getStorage("deliveries", INITIAL_DELIVERIES);
    const index = list.findIndex(n => n.id === id);
    if (index === -1) throw new Error(`Delivery note ${id} not found`);

    const updatedNote: DeliveryNote = {
      ...list[index],
      delivery_number: data.delivery_number || list[index].delivery_number,
      client_id: data.client_id,
      delivery_date: data.delivery_date,
      order_id: data.order_id ?? list[index].order_id,
      truck_plate: data.truck_plate ?? list[index].truck_plate,
      driver_name: data.driver_name ?? list[index].driver_name,
      deliverer_name: data.deliverer_name ?? list[index].deliverer_name,
      deliverer_nin: data.deliverer_nin ?? list[index].deliverer_nin,
      transporter_name: data.transporter_name ?? list[index].transporter_name,
      transporter_nin: data.transporter_nin ?? list[index].transporter_nin,
      delivery_location: data.delivery_location ?? list[index].delivery_location,
      notes: data.notes ?? list[index].notes,
      reserves: data.reserves ?? list[index].reserves,
      custom_title: data.custom_title || list[index].custom_title,
      updated_at: new Date().toISOString(),
    };
    list[index] = updatedNote;
    setStorage("deliveries", list);
    return updatedNote;
  },

  // Orders
  getOrders: (): Order[] => {
    const list = getStorage("orders", INITIAL_ORDERS);
    const clients = mockStore.getClients();
    return list.map(o => ({
      ...o,
      clients: clients.find(c => c.id === o.client_id) || null
    }));
  },
  getOrder: (id: string): Order | null => {
    const list = getStorage("orders", INITIAL_ORDERS);
    const order = list.find(o => o.id === id);
    if (!order) return null;
    const client = mockStore.getClient(order.client_id);
    return { ...order, clients: client } as any;
  },
  createOrder: (data: CreateOrderData): Order => {
    const list = getStorage("orders", INITIAL_ORDERS);
    const subtotal_ht = data.items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    const tva_amount = subtotal_ht * 0.19;
    const total_ttc = subtotal_ht + tva_amount;

    const newOrder: Order = {
      company_id: data.company_id,
      id: "ord-" + Date.now(),
      order_number: data.order_number || `BC-${new Date().getFullYear()}-${(list.length + 1).toString().padStart(4, "0")}`,
      client_id: data.client_id || "d2ca2c45-669d-4724-9b6e-913b1fe6d605",
      supplier_name: data.supplier_name || "SARL SORDI",
      supplier_address: data.supplier_address || "Zone Industrielle Oued Smar",
      supplier_email: data.supplier_email || "contact@sordi.dz",
      supplier_phone: data.supplier_phone || "021 55 44 33",
      supplier_rc: data.supplier_rc || "16/00-0984123B18",
      supplier_nif: data.supplier_nif || "001816098745231",
      supplier_nis: data.supplier_nis || "1984160900142",
      supplier_ai: data.supplier_ai || "16091245870",
      order_date: data.order_date,
      delivery_date: data.delivery_date || null,
      payment_terms: data.payment_terms || "30 jours",
      payment_method: data.payment_method || "virement",
      status: "draft",
      subtotal_ht,
      tva_rate: 19,
      tva_amount,
      total_ttc,
      notes: data.notes || null,
      custom_title: data.custom_title || "Bon de Commande",
      month_period: data.order_date.substring(0, 7),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setStorage("orders", [newOrder, ...list]);
    return newOrder;
  },
  updateOrder: (id: string, data: CreateOrderData): Order => {
    const list = getStorage("orders", INITIAL_ORDERS);
    const index = list.findIndex(o => o.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);

    const existing = list[index];
    const subtotal_ht = data.items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
    const tva_amount = subtotal_ht * 0.19;
    const total_ttc = subtotal_ht + tva_amount;

    const updatedOrder: Order = {
      ...existing,
      order_number: data.order_number || existing.order_number,
      client_id: data.client_id || existing.client_id,
      supplier_name: data.supplier_name ?? existing.supplier_name,
      supplier_address: data.supplier_address ?? existing.supplier_address,
      supplier_email: data.supplier_email ?? existing.supplier_email,
      supplier_phone: data.supplier_phone ?? existing.supplier_phone,
      supplier_rc: data.supplier_rc ?? existing.supplier_rc,
      supplier_nif: data.supplier_nif ?? existing.supplier_nif,
      supplier_nis: data.supplier_nis ?? existing.supplier_nis,
      supplier_ai: data.supplier_ai ?? existing.supplier_ai,
      order_date: data.order_date,
      delivery_date: data.delivery_date ?? existing.delivery_date,
      payment_terms: data.payment_terms ?? existing.payment_terms,
      payment_method: data.payment_method ?? existing.payment_method,
      subtotal_ht,
      tva_rate: 19,
      tva_amount,
      total_ttc,
      notes: data.notes ?? existing.notes,
      custom_title: data.custom_title || existing.custom_title,
      month_period: data.order_date.substring(0, 7),
      updated_at: new Date().toISOString(),
    };
    list[index] = updatedOrder;
    setStorage("orders", list);
    return updatedOrder;
  },

  // Employees
  getEmployees: (): Employee[] => getStorage("employees", INITIAL_EMPLOYEES),
  createEmployee: (data: CreateEmployeeData): Employee => {
    const list = getStorage("employees", INITIAL_EMPLOYEES);
    const newEmp: Employee = {
      company_id: data.company_id,
      id: "emp-" + Date.now(),
      name: data.name,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      base_salary: data.base_salary ?? null,
      hire_date: data.hire_date ?? null,
      contract_type: data.contract_type ?? null,
      rib: data.rib ?? null,
      external_code: data.external_code ?? null,
      photo_path: null,
    };
    setStorage("employees", [...list, newEmp]);
    return newEmp;
  },

  // Dashboard Aggregates
  getDashboardStats: (year = 2025, months?: string[]): DashboardStats => {
    const invoices = mockStore.getInvoices("all", "invoice");
    const expenses = mockStore.getExpenses();

    const filteredInvoices = invoices.filter(inv => {
      const d = new Date(inv.invoice_date);
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString();
      return (y === year) && (!months || months.length === 0 || months.includes(m));
    });

    const filteredExpenses = expenses.filter(exp => {
      const d = new Date(exp.expense_date);
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString();
      return (y === year) && (!months || months.length === 0 || months.includes(m));
    });

    const totalRevenue = filteredInvoices.reduce((s, i) => s + (i.total_ttc || 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalPaid = filteredInvoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
    const totalUnpaid = Math.max(0, totalRevenue - totalPaid);
    // True operating profitability (HT basis) — mirrors get_dashboard_stats
    // (Rust): revenue_ht reuses the same subtotal_ht sum as sales_cumulatives
    // below, TVA/timbre never counted as profit. Kept separate from
    // totalRevenue/totalExpenses above, which stay TTC and keep feeding the
    // existing chart/PeriodStats exactly as before.
    const revenueHt = filteredInvoices.reduce((s, i) => s + (i.subtotal_ht || 0), 0);
    const netProfitHt = revenueHt - totalExpenses;
    const marginPercentageHt = revenueHt > 0 ? (netProfitHt / revenueHt) * 100 : 0;

    const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const monthlyData = monthLabels.map((lbl, idx) => {
      const mStr = (idx + 1).toString();
      const monthInvoices = invoices.filter(i => {
        const d = new Date(i.invoice_date);
        return d.getFullYear() === year && (d.getMonth() + 1).toString() === mStr;
      });
      const monthExpenses = expenses.filter(e => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === year && (d.getMonth() + 1).toString() === mStr;
      });
      const rev = monthInvoices.reduce((s, i) => s + i.total_ttc, 0);
      const exp = monthExpenses.reduce((s, e) => s + e.amount, 0);
      return {
        label: lbl,
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
        // Mock mode has no payroll_runs model — all charges here are
        // "expenses only", nothing settled through payroll to split out.
        expenses_only: exp,
        payroll_amount: 0
      };
    });

    return {
      current_month: {
        revenue: totalRevenue / 4,
        expenses: totalExpenses / 4,
        profit: (totalRevenue - totalExpenses) / 4
      },
      yearly: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses
      },
      payments: {
        paid: totalPaid,
        unpaid: totalUnpaid,
        initial_debt: 480000,
        total_receivables: totalUnpaid + 480000,
        outstanding_invoice_count: invoices.filter(i => i.invoice_type !== "credit_note" && i.invoice_type !== "proforma" && i.total_ttc > (i.amount_paid || 0)).length
      },
      sales_cumulatives: {
        total_ht: filteredInvoices.reduce((s, i) => s + i.subtotal_ht, 0),
        total_ttc: totalRevenue,
        total_tva: filteredInvoices.reduce((s, i) => s + i.tva_amount, 0),
        total_timbre: filteredInvoices.reduce((s, i) => s + (i.timbre || 0), 0)
      },
      monthly_data: monthlyData,
      daily_data: [
        { label: "01", revenue: 85000, expenses: 15000, profit: 70000, expenses_only: 15000, payroll_amount: 0 },
        { label: "05", revenue: 140000, expenses: 32000, profit: 108000, expenses_only: 32000, payroll_amount: 0 },
        { label: "10", revenue: 320000, expenses: 60000, profit: 260000, expenses_only: 60000, payroll_amount: 0 },
        { label: "15", revenue: 450000, expenses: 95000, profit: 355000, expenses_only: 95000, payroll_amount: 0 },
        { label: "20", revenue: 600000, expenses: 110000, profit: 490000, expenses_only: 110000, payroll_amount: 0 },
        { label: "25", revenue: 780000, expenses: 140000, profit: 640000, expenses_only: 140000, payroll_amount: 0 },
        { label: "30", revenue: 950000, expenses: 180000, profit: 770000, expenses_only: 180000, payroll_amount: 0 }
      ],
      product_stats: [
        { product_id: "a1ad9717-44b7-44d8-b705-5bdb14851f17", product_code: "0/3", product_name: "Sable Concassé 0/3", total_quantity: 1830, total_amount: 1189500 },
        { product_id: "13af0f82-1921-4cf0-988f-b99bf0fd2a27", product_code: "3/8", product_name: "Gravier Concassé 3/8", total_quantity: 1860, total_amount: 1395000 },
        { product_id: "2cad951b-651b-4e13-b905-6e8980ccbe92", product_code: "8/15", product_name: "Gravier Calibré 8/15", total_quantity: 2600, total_amount: 1872000 },
        { product_id: "958a6fd8-a38f-4284-81ed-f56a35c39826", product_code: "TVC", product_name: "Tout Venant Carrière", total_quantity: 5600, total_amount: 2210000 },
        { product_id: "1d009e4a-bf6e-4dcb-9c67-35f56c37c378", product_code: "40/70", product_name: "Ballast & Enrochement", total_quantity: 4000, total_amount: 2400000 }
      ],
      growth: 14.8,
      invoice_count: filteredInvoices.length,
      is_month_view: !!(months && months.length > 0),
      revenue_ht: revenueHt,
      expense_count: filteredExpenses.length,
      net_profit_ht: netProfitHt,
      margin_percentage_ht: marginPercentageHt,
      outstanding_receivables: totalUnpaid,
    };
  },

  getClientCumulatives: (year = 2025, months?: string[]): ClientCumulativeRecord[] => {
    const invoices = mockStore.getInvoices("all", "invoice");
    const clients = mockStore.getClients();

    const clientMap: Record<string, ClientCumulativeRecord> = {};
    for (const c of clients) {
      clientMap[c.id] = {
        client_name: c.name,
        total_ht: 0,
        total_tva: 0,
        total_timbre: 0,
        total_ttc: 0,
        total_quantity: 0,
        invoice_count: 0
      };
    }

    for (const inv of invoices) {
      const d = new Date(inv.invoice_date);
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString();
      if (y === year && (!months || months.length === 0 || months.includes(m))) {
        if (clientMap[inv.client_id]) {
          clientMap[inv.client_id].total_ht += inv.subtotal_ht;
          clientMap[inv.client_id].total_tva += inv.tva_amount;
          clientMap[inv.client_id].total_timbre += (inv.timbre || 0);
          clientMap[inv.client_id].total_ttc += inv.total_ttc;
          clientMap[inv.client_id].invoice_count += 1;
          clientMap[inv.client_id].total_quantity += Math.round(inv.subtotal_ht / 700);
        }
      }
    }

    return Object.values(clientMap).filter(rec => rec.invoice_count > 0);
  },

  getClientProductCumulatives: (year = 2025, months?: string[]): any[] => {
    const clients = mockStore.getClients();
    const products = mockStore.getProducts();
    const result: any[] = [];

    for (const c of clients) {
      for (const p of products) {
        result.push({
          client_id: c.id,
          client_name: c.name,
          product_id: p.id,
          product_code: p.code,
          product_name: p.name,
          total_quantity: Math.floor(Math.random() * 800) + 100,
          total_amount: (Math.floor(Math.random() * 800) + 100) * p.unit_price
        });
      }
    }
    return result;
  },

  getCompanies: (): Company[] => {
    return getStorage("companies", DEFAULT_COMPANIES);
  },
  getCompany: (id: string): Company | null => {
    const list = getStorage("companies", DEFAULT_COMPANIES);
    return list.find(c => c.id === id) || null;
  },
  createCompany: (data: CreateCompanyData): Company => {
    const list = getStorage("companies", DEFAULT_COMPANIES);
    const newCompany: Company = {
      id: "company-" + Date.now(),
      name: data.name,
      logo_base64: data.logo_base64 || null,
      activity: data.activity || null,
      rc: data.rc || null,
      nif: data.nif || null,
      nis: data.nis || null,
      article_imposition: data.article_imposition || null,
      address: data.address || null,
      phone: data.phone || null,
      phones: data.phones || null,
      email: data.email || null,
      website: data.website || null,
      capital: data.capital || null,
      rib: data.rib || null,
      bank_agency: data.bank_agency || null,
      extra_info: data.extra_info || null,
      cnas_adherent: data.cnas_adherent || null,
      currency: data.currency || "DZD",
      invoice_prefix: data.invoice_prefix || "FAC-2026-",
      created_at: new Date().toISOString(),
    };
    setStorage("companies", [...list, newCompany]);
    return newCompany;
  },
  updateCompany: (id: string, data: CreateCompanyData): Company => {
    const list = getStorage("companies", DEFAULT_COMPANIES);
    const index = list.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Company not found");
    const updated: Company = {
      ...list[index],
      ...data,
      currency: data.currency || list[index].currency,
      invoice_prefix: data.invoice_prefix || list[index].invoice_prefix,
    };
    const newList = [...list];
    newList[index] = updated;
    setStorage("companies", newList);
    return updated;
  },

  getSettings: (): Record<string, string> => {
    return getStorage("settings", DEFAULT_SETTINGS);
  },
  updateSetting: (key: string, value: string): void => {
    const settings = getStorage("settings", DEFAULT_SETTINGS);
    setStorage("settings", { ...settings, [key]: value });
  },
  updateSettings: (settings: Record<string, string>): void => {
    const current = getStorage("settings", DEFAULT_SETTINGS);
    setStorage("settings", { ...current, ...settings });
  },

  getActivityLogs: (limit?: number, entity_type?: string, action?: string, start_date?: string, end_date?: string): ActivityLog[] => {
    const DEFAULT_LOGS: ActivityLog[] = [
      { id: "log-1", action: "CREATE", entity_type: "INVOICE", entity_id: "inv-012", description: "Facture FACT-2025-0010 créée pour SARL ALGERIE TELECOM", user_id: "local-user", created_at: "2025-05-18T11:00:00Z" },
      { id: "log-2", action: "CREATE", entity_type: "PAYMENT", entity_id: "pay-007", description: "Paiement de 740,300 DA enregistré pour FACT-2025-0009", user_id: "local-user", created_at: "2025-05-08T12:00:00Z" },
      { id: "log-3", action: "CREATE", entity_type: "CLIENT", entity_id: "145c6262-b0bc-437e-b537-dd5bef72c04b", description: "Nouveau client EURL EL HILAL ajouté", user_id: "local-user", created_at: "2025-05-01T10:15:00Z" },
      { id: "log-4", action: "CREATE", entity_type: "DELIVERY", entity_id: "bl-004", description: "Bon de livraison BL-2025-0004 généré pour SARL BIO PHARMA", user_id: "local-user", created_at: "2025-04-04T08:00:00Z" },
    ];
    let logs = getStorage<ActivityLog[]>("activity_logs", DEFAULT_LOGS);
    if (entity_type && entity_type !== "all") {
      logs = logs.filter(l => l.entity_type.toUpperCase() === entity_type.toUpperCase());
    }
    if (action && action !== "all") {
      logs = logs.filter(l => l.action.toUpperCase() === action.toUpperCase());
    }
    if (start_date) {
      logs = logs.filter(l => new Date(l.created_at) >= new Date(start_date));
    }
    if (end_date) {
      logs = logs.filter(l => new Date(l.created_at) <= new Date(end_date));
    }
    if (limit) {
      logs = logs.slice(0, limit);
    }
    return logs;
  },

  logActivity: (data: { action: string; entity_type: string; entity_id?: string | null; description: string }): void => {
    const DEFAULT_LOGS: ActivityLog[] = [
      { id: "log-1", action: "CREATE", entity_type: "INVOICE", entity_id: "inv-012", description: "Facture FACT-2025-0010 créée pour SARL ALGERIE TELECOM", user_id: "local-user", created_at: "2025-05-18T11:00:00Z" },
    ];
    const logs = getStorage<ActivityLog[]>("activity_logs", DEFAULT_LOGS);
    const newLog: ActivityLog = {
      id: "log-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      action: data.action.toUpperCase(),
      entity_type: data.entity_type.toUpperCase(),
      entity_id: data.entity_id || null,
      description: data.description,
      user_id: "local-user",
      created_at: new Date().toISOString(),
    };
    setStorage("activity_logs", [newLog, ...logs]);
  }
};
