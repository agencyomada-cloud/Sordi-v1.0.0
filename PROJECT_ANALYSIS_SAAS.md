# Deep SaaS Analysis & Technical Evaluation: Mobino Accounting (v4.0.0) / Omada Invoicing
*An Expert Audit of Technology Stack, Functional Modules, Regulatory Compliance & Growth Strategy*

---

## 🌐 Table of Contents / جدول المحتويات / Table des Matières
1. [English Version](#1-english-version)
2. [النسخة العربية (Arabic Version)](#2-النسخة-العربية-arabic-version)
3. [Version Française (French Version)](#3-version-française-french-version)

---

# 1. English Version

## Executive Summary & Product Vision
**Mobino Accounting (v4.0.0)** (also branded as **Omada Invoicing**) is a high-performance, offline-first hybrid SaaS & Desktop ERP tailored specifically for commercial, industrial, and trading enterprises operating in North Africa (specifically Algeria).

Unlike generic global cloud accounting tools (e.g., QuickBooks, Xero, Odoo), Mobino provides native out-of-the-box compliance with **2025 Algerian Commercial & Fiscal Laws**, integrating local tax calculations (*Droit de Timbre*, dynamic TVA rates, strict NIF/NIS/RC/AI legal mentions), multi-document commercial workflows, and specialized industrial production logs.

---

## 🛠️ Complete Technical Stack & Tooling Audit

| Architecture Layer | Technology / Library | Technical Purpose & Strategic Benefit |
| :--- | :--- | :--- |
| **Desktop Shell & Backend Core** | **Tauri 2.0** + **Rust** | Ultra-lightweight native desktop shell. Provides zero runtime latency, minimal memory usage (~30MB), and direct system access. |
| **Database & Persistence** | **SQLite** (`rusqlite` bundled in Rust) + `database.ts` | Local embedded relational database. Guarantees 100% offline functionality, fast SQL querying, and transactional integrity. |
| **PDF Rendering Engine** | **Headless Chrome** + `jspdf` + `html2canvas` | Background browser automation in Rust for pixel-perfect PDF rendering of legal invoices and delivery notes. |
| **Frontend Framework** | **React 18** + **TypeScript** | Strongly-typed component architecture ensuring code reliability, developer velocity, and maintainability. |
| **Build & Tooling** | **Vite** + `@vitejs/plugin-react-swc` | Next-gen lightning-fast dev server and optimized production bundler using SWC. |
| **UI Design System** | **Tailwind CSS** + **Shadcn UI** (Radix UI) | Premium modern dark/light UI design system, accessible UI primitives, smooth micro-interactions. |
| **Typography & Icons** | **Space Grotesk** + **Lucide React** | Modern monospace-inspired aesthetic tailored for financial numbers and clear navigation. |
| **State & Async Data** | **TanStack React Query v5** | Server-state caching, automatic refetching, mutation management, and async state synchronization. |
| **Form Management & Schema** | **React Hook Form** + **Zod** | Type-safe form validation for complex financial entries, tax rates, and client forms. |
| **Analytics & Data Visuals** | **Recharts** | Dynamic financial dashboards, revenue vs. expense trends, and sales volume charts. |
| **Data Interoperability** | **SheetJS (`xlsx`)** + **Python (`pandas`)** | Excel sheet parsing and automated financial data imports/exports (`ETAT DES SUIVI FACT CLIENTS`). |
| **Mobile Cross-Platform Setup** | **Android Shell Scripts** (`build_android.sh`) | Architecture readiness for mobile compilation and deployment. |

---

## 💼 Core Functionalities: What Mobino Does

### 1. 2025 Algerian Legal & Tax Compliance Engine
- **Legal Entity Metadata**: Mandatory storing & rendering of **NIF** (*Numéro d'Identification Fiscale*), **NIS** (*Numéro d'Identification Statistique*), **RC** (*Registre du Commerce*), and **AI** (*Article d'Imposition*).
- **Progressive Droit de Timbre (Stamp Duty)**: Automated tax calculation based on DA price brackets:
  - Up to 30,000 DA: **1%**
  - 30,001 DA – 100,000 DA: **1.5%**
  - Above 100,000 DA: **2%** (Minimum: 5 DA).
- **Dynamic TVA (VAT)**: Multi-rate support (19% standard, 9% reduced, 0% exempt with custom legal notices).
- **Credit Notes (*Factures d'Avoir*)**: Unique `AV-XXX` sequential numbering, enforcing linkage to original invoice IDs.
- **Numbers-to-Words Conversion**: Automated legal DA spelling in PDF invoices (`numberToWords.ts`).

### 2. End-to-End Sales & Commercial Workflow
1. **Proforma Invoice (`NewProforma.tsx`)**: Price quotes convert demand into formal offers.
2. **Purchase Order (`Orders.tsx`)**: Supplier and buyer commitment tracking.
3. **Delivery Slip (`Deliveries.tsx`)**: Log driver details, vehicle license plates, driver NIN, delivery locations, client receipt confirmations.
4. **Final Invoice (`Invoices.tsx`)**: One-click transformation of delivery notes/proformas into legal invoices.
5. **Credit Note (`NewCreditNote.tsx`)**: Formal commercial returns or discount adjustments.

### 3. CRM & Client Financial Ledger
- Real-time **Debit / Credit balance tracking** (Total invoiced, total paid, remaining receivables).
- **Client Advances (`clientAdvances`)**: Support for partial payments, bank check numbers, bank names, issue dates.
- **Multi-Register Support**: Secondary commercial register (RC) and secondary addresses per client.

### 4. Specialized Industrial Production & Expense Tracking
- **Production Logs (`production`)**: Monitor industrial raw extraction, waste percentages, and merchantable output.
- **Treasury & Expense Register (`Expenses.tsx`)**: Categorized expense logs for real-time net cash flow and net profit calculation.

### 5. HR & Project Performance Matrix
- Employee directory, role assignments, project scorecards, and performance metrics (`scores`).

---

## 🚀 SaaS Expert Evaluation & Growth Strategy

### Strengths & Competitive Moat
1. **Hyper-Localized Compliance**: Standard SaaS ERPs lack built-in Algerian *Droit de Timbre* and NIF/NIS workflows. Mobino captures this niche completely.
2. **Zero-Latency Offline-First**: Local Rust + SQLite execution ensures instant load times even in areas with spotty internet connectivity.
3. **Low Infrastructure Cost**: Desktop client distribution shifts computing workload to the user's desktop, reducing cloud server operational expenses.

### Strategic Roadmap to Enterprise SaaS
- **Phase 1: Cloud-Sync & Hybrid Mode**: Introduce optional cloud DB syncing (Supabase / PostgreSQL API) while preserving local cache.
- **Phase 2: Multi-Tenant RBAC**: Implement Role-Based Access Control (Admin, Accountant, Sales Representative, Stock Manager).
- **Phase 3: Automated Communications & Payments**: Integrate WhatsApp / SMS payment reminders and automated e-invoicing export formats.
- **Phase 4: Field Sales Mobile App**: Build an Android/iOS field app for delivery drivers to generate digital delivery slips on the spot.

---

---

# 2. النسخة العربية (Arabic Version)

## 📋 الملخص التنفيذي ورؤية المنتج
برنامج **Mobino Accounting (الاصدار 4.0.0)** (والمعروف أيضاً بـ **Omada Invoicing**) هو نظام إداري ومالي متكامل (ERP) مصمم ليعمل دون الحاجة للاتصال بالإنترنت (Offline-First) مع قدرات عالية على التزامن، والمخصص خصيصاً للمؤسسات التجارية والصناعية في منطقة شمال أفريقيا (وبالأخص الجزائر).

على عكس البرامج العالمية العامة، يقدم Mobino مطابقة قانونية وضريبية كاملة ومباشرة مع **تشريعات الفوترة الجزائرية لسنة 2025**، بما في ذلك حساب **حقوق الطابع (Droit de Timbre)**، والنسب المتعددة للرقم الاستدلالي للضريبة على القيمة المضافة (TVA)، وإدارة البيانات القانونية (NIF, NIS, RC, AI)، إضافة إلى إدارة الدورة التجارية وشبكات الإنتاج.

---

## 🛠️ التحليل التقني الشامل والأدوات المستخدمة

| الطبقة البرمجية | التكنولوجيا / المكتبة | الغرض التقني والفائدة الاستراتيجية |
| :--- | :--- | :--- |
| **المحرك المكتبي والخلية الخلفية** | **Tauri 2.0** + **Rust** | إطار عمل مكتبي فائق السرعة وخفيف الوزن (استهلاك ذاكرة أقل من 30 ميغابايت) مع أمان أعلى في إدارة البيانات. |
| **قواعد البيانات والحفظ المحلي** | **SQLite** (`rusqlite` في Rust) | قاعدة بيانات علاقاتية مدمجة تضمن العمل الكامل بدون إنترنت وتسريع استعلامات المعاملات المالية. |
| **محرك إنتاج ملفات PDF** | **Headless Chrome** + `jspdf` | توليد طباعة رقمية مطابقة تماماً للمواصفات القانونية للسطور والترويسة والذيل المالي. |
| **واجهة المستخدم الأمامية** | **React 18** + **TypeScript** | بناء برجمي متين وقوي يُقلل الأخطاء البرمجية ويضمن سهولة التطوير والصيانة. |
| **أدوات البناء والتطوير** | **Vite** + SWC | خادم تطوير فائق السرعة وتجميع محزم للملفات بشكل محسّن للغاية. |
| **نظام التصميم والواجهات** | **Tailwind CSS** + **Shadcn UI** | تصميم عصري جذاب يدعم الوضع الليلي والنهاري مع مكونات تفاعلية انسيابية جداً. |
| **الخطوط والأيقونات** | **Space Grotesk** + **Lucide** | جمالية رقمية حديثة مخصصة لعرض الأرقام المالية والقوائم بشكل واضح. |
| **إدارة الحالة والبيانات** | **TanStack React Query v5** | إدارة الحالة اللاتزامنية، التحديث التلقائي للبيانات، وتخزين المؤقت المتقدم. |
| **التحقق من البيانات والنماذج** | **React Hook Form** + **Zod** | تحقق دقيق ومحمي من نوع البيانات للنماذج المالية والأسعار والضرائب. |
| **الرسوم البيانية والتحليلات** | **Recharts** | لوحات قيادة رقمية لمتابعة الإيرادات والمصروفات والأرباح وحجم المبيعات. |
| **معالجة وتبادل البيانات** | **SheetJS (`xlsx`)** + **Python** | استيراد وتصدير ملفات إكسل المالية والتتبع التلقائي لحسابات الزبائن. |
| **تطبيقات الهاتف المحمول** | **Android Shell Scripts** | تجهيز المشروع للترجمة والتشغيل على نظام أندرويد للهواتف الذكية. |

---

## 💼 الوظائف الأساسية: ماذا يقدم برنامج Mobino؟

### 1. محرك المطابقة القانونية والضريبية الجزائرية 2025
- **البيانات القانونية للمؤسسة**: التخزين والطباعة الآلية للـ **NIF** (الرقم الجبائي)، **NIS** (الرقم الإحصائي)، **RC** (السجل التجاري)، و **AI** (رقم المادة).
- **حساب حقوق الطابع (Droit de Timbre)**: حساب تلقائي وفقاً للشغور المالي بالدينار الجزائري:
  - حتى 30,000 د.ج: **1%**
  - من 30,001 د.ج إلى 100,000 د.ج: **1.5%**
  - أكثر من 100,000 د.ج: **2%** (الحد الأدنى: 5 د.ج).
- **الضريبة على القيمة المضافة (TVA)**: دعم معدلات 19% (العادي)، 9% (المخفض)، و 0% (المعفى مع التنبيه القانوني).
- **فواتير التعديل / الإلغاء (Factures d'Avoir)**: ترقيم تسلسلي فريد يبدأ بـ `AV-XXX` مع ربط إجباري بالفاتورة الأصلية.
- **تحويل الأرقام إلى حروف (Number to Words)**: تحويل المبالغ الإجمالية بالدينار الجزائري إلى عبارات نصية في ملفات PDF.

### 2. دورة المبيعات والعمليات التجارية الكاملة
1. **الفاتورة الشكليات (Proforma)**: تقديم عروض الأسعار للزبائن.
2. **أوامر الشراء (Bons de Commande)**: متابعة الطلبيات مع الموردين أو الزبائن.
3. **وصل التسليم (Bons de Livraison)**: تسجيل بيانات السائق، رقم اللوحة، رقم بطاقة التعريف، ومكان التسليم.
4. **الفاتورة النهائية (Factures)**: تحويل وصليات التسليم إلى فاتورة نهائية بنقرة واحدة.
5. **فاتورة الإرجاع (Avoir)**: تسوية المرتجعات أو التخفيضات التجارية.

### 3. إدارة الزبائن وحسابات الديون (CRM)
- متابعة **رصيد الديون والاستحقاقات** لكل زبون (المبلغ المفوتر، المبلغ المدفوع، المتبقي).
- **التسقيعات والدفعات المقدمة (Client Advances)**: تسجيل الشيكات، البنوك، وتواريخ الاستحقاق.
- **تعدد السجلات التجارية**: دعم السجلات والaddresses الثانوية للزبائن.

### 4. تتبع الإنتاج الصناعي والمصاريف
- **سجلات الإنتاج (Production Logs)**: متابعة الكميات المستخرجة، نسبة الضياع (Waste)، والمنتج النهائي الصالح للبيع.
- **خزينة المصاريف (Expenses)**: تصنيف المصاريف اليومية والتشغيلية وحساب صافي التدفق النقدي.

### 5. إدارة الموظفين وتقييم الأداء
- سجل الموظفين، الأدوار، وماتريكس تقييم الأداء والمشاريع.

---

## 🚀 التقييم الاستراتيجي كبرنامج SaaS وخطة النمو

### نقاط القوة والميزة التنافسية
1. **التخصص المحلي الفائق**: البرامج العالمية تفشل في تقديم حلول مدمجة للضرائب الجزائرية وسندات التسليم المحلية.
2. **سرعة ممتازة وبدون إنترنت**: الحفظ المحلي تضمن عدم توقف العمل عند انقطاع الشبكة.
3. **تكلفة تشغيلية منخفضة**: توزيع المعالجة على أجهزة المستخدمين يقلل من تكاليف الخوادم السحابية.

### خريطة الطريق نحو SaaS المؤسسي
- **المرحلة 1: المزامنة الهجينة (Hybrid Sync)**: إدخال تزامن سحابي اختياري (Supabase / PostgreSQL) مع الحفاظ على النسخة المحلية.
- **المرحلة 2: إدارة الصلاحيات (RBAC)**: تحديد أدوار (مدير، محاسب، بائع، مسؤول مخزن).
- **المرحلة 3: الإشعارات والفوترة الرقمية**: ربط التطبيق بإشعارات الواتساب/SMS والتكامل مع منصات الضرائب الرقمية.
- **المرحلة 4: تطبيق الهواتف الذكية**: إطلاق تطبيق موجه للمندوبين الميدانيين وسائقي التوصيل.

---

---

# 3. Version Française (French Version)

## 📋 Résumé Exécutif & Vision Produit
**Mobino Accounting (v4.0.0)** (également nommé **Omada Invoicing**) est une solution ERP et de gestion commerciale Offline-First à haute performance, conçue spécifiquement pour les PME/TPE et entreprises industrielles opérant en Algérie et dans la région MENA.

Contrairement aux logiciels SaaS génériques internationaux (QuickBooks, Xero, Odoo), Mobino intègre de façon native et automatique la **Conformité Légale et Fiscale Algérienne 2025** (Droit de Timbre, taux de TVA dynamiques, mentions légales NIF/NIS/RC/AI), la gestion documentaire commerciale complète et le suivi de production industrielle.

---

## 🛠️ Audit Technique Complet & Outils Utilises

| Couche Technique | Technologie / Librairie | Rôle Technique & Avantage Stratégique |
| :--- | :--- | :--- |
| **Noyau Desktop & Backend** | **Tauri 2.0** + **Rust** | Application native ultra-légère, empreinte mémoire minimale (< 30Mo), performances maximales et sécurité des données. |
| **Base de Données & Stockage** | **SQLite** (`rusqlite` en Rust) | Base de données relationnelle embarquée garantissant 100% de fonctionnement hors-ligne et requêtes SQL ultra-rapides. |
| **Moteur de Génération PDF** | **Headless Chrome** + `jspdf` | Rendu PDF haute précision en arrière-plan pour l'impression des factures légales et bons de livraison. |
| **Framework Frontend** | **React 18** + **TypeScript** | Architecture modulaire fortement typée assurant la fiabilité du code et la facilité de maintenance. |
| **Outils de Build** | **Vite** + SWC | Serveur de développement instantané et bundler de production hautement optimisé. |
| **Systeme de Design UI** | **Tailwind CSS** + **Shadcn UI** | Interface utilisateur moderne (Dark/Light mode), composants accessibles et animations fluides. |
| **Typographie & Icones** | **Space Grotesk** + **Lucide** | Esthétique financière moderne adaptée à la lisibilité des chiffres et de la navigation. |
| **Gestion d'État & Asynchrone** | **TanStack React Query v5** | Caching intelligent des requêtes, synchronisation d'état et mise à jour automatique. |
| **Validation des Formulaires** | **React Hook Form** + **Zod** | Sécurisation et validation stricte des saisies financières, taxes et fiches clients. |
| **Analytique & Graphiques** | **Recharts** | Tableaux de bord dynamiques pour le suivi du chiffre d'affaires, des dépenses et des bénéfices. |
| **Interopérabilité des Données** | **SheetJS (`xlsx`)** + **Python** | Importation/exportation de fichiers Excel et suivi des états de créances clients. |
| **Déploiement Mobile** | **Android Shell Scripts** | Préparation de l'architecture pour la compilation et le déploiement sur Android. |

---

## 💼 Fonctionnalités Clés : Ce Que Fait Mobino

### 1. Moteur de Conformité Fiscale & Légale Algérie 2025
- **Mentions Légales Entreprise**: Gestion et impression automatique du **NIF**, **NIS**, **RC** et **AI** (*Article d'Imposition*).
- **Calcul du Droit de Timbre**: Calcul progressif automatique selon les tranches réglementaires en Dinars Algériens (DA) :
  - Jusqu'à 30 000 DA : **1%**
  - De 30 001 DA à 100 000 DA : **1.5%**
  - Au-dessus de 100 000 DA : **2%** (Minimum légal : 5 DA).
- **TVA Dynamique**: Prise en charge des taux à 19% (normal), 9% (réduit) et 0% (exonéré avec mention légale).
- **Factures d'Avoir**: Numérotation séquentielle dédiée (`AV-XXX`) et liaison obligatoire avec la facture d'origine.
- **Conversion Chiffres en Lettres**: Traduction automatique du montant TTC en lettres sur les PDF (`numberToWords.ts`).

### 2. Flux Commercial & Documentaire Complet
1. **Facture Proforma (`NewProforma.tsx`)** : Devis et propositions commerciales.
2. **Bon de Commande (`Orders.tsx`)** : Suivi des commandes clients et fournisseurs.
3. **Bon de Livraison (`Deliveries.tsx`)** : Enregistrement des données du chauffeur, matricule camion, NIN et accusé de réception client.
4. **Facture Définitive (`Invoices.tsx`)** : Conversion en un clic des bons de livraison et proformas en factures légales.
5. **Facture d'Avoir (`NewCreditNote.tsx`)** : Gestion des retours de marchandises et réductions commerciales.

### 3. CRM Client & Suivi de Créances
- **Suivi des Soldes (Débit / Crédit)** : Calcul en temps réel des montants facturés, encaissés et du reste à recouvrir.
- **Avances & Acomptes Clients (`clientAdvances`)** : Enregistrement des paiements partiels, références chèques et banques.
- **Registres Secondaires** : Gestion des adresses et registres du commerce (RC) secondaires.

### 4. Suivi de Production Industrielle & Trésorerie
- **Saisie de Production (`ProductionLog`)** : Suivi de l'extraction, du taux de déchet (Waste) et du produit marchand.
- **Gestion de Caisse & Dépenses (`Expenses.tsx`)** : Suivi des flux financiers entrants et sortants pour le calcul du profit net.

### 5. Gestion RH & Évaluation des Performances
- Annuaire du personnel, attribution des rôles et grilles de scoring de performance par projet.

---

## 🚀 Évaluation SaaS & Stratégie de Croissance

### Forces & Avantages Concurrentiels
1. **Hyper-Spécialisation Réglementaire** : Mobino résout la problématique de la conformité algérienne négligée par les ERP internationaux.
2. **Exécution Ultra-Rapide Hors-Ligne** : L'architecture Tauri + SQLite garantit une réactivité instantanée et une continuité de travail sans connexion Internet.
3. **Coût d'Infrastructure Réduit** : Le traitement local réduit considérablement les frais de serveurs cloud.

### Feuille de Route de Croissance SaaS
- **Phase 1 : Synchronisation Hybride Cloud** : Ajout d'une option de synchronisation des données (Supabase / API PostgreSQL) tout en conservant le mode offline.
- **Phase 2 : Gestion Multi-Utilisateurs & Rôles (RBAC)** : Définition des niveaux d'accès (Administrateur, Comptable, Commercial, Magasinier).
- **Phase 3 : Automatisations & Relances** : Intégration de relances de paiement automatiques par WhatsApp/SMS et exportation e-invoicing.
- **Phase 4 : Application Mobile Terrain** : Déploiement d'une application Android pour les livreurs et commerciaux de terrain.

---
*Generated by Antigravity AI SaaS Analysis Tooling*
